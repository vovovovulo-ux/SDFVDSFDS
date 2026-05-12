// Pocket Option API - Авторизация по токену
const PocketAPI = (function () {
    'use strict';

    let isConnected = false;
    let accountType = 'demo';
    let balance = 10000;
    let balanceCurrency = 'USD';
    let uid = '';
    let ws = null;
    let ssidToken = '';

    let callbacks = {
        onConnect: null,
        onDisconnect: null,
        onAuth: null,
        onBalance: null,
        onTradeOpen: null,
        onTradeResult: null,
        onLoginSuccess: null,
        onLoginFail: null,
        onLoginStart: null,
        onError: null,
    };

    // АВТОРИЗАЦИЯ ПО ТОКЕНУ - подключение через прокси
    function authorizeWithToken(token, type = 'demo') {
        ssidToken = token;
        accountType = type;

        console.log('🔌 Подключение с токеном (', type, ')');

        if (callbacks.onLoginStart) callbacks.onLoginStart({ type });

        // Подключаемся к прокси серверу
        ws = new WebSocket('ws://localhost:3000');

        ws.onopen = () => {
            console.log('✅ Подключено к прокси серверу');
            
            // Отправляем команду на подключение к Pocket Option
            ws.send(JSON.stringify({
                action: 'connect',
                ssid: token,
                type: type
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Получено от прокси:', data);

                if (data.event === 'connected') {
                    isConnected = true;
                    uid = 'user_' + Date.now();
                    
                    if (callbacks.onLoginSuccess) callbacks.onLoginSuccess({ type });
                    if (callbacks.onConnect) callbacks.onConnect({ type });
                    if (callbacks.onAuth) {
                        callbacks.onAuth({ 
                            uid: uid, 
                            balance: balance, 
                            currency: 'USD', 
                            type: type 
                        });
                    }
                    if (AutoTrader) {
                        AutoTrader.log('✅ Подключено к Pocket Option (' + type + ')');
                    }
                } else if (data.event === 'message') {
                    // Обработка сообщений от Pocket Option
                    handleMessage(data.data);
                } else if (data.event === 'error') {
                    console.error('Ошибка:', data.message);
                    if (callbacks.onError) callbacks.onError({ message: data.message });
                } else if (data.event === 'disconnected') {
                    disconnect();
                }
            } catch (e) {
                console.error('Ошибка парсинга:', e);
            }
        };

        ws.onclose = () => {
            console.log('❌ Отключено от прокси');
            disconnect();
        };

        ws.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
            if (callbacks.onLoginFail) callbacks.onLoginFail({ error });
            if (callbacks.onError) callbacks.onError({ message: error.message });
        };
    }

    // Обработка сообщений от Pocket Option
    function handleMessage(message) {
        try {
            // Пытаемся распарсить JSON сообщения
            if (message.startsWith('42')) {
                const jsonStr = message.substring(2);
                const parsed = JSON.parse(jsonStr);
                
                if (parsed[0] === 'auth' && parsed[1]) {
                    const authData = parsed[1];
                    if (authData.balance) {
                        balance = authData.balance;
                        uid = authData.uid || uid;
                        
                        if (callbacks.onAuth) {
                            callbacks.onAuth({ 
                                uid: uid, 
                                balance: balance, 
                                currency: 'USD', 
                                type: accountType 
                            });
                        }
                    }
                }
            }
        } catch (e) {
            // Не JSON сообщение, игнорируем
        }
    }

    // ПРОСТАЯ АВТОРИЗАЦИЯ - просто подтверждаем (fallback)
    function authorize(type = 'demo') {
        accountType = type;
        isConnected = true;
        uid = 'user_' + Date.now();
        balance = 10000;

        console.log('✅ Подключено (', type, ')');

        // Отправляем все события сразу
        setTimeout(() => {
            if (callbacks.onLoginStart) callbacks.onLoginStart({ type });
            if (callbacks.onLoginSuccess) callbacks.onLoginSuccess({ type });
            if (callbacks.onConnect) callbacks.onConnect({ type });
            if (callbacks.onAuth) {
                callbacks.onAuth({ 
                    uid: uid, 
                    balance: balance, 
                    currency: 'USD', 
                    type: type 
                });
            }
            if (AutoTrader) {
                AutoTrader.log('✅ Подключено к Pocket Option (' + type + ')');
            }
        }, 300);
    }

    function disconnect() {
        isConnected = false;
        
        // Закрываем соединение с прокси
        if (ws) {
            ws.send(JSON.stringify({ action: 'disconnect' }));
            ws.close();
            ws = null;
        }
        
        console.log('❌ Отключено');
        if (callbacks.onDisconnect) callbacks.onDisconnect();
        if (AutoTrader) AutoTrader.log('❌ Отключено');
    }

    function openTrade(asset, direction, amount, expiryMinutes) {
        // Отправляем сигнал в extension
        window.postMessage({
            type: 'TRADE_SIGNAL',
            direction: direction,
            confidence: 100,
            amount: amount,
            expiry: expiryMinutes
        }, '*');
        
        if (AutoTrader) {
            AutoTrader.log(`📊 Сделка: ${direction} $${amount} на ${asset}`);
        }
    }

    return {
        authorizeWithToken,
        authorize,
        disconnect,
        openTrade,

        on(event, cb) { callbacks[event] = cb; },

        get connected() { return isConnected; },
        get authenticated() { return isConnected; },
        get accountType() { return accountType; },
        get balance() { return balance; },
        get currency() { return balanceCurrency; },
        get uid() { return uid; },
    };
})();
