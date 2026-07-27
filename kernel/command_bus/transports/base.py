from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Mapping


class CommandTransport(ABC):
    @abstractmethod
    def start(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def stop(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def receive(self, timeout: float | None = None) -> Mapping[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def send_response(self, response: Mapping[str, Any]) -> None:
        raise NotImplementedError

    @abstractmethod
    def health(self) -> dict[str, Any]:
        raise NotImplementedError
