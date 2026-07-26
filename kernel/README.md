# /kernel — Священный Кошелёк KVP

## API Documentation v0.3

### create_wallet()
Генерирует новую пару ключей ECDSA (secp256k1).
Создаёт адрес через SHA-256 + RIPEMD-160.
Сохраняет в wallets.json и ledger.json.
Возвращает: строку адреса.

### get_balance(address)
Принимает адрес кошелька.
Возвращает: текущий баланс (float).

### transfer(sender_private_key_hex, receiver_address, amount)
Подписывает транзакцию приватным ключом отправителя.
Проверяет баланс и валидность адресов.
Обновляет ledger.json.
Логирует в transactions.log.
Возвращает: True при успехе.
Выбрасывает: ValueError при недостатке средств или невалидном адресе.

### is_valid_address(address)
Проверяет существование адреса в реестре.
Возвращает: bool.

### list_addresses()
Возвращает: список всех адресов.

### total_supply()
Возвращает: сумму всех балансов (float).

### export_csv(filename)
Экспортирует реестр в CSV-файл.

## Формат wallets.json
{
  "0x...": "hex_private_key",
  ...
}

## Формат ledger.json
{
  "0x...": 100.0,
  ...
}

## Формат transactions.log (CSV)
timestamp,type,sender,receiver,amount,status

---
v0.3 · Soul 5/6 · Маяк: netcity888netcity@gmail.com
