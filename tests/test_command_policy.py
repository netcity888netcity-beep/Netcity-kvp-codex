import unittest

from kernel.command_bus.errors import ConfigurationError
from kernel.command_bus.policy import (
    PolicyContext,
    PolicyEngine,
    ProviderRule,
    RecipientPolicyContext,
)


def build_policy(
    *,
    providers: dict[str, ProviderRule] | None = None,
    routes: dict[tuple[str, str], str] | None = None,
) -> PolicyEngine:
    return PolicyEngine(
        providers
        or {
            "mock": ProviderRule("mock", "local", True),
            "command_bus": ProviderRule("command_bus", "local", True),
        },
        routes
        or {
            ("model", "mock/local-echo"): "mock",
            ("service", "command-bus"): "command_bus",
        },
        max_payload_bytes=1024,
        max_ttl_seconds=300,
    )


def context(**overrides: object) -> PolicyContext:
    values = {
        "actor_role": "architect",
        "target_type": "model",
        "target_id": "mock/local-echo",
        "intent": "model.prompt",
        "sensitivity": "internal",
        "payload_size_bytes": 100,
        "ttl_seconds": 60,
        "replay_fresh": True,
        "audit_available": True,
    }
    values.update(overrides)
    return PolicyContext(**values)


class TestCommandPolicy(unittest.TestCase):
    def test_unknown_intent_is_rejected(self) -> None:
        decision = build_policy().evaluate(context(intent="unknown.action"))
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "UNKNOWN_INTENT")

    def test_shell_execute_is_explicitly_forbidden(self) -> None:
        decision = build_policy().evaluate(context(intent="shell.execute"))
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "INTENT_FORBIDDEN")

    def test_observer_cannot_send_messages(self) -> None:
        decision = build_policy().evaluate(
            context(
                actor_role="observer",
                target_type="service",
                target_id="command-bus",
                intent="message.deliver",
            )
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "ROLE_NOT_AUTHORIZED")

    def test_disabled_provider_is_rejected_without_fallback(self) -> None:
        policy = build_policy(
            providers={
                "disabled": ProviderRule("disabled", "local", False),
                "mock": ProviderRule("mock", "local", True),
            },
            routes={("model", "selected/model"): "disabled"},
        )
        decision = policy.evaluate(context(target_id="selected/model"))
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "PROVIDER_DISABLED")

    def test_no_route_does_not_fallback_to_another_provider(self) -> None:
        decision = build_policy().evaluate(context(target_id="unknown/model"))
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "NO_EXPLICIT_ROUTE")

    def test_restricted_external_provider_is_rejected(self) -> None:
        policy = build_policy(
            providers={"external": ProviderRule("external", "external", True)},
            routes={("model", "external/model"): "external"},
        )
        decision = policy.evaluate(
            context(target_id="external/model", sensitivity="restricted")
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "LOCAL_PROVIDER_REQUIRED")

    def test_github_models_rejects_non_public_payload(self) -> None:
        for provider_id in ("github_models", "github-models"):
            with self.subTest(provider_id=provider_id):
                policy = build_policy(
                    providers={provider_id: ProviderRule(provider_id, "external", True)},
                    routes={("model", "github/model"): provider_id},
                )
                decision = policy.evaluate(
                    context(target_id="github/model", sensitivity="internal")
                )
                self.assertFalse(decision.allowed)
                self.assertEqual(decision.reason_code, "GITHUB_MODELS_SENSITIVE_DENIED")

    def test_truthy_replay_and_audit_values_fail_closed(self) -> None:
        replay = build_policy().evaluate(context(replay_fresh="false"))
        audit = build_policy().evaluate(context(audit_available="false"))
        self.assertFalse(replay.allowed)
        self.assertEqual(replay.reason_code, "REPLAY_DETECTED")
        self.assertFalse(audit.allowed)
        self.assertEqual(audit.reason_code, "AUDIT_REQUIRED")

    def test_truthy_recipient_enabled_value_fails_closed(self) -> None:
        decision = build_policy().evaluate_recipient(
            RecipientPolicyContext(
                recipient_id="actor:local-builder",
                recipient_type="actor",
                locality="local",
                enabled="false",
                sensitivity="restricted",
            )
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "RECIPIENT_DISABLED")

    def test_unknown_recipient_sensitivity_fails_closed(self) -> None:
        decision = build_policy().evaluate_recipient(
            RecipientPolicyContext(
                recipient_id="actor:local-builder",
                recipient_type="actor",
                locality="local",
                enabled=True,
                sensitivity="secret",
            )
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "INVALID_SENSITIVITY")

    def test_recipient_policy_rejects_restricted_external_target(self) -> None:
        decision = build_policy().evaluate_recipient(
            RecipientPolicyContext(
                recipient_id="model:external/model",
                recipient_type="model",
                locality="external",
                enabled=True,
                sensitivity="restricted",
            )
        )
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason_code, "LOCAL_RECIPIENT_REQUIRED")

    def test_missing_policy_configuration_fails_closed(self) -> None:
        with self.assertRaises(ConfigurationError):
            PolicyEngine({}, {}, max_payload_bytes=1, max_ttl_seconds=1)


if __name__ == "__main__":
    unittest.main()
