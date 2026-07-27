from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from kernel.command_bus.bootstrap import DEFAULT_CONFIG_PATH, build_runtime
from kernel.command_bus.envelope import PROTOCOL, VERSION, format_rfc3339
from kernel.command_bus.errors import CommandBusError
from kernel.command_bus.policy import DENIED_INTENTS


SERVICE_TARGET_INTENTS = frozenset(
    {
        "health.check", "status.query", "message.deliver", "command.respond",
        "task.create", "task.progress", "task.complete", "model.respond",
    }
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local KVP Command Bridge v0.1 client")
    subparsers = parser.add_subparsers(dest="command", required=True)

    health = subparsers.add_parser("health", help="Check the local command bridge")
    _add_common_options(health)

    send = subparsers.add_parser("send", help="Send one normalized local command")
    _add_common_options(send)
    send.add_argument("--profile", choices=("command", "native"), required=True)
    send.add_argument("--intent", required=True, help="Allowlisted namespace.action intent")
    send.add_argument("--content", default=None, help="Command or request content")
    send.add_argument(
        "--sensitivity",
        choices=("public", "internal", "confidential", "restricted"),
        default="internal",
    )
    send.add_argument("--actor-id", default="local-architect")
    send.add_argument(
        "--role",
        choices=("architect", "builder", "reviewer", "security", "observer"),
        default="architect",
    )
    send.add_argument("--target-type", choices=("model", "agent", "service"), default=None)
    send.add_argument("--target-id", default=None)
    send.add_argument(
        "--kind",
        choices=(
            "message.text", "command.request", "command.response", "task.created",
            "task.progress", "task.completed", "model.request", "model.response",
            "health.check",
        ),
        default=None,
    )
    send.add_argument(
        "--recipient",
        action="append",
        default=[],
        help="Native recipient in type:id form; repeat for multiple recipients",
    )
    send.add_argument("--conversation-id", default=None)
    send.add_argument("--delivery-mode", choices=("direct", "broadcast"), default="direct")
    send.add_argument("--ttl", type=int, default=60, help="Command TTL in seconds")
    send.add_argument("--dry-run", action="store_true", help="Validate without replay or dispatch")

    audit = subparsers.add_parser("audit", help="Read redacted local audit events")
    _add_common_options(audit)
    audit.add_argument("--limit", type=int, default=10)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        runtime = build_runtime(Path(args.config))
        if args.command == "health":
            command = _make_envelope(
                profile="native",
                intent="health.check",
                content="health.check",
                sensitivity="public",
                actor_id="local-observer",
                role="observer",
                target_type="service",
                target_id="command-bus",
                ttl=60,
                metadata={},
                kind="health.check",
                recipients=[{"type": "service", "id": "command-bus"}],
                conversation_id=str(uuid4()),
                delivery_mode="direct",
            )
            response = _dispatch(runtime, command)
        elif args.command == "audit":
            if not 1 <= args.limit <= 100:
                return _print_cli_error(args.json, "INVALID_LIMIT", "Audit limit must be 1..100")
            command = _make_envelope(
                profile="native",
                intent="status.query",
                content="audit.query",
                sensitivity="internal",
                actor_id="local-observer",
                role="observer",
                target_type="service",
                target_id="command-bus",
                ttl=60,
                metadata={"resource": "audit", "limit": args.limit},
                kind="command.request",
                recipients=[{"type": "service", "id": "command-bus"}],
                conversation_id=str(uuid4()),
                delivery_mode="direct",
            )
            response = _dispatch(runtime, command)
        else:
            if args.intent in DENIED_INTENTS:
                return _print_cli_error(args.json, "INTENT_FORBIDDEN", "Intent is explicitly forbidden")
            if args.ttl <= 0:
                return _print_cli_error(args.json, "INVALID_TTL", "TTL must be positive")
            target_type, target_id = _target_defaults(args.intent, args.target_type, args.target_id)
            recipients: list[dict[str, str]] = []
            if args.profile == "native":
                if args.kind is None or not args.recipient:
                    return _print_cli_error(
                        args.json,
                        "NATIVE_FIELDS_REQUIRED",
                        "Native profile requires --kind and at least one --recipient",
                    )
                try:
                    recipients = [_parse_recipient(value) for value in args.recipient]
                except ValueError:
                    return _print_cli_error(
                        args.json,
                        "INVALID_RECIPIENT",
                        "Recipient must use type:id form",
                    )
            elif args.kind is not None or args.recipient or args.conversation_id is not None:
                return _print_cli_error(
                    args.json,
                    "NATIVE_FIELDS_NOT_ALLOWED",
                    "Native options require --profile native",
                )
            command = _make_envelope(
                profile=args.profile,
                intent=args.intent,
                content=args.content or args.intent,
                sensitivity=args.sensitivity,
                actor_id=args.actor_id,
                role=args.role,
                target_type=target_type,
                target_id=target_id,
                ttl=args.ttl,
                metadata={},
                kind=args.kind,
                recipients=recipients,
                conversation_id=args.conversation_id or (str(uuid4()) if args.profile == "native" else None),
                delivery_mode=args.delivery_mode,
            )
            response = runtime.service.preview(command) if args.dry_run else _dispatch(runtime, command)
        _print_response(response, args.json)
        return _exit_code(response)
    except CommandBusError as exc:
        return _print_cli_error(args.json, exc.code, exc.safe_message, failed=True)
    except Exception:
        return _print_cli_error(args.json, "INTERNAL_ERROR", "CLI failed safely", failed=True)


def _add_common_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--json", action="store_true", help="Emit compact JSON")


def _make_envelope(
    *,
    profile: str,
    intent: str,
    content: str,
    sensitivity: str,
    actor_id: str,
    role: str,
    target_type: str,
    target_id: str,
    ttl: int,
    metadata: dict[str, Any],
    kind: str | None,
    recipients: list[dict[str, str]],
    conversation_id: str | None,
    delivery_mode: str,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    envelope = {
        "protocol": PROTOCOL,
        "version": VERSION,
        "profile": profile,
        "message_id": str(uuid4()),
        "timestamp": format_rfc3339(now),
        "expires_at": format_rfc3339(now + timedelta(seconds=ttl)),
        "nonce": uuid4().hex,
        "actor": {"id": actor_id, "role": role},
        "target": {"type": target_type, "id": target_id},
        "intent": intent,
        "payload": {"content": content, "sensitivity": sensitivity},
        "trace": {"trace_id": str(uuid4()), "parent_id": None},
        "metadata": metadata,
    }
    if profile == "native":
        envelope.update(
            {
                "conversation_id": conversation_id,
                "sender": {"id": actor_id, "role": role},
                "recipients": recipients,
                "kind": kind,
                "delivery": {"mode": delivery_mode, "status": "accepted"},
                "security": {"classification": sensitivity},
            }
        )
    return envelope


def _parse_recipient(value: str) -> dict[str, str]:
    recipient_type, separator, recipient_id = value.partition(":")
    if separator != ":" or recipient_type not in {"actor", "room", "model", "service"}:
        raise ValueError("Invalid recipient")
    if not recipient_id:
        raise ValueError("Invalid recipient")
    return {"type": recipient_type, "id": recipient_id}


def _target_defaults(
    intent: str,
    target_type: str | None,
    target_id: str | None,
) -> tuple[str, str]:
    inferred_type = "service" if intent in SERVICE_TARGET_INTENTS else "model"
    selected_type = target_type or inferred_type
    inferred_id = "command-bus" if selected_type == "service" else "mock/local-echo"
    return selected_type, target_id or inferred_id


def _dispatch(runtime: Any, command: dict[str, Any]) -> dict[str, Any]:
    runtime.transport.start()
    try:
        runtime.transport.submit(command)
        if not runtime.service.process_once(runtime.transport, timeout=0.1):
            raise RuntimeError("Local transport did not receive the command")
        response = runtime.transport.next_response(timeout=0.1)
        if response is None:
            raise RuntimeError("Local transport did not return a response")
        return dict(response)
    finally:
        runtime.transport.stop()


def _print_response(response: dict[str, Any], compact: bool) -> None:
    if compact:
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    else:
        print(json.dumps(response, ensure_ascii=False, indent=2, sort_keys=True))


def _print_cli_error(compact: bool, code: str, message: str, *, failed: bool = False) -> int:
    response = {"status": "failed" if failed else "rejected", "error": {"code": code, "message": message}}
    _print_response(response, compact)
    return 3 if failed else 2


def _exit_code(response: dict[str, Any]) -> int:
    status = response.get("status")
    if status in {"accepted", "completed"}:
        return 0
    return 2 if status == "rejected" else 3


if __name__ == "__main__":
    raise SystemExit(main())
