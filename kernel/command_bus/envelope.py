from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Mapping
from uuid import UUID

from .errors import EnvelopeValidationError


PROTOCOL = "kvp"
VERSION = "0.1"
PROFILE_VALUES = frozenset({"command", "native"})
ROLE_VALUES = frozenset({"architect", "builder", "reviewer", "security", "observer"})
TARGET_TYPE_VALUES = frozenset({"model", "agent", "service"})
SENSITIVITY_VALUES = frozenset({"public", "internal", "confidential", "restricted"})
RECIPIENT_TYPE_VALUES = frozenset({"actor", "room", "model", "service"})
MESSAGE_KIND_VALUES = frozenset(
    {
        "message.text",
        "command.request",
        "command.response",
        "task.created",
        "task.progress",
        "task.completed",
        "model.request",
        "model.response",
        "health.check",
    }
)
DELIVERY_MODE_VALUES = frozenset({"direct", "broadcast"})
DELIVERY_STATUS_VALUES = frozenset({"accepted", "delivered", "rejected", "failed"})
NATIVE_FIELD_NAMES = frozenset(
    {"conversation_id", "sender", "recipients", "kind", "delivery", "security"}
)
ZERO_UUID = "00000000-0000-0000-0000-000000000000"

_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")
_INTENT_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$")
_SECRET_FIELD_NAMES = frozenset(
    {
        "token", "password", "api_key", "apikey", "authorization", "secret",
        "credential", "credentials", "access_key", "secret_key", "private_key",
        "client_secret",
    }
)


@dataclass(frozen=True)
class EnvelopeLimits:
    max_ttl_seconds: int = 300
    max_past_age_seconds: int = 300
    max_future_skew_seconds: int = 30
    min_nonce_length: int = 16
    max_nonce_length: int = 128
    max_payload_bytes: int = 16_384
    max_metadata_bytes: int = 4_096
    max_metadata_depth: int = 4
    max_recipients: int = 32

    def __post_init__(self) -> None:
        values = (
            self.max_ttl_seconds,
            self.max_past_age_seconds,
            self.max_future_skew_seconds,
            self.min_nonce_length,
            self.max_nonce_length,
            self.max_payload_bytes,
            self.max_metadata_bytes,
            self.max_metadata_depth,
            self.max_recipients,
        )
        if any(not isinstance(value, int) or isinstance(value, bool) or value <= 0 for value in values):
            raise ValueError("Envelope limits must be positive")
        if self.min_nonce_length > self.max_nonce_length:
            raise ValueError("Minimum nonce length exceeds maximum nonce length")


@dataclass(frozen=True)
class Actor:
    id: str
    role: str


@dataclass(frozen=True)
class Target:
    type: str
    id: str


@dataclass(frozen=True)
class Payload:
    content: str
    sensitivity: str


@dataclass(frozen=True)
class Trace:
    trace_id: str
    parent_id: str | None


@dataclass(frozen=True)
class Recipient:
    type: str
    id: str

    @property
    def normalized_id(self) -> str:
        return f"{self.type}:{self.id}"


@dataclass(frozen=True)
class Delivery:
    mode: str
    status: str


@dataclass(frozen=True)
class Security:
    classification: str


