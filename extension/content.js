// Content Script - работает внутри страницы Pocket Option
console.log('🤖 Pocket Option Auto Trader загружен!');

// Глобальные переменные
let isTrading = false;
let tradeConfig = {
    amount: 1,
    expiry: 5,
    minConfidence: 70,
    direction: 'both' // both, call, put
};

// Слушаем сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start') {
        isTrading = true;
        tradeConfig = request.config || tradeConfig;
        console.log('✅ Автоторговля запущена:', tradeConfig);
        sendResponse({ status: 'started' });
    } else if (request.action === 'stop') {
        isTrading = false;
        console.log('⏹ Автоторговля остановлена');
        sendResponse({ status: 'stopped' });
    } else if (request.action === 'trade') {
        executeTrade(request.direction, request.amount, request.expiry);
        sendResponse({ status: 'executed' });
    }
});

// Функция открытия сделки
function executeTrade(direction, amount, expiry) {
    console.log(`📊 Открываю сделку: ${direction} $${amount} ${expiry}мин`);
    
    try {
        // Ждём загрузку страницы
        const waitForElement = (selector, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const check = () => {
                    const el = document.querySelector(selector);
                    if (el) resolve(el);
                    else if (Date.now() - start > timeout) reject(new Error('Timeout'));
                    else setTimeout(check, 100);
                };
                check();
            });
        };

        // Находим и кликаем кнопки
        async function placeTrade() {
            // Находим поле суммы
            const allInputs = document.querySelectorAll('input');
            let amountInput = null;
            
            for (let input of allInputs) {
                if (input.value && (input.value.includes('$') || parseFloat(input.value) > 0)) {
                    amountInput = input;
                    break;
                }
            }
            
            if (amountInput) {
                console.log('Нашёл поле суммы');
                amountInput.focus();
                amountInput.select();
                document.execCommand('insertText', false, amount.toString());
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            // Находим кнопки CALL/PUT
            const allButtons = document.querySelectorAll('button, a, div[role="button"]');
            let callBtn = null;
            let putBtn = null;
            
            for (let btn of allButtons) {
                const text = btn.textContent.toLowerCase();
                if ((text.includes('higher') || text.includes('call') || text.includes('вверх')) && !callBtn) {
                    callBtn = btn;
                }
                if ((text.includes('lower') || text.includes('put') || text.includes('вниз')) && !putBtn) {
                    putBtn = btn;
                }
            }
            
            await new Promise(r => setTimeout(r, 300));
            
            if (direction === 'call' && callBtn) {
                console.log('Кликаю CALL');
                callBtn.click();
            } else if (direction === 'put' && putBtn) {
                console.log('Кликаю PUT');
                putBtn.click();
            }
        }
        
        placeTrade();
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// Наблюдаем за сигналами от анализатора
window.addEventListener('message', (event) => {
    if (!isTrading) return;
    
    if (event.data && event.data.type === 'TRADE_SIGNAL') {
        const { direction, confidence, amount, expiry } = event.data;
        
        console.log(`📨 Получен сигнал: ${direction} (${confidence}%)`);
        
        if (confidence < tradeConfig.minConfidence) {
            console.log(`⏸ Пропущен (конфиденция ${confidence}% < ${tradeConfig.minConfidence}%)`);
            return;
        }
        
        if (tradeConfig.direction !== 'both' && tradeConfig.direction !== direction) {
            console.log(`⏸ Пропущен (направление ${direction} не разрешено)`);
            return;
        }
        
        executeTrade(direction, amount || tradeConfig.amount, expiry || tradeConfig.expiry);
    }
});

// Сообщаем что скрипт загружен
window.postMessage({ type: 'AUTO_TRADER_READY' }, '*');
console.log('✅ Auto Trader готов к работе!');
