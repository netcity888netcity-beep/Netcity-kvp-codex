from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Mapping

from .audit import AuditJournal, AuditSink, InMemoryAuditSink, JsonlAuditSink
from .conversations import (
    ConversationLimits,
    ConversationStore,
    RecipientDescriptor,
    RecipientDirectory,
)
from .envelope import EnvelopeLimits, Recipient, strict_json_loads
from .errors import CommandBusError, ConfigurationError
from .gateway import MockModelGateway, ModelGatewayPort
from .identity import LocalIdentityRegistry
from .policy import PolicyEngine, ProviderRule
from .replay import InMemoryReplayStore
from .router import CommandRouter
from .service import CommandBridgeService
from .transports.in_memory import InMemoryTransport


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "command_bus.example.json"


@dataclass(frozen=True)
class CommandBridgeRuntime:
    service: CommandBridgeService
    transport: InMemoryTransport
    audit: AuditJournal
    gateway: ModelGatewayPort
    conversations: ConversationStore


def build_runtime(
    config_path: Path | None = None,
    *,
    audit_sink: AuditSink | None = None,
    gateway: ModelGatewayPort | None = None,
    clock: Callable[[], datetime] | None = None,
    id_factory: Callable[[], str] | None = None,
    audit_id_factory: Callable[[], str] | None = None,
) -> CommandBridgeRuntime:
    path = (config_path or DEFAULT_CONFIG_PATH).resolve()
    config = _load_config(path)
    _expect_keys(
        config,
        {
            "version", "limits", "replay", "identities", "providers", "routes",
            "communications", "audit", "transport",
        },
        "configuration",
    )
    if config["version"] != 1:
        raise ConfigurationError("Unsupported command bridge configuration version")

    limits_raw = _mapping(config["limits"], "limits")
    _expect_keys(
        limits_raw,
        {
            "max_ttl_seconds", "max_past_age_seconds", "max_future_skew_seconds",
            "min_nonce_length", "max_nonce_length", "max_payload_bytes",
            "max_metadata_bytes", "max_metadata_depth",
            "max_recipients",
        },
        "limits",
    )
    try:
        limits = EnvelopeLimits(**{key: _positive_int(value, key) for key, value in limits_raw.items()})
    except (TypeError, ValueError) as exc:
        raise ConfigurationError("Envelope limits are invalid") from exc

    replay_raw = _mapping(config["replay"], "replay")
    _expect_keys(replay_raw, {"max_entries"}, "replay")
    replay_store = InMemoryReplayStore(_positive_int(replay_raw["max_entries"], "max_entries"))
    identities = LocalIdentityRegistry.from_config(config["identities"])
    providers = _providers(config["providers"])
    routes = _routes(config["routes"])
    policy = PolicyEngine(
        providers,
        routes,
        max_payload_bytes=limits.max_payload_bytes,
        max_ttl_seconds=limits.max_ttl_seconds,
    )
    communication_limits, rooms = _communications(config["communications"])
    if communication_limits.max_recipients != limits.max_recipients:
        raise ConfigurationError("Recipient limits must match across configuration sections")
    directory = _recipient_directory(identities, providers, routes)
    conversations = ConversationStore(directory, rooms, communication_limits)

    sink = audit_sink or _audit_sink(config["audit"], path.parent.parent)
    journal = AuditJournal(sink, clock=clock, id_factory=audit_id_factory)
    model_gateway = gateway or MockModelGateway()
    router = CommandRouter(model_gateway, audit_reader=journal.events)
    service = CommandBridgeService(
        limits=limits,
        identities=identities,
        policy=policy,
        replay_store=replay_store,
        router=router,
        audit=journal,
        conversations=conversations,
        clock=clock,
        id_factory=id_factory,
    )
    return CommandBridgeRuntime(
        service=service,
        transport=_transport(config["transport"]),
        audit=journal,
        gateway=model_gateway,
        conversations=conversations,
    )


def _load_config(path: Path) -> Mapping[str, Any]:
    try:
        loaded = strict_json_loads(path.read_text(encoding="utf-8"))
    except (OSError, CommandBusError) as exc:
        raise ConfigurationError("Command bridge configuration is unavailable or invalid") from exc
    return _mapping(loaded, "configuration")


def _providers(raw: Any) -> dict[str, ProviderRule]:
    values = _mapping(raw, "providers")
    if not values:
        raise ConfigurationError("At least one provider is required")
    providers: dict[str, ProviderRule] = {}
    for provider_id, item in values.items():
        if not isinstance(provider_id, str) or not provider_id:
            raise ConfigurationError("Provider IDs must be non-empty strings")
        provider = _mapping(item, "provider")
        _expect_keys(provider, {"locality", "enabled"}, "provider")
        locality = provider["locality"]
        enabled = provider["enabled"]
        if locality not in {"local", "external"} or not isinstance(enabled, bool):
            raise ConfigurationError("Provider configuration is invalid")
        providers[provider_id] = ProviderRule(provider_id, locality, enabled)
    return providers


