from __future__ import annotations

from queue import Empty, Full, Queue
from threading import Lock
from typing import Any, Mapping

from ..envelope import canonical_json, strict_json_loads
from ..errors import TransportCapacityError
from .base import CommandTransport


class InMemoryTransport(CommandTransport):
    def __init__(
        self,
        *,
        max_pending_requests: int = 128,
        max_pending_responses: int = 128,
        max_request_bytes: int = 65_536,
        max_response_bytes: int = 2_097_152,
    ) -> None:
        for value in (
            max_pending_requests,
            max_pending_responses,
            max_request_bytes,
            max_response_bytes,
        ):
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
                raise ValueError("Transport limits must be positive integers")
        self._max_request_bytes = max_request_bytes
        self._max_response_bytes = max_response_bytes
        self._requests: Queue[Mapping[str, Any]] = Queue(maxsize=max_pending_requests)
        self._responses: Queue[Mapping[str, Any]] = Queue(maxsize=max_pending_responses)
        self._running = False
        self._lock = Lock()

    def start(self) -> None:
        with self._lock:
            self._running = True

    def stop(self) -> None:
        with self._lock:
            self._running = False

    def receive(self, timeout: float | None = None) -> Mapping[str, Any] | None:
        if not self._is_running():
            return None
        try:
            return self._requests.get(timeout=timeout)
        except Empty:
            return None

    def send_response(self, response: Mapping[str, Any]) -> None:
        if not self._is_running():
            raise RuntimeError("Transport is not running")
        normalized = self._bounded_copy(
            response,
            self._max_response_bytes,
            "TRANSPORT_RESPONSE_TOO_LARGE",
            "Transport response exceeds the configured size limit",
        )
        try:
            self._responses.put_nowait(normalized)
        except Full as exc:
            raise TransportCapacityError(
                "TRANSPORT_RESPONSE_CAPACITY",
                "Transport response capacity is exhausted",
            ) from exc

    def health(self) -> dict[str, Any]:
        return {
            "healthy": self._is_running(),
            "transport": "in_memory",
            "pending_requests": self._requests.qsize(),
            "pending_responses": self._responses.qsize(),
            "request_capacity": self._requests.maxsize,
            "response_capacity": self._responses.maxsize,
        }

    def submit(self, command: Mapping[str, Any]) -> None:
        if not self._is_running():
            raise RuntimeError("Transport is not running")
        normalized = self._bounded_copy(
            command,
            self._max_request_bytes,
            "TRANSPORT_REQUEST_TOO_LARGE",
            "Transport request exceeds the configured size limit",
        )
        try:
            self._requests.put_nowait(normalized)
        except Full as exc:
            raise TransportCapacityError(
                "TRANSPORT_REQUEST_CAPACITY",
                "Transport request capacity is exhausted",
            ) from exc

    def next_response(self, timeout: float | None = None) -> Mapping[str, Any] | None:
        try:
            return self._responses.get(timeout=timeout)
        except Empty:
            return None

    def _is_running(self) -> bool:
        with self._lock:
            return self._running

    @staticmethod
    def _bounded_copy(
        value: Mapping[str, Any],
        max_bytes: int,
        code: str,
        message: str,
    ) -> Mapping[str, Any]:
        try:
            document = canonical_json(value)
        except Exception as exc:
            raise TransportCapacityError(
                "TRANSPORT_INVALID_MESSAGE",
                "Transport message must be valid JSON data",
            ) from exc
        if len(document.encode("utf-8")) > max_bytes:
            raise TransportCapacityError(code, message)
        normalized = strict_json_loads(document)
        if not isinstance(normalized, Mapping):
            raise TransportCapacityError(
                "TRANSPORT_INVALID_MESSAGE",
                "Transport message must be a JSON object",
            )
        return normalized
