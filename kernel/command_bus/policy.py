from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .envelope import ROLE_VALUES, SENSITIVITY_VALUES, TARGET_TYPE_VALUES
from .errors import ConfigurationError


ALLOWED_INTENTS = frozenset(
    {
        "model.prompt", "model.compare", "code.explain", "code.review",
        "architecture.review", "security.review", "status.query", "health.check",
        "message.deliver", "command.respond", "task.create", "task.progress",
        "task.complete", "model.respond",
    }
)
DENIED_INTENTS = frozenset(
    {
        "shell.execute", "powershell.execute", "cmd.execute", "filesystem.delete",
        "git.push", "git.force_push", "credential.read", "credential.export",
        "policy.disable", "audit.delete",
    }
)
ROLE_INTENTS = {
    "architect": ALLOWED_INTENTS,
    "builder": frozenset(
        {
            "model.prompt", "code.explain", "status.query", "health.check",
            "message.deliver", "command.respond", "task.progress", "task.complete",
        }
    ),
    "reviewer": frozenset(
        {
            "code.explain", "code.review", "architecture.review", "status.query",
            "health.check", "message.deliver", "command.respond",
        }
    ),
    "security": frozenset(
        {
            "security.review", "code.review", "status.query", "health.check",
            "message.deliver", "command.respond",
        }
    ),
    "observer": frozenset({"status.query", "health.check"}),
}
INTENT_TARGET_TYPES = {
    "model.prompt": frozenset({"model"}),
    "model.compare": frozenset({"model"}),
    "code.explain": frozenset({"model", "agent"}),
    "code.review": frozenset({"model", "agent"}),
    "architecture.review": frozenset({"model", "agent"}),
    "security.review": frozenset({"model", "agent"}),
    "status.query": frozenset({"service"}),
    "health.check": frozenset({"service"}),
    "message.deliver": frozenset({"service"}),
    "command.respond": frozenset({"service"}),
    "task.create": frozenset({"service"}),
    "task.progress": frozenset({"service"}),
    "task.complete": frozenset({"service"}),
    "model.respond": frozenset({"service"}),
}
CRITICAL_INTENTS = ALLOWED_INTENTS - {"status.query", "health.check"}


@dataclass(frozen=True)
class ProviderRule:
    provider_id: str
    locality: str
    enabled: bool


@dataclass(frozen=True)
class PolicyContext:
    actor_role: str
    target_type: str
    target_id: str
    intent: str
    sensitivity: str
    payload_size_bytes: int
    ttl_seconds: float
    replay_fresh: bool
    audit_available: bool


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    reason_code: str
    reason: str
    selected_provider: str | None
    applied_rules: tuple[str, ...]


@dataclass(frozen=True)
class RecipientPolicyContext:
    recipient_id: str
    recipient_type: str
    locality: str
    enabled: bool
    sensitivity: str


