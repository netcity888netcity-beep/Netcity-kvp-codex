from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Mapping

from .envelope import CommandEnvelope, Recipient
from .errors import CommunicationsError


@dataclass(frozen=True)
class RecipientDescriptor:
    recipient: Recipient
    locality: str
    enabled: bool

    def __post_init__(self) -> None:
        if self.locality not in {"local", "external"}:
            raise ValueError("Recipient locality must be local or external")
        if not isinstance(self.enabled, bool):
            raise ValueError("Recipient enabled must be boolean")

    @property
    def normalized_id(self) -> str:
        return self.recipient.normalized_id


class RecipientDirectory:
    def __init__(self, entries: Mapping[str, RecipientDescriptor]) -> None:
        self._entries = dict(entries)

    def resolve(self, recipient: Recipient) -> RecipientDescriptor:
        descriptor = self._entries.get(recipient.normalized_id)
        if descriptor is None:
            raise CommunicationsError("UNKNOWN_RECIPIENT", "Recipient is not configured")
        if descriptor.enabled is not True:
            raise CommunicationsError("RECIPIENT_DISABLED", "Recipient is disabled")
        return descriptor


@dataclass(frozen=True)
class ConversationLimits:
    max_conversations: int
    max_messages_per_conversation: int
    max_rooms: int
    max_room_members: int
    max_recipients: int

    def __post_init__(self) -> None:
        if any(
            not isinstance(value, int) or isinstance(value, bool) or value <= 0
            for value in (
                self.max_conversations,
                self.max_messages_per_conversation,
                self.max_rooms,
                self.max_room_members,
                self.max_recipients,
            )
        ):
            raise ValueError("Conversation limits must be positive")


@dataclass(frozen=True)
class DeliveryPlan:
    conversation_id: str
    sender_id: str
    kind: str
    classification: str
    mode: str
    recipients: tuple[RecipientDescriptor, ...]


@dataclass(frozen=True)
class ConversationRecord:
    message_id: str
    kind: str
    sender_id: str
    recipient_ids: tuple[str, ...]
    delivery_status: str
    payload_hash: str


class DeliveryStateMachine:
    _TRANSITIONS = {
        None: frozenset({"accepted", "rejected"}),
        "accepted": frozenset({"delivered", "failed"}),
        "delivered": frozenset(),
        "rejected": frozenset(),
        "failed": frozenset(),
    }

    @classmethod
    def transition(cls, current: str | None, target: str) -> str:
        if target not in cls._TRANSITIONS.get(current, frozenset()):
            raise CommunicationsError(
                "INVALID_DELIVERY_TRANSITION",
                "Delivery state transition is not allowed",
            )
        return target


