// Pocket Option Telegram Bot
const TelegramBot = require('node-telegram-bot-api');
const WebSocket = require('ws');

// Configuration
const TELEGRAM_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN'; // Замени на свой токен
const PO_SSID = 'YOUR_PO_SSID_TOKEN'; // Замени на свой SSID токен
const PO_ACCOUNT_TYPE = 'demo'; // 'demo' или 'real'

// Initialize bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Trading state
let isTrading = false;
let poWebSocket = null;
let currentBalance = 0;
let tradeLog = [];

console.log('🤖 Telegram бот запущен!');

// ============== Telegram Commands ==============

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
👋 Привет! Я бот для торговли на Pocket Option

📊 *Доступные команды:*
/start - Запустить бота
/stop - Остановить бота
/status - Статус торговли
/balance - Проверить баланс
/trade <CALL|PUT> <сумма> - Открыть сделку
/settings - Настройки торговли
/help - Помощь

🔧 *Для начала работы:*
1. Получи SSID токен из Pocket Option
2. Вставь его в файл telegram-bot.js
3. Запусти бота: node telegram-bot.js
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const statusMessage = `
📊 *Статус бота:*
${isTrading ? '✅ Торговля активна' : '❌ Торговля остановлена'}

💰 *Баланс:* $${currentBalance.toFixed(2)}
📈 *Сделок сегодня:* ${tradeLog.length}

🔌 *Pocket Option:* ${poWebSocket && poWebSocket.readyState === WebSocket.OPEN ? '✅ Подключено' : '❌ Отключено'}
    `;
    
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `💰 Баланс: *$${currentBalance.toFixed(2)}*`, { parse_mode: 'Markdown' });
});

bot.onText(/\/trade\s+(CALL|PUT)\s+(\d+(\.\d+)?)/, (msg, match) => {
    const chatId = msg.chat.id;
    const direction = match[1];
    const amount = parseFloat(match[2]);
    
    if (!poWebSocket || poWebSocket.readyState !== WebSocket.OPEN) {
        bot.sendMessage(chatId, '❌ Сначала подключись к Pocket Option!');
        return;
    }
    
    executeTrade(direction, amount, chatId);
});

bot.onText(/\/settings/, (msg) => {
    const chatId = msg.chat.id;
    const settingsMessage = `
⚙️ *Настройки торговли:*

Чтобы изменить настройки, отредактируй файл telegram-bot.js:

📍 *SSID токен:* Строка подключения к PO
📍 *Тип счёта:* demo или real
📍 *Макс. ставка:* Лимит на сделку
📍 *Стоп-лосс:* Дневной лимит убытка
📍 *Тейк-профит:* Дневная цель прибыли
    `;
    
    bot.sendMessage(chatId, settingsMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
📖 *Помощь по командам:*

/start - Запуск бота
/stop - Остановка торговли
/status - Текущий статус
/balance - Проверка баланса
/trade CALL 10 - Открыть сделку CALL на $10
/trade PUT 5 - Открыть сделку PUT на $5
/settings - Настройки
/help - Эта справка

⚠️ *Важно:*
• Торгуй только на демо сначала!
• Не рискуй больше чем можешь потерять
• Устанавливай стоп-лосс
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    isTrading = false;
    bot.sendMessage(chatId, '⏹️ Торговля остановлена');
});

// ============== Pocket Option Connection ==============

function connectToPocketOption() {
    console.log('🔌 Подключение к Pocket Option...');
    
    const wsUrl = `wss://demo-po.pocketoption.com/websocket/?EIO=4&transport=websocket`;
    
    poWebSocket = new WebSocket(wsUrl);
    
    poWebSocket.on('open', () => {
        console.log('✅ WebSocket подключён');
        
        // Send auth
        setTimeout(() => {
            poWebSocket.send(`42["auth",{"ssid":"${PO_SSID}"}]`);
            console.log('🔑 Отправлена авторизация');
        }, 1000);
    });
    
    poWebSocket.on('message', (data) => {
        const message = data.toString();
        
        // Handle ping
        if (message === '2') {
            poWebSocket.send('3');
            return;
        }
        
        // Handle auth response
        if (message.includes('auth')) {
            try {
                const jsonStr = message.substring(2);
                const parsed = JSON.parse(jsonStr);
                
                if (parsed[1] && parsed[1].balance) {
                    currentBalance = parsed[1].balance;
                    console.log(`💰 Баланс: $${currentBalance}`);
                }
            } catch (e) {
                // Not JSON
            }
        }
        
        console.log('📨 Получено:', message.substring(0, 100));
    });
    
    poWebSocket.on('close', () => {
        console.log('❌ WebSocket отключён');
        poWebSocket = null;
        
        // Reconnect after 5 seconds
        setTimeout(connectToPocketOption, 5000);
    });
    
    poWebSocket.on('error', (error) => {
        console.error('❌ Ошибка WebSocket:', error.message);
    });
}

// ============== Trade Execution ==============

function executeTrade(direction, amount, chatId) {
    if (!poWebSocket || poWebSocket.readyState !== WebSocket.OPEN) {
        bot.sendMessage(chatId, '❌ Нет подключения к Pocket Option!');
        return;
    }
    
    const tradeData = {
        command: 'buy',
        direction: direction.toLowerCase(),
        amount: amount,
        asset: 'EURUSD',
        expiry: 60 // 1 minute
    };
    
    // Send trade command
    poWebSocket.send(`42["orders/open",${JSON.stringify(tradeData)}]`);
    
    const message = `
📊 *Сделка открыта!*

${direction === 'CALL' ? '📈' : '📉'} *${direction}*
💰 Сумма: *$${amount}*
⏱️ Экспирация: 1 минута
    `;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    tradeLog.push({
        direction,
        amount,
        time: new Date().toISOString(),
        status: 'open'
    });
}

// ============== Start Bot ==============

// Connect to Pocket Option
connectToPocketOption();

console.log('🤖 Бот готов к работе! Отправь /start в Telegram');
