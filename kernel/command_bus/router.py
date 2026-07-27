from __future__ import annotations

from typing import Any, Callable

from .audit import AuditEvent
from .conversations import DeliveryPlan
from .envelope import CommandEnvelope
from .errors import RoutingError
from .gateway import GatewayRequest, ModelGatewayPort
from .policy import PolicyDecision


class CommandRouter:
    def __init__(
        self,
        gateway: ModelGatewayPort,
        *,
        audit_reader: Callable[[int], tuple[AuditEvent, ...]],
    ) -> None:
        self._gateway = gateway
        self._audit_reader = audit_reader

    def route(
        self,
        envelope: CommandEnvelope,
        decision: PolicyDecision,
        delivery_plan: DeliveryPlan | None = None,
    ) -> dict[str, Any]:
        provider_id = decision.selected_provider
        if not decision.allowed or provider_id is None:
            raise RoutingError("ROUTE_NOT_ALLOWED", "Command has no allowed route")
        if envelope.profile == "native":
            if delivery_plan is None:
                raise RoutingError("DELIVERY_PLAN_REQUIRED", "Native delivery plan is missing")
            return self._route_native(envelope, provider_id, delivery_plan)
        if envelope.target.type == "service":
            return self._route_service(envelope, provider_id)
        request = GatewayRequest(
            target_id=envelope.target.id,
            intent=envelope.intent,
            content=envelope.payload.content,
            sensitivity=envelope.payload.sensitivity,
        )
        response = self._gateway.complete(request, provider_id)
        if response.provider != provider_id:
            raise RoutingError("PROVIDER_MISMATCH", "Provider response does not match selected route")
        return dict(response.result)

    def _route_native(
        self,
        envelope: CommandEnvelope,
        provider_id: str,
        plan: DeliveryPlan,
    ) -> dict[str, Any]:
        delivery = {
            "status": "delivered",
            "recipients": [
                {"id": descriptor.normalized_id, "status": "delivered"}
                for descriptor in plan.recipients
            ],
        }
        if envelope.target.type == "service":
            if envelope.kind == "health.check" or envelope.intent in {"health.check", "status.query"}:
                result = self._route_service(envelope, provider_id)
                result["delivery"] = delivery
                return result
            if provider_id != "command_bus":
                raise RoutingError("SERVICE_ROUTE_INVALID", "Native service route is unavailable")
            return {"kind": envelope.kind, "delivery": delivery}

        model_recipients = [
            descriptor
            for descriptor in plan.recipients
            if descriptor.recipient.type == "model"
        ]
        if len(model_recipients) != 1 or model_recipients[0].recipient.id != envelope.target.id:
            raise RoutingError(
                "MODEL_RECIPIENT_MISMATCH",
                "Model target must match the explicit model recipient",
            )
        request = GatewayRequest(
            target_id=envelope.target.id,
            intent=envelope.intent,
            content=envelope.payload.content,
            sensitivity=envelope.payload.sensitivity,
        )
        response = self._gateway.complete(request, provider_id)
        if response.provider != provider_id:
            raise RoutingError("PROVIDER_MISMATCH", "Provider response does not match selected route")
        result = dict(response.result)
        result["delivery"] = delivery
        return result

    def _route_service(self, envelope: CommandEnvelope, provider_id: str) -> dict[str, Any]:
        if provider_id != "command_bus" or envelope.target.id != "command-bus":
            raise RoutingError("SERVICE_ROUTE_INVALID", "Service route is unavailable")
        if envelope.intent == "health.check":
            return {
                "healthy": True,
                "service": "kvp-command-bridge",
                "protocol": "0.1",
                "transport": "in_memory",
            }
        if envelope.intent == "status.query":
            if envelope.metadata.get("resource") == "audit":
                limit = envelope.metadata.get("limit", 10)
                if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 100:
                    raise RoutingError("INVALID_AUDIT_LIMIT", "Audit limit must be between 1 and 100")
                return {"events": [event.to_dict() for event in self._audit_reader(limit)]}
            return {
                "status": "ready",
                "service": "kvp-command-bridge",
                "provider": provider_id,
            }
        raise RoutingError("SERVICE_INTENT_UNSUPPORTED", "Service intent is not supported")
