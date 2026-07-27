from __future__ import annotations

import hashlib
import json
import os
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Mapping
from uuid import uuid4

from .envelope import canonical_json, format_rfc3339
from .errors import AuditCapacityError, AuditEventTooLargeError, AuditUnavailableError


GENESIS_HASH = "0" * 64


@dataclass(frozen=True)
class AuditEventInput:
    event_id: str
    timestamp: str
    message_id: str
    trace_id: str
    actor_id: str
    actor_role: str
    target_id: str
    intent: str
    sensitivity: str
    policy_decision: str
    reason_code: str
    provider: str | None
    duration_ms: int
    result_status: str
    payload_hash: str
    conversation_id: str | None
    kind: str | None
    recipient_ids: tuple[str, ...]


@dataclass(frozen=True)
class AuditEvent(AuditEventInput):
    previous_event_hash: str
    event_hash: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AuditReservation:
    token: int


class AuditSink(ABC):
    @abstractmethod
    def reserve(self, count: int) -> tuple[AuditReservation, ...]:
        raise NotImplementedError

    @abstractmethod
    def cancel(self, reservation: AuditReservation) -> None:
        raise NotImplementedError

    @abstractmethod
    def append(
        self,
        event: AuditEventInput,
        reservation: AuditReservation | None = None,
    ) -> AuditEvent:
        raise NotImplementedError

    @abstractmethod
    def events(self, limit: int | None = None) -> tuple[AuditEvent, ...]:
        raise NotImplementedError

    @abstractmethod
    def health(self) -> bool:
        raise NotImplementedError


class InMemoryAuditSink(AuditSink):
    def __init__(
        self,
        *,
        available: bool = True,
        max_entries: int = 10_000,
        max_event_bytes: int = 16_384,
    ) -> None:
        _validate_sink_limits(max_entries, max_event_bytes)
        if not isinstance(available, bool):
            raise ValueError("Audit availability must be boolean")
        self._available = available
        self._max_entries = max_entries
        self._max_event_bytes = max_event_bytes
        self._events: list[AuditEvent] = []
        self._reservations: set[int] = set()
        self._next_reservation = 1
        self._lock = Lock()

    def reserve(self, count: int) -> tuple[AuditReservation, ...]:
        with self._lock:
            self._ensure_available()
            self._ensure_capacity(count)
            reservations = tuple(
                AuditReservation(token)
                for token in range(self._next_reservation, self._next_reservation + count)
            )
            self._next_reservation += count
            self._reservations.update(reservation.token for reservation in reservations)
            return reservations

    def cancel(self, reservation: AuditReservation) -> None:
        with self._lock:
            self._reservations.discard(reservation.token)

    def append(
        self,
        event: AuditEventInput,
        reservation: AuditReservation | None = None,
    ) -> AuditEvent:
        with self._lock:
            self._ensure_available()
            self._validate_reservation_or_capacity(reservation)
            previous_hash = self._events[-1].event_hash if self._events else GENESIS_HASH
            completed = _complete_event(event, previous_hash)
            _validate_event_size(completed, self._max_event_bytes)
            self._events.append(completed)
            if reservation is not None:
                self._reservations.remove(reservation.token)
            return completed

    def events(self, limit: int | None = None) -> tuple[AuditEvent, ...]:
        with self._lock:
            return _select_events(self._events, limit)

    def health(self) -> bool:
        with self._lock:
            return self._available and len(self._events) + len(self._reservations) < self._max_entries

    def set_available(self, available: bool) -> None:
        if not isinstance(available, bool):
            raise ValueError("Audit availability must be boolean")
        with self._lock:
            self._available = available

    def _ensure_available(self) -> None:
        if self._available is not True:
            raise AuditUnavailableError()

    def _ensure_capacity(self, count: int) -> None:
        _validate_reservation_count(count)
        if len(self._events) + len(self._reservations) + count > self._max_entries:
            raise AuditCapacityError()

    def _validate_reservation_or_capacity(
        self,
        reservation: AuditReservation | None,
    ) -> None:
        if reservation is None:
            self._ensure_capacity(1)
        elif reservation.token not in self._reservations:
            raise AuditUnavailableError()


