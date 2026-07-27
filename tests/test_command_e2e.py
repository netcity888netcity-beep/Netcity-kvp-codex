import socket
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from kernel.command_bus.bootstrap import build_runtime
from kernel.command_bus.conversations import (
    ConversationLimits,
    ConversationStore,
    DeliveryPlan,
    DeliveryStateMachine,
    RecipientDescriptor,
    RecipientDirectory,
)
from kernel.command_bus.envelope import Recipient
from kernel.command_bus.errors import CommunicationsError, ConfigurationError
from kernel.command_bus.gateway import GatewayRequest, GatewayResponse, ModelGatewayPort
from tests.support import FIXED_NOW, build_test_runtime, make_envelope


class ExplodingGateway(ModelGatewayPort):
    def complete(self, request: GatewayRequest, provider_id: str) -> GatewayResponse:
        raise RuntimeError("D:/private/internal/provider.py should never be disclosed")


class TestCommandE2E(unittest.TestCase):
    def test_full_command_flow_preserves_correlation(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope()
        response = runtime.service.handle(command)
        self.assertEqual(response["profile"], "command")
        self.assertEqual(response["status"], "completed")
        self.assertEqual(response["correlation_id"], command["message_id"])
        self.assertEqual(response["trace"]["parent_id"], command["message_id"])

    def test_expired_native_message_is_rejected_before_delivery(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            now=FIXED_NOW - timedelta(seconds=120),
            ttl_seconds=30,
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "actor", "id": "local-builder"}],
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "COMMAND_EXPIRED")
        self.assertEqual(response["delivery"]["status"], "rejected")

    def test_parallel_duplicate_reaches_gateway_once(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(profile="native", kind="model.request")

        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: runtime.service.handle(command), range(2)))
        statuses = sorted(response["status"] for response in responses)
        self.assertEqual(statuses, ["completed", "rejected"])
        self.assertEqual(runtime.gateway.invocation_count, 1)
        self.assertIn(
            "MESSAGE_ID_REPLAY",
            [response["error"]["code"] for response in responses if response["error"]],
        )

    def test_provider_exception_is_normalized_without_internal_details(self) -> None:
        runtime = build_test_runtime(gateway=ExplodingGateway())
        response = runtime.service.handle(make_envelope())
        self.assertEqual(response["status"], "failed")
        self.assertEqual(response["error"]["code"], "INTERNAL_ERROR")
        self.assertNotIn("private", str(response).lower())
        self.assertNotIn("provider.py", str(response).lower())

    def test_processing_does_not_open_external_network(self) -> None:
        runtime = build_test_runtime()
        with patch.object(socket, "create_connection", side_effect=AssertionError("network used")):
            response = runtime.service.handle(make_envelope())
        self.assertEqual(response["status"], "completed")

    def test_missing_configuration_fails_closed(self) -> None:
        with self.assertRaises(ConfigurationError):
            build_runtime(Path("missing-command-bus-config.json"))

    def test_dry_run_has_no_gateway_or_replay_side_effect(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(profile="native", kind="model.request")
        first = runtime.service.preview(command)
        second = runtime.service.preview(command)
        self.assertEqual(first["status"], "accepted")
        self.assertEqual(second["status"], "accepted")
        self.assertEqual(runtime.gateway.invocation_count, 0)

    def test_invalid_delivery_transition_is_rejected(self) -> None:
        self.assertEqual(DeliveryStateMachine.transition(None, "accepted"), "accepted")
        with self.assertRaises(CommunicationsError) as raised:
            DeliveryStateMachine.transition("delivered", "failed")
        self.assertEqual(raised.exception.code, "INVALID_DELIVERY_TRANSITION")

    def test_conversation_store_rejects_non_terminal_delivery_record(self) -> None:
        recipient = Recipient(type="actor", id="local-builder")
        descriptor = RecipientDescriptor(recipient, "local", True)
        store = ConversationStore(
            RecipientDirectory({recipient.normalized_id: descriptor}),
            {},
            ConversationLimits(1, 1, 1, 1, 1),
        )
        plan = DeliveryPlan(
            conversation_id="00000000-0000-0000-0000-000000000031",
            sender_id="local-architect",
            kind="message.text",
            classification="internal",
            mode="direct",
            recipients=(descriptor,),
        )
        store.reserve_delivery(plan)
        with self.assertRaises(CommunicationsError) as raised:
            store.record_delivery(
                plan,
                message_id="message-1",
                status="accepted",
                payload_hash="0" * 64,
            )
        self.assertEqual(raised.exception.code, "INVALID_DELIVERY_TRANSITION")
        self.assertEqual(store.history(plan.conversation_id), ())
        store.cancel_reservation(plan)

    def test_conversation_message_limit_prevents_unbounded_growth(self) -> None:
        recipient = Recipient(type="actor", id="local-builder")
        descriptor = RecipientDescriptor(recipient, "local", True)
        store = ConversationStore(
            RecipientDirectory({recipient.normalized_id: descriptor}),
            {},
            ConversationLimits(1, 1, 1, 1, 1),
        )
        plan = DeliveryPlan(
            conversation_id="00000000-0000-0000-0000-000000000030",
            sender_id="local-architect",
            kind="message.text",
            classification="internal",
            mode="direct",
            recipients=(descriptor,),
        )
        store.reserve_delivery(plan)
        store.record_delivery(plan, message_id="message-1", status="delivered", payload_hash="0" * 64)
        with self.assertRaises(CommunicationsError) as raised:
            store.reserve_delivery(plan)
        self.assertEqual(raised.exception.code, "CONVERSATION_MESSAGE_LIMIT")


if __name__ == "__main__":
    unittest.main()