@dataclass(frozen=True)
class CommandEnvelope:
    protocol: str
    version: str
    profile: str
    message_id: str
    timestamp: datetime
    expires_at: datetime
    nonce: str
    actor: Actor
    target: Target
    intent: str
    payload: Payload
    trace: Trace
    metadata: dict[str, Any]
    conversation_id: str | None = None
    sender: Actor | None = None
    recipients: tuple[Recipient, ...] = ()
    kind: str | None = None
    delivery: Delivery | None = None
    security: Security | None = None

    @property
    def ttl_seconds(self) -> float:
        return (self.expires_at - self.timestamp).total_seconds()

    @property
    def payload_size_bytes(self) -> int:
        return len(_canonical_json(self.payload_mapping()).encode("utf-8"))

    def payload_mapping(self) -> dict[str, str]:
        return {"content": self.payload.content, "sensitivity": self.payload.sensitivity}

    def to_dict(self) -> dict[str, Any]:
        value = {
            "protocol": self.protocol,
            "version": self.version,
            "profile": self.profile,
            "message_id": self.message_id,
            "timestamp": format_rfc3339(self.timestamp),
            "expires_at": format_rfc3339(self.expires_at),
            "nonce": self.nonce,
            "actor": {"id": self.actor.id, "role": self.actor.role},
            "target": {"type": self.target.type, "id": self.target.id},
            "intent": self.intent,
            "payload": self.payload_mapping(),
            "trace": {"trace_id": self.trace.trace_id, "parent_id": self.trace.parent_id},
            "metadata": self.metadata,
        }
        if self.profile == "native":
            value.update(
                {
                    "conversation_id": self.conversation_id,
                    "sender": {"id": self.sender.id, "role": self.sender.role},
                    "recipients": [
                        {"type": recipient.type, "id": recipient.id}
                        for recipient in self.recipients
                    ],
                    "kind": self.kind,
                    "delivery": {
                        "mode": self.delivery.mode,
                        "status": self.delivery.status,
                    },
                    "security": {"classification": self.security.classification},
                }
            )
        return value


@dataclass(frozen=True)
class CommandResponse:
    protocol: str
    version: str
    profile: str
    message_id: str
    correlation_id: str
    timestamp: datetime
    status: str
    result: dict[str, Any]
    error: dict[str, str] | None
    trace: Trace
    native: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        value = {
            "protocol": self.protocol,
            "version": self.version,
            "profile": self.profile,
            "message_id": self.message_id,
            "correlation_id": self.correlation_id,
            "timestamp": format_rfc3339(self.timestamp),
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "trace": {"trace_id": self.trace.trace_id, "parent_id": self.trace.parent_id},
        }
        if self.native is not None:
            value.update(self.native)
        return value


def strict_json_loads(document: str) -> Any:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise EnvelopeValidationError("DUPLICATE_FIELD", "Duplicate JSON fields are not allowed")
            result[key] = value
        return result

    try:
        return json.loads(document, object_pairs_hook=reject_duplicates)
    except EnvelopeValidationError:
        raise
    except (json.JSONDecodeError, TypeError) as exc:
        raise EnvelopeValidationError("INVALID_JSON", "Command must be valid JSON") from exc