class PolicyEngine:
    def __init__(
        self,
        providers: Mapping[str, ProviderRule],
        routes: Mapping[tuple[str, str], str],
        *,
        max_payload_bytes: int,
        max_ttl_seconds: int,
    ) -> None:
        if not providers or not routes:
            raise ConfigurationError("Providers and explicit routes are required")
        if max_payload_bytes <= 0 or max_ttl_seconds <= 0:
            raise ConfigurationError("Policy limits must be positive")
        self._providers = dict(providers)
        self._routes = dict(routes)
        self._max_payload_bytes = max_payload_bytes
        self._max_ttl_seconds = max_ttl_seconds
        self._validate_configuration()

    def evaluate(self, context: PolicyContext) -> PolicyDecision:
        applied: list[str] = []
        if context.actor_role not in ROLE_VALUES:
            return self._deny("UNKNOWN_ROLE", "Actor role is not supported", applied)
        applied.append("role.known")
        if context.intent in DENIED_INTENTS:
            return self._deny("INTENT_FORBIDDEN", "Intent is explicitly forbidden", applied)
        if context.intent not in ALLOWED_INTENTS:
            return self._deny("UNKNOWN_INTENT", "Intent is not allowlisted", applied)
        applied.append("intent.allowlisted")
        if context.intent not in ROLE_INTENTS[context.actor_role]:
            return self._deny("ROLE_NOT_AUTHORIZED", "Role is not authorized for intent", applied)
        applied.append("role.intent_allowed")
        if context.target_type not in TARGET_TYPE_VALUES:
            return self._deny("INVALID_TARGET", "Target type is not supported", applied)
        if context.target_type not in INTENT_TARGET_TYPES[context.intent]:
            return self._deny("TARGET_NOT_ALLOWED", "Intent is not allowed for target type", applied)
        applied.append("target.type_allowed")
        if context.sensitivity not in SENSITIVITY_VALUES:
            return self._deny("INVALID_SENSITIVITY", "Sensitivity is not supported", applied)
        applied.append("sensitivity.known")
        if (
            not isinstance(context.payload_size_bytes, int)
            or isinstance(context.payload_size_bytes, bool)
            or context.payload_size_bytes < 0
        ):
            return self._deny("INVALID_PAYLOAD_SIZE", "Payload size is invalid", applied)
        if context.payload_size_bytes > self._max_payload_bytes:
            return self._deny("PAYLOAD_TOO_LARGE", "Payload exceeds policy limit", applied)
        applied.append("payload.within_limit")
        if (
            not isinstance(context.ttl_seconds, (int, float))
            or isinstance(context.ttl_seconds, bool)
            or context.ttl_seconds <= 0
            or context.ttl_seconds > self._max_ttl_seconds
        ):
            return self._deny("TTL_NOT_ALLOWED", "Command TTL is outside policy limits", applied)
        applied.append("ttl.within_limit")
        if context.replay_fresh is not True:
            return self._deny("REPLAY_DETECTED", "Command replay was detected", applied)
        applied.append("replay.fresh")
        if context.intent in CRITICAL_INTENTS and context.audit_available is not True:
            return self._deny("AUDIT_REQUIRED", "Required audit journal is unavailable", applied)
        applied.append("audit.available_or_not_required")

        provider_id = self._routes.get((context.target_type, context.target_id))
        if provider_id is None:
            return self._deny("NO_EXPLICIT_ROUTE", "No explicit route exists for target", applied)
        applied.append("route.explicit")
        provider = self._providers.get(provider_id)
        if provider is None:
            return self._deny("PROVIDER_NOT_CONFIGURED", "Provider is not configured", applied)
        if provider.enabled is not True:
            return self._deny("PROVIDER_DISABLED", "Selected provider is disabled", applied)
        applied.append("provider.enabled")
        if context.sensitivity in {"confidential", "restricted"} and provider.locality != "local":
            return self._deny("LOCAL_PROVIDER_REQUIRED", "Sensitive payload requires local provider", applied)
        applied.append("sensitivity.locality_allowed")
        if provider.provider_id in {"github_models", "github-models"} and context.sensitivity != "public":
            return self._deny(
                "GITHUB_MODELS_SENSITIVE_DENIED",
                "GitHub Models cannot receive sensitive payloads",
                applied,
            )
        applied.append("provider.sensitivity_allowed")
        return PolicyDecision(
            allowed=True,
            reason_code="ALLOWED",
            reason="Command is allowed by policy",
            selected_provider=provider.provider_id,
            applied_rules=tuple(applied),
        )

    def evaluate_recipient(self, context: RecipientPolicyContext) -> PolicyDecision:
        applied: list[str] = []
        if context.recipient_type not in {"actor", "model", "service"}:
            return self._deny("RECIPIENT_TYPE_DENIED", "Recipient type cannot be delivered", applied)
        applied.append("recipient.type_known")
        if context.enabled is not True:
            return self._deny("RECIPIENT_DISABLED", "Recipient is disabled", applied)
        applied.append("recipient.enabled")
        if context.locality not in {"local", "external"}:
            return self._deny("RECIPIENT_LOCALITY_UNKNOWN", "Recipient locality is unknown", applied)
        applied.append("recipient.locality_known")
        if context.sensitivity not in SENSITIVITY_VALUES:
            return self._deny("INVALID_SENSITIVITY", "Sensitivity is not supported", applied)
        applied.append("recipient.sensitivity_known")
        if context.sensitivity in {"confidential", "restricted"} and context.locality != "local":
            return self._deny(
                "LOCAL_RECIPIENT_REQUIRED",
                "Sensitive messages require local recipients",
                applied,
            )
        applied.append("recipient.classification_allowed")
        return PolicyDecision(
            allowed=True,
            reason_code="RECIPIENT_ALLOWED",
            reason="Recipient is allowed by policy",
            selected_provider=None,
            applied_rules=tuple(applied),
        )

    def _validate_configuration(self) -> None:
        for provider_id, provider in self._providers.items():
            if provider.provider_id != provider_id:
                raise ConfigurationError("Provider configuration ID mismatch")
            if provider.locality not in {"local", "external"}:
                raise ConfigurationError("Provider locality must be local or external")
            if not isinstance(provider.enabled, bool):
                raise ConfigurationError("Provider enabled must be boolean")
        for (target_type, target_id), provider_id in self._routes.items():
            if target_type not in TARGET_TYPE_VALUES or not target_id:
                raise ConfigurationError("Route target is invalid")
            if provider_id not in self._providers:
                raise ConfigurationError("Route references an unknown provider")

    @staticmethod
    def _deny(code: str, reason: str, applied: list[str]) -> PolicyDecision:
        return PolicyDecision(
            allowed=False,
            reason_code=code,
            reason=reason,
            selected_provider=None,
            applied_rules=tuple(applied),
        )
