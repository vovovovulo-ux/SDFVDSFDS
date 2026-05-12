// Technical Indicators Library
const Indicators = {
    // Simple Moving Average
    SMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        }
        return result;
    },

    // Exponential Moving Average
    EMA(data, period) {
        const result = [];
        const k = 2 / (period + 1);
        let ema = null;

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
                continue;
            }
            if (ema === null) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += data[i - j];
                }
                ema = sum / period;
            } else {
                ema = data[i] * k + ema * (1 - k);
            }
            result.push(ema);
        }
        return result;
    },

    // Bollinger Bands
    BollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.SMA(data, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < data.length; i++) {
            if (sma[i] === null) {
                upper.push(null);
                lower.push(null);
                continue;
            }
            let sumSq = 0;
            for (let j = 0; j < period; j++) {
                sumSq += Math.pow(data[i - j] - sma[i], 2);
            }
            const std = Math.sqrt(sumSq / period);
            upper.push(sma[i] + stdDev * std);
            lower.push(sma[i] - stdDev * std);
        }

        return { upper, middle: sma, lower };
    },

    // Relative Strength Index
    RSI(data, period = 14) {
        const result = [];
        const gains = [];
        const losses = [];

        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                gains.push(0);
                losses.push(0);
                result.push(null);
                continue;
            }

            const change = data[i] - data[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? -change : 0);

            if (i < period) {
                result.push(null);
                continue;
            }

            if (i === period) {
                let avgGain = 0, avgLoss = 0;
                for (let j = 1; j <= period; j++) {
                    avgGain += gains[j];
                    avgLoss += losses[j];
                }
                avgGain /= period;
                avgLoss /= period;

                if (avgLoss === 0) {
                    result.push(100);
                } else {
                    const rs = avgGain / avgLoss;
                    result.push(100 - 100 / (1 + rs));
                }
            } else {
                const prevRSI = result[i - 1];
                const prevAvgGain = (100 / (100 - prevRSI) - 1) * (prevRSI / (100 - prevRSI));
                
                let avgGain = 0, avgLoss = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    avgGain += gains[j];
                    avgLoss += losses[j];
                }
                avgGain /= period;
                avgLoss /= period;

                if (avgLoss === 0) {
                    result.push(100);
                } else {
                    const rs = avgGain / avgLoss;
                    result.push(100 - 100 / (1 + rs));
                }
            }
        }
        return result;
    },

    // MACD
    MACD(data, fast = 12, slow = 26, signal = 9) {
        const emaFast = this.EMA(data, fast);
        const emaSlow = this.EMA(data, slow);
        const macdLine = [];
        const macdData = [];

        for (let i = 0; i < data.length; i++) {
            if (emaFast[i] === null || emaSlow[i] === null) {
                macdLine.push(null);
            } else {
                macdLine.push(emaFast[i] - emaSlow[i]);
            }
        }

        const validMacd = macdLine.filter(v => v !== null);
        const signalLine = this.EMA(validMacd, signal);

        const result = { macd: [], signal: [], histogram: [] };
        let signalIdx = 0;

        for (let i = 0; i < data.length; i++) {
            if (macdLine[i] === null) {
                result.macd.push(null);
                result.signal.push(null);
                result.histogram.push(null);
            } else {
                result.macd.push(macdLine[i]);
                if (signalIdx < signalLine.length && signalLine[signalIdx] !== null) {
                    result.signal.push(signalLine[signalIdx]);
                    result.histogram.push(macdLine[i] - signalLine[signalIdx]);
                } else {
                    result.signal.push(null);
                    result.histogram.push(null);
                }
                signalIdx++;
            }
        }

        return result;
    },

    // Average True Range
    ATR(candles, period = 14) {
        const result = [];
        const trueRanges = [];

        for (let i = 0; i < candles.length; i++) {
            if (i === 0) {
                trueRanges.push(candles[i].high - candles[i].low);
                result.push(null);
                continue;
            }

            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close)
            );
            trueRanges.push(tr);

            if (i < period) {
                result.push(null);
                continue;
            }

            if (i === period) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += trueRanges[j];
                }
                result.push(sum / period);
            } else {
                result.push((result[i - 1] * (period - 1) + trueRanges[i]) / period);
            }
        }
        return result;
    },

    // Stochastic Oscillator
    Stochastic(candles, kPeriod = 14, dPeriod = 3) {
        const kValues = [];
        const result = { k: [], d: [] };

        for (let i = 0; i < candles.length; i++) {
            if (i < kPeriod - 1) {
                kValues.push(null);
                continue;
            }

            let highest = -Infinity, lowest = Infinity;
            for (let j = 0; j < kPeriod; j++) {
                highest = Math.max(highest, candles[i - j].high);
                lowest = Math.min(lowest, candles[i - j].low);
            }

            const k = highest !== lowest ? ((candles[i].close - lowest) / (highest - lowest)) * 100 : 50;
            kValues.push(k);
        }

        const dValues = this.SMA(kValues.filter(v => v !== null), dPeriod);

        let dIdx = 0;
        for (let i = 0; i < candles.length; i++) {
            result.k.push(kValues[i]);
            if (kValues[i] !== null && dIdx < dValues.length && dValues[dIdx] !== null) {
                result.d.push(dValues[dIdx]);
                dIdx++;
            } else {
                result.d.push(null);
            }
        }

        return result;
    },

    // Average Directional Index (ADX)
    ADX(candles, period = 14) {
        const result = { adx: [], plusDI: [], minusDI: [] };
        if (candles.length < period * 2) {
            for (let i = 0; i < candles.length; i++) {
                result.adx.push(null);
                result.plusDI.push(null);
                result.minusDI.push(null);
            }
            return result;
        }

        const trueRanges = [];
        const plusDMs = [];
        const minusDMs = [];

        for (let i = 0; i < candles.length; i++) {
            if (i === 0) {
                trueRanges.push(candles[i].high - candles[i].low);
                plusDMs.push(0);
                minusDMs.push(0);
                result.adx.push(null);
                result.plusDI.push(null);
                result.minusDI.push(null);
                continue;
            }

            const tr = Math.max(
                candles[i].high - candles[i].low,
                Math.abs(candles[i].high - candles[i - 1].close),
                Math.abs(candles[i].low - candles[i - 1].close)
            );
            trueRanges.push(tr);

            const upMove = candles[i].high - candles[i - 1].high;
            const downMove = candles[i - 1].low - candles[i].low;
            plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

            if (i < period) {
                result.adx.push(null);
                result.plusDI.push(null);
                result.minusDI.push(null);
                continue;
            }

            if (i === period) {
                let sumTR = 0, sumPDM = 0, sumMDM = 0;
                for (let j = 1; j <= period; j++) {
                    sumTR += trueRanges[j];
                    sumPDM += plusDMs[j];
                    sumMDM += minusDMs[j];
                }
                const smoothTR = sumTR;
                const smoothPDM = sumPDM;
                const smoothMDM = sumMDM;
                const pdi = smoothTR !== 0 ? (smoothPDM / smoothTR) * 100 : 0;
                const mdi = smoothTR !== 0 ? (smoothMDM / smoothTR) * 100 : 0;
                const dx = (pdi + mdi) !== 0 ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
                result.plusDI.push(pdi);
                result.minusDI.push(mdi);
                result.adx.push(dx);
            } else {
                const prevSmoothTR = trueRanges.slice(Math.max(1, i - period), i).reduce((a, b) => a + b, 0);
                const prevSmoothPDM = plusDMs.slice(Math.max(1, i - period), i).reduce((a, b) => a + b, 0);
                const prevSmoothMDM = minusDMs.slice(Math.max(1, i - period), i).reduce((a, b) => a + b, 0);
                
                const smoothTR = prevSmoothTR - prevSmoothTR / period + trueRanges[i];
                const smoothPDM = prevSmoothPDM - prevSmoothPDM / period + plusDMs[i];
                const smoothMDM = prevSmoothMDM - prevSmoothMDM / period + minusDMs[i];
                const pdi = smoothTR !== 0 ? (smoothPDM / smoothTR) * 100 : 0;
                const mdi = smoothTR !== 0 ? (smoothMDM / smoothTR) * 100 : 0;
                const dx = (pdi + mdi) !== 0 ? Math.abs(pdi - mdi) / (pdi + mdi) * 100 : 0;
                const prevADX = result.adx[i - 1] || dx;
                result.plusDI.push(pdi);
                result.minusDI.push(mdi);
                result.adx.push((prevADX * (period - 1) + dx) / period);
            }
        }

        return result;
    },

    // Ichimoku Cloud
    Ichimoku(candles, tenkan = 9, kijun = 26, senkouB = 52) {
        const result = { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] };

        const highest = (start, period) => {
            let h = -Infinity;
            for (let i = start; i > start - period && i >= 0; i--) {
                h = Math.max(h, candles[i].high);
            }
            return h;
        };

        const lowest = (start, period) => {
            let l = Infinity;
            for (let i = start; i > start - period && i >= 0; i--) {
                l = Math.min(l, candles[i].low);
            }
            return l;
        };

        for (let i = 0; i < candles.length; i++) {
            // Tenkan-sen
            if (i < tenkan - 1) {
                result.tenkan.push(null);
            } else {
                result.tenkan.push((highest(i, tenkan) + lowest(i, tenkan)) / 2);
            }

            // Kijun-sen
            if (i < kijun - 1) {
                result.kijun.push(null);
            } else {
                result.kijun.push((highest(i, kijun) + lowest(i, kijun)) / 2);
            }

            // Senkou A (shifted forward 26 periods)
            if (result.tenkan[i] !== null && result.kijun[i] !== null) {
                result.senkouA.push({
                    time: i + kijun < candles.length ? candles[i + kijun].time : null,
                    value: (result.tenkan[i] + result.kijun[i]) / 2
                });
            } else {
                result.senkouA.push(null);
            }

            // Senkou B (shifted forward 26 periods)
            if (i < senkouB - 1) {
                result.senkouB.push(null);
            } else {
                result.senkouB.push({
                    time: i + kijun < candles.length ? candles[i + kijun].time : null,
                    value: (highest(i, senkouB) + lowest(i, senkouB)) / 2
                });
            }

            // Chikou (shifted back 26 periods)
            if (i + kijun < candles.length) {
                result.chikou.push({ time: candles[i].time, value: candles[i + kijun].close });
            } else {
                result.chikou.push(null);
            }
        }

        return result;
    },

    // Fibonacci Retracement Levels
    Fibonacci(candles, lookback = 100) {
        const start = Math.max(0, candles.length - lookback);
        const data = candles.slice(start);
        if (data.length < 10) return null;

        let highIdx = 0, lowIdx = 0;
        for (let i = 1; i < data.length; i++) {
            if (data[i].high > data[highIdx].high) highIdx = i;
            if (data[i].low < data[lowIdx].low) lowIdx = i;
        }

        const high = data[highIdx].high;
        const low = data[lowIdx].low;
        const range = high - low;
        const isUptrend = highIdx > lowIdx;

        const levels = {
            0: isUptrend ? high : low,
            0.236: isUptrend ? high - range * 0.236 : low + range * 0.236,
            0.382: isUptrend ? high - range * 0.382 : low + range * 0.382,
            0.5: isUptrend ? high - range * 0.5 : low + range * 0.5,
            0.618: isUptrend ? high - range * 0.618 : low + range * 0.618,
            0.786: isUptrend ? high - range * 0.786 : low + range * 0.786,
            1: isUptrend ? low : high
        };

        return { levels, high, low, isUptrend, highIdx: highIdx + start, lowIdx: lowIdx + start };
    },

    // Volume Analysis
    VolumeAnalysis(candles, period = 20) {
        if (candles.length === 0) return { volumes: [], avg: 0, ratio: 0, trend: 'neutral' };

        const volumes = candles.map(c => c.volume || 0);
        const recent = volumes.slice(-period);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const currentVol = volumes[volumes.length - 1];
        const ratio = avg > 0 ? currentVol / avg : 1;

        // Volume trend
        let trend = 'neutral';
        if (ratio > 1.5) trend = 'high';
        else if (ratio < 0.5) trend = 'low';

        // OBV (On-Balance Volume)
        const obv = [];
        let obvVal = 0;
        for (let i = 0; i < candles.length; i++) {
            if (i === 0) {
                obv.push(candles[i].volume || 0);
                obvVal = candles[i].volume || 0;
            } else {
                if (candles[i].close > candles[i - 1].close) {
                    obvVal += candles[i].volume || 0;
                } else if (candles[i].close < candles[i - 1].close) {
                    obvVal -= candles[i].volume || 0;
                }
                obv.push(obvVal);
            }
        }

        return { volumes, avg, ratio, trend, obv };
    },

    // Calculate all indicators for given candles
    calculateAll(candles) {
        const closes = candles.map(c => c.close);
        const sma20 = this.SMA(closes, 20);
        const ema9 = this.EMA(closes, 9);
        const bb = this.BollingerBands(closes, 20, 2);
        const rsi = this.RSI(closes, 14);
        const macd = this.MACD(closes, 12, 26, 9);
        const atr = this.ATR(candles, 14);
        const stoch = this.Stochastic(candles, 14, 3);
        const adx = this.ADX(candles, 14);
        const ichimoku = this.Ichimoku(candles);
        const fibonacci = this.Fibonacci(candles);
        const volume = this.VolumeAnalysis(candles);

        return { sma20, ema9, bb, rsi, macd, atr, stoch, adx, ichimoku, fibonacci, volume, closes };
    }
};