def parse_command_envelope(raw: Mapping[str, Any], limits: EnvelopeLimits) -> CommandEnvelope:
    if not isinstance(raw, Mapping):
        raise EnvelopeValidationError("INVALID_ENVELOPE", "Command envelope must be an object")
    if not all(isinstance(key, str) for key in raw):
        raise EnvelopeValidationError("INVALID_FIELD_TYPE", "Envelope field names must be strings")
    _reject_secret_fields(raw, "envelope")
    if "profile" not in raw:
        raise EnvelopeValidationError("PROFILE_REQUIRED", "Envelope profile must be explicit")
    profile = _require_string(raw["profile"], "profile")
    if profile not in PROFILE_VALUES:
        raise EnvelopeValidationError("UNSUPPORTED_PROFILE", "Envelope profile is not supported")
    native_present = NATIVE_FIELD_NAMES.intersection(raw)
    if native_present and native_present != NATIVE_FIELD_NAMES:
        raise EnvelopeValidationError(
            "PARTIAL_NATIVE_ENVELOPE",
            "Native envelope fields must be provided together",
        )
    if profile == "native" and native_present != NATIVE_FIELD_NAMES:
        raise EnvelopeValidationError(
            "PARTIAL_NATIVE_ENVELOPE",
            "Native profile requires the complete native field group",
        )
    if profile == "command" and native_present:
        raise EnvelopeValidationError(
            "NATIVE_FIELDS_NOT_ALLOWED",
            "Command profile cannot contain native fields",
        )
    base_fields = {
        "protocol", "version", "profile", "message_id", "timestamp", "expires_at",
        "nonce", "actor", "target", "intent", "payload", "trace", "metadata",
    }
    _require_exact_fields(raw, base_fields | native_present, "envelope")
    protocol = _require_string(raw["protocol"], "protocol")
    if protocol != PROTOCOL:
        raise EnvelopeValidationError("UNSUPPORTED_PROTOCOL", "Unsupported command protocol")
    version = _require_string(raw["version"], "version")
    if version != VERSION:
        raise EnvelopeValidationError("UNSUPPORTED_VERSION", "Unsupported command protocol version")
    message_id = _parse_uuid(raw["message_id"], "message_id")
    timestamp = _parse_utc_timestamp(raw["timestamp"], "timestamp")
    expires_at = _parse_utc_timestamp(raw["expires_at"], "expires_at")
    if expires_at <= timestamp:
        raise EnvelopeValidationError("INVALID_EXPIRY", "expires_at must be later than timestamp")
    nonce = _require_string(raw["nonce"], "nonce")
    if not limits.min_nonce_length <= len(nonce) <= limits.max_nonce_length:
        raise EnvelopeValidationError("INVALID_NONCE", "Nonce length is outside configured limits")

    actor_raw = _require_mapping(raw["actor"], "actor")
    _require_exact_fields(actor_raw, {"id", "role"}, "actor")
    actor_id = _validate_identifier(actor_raw["id"], "actor.id")
    actor_role = _require_string(actor_raw["role"], "actor.role")
    if actor_role not in ROLE_VALUES:
        raise EnvelopeValidationError("UNKNOWN_ROLE", "Actor role is not supported")

    target_raw = _require_mapping(raw["target"], "target")
    _require_exact_fields(target_raw, {"type", "id"}, "target")
    target_type = _require_string(target_raw["type"], "target.type")
    if target_type not in TARGET_TYPE_VALUES:
        raise EnvelopeValidationError("INVALID_TARGET", "Target type is not supported")
    target_id = _validate_identifier(target_raw["id"], "target.id")

    intent = _require_string(raw["intent"], "intent")
    if not _INTENT_PATTERN.fullmatch(intent):
        raise EnvelopeValidationError("INVALID_INTENT", "Intent format is invalid")

    payload_raw = _require_mapping(raw["payload"], "payload")
    _require_exact_fields(payload_raw, {"content", "sensitivity"}, "payload")
    _reject_binary(payload_raw, "payload")
    content = _require_string(payload_raw["content"], "payload.content")
    sensitivity = _require_string(payload_raw["sensitivity"], "payload.sensitivity")
    if sensitivity not in SENSITIVITY_VALUES:
        raise EnvelopeValidationError("INVALID_SENSITIVITY", "Payload sensitivity is unsupported")
    if len(_canonical_json(dict(payload_raw)).encode("utf-8")) > limits.max_payload_bytes:
        raise EnvelopeValidationError("PAYLOAD_TOO_LARGE", "Payload exceeds configured size limit")

    trace_raw = _require_mapping(raw["trace"], "trace")
    _require_exact_fields(trace_raw, {"trace_id", "parent_id"}, "trace")
    trace_id = _parse_uuid(trace_raw["trace_id"], "trace.trace_id")
    parent_value = trace_raw["parent_id"]
    parent_id = None if parent_value is None else _parse_uuid(parent_value, "trace.parent_id")

    metadata_raw = _require_mapping(raw["metadata"], "metadata")
    _reject_binary(metadata_raw, "metadata")
    _validate_json_value(metadata_raw, "metadata", 0, limits.max_metadata_depth)
    metadata = dict(metadata_raw)
    if len(_canonical_json(metadata).encode("utf-8")) > limits.max_metadata_bytes:
        raise EnvelopeValidationError("METADATA_TOO_LARGE", "Metadata exceeds configured size limit")

    conversation_id = None
    sender = None
    recipients: tuple[Recipient, ...] = ()
    kind = None
    delivery = None
    security = None
    if profile == "native":
        conversation_id, sender, recipients, kind, delivery, security = _parse_native_fields(
            raw,
            limits,
            actor=Actor(id=actor_id, role=actor_role),
            intent=intent,
            sensitivity=sensitivity,
        )

    return CommandEnvelope(
        protocol=protocol, version=version, profile=profile, message_id=message_id,
        timestamp=timestamp, expires_at=expires_at, nonce=nonce,
        actor=Actor(id=actor_id, role=actor_role),
        target=Target(type=target_type, id=target_id), intent=intent,
        payload=Payload(content=content, sensitivity=sensitivity),
        trace=Trace(trace_id=trace_id, parent_id=parent_id), metadata=metadata,
        conversation_id=conversation_id, sender=sender, recipients=recipients,
        kind=kind, delivery=delivery, security=security,
    )


