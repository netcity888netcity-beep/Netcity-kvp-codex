import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from kernel.command_bus.errors import ReplayCapacityError, ReplayDetectedError
from kernel.command_bus.replay import InMemoryReplayStore
from tests.support import FIXED_NOW


class TestCommandReplay(unittest.TestCase):
    def test_duplicate_message_id_is_rejected(self) -> None:
        store = InMemoryReplayStore()
        store.check_and_store("message-1", "nonce-1", FIXED_NOW + timedelta(seconds=60), FIXED_NOW)
        with self.assertRaises(ReplayDetectedError) as raised:
            store.check_and_store(
                "message-1", "nonce-2", FIXED_NOW + timedelta(seconds=60), FIXED_NOW
            )
        self.assertEqual(raised.exception.code, "MESSAGE_ID_REPLAY")

    def test_duplicate_nonce_is_rejected(self) -> None:
        store = InMemoryReplayStore()
        store.check_and_store("message-1", "nonce-1", FIXED_NOW + timedelta(seconds=60), FIXED_NOW)
        with self.assertRaises(ReplayDetectedError) as raised:
            store.check_and_store(
                "message-2", "nonce-1", FIXED_NOW + timedelta(seconds=60), FIXED_NOW
            )
        self.assertEqual(raised.exception.code, "NONCE_REPLAY")

    def test_expired_reservations_are_purged(self) -> None:
        store = InMemoryReplayStore(max_entries=1)
        store.check_and_store("message-1", "nonce-1", FIXED_NOW + timedelta(seconds=1), FIXED_NOW)
        store.check_and_store(
            "message-2",
            "nonce-2",
            FIXED_NOW + timedelta(seconds=60),
            FIXED_NOW + timedelta(seconds=2),
        )
        self.assertEqual(store.health(FIXED_NOW + timedelta(seconds=2))["entries"], 1)

    def test_capacity_fails_closed(self) -> None:
        store = InMemoryReplayStore(max_entries=1)
        store.check_and_store("message-1", "nonce-1", FIXED_NOW + timedelta(seconds=60), FIXED_NOW)
        with self.assertRaises(ReplayCapacityError):
            store.check_and_store(
                "message-2", "nonce-2", FIXED_NOW + timedelta(seconds=60), FIXED_NOW
            )

    def test_parallel_reservation_is_atomic(self) -> None:
        store = InMemoryReplayStore()

        def reserve() -> str:
            try:
                store.check_and_store(
                    "message-1", "nonce-1", FIXED_NOW + timedelta(seconds=60), FIXED_NOW
                )
                return "accepted"
            except ReplayDetectedError:
                return "rejected"

        with ThreadPoolExecutor(max_workers=8) as executor:
            outcomes = list(executor.map(lambda _: reserve(), range(8)))
        self.assertEqual(outcomes.count("accepted"), 1)
        self.assertEqual(outcomes.count("rejected"), 7)


if __name__ == "__main__":
    unittest.main()
