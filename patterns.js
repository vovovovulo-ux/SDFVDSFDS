// Candlestick Pattern Recognition
const Patterns = {
    // Detect all patterns
    detectAll(candles) {
        const patterns = [];
        if (candles.length < 5) return patterns;

        const last = candles.length - 1;

        // Single candlestick patterns
        const doji = this.doji(candles[last]);
        if (doji) patterns.push({ name: 'Доджи', type: 'neutral', desc: 'Нерешительность рынка' });

        const hammer = this.hammer(candles[last], candles[last - 1]);
        if (hammer === 'bullish') patterns.push({ name: 'Молот', type: 'bullish', desc: 'Бычий разворот' });
        if (hammer === 'bearish') patterns.push({ name: 'Падающая звезда', type: 'bearish', desc: 'Медвежий разворот' });

        const engulfing = this.engulfing(candles[last], candles[last - 1]);
        if (engulfing === 'bullish') patterns.push({ name: 'Бычье поглощение', type: 'bullish', desc: 'Сильный бычий сигнал' });
        if (engulfing === 'bearish') patterns.push({ name: 'Медвежье поглощение', type: 'bearish', desc: 'Сильный медвежий сигнал' });

        // Multi-candle patterns
        const morningStar = this.morningStar(candles[last - 2], candles[last - 1], candles[last]);
        if (morningStar === 'bullish') patterns.push({ name: 'Утренняя звезда', type: 'bullish', desc: 'Бычий разворотный паттерн' });
        if (morningStar === 'bearish') patterns.push({ name: 'Вечерняя звезда', type: 'bearish', desc: 'Медвежий разворотный паттерн' });

        const threeSoldiers = this.threeWhiteSoldiers(candles[last - 2], candles[last - 1], candles[last]);
        if (threeSoldiers === 'bullish') patterns.push({ name: '3 белых солдата', type: 'bullish', desc: 'Сильный восходящий тренд' });
        if (threeSoldiers === 'bearish') patterns.push({ name: '3 чёрные вороны', type: 'bearish', desc: 'Сильный нисходящий тренд' });

        // Support/Resistance
        const sr = this.supportResistance(candles);
        if (sr.nearSupport) patterns.push({ name: 'Уровень поддержки', type: 'bullish', desc: `Поддержка: ${sr.support.toFixed(5)}` });
        if (sr.nearResistance) patterns.push({ name: 'Уровень сопротивления', type: 'bearish', desc: `Сопротивление: ${sr.resistance.toFixed(5)}` });

        // Trend detection
        const trend = this.detectTrend(candles);
        if (trend.direction === 'up') patterns.push({ name: 'Восходящий тренд', type: 'bullish', desc: 'Тренд вверх' });
        if (trend.direction === 'down') patterns.push({ name: 'Нисходящий тренд', type: 'bearish', desc: 'Тренд вниз' });

        return patterns;
    },

    bodySize(c) {
        return Math.abs(c.close - c.open);
    },

    upperWick(c) {
        return c.high - Math.max(c.open, c.close);
    },

    lowerWick(c) {
        return Math.min(c.open, c.close) - c.low;
    },

    isGreen(c) {
        return c.close > c.open;
    },

    isRed(c) {
        return c.close < c.open;
    },

    totalRange(c) {
        return c.high - c.low;
    },

    // Doji: body is very small relative to range
    doji(c) {
        const body = this.bodySize(c);
        const range = this.totalRange(c);
        return range > 0 && body / range < 0.1;
    },

    // Hammer / Shooting Star
    hammer(c, prev) {
        const body = this.bodySize(c);
        const range = this.totalRange(c);
        if (range === 0) return null;

        const lw = this.lowerWick(c);
        const uw = this.upperWick(c);

        // Hammer: long lower wick, small body at top, in downtrend
        if (lw > body * 2 && uw < body && this.isRed(prev) && body / range < 0.3) {
            return 'bullish';
        }

        // Shooting star: long upper wick, small body at bottom, in uptrend
        if (uw > body * 2 && lw < body && this.isGreen(prev) && body / range < 0.3) {
            return 'bearish';
        }

        return null;
    },

    // Engulfing
    engulfing(c, prev) {
        if (this.isGreen(c) && this.isRed(prev)) {
            if (c.open <= prev.close && c.close >= prev.open) {
                return 'bullish';
            }
        }
        if (this.isRed(c) && this.isGreen(prev)) {
            if (c.open >= prev.close && c.close <= prev.open) {
                return 'bearish';
            }
        }
        return null;
    },

    // Morning / Evening Star
    morningStar(c1, c2, c3) {
        const c1Body = this.bodySize(c1);
        const c2Body = this.bodySize(c2);
        const c3Body = this.bodySize(c3);

        // Morning Star: big red, small body, big green
        if (this.isRed(c1) && c2Body < c1Body * 0.3 && this.isGreen(c3) && c3Body > c1Body * 0.5) {
            return 'bullish';
        }

        // Evening Star: big green, small body, big red
        if (this.isGreen(c1) && c2Body < c1Body * 0.3 && this.isRed(c3) && c3Body > c1Body * 0.5) {
            return 'bearish';
        }

        return null;
    },

    // Three White Soldiers / Three Black Crows
    threeWhiteSoldiers(c1, c2, c3) {
        if (this.isGreen(c1) && this.isGreen(c2) && this.isGreen(c3)) {
            if (c2.close > c1.close && c3.close > c2.close) {
                return 'bullish';
            }
        }
        if (this.isRed(c1) && this.isRed(c2) && this.isRed(c3)) {
            if (c2.close < c1.close && c3.close < c2.close) {
                return 'bearish';
            }
        }
        return null;
    },

    // Support and Resistance levels
    supportResistance(candles, lookback = 50) {
        const start = Math.max(0, candles.length - lookback);
        const data = candles.slice(start);
        if (data.length < 5) return { nearSupport: false, nearResistance: false, support: 0, resistance: 0 };

        const currentPrice = data[data.length - 1].close;

        // Find pivot highs and lows
        const pivotHighs = [];
        const pivotLows = [];

        for (let i = 2; i < data.length - 2; i++) {
            if (data[i].high > data[i - 1].high && data[i].high > data[i - 2].high &&
                data[i].high > data[i + 1].high && data[i].high > data[i + 2].high) {
                pivotHighs.push(data[i].high);
            }
            if (data[i].low < data[i - 1].low && data[i].low < data[i - 2].low &&
                data[i].low < data[i + 1].low && data[i].low < data[i + 2].low) {
                pivotLows.push(data[i].low);
            }
        }

        const resistance = pivotHighs.length > 0 ? Math.max(...pivotHighs) : Math.max(...data.map(c => c.high));
        const support = pivotLows.length > 0 ? Math.min(...pivotLows) : Math.min(...data.map(c => c.low));

        const range = resistance - support;
        const threshold = range * 0.02;

        return {
            nearSupport: currentPrice - support < threshold,
            nearResistance: resistance - currentPrice < threshold,
            support,
            resistance
        };
    },

    // Detect trend direction
    detectTrend(candles, period = 20) {
        if (candles.length < period) return { direction: 'neutral', strength: 0 };

        const recent = candles.slice(-period);
        const closes = recent.map(c => c.close);

        // Simple linear regression
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        const n = closes.length;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += closes[i];
            sumXY += i * closes[i];
            sumXX += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const avgPrice = sumY / n;
        const normalizedSlope = slope / avgPrice * 10000;

        if (normalizedSlope > 1) return { direction: 'up', strength: normalizedSlope };
        if (normalizedSlope < -1) return { direction: 'down', strength: Math.abs(normalizedSlope) };
        return { direction: 'neutral', strength: 0 };
    },

    // Detect RSI Divergence
    detectRSIDivergence(candles, rsiData, lookback = 30) {
        const divergences = [];
        if (candles.length < lookback || rsiData.length < lookback) return divergences;

        const recent = candles.slice(-lookback);
        const recentRSI = rsiData.slice(-lookback);

        // Find local price peaks and RSI peaks
        const pricePeaks = [];
        const rsiPeaks = [];
        const priceTroughs = [];
        const rsiTroughs = [];

        for (let i = 2; i < recent.length - 2; i++) {
            // Peaks (highs)
            if (recent[i].high > recent[i - 1].high && recent[i].high > recent[i - 2].high &&
                recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2].high) {
                pricePeaks.push({ idx: i, value: recent[i].high });
                if (recentRSI[i] !== null) rsiPeaks.push({ idx: i, value: recentRSI[i] });
            }
            // Troughs (lows)
            if (recent[i].low < recent[i - 1].low && recent[i].low < recent[i - 2].low &&
                recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2].low) {
                priceTroughs.push({ idx: i, value: recent[i].low });
                if (recentRSI[i] !== null) rsiTroughs.push({ idx: i, value: recentRSI[i] });
            }
        }

        // Bearish divergence: price higher highs, RSI lower highs
        if (pricePeaks.length >= 2 && rsiPeaks.length >= 2) {
            const lastPricePeak = pricePeaks[pricePeaks.length - 1];
            const prevPricePeak = pricePeaks[pricePeaks.length - 2];
            const matchingRsi = rsiPeaks.filter(p => p.idx === lastPricePeak.idx || p.idx === prevPricePeak.idx);
            if (matchingRsi.length >= 2) {
                if (lastPricePeak.value > prevPricePeak.value && matchingRsi[1].value < matchingRsi[0].value) {
                    divergences.push({ type: 'bearish', name: 'Медвежья дивергенция RSI', desc: 'Цена растёт, RSI падает' });
                }
            }
        }

        // Bullish divergence: price lower lows, RSI higher lows
        if (priceTroughs.length >= 2 && rsiTroughs.length >= 2) {
            const lastPriceTrough = priceTroughs[priceTroughs.length - 1];
            const prevPriceTrough = priceTroughs[priceTroughs.length - 2];
            const matchingRsi = rsiTroughs.filter(p => p.idx === lastPriceTrough.idx || p.idx === prevPriceTrough.idx);
            if (matchingRsi.length >= 2) {
                if (lastPriceTrough.value < prevPriceTrough.value && matchingRsi[1].value > matchingRsi[0].value) {
                    divergences.push({ type: 'bullish', name: 'Бычья дивергенция RSI', desc: 'Цена падает, RSI растёт' });
                }
            }
        }

        return divergences;
    },

    // Detect MACD Divergence
    detectMACDDivergence(candles, macdData, lookback = 30) {
        const divergences = [];
        if (candles.length < lookback || !macdData.histogram || macdData.histogram.length < lookback) return divergences;

        const recent = candles.slice(-lookback);
        const recentHist = macdData.histogram.slice(-lookback);

        // Find histogram peaks
        const histPeaks = [];
        const histTroughs = [];

        for (let i = 2; i < recentHist.length - 2; i++) {
            if (recentHist[i] === null) continue;
            if (recentHist[i] > recentHist[i - 1] && recentHist[i] > recentHist[i + 1]) {
                histPeaks.push({ idx: i, value: recentHist[i] });
            }
            if (recentHist[i] < recentHist[i - 1] && recentHist[i] < recentHist[i + 1]) {
                histTroughs.push({ idx: i, value: recentHist[i] });
            }
        }

        // Bearish MACD divergence
        if (histPeaks.length >= 2) {
            const lastPeak = histPeaks[histPeaks.length - 1];
            const prevPeak = histPeaks[histPeaks.length - 2];
            const lastPrice = recent[lastPeak.idx].high;
            const prevPrice = recent[prevPeak.idx].high;
            if (lastPrice > prevPrice && lastPeak.value < prevPeak.value) {
                divergences.push({ type: 'bearish', name: 'Медвежья дивергенция MACD', desc: 'Цена растёт, MACD падает' });
            }
        }

        // Bullish MACD divergence
        if (histTroughs.length >= 2) {
            const lastTrough = histTroughs[histTroughs.length - 1];
            const prevTrough = histTroughs[histTroughs.length - 2];
            const lastPrice = recent[lastTrough.idx].low;
            const prevPrice = recent[prevTrough.idx].low;
            if (lastPrice < prevPrice && lastTrough.value > prevTrough.value) {
                divergences.push({ type: 'bullish', name: 'Бычья дивергенция MACD', desc: 'Цена падает, MACD растёт' });
            }
        }

        return divergences;
    },

    // Detect all divergences
    detectDivergences(candles, rsiData, macdData) {
        return [
            ...this.detectRSIDivergence(candles, rsiData),
            ...this.detectMACDDivergence(candles, macdData)
        ];
    }
};