def _parse_native_fields(
    raw: Mapping[str, Any],
    limits: EnvelopeLimits,
    *,
    actor: Actor,
    intent: str,
    sensitivity: str,
) -> tuple[str, Actor, tuple[Recipient, ...], str, Delivery, Security]:
    conversation_id = _parse_uuid(raw["conversation_id"], "conversation_id")
    sender_raw = _require_mapping(raw["sender"], "sender")
    _require_exact_fields(sender_raw, {"id", "role"}, "sender")
    sender = Actor(
        id=_validate_identifier(sender_raw["id"], "sender.id"),
        role=_require_string(sender_raw["role"], "sender.role"),
    )
    if sender.role not in ROLE_VALUES:
        raise EnvelopeValidationError("UNKNOWN_ROLE", "Sender role is not supported")
    if sender != actor:
        raise EnvelopeValidationError(
            "SENDER_ACTOR_MISMATCH",
            "Native sender must match the authenticated actor",
        )

    recipients_raw = raw["recipients"]
    if not isinstance(recipients_raw, list) or not recipients_raw:
        raise EnvelopeValidationError("INVALID_RECIPIENTS", "Recipients must be a non-empty list")
    if len(recipients_raw) > limits.max_recipients:
        raise EnvelopeValidationError("TOO_MANY_RECIPIENTS", "Recipient limit is exceeded")
    recipients_list: list[Recipient] = []
    normalized_ids: set[str] = set()
    for index, value in enumerate(recipients_raw):
        recipient_raw = _require_mapping(value, f"recipients[{index}]")
        _require_exact_fields(recipient_raw, {"type", "id"}, f"recipients[{index}]")
        recipient_type = _require_string(recipient_raw["type"], f"recipients[{index}].type")
        if recipient_type not in RECIPIENT_TYPE_VALUES:
            raise EnvelopeValidationError("INVALID_RECIPIENT", "Recipient type is not supported")
        recipient = Recipient(
            type=recipient_type,
            id=_validate_identifier(recipient_raw["id"], f"recipients[{index}].id"),
        )
        if recipient.normalized_id in normalized_ids:
            raise EnvelopeValidationError("DUPLICATE_RECIPIENT", "Duplicate recipients are forbidden")
        normalized_ids.add(recipient.normalized_id)
        recipients_list.append(recipient)

    kind = _require_string(raw["kind"], "kind")
    if kind not in MESSAGE_KIND_VALUES:
        raise EnvelopeValidationError("UNKNOWN_MESSAGE_KIND", "Native message kind is unsupported")
    _validate_kind_intent(kind, intent)

    delivery_raw = _require_mapping(raw["delivery"], "delivery")
    _require_exact_fields(delivery_raw, {"mode", "status"}, "delivery")
    delivery = Delivery(
        mode=_require_string(delivery_raw["mode"], "delivery.mode"),
        status=_require_string(delivery_raw["status"], "delivery.status"),
    )
    if delivery.mode not in DELIVERY_MODE_VALUES:
        raise EnvelopeValidationError("INVALID_DELIVERY_MODE", "Delivery mode is unsupported")
    if delivery.status not in DELIVERY_STATUS_VALUES:
        raise EnvelopeValidationError("INVALID_DELIVERY_STATUS", "Delivery status is unsupported")
    if delivery.status != "accepted":
        raise EnvelopeValidationError(
            "INVALID_DELIVERY_TRANSITION",
            "Inbound native messages must start in accepted state",
        )

    security_raw = _require_mapping(raw["security"], "security")
    _require_exact_fields(security_raw, {"classification"}, "security")
    classification = _require_string(security_raw["classification"], "security.classification")
    if classification not in SENSITIVITY_VALUES:
        raise EnvelopeValidationError("INVALID_SENSITIVITY", "Security classification is unsupported")
    if classification != sensitivity:
        raise EnvelopeValidationError(
            "CLASSIFICATION_MISMATCH",
            "Security classification must match payload sensitivity",
        )
    return (
        conversation_id,
        sender,
        tuple(recipients_list),
        kind,
        delivery,
        Security(classification=classification),
    )


