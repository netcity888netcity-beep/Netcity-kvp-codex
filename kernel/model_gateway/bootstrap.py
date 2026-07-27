import json
from pathlib import Path
from typing import Any, Dict, Tuple

from .provider import GatewayConfigurationError
from .providers import GitHubModelsProvider, GitHubModelsTransport, MockProvider
from .registry import ModelRegistry


DEFAULT_CONFIG_PATH = Path(__file__).with_name("config.json")


def _provider_config(config: Dict[str, Any], name: str) -> Dict[str, Any]:
    providers = config.get("providers")
    if not isinstance(providers, dict):
        raise GatewayConfigurationError("Gateway providers configuration is required")
    provider = providers.get(name)
    if not isinstance(provider, dict):
        raise GatewayConfigurationError(f"Provider configuration is required: {name}")
    return provider


def _model_ids(provider: Dict[str, Any], name: str) -> Tuple[str, ...]:
    models = provider.get("models")
    if not isinstance(models, list) or not all(
        isinstance(model_id, str) and model_id.strip() for model_id in models
    ):
        raise GatewayConfigurationError(f"Provider models must be a string list: {name}")
    return tuple(models)


def _enabled(provider: Dict[str, Any], name: str) -> bool:
    enabled = provider.get("enabled")
    if not isinstance(enabled, bool):
        raise GatewayConfigurationError(f"Provider enabled must be boolean: {name}")
    return enabled


def build_registry(
    config_path: Path | None = None,
    github_transport: GitHubModelsTransport | None = None,
) -> ModelRegistry:
    path = config_path or DEFAULT_CONFIG_PATH
    config = json.loads(path.read_text(encoding="utf-8"))
    if config.get("version") != 1:
        raise GatewayConfigurationError("Unsupported model gateway configuration version")
    if config.get("sensitive_data_policy") != "local_only":
        raise GatewayConfigurationError("Sensitive data policy must be local_only")

    mock_config = _provider_config(config, "mock")
    github_config = _provider_config(config, "github_models")
    if github_config.get("credential_env") != GitHubModelsProvider.TOKEN_ENV:
        raise GatewayConfigurationError(
            f"GitHub Models credential source must be {GitHubModelsProvider.TOKEN_ENV}"
        )

    registry = ModelRegistry()
    registry.register(
        MockProvider(
            model_ids=_model_ids(mock_config, "mock"),
            enabled=_enabled(mock_config, "mock"),
        )
    )
    registry.register(
        GitHubModelsProvider(
            model_ids=_model_ids(github_config, "github_models"),
            enabled=_enabled(github_config, "github_models"),
            transport=github_transport,
        )
    )
    return registry
