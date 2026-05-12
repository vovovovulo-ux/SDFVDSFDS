// Popup UI логика
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const statusDiv = document.getElementById('status');
    
    // Загружаем настройки
    chrome.storage.local.get(['isTrading', 'config'], (result) => {
        if (result.isTrading) {
            showTradingState(true);
        }
        if (result.config) {
            document.getElementById('amount').value = result.config.amount || 1;
            document.getElementById('expiry').value = result.config.expiry || 5;
            document.getElementById('minConfidence').value = result.config.minConfidence || 70;
            document.getElementById('direction').value = result.config.direction || 'both';
        }
    });
    
    startBtn.addEventListener('click', () => {
        const config = {
            amount: parseInt(document.getElementById('amount').value),
            expiry: parseInt(document.getElementById('expiry').value),
            minConfidence: parseInt(document.getElementById('minConfidence').value),
            direction: document.getElementById('direction').value
        };
        
        // Сохраняем настройки
        chrome.storage.local.set({ isTrading: true, config });
        
        // Отправляем сообщение в content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'start',
                    config: config
                }, (response) => {
                    if (response) {
                        showTradingState(true);
                    }
                });
            }
        });
    });
    
    stopBtn.addEventListener('click', () => {
        chrome.storage.local.set({ isTrading: false });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'stop'
                }, (response) => {
                    if (response) {
                        showTradingState(false);
                    }
                });
            }
        });
    });
    
    function showTradingState(isActive) {
        if (isActive) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            statusDiv.textContent = '✅ Торговля активна';
            statusDiv.style.color = '#00b894';
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            statusDiv.textContent = '⏹ Остановлено';
            statusDiv.style.color = '#e94560';
        }
    }
});
