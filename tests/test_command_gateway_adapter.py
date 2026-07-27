import unittest
from dataclasses import dataclass
from enum import Enum

from kernel.command_bus.errors import RoutingError
from kernel.command_bus.gateway import GatewayRequest, PublishedModelGatewayAdapter


class Classification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    SENSITIVE = "sensitive"


@dataclass(frozen=True)
class Message:
    role: str
    content: str


@dataclass(frozen=True)
class ModelRequest:
    model_id: str
    messages: tuple[Message, ...]
    data_classification: Classification


@dataclass(frozen=True)
class Endpoint:
    provider: str


@dataclass(frozen=True)
class ModelResponse:
    model_id: str
    provider: str
    content: str


class PublishedRegistry:
    def __init__(self, provider: str = "mock") -> None:
        self.provider = provider
        self.last_request: ModelRequest | None = None

    def endpoint(self, model_id: str) -> Endpoint:
        return Endpoint(provider=self.provider)

    def complete(self, request: ModelRequest) -> ModelResponse:
        self.last_request = request
        return ModelResponse(
            model_id=request.model_id,
            provider=self.provider,
            content=request.messages[0].content,
        )


def build_adapter(registry: PublishedRegistry) -> PublishedModelGatewayAdapter:
    return PublishedModelGatewayAdapter(
        registry,
        message_factory=Message,
        request_factory=ModelRequest,
        classifications={
            "public": Classification.PUBLIC,
            "internal": Classification.INTERNAL,
            "confidential": Classification.SENSITIVE,
            "restricted": Classification.SENSITIVE,
        },
    )


class TestPublishedModelGatewayAdapter(unittest.TestCase):
    def test_adapter_matches_published_registry_contract(self) -> None:
        registry = PublishedRegistry()
        adapter = build_adapter(registry)
        response = adapter.complete(
            GatewayRequest(
                target_id="mock/local-echo",
                intent="model.prompt",
                content="offline request",
                sensitivity="restricted",
            ),
            "mock",
        )
        self.assertEqual(response.provider, "mock")
        self.assertEqual(response.target_id, "mock/local-echo")
        self.assertEqual(response.result["content"], "offline request")
        self.assertEqual(registry.last_request.data_classification, Classification.SENSITIVE)

    def test_adapter_rejects_policy_provider_mismatch_without_fallback(self) -> None:
        registry = PublishedRegistry(provider="unexpected")
        adapter = build_adapter(registry)
        with self.assertRaises(RoutingError) as raised:
            adapter.complete(
                GatewayRequest(
                    target_id="mock/local-echo",
                    intent="model.prompt",
                    content="offline request",
                    sensitivity="internal",
                ),
                "mock",
            )
        self.assertEqual(raised.exception.code, "PROVIDER_MISMATCH")
        self.assertIsNone(registry.last_request)


if __name__ == "__main__":
    unittest.main()