def _validate_kind_intent(kind: str, intent: str) -> None:
    exact = {
        "message.text": "message.deliver",
        "command.response": "command.respond",
        "task.created": "task.create",
        "task.progress": "task.progress",
        "task.completed": "task.complete",
        "model.response": "model.respond",
        "health.check": "health.check",
    }
    expected = exact.get(kind)
    if expected is not None and intent != expected:
        raise EnvelopeValidationError("KIND_INTENT_MISMATCH", "Message kind and intent do not match")
    if kind == "model.request" and intent not in {"model.prompt", "model.compare"}:
        raise EnvelopeValidationError("KIND_INTENT_MISMATCH", "Model request intent is invalid")


def validate_temporal_window(
    envelope: CommandEnvelope,
    limits: EnvelopeLimits,
    now: datetime,
) -> None:
    normalized_now = _require_aware_utc(now)
    ttl = envelope.expires_at - envelope.timestamp
    if ttl > timedelta(seconds=limits.max_ttl_seconds):
        raise EnvelopeValidationError("TTL_EXCEEDED", "Command TTL exceeds configured maximum")
    if envelope.timestamp > normalized_now + timedelta(seconds=limits.max_future_skew_seconds):
        raise EnvelopeValidationError("TIMESTAMP_IN_FUTURE", "Command timestamp is too far in future")
    if envelope.timestamp < normalized_now - timedelta(seconds=limits.max_past_age_seconds):
        raise EnvelopeValidationError("TIMESTAMP_TOO_OLD", "Command timestamp is too old")
    if envelope.expires_at <= normalized_now:
        raise EnvelopeValidationError("COMMAND_EXPIRED", "Command has expired")


def payload_hash(envelope: CommandEnvelope) -> str:
    encoded = _canonical_json(envelope.payload_mapping()).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def format_rfc3339(value: datetime) -> str:
    normalized = _require_aware_utc(value)
    timespec = "microseconds" if normalized.microsecond else "seconds"
    return normalized.isoformat(timespec=timespec).replace("+00:00", "Z")


def safe_uuid(value: Any) -> str:
    try:
        return _parse_uuid(value, "identifier")
    except EnvelopeValidationError:
        return ZERO_UUID


def canonical_json(value: Any) -> str:
    return _canonical_json(value)


def _canonical_json(value: Any) -> str:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise EnvelopeValidationError("INVALID_JSON_VALUE", "Value is not valid JSON data") from exc


def _require_exact_fields(value: Mapping[str, Any], expected: set[str], path: str) -> None:
    actual = set(value)
    if expected - actual:
        raise EnvelopeValidationError("MISSING_FIELD", f"Required fields are missing from {path}")
    if actual - expected:
        raise EnvelopeValidationError("UNKNOWN_FIELD", f"Unknown fields are present in {path}")


def _require_mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise EnvelopeValidationError("INVALID_FIELD_TYPE", f"{path} must be an object")
    if not all(isinstance(key, str) for key in value):
        raise EnvelopeValidationError("INVALID_FIELD_TYPE", f"{path} keys must be strings")
    return value


