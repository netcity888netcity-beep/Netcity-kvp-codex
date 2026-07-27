import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path

from kernel.command_bus.audit import InMemoryAuditSink, JsonlAuditSink, verify_audit_chain
from tests.support import build_test_runtime, make_envelope


class FailingReservationAuditSink(InMemoryAuditSink):
    def reserve(self, count: int):
        self.set_available(False)
        return super().reserve(count)


class FailingTerminalAuditSink(InMemoryAuditSink):
    def __init__(self) -> None:
        super().__init__()
        self._append_calls = 0

    def append(self, event, reservation=None):
        self._append_calls += 1
        if self._append_calls >= 2:
            self.set_available(False)
        return super().append(event, reservation)


class TestCommandAudit(unittest.TestCase):
    def test_audit_omits_payload_content_and_keeps_hash(self) -> None:
        secret_text = "sensitive-message-body"
        runtime = build_test_runtime()
        response = runtime.service.handle(make_envelope(content=secret_text))
        self.assertEqual(response["status"], "completed")
        events = runtime.audit.events()
        serialized = json.dumps([event.to_dict() for event in events], sort_keys=True)
        self.assertNotIn(secret_text, serialized)
        self.assertEqual([event.result_status for event in events], ["authorized", "completed"])
        self.assertTrue(all(len(event.payload_hash) == 64 for event in events))
        self.assertTrue(all(event.recipient_ids == () for event in events))

    def test_hash_chain_integrity_and_tamper_detection(self) -> None:
        runtime = build_test_runtime()
        first = make_envelope()
        second = make_envelope(
            message_id="00000000-0000-0000-0000-000000000011",
            nonce="nonce-000000000011",
        )
        runtime.service.handle(first)
        runtime.service.handle(second)
        events = runtime.audit.events()
        self.assertTrue(verify_audit_chain(events))
        tampered = (events[0], replace(events[1], reason_code="TAMPERED"))
        self.assertFalse(verify_audit_chain(tampered))

    def test_unavailable_audit_rejects_critical_command_before_gateway(self) -> None:
        sink = InMemoryAuditSink(available=False)
        runtime = build_test_runtime(audit_sink=sink)
        response = runtime.service.handle(make_envelope())
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "AUDIT_REQUIRED")
        self.assertEqual(runtime.gateway.invocation_count, 0)

    def test_audit_reservation_failure_rejects_before_gateway(self) -> None:
        sink = FailingReservationAuditSink()
        runtime = build_test_runtime(audit_sink=sink)
        response = runtime.service.handle(make_envelope())
        self.assertEqual(response["status"], "failed")
        self.assertEqual(response["error"]["code"], "AUDIT_UNAVAILABLE")
        self.assertEqual(runtime.gateway.invocation_count, 0)

    def test_audit_capacity_is_bounded_and_fails_closed(self) -> None:
        sink = InMemoryAuditSink(max_entries=2)
        runtime = build_test_runtime(audit_sink=sink)
        first = runtime.service.handle(make_envelope())
        second = runtime.service.handle(
            make_envelope(
                message_id="00000000-0000-0000-0000-000000000012",
                nonce="nonce-000000000012",
            )
        )
        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["status"], "rejected")
        self.assertEqual(second["error"]["code"], "AUDIT_REQUIRED")
        self.assertEqual(runtime.gateway.invocation_count, 1)
        self.assertEqual(len(runtime.audit.events()), 2)
        self.assertEqual(runtime.audit.events(0), ())

    def test_concurrent_critical_reservations_remain_bounded(self) -> None:
        sink = InMemoryAuditSink(max_entries=2)
        runtime = build_test_runtime(audit_sink=sink)
        commands = [
            make_envelope(
                message_id=f"00000000-0000-0000-0000-{index:012d}",
                nonce=f"nonce-{index:012d}",
            )
            for index in (21, 22)
        ]
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(runtime.service.handle, commands))
        self.assertEqual(sum(response["status"] == "completed" for response in responses), 1)
        self.assertEqual(runtime.gateway.invocation_count, 1)
        self.assertEqual(len(runtime.audit.events()), 2)
        self.assertTrue(verify_audit_chain(runtime.audit.events()))

    def test_jsonl_reload_verifies_chain_and_capacity(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.jsonl"
            runtime = build_test_runtime(audit_sink=JsonlAuditSink(path, max_entries=2))
            response = runtime.service.handle(make_envelope())
            self.assertEqual(response["status"], "completed")

            reloaded = JsonlAuditSink(path, max_entries=2)
            self.assertEqual(len(reloaded.events()), 2)
            self.assertTrue(verify_audit_chain(reloaded.events()))
            self.assertFalse(reloaded.health())

    def test_terminal_audit_failure_preserves_predispatch_evidence(self) -> None:
        sink = FailingTerminalAuditSink()
        runtime = build_test_runtime(audit_sink=sink)
        command = make_envelope(profile="native", kind="model.request")
        response = runtime.service.handle(command)

        self.assertEqual(response["status"], "failed")
        self.assertEqual(response["error"]["code"], "AUDIT_UNAVAILABLE")
        self.assertEqual(response["delivery"]["status"], "failed")
        self.assertEqual(runtime.gateway.invocation_count, 1)
        events = runtime.audit.events()
        self.assertEqual([event.result_status for event in events], ["authorized"])
        self.assertTrue(verify_audit_chain(events))
        history = runtime.conversations.history(command["conversation_id"])
        self.assertEqual([record.delivery_status for record in history], ["failed"])


if __name__ == "__main__":
    unittest.main()
