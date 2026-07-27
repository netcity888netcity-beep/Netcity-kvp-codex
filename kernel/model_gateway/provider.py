from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import FrozenSet, Tuple


class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    SENSITIVE = "sensitive"


class ProviderBoundary(str, Enum):
    LOCAL = "local"
    REMOTE = "remote"


class GatewayError(RuntimeError):
    pass


class GatewayConfigurationError(GatewayError):
    pass


class ProviderDisabledError(GatewayError):
    pass


class ProviderUnavailableError(GatewayError):
    pass


class PolicyViolationError(GatewayError):
    pass


class UnknownModelError(GatewayError):
    pass


class UnknownProviderError(GatewayError):
    pass


class DuplicateModelError(GatewayError):
    pass


class DuplicateProviderError(GatewayError):
    pass


@dataclass(frozen=True)
class Message:
    role: str
    content: str

    def __post_init__(self) -> None:
        if not self.role.strip():
            raise ValueError("Message role must not be empty")
        if not self.content:
            raise ValueError("Message content must not be empty")


@dataclass(frozen=True)
class ModelRequest:
    model_id: str
    messages: Tuple[Message, ...]
    data_classification: DataClassification = DataClassification.SENSITIVE

    def __post_init__(self) -> None:
        if not self.model_id.strip():
            raise ValueError("Model ID must not be empty")
        if not self.messages:
            raise ValueError("At least one message is required")
        if not isinstance(self.data_classification, DataClassification):
            raise ValueError("Data classification must be a DataClassification value")


@dataclass(frozen=True)
class ModelResponse:
    model_id: str
    provider: str
    content: str


@dataclass(frozen=True)
class ModelEndpoint:
    model_id: str
    provider: str
    boundary: ProviderBoundary
    capabilities: FrozenSet[str] = field(default_factory=lambda: frozenset({"text"}))

    def __post_init__(self) -> None:
        if not self.model_id.strip():
            raise ValueError("Model ID must not be empty")
        if not self.provider.strip():
            raise ValueError("Provider name must not be empty")
        if not self.capabilities:
            raise ValueError("At least one capability is required")


class ModelProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def boundary(self) -> ProviderBoundary:
        raise NotImplementedError

    @property
    @abstractmethod
    def enabled(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def endpoints(self) -> Tuple[ModelEndpoint, ...]:
        raise NotImplementedError

    @abstractmethod
    def complete(self, request: ModelRequest) -> ModelResponse:
        raise NotImplementedError
