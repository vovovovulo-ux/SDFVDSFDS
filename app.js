// Main Application
(function () {
    'use strict';

    // State
    let currentPair = 'EUR/USD';
    let currentTimeframe = 15;
    let candles = [];
    let indicators = null;
    let tickInterval = null;
    let candleInterval = null;
    let signalHistory = [];
    let lastSignalType = null;
    let audioCtx = null;

    // Chart instances
    let mainChart = null;
    let rsiChart = null;
    let macdChart = null;
    let stochChart = null;
    let candleSeries = null;
    let volumeSeries = null;
    let smaSeries = null;
    let emaSeries = null;
    let bbUpperSeries = null;
    let bbLowerSeries = null;
    let bbMiddleSeries = null;
    let rsiSeries = null;
    let rsiOverBoughtLine = null;
    let rsiOverSoldLine = null;
    let macdLineSeries = null;
    let macdSignalSeries = null;
    let macdHistSeries = null;
    let stochKSeries = null;
    let stochDSeries = null;
    let stochOverBoughtLine = null;
    let stochOverSoldLine = null;
    let ichimokuTenkan = null;
    let ichimokuKijun = null;
    let fibLines = [];

    // Initialize
    function init() {
        createCharts();
        setupEventListeners();
        setupPocketAPI();
        setupAutoTrader();
        loadData();
        startSimulation();
    }

    // Play alert sound
    function playAlert(type) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.value = 0.15;

            if (type === 'buy') {
                osc.frequency.value = 880;
                osc.type = 'sine';
            } else if (type === 'sell') {
                osc.frequency.value = 440;
                osc.type = 'sine';
            } else {
                osc.frequency.value = 660;
                osc.type = 'triangle';
            }

            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.stop(audioCtx.currentTime + 0.3);
        } catch (e) { /* ignore audio errors */ }
    }

    // Create TradingView charts
    function createCharts() {
        // Main candlestick chart
        const mainContainer = document.getElementById('mainChart');
        mainChart = LightweightCharts.createChart(mainContainer, {
            layout: {
                background: { type: 'solid', color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        // Volume histogram
        volumeSeries = mainChart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        mainChart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        candleSeries = mainChart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderDownColor: '#ef5350',
            borderUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            wickUpColor: '#26a69a',
        });

        // SMA line
        smaSeries = mainChart.addLineSeries({
            color: '#2196f3',
            lineWidth: 1,
            title: 'SMA 20',
        });

        // EMA line
        emaSeries = mainChart.addLineSeries({
            color: '#ff9800',
            lineWidth: 1,
            title: 'EMA 9',
        });

        // Bollinger Bands
        bbUpperSeries = mainChart.addLineSeries({
            color: 'rgba(171, 71, 188, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            title: 'BB Upper',
        });

        bbLowerSeries = mainChart.addLineSeries({
            color: 'rgba(171, 71, 188, 0.5)',
            lineWidth: 1,
            lineStyle: 2,
            title: 'BB Lower',
        });

        bbMiddleSeries = mainChart.addLineSeries({
            color: 'rgba(171, 71, 188, 0.3)',
            lineWidth: 1,
            lineStyle: 1,
            title: 'BB Middle',
        });

        // Ichimoku
        ichimokuTenkan = mainChart.addLineSeries({
            color: '#2196f3',
            lineWidth: 1,
            visible: false,
            title: 'Tenkan',
        });
        ichimokuKijun = mainChart.addLineSeries({
            color: '#ef5350',
            lineWidth: 1,
            visible: false,
            title: 'Kijun',
        });

        // RSI chart
        const rsiContainer = document.getElementById('rsiChart');
        rsiChart = LightweightCharts.createChart(rsiContainer, {
            layout: {
                background: { type: 'solid', color: '#131722' },
                textColor: '#787b86',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                visible: false,
            },
        });

        rsiSeries = rsiChart.addLineSeries({
            color: '#ab47bc',
            lineWidth: 1,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        rsiOverBoughtLine = rsiChart.addLineSeries({
            color: 'rgba(239, 83, 80, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        rsiOverSoldLine = rsiChart.addLineSeries({
            color: 'rgba(38, 166, 154, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        // MACD chart
        const macdContainer = document.getElementById('macdChart');
        macdChart = LightweightCharts.createChart(macdContainer, {
            layout: {
                background: { type: 'solid', color: '#131722' },
                textColor: '#787b86',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                visible: false,
            },
        });

        macdLineSeries = macdChart.addLineSeries({
            color: '#2196f3',
            lineWidth: 1,
        });

        macdSignalSeries = macdChart.addLineSeries({
            color: '#ff9800',
            lineWidth: 1,
        });

        macdHistSeries = macdChart.addHistogramSeries({
            priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
        });

        // Stochastic chart
        const stochContainer = document.createElement('div');
        stochContainer.id = 'stochChart';
        stochContainer.className = 'indicator-chart';
        document.querySelector('.chart-area').appendChild(stochContainer);

        stochChart = LightweightCharts.createChart(stochContainer, {
            layout: {
                background: { type: 'solid', color: '#131722' },
                textColor: '#787b86',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            rightPriceScale: {
                borderColor: '#2a2e39',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: '#2a2e39',
                timeVisible: true,
                visible: false,
            },
        });

        stochKSeries = stochChart.addLineSeries({
            color: '#2196f3',
            lineWidth: 1,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        stochDSeries = stochChart.addLineSeries({
            color: '#ff9800',
            lineWidth: 1,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        stochOverBoughtLine = stochChart.addLineSeries({
            color: 'rgba(239, 83, 80, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        stochOverSoldLine = stochChart.addLineSeries({
            color: 'rgba(38, 166, 154, 0.3)',
            lineWidth: 1,
            lineStyle: 2,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        });

        // Sync time scales
        mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (range) {
                rsiChart.timeScale().setVisibleLogicalRange(range);
                macdChart.timeScale().setVisibleLogicalRange(range);
                stochChart.timeScale().setVisibleLogicalRange(range);
            }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            const rect = mainContainer.getBoundingClientRect();
            mainChart.applyOptions({ width: rect.width, height: rect.height });
            const rsiRect = rsiContainer.getBoundingClientRect();
            rsiChart.applyOptions({ width: rsiRect.width, height: rsiRect.height });
            const macdRect = macdContainer.getBoundingClientRect();
            macdChart.applyOptions({ width: macdRect.width, height: macdRect.height });
            const stochRect = stochContainer.getBoundingClientRect();
            stochChart.applyOptions({ width: stochRect.width, height: stochRect.height });
        });

        resizeObserver.observe(mainContainer);
        resizeObserver.observe(rsiContainer);
        resizeObserver.observe(macdContainer);
        resizeObserver.observe(stochContainer);
    }

    // Load data and update charts
    function loadData() {
        candles = DataGenerator.generateCandles(currentPair, currentTimeframe);
        updateCharts();
        analyze();

        // Show/hide OTC badge
        const otcBadge = document.getElementById('otcBadge');
        otcBadge.style.display = DataGenerator.isOTC(currentPair) ? 'inline-block' : 'none';
    }

    // Update all chart series
    function updateCharts() {
        indicators = Indicators.calculateAll(candles);

        // Candlestick data
        const candleData = candles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));
        candleSeries.setData(candleData);

        // Volume data
        const volData = candles.map(c => ({
            time: c.time,
            value: c.volume || 0,
            color: c.close >= c.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)',
        }));
        volumeSeries.setData(volData);

        // SMA
        const smaData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.sma20[i] !== null) {
                smaData.push({ time: candles[i].time, value: indicators.sma20[i] });
            }
        }
        smaSeries.setData(smaData);

        // EMA
        const emaData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.ema9[i] !== null) {
                emaData.push({ time: candles[i].time, value: indicators.ema9[i] });
            }
        }
        emaSeries.setData(emaData);

        // Bollinger Bands
        const bbUpperData = [];
        const bbLowerData = [];
        const bbMiddleData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.bb.upper[i] !== null) {
                bbUpperData.push({ time: candles[i].time, value: indicators.bb.upper[i] });
                bbLowerData.push({ time: candles[i].time, value: indicators.bb.lower[i] });
                bbMiddleData.push({ time: candles[i].time, value: indicators.bb.middle[i] });
            }
        }
        bbUpperSeries.setData(bbUpperData);
        bbLowerSeries.setData(bbLowerData);
        bbMiddleSeries.setData(bbMiddleData);

        // Ichimoku
        if (indicators.ichimoku) {
            const tenkanData = [];
            const kijunData = [];
            for (let i = 0; i < candles.length; i++) {
                if (indicators.ichimoku.tenkan[i] !== null) {
                    tenkanData.push({ time: candles[i].time, value: indicators.ichimoku.tenkan[i] });
                }
                if (indicators.ichimoku.kijun[i] !== null) {
                    kijunData.push({ time: candles[i].time, value: indicators.ichimoku.kijun[i] });
                }
            }
            ichimokuTenkan.setData(tenkanData);
            ichimokuKijun.setData(kijunData);
        }

        // Fibonacci levels
        drawFibonacciLevels();

        // RSI
        const rsiData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.rsi[i] !== null) {
                rsiData.push({ time: candles[i].time, value: indicators.rsi[i] });
            }
        }
        rsiSeries.setData(rsiData);

        // RSI overbought/oversold lines
        const obData = [];
        const osData = [];
        for (let i = 0; i < candles.length; i++) {
            obData.push({ time: candles[i].time, value: 70 });
            osData.push({ time: candles[i].time, value: 30 });
        }
        rsiOverBoughtLine.setData(obData);
        rsiOverSoldLine.setData(osData);

        // MACD
        const macdData = [];
        const macdSignalData = [];
        const macdHistData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.macd.macd[i] !== null) {
                macdData.push({ time: candles[i].time, value: indicators.macd.macd[i] });
            }
            if (indicators.macd.signal[i] !== null) {
                macdSignalData.push({ time: candles[i].time, value: indicators.macd.signal[i] });
            }
            if (indicators.macd.histogram[i] !== null) {
                macdHistData.push({
                    time: candles[i].time,
                    value: indicators.macd.histogram[i],
                    color: indicators.macd.histogram[i] >= 0 ? 'rgba(38, 166, 154, 0.6)' : 'rgba(239, 83, 80, 0.6)',
                });
            }
        }
        macdLineSeries.setData(macdData);
        macdSignalSeries.setData(macdSignalData);
        macdHistSeries.setData(macdHistData);

        // Stochastic
        const stochKData = [];
        const stochDData = [];
        const stobOBData = [];
        const stobOSData = [];
        for (let i = 0; i < candles.length; i++) {
            if (indicators.stoch.k[i] !== null) {
                stochKData.push({ time: candles[i].time, value: indicators.stoch.k[i] });
            }
            if (indicators.stoch.d[i] !== null) {
                stochDData.push({ time: candles[i].time, value: indicators.stoch.d[i] });
            }
            stobOBData.push({ time: candles[i].time, value: 80 });
            stobOSData.push({ time: candles[i].time, value: 20 });
        }
        stochKSeries.setData(stochKData);
        stochDSeries.setData(stochDData);
        stochOverBoughtLine.setData(stobOBData);
        stochOverSoldLine.setData(stobOSData);

        // Apply indicator visibility
        applyIndicatorVisibility();

        // Fit content
        mainChart.timeScale().fitContent();

        // Update current price display
        updatePriceDisplay();
    }

    // Draw Fibonacci retracement levels as price lines
    function drawFibonacciLevels() {
        // Remove existing fib lines
        fibLines.forEach(line => {
            try { mainChart.removeSeries(line); } catch (e) { }
        });
        fibLines = [];

        if (!indicators.fibonacci || !document.getElementById('toggleFib').checked) return;

        const fib = indicators.fibonacci;
        const fibColors = {
            0: 'rgba(239, 83, 80, 0.5)',
            0.236: 'rgba(255, 152, 0, 0.4)',
            0.382: 'rgba(255, 235, 59, 0.4)',
            0.5: 'rgba(33, 150, 243, 0.4)',
            0.618: 'rgba(171, 71, 188, 0.5)',
            0.786: 'rgba(0, 188, 212, 0.4)',
            1: 'rgba(38, 166, 154, 0.5)',
        };

        for (const [level, price] of Object.entries(fib.levels)) {
            const line = mainChart.addLineSeries({
                color: fibColors[level] || 'rgba(128,128,128,0.3)',
                lineWidth: 1,
                lineStyle: 2,
                title: `Fib ${level}`,
                priceLineVisible: true,
                lastValueVisible: false,
            });

            const data = [];
            for (let i = 0; i < candles.length; i++) {
                data.push({ time: candles[i].time, value: price });
            }
            line.setData(data);
            fibLines.push(line);
        }
    }

    // Apply indicator visibility based on checkboxes
    function applyIndicatorVisibility() {
        smaSeries.applyOptions({ visible: document.getElementById('toggleSMA').checked });
        emaSeries.applyOptions({ visible: document.getElementById('toggleEMA').checked });
        const bbVisible = document.getElementById('toggleBB').checked;
        bbUpperSeries.applyOptions({ visible: bbVisible });
        bbLowerSeries.applyOptions({ visible: bbVisible });
        bbMiddleSeries.applyOptions({ visible: bbVisible });

        const ichimokuVisible = document.getElementById('toggleIchimoku').checked;
        ichimokuTenkan.applyOptions({ visible: ichimokuVisible });
        ichimokuKijun.applyOptions({ visible: ichimokuVisible });

        const fibVisible = document.getElementById('toggleFib').checked;
        fibLines.forEach(line => {
            try { line.applyOptions({ visible: fibVisible }); } catch (e) { }
        });

        const volumeVisible = document.getElementById('toggleVolume').checked;
        volumeSeries.applyOptions({ visible: volumeVisible });

        const rsiVisible = document.getElementById('toggleRSI').checked;
        document.getElementById('rsiChart').style.display = rsiVisible ? 'block' : 'none';
        rsiSeries.applyOptions({ visible: rsiVisible });

        const macdVisible = document.getElementById('toggleMACD').checked;
        document.getElementById('macdChart').style.display = macdVisible ? 'block' : 'none';
        macdLineSeries.applyOptions({ visible: macdVisible });

        const stochVisible = document.getElementById('toggleStoch').checked;
        document.getElementById('stochChart').style.display = stochVisible ? 'block' : 'none';
        stochKSeries.applyOptions({ visible: stochVisible });
    }

    // Update price display
    function updatePriceDisplay() {
        if (candles.length === 0) return;
        const last = candles[candles.length - 1];
        const priceEl = document.getElementById('currentPrice');
        priceEl.textContent = DataGenerator.formatPrice(last.close, currentPair);

        if (candles.length > 1) {
            const prev = candles[candles.length - 2];
            if (last.close > prev.close) {
                priceEl.className = 'price-value price-up';
            } else if (last.close < prev.close) {
                priceEl.className = 'price-value price-down';
            }
        }
    }

    // Calculate signal confidence (0-100%)
    function calculateConfidence(signals) {
        let buyStrength = 0;
        let sellStrength = 0;

        signals.forEach(s => {
            const weight = s.strength === 'strong' ? 3 : s.strength === 'medium' ? 2 : 1;
            if (s.type === 'buy') buyStrength += weight;
            if (s.type === 'sell') sellStrength += weight;
        });

        const total = buyStrength + sellStrength;
        if (total === 0) return { confidence: 0, direction: 'neutral' };

        const maxStr = Math.max(buyStrength, sellStrength);
        const confidence = Math.min(100, Math.round((maxStr / total) * 70 + (maxStr > 6 ? 30 : maxStr > 3 ? 15 : 0)));
        const direction = buyStrength > sellStrength ? 'buy' : sellStrength > buyStrength ? 'sell' : 'neutral';

        return { confidence, direction, buyStrength, sellStrength };
    }

    // Recommend expiry time based on timeframe and signal strength
    function recommendExpiry(timeframe, confidence) {
        if (confidence < 40) return '--';

        // Binary options expiry recommendations
        if (timeframe <= 1) {
            if (confidence >= 80) return '1-3 мин';
            if (confidence >= 60) return '3-5 мин';
            return '5 мин';
        } else if (timeframe <= 5) {
            if (confidence >= 80) return '5 мин';
            if (confidence >= 60) return '10 мин';
            return '15 мин';
        } else if (timeframe <= 15) {
            if (confidence >= 80) return '15 мин';
            if (confidence >= 60) return '30 мин';
            return '1 час';
        } else if (timeframe <= 60) {
            if (confidence >= 80) return '1 час';
            if (confidence >= 60) return '2 часа';
            return '4 часа';
        } else {
            if (confidence >= 80) return '4 часа';
            return '8 часов';
        }
    }

    // Add signal to history
    function addToHistory(signal) {
        const now = new Date();
        const entry = {
            time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: signal.type,
            text: signal.text,
            pair: currentPair,
            timeframe: currentTimeframe
        };

        signalHistory.unshift(entry);
        if (signalHistory.length > 30) signalHistory.pop();

        const historyEl = document.getElementById('signalHistory');
        historyEl.innerHTML = '';
        signalHistory.forEach(h => {
            const div = document.createElement('div');
            div.className = `history-item ${h.type === 'buy' ? 'buy' : h.type === 'sell' ? 'sell' : 'neutral-signal'}`;
            div.innerHTML = `<span>${h.type === 'buy' ? '▲' : h.type === 'sell' ? '▼' : '●'} ${h.pair} ${h.text}</span><span class="history-time">${h.time}</span>`;
            historyEl.appendChild(div);
        });
    }

    // Analyze market and generate signals
    function analyze() {
        if (!indicators || candles.length < 30) return;

        const last = candles.length - 1;
        const signals = [];
        const rsiVal = indicators.rsi[last];
        const macdVal = indicators.macd.macd[last];
        const macdSignal = indicators.macd.signal[last];
        const macdHist = indicators.macd.histogram[last];
        const smaVal = indicators.sma20[last];
        const emaVal = indicators.ema9[last];
        const bbUpper = indicators.bb.upper[last];
        const bbLower = indicators.bb.lower[last];
        const stochK = indicators.stoch.k[last];
        const stochD = indicators.stoch.d[last];
        const adxVal = indicators.adx ? indicators.adx.adx[last] : null;
        const plusDI = indicators.adx ? indicators.adx.plusDI[last] : null;
        const minusDI = indicators.adx ? indicators.adx.minusDI[last] : null;
        const close = candles[last].close;

        // RSI signals
        if (rsiVal !== null) {
            if (rsiVal < 30) {
                signals.push({ type: 'buy', text: 'RSI перепроданность', strength: 'strong' });
            } else if (rsiVal < 40) {
                signals.push({ type: 'buy', text: 'RSI близко к перепроданности', strength: 'medium' });
            } else if (rsiVal > 70) {
                signals.push({ type: 'sell', text: 'RSI перекупленность', strength: 'strong' });
            } else if (rsiVal > 60) {
                signals.push({ type: 'sell', text: 'RSI близко к перекупленности', strength: 'medium' });
            }
        }

        // MACD signals
        if (macdVal !== null && macdSignal !== null) {
            if (macdHist !== null) {
                const prevHist = indicators.macd.histogram[last - 1];
                if (macdHist > 0 && prevHist !== null && prevHist <= 0) {
                    signals.push({ type: 'buy', text: 'MACD пересечение вверх', strength: 'strong' });
                } else if (macdHist < 0 && prevHist !== null && prevHist >= 0) {
                    signals.push({ type: 'sell', text: 'MACD пересечение вниз', strength: 'strong' });
                } else if (macdHist > 0 && macdHist > (prevHist || 0)) {
                    signals.push({ type: 'buy', text: 'MACD бычий импульс', strength: 'medium' });
                } else if (macdHist < 0 && macdHist < (prevHist || 0)) {
                    signals.push({ type: 'sell', text: 'MACD медвежий импульс', strength: 'medium' });
                }
            }
        }

        // Moving Average signals
        if (emaVal !== null && smaVal !== null) {
            if (emaVal > smaVal && close > emaVal) {
                signals.push({ type: 'buy', text: 'Цена выше EMA > SMA', strength: 'medium' });
            } else if (emaVal < smaVal && close < emaVal) {
                signals.push({ type: 'sell', text: 'Цена ниже EMA < SMA', strength: 'medium' });
            }
        }

        // Bollinger Bands signals
        if (bbUpper !== null && bbLower !== null) {
            if (close <= bbLower) {
                signals.push({ type: 'buy', text: 'Цена у нижней полосы BB', strength: 'strong' });
            } else if (close >= bbUpper) {
                signals.push({ type: 'sell', text: 'Цена у верхней полосы BB', strength: 'strong' });
            }
        }

        // Stochastic signals
        if (stochK !== null && stochD !== null) {
            const prevK = indicators.stoch.k[last - 1];
            const prevD = indicators.stoch.d[last - 1];
            if (stochK < 20 && prevK !== null && prevK < prevD && stochK > stochD) {
                signals.push({ type: 'buy', text: 'Stochastic пересечение в перепроданности', strength: 'strong' });
            } else if (stochK > 80 && prevK !== null && prevK > prevD && stochK < stochD) {
                signals.push({ type: 'sell', text: 'Stochastic пересечение в перекупленности', strength: 'strong' });
            } else if (stochK < 20) {
                signals.push({ type: 'buy', text: 'Stochastic перепроданность', strength: 'medium' });
            } else if (stochK > 80) {
                signals.push({ type: 'sell', text: 'Stochastic перекупленность', strength: 'medium' });
            }
        }

        // ADX signals
        if (adxVal !== null && plusDI !== null && minusDI !== null) {
            if (adxVal > 25) {
                if (plusDI > minusDI) {
                    signals.push({ type: 'buy', text: 'ADX сильный тренд вверх', strength: 'strong' });
                } else {
                    signals.push({ type: 'sell', text: 'ADX сильный тренд вниз', strength: 'strong' });
                }
            } else if (adxVal > 20) {
                if (plusDI > minusDI) {
                    signals.push({ type: 'buy', text: 'Тренд формируется вверх', strength: 'weak' });
                } else {
                    signals.push({ type: 'sell', text: 'Тренд формируется вниз', strength: 'weak' });
                }
            }
        }

        // Fibonacci levels
        if (indicators.fibonacci) {
            const fib = indicators.fibonacci;
            const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
            for (const level of fibLevels) {
                const price = fib.levels[level];
                if (price) {
                    const tolerance = (fib.high - fib.low) * 0.005;
                    if (Math.abs(close - price) < tolerance) {
                        if (fib.isUptrend) {
                            signals.push({ type: 'buy', text: `Цена у уровня Фибоначчи ${level}`, strength: 'medium' });
                        } else {
                            signals.push({ type: 'sell', text: `Цена у уровня Фибоначчи ${level}`, strength: 'medium' });
                        }
                        break;
                    }
                }
            }
        }

        // Volume analysis signals
        if (indicators.volume) {
            const vol = indicators.volume;
            if (vol.ratio > 2 && candles[last].close > candles[last - 1].close) {
                signals.push({ type: 'buy', text: 'Высокий объём на повышении', strength: 'medium' });
            } else if (vol.ratio > 2 && candles[last].close < candles[last - 1].close) {
                signals.push({ type: 'sell', text: 'Высокий объём на понижении', strength: 'medium' });
            }
        }

        // Detect patterns
        const patterns = Patterns.detectAll(candles);
        patterns.forEach(p => {
            signals.push({
                type: p.type === 'bullish' ? 'buy' : p.type === 'bearish' ? 'sell' : 'neutral',
                text: p.name + ': ' + p.desc,
                strength: 'medium'
            });
        });

        // Detect divergences
        const divergences = Patterns.detectDivergences(candles, indicators.rsi, indicators.macd);
        divergences.forEach(d => {
            signals.push({
                type: d.type === 'bullish' ? 'buy' : 'sell',
                text: d.name,
                strength: 'strong'
            });
        });

        // Calculate overall signal with confidence
        const { confidence, direction, buyStrength, sellStrength } = calculateConfidence(signals);
        const diff = buyStrength - sellStrength;

        const mainSignalEl = document.getElementById('mainSignal');
        if (diff >= 4) {
            mainSignalEl.className = 'signal-badge buy';
            mainSignalEl.textContent = '▲ ПОКУПКА';
        } else if (diff >= 2) {
            mainSignalEl.className = 'signal-badge buy';
            mainSignalEl.textContent = '▲ Покупка';
        } else if (diff <= -4) {
            mainSignalEl.className = 'signal-badge sell';
            mainSignalEl.textContent = '▼ ПРОДАЖА';
        } else if (diff <= -2) {
            mainSignalEl.className = 'signal-badge sell';
            mainSignalEl.textContent = '▼ Продажа';
        } else {
            mainSignalEl.className = 'signal-badge neutral';
            mainSignalEl.textContent = '● Нейтрально';
        }

        // Update confidence bar
        const confFill = document.getElementById('confidenceFill');
        const confText = document.getElementById('confidenceText');
        confFill.style.width = confidence + '%';
        confText.textContent = confidence + '%';
        if (direction === 'buy') {
            confFill.style.background = 'var(--green)';
            confText.style.color = 'var(--green)';
        } else if (direction === 'sell') {
            confFill.style.background = 'var(--red)';
            confText.style.color = 'var(--red)';
        } else {
            confFill.style.background = 'var(--blue)';
            confText.style.color = 'var(--blue)';
        }

        // Update expiry recommendation
        const expiry = recommendExpiry(currentTimeframe, confidence);
        document.getElementById('expiryValue').textContent = expiry;

        // Sound alert on strong signal change
        if (confidence >= 65 && direction !== lastSignalType && direction !== 'neutral') {
            playAlert(direction);
            lastSignalType = direction;
        } else if (confidence < 40) {
            lastSignalType = null;
        }

        // ====== SEND SIGNAL TO AUTO-TRADER ======
        if (confidence >= 60 && direction !== 'neutral') {
            // Отправляем сигнал в Chrome Extension
            window.postMessage({
                type: 'TRADE_SIGNAL',
                direction: direction,
                confidence: confidence,
                amount: 1,
                expiry: 5
            }, '*');
            
            // Если есть PocketAPI - отправляем туда
            if (AutoTrader && AutoTrader.getState().isTrading) {
                AutoTrader.processSignal({
                    direction: direction,
                    confidence: confidence,
                    asset: _getAssetForAPI(),
                    signals: signals
                });
            }
        }

        // Update signal count
        document.getElementById('signalCount').textContent = signals.length;

        // Update signals list
        const signalsList = document.getElementById('signalsList');
        signalsList.innerHTML = '';
        if (signals.length === 0) {
            signalsList.innerHTML = '<div class="signal-item neutral-signal">Сигналов нет</div>';
        } else {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            signals.slice(0, 10).forEach(s => {
                const div = document.createElement('div');
                div.className = `signal-item ${s.type === 'buy' ? 'buy' : s.type === 'sell' ? 'sell' : 'neutral-signal'}`;
                const strengthIcon = s.strength === 'strong' ? '⚡' : s.strength === 'medium' ? '●' : '○';
                div.innerHTML = `<span>${s.type === 'buy' ? '▲' : s.type === 'sell' ? '▼' : '●'} ${strengthIcon} ${s.text}</span><span class="signal-time">${timeStr}</span>`;
                signalsList.appendChild(div);
            });
        }

        // Add strong signals to history
        if (confidence >= 60 && direction !== 'neutral') {
            const sigText = direction === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА';
            const alreadyAdded = signalHistory.length > 0 && signalHistory[0].text === sigText &&
                signalHistory[0].pair === currentPair;
            if (!alreadyAdded) {
                addToHistory({ type: direction, text: sigText });
            }
        }

        // Update patterns and divergences
        const patternsList = document.getElementById('patternsList');
        patternsList.innerHTML = '';
        const allPatterns = [...patterns, ...divergences];
        if (allPatterns.length === 0) {
            patternsList.innerHTML = '<div class="pattern-item neutral">Паттерны не найдены</div>';
        } else {
            allPatterns.forEach(p => {
                const div = document.createElement('div');
                div.className = `pattern-item ${p.type}`;
                div.textContent = `${p.type === 'bullish' ? '▲' : p.type === 'bearish' ? '▼' : '●'} ${p.name}`;
                patternsList.appendChild(div);
            });
        }

        // Update statistics
        updateStats(rsiVal, macdVal, smaVal, emaVal, bbUpper, bbLower, stochK, adxVal);
    }

    // Update statistics panel
    function updateStats(rsi, macd, sma, ema, bbu, bbl, stochK, adx) {
        const fmt = (v, decimals) => v !== null ? v.toFixed(decimals || 5) : '--';

        const setStat = (id, value, cls) => {
            const el = document.getElementById(id);
            el.textContent = value;
            el.className = `stat-value ${cls || 'neutral-val'}`;
        };

        setStat('statRSI', rsi !== null ? rsi.toFixed(1) : '--',
            rsi < 30 ? 'up' : rsi > 70 ? 'down' : 'neutral-val');
        setStat('statMACD', fmt(macd, 6),
            macd > 0 ? 'up' : macd < 0 ? 'down' : 'neutral-val');
        setStat('statStochK', stochK !== null ? stochK.toFixed(1) : '--',
            stochK < 20 ? 'up' : stochK > 80 ? 'down' : 'neutral-val');
        setStat('statADX', adx !== null ? adx.toFixed(1) : '--',
            adx > 25 ? 'up' : 'neutral-val');
        setStat('statSMA', fmt(sma));
        setStat('statEMA', fmt(ema));
        setStat('statBBU', fmt(bbu));
        setStat('statBBL', fmt(bbl));

        // Volatility (ATR-based)
        if (indicators.atr) {
            const atrVal = indicators.atr[candles.length - 1];
            setStat('statVol', atrVal !== null ? fmt(atrVal) : '--');
        }

        // Trend
        const trend = Patterns.detectTrend(candles);
        const trendText = trend.direction === 'up' ? '▲ Вверх' :
            trend.direction === 'down' ? '▼ Вниз' : '● Боковой';
        const trendClass = trend.direction === 'up' ? 'up' :
            trend.direction === 'down' ? 'down' : 'neutral-val';
        setStat('statTrend', trendText, trendClass);
    }

    // Start real-time simulation
    function startSimulation() {
        // Stop existing intervals
        if (tickInterval) clearInterval(tickInterval);
        if (candleInterval) clearInterval(candleInterval);

        // Tick every 500ms - update current candle
        tickInterval = setInterval(() => {
            if (candles.length === 0) return;

            const last = candles[candles.length - 1];
            const updated = DataGenerator.updateCurrentPrice(last, currentPair);
            candles[candles.length - 1] = updated;

            // Update chart
            candleSeries.update({
                time: updated.time,
                open: updated.open,
                high: updated.high,
                low: updated.low,
                close: updated.close,
            });

            // Update volume
            volumeSeries.update({
                time: updated.time,
                value: updated.volume || 0,
                color: updated.close >= updated.open ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)',
            });

            updatePriceDisplay();
        }, 500);

        // New candle every 30 seconds (simulated)
        candleInterval = setInterval(() => {
            if (candles.length === 0) return;

            const last = candles[candles.length - 1];
            const newCandle = DataGenerator.generateNextCandle(last, currentPair, currentTimeframe);
            candles.push(newCandle);

            // Keep max 500 candles
            if (candles.length > 500) {
                candles.shift();
            }

            // Full recalc every 5 candles
            if (candles.length % 5 === 0) {
                updateCharts();
            }

            analyze();
        }, 30000);
    }

    // Convert pair format to API asset format
    function _getAssetForAPI() {
        let asset = currentPair;
        asset = asset.replace('/', '');
        if (asset.includes('OTC')) {
            asset = asset.replace(' OTC', '-OTC');
        }
        return asset;
    }

    // ============== Pocket API Setup ==============
    function setupPocketAPI() {
        // OAuth-style authentication button
        document.getElementById('oauthBtn').addEventListener('click', () => {
            const type = document.querySelector('.acc-btn.active')?.dataset.type || 'demo';
            
            // Open Pocket Option in new window for login
            const url = type === 'demo' ? 
                'https://m.pocketoption.com/ru/demo' : 
                'https://m.pocketoption.com/ru/cabinet/';
            
            window.open(url, '_blank');
            
            _updateConnectionStatus('connecting');
            
            // Start monitoring for login
            startLoginMonitoring(type);
            
            // Show instructions
            setTimeout(() => {
                alert(
                    '🔐 ИНСТРУКЦИЯ ПО АВТОРИЗАЦИИ:\n\n' +
                    '1️⃣ Войди в Pocket Option в открывшемся окне\n' +
                    '   (Google, Email, Telegram и т.д.)\n\n' +
                    '2️⃣ После входа, нажми F12 → Console\n\n' +
                    '3️⃣ Введи: document.cookie\n\n' +
                    '4️⃣ Найди: ssid=XXXXXXXXXX\n' +
                    '   (скопируй значение после ssid=)\n\n' +
                    '5️⃣ Нажми "🔑 По токену" в этом окне\n' +
                    '   и вставь скопированный токен\n\n' +
                    '💡 Или используй extract-token.html для удобства'
                );
            }, 500);
        });

        // Close OAuth overlay
        document.getElementById('closeOauth').addEventListener('click', () => {
            document.getElementById('oauthOverlay').style.display = 'none';
            document.getElementById('oauthFrame').src = '';
            stopLoginMonitoring();
            _updateConnectionStatus('disconnected');
        });

        // Token authentication button (fallback)
        document.getElementById('tokenAuthBtn').addEventListener('click', () => {
            const modal = document.getElementById('tokenModal');
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            document.getElementById('ssidToken').value = '';
            document.getElementById('ssidToken').focus();
        });

        // Confirm token
        document.getElementById('confirmToken').addEventListener('click', () => {
            const token = document.getElementById('ssidToken').value.trim();
            
            if (!token) {
                alert('Введи SSID токен!');
                return;
            }
            
            const type = document.querySelector('.acc-btn.active')?.dataset.type || 'demo';
            
            // Hide modal
            document.getElementById('tokenModal').style.display = 'none';
            
            // Connect with token
            PocketAPI.authorizeWithToken(token, type);
        });

        // Cancel token modal
        document.getElementById('cancelToken').addEventListener('click', () => {
            document.getElementById('tokenModal').style.display = 'none';
        });

        // Close modal on background click
        document.getElementById('tokenModal').addEventListener('click', (e) => {
            if (e.target.id === 'tokenModal') {
                document.getElementById('tokenModal').style.display = 'none';
            }
        });

        // Кнопка отключения
        document.getElementById('disconnectBtn').addEventListener('click', () => {
            AutoTrader.stop();
            PocketAPI.disconnect();
            _updateConnectionStatus('disconnected');
        });

        // Переключение типа счёта
        document.getElementById('btnDemo').addEventListener('click', () => {
            document.getElementById('btnDemo').classList.add('active');
            document.getElementById('btnReal').classList.remove('active');
        });
        document.getElementById('btnReal').addEventListener('click', () => {
            document.getElementById('btnReal').classList.add('active');
            document.getElementById('btnDemo').classList.remove('active');
        });

        // Обработчики событий PocketAPI
        PocketAPI.on('onConnect', (data) => {
            console.log('Событие onConnect:', data);
            _updateConnectionStatus('connected');
            if (AutoTrader) {
                AutoTrader.log('✅ Подключено к Pocket Option (' + data.type + ')');
            }
        });

        PocketAPI.on('onAuth', (data) => {
            console.log('Событие onAuth:', data);
            document.getElementById('apiBalance').textContent = `$${data.balance.toFixed(2)}`;
            document.getElementById('apiUid').textContent = data.uid || '--';
            if (AutoTrader) {
                AutoTrader.log(`Баланс: $${data.balance.toFixed(2)} | UID: ${data.uid}`);
            }
        });

        PocketAPI.on('onDisconnect', () => {
            console.log('Событие onDisconnect');
            _updateConnectionStatus('disconnected');
            if (AutoTrader) AutoTrader.log('❌ Отключено');
            AutoTrader.stop();
        });

        PocketAPI.on('onLoginStart', () => {
            console.log('Событие onLoginStart');
        });

        PocketAPI.on('onLoginSuccess', () => {
            console.log('Событие onLoginSuccess');
        });
    }

    function _updateConnectionStatus(status) {
        const dot = document.getElementById('connDot');
        const text = document.getElementById('connText');
        const oauthBtn = document.getElementById('oauthBtn');
        const tokenAuthBtn = document.getElementById('tokenAuthBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (status === 'connected') {
            dot.className = 'conn-dot connected';
            text.textContent = 'Подключено';
            text.style.color = 'var(--green)';
            oauthBtn.style.display = 'none';
            tokenAuthBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
        } else if (status === 'connecting') {
            dot.className = 'conn-dot connecting';
            text.textContent = 'Подключение...';
            text.style.color = 'var(--orange)';
        } else {
            dot.className = 'conn-dot';
            text.textContent = 'Отключено';
            text.style.color = 'var(--text-secondary)';
            oauthBtn.style.display = 'inline-block';
            tokenAuthBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            document.getElementById('apiBalance').textContent = '--';
            document.getElementById('apiUid').textContent = '--';
        }
    }

    // ============== Login Monitoring ==============
    let loginCheckInterval = null;

    function startLoginMonitoring(type) {
        console.log('🔐 Ожидание авторизации...');
        console.log('💡 Инструкция:');
        console.log('1. Войди в Pocket Option в открывшемся окне');
        console.log('2. После входа нажми F12 → Console');
        console.log('3. Введи: document.cookie');
        console.log('4. Найди ssid=XXXXX и скопируй значение');
        console.log('5. Вставь в поле "По токену" в анализаторе');
        
        // Show token button for manual fallback
        document.getElementById('tokenAuthBtn').style.display = 'inline-block';
    }

    function stopLoginMonitoring() {
        if (loginCheckInterval) {
            clearInterval(loginCheckInterval);
            loginCheckInterval = null;
        }
    }

    // ============== Auto Trader Setup ==============
    function setupAutoTrader() {
        // Start/Stop button
        document.getElementById('autoTradeBtn').addEventListener('click', () => {
            const state = AutoTrader.getState();
            if (state.isTrading) {
                AutoTrader.stop();
            } else {
                if (!PocketAPI.authenticated) {
                    alert('Сначала подключитесь к Pocket Option!');
                    return;
                }
                // Read settings from UI
                _syncTraderSettings();
                AutoTrader.start();
            }
        });

        // Reset stats
        document.getElementById('resetStatsBtn').addEventListener('click', () => {
            AutoTrader.resetDailyStats();
        });

        // Settings sync
        const settingsInputs = ['minConfidence', 'tradeAmount', 'maxTradeAmount', 'expiryMinutes',
            'maxDailyTrades', 'maxDailyLoss', 'takeProfit', 'cooldownSec', 'martingaleToggle', 'tradeDirection'];

        settingsInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => _syncTraderSettings());
                el.addEventListener('input', () => {
                    if (id === 'minConfidence') {
                        document.getElementById('confVal').textContent = el.value + '%';
                    }
                });
            }
        });

        // Auto-trader events
        AutoTrader.on('onSafetyStop', (data) => {
            AutoTrader.log(`🛑 БЕЗОПАСНОСТЬ: ${data.reason}`);
            playAlert('sell');
        });

        AutoTrader.on('onTrade', (data) => {
            playAlert(data.direction === 'call' ? 'buy' : 'sell');
        });

        AutoTrader.on('onTradeResult', (data) => {
            if (data.result === 'win') {
                playAlert('buy');
            }
        });
    }

    function _syncTraderSettings() {
        AutoTrader.setConfig({
            minConfidence: parseInt(document.getElementById('minConfidence').value),
            tradeAmount: parseFloat(document.getElementById('tradeAmount').value),
            maxTradeAmount: parseFloat(document.getElementById('maxTradeAmount').value),
            expiryMinutes: parseInt(document.getElementById('expiryMinutes').value),
            maxDailyTrades: parseInt(document.getElementById('maxDailyTrades').value),
            maxDailyLoss: parseFloat(document.getElementById('maxDailyLoss').value),
            takeProfit: parseFloat(document.getElementById('takeProfit').value),
            cooldownSeconds: parseInt(document.getElementById('cooldownSec').value),
            martingale: document.getElementById('martingaleToggle').checked,
            tradeDirection: document.getElementById('tradeDirection').value,
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        // Pair selection
        document.getElementById('pairSelect').addEventListener('change', (e) => {
            currentPair = e.target.value;
            signalHistory = [];
            loadData();
        });

        // Timeframe buttons
        document.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTimeframe = parseInt(btn.dataset.tf);
                loadData();
            });
        });

        // Indicator toggles
        ['toggleSMA', 'toggleEMA', 'toggleBB', 'toggleRSI', 'toggleMACD', 'toggleStoch', 'toggleIchimoku', 'toggleFib', 'toggleVolume'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                applyIndicatorVisibility();
                // Redraw Fibonacci if toggled
                if (id === 'toggleFib') {
                    drawFibonacciLevels();
                }
                setTimeout(() => {
                    mainChart.timeScale().fitContent();
                }, 100);
            });
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