class JsonlAuditSink(AuditSink):
    def __init__(
        self,
        path: Path,
        *,
        max_entries: int = 10_000,
        max_event_bytes: int = 16_384,
    ) -> None:
        _validate_sink_limits(max_entries, max_event_bytes)
        self._path = path
        self._max_entries = max_entries
        self._max_event_bytes = max_event_bytes
        self._reservations: set[int] = set()
        self._next_reservation = 1
        self._lock = Lock()
        self._events = self._load_existing()

    def reserve(self, count: int) -> tuple[AuditReservation, ...]:
        with self._lock:
            if not self._storage_available():
                raise AuditUnavailableError()
            self._ensure_capacity(count)
            reservations = tuple(
                AuditReservation(token)
                for token in range(self._next_reservation, self._next_reservation + count)
            )
            self._next_reservation += count
            self._reservations.update(reservation.token for reservation in reservations)
            return reservations

    def cancel(self, reservation: AuditReservation) -> None:
        with self._lock:
            self._reservations.discard(reservation.token)

    def append(
        self,
        event: AuditEventInput,
        reservation: AuditReservation | None = None,
    ) -> AuditEvent:
        with self._lock:
            self._validate_reservation_or_capacity(reservation)
            previous_hash = self._events[-1].event_hash if self._events else GENESIS_HASH
            completed = _complete_event(event, previous_hash)
            document = canonical_json(completed.to_dict()) + "\n"
            if len(document.encode("utf-8")) > self._max_event_bytes:
                raise AuditEventTooLargeError()
            try:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                descriptor = os.open(
                    self._path,
                    os.O_APPEND | os.O_CREAT | os.O_WRONLY,
                    0o600,
                )
                with os.fdopen(descriptor, "a", encoding="utf-8", newline="\n") as stream:
                    stream.write(document)
                    stream.flush()
                    os.fsync(stream.fileno())
            except OSError as exc:
                raise AuditUnavailableError() from exc
            self._events.append(completed)
            if reservation is not None:
                self._reservations.remove(reservation.token)
            return completed

    def events(self, limit: int | None = None) -> tuple[AuditEvent, ...]:
        with self._lock:
            return _select_events(self._events, limit)

    def health(self) -> bool:
        with self._lock:
            return (
                self._storage_available()
                and len(self._events) + len(self._reservations) < self._max_entries
            )

    def _load_existing(self) -> list[AuditEvent]:
        if not self._path.exists():
            return []
        try:
            if self._path.stat().st_size > self._max_entries * self._max_event_bytes:
                raise AuditCapacityError()
            events: list[AuditEvent] = []
            with self._path.open("rb") as stream:
                while True:
                    line = stream.readline(self._max_event_bytes + 1)
                    if not line:
                        break
                    if len(line) > self._max_event_bytes:
                        raise AuditEventTooLargeError()
                    if not line.strip():
                        continue
                    if len(events) >= self._max_entries:
                        raise AuditCapacityError()
                    events.append(_event_from_mapping(json.loads(line.decode("utf-8"))))
        except (OSError, UnicodeDecodeError, ValueError, TypeError, json.JSONDecodeError) as exc:
            raise AuditUnavailableError() from exc
        if not verify_audit_chain(events):
            raise AuditUnavailableError()
        return events

    def _storage_available(self) -> bool:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            return self._path.parent.is_dir()
        except OSError:
            return False

    def _ensure_capacity(self, count: int) -> None:
        _validate_reservation_count(count)
        if len(self._events) + len(self._reservations) + count > self._max_entries:
            raise AuditCapacityError()

    def _validate_reservation_or_capacity(
        self,
        reservation: AuditReservation | None,
    ) -> None:
        if reservation is None:
            self._ensure_capacity(1)
        elif reservation.token not in self._reservations:
            raise AuditUnavailableError()


