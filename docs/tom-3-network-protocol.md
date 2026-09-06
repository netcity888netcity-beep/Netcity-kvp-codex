# Том 3 — сетевой протокол KVP

**Статус: принятая спецификация для M1; реализация транспорта ещё не начата.**

## Назначение

KVP — защищённая плоскость управления NetCityOS. Он передаёт
административные команды, статусы и доказательства между оператором, KVP и
адаптерами. KVP не является блокчейном, P2P-overlay, транспортом inference
трафика или кошельковым протоколом.

Из этого следуют явные границы v1:

- нет блоков, транзакционного mempool, консенсуса или Proof-of-Stake;
- нет Kademlia DHT, gossip, seed-нод и DNS discovery;
- нет Fast, Full или Light Sync блокчейн-состояния;
- не используется собственная криптография поверх TLS.

Такие возможности могут быть предложены отдельным продуктовым направлением,
но не должны неявно добавляться в KVP control plane.

## Транспорт

Production RPC использует gRPC поверх TLS 1.3 с обязательной взаимной
аутентификацией сертификатами (mTLS). Сервер принимает запрос только после
проверки цепочки сертификатов, срока действия и отображения удостоверенной
идентичности в зарегистрированный principal.

- `OpenSessionRequest.client_id` — только assertion для сверки, а не источник
  идентичности;
- сессия связана с principal и данными сертификата;
- режим plaintext в production-сборке отсутствует;
- development-транспорт допускается только как отдельная compile-time feature
  и только на loopback;
- QUIC не входит в M1. Его добавление требует отдельного ADR и эквивалентных
  mTLS, лимитов и наблюдаемости.

## Wire contract

Единственный публичный контракт v1 —
`proto/netcity/kvp/v1/control.proto`, пакет `netcity.kvp.v1`.

Он определяет `OpenSession`, `ExecuteCommand`, `GetCommand` и `GetStatus`.
Контракт использует protobuf v3, typed `oneof` payload и стабильные коды
ошибок. Успешный M1 обязан генерировать Rust-типы из этой схемы в CI;
проверка только синтаксиса `.proto` недостаточна.

## Защита сети

До декодирования и любой работы с адаптером edge применяет:

1. mTLS и certificate-to-principal mapping;
2. ограничение числа соединений на peer/principal;
3. ограничение размера сообщения и глубины очереди;
4. server и client deadlines;
5. rate limiting на principal и метод;
6. журналирование отказов без токенов, payload или закрытого ключа.

Блокировка и отзыв выполняются на уровне certificate/principal registry. Это
не blockchain Sybil-защита: её место занимают управляемые trust roots,
регистрация identity и отзыв сертификатов.

## Версионирование и совместимость

- major version содержится в protobuf package и URL service namespace;
- новые поля только добавляются; удалённые номера резервируются;
- изменение семантики требует ADR, migration note и compatibility test;
- `compatibility_matrix.md` фиксирует поддерживаемые server/client/adapter
  версии до выпуска публичных SDK.

## M1: минимально проверяемая реализация

M1 завершается только когда существуют:

- сгенерированный protobuf crate и gRPC server;
- TLS 1.3/mTLS configuration без plaintext fallback;
- certificate-to-principal registry и привязка session к peer identity;
- лимиты сообщения, deadlines и rate limit;
- integration tests, доказывающие отказ unknown, mismatched, expired и revoked
  identities.

Надёжная доставка команд, durable idempotency и adapter dispatch относятся к
M2 и не должны маскироваться как готовая сетевая реализация.
