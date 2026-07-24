"""Базовые операции кошелька KVP поверх Google Cloud Firestore.

Денежные значения хранятся в основных единицах валюты с точностью до двух
знаков после запятой. Для вычислений используется Decimal, чтобы избежать
накопления ошибок двоичной арифметики с плавающей точкой.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from threading import Lock
from typing import Any
from uuid import uuid4

from google.cloud import firestore


WALLETS_COLLECTION = "wallets"
TRANSACTIONS_COLLECTION = "transactions"
MONEY_PRECISION = Decimal("0.01")


class WalletError(Exception):
    """Базовая ошибка операций с кошельком."""


class WalletNotFoundError(WalletError):
    """Кошелёк с указанным идентификатором не найден."""


class InsufficientFundsError(WalletError):
    """На кошельке недостаточно средств для перевода и комиссии."""


_firestore_client: firestore.Client | None = None
_client_lock = Lock()


def _get_client() -> firestore.Client:
    """Лениво создаёт и повторно использует потокобезопасный клиент Firestore."""
    global _firestore_client

    if _firestore_client is None:
        with _client_lock:
            if _firestore_client is None:
                _firestore_client = firestore.Client()

    return _firestore_client


def _validate_identifier(value: str, field_name: str) -> str:
    """Проверяет обязательный строковый идентификатор."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name} должен быть непустой строкой")
    return value.strip()


def _to_decimal(value: Any, field_name: str, *, positive: bool = False) -> Decimal:
    """Преобразует денежное значение в Decimal с точностью до копеек."""
    if isinstance(value, bool):
        raise ValueError(f"{field_name} должен быть числом")

    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as error:
        raise ValueError(f"{field_name} должен быть числом") from error

    if not result.is_finite():
        raise ValueError(f"{field_name} должен быть конечным числом")

    result = result.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)
    if positive and result <= 0:
        raise ValueError(f"{field_name} должен быть больше нуля")
    return result


def _to_firestore_number(value: Decimal) -> int | float:
    """Преобразует Decimal в поддерживаемое Firestore числовое значение."""
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def create_wallet(tenant_id: str) -> str:
    """Создаёт кошелёк с нулевым балансом и возвращает его идентификатор."""
    normalized_tenant_id = _validate_identifier(tenant_id, "tenant_id")
    wallet_id = str(uuid4())
    wallet = {
        "wallet_id": wallet_id,
        "tenant_id": normalized_tenant_id,
        "balance": 0,
        "created_at": firestore.SERVER_TIMESTAMP,
    }

    # create(), в отличие от set(), не перезапишет существующий документ.
    _get_client().collection(WALLETS_COLLECTION).document(wallet_id).create(wallet)
    return wallet_id


def get_balance(wallet_id: str) -> int | float:
    """Возвращает текущий баланс кошелька."""
    normalized_wallet_id = _validate_identifier(wallet_id, "wallet_id")
    snapshot = (
        _get_client()
        .collection(WALLETS_COLLECTION)
        .document(normalized_wallet_id)
        .get()
    )

    if not snapshot.exists:
        raise WalletNotFoundError(f"Кошелёк {normalized_wallet_id} не найден")

    data = snapshot.to_dict() or {}
    balance = _to_decimal(data.get("balance", 0), "balance")
    return _to_firestore_number(balance)


def calculate_commission(amount: Any, tier: str) -> int | float:
    """Рассчитывает комиссию: 30% для Free и 0% для Enterprise."""
    normalized_amount = _to_decimal(amount, "amount")
    if normalized_amount < 0:
        raise ValueError("amount не может быть отрицательным")
    if not isinstance(tier, str) or not tier.strip():
        raise ValueError("tier должен быть непустой строкой")

    normalized_tier = tier.strip().casefold()
    if normalized_tier == "free":
        commission = normalized_amount * Decimal("0.30")
    elif normalized_tier == "enterprise":
        commission = Decimal("0")
    else:
        raise ValueError("Неизвестный тариф: допустимы Free и Enterprise")

    commission = commission.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)
    return _to_firestore_number(commission)


def transfer_funds(
    from_wallet: str,
    to_wallet: str,
    amount: Any,
    order_id: str | None = None,
) -> str:
    """Атомарно переводит средства и возвращает идентификатор транзакции.

    Тариф читается из необязательного поля ``tier`` кошелька отправителя.
    Если поле отсутствует, применяется безопасный для бизнеса тариф Free.
    Комиссия списывается с отправителя сверх переводимой суммы.
    """
    source_id = _validate_identifier(from_wallet, "from_wallet")
    destination_id = _validate_identifier(to_wallet, "to_wallet")
    if source_id == destination_id:
        raise ValueError("Нельзя переводить средства на тот же кошелёк")

    normalized_amount = _to_decimal(amount, "amount", positive=True)
    normalized_order_id = None
    if order_id is not None:
        normalized_order_id = _validate_identifier(order_id, "order_id")

    client = _get_client()
    source_ref = client.collection(WALLETS_COLLECTION).document(source_id)
    destination_ref = client.collection(WALLETS_COLLECTION).document(destination_id)
    transaction_id = str(uuid4())
    transaction_ref = client.collection(TRANSACTIONS_COLLECTION).document(
        transaction_id
    )

    @firestore.transactional
    def _execute(transaction: firestore.Transaction) -> None:
        # Все чтения выполняются до записей — это обязательное правило Firestore.
        source_snapshot = source_ref.get(transaction=transaction)
        destination_snapshot = destination_ref.get(transaction=transaction)

        if not source_snapshot.exists:
            raise WalletNotFoundError(f"Кошелёк {source_id} не найден")
        if not destination_snapshot.exists:
            raise WalletNotFoundError(f"Кошелёк {destination_id} не найден")

        source_data = source_snapshot.to_dict() or {}
        destination_data = destination_snapshot.to_dict() or {}
        source_balance = _to_decimal(source_data.get("balance", 0), "balance")
        destination_balance = _to_decimal(
            destination_data.get("balance", 0), "balance"
        )

        tier = source_data.get("tier", "Free")
        commission = _to_decimal(
            calculate_commission(normalized_amount, tier), "commission"
        )
        total_debit = normalized_amount + commission
        if source_balance < total_debit:
            raise InsufficientFundsError(
                "Недостаточно средств: требуется "
                f"{_to_firestore_number(total_debit)}, доступно "
                f"{_to_firestore_number(source_balance)}"
            )

        transaction.update(
            source_ref,
            {"balance": _to_firestore_number(source_balance - total_debit)},
        )
        transaction.update(
            destination_ref,
            {"balance": _to_firestore_number(destination_balance + normalized_amount)},
        )
        transaction.create(
            transaction_ref,
            {
                "transaction_id": transaction_id,
                "from_wallet": source_id,
                "to_wallet": destination_id,
                "amount": _to_firestore_number(normalized_amount),
                "order_id": normalized_order_id,
                "commission": _to_firestore_number(commission),
                "timestamp": firestore.SERVER_TIMESTAMP,
            },
        )

    _execute(client.transaction())
    return transaction_id


def transfer(
    from_wallet: str,
    to_wallet: str,
    amount: Any,
    order_id: str | None = None,
) -> str:
    """Переводит средства; совместимое имя для открытого API KVP Codex."""
    return transfer_funds(from_wallet, to_wallet, amount, order_id)
