// Auto-Trading Engine
const AutoTrader = (function () {
    'use strict';

    // Safety Settings
    let config = {
        enabled: false,
        mode: 'demo',          // 'demo' or 'real'
        minConfidence: 70,     // Minimum signal confidence to trade (%)
        tradeAmount: 1,        // Trade amount in USD
        maxTradeAmount: 50,    // Maximum trade amount
        expiryMinutes: 5,      // Default expiry time in minutes
        maxConcurrentTrades: 3,// Max simultaneous open trades
        maxDailyTrades: 50,    // Max trades per day
        maxDailyLoss: 20,      // Max daily loss in USD (stop trading)
        takeProfit: 50,        // Daily take profit in USD
        martingale: false,     // Enable martingale on loss
        martingaleMultiplier: 2,// Martingale multiplier
        cooldownSeconds: 30,   // Cooldown between trades
        tradeDirection: 'both', // 'call', 'put', or 'both'
    };

    // Trading State
    let state = {
        dailyTrades: 0,
        dailyWins: 0,
        dailyLosses: 0,
        dailyProfit: 0,
        dailyLoss: 0,
        openTrades: [],
        closedTrades: [],
        lastTradeTime: 0,
        lastTradeDirection: null,
        lastTradeAmount: 0,
        lastTradeResult: null,
        isTrading: false,
        totalProfit: 0,
        winRate: 0,
        consecutiveLosses: 0,
    };

    // Callbacks
    let callbacks = {
        onTrade: null,
        onTradeResult: null,
        onStatsUpdate: null,
        onSafetyStop: null,
        onLog: null,
    };

    // ============== Core Trading Logic ==============

    // Process a new signal from the analyzer
    function processSignal(signal) {
        if (!config.enabled || !PocketAPI.authenticated) return;
        if (!state.isTrading) return;

        const { direction, confidence } = signal;

        // Check all safety conditions
        if (!_canTrade(direction, confidence)) return;

        // Determine trade direction
        let tradeDirection = null;
        if (direction === 'buy') tradeDirection = 'call';
        else if (direction === 'sell') tradeDirection = 'put';

        // Check direction filter
        if (config.tradeDirection !== 'both' && config.tradeDirection !== tradeDirection) {
            _log(`Направление ${tradeDirection} отфильтровано (фильтр: ${config.tradeDirection})`);
            return;
        }

        // Calculate trade amount
        let amount = _calculateAmount();

        // Execute trade
        _executeTrade(signal.asset || _getCurrentAsset(), tradeDirection, amount, signal);
    }

    // Check if we can place a trade
    function _canTrade(direction, confidence) {
        // Check if confidence meets minimum
        if (confidence < config.minConfidence) {
            _log(`Конфидентность ${confidence}% ниже минимума ${config.minConfidence}%`);
            return false;
        }

        // Check daily trade limit
        if (state.dailyTrades >= config.maxDailyTrades) {
            _log(`Дневной лимит сделок достигнут (${state.dailyTrades}/${config.maxDailyTrades})`);
            _fireSafetyStop('Дневной лимит сделок');
            return false;
        }

        // Check daily loss limit
        if (state.dailyLoss >= config.maxDailyLoss) {
            _log(`Дневной убыток достиг лимита ($${state.dailyLoss}/$${config.maxDailyLoss})`);
            _fireSafetyStop('Дневной лимит убытка');
            return false;
        }

        // Check take profit
        if (state.dailyProfit >= config.takeProfit) {
            _log(`Дневной тейк-профит достигнут ($${state.dailyProfit}/$${config.takeProfit})`);
            _fireSafetyStop('Тейк-профит достигнут');
            return false;
        }

        // Check concurrent trades
        if (state.openTrades.length >= config.maxConcurrentTrades) {
            _log(`Максимальное количество открытых сделок (${state.openTrades.length}/${config.maxConcurrentTrades})`);
            return false;
        }

        // Check cooldown
        const now = Date.now();
        const timeSinceLastTrade = (now - state.lastTradeTime) / 1000;
        if (timeSinceLastTrade < config.cooldownSeconds) {
            _log(`Кулдаун: ${Math.ceil(config.cooldownSeconds - timeSinceLastTrade)}с до следующей сделки`);
            return false;
        }

        // Check balance
        if (PocketAPI.balance < config.tradeAmount) {
            _log('Недостаточно средств на балансе');
            return false;
        }

        return true;
    }

    // Calculate trade amount (with optional martingale)
    function _calculateAmount() {
        let amount = config.tradeAmount;

        if (config.martingale && state.lastTradeResult === 'lose') {
            amount = Math.min(
                state.lastTradeAmount * config.martingaleMultiplier,
                config.maxTradeAmount
            );
        }

        // Don't exceed max
        amount = Math.min(amount, config.maxTradeAmount);

        // Don't exceed balance
        amount = Math.min(amount, PocketAPI.balance);

        // Round to 1 decimal
        return Math.round(amount * 10) / 10;
    }

    // Execute a trade
    function _executeTrade(asset, direction, amount, signal) {
        const expiry = config.expiryMinutes;

        _log(`ОТКРЫТИЕ СДЕЛКИ: ${direction === 'call' ? 'CALL ▲' : 'PUT ▼'} | ${asset} | $${amount} | ${expiry} мин`);

        const tradeId = PocketAPI.openTrade(asset, direction, amount, expiry);

        const trade = {
            id: tradeId,
            asset,
            direction,
            amount,
            expiry,
            confidence: signal.confidence || 0,
            openTime: Date.now(),
            signal: signal,
        };

        state.openTrades.push(trade);
        state.dailyTrades++;
        state.lastTradeTime = Date.now();
        state.lastTradeDirection = direction;
        state.lastTradeAmount = amount;

        _fire('onTrade', trade);
        _updateStats();

        return tradeId;
    }

    // Handle trade result from API
    function handleTradeResult(result) {
        const idx = state.openTrades.findIndex(t => t.id === result.id);
        if (idx === -1) return;

        const trade = state.openTrades.splice(idx, 1)[0];
        const isWin = result.result === 'win' || result.profit > 0;
        const profit = result.profit || 0;

        const closedTrade = {
            ...trade,
            closeTime: Date.now(),
            result: isWin ? 'win' : 'lose',
            profit: profit,
            openPrice: result.openPrice,
            closePrice: result.closePrice,
        };

        state.closedTrades.push(closedTrade);

        if (isWin) {
            state.dailyWins++;
            state.dailyProfit += profit;
            state.consecutiveLosses = 0;
        } else {
            state.dailyLosses++;
            state.dailyLoss += trade.amount;
            state.consecutiveLosses++;
        }

        state.lastTradeResult = isWin ? 'win' : 'lose';
        state.totalProfit += profit;

        // Calculate win rate
        const total = state.dailyWins + state.dailyLosses;
        state.winRate = total > 0 ? Math.round((state.dailyWins / total) * 100) : 0;

        _log(`РЕЗУЛЬТАТ: ${isWin ? '✅ ВЫИГРЫШ' : '❌ ПРОИГРЫШ'} | Прибыль: $${profit.toFixed(2)} | Винрейт: ${state.winRate}%`);

        _fire('onTradeResult', closedTrade);
        _updateStats();
    }

    // ============== Configuration ==============

    function setConfig(newConfig) {
        config = { ...config, ...newConfig };
        _log('Настройки обновлены');
        _updateStats();
    }

    function getConfig() {
        return { ...config };
    }

    // ============== Control ==============

    function start() {
        if (!PocketAPI.authenticated) {
            _log('Ошибка: не подключены к серверу Pocket Option');
            return false;
        }
        config.enabled = true;
        state.isTrading = true;
        _log(`🤖 Автоторговля ЗАПУЩЕНА (${config.mode === 'demo' ? 'ДЕМО' : 'РЕАЛ'})`);
        _updateStats();
        return true;
    }

    function stop() {
        config.enabled = false;
        state.isTrading = false;
        _log('⏹ Автоторговля ОСТАНОВЛЕНА');
        _updateStats();
    }

    function resetDailyStats() {
        state.dailyTrades = 0;
        state.dailyWins = 0;
        state.dailyLosses = 0;
        state.dailyProfit = 0;
        state.dailyLoss = 0;
        state.consecutiveLosses = 0;
        _log('📊 Дневная статистика сброшена');
        _updateStats();
    }

    // ============== State ==============

    function getState() {
        return { ...state };
    }

    function getStats() {
        return {
            dailyTrades: state.dailyTrades,
            dailyWins: state.dailyWins,
            dailyLosses: state.dailyLosses,
            dailyProfit: state.dailyProfit.toFixed(2),
            dailyLoss: state.dailyLoss.toFixed(2),
            totalProfit: state.totalProfit.toFixed(2),
            winRate: state.winRate,
            openTrades: state.openTrades.length,
            consecutiveLosses: state.consecutiveLosses,
            isTrading: state.isTrading,
            balance: PocketAPI.balance,
        };
    }

    // ============== Helpers ==============

    function _getCurrentAsset() {
        // Convert pair format to Pocket Option asset format
        // e.g. "EUR/USD" -> "EURUSD" or "EUR/USD OTC" -> "EURUSD-OTC"
        const pairSelect = document.getElementById('pairSelect');
        if (!pairSelect) return 'EURUSD';
        let asset = pairSelect.value;
        asset = asset.replace('/', '');
        if (asset.includes('OTC')) {
            asset = asset.replace(' OTC', '-OTC');
        }
        return asset;
    }

    function _log(message) {
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const logEntry = `[${time}] ${message}`;
        _fire('onLog', logEntry);

        // Also add to UI log
        const logEl = document.getElementById('tradeLog');
        if (logEl) {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.textContent = logEntry;
            logEl.insertBefore(div, logEl.firstChild);
            // Keep max 100 entries
            while (logEl.children.length > 100) {
                logEl.removeChild(logEl.lastChild);
            }
        }
    }

    function _fireSafetyStop(reason) {
        stop();
        _fire('onSafetyStop', { reason });
    }

    function _updateStats() {
        _fire('onStatsUpdate', getStats());

        // Update UI stats
        const statsEl = document.getElementById('tradeStats');
        if (statsEl) {
            const stats = getStats();
            document.getElementById('tsTrades').textContent = stats.dailyTrades;
            document.getElementById('tsWins').textContent = stats.dailyWins;
            document.getElementById('tsLosses').textContent = stats.dailyLosses;
            document.getElementById('tsProfit').textContent = `$${stats.totalProfit}`;
            document.getElementById('tsWinRate').textContent = `${stats.winRate}%`;
            document.getElementById('tsOpen').textContent = stats.openTrades;
            document.getElementById('tsBalance').textContent = `$${stats.balance.toFixed(2)}`;

            // Color coding
            const profitEl = document.getElementById('tsProfit');
            profitEl.className = `stat-value ${parseFloat(stats.totalProfit) >= 0 ? 'up' : 'down'}`;
            const wrEl = document.getElementById('tsWinRate');
            wrEl.className = `stat-value ${stats.winRate >= 55 ? 'up' : stats.winRate < 45 ? 'down' : 'neutral-val'}`;
        }

        // Update auto-trade button state
        const btn = document.getElementById('autoTradeBtn');
        if (btn) {
            if (state.isTrading) {
                btn.textContent = '⏹ СТОП';
                btn.className = 'trade-btn stop';
            } else {
                btn.textContent = '▶ СТАРТ';
                btn.className = 'trade-btn start';
            }
        }
    }

    // ============== Event Handlers ==============

    function on(event, callback) {
        callbacks[event] = callback;
    }

    function _fire(event, data) {
        if (callbacks[event]) {
            try {
                callbacks[event](data);
            } catch (e) {
                console.error('AutoTrader callback error:', event, e);
            }
        }
    }

    // ============== Public API ==============

    return {
        // Control
        start,
        stop,
        resetDailyStats,

        // Signal processing
        processSignal,
        handleTradeResult,

        // Config
        setConfig,
        getConfig,

        // State
        getState,
        getStats,

        // Events
        on,

        // Helpers
        log: _log,
    };
})();
