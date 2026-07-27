from typing import Iterable, Tuple

from ..provider import (
    ModelEndpoint,
    ModelProvider,
    ModelRequest,
    ModelResponse,
    ProviderBoundary,
    ProviderDisabledError,
    UnknownModelError,
)


class MockProvider(ModelProvider):
    def __init__(
        self,
        model_ids: Iterable[str] = ("mock/local-echo",),
        enabled: bool = True,
    ) -> None:
        if not isinstance(enabled, bool):
            raise ValueError("Provider enabled must be boolean: mock")
        self._model_ids = tuple(model_ids)
        self._enabled = enabled

    @property
    def name(self) -> str:
        return "mock"

    @property
    def boundary(self) -> ProviderBoundary:
        return ProviderBoundary.LOCAL

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
        return ModelResponse(
            model_id=request.model_id,
            provider=self.name,
            content=request.messages[-1].content,
        )
