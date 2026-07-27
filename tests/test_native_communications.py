import json
import unittest

from tests.support import build_test_runtime, make_envelope


class TestNativeCommunications(unittest.TestCase):
    def test_architect_to_builder(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "actor", "id": "local-builder"}],
            content="Build the command bridge",
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["delivery"]["status"], "delivered")
        self.assertEqual(
            response["result"]["delivery"]["recipients"],
            [{"id": "actor:local-builder", "status": "delivered"}],
        )

    def test_builder_to_reviewer(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            message_id="00000000-0000-0000-0000-000000000021",
            nonce="nonce-000000000021",
            actor_id="local-builder",
            role="builder",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "actor", "id": "local-reviewer"}],
            content="Review the local implementation",
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["status"], "completed")
        self.assertEqual(response["delivery"]["status"], "delivered")

    def test_architect_to_model(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            kind="model.request",
            recipients=[{"type": "model", "id": "mock/local-echo"}],
            content="Explain the protocol",
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["kind"], "model.response")
        self.assertEqual(response["result"]["provider"], "mock")
        self.assertEqual(response["delivery"]["status"], "delivered")

    def test_room_broadcast_uses_atomic_member_snapshot(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "room", "id": "temple-build"}],
            delivery_mode="broadcast",
            content="Broadcast without payload disclosure",
        )
        response = runtime.service.handle(command)
        recipients = response["result"]["delivery"]["recipients"]
        self.assertEqual(
            [item["id"] for item in recipients],
            ["actor:local-builder", "actor:local-reviewer"],
        )
        self.assertTrue(all(item["status"] == "delivered" for item in recipients))

    def test_unknown_recipient_is_rejected(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "actor", "id": "unknown-actor"}],
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "UNKNOWN_RECIPIENT")
        self.assertEqual(response["delivery"]["status"], "rejected")

    def test_direct_delivery_rejects_multiple_recipients(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[
                {"type": "actor", "id": "local-builder"},
                {"type": "actor", "id": "local-reviewer"},
            ],
            delivery_mode="direct",
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "DIRECT_RECIPIENT_COUNT")
        self.assertEqual(response["delivery"]["status"], "rejected")

    def test_history_is_bounded_metadata_without_message_content(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "actor", "id": "local-builder"}],
            content="history-must-not-store-this-content",
        )
        runtime.service.handle(command)
        history = runtime.conversations.history(command["conversation_id"])
        serialized = json.dumps([record.__dict__ for record in history], sort_keys=True)
        self.assertEqual(len(history), 1)
        self.assertNotIn(command["payload"]["content"], serialized)
        self.assertEqual(len(history[0].payload_hash), 64)

    def test_room_membership_is_checked_before_delivery(self) -> None:
        runtime = build_test_runtime()
        command = make_envelope(
            profile="native",
            actor_id="local-security",
            role="security",
            target_type="service",
            target_id="command-bus",
            intent="message.deliver",
            kind="message.text",
            recipients=[{"type": "room", "id": "temple-build"}],
            delivery_mode="broadcast",
        )
        response = runtime.service.handle(command)
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "ROOM_MEMBERSHIP_REQUIRED")


if __name__ == "__main__":
    unittest.main()
