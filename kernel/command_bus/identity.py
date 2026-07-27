from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .envelope import Actor, ROLE_VALUES
from .errors import ConfigurationError, IdentityError


@dataclass(frozen=True)
class LocalIdentity:
    actor_id: str
    role: str
    enabled: bool = True


class LocalIdentityRegistry:
    def __init__(self, identities: Mapping[str, LocalIdentity]) -> None:
        if not identities:
            raise ConfigurationError("At least one local identity is required")
        self._identities = dict(identities)

    @classmethod
    def from_config(cls, raw: Any) -> LocalIdentityRegistry:
        if not isinstance(raw, Mapping) or not raw:
            raise ConfigurationError("Local identities configuration is required")
        identities: dict[str, LocalIdentity] = {}
        for actor_id, value in raw.items():
            if not isinstance(actor_id, str) or not actor_id.strip():
                raise ConfigurationError("Identity IDs must be non-empty strings")
            if not isinstance(value, Mapping) or set(value) != {"role", "enabled"}:
                raise ConfigurationError("Each identity requires role and enabled fields")
            role = value["role"]
            enabled = value["enabled"]
            if role not in ROLE_VALUES:
                raise ConfigurationError("Identity contains an unsupported role")
            if not isinstance(enabled, bool):
                raise ConfigurationError("Identity enabled must be boolean")
            identities[actor_id] = LocalIdentity(actor_id=actor_id, role=role, enabled=enabled)
        return cls(identities)

    def authenticate(self, actor: Actor) -> LocalIdentity:
        identity = self._identities.get(actor.id)
        if identity is None:
            raise IdentityError("UNKNOWN_ACTOR", "Actor is not configured")
        if not identity.enabled:
            raise IdentityError("ACTOR_DISABLED", "Actor is disabled")
        if identity.role != actor.role:
            raise IdentityError("ROLE_MISMATCH", "Actor role does not match local configuration")
        return identity

    def identities(self) -> tuple[LocalIdentity, ...]:
        return tuple(self._identities[key] for key in sorted(self._identities))
