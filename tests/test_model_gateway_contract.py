import json
import os
import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch

from kernel.model_gateway import (
    DataClassification,
    DuplicateModelError,
    DuplicateProviderError,
    GatewayConfigurationError,
    LocalOnlyPolicy,
    Message,
    ModelRegistry,
    ModelRequest,
    PolicyViolationError,
    ProviderBoundary,
    ProviderDisabledError,
    ProviderUnavailableError,
    UnknownModelError,
    build_registry,
)
from kernel.model_gateway.providers import GitHubModelsProvider, MockProvider


class FakeGitHubTransport:
    def __init__(self) -> None:
        self.calls = 0
        self.token_present = False

    def complete(self, *, token: str, request: ModelRequest) -> str:
        self.calls += 1
        self.token_present = bool(token)
        return f"fake:{request.messages[-1].content}"


class ProviderContractMixin:
    model_id = ""
    classification = DataClassification.SENSITIVE

    def build_provider(self):
        raise NotImplementedError

    def provider_environment(self):
        return nullcontext()

    def test_endpoint_contract(self) -> None:
        provider = self.build_provider()
        endpoints = provider.endpoints()

        self.assertEqual(len(endpoints), 1)
        self.assertEqual(endpoints[0].model_id, self.model_id)
        self.assertEqual(endpoints[0].provider, provider.name)
        self.assertEqual(endpoints[0].boundary, provider.boundary)
        self.assertIn("text", endpoints[0].capabilities)

    def test_completion_contract(self) -> None:
        provider = self.build_provider()
        request = ModelRequest(
            model_id=self.model_id,
            messages=(Message(role="user", content="contract"),),
            data_classification=self.classification,
        )

        with self.provider_environment():
            response = provider.complete(request)

        self.assertEqual(response.model_id, self.model_id)
        self.assertEqual(response.provider, provider.name)
        self.assertTrue(response.content)

    def test_unknown_model_contract(self) -> None:
        provider = self.build_provider()
        request = ModelRequest(
            model_id="unknown/model",
            messages=(Message(role="user", content="contract"),),
            data_classification=self.classification,
        )

        with self.assertRaises(UnknownModelError):
            provider.complete(request)


class TestMockProviderContract(ProviderContractMixin, unittest.TestCase):
    model_id = "mock/contract"

    def build_provider(self) -> MockProvider:
        return MockProvider(model_ids=(self.model_id,))

    def test_provider_enabled_requires_boolean_at_runtime(self) -> None:
        with self.assertRaises(ValueError):
            MockProvider(model_ids=(self.model_id,), enabled="false")


class TestGitHubModelsProviderContract(ProviderContractMixin, unittest.TestCase):
    model_id = "github-models/contract"
    classification = DataClassification.PUBLIC

    def build_provider(self) -> GitHubModelsProvider:
        return GitHubModelsProvider(
            model_ids=(self.model_id,),
            enabled=True,
            transport=FakeGitHubTransport(),
        )

    def provider_environment(self):
        return patch.dict(
            os.environ,
            {GitHubModelsProvider.TOKEN_ENV: "test-placeholder"},
        )


class TestGitHubModelsSafety(unittest.TestCase):
    def setUp(self) -> None:
        self.model_id = "github-models/safety"
        self.request = ModelRequest(
            model_id=self.model_id,
            messages=(Message(role="user", content="public"),),
            data_classification=DataClassification.PUBLIC,
        )

    def test_provider_is_disabled_by_default(self) -> None:
        provider = GitHubModelsProvider(model_ids=(self.model_id,))

        with self.assertRaises(ProviderDisabledError):
            provider.complete(self.request)

    def test_enabled_provider_requires_environment_credential(self) -> None:
        provider = GitHubModelsProvider(
            model_ids=(self.model_id,),
            enabled=True,
            transport=FakeGitHubTransport(),
        )

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(GatewayConfigurationError):
                provider.complete(self.request)

    def test_enabled_provider_requires_explicit_transport(self) -> None:
        provider = GitHubModelsProvider(
            model_ids=(self.model_id,),
            enabled=True,
        )

        with patch.dict(
            os.environ,
            {GitHubModelsProvider.TOKEN_ENV: "test-placeholder"},
        ):
            with self.assertRaises(ProviderUnavailableError):
                provider.complete(self.request)

    def test_enabled_provider_rejects_whitespace_credential(self) -> None:
        transport = FakeGitHubTransport()
        provider = GitHubModelsProvider(
            model_ids=(self.model_id,),
            enabled=True,
            transport=transport,
        )

        with patch.dict(
            os.environ,
            {GitHubModelsProvider.TOKEN_ENV: "   "},
        ):
            with self.assertRaises(GatewayConfigurationError):
                provider.complete(self.request)

        self.assertEqual(transport.calls, 0)

    def test_provider_enabled_requires_boolean_at_runtime(self) -> None:
        with self.assertRaises(ValueError):
            GitHubModelsProvider(
                model_ids=(self.model_id,),
                enabled="false",
                transport=FakeGitHubTransport(),
            )


