from dataclasses import dataclass, field
from typing import FrozenSet

from .provider import (
    DataClassification,
    ModelEndpoint,
    ModelRequest,
    PolicyViolationError,
    ProviderBoundary,
)


@dataclass(frozen=True)
class LocalOnlyPolicy:
    local_only_classifications: FrozenSet[DataClassification] = field(
        default_factory=lambda: frozenset({DataClassification.SENSITIVE})
    )

    def __post_init__(self) -> None:
        if not all(
            isinstance(classification, DataClassification)
            for classification in self.local_only_classifications
        ):
            raise ValueError("Local-only classifications must use DataClassification values")
        if DataClassification.SENSITIVE not in self.local_only_classifications:
            raise ValueError("Sensitive data must remain local-only")

    def enforce(self, request: ModelRequest, endpoint: ModelEndpoint) -> None:
        if (
            request.data_classification in self.local_only_classifications
            and endpoint.boundary is not ProviderBoundary.LOCAL
        ):
            raise PolicyViolationError(
                f"Data classification {request.data_classification.value} requires a local provider"
            )