class AuditJournal:
    def __init__(
        self,
        sink: AuditSink,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._sink = sink
        self._clock = clock or (lambda: datetime.now(UTC))
        self._id_factory = id_factory or (lambda: str(uuid4()))

    def reserve(self, count: int) -> tuple[AuditReservation, ...]:
        return self._sink.reserve(count)

    def cancel(self, reservation: AuditReservation) -> None:
        self._sink.cancel(reservation)

    def record(
        self,
        *,
        message_id: str,
        trace_id: str,
        actor_id: str,
        actor_role: str,
        target_id: str,
        intent: str,
        sensitivity: str,
        policy_decision: str,
        reason_code: str,
        provider: str | None,
        duration_ms: int,
        result_status: str,
        payload_hash: str,
        conversation_id: str | None = None,
        kind: str | None = None,
        recipient_ids: tuple[str, ...] = (),
        reservation: AuditReservation | None = None,
    ) -> AuditEvent:
        event = AuditEventInput(
            event_id=self._id_factory(),
            timestamp=format_rfc3339(self._clock()),
            message_id=message_id,
            trace_id=trace_id,
            actor_id=actor_id,
            actor_role=actor_role,
            target_id=target_id,
            intent=intent,
            sensitivity=sensitivity,
            policy_decision=policy_decision,
            reason_code=reason_code,
            provider=provider,
            duration_ms=max(0, duration_ms),
            result_status=result_status,
            payload_hash=payload_hash,
            conversation_id=conversation_id,
            kind=kind,
            recipient_ids=recipient_ids,
        )
        return self._sink.append(event, reservation)

    def events(self, limit: int | None = None) -> tuple[AuditEvent, ...]:
        return self._sink.events(limit)

    def health(self) -> bool:
        return self._sink.health()


def verify_audit_chain(events: list[AuditEvent] | tuple[AuditEvent, ...]) -> bool:
    previous_hash = GENESIS_HASH
    for event in events:
        if event.previous_event_hash != previous_hash:
            return False
        base = AuditEventInput(**{key: value for key, value in event.to_dict().items() if key not in {"previous_event_hash", "event_hash"}})
        expected = _complete_event(base, previous_hash)
        if event.event_hash != expected.event_hash:
            return False
        previous_hash = event.event_hash
    return True


def _complete_event(event: AuditEventInput, previous_hash: str) -> AuditEvent:
    values = asdict(event)
    values["previous_event_hash"] = previous_hash
    event_hash = hashlib.sha256(canonical_json(values).encode("utf-8")).hexdigest()
    return AuditEvent(**asdict(event), previous_event_hash=previous_hash, event_hash=event_hash)


def _validate_sink_limits(max_entries: int, max_event_bytes: int) -> None:
    for value in (max_entries, max_event_bytes):
        if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
            raise ValueError("Audit limits must be positive integers")


def _validate_reservation_count(count: int) -> None:
    if not isinstance(count, int) or isinstance(count, bool) or count <= 0:
        raise ValueError("Audit reservation count must be a positive integer")


def _validate_event_size(event: AuditEvent, max_event_bytes: int) -> None:
    if len(canonical_json(event.to_dict()).encode("utf-8")) > max_event_bytes:
        raise AuditEventTooLargeError()


def _select_events(events: list[AuditEvent], limit: int | None) -> tuple[AuditEvent, ...]:
    if limit is None:
        return tuple(events)
    if not isinstance(limit, int) or isinstance(limit, bool):
        raise ValueError("Audit event limit must be an integer")
    if limit <= 0:
        return ()
    return tuple(events[-limit:])


def _event_from_mapping(value: Mapping[str, Any]) -> AuditEvent:
    expected = set(AuditEvent.__dataclass_fields__)
    if set(value) != expected:
        raise ValueError("Audit event fields are invalid")
    normalized = dict(value)
    recipient_ids = normalized.get("recipient_ids")
    if not isinstance(recipient_ids, list) or not all(isinstance(item, str) for item in recipient_ids):
        raise ValueError("Audit recipient IDs are invalid")
    normalized["recipient_ids"] = tuple(recipient_ids)
    return AuditEvent(**normalized)
