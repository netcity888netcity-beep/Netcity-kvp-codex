from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any, Callable, Mapping
from uuid import uuid4

from .audit import AuditJournal, AuditReservation
from .conversations import ConversationStore, DeliveryPlan, DeliveryStateMachine
from .envelope import (
    PROTOCOL,
    VERSION,
    CommandEnvelope,
    CommandResponse,
    EnvelopeLimits,
    Trace,
    payload_hash as compute_payload_hash,
    parse_command_envelope,
    safe_uuid,
    validate_temporal_window,
)
from .errors import CommandBusError, PolicyDeniedError
from .identity import LocalIdentityRegistry
from .policy import CRITICAL_INTENTS, PolicyContext, PolicyDecision, PolicyEngine
from .policy import RecipientPolicyContext
from .replay import ReplayStore
from .router import CommandRouter
from .transports.base import CommandTransport


class CommandBridgeService:
    def __init__(
        self,
        *,
        limits: EnvelopeLimits,
        identities: LocalIdentityRegistry,
        policy: PolicyEngine,
        replay_store: ReplayStore,
        router: CommandRouter,
        audit: AuditJournal,
        conversations: ConversationStore,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
        timer: Callable[[], float] | None = None,
    ) -> None:
        self._limits = limits
        self._identities = identities
        self._policy = policy
        self._replay_store = replay_store
        self._router = router
        self._audit = audit
        self._conversations = conversations
        self._clock = clock or (lambda: datetime.now(UTC))
        self._id_factory = id_factory or (lambda: str(uuid4()))
        self._timer = timer or time.perf_counter

    def handle(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        started = self._timer()
        envelope: CommandEnvelope | None = None
        decision: PolicyDecision | None = None
        delivery_plan: DeliveryPlan | None = None
        delivery_state: str | None = None
        delivery_reserved = False
        audit_reservations: list[AuditReservation] = []
        try:
            now = self._clock()
            envelope = parse_command_envelope(raw, self._limits)
            validate_temporal_window(envelope, self._limits, now)
            self._replay_store.check_and_store(
                envelope.message_id,
                envelope.nonce,
                envelope.expires_at,
                now,
            )
            self._identities.authenticate(envelope.actor)
            decision = self._evaluate_policy(envelope, replay_fresh=True)
            if not decision.allowed:
                raise PolicyDeniedError(decision.reason_code, decision.reason)
            if envelope.profile == "native":
                delivery_plan = self._conversations.prepare(envelope)
                self._enforce_recipient_policy(envelope, delivery_plan)
            critical_intent = envelope.intent in CRITICAL_INTENTS
            if critical_intent:
                audit_reservations.extend(self._audit.reserve(2))
                self._record_audit(
                    envelope,
                    decision,
                    delivery_plan=delivery_plan,
                    duration_ms=self._duration_ms(started),
                    result_status="authorized",
                    reason_code=decision.reason_code,
                    strict=True,
                    reservations=audit_reservations,
                )
            if delivery_plan is not None:
                self._conversations.reserve_delivery(delivery_plan)
                delivery_reserved = True
                delivery_state = DeliveryStateMachine.transition(None, "accepted")
            result = self._router.route(envelope, decision, delivery_plan)
            duration_ms = self._duration_ms(started)
            self._record_audit(
                envelope,
                decision,
                delivery_plan=delivery_plan,
                duration_ms=duration_ms,
                result_status="completed",
                reason_code=decision.reason_code,
                strict=critical_intent,
                reservations=audit_reservations,
            )
            if delivery_plan is not None:
                delivery_state = DeliveryStateMachine.transition(delivery_state, "delivered")
                self._conversations.record_delivery(
                    delivery_plan,
                    message_id=envelope.message_id,
                    status=delivery_state,
                    payload_hash=compute_payload_hash(envelope),
                )
                delivery_reserved = False
            return self._response(
                raw,
                envelope,
                status="completed",
                result=result,
                error=None,
                delivery_status=delivery_state,
            ).to_dict()
        except CommandBusError as exc:
            duration_ms = self._duration_ms(started)
            delivery_state = self._finalize_failed_delivery(
                envelope,
                delivery_plan,
                delivery_state,
                delivery_reserved,
            )
            if envelope is not None:
                effective = decision or self._denied_decision(exc.code, exc.safe_message)
                self._record_audit(
                    envelope,
                    effective,
                    delivery_plan=delivery_plan,
                    duration_ms=duration_ms,
                    result_status=exc.status,
                    reason_code=exc.code,
                    strict=False,
                    reservations=audit_reservations,
                )
            return self._response(
                raw,
                envelope,
                status=exc.status,
                result=exc.safe_result,
                error={"code": exc.code, "message": exc.safe_message},
                delivery_status=delivery_state,
            ).to_dict()
        except Exception:
            duration_ms = self._duration_ms(started)
            delivery_state = self._finalize_failed_delivery(
                envelope,
                delivery_plan,
                delivery_state,
                delivery_reserved,
            )
            if envelope is not None:
                self._record_audit(
                    envelope,
                    decision or self._denied_decision("INTERNAL_ERROR", "Command failed safely"),
                    delivery_plan=delivery_plan,
                    duration_ms=duration_ms,
                    result_status="failed",
                    reason_code="INTERNAL_ERROR",
                    strict=False,
                    reservations=audit_reservations,
                )
            return self._response(
                raw,
                envelope,
                status="failed",
                result={},
                error={"code": "INTERNAL_ERROR", "message": "Command failed safely"},
                delivery_status=delivery_state,
            ).to_dict()
        finally:
            for reservation in audit_reservations:
                try:
                    self._audit.cancel(reservation)
                except Exception:
                    pass

    def preview(self, raw: Mapping[str, Any]) -> dict[str, Any]:
        envelope: CommandEnvelope | None = None
        try:
            envelope = parse_command_envelope(raw, self._limits)
            validate_temporal_window(envelope, self._limits, self._clock())
            self._identities.authenticate(envelope.actor)
            decision = self._evaluate_policy(envelope, replay_fresh=True)
            if not decision.allowed:
                raise PolicyDeniedError(decision.reason_code, decision.reason)
            delivery_result: dict[str, Any] = {}
            if envelope.profile == "native":
                plan = self._conversations.prepare(envelope)
                self._enforce_recipient_policy(envelope, plan)
                delivery_result = {
                    "delivery": {
                        "status": "accepted",
                        "recipients": [
                            {"id": descriptor.normalized_id, "status": "accepted"}
                            for descriptor in plan.recipients
                        ],
                    }
                }
            return self._response(
                raw,
                envelope,
                status="accepted",
                result={
                    "allowed": True,
                    "reason_code": decision.reason_code,
                    "selected_provider": decision.selected_provider,
                    "applied_rules": list(decision.applied_rules),
                    "dry_run": True,
                    **delivery_result,
                },
                error=None,
                delivery_status="accepted" if envelope.profile == "native" else None,
            ).to_dict()
        except CommandBusError as exc:
            return self._response(
                raw,
                envelope,
                status=exc.status,
                result=exc.safe_result,
                error={"code": exc.code, "message": exc.safe_message},
                delivery_status="rejected" if envelope and envelope.profile == "native" else None,
            ).to_dict()
        except Exception:
            return self._response(
                raw,
                envelope,
                status="failed",
                result={},
                error={"code": "INTERNAL_ERROR", "message": "Command failed safely"},
                delivery_status="failed" if envelope and envelope.profile == "native" else None,
            ).to_dict()

    def process_once(self, transport: CommandTransport, timeout: float | None = None) -> bool:
        command = transport.receive(timeout)
        if command is None:
            return False
        transport.send_response(self.handle(command))
        return True

    def health(self) -> dict[str, Any]:
        now = self._clock()
        return {
            "healthy": self._audit.health(),
            "audit": self._audit.health(),
            "replay": self._replay_store.health(now),
            "protocol": VERSION,
        }

    def _evaluate_policy(self, envelope: CommandEnvelope, *, replay_fresh: bool) -> PolicyDecision:
        context = PolicyContext(
            actor_role=envelope.actor.role,
            target_type=envelope.target.type,
            target_id=envelope.target.id,
            intent=envelope.intent,
            sensitivity=envelope.payload.sensitivity,
            payload_size_bytes=envelope.payload_size_bytes,
            ttl_seconds=envelope.ttl_seconds,
            replay_fresh=replay_fresh,
            audit_available=self._audit.health(),
        )
        return self._policy.evaluate(context)

    def _enforce_recipient_policy(
        self,
        envelope: CommandEnvelope,
        plan: DeliveryPlan,
    ) -> None:
        decisions = []
        denied = []
        for descriptor in plan.recipients:
            recipient_decision = self._policy.evaluate_recipient(
                RecipientPolicyContext(
                    recipient_id=descriptor.normalized_id,
                    recipient_type=descriptor.recipient.type,
                    locality=descriptor.locality,
                    enabled=descriptor.enabled,
                    sensitivity=envelope.payload.sensitivity,
                )
            )
            decisions.append((descriptor, recipient_decision))
            if not recipient_decision.allowed:
                denied.append(recipient_decision)
        if denied:
            aggregate = []
            for descriptor, recipient_decision in decisions:
                reason_code = (
                    recipient_decision.reason_code
                    if not recipient_decision.allowed
                    else "BROADCAST_ATOMIC_REJECTION"
                )
                aggregate.append(
                    {
                        "id": descriptor.normalized_id,
                        "status": "rejected",
                        "reason_code": reason_code,
                    }
                )
            raise PolicyDeniedError(
                denied[0].reason_code,
                denied[0].reason,
                safe_result={
                    "delivery": {
                        "status": "rejected",
                        "recipients": aggregate,
                    }
                },
            )

    def _record_audit(
        self,
        envelope: CommandEnvelope,
        decision: PolicyDecision,
        *,
        delivery_plan: DeliveryPlan | None,
        duration_ms: int,
        result_status: str,
        reason_code: str,
        strict: bool,
        reservations: list[AuditReservation],
    ) -> None:
        reservation = reservations[0] if reservations else None
        try:
            self._audit.record(
                message_id=envelope.message_id,
                trace_id=envelope.trace.trace_id,
                actor_id=envelope.actor.id,
                actor_role=envelope.actor.role,
                target_id=envelope.target.id,
                intent=envelope.intent,
                sensitivity=envelope.payload.sensitivity,
                policy_decision="allowed" if decision.allowed else "denied",
                reason_code=reason_code,
                provider=decision.selected_provider,
                duration_ms=duration_ms,
                result_status=result_status,
                payload_hash=compute_payload_hash(envelope),
                conversation_id=envelope.conversation_id,
                kind=envelope.kind,
                recipient_ids=(
                    tuple(descriptor.normalized_id for descriptor in delivery_plan.recipients)
                    if delivery_plan is not None
                    else tuple(recipient.normalized_id for recipient in envelope.recipients)
                ),
                reservation=reservation,
            )
        except CommandBusError:
            if strict:
                raise
        else:
            if reservation is not None:
                reservations.pop(0)

    def _finalize_failed_delivery(
        self,
        envelope: CommandEnvelope | None,
        delivery_plan: DeliveryPlan | None,
        delivery_state: str | None,
        delivery_reserved: bool,
    ) -> str | None:
        if delivery_plan is None or not delivery_reserved:
            if envelope is not None and envelope.profile == "native" and delivery_state is None:
                return DeliveryStateMachine.transition(None, "rejected")
            return delivery_state
        try:
            if delivery_state == "accepted" and envelope is not None:
                failed_state = DeliveryStateMachine.transition(delivery_state, "failed")
                self._conversations.record_delivery(
                    delivery_plan,
                    message_id=envelope.message_id,
                    status=failed_state,
                    payload_hash=compute_payload_hash(envelope),
                )
                return failed_state
            self._conversations.cancel_reservation(delivery_plan)
            return "rejected"
        except CommandBusError:
            self._conversations.cancel_reservation(delivery_plan)
            return "failed" if delivery_state == "accepted" else "rejected"

    def _response(
        self,
        raw: Mapping[str, Any],
        envelope: CommandEnvelope | None,
        *,
        status: str,
        result: dict[str, Any],
        error: dict[str, str] | None,
        delivery_status: str | None = None,
    ) -> CommandResponse:
        correlation_id = envelope.message_id if envelope else safe_uuid(raw.get("message_id"))
        trace_id = envelope.trace.trace_id if envelope else self._safe_trace_id(raw)
        return CommandResponse(
            protocol=PROTOCOL,
            version=VERSION,
            profile=envelope.profile if envelope else self._safe_profile(raw),
            message_id=self._id_factory(),
            correlation_id=correlation_id,
            timestamp=self._clock(),
            status=status,
            result=result,
            error=error,
            trace=Trace(trace_id=trace_id, parent_id=correlation_id),
            native=(
                self._native_response(envelope, delivery_status or "failed")
                if envelope is not None and envelope.profile == "native"
                else None
            ),
        )

    def _native_response(
        self,
        envelope: CommandEnvelope,
        delivery_status: str,
    ) -> dict[str, Any]:
        response_kind = {
            "command.request": "command.response",
            "model.request": "model.response",
        }.get(envelope.kind, envelope.kind)
        return {
            "conversation_id": envelope.conversation_id,
            "sender": {"id": "command-bus", "role": "observer"},
            "recipients": [{"type": "actor", "id": envelope.actor.id}],
            "kind": response_kind,
            "delivery": {"mode": "direct", "status": delivery_status},
            "security": {"classification": envelope.payload.sensitivity},
        }

    @staticmethod
    def _safe_profile(raw: Mapping[str, Any]) -> str:
        return raw.get("profile") if raw.get("profile") in {"command", "native"} else "command"

    def _safe_trace_id(self, raw: Mapping[str, Any]) -> str:
        trace = raw.get("trace")
        if isinstance(trace, Mapping):
            return safe_uuid(trace.get("trace_id"))
        return safe_uuid(None)

    def _duration_ms(self, started: float) -> int:
        return max(0, int((self._timer() - started) * 1000))

    @staticmethod
    def _denied_decision(code: str, reason: str) -> PolicyDecision:
        return PolicyDecision(
            allowed=False,
            reason_code=code,
            reason=reason,
            selected_provider=None,
            applied_rules=(),
        )
