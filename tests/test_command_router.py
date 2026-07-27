import unittest

from kernel.command_bus.errors import TransportCapacityError
from kernel.command_bus.transports.in_memory import InMemoryTransport
from tests.support import build_test_runtime, make_envelope


class TestCommandRouter(unittest.TestCase):
    def test_mock_gateway_returns_normalized_response(self) -> None:
        runtime = build_test_runtime()
        response = runtime.service.handle(make_envelope(content="normalized response"))
        self.assertEqual(response["status"], "completed")
        self.assertEqual(response["result"]["provider"], "mock")
        self.assertEqual(response["result"]["model_id"], "mock/local-echo")
        self.assertEqual(response["result"]["content"], "normalized response")

    def test_in_memory_transport_lifecycle(self) -> None:
        runtime = build_test_runtime()
        self.assertFalse(runtime.transport.health()["healthy"])
        runtime.transport.start()
        try:
            runtime.transport.submit(make_envelope())
            self.assertTrue(runtime.service.process_once(runtime.transport, timeout=0.01))
            response = runtime.transport.next_response(timeout=0.01)
            self.assertEqual(response["status"], "completed")
            self.assertTrue(runtime.transport.health()["healthy"])
        finally:
            runtime.transport.stop()
        self.assertFalse(runtime.transport.health()["healthy"])

    def test_in_memory_transport_capacity_is_bounded(self) -> None:
        transport = InMemoryTransport(
            max_pending_requests=1,
            max_pending_responses=1,
            max_request_bytes=65_536,
            max_response_bytes=65_536,
        )
        transport.start()
        try:
            transport.submit(make_envelope())
            with self.assertRaises(TransportCapacityError) as raised:
                transport.submit(make_envelope())
            self.assertEqual(raised.exception.code, "TRANSPORT_REQUEST_CAPACITY")
            self.assertEqual(transport.health()["request_capacity"], 1)
        finally:
            transport.stop()

    def test_unknown_target_is_rejected_without_fallback(self) -> None:
        runtime = build_test_runtime()
        response = runtime.service.handle(make_envelope(target_id="unknown/model"))
        self.assertEqual(response["status"], "rejected")
        self.assertEqual(response["error"]["code"], "NO_EXPLICIT_ROUTE")


if __name__ == "__main__":
    unittest.main()