class TestModelRegistryPolicy(unittest.TestCase):
    def test_request_classification_requires_enum(self) -> None:
        with self.assertRaises(ValueError):
            ModelRequest(
                model_id="github-models/remote",
                messages=(Message(role="user", content="sensitive"),),
                data_classification="sensitive",
            )

    def test_local_only_policy_cannot_exclude_sensitive_data(self) -> None:
        with self.assertRaises(ValueError):
            LocalOnlyPolicy(local_only_classifications=frozenset())

    def test_sensitive_request_is_local_only(self) -> None:
        transport = FakeGitHubTransport()
        registry = ModelRegistry()
        registry.register(
            GitHubModelsProvider(
                model_ids=("github-models/remote",),
                enabled=True,
                transport=transport,
            )
        )
        request = ModelRequest(
            model_id="github-models/remote",
            messages=(Message(role="user", content="sensitive"),),
        )

        with self.assertRaises(PolicyViolationError):
            registry.complete(request)

        self.assertEqual(transport.calls, 0)

    def test_sensitive_request_can_use_local_provider(self) -> None:
        registry = ModelRegistry()
        registry.register(MockProvider())
        request = ModelRequest(
            model_id="mock/local-echo",
            messages=(Message(role="user", content="sensitive"),),
        )

        response = registry.complete(request)

        self.assertEqual(response.content, "sensitive")
        self.assertEqual(
            registry.endpoint(request.model_id).boundary,
            ProviderBoundary.LOCAL,
        )

    def test_registry_has_no_implicit_model_fallback(self) -> None:
        registry = ModelRegistry()
        registry.register(MockProvider())
        request = ModelRequest(
            model_id="missing/model",
            messages=(Message(role="user", content="request"),),
        )

        with self.assertRaises(UnknownModelError):
            registry.complete(request)

    def test_registry_rejects_duplicate_provider(self) -> None:
        registry = ModelRegistry()
        registry.register(MockProvider())

        with self.assertRaises(DuplicateProviderError):
            registry.register(MockProvider(model_ids=("mock/second",)))

    def test_registry_rejects_duplicate_model(self) -> None:
        registry = ModelRegistry()
        registry.register(MockProvider(model_ids=("shared/model",)))

        with self.assertRaises(DuplicateModelError):
            registry.register(
                GitHubModelsProvider(model_ids=("shared/model",))
            )

    def test_registry_rejects_duplicate_model_from_same_provider(self) -> None:
        registry = ModelRegistry()

        with self.assertRaises(DuplicateModelError):
            registry.register(MockProvider(model_ids=("mock/duplicate", "mock/duplicate")))

    def test_default_configuration_is_local_only(self) -> None:
        registry = build_registry()

        self.assertEqual(registry.providers(), ("github-models", "mock"))
        self.assertEqual(
            tuple(endpoint.model_id for endpoint in registry.models()),
            ("mock/local-echo",),
        )
        self.assertTrue(registry.provider("mock").enabled)
        self.assertFalse(registry.provider("github-models").enabled)


class TestGatewayBootstrap(unittest.TestCase):
    def test_provider_enabled_requires_boolean(self) -> None:
        config = {
            "version": 1,
            "sensitive_data_policy": "local_only",
            "providers": {
                "mock": {
                    "enabled": "false",
                    "models": ["mock/local-echo"],
                },
                "github_models": {
                    "enabled": False,
                    "credential_env": "GITHUB_MODELS_TOKEN",
                    "models": [],
                },
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "model-gateway.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")

            with self.assertRaises(GatewayConfigurationError):
                build_registry(config_path=config_path)


if __name__ == "__main__":
    unittest.main()
