import os
from typing import Iterable, Protocol, Tuple

from ..provider import (
    GatewayConfigurationError,
    ModelEndpoint,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ProviderBoundary,
    ProviderDisabledError,
    ProviderUnavailableError,
    UnknownModelError,
)


class GitHubModelsTransport(Protocol):
    def complete(self, *, token: str, request: ModelRequest) -> str:
        raise NotImplementedError


class GitHubModelsProvider(ModelProvider):
    TOKEN_ENV = "GITHUB_MODELS_TOKEN"

    def __init__(
        self,
        model_ids: Iterable[str] = (),
        enabled: bool = False,
        transport: GitHubModelsTransport | None = None,
    ) -> None:
        if not isinstance(enabled, bool):
            raise ValueError("Provider enabled must be boolean: github-models")
        self._model_ids = tuple(model_ids)
        self._enabled = enabled
        self._transport = transport

    @property
    def name(self) -> str:
        return "github-models"

    @property
    def boundary(self) -> ProviderBoundary:
        return ProviderBoundary.REMOTE

    @property
    def enabled(self) -> bool:
        return self._enabled

    def endpoints(self) -> Tuple[ModelEndpoint, ...]:
        return tuple(
            ModelEndpoint(
                model_id=model_id,
                provider=self.name,
                boundary=self.boundary,
            )
            for model_id in self._model_ids
        )

    def complete(self, request: ModelRequest) -> ModelResponse:
        if request.model_id not in self._model_ids:
            raise UnknownModelError(f"Unknown model: {request.model_id}")
        if not self.enabled:
            raise ProviderDisabledError(f"Provider is disabled: {self.name}")

        token = os.getenv(self.TOKEN_ENV)
        if token is None or not token.strip():
            raise GatewayConfigurationError(
                f"Required environment variable is not set: {self.TOKEN_ENV}"
            )
        if self._transport is None:
            raise ProviderUnavailableError(
                "GitHub Models transport is not configured"
            )

        content = self._transport.complete(token=token, request=request)
        return ModelResponse(
            model_id=request.model_id,
            provider=self.name,
            content=content,
        )
