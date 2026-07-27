import copy
import unittest
from datetime import timedelta

from kernel.command_bus.envelope import EnvelopeLimits, parse_command_envelope, validate_temporal_window
from kernel.command_bus.errors import EnvelopeValidationError
from tests.support import FIXED_NOW, make_envelope


class TestCommandEnvelope(unittest.TestCase):
    def test_valid_envelope_is_accepted(self) -> None:
        envelope = parse_command_envelope(make_envelope(), EnvelopeLimits())
        validate_temporal_window(envelope, EnvelopeLimits(), FIXED_NOW)
        self.assertEqual(envelope.intent, "model.prompt")

    def test_wrong_version_is_rejected(self) -> None:
        command = make_envelope()
        command["version"] = "0.2"
        with self.assertRaisesRegex(EnvelopeValidationError, "Unsupported") as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "UNSUPPORTED_VERSION")

    def test_profile_is_required(self) -> None:
        command = make_envelope()
        command.pop("profile")
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "PROFILE_REQUIRED")

    def test_partial_native_group_is_rejected(self) -> None:
        command = make_envelope()
        command["conversation_id"] = "00000000-0000-0000-0000-000000000003"
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "PARTIAL_NATIVE_ENVELOPE")

    def test_command_profile_rejects_complete_native_group(self) -> None:
        command = make_envelope(profile="native")
        command["profile"] = "command"
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "NATIVE_FIELDS_NOT_ALLOWED")

    def test_native_sender_and_classification_are_normalized(self) -> None:
        envelope = parse_command_envelope(make_envelope(profile="native"), EnvelopeLimits())
        self.assertEqual(envelope.sender, envelope.actor)
        self.assertEqual(envelope.security.classification, envelope.payload.sensitivity)

    def test_native_sender_mismatch_is_rejected(self) -> None:
        command = make_envelope(profile="native")
        command["sender"]["id"] = "local-builder"
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "SENDER_ACTOR_MISMATCH")

    def test_native_classification_mismatch_is_rejected(self) -> None:
        command = make_envelope(profile="native")
        command["security"]["classification"] = "restricted"
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "CLASSIFICATION_MISMATCH")

    def test_expired_command_is_rejected(self) -> None:
        command = make_envelope(now=FIXED_NOW - timedelta(seconds=120), ttl_seconds=30)
        envelope = parse_command_envelope(command, EnvelopeLimits())
        with self.assertRaises(EnvelopeValidationError) as raised:
            validate_temporal_window(envelope, EnvelopeLimits(), FIXED_NOW)
        self.assertEqual(raised.exception.code, "COMMAND_EXPIRED")

    def test_future_timestamp_is_rejected(self) -> None:
        command = make_envelope(now=FIXED_NOW + timedelta(seconds=31))
        envelope = parse_command_envelope(command, EnvelopeLimits())
        with self.assertRaises(EnvelopeValidationError) as raised:
            validate_temporal_window(envelope, EnvelopeLimits(), FIXED_NOW)
        self.assertEqual(raised.exception.code, "TIMESTAMP_IN_FUTURE")

    def test_unknown_role_is_rejected(self) -> None:
        command = make_envelope()
        command["actor"]["role"] = "operator"
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "UNKNOWN_ROLE")

    def test_secret_like_payload_fields_are_rejected(self) -> None:
        for field in (
            "api_key", "token", "password", "authorization", "credential",
            "client_secret", "private_key",
        ):
            with self.subTest(field=field):
                command = copy.deepcopy(make_envelope())
                command["payload"][field] = "redacted-test-placeholder"
                with self.assertRaises(EnvelopeValidationError) as raised:
                    parse_command_envelope(command, EnvelopeLimits())
                self.assertEqual(raised.exception.code, "SECRET_FIELD_FORBIDDEN")

    def test_payload_size_limit_is_enforced(self) -> None:
        command = make_envelope(content="x" * 128)
        limits = EnvelopeLimits(max_payload_bytes=64)
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, limits)
        self.assertEqual(raised.exception.code, "PAYLOAD_TOO_LARGE")

    def test_unknown_fields_are_rejected(self) -> None:
        command = make_envelope()
        command["unexpected"] = True
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "UNKNOWN_FIELD")

    def test_schema_errors_do_not_echo_attacker_controlled_keys(self) -> None:
        secret_key = "credential-material-should-not-echo"
        command = make_envelope()
        command[secret_key] = True
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "UNKNOWN_FIELD")
        self.assertNotIn(secret_key, raised.exception.safe_message)

    def test_non_string_root_fields_have_stable_validation_error(self) -> None:
        command = make_envelope()
        command[1] = "invalid"
        command["second-unknown"] = True
        with self.assertRaises(EnvelopeValidationError) as raised:
            parse_command_envelope(command, EnvelopeLimits())
        self.assertEqual(raised.exception.code, "INVALID_FIELD_TYPE")


if __name__ == "__main__":
    unittest.main()
