from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from threading import Lock
from typing import Any, Callable, Mapping

from .errors import RoutingError


@dataclass(frozen=True)
class GatewayRequest:
    target_id: str
    intent: str
    content: str
    sensitivity: str


@dataclass(frozen=True)
class GatewayResponse:
    provider: str
    target_id: str
    result: dict[str, Any]


class ModelGatewayPort(ABC):
    @abstractmethod
    def complete(self, request: GatewayRequest, provider_id: str) -> GatewayResponse:
        raise NotImplementedError


class PublishedModelGatewayAdapter(ModelGatewayPort):
    def __init__(
        self,
        registry: Any,
        *,
        message_factory: Callable[..., Any] | None = None,
        request_factory: Callable[..., Any] | None = None,
        classifications: Mapping[str, Any] | None = None,
    ) -> None:
        supplied = (message_factory, request_factory, classifications)
        if any(value is not None for value in supplied) and not all(
            value is not None for value in supplied
        ):
            raise ValueError("Published gateway contract dependencies must be provided together")
        if message_factory is None or request_factory is None or classifications is None:
            try:
                from kernel.model_gateway import DataClassification, Message, ModelRequest
            except ImportError as exc:
                raise RoutingError(
                    "MODEL_GATEWAY_UNAVAILABLE",
                    "Published Model Gateway is unavailable",
                ) from exc
            message_factory = Message
            request_factory = ModelRequest
            classifications = {
                "public": DataClassification.PUBLIC,
                "internal": DataClassification.INTERNAL,
                "confidential": DataClassification.SENSITIVE,
                "restricted": DataClassification.SENSITIVE,
            }
        if set(classifications) != {"public", "internal", "confidential", "restricted"}:
            raise ValueError("Published gateway classification mapping is incomplete")
        self._registry = registry
        self._message_factory = message_factory
        self._request_factory = request_factory
        self._classifications = dict(classifications)

    def complete(self, request: GatewayRequest, provider_id: str) -> GatewayResponse:
        classification = self._classifications.get(request.sensitivity)
        if classification is None:
            raise RoutingError("INVALID_SENSITIVITY", "Gateway sensitivity is unsupported")
        try:
            endpoint = self._registry.endpoint(request.target_id)
        except Exception as exc:
            raise RoutingError(
                "MODEL_GATEWAY_REJECTED",
                "Published Model Gateway rejected the request",
            ) from exc
        if getattr(endpoint, "provider", None) != provider_id:
            raise RoutingError("PROVIDER_MISMATCH", "Published gateway route does not match policy")
        try:
            gateway_request = self._request_factory(
                model_id=request.target_id,
                messages=(self._message_factory(role="user", content=request.content),),
                data_classification=classification,
            )
            response = self._registry.complete(gateway_request)
        except Exception as exc:
            raise RoutingError(
                "MODEL_GATEWAY_REJECTED",
                "Published Model Gateway rejected the request",
            ) from exc
        response_provider = getattr(response, "provider", None)
        response_model_id = getattr(response, "model_id", None)
        response_content = getattr(response, "content", None)
        if response_provider != provider_id:
            raise RoutingError("PROVIDER_MISMATCH", "Published gateway provider response mismatched")
        if response_model_id != request.target_id or not isinstance(response_content, str):
            raise RoutingError("MODEL_RESPONSE_INVALID", "Published gateway response is invalid")
        return GatewayResponse(
            provider=response_provider,
            target_id=response_model_id,
            result={
                "content": response_content,
                "intent": request.intent,
                "model_id": response_model_id,
                "provider": response_provider,
            },
        )


class MockModelGateway(ModelGatewayPort):
    def __init__(self, provider_id: str = "mock") -> None:
        self._provider_id = provider_id
        self._invocation_count = 0
        self._lock = Lock()

    @property
    def invocation_count(self) -> int:
        with self._lock:
            return self._invocation_count

    def complete(self, request: GatewayRequest, provider_id: str) -> GatewayResponse:
        if provider_id != self._provider_id:
            raise RoutingError("PROVIDER_NOT_IMPLEMENTED", "Selected provider is unavailable")
        with self._lock:
            self._invocation_count += 1
        return GatewayResponse(
            provider=provider_id,
            target_id=request.target_id,
            result={
                "content": request.content,
                "intent": request.intent,
                "model_id": request.target_id,
                "provider": provider_id,
            },
        )