class ConversationStore:
    def __init__(
        self,
        directory: RecipientDirectory,
        rooms: Mapping[str, tuple[Recipient, ...]],
        limits: ConversationLimits,
    ) -> None:
        self._directory = directory
        self._limits = limits
        self._rooms: dict[str, tuple[RecipientDescriptor, ...]] = {}
        self._history: dict[str, list[ConversationRecord]] = {}
        self._pending: dict[str, int] = {}
        self._lock = RLock()
        self._load_rooms(rooms)

    def prepare(self, envelope: CommandEnvelope) -> DeliveryPlan:
        if envelope.profile != "native" or envelope.conversation_id is None:
            raise CommunicationsError("NATIVE_PROFILE_REQUIRED", "Native delivery requires native profile")
        if envelope.sender is None or envelope.kind is None or envelope.delivery is None:
            raise CommunicationsError("PARTIAL_NATIVE_ENVELOPE", "Native delivery fields are incomplete")
        if envelope.security is None:
            raise CommunicationsError("PARTIAL_NATIVE_ENVELOPE", "Native security fields are incomplete")
        if envelope.delivery.mode == "direct" and len(envelope.recipients) != 1:
            raise CommunicationsError(
                "DIRECT_RECIPIENT_COUNT",
                "Direct delivery requires exactly one recipient",
            )
        if envelope.delivery.mode == "broadcast":
            descriptors = self._broadcast_snapshot(envelope)
        else:
            if any(recipient.type == "room" for recipient in envelope.recipients):
                raise CommunicationsError("ROOM_REQUIRES_BROADCAST", "Room recipient requires broadcast mode")
            descriptors = tuple(self._directory.resolve(recipient) for recipient in envelope.recipients)
        if not descriptors:
            raise CommunicationsError("NO_DELIVERY_RECIPIENTS", "Delivery has no recipients")
        if len(descriptors) > self._limits.max_recipients:
            raise CommunicationsError("TOO_MANY_RECIPIENTS", "Resolved recipient limit is exceeded")
        normalized = [descriptor.normalized_id for descriptor in descriptors]
        if len(normalized) != len(set(normalized)):
            raise CommunicationsError("DUPLICATE_RECIPIENT", "Duplicate recipients are forbidden")
        return DeliveryPlan(
            conversation_id=envelope.conversation_id,
            sender_id=envelope.sender.id,
            kind=envelope.kind,
            classification=envelope.security.classification,
            mode=envelope.delivery.mode,
            recipients=descriptors,
        )

    def reserve_delivery(self, plan: DeliveryPlan) -> None:
        with self._lock:
            if plan.conversation_id not in self._history:
                if len(self._history) >= self._limits.max_conversations:
                    raise CommunicationsError(
                        "CONVERSATION_LIMIT_REACHED",
                        "Conversation capacity is exhausted",
                    )
                self._history[plan.conversation_id] = []
                self._pending[plan.conversation_id] = 0
            committed = len(self._history[plan.conversation_id])
            pending = self._pending[plan.conversation_id]
            if committed + pending >= self._limits.max_messages_per_conversation:
                raise CommunicationsError(
                    "CONVERSATION_MESSAGE_LIMIT",
                    "Conversation message capacity is exhausted",
                )
            self._pending[plan.conversation_id] += 1

    def record_delivery(
        self,
        plan: DeliveryPlan,
        *,
        message_id: str,
        status: str,
        payload_hash: str,
    ) -> ConversationRecord:
        DeliveryStateMachine.transition("accepted", status)
        record = ConversationRecord(
            message_id=message_id,
            kind=plan.kind,
            sender_id=plan.sender_id,
            recipient_ids=tuple(descriptor.normalized_id for descriptor in plan.recipients),
            delivery_status=status,
            payload_hash=payload_hash,
        )
        with self._lock:
            if self._pending.get(plan.conversation_id, 0) <= 0:
                raise CommunicationsError("DELIVERY_NOT_RESERVED", "Delivery reservation is missing")
            self._pending[plan.conversation_id] -= 1
            self._history[plan.conversation_id].append(record)
        return record

    def cancel_reservation(self, plan: DeliveryPlan) -> None:
        with self._lock:
            pending = self._pending.get(plan.conversation_id, 0)
            if pending > 0:
                self._pending[plan.conversation_id] = pending - 1

    def history(self, conversation_id: str) -> tuple[ConversationRecord, ...]:
        with self._lock:
            return tuple(self._history.get(conversation_id, ()))

    def room_members(self, room_id: str) -> tuple[str, ...]:
        with self._lock:
            members = self._rooms.get(room_id)
            if members is None:
                raise CommunicationsError("UNKNOWN_ROOM", "Room is not configured")
            return tuple(member.normalized_id for member in members)

    def _broadcast_snapshot(self, envelope: CommandEnvelope) -> tuple[RecipientDescriptor, ...]:
        if len(envelope.recipients) != 1 or envelope.recipients[0].type != "room":
            raise CommunicationsError(
                "AMBIGUOUS_BROADCAST",
                "Broadcast must target exactly one room",
            )
        room_id = envelope.recipients[0].id
        sender_id = f"actor:{envelope.sender.id}"
        with self._lock:
            members = self._rooms.get(room_id)
            if members is None:
                raise CommunicationsError("UNKNOWN_ROOM", "Room is not configured")
            snapshot = tuple(members)
        member_ids = {member.normalized_id for member in snapshot}
        if sender_id not in member_ids:
            raise CommunicationsError("ROOM_MEMBERSHIP_REQUIRED", "Sender is not a room member")
        return tuple(member for member in snapshot if member.normalized_id != sender_id)

    def _load_rooms(self, rooms: Mapping[str, tuple[Recipient, ...]]) -> None:
        if len(rooms) > self._limits.max_rooms:
            raise CommunicationsError("ROOM_LIMIT_REACHED", "Room limit is exceeded")
        for room_id, members in rooms.items():
            if not room_id or not members:
                raise CommunicationsError("INVALID_ROOM", "Room ID and members are required")
            if len(members) > self._limits.max_room_members:
                raise CommunicationsError("ROOM_MEMBER_LIMIT", "Room member limit is exceeded")
            normalized = [member.normalized_id for member in members]
            if len(normalized) != len(set(normalized)):
                raise CommunicationsError("DUPLICATE_ROOM_MEMBER", "Duplicate room members are forbidden")
            descriptors = tuple(self._directory.resolve(member) for member in members)
            if any(descriptor.recipient.type == "room" for descriptor in descriptors):
                raise CommunicationsError("NESTED_ROOM_FORBIDDEN", "Nested rooms are forbidden")
            self._rooms[room_id] = descriptors