def _routes(raw: Any) -> dict[tuple[str, str], str]:
    if not isinstance(raw, list) or not raw:
        raise ConfigurationError("Explicit routes are required")
    routes: dict[tuple[str, str], str] = {}
    for item in raw:
        route = _mapping(item, "route")
        _expect_keys(route, {"target_type", "target_id", "provider"}, "route")
        key = (route["target_type"], route["target_id"])
        if not all(isinstance(value, str) and value for value in (*key, route["provider"])):
            raise ConfigurationError("Route values must be non-empty strings")
        if key in routes:
            raise ConfigurationError("Duplicate route is not allowed")
        routes[key] = route["provider"]
    return routes


def _audit_sink(raw: Any, root: Path) -> AuditSink:
    config = _mapping(raw, "audit")
    sink_type = config.get("type")
    common_keys = {"type", "max_entries", "max_event_bytes"}
    max_entries = _positive_int(config.get("max_entries"), "audit.max_entries")
    max_event_bytes = _positive_int(config.get("max_event_bytes"), "audit.max_event_bytes")
    if sink_type == "memory":
        _expect_keys(config, common_keys, "audit")
        return InMemoryAuditSink(
            max_entries=max_entries,
            max_event_bytes=max_event_bytes,
        )
    if sink_type == "jsonl":
        _expect_keys(config, common_keys | {"path"}, "audit")
        relative = config["path"]
        if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
            raise ConfigurationError("Audit path must be a relative path")
        resolved_root = root.resolve()
        audit_path = (resolved_root / relative).resolve()
        if not audit_path.is_relative_to(resolved_root):
            raise ConfigurationError("Audit path must stay inside the repository root")
        return JsonlAuditSink(
            audit_path,
            max_entries=max_entries,
            max_event_bytes=max_event_bytes,
        )
    raise ConfigurationError("Audit sink type is not supported")


def _transport(raw: Any) -> InMemoryTransport:
    config = _mapping(raw, "transport")
    _expect_keys(
        config,
        {
            "max_pending_requests",
            "max_pending_responses",
            "max_request_bytes",
            "max_response_bytes",
        },
        "transport",
    )
    return InMemoryTransport(
        **{key: _positive_int(value, f"transport.{key}") for key, value in config.items()}
    )


def _communications(raw: Any) -> tuple[ConversationLimits, dict[str, tuple[Recipient, ...]]]:
    config = _mapping(raw, "communications")
    _expect_keys(config, {"limits", "rooms"}, "communications")
    limits_raw = _mapping(config["limits"], "communications limits")
    _expect_keys(
        limits_raw,
        {
            "max_conversations", "max_messages_per_conversation", "max_rooms",
            "max_room_members", "max_recipients",
        },
        "communications limits",
    )
    try:
        limits = ConversationLimits(
            **{key: _positive_int(value, key) for key, value in limits_raw.items()}
        )
    except (TypeError, ValueError) as exc:
        raise ConfigurationError("Communications limits are invalid") from exc
    rooms_raw = _mapping(config["rooms"], "rooms")
    rooms: dict[str, tuple[Recipient, ...]] = {}
    for room_id, members_raw in rooms_raw.items():
        if not isinstance(room_id, str) or not room_id:
            raise ConfigurationError("Room IDs must be non-empty strings")
        if not isinstance(members_raw, list) or not members_raw:
            raise ConfigurationError("Room members must be a non-empty list")
        members = []
        for member_raw in members_raw:
            member = _mapping(member_raw, "room member")
            _expect_keys(member, {"type", "id"}, "room member")
            if member["type"] not in {"actor", "model", "service"}:
                raise ConfigurationError("Room member type is invalid")
            if not isinstance(member["id"], str) or not member["id"]:
                raise ConfigurationError("Room member ID is invalid")
            members.append(Recipient(type=member["type"], id=member["id"]))
        rooms[room_id] = tuple(members)
    return limits, rooms


def _recipient_directory(
    identities: LocalIdentityRegistry,
    providers: Mapping[str, ProviderRule],
    routes: Mapping[tuple[str, str], str],
) -> RecipientDirectory:
    entries: dict[str, RecipientDescriptor] = {}
    for identity in identities.identities():
        recipient = Recipient(type="actor", id=identity.actor_id)
        entries[recipient.normalized_id] = RecipientDescriptor(
            recipient=recipient,
            locality="local",
            enabled=identity.enabled,
        )
    for (target_type, target_id), provider_id in routes.items():
        if target_type not in {"model", "service"}:
            continue
        provider = providers[provider_id]
        recipient = Recipient(type=target_type, id=target_id)
        entries[recipient.normalized_id] = RecipientDescriptor(
            recipient=recipient,
            locality=provider.locality,
            enabled=provider.enabled,
        )
    return RecipientDirectory(entries)


def _mapping(value: Any, name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping) or not all(isinstance(key, str) for key in value):
        raise ConfigurationError(f"{name} must be an object")
    return value


def _expect_keys(value: Mapping[str, Any], expected: set[str], name: str) -> None:
    if set(value) != expected:
        raise ConfigurationError(f"{name} fields are invalid")


def _positive_int(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ConfigurationError(f"{name} must be a positive integer")
    return value
