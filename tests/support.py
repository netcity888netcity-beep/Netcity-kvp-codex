from __future__ import annotations

from datetime import UTC, datetime, timedelta
from threading import Lock
from typing import Any
from uuid import UUID

from kernel.command_bus.audit import AuditSink, InMemoryAuditSink
from kernel.command_bus.bootstrap import CommandBridgeRuntime, build_runtime
from kernel.command_bus.envelope import format_rfc3339
from kernel.command_bus.gateway import ModelGatewayPort


FIXED_NOW = datetime(2026, 7, 27, 12, 0, 0, tzinfo=UTC)


class SequentialUuidFactory:
    def __init__(self, start: int = 1000) -> None:
        self._value = start
        self._lock = Lock()

    def __call__(self) -> str:
        with self._lock:
            value = str(UUID(int=self._value))
            self._value += 1
            return value


def make_envelope(
    *,
    profile: str = "command",
    now: datetime = FIXED_NOW,
    message_id: str = "00000000-0000-0000-0000-000000000001",
    nonce: str = "nonce-000000000001",
    actor_id: str = "local-architect",
    role: str = "architect",
    target_type: str = "model",
    target_id: str = "mock/local-echo",
    intent: str = "model.prompt",
    content: str = "Explain the local bridge",
    sensitivity: str = "internal",
    ttl_seconds: int = 60,
    metadata: dict[str, Any] | None = None,
    conversation_id: str = "00000000-0000-0000-0000-000000000003",
    kind: str | None = None,
    recipients: list[dict[str, str]] | None = None,
    delivery_mode: str = "direct",
) -> dict[str, Any]:
    envelope = {
        "protocol": "kvp",
        "version": "0.1",
        "profile": profile,
        "message_id": message_id,
        "timestamp": format_rfc3339(now),
        "expires_at": format_rfc3339(now + timedelta(seconds=ttl_seconds)),
        "nonce": nonce,
        "actor": {"id": actor_id, "role": role},
        "target": {"type": target_type, "id": target_id},
        "intent": intent,
        "payload": {"content": content, "sensitivity": sensitivity},
        "trace": {
            "trace_id": "00000000-0000-0000-0000-000000000002",
            "parent_id": None,
        },
        "metadata": metadata or {},
    }
    if profile == "native":
        resolved_kind = kind or ("model.request" if target_type == "model" else "command.request")
        resolved_recipients = recipients or [{"type": target_type, "id": target_id}]
        envelope.update(
            {
                "conversation_id": conversation_id,
                "sender": {"id": actor_id, "role": role},
                "recipients": resolved_recipients,
                "kind": resolved_kind,
                "delivery": {"mode": delivery_mode, "status": "accepted"},
                "security": {"classification": sensitivity},
            }
        )
    return envelope


def build_test_runtime(
    *,
    audit_sink: AuditSink | None = None,
    gateway: ModelGatewayPort | None = None,
) -> CommandBridgeRuntime:
    return build_runtime(
        audit_sink=audit_sink or InMemoryAuditSink(),
        gateway=gateway,
        clock=lambda: FIXED_NOW,
        id_factory=SequentialUuidFactory(1000),
        audit_id_factory=SequentialUuidFactory(2000),
    )