def _require_string(value: Any, path: str) -> str:
    if not isinstance(value, str):
        raise EnvelopeValidationError("INVALID_FIELD_TYPE", f"{path} must be a string")
    if not value.strip():
        raise EnvelopeValidationError("INVALID_FIELD_VALUE", f"{path} must not be empty")
    return value


def _parse_uuid(value: Any, path: str) -> str:
    text = _require_string(value, path)
    try:
        parsed = UUID(text)
    except ValueError as exc:
        raise EnvelopeValidationError("INVALID_UUID", f"{path} must be a UUID") from exc
    canonical = str(parsed)
    if text != canonical:
        raise EnvelopeValidationError("INVALID_UUID", f"{path} must use canonical UUID format")
    return canonical


def _parse_utc_timestamp(value: Any, path: str) -> datetime:
    text = _require_string(value, path)
    if "T" not in text:
        raise EnvelopeValidationError("INVALID_TIMESTAMP", f"{path} must be RFC3339")
    candidate = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise EnvelopeValidationError("INVALID_TIMESTAMP", f"{path} must be RFC3339") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise EnvelopeValidationError("TIMESTAMP_NOT_UTC", f"{path} must be UTC")
    return parsed.astimezone(UTC)


def _require_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Clock must return a timezone-aware datetime")
    return value.astimezone(UTC)


def _validate_identifier(value: Any, path: str) -> str:
    text = _require_string(value, path)
    if not _IDENTIFIER_PATTERN.fullmatch(text):
        raise EnvelopeValidationError("INVALID_IDENTIFIER", f"{path} is invalid")
    return text


def _is_secret_field(key: str) -> bool:
    normalized = key.strip().lower().replace("-", "_")
    return (
        normalized in _SECRET_FIELD_NAMES
        or normalized.endswith("_token")
        or normalized.endswith("_password")
        or normalized.endswith("_api_key")
        or normalized.endswith("_authorization")
        or normalized.endswith("_secret")
        or normalized.endswith("_credential")
        or normalized.endswith("_credentials")
        or normalized.endswith("_access_key")
        or normalized.endswith("_private_key")
    )


def _reject_secret_fields(value: Any, path: str) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if isinstance(key, str) and _is_secret_field(key):
                raise EnvelopeValidationError(
                    "SECRET_FIELD_FORBIDDEN", f"Secret-like field is forbidden in {path}"
                )
            _reject_secret_fields(nested, f"{path}.field")
    elif isinstance(value, (list, tuple)):
        for index, nested in enumerate(value):
            _reject_secret_fields(nested, f"{path}[{index}]")


def _reject_binary(value: Any, path: str) -> None:
    if isinstance(value, (bytes, bytearray, memoryview)):
        raise EnvelopeValidationError("BINARY_PAYLOAD_FORBIDDEN", f"Binary data is forbidden in {path}")
    if isinstance(value, Mapping):
        for key, nested in value.items():
            _reject_binary(nested, f"{path}.field")
    elif isinstance(value, (list, tuple)):
        for index, nested in enumerate(value):
            _reject_binary(nested, f"{path}[{index}]")


def _validate_json_value(value: Any, path: str, depth: int, max_depth: int) -> None:
    if depth > max_depth:
        raise EnvelopeValidationError("METADATA_TOO_DEEP", "Metadata exceeds depth limit")
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise EnvelopeValidationError("INVALID_JSON_VALUE", f"{path} has a non-finite number")
        return
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if not isinstance(key, str):
                raise EnvelopeValidationError("INVALID_FIELD_TYPE", f"{path} keys must be strings")
            _validate_json_value(nested, f"{path}.field", depth + 1, max_depth)
        return
    if isinstance(value, list):
        for index, nested in enumerate(value):
            _validate_json_value(nested, f"{path}[{index}]", depth + 1, max_depth)
        return
    raise EnvelopeValidationError("INVALID_JSON_VALUE", f"{path} contains unsupported data")
