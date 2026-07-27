from typing import Dict, Tuple

from .policy import LocalOnlyPolicy
from .provider import (
    DuplicateModelError,
    DuplicateProviderError,
    ModelEndpoint,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ProviderDisabledError,
    UnknownModelError,
    UnknownProviderError,
)


class ModelRegistry:
    def __init__(self, policy: LocalOnlyPolicy | None = None) -> None:
        self._policy = policy or LocalOnlyPolicy()
        self._providers: Dict[str, ModelProvider] = {}
        self._models: Dict[str, ModelEndpoint] = {}

    def register(self, provider: ModelProvider) -> None:
        if provider.name in self._providers:
            raise DuplicateProviderError(f"Provider is already registered: {provider.name}")

        endpoints = provider.endpoints()
        pending_model_ids = set()
        for endpoint in endpoints:
            if endpoint.provider != provider.name:
                raise ValueError(
                    f"Endpoint provider {endpoint.provider} does not match {provider.name}"
                )
            if endpoint.boundary is not provider.boundary:
                raise ValueError(
                    f"Endpoint boundary for {endpoint.model_id} does not match its provider"
                )
            if endpoint.model_id in self._models or endpoint.model_id in pending_model_ids:
                raise DuplicateModelError(f"Model is already registered: {endpoint.model_id}")
            pending_model_ids.add(endpoint.model_id)

        self._providers[provider.name] = provider
        for endpoint in endpoints:
            self._models[endpoint.model_id] = endpoint

    def provider(self, name: str) -> ModelProvider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise UnknownProviderError(f"Unknown provider: {name}") from exc

    def endpoint(self, model_id: str) -> ModelEndpoint:
        try:
            return self._models[model_id]
        except KeyError as exc:
            raise UnknownModelError(f"Unknown model: {model_id}") from exc

    def providers(self) -> Tuple[str, ...]:
        return tuple(sorted(self._providers))

    def models(self) -> Tuple[ModelEndpoint, ...]:
        return tuple(self._models[key] for key in sorted(self._models))

    def complete(self, request: ModelRequest) -> ModelResponse:
        endpoint = self.endpoint(request.model_id)
        self._policy.enforce(request, endpoint)
        provider = self.provider(endpoint.provider)
        if not provider.enabled:
            raise ProviderDisabledError(f"Provider is disabled: {provider.name}")
        return provider.complete(request)
