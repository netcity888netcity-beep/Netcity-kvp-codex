class CommandBusError(Exception):
    def __init__(
        self,
        code: str,
        safe_message: str,
        *,
        status: str = "rejected",
        safe_result: dict | None = None,
    ) -> None:
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message
        self.status = status
        self.safe_result = safe_result or {}


class EnvelopeValidationError(CommandBusError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, status="rejected")


class IdentityError(CommandBusError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, status="rejected")


class PolicyDeniedError(CommandBusError):
    def __init__(self, code: str, safe_message: str, *, safe_result: dict | None = None) -> None:
        super().__init__(code, safe_message, status="rejected", safe_result=safe_result)


class CommunicationsError(CommandBusError):
    def __init__(self, code: str, safe_message: str, *, safe_result: dict | None = None) -> None:
        super().__init__(code, safe_message, status="rejected", safe_result=safe_result)


class ReplayDetectedError(CommandBusError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, status="rejected")


class ReplayCapacityError(CommandBusError):
    def __init__(self) -> None:
        super().__init__(
            "REPLAY_STORE_CAPACITY",
            "Replay protection is temporarily unavailable",
            status="failed",
        )


class AuditUnavailableError(CommandBusError):
    def __init__(self) -> None:
        super().__init__(
            "AUDIT_UNAVAILABLE",
            "Required audit journal is unavailable",
            status="failed",
        )


class AuditCapacityError(CommandBusError):
    def __init__(self) -> None:
        super().__init__(
            "AUDIT_CAPACITY_EXHAUSTED",
            "Required audit journal capacity is exhausted",
            status="failed",
        )


class AuditEventTooLargeError(CommandBusError):
    def __init__(self) -> None:
        super().__init__(
            "AUDIT_EVENT_TOO_LARGE",
            "Audit event exceeds the configured size limit",
            status="failed",
        )


class TransportCapacityError(CommandBusError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, status="failed")


class RoutingError(CommandBusError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, status="failed")


class ConfigurationError(CommandBusError):
    def __init__(self, safe_message: str = "Command bridge configuration is invalid") -> None:
        super().__init__("CONFIGURATION_ERROR", safe_message, status="failed")
