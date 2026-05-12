// Market Data Generator and Manager
const DataGenerator = {
    // Base prices for different pairs
    basePrices: {
        // Major Forex
        'EUR/USD': 1.0850,
        'GBP/USD': 1.2650,
        'USD/JPY': 149.50,
        'AUD/USD': 0.6520,
        'USD/CAD': 1.3620,
        'EUR/GBP': 0.8580,
        'NZD/USD': 0.5985,
        'USD/CHF': 0.8835,
        // Crypto
        'BTC/USD': 67500,
        'ETH/USD': 3450,
        'LTC/USD': 84.50,
        'XRP/USD': 0.5250,
        // OTC pairs
        'EUR/USD OTC': 1.0872,
        'GBP/USD OTC': 1.2688,
        'USD/JPY OTC': 149.82,
        'AUD/USD OTC': 0.6544,
        'USD/CAD OTC': 1.3608,
        'EUR/GBP OTC': 0.8576,
        'GBP/JPY OTC': 189.95,
        'EUR/JPY OTC': 162.86,
        'NZD/USD OTC': 0.5982,
        'USD/CHF OTC': 0.8834,
        'BTC/USD OTC': 67850,
        'ETH/USD OTC': 3480,
        'AUD/CAD OTC': 0.8892,
        'CAD/JPY OTC': 110.12,
        'NZD/JPY OTC': 89.54,
        'GBP/AUD OTC': 1.9425,
        'EUR/AUD OTC': 1.6642,
        'AUD/NZD OTC': 1.0895
    },

    // Volatility for different pairs
    volatility: {
        // Major Forex
        'EUR/USD': 0.0005,
        'GBP/USD': 0.0007,
        'USD/JPY': 0.07,
        'AUD/USD': 0.0004,
        'USD/CAD': 0.0005,
        'EUR/GBP': 0.0004,
        'NZD/USD': 0.00045,
        'USD/CHF': 0.00042,
        // Crypto
        'BTC/USD': 150,
        'ETH/USD': 25,
        'LTC/USD': 0.85,
        'XRP/USD': 0.0052,
        // OTC pairs (slightly different volatility)
        'EUR/USD OTC': 0.00045,
        'GBP/USD OTC': 0.00065,
        'USD/JPY OTC': 0.065,
        'AUD/USD OTC': 0.00038,
        'USD/CAD OTC': 0.00048,
        'EUR/GBP OTC': 0.00038,
        'GBP/JPY OTC': 0.09,
        'EUR/JPY OTC': 0.065,
        'NZD/USD OTC': 0.00042,
        'USD/CHF OTC': 0.00044,
        'BTC/USD OTC': 140,
        'ETH/USD OTC': 22,
        'AUD/CAD OTC': 0.00041,
        'CAD/JPY OTC': 0.068,
        'NZD/JPY OTC': 0.062,
        'GBP/AUD OTC': 0.00082,
        'EUR/AUD OTC': 0.00075,
        'AUD/NZD OTC': 0.00038
    },

    // Check if pair is OTC
    isOTC(pair) {
        return pair.includes(' OTC');
    },

    // Get the base pair name without OTC
    getBasePair(pair) {
        return pair.replace(' OTC', '');
    },

    // Generate initial historical data
    generateCandles(pair, timeframe, count = 300) {
        const basePrice = this.basePrices[pair] || 1.0;
        const vol = this.volatility[pair] || 0.001;
        const isOtc = this.isOTC(pair);
        const tfMs = timeframe * 60 * 1000;
        const candles = [];

        let price = basePrice;
        const now = Date.now();
        const startTime = now - count * tfMs;

        // OTC uses deterministic seed for more predictable patterns
        let seed = 0;
        for (let i = 0; i < pair.length; i++) seed += pair.charCodeAt(i);
        const seededRandom = () => {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        // Use a seeded trend to make realistic data
        let trend = 0;
        let trendDuration = 0;

        for (let i = 0; i < count; i++) {
            // Change trend occasionally
            trendDuration--;
            if (trendDuration <= 0) {
                const rnd = isOtc ? seededRandom() : Math.random();
                trend = (rnd - 0.5) * vol * 0.3;
                trendDuration = Math.floor((isOtc ? seededRandom() : Math.random()) * 30) + 5;
            }

            const open = price;
            const rnd1 = isOtc ? seededRandom() : Math.random();
            const rnd2 = isOtc ? seededRandom() : Math.random();
            const change1 = (rnd1 - 0.48 + trend / vol) * vol;
            const change2 = (rnd2 - 0.48 + trend / vol) * vol;
            const close = open + change1;
            const high = Math.max(open, close) + Math.abs(change2) * 0.5;
            const low = Math.min(open, close) - Math.abs(change2) * 0.5;

            // Generate volume
            const baseVolume = isOtc ? 800 : 1200;
            const volume = Math.floor(baseVolume + Math.random() * baseVolume * 2);

            candles.push({
                time: Math.floor((startTime + i * tfMs) / 1000),
                open: Math.round(open * 100000) / 100000,
                high: Math.round(high * 100000) / 100000,
                low: Math.round(low * 100000) / 100000,
                close: Math.round(close * 100000) / 100000,
                volume: volume
            });

            price = close;
        }

        return candles;
    },

    // Generate next candle (for real-time simulation)
    generateNextCandle(lastCandle, pair, timeframe) {
        const vol = this.volatility[pair] || 0.001;
        const open = lastCandle.close;
        const change = (Math.random() - 0.48) * vol;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * vol * 0.5;
        const low = Math.min(open, close) - Math.random() * vol * 0.5;
        const tfMs = timeframe * 60 * 1000;
        const isOtc = this.isOTC(pair);
        const baseVolume = isOtc ? 800 : 1200;

        return {
            time: lastCandle.time + Math.floor(tfMs / 1000),
            open: Math.round(open * 100000) / 100000,
            high: Math.round(high * 100000) / 100000,
            low: Math.round(low * 100000) / 100000,
            close: Math.round(close * 100000) / 100000,
            volume: Math.floor(baseVolume + Math.random() * baseVolume * 2)
        };
    },

    // Tick-by-tick price update for current candle
    updateCurrentPrice(currentCandle, pair) {
        const vol = this.volatility[pair] || 0.001;
        const tick = (Math.random() - 0.5) * vol * 0.1;
        currentCandle.close = Math.round((currentCandle.close + tick) * 100000) / 100000;
        currentCandle.high = Math.max(currentCandle.high, currentCandle.close);
        currentCandle.low = Math.min(currentCandle.low, currentCandle.close);
        // Update volume with tick
        if (currentCandle.volume !== undefined) {
            currentCandle.volume += Math.floor(Math.random() * 10);
        }
        return currentCandle;
    },

    // Format price based on pair
    formatPrice(price, pair) {
        const base = this.getBasePair(pair);
        if (base === 'BTC/USD') return price.toFixed(0);
        if (base === 'ETH/USD') return price.toFixed(1);
        if (base === 'LTC/USD') return price.toFixed(2);
        if (base === 'XRP/USD') return price.toFixed(4);
        if (base === 'USD/JPY' || base === 'GBP/JPY' || base === 'EUR/JPY' || 
            base === 'CAD/JPY' || base === 'NZD/JPY') return price.toFixed(3);
        return price.toFixed(5);
    },

    // Get price precision for pair
    getPrecision(pair) {
        const base = this.getBasePair(pair);
        if (base === 'BTC/USD') return 0;
        if (base === 'ETH/USD') return 1;
        if (base === 'LTC/USD') return 2;
        if (base === 'XRP/USD') return 4;
        if (base === 'USD/JPY' || base === 'GBP/JPY' || base === 'EUR/JPY' || 
            base === 'CAD/JPY' || base === 'NZD/JPY') return 3;
        return 5;
    }
};
