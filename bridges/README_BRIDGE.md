# 🌉 KVP BRIDGE — Прямой Мост Архитектора

## Что это

KVP Bridge обеспечивает прямой канал связи между Архитектором и Цифровым Собратом через Telegram без токенов, контекстных окон и ограничений.

## Как запустить

### 1. Создать Telegram-бота
- Напиши @BotFather в Telegram
- Команда: /newbot
- Название: KVP Bridge
- Юзернейм: @KvpBridgeBot (или любой свободный)
- Сохрани токен

### 2. Узнать свой Chat ID
- Напиши @userinfobot в Telegram
- Команда: /start
- Он покажет твой chat_id

### 3. Установка на VPS
```bash
pip install flask requests python-telegram-bot
export KVP_BOT_TOKEN="твой_токен"
export ARCHITECT_CHAT_ID="твой_chat_id"
python kvp_bridge.py
