from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from threading import Lock

from .errors import ReplayCapacityError, ReplayDetectedError


class ReplayStore(ABC):
    @abstractmethod
    def check_and_store(
        self, message_id: str, nonce: str, expires_at: datetime, now: datetime
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def health(self, now: datetime) -> dict[str, int | bool]:
        raise NotImplementedError


@dataclass(frozen=True)
class ReplayRecord:
    message_id: str
    nonce: str
    expires_at: datetime


class InMemoryReplayStore(ReplayStore):
    def __init__(self, max_entries: int = 10_000) -> None:
        if not isinstance(max_entries, int) or isinstance(max_entries, bool) or max_entries <= 0:
            raise ValueError("Replay store capacity must be positive")
        self._max_entries = max_entries
        self._records: dict[str, ReplayRecord] = {}
        self._nonces: dict[str, str] = {}
        self._lock = Lock()

    def check_and_store(
        self, message_id: str, nonce: str, expires_at: datetime, now: datetime
    ) -> None:
        with self._lock:
            self._purge_expired(now)
            if message_id in self._records:
                raise ReplayDetectedError("MESSAGE_ID_REPLAY", "Command message_id was already used")
            if nonce in self._nonces:
                raise ReplayDetectedError("NONCE_REPLAY", "Command nonce was already used")
            if len(self._records) >= self._max_entries:
                raise ReplayCapacityError()
            record = ReplayRecord(message_id=message_id, nonce=nonce, expires_at=expires_at)
            self._records[message_id] = record
            self._nonces[nonce] = message_id

    def health(self, now: datetime) -> dict[str, int | bool]:
        with self._lock:
            self._purge_expired(now)
            return {
                "healthy": True,
                "entries": len(self._records),
                "capacity": self._max_entries,
            }

    def _purge_expired(self, now: datetime) -> None:
        expired_ids = [
            message_id
            for message_id, record in self._records.items()
            if record.expires_at <= now
        ]
        for message_id in expired_ids:
            record = self._records.pop(message_id)
            self._nonces.pop(record.nonce, None)
