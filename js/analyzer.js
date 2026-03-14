/* ===== Statistical Analysis Engine (v3 - 12 Types) ===== */

const Analyzer = (() => {
  'use strict';

  function _slice(data, lastN) {
    return lastN ? data.slice(0, lastN) : data;
  }

  // 1. Frequency (W1)
  function calcFrequency(data, lastN) {
    const d = _slice(data, lastN);
    const freq = {};
    for (let n = 1; n <= 43; n++) freq[n] = 0;
    d.forEach(draw => draw.nums.forEach(n => freq[n]++));
    const result = {};
    for (let n = 1; n <= 43; n++) {
      result[n] = { count: freq[n], rate: d.length > 0 ? freq[n] / d.length : 0 };
    }
    return result;
  }

  // 2. Dormancy (W2)
  function calcDormancy(data) {
    const dormancy = {};
    for (let n = 1; n <= 43; n++) dormancy[n] = data.length;
    for (let i = 0; i < data.length; i++) {
      data[i].nums.forEach(n => {
        if (dormancy[n] === data.length) dormancy[n] = i;
      });
    }
    return dormancy;
  }

  // 3. Odd/Even (W4)
  function calcOddEven(data, lastN) {
    const d = _slice(data, lastN);
    const patterns = {};
    d.forEach(draw => {
      const odd = draw.nums.filter(n => n % 2 === 1).length;
      const key = `${odd}:${6 - odd}`;
      patterns[key] = (patterns[key] || 0) + 1;
    });
    return patterns;
  }

  // 4. Range distribution (W7)
  function calcRangeDistribution(data, lastN) {
    const d = _slice(data, lastN);
    const ranges = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-43': 0 };
    d.forEach(draw => draw.nums.forEach(n => {
      if (n <= 9) ranges['1-9']++;
      else if (n <= 19) ranges['10-19']++;
      else if (n <= 29) ranges['20-29']++;
      else if (n <= 39) ranges['30-39']++;
      else ranges['40-43']++;
    }));
    return ranges;
  }

  // 5. Sum statistics (W5)
  function calcSumStats(data, lastN) {
    const d = _slice(data, lastN);
    if (d.length === 0) return { mean: 0, median: 0, stdDev: 0, histogram: {} };
    const sums = d.map(draw => draw.nums.reduce((a, b) => a + b, 0));
    sums.sort((a, b) => a - b);
    const mean = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
    const median = sums[Math.floor(sums.length / 2)];
    const variance = sums.reduce((s, v) => s + (v - mean) ** 2, 0) / sums.length;
    const stdDev = Math.round(Math.sqrt(variance));
    const histogram = {};
    sums.forEach(s => {
      const bin = Math.floor(s / 20) * 20;
      const label = `${bin}-${bin + 19}`;
      histogram[label] = (histogram[label] || 0) + 1;
    });
    return { mean, median, stdDev, histogram, min: sums[0], max: sums[sums.length - 1] };
  }

  // 6. Consecutive numbers (Improvement 2)
  function calcConsecutive(data, lastN) {
    const d = _slice(data, lastN);
    let withConsec = 0;
    const pairCounts = {};
    d.forEach(draw => {
      let hasConsec = false;
      const sorted = [...draw.nums].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
          hasConsec = true;
          const pair = `${sorted[i]}-${sorted[i + 1]}`;
          pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        }
      }
      if (hasConsec) withConsec++;
    });
    const rate = d.length > 0 ? withConsec / d.length : 0;
    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([pair, count]) => ({ pair, count }));
    return { rate, withConsec, total: d.length, topPairs };
  }

  // 7. Last digit analysis (Improvement 3)
  function calcLastDigit(data, lastN) {
    const d = _slice(data, lastN);
    const digits = {};
    for (let i = 0; i <= 9; i++) digits[i] = 0;
    d.forEach(draw => draw.nums.forEach(n => digits[n % 10]++));
    const total = d.length * 6;
    const result = {};
    for (let i = 0; i <= 9; i++) {
      result[i] = { count: digits[i], rate: total > 0 ? digits[i] / total : 0 };
    }
    return result;
  }

  // 8. Interval distribution / Cycle (Improvement 4, W11)
  function calcIntervalDistribution(data) {
    const dormancy = calcDormancy(data);
    const result = {};
    for (let n = 1; n <= 43; n++) {
      const indices = [];
      for (let i = 0; i < data.length; i++) {
        if (data[i].nums.includes(n)) indices.push(i);
      }
      const intervals = [];
      for (let i = 0; i < indices.length - 1; i++) {
        intervals.push(indices[i + 1] - indices[i]);
      }
      if (intervals.length >= 2) {
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const lambda = 1 / avg;
        const d = dormancy[n];
        const probNext = 1 - Math.exp(-lambda * (d + 1));
        result[n] = { avgInterval: avg, intervals, dormancy: d, probNext };
      } else {
        result[n] = { avgInterval: null, intervals, dormancy: dormancy[n], probNext: 6 / 43 };
      }
    }
    return result;
  }

  // 9. Hot/Cold cycle (Improvement 5)
  function calcHotColdCycle(data, windowSize) {
    windowSize = windowSize || 10;
    const expected = 6 / 43;
    const result = {};
    for (let n = 1; n <= 43; n++) {
      const recentSlice = data.slice(0, windowSize);
      const recentCount = recentSlice.filter(d => d.nums.includes(n)).length;
      const recentRate = windowSize > 0 ? recentCount / windowSize : 0;
      const prevSlice = data.slice(windowSize, windowSize * 2);
      const prevCount = prevSlice.filter(d => d.nums.includes(n)).length;
      const prevRate = prevSlice.length > 0 ? prevCount / prevSlice.length : 0;
      const trend = recentRate - prevRate;
      result[n] = {
        state: recentRate > expected * 1.3 ? 'hot' : recentRate < expected * 0.7 ? 'cold' : 'normal',
        recentRate, trend,
      };
    }
    return result;
  }

  // 10. Pair correlation (W8)
  function calcCorrelation(data, topN) {
    topN = topN || 20;
    const pairs = {};
    data.forEach(draw => {
      for (let i = 0; i < draw.nums.length; i++) {
        for (let j = i + 1; j < draw.nums.length; j++) {
          const key = `${draw.nums[i]}-${draw.nums[j]}`;
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
    });
    return Object.entries(pairs)
      .sort((a, b) => b[1] - a[1]).slice(0, topN)
      .map(([pair, count]) => ({ pair, count }));
  }

  // 11. Triplet correlation (Improvement 6, W12)
  function calcTriplets(data, topN) {
    topN = topN || 10;
    const trips = {};
    data.forEach(draw => {
      for (let i = 0; i < draw.nums.length; i++) {
        for (let j = i + 1; j < draw.nums.length; j++) {
          for (let k = j + 1; k < draw.nums.length; k++) {
            const key = `${draw.nums[i]}-${draw.nums[j]}-${draw.nums[k]}`;
            trips[key] = (trips[key] || 0) + 1;
          }
        }
      }
    });
    return Object.entries(trips)
      .sort((a, b) => b[1] - a[1]).slice(0, topN)
      .map(([triplet, count]) => ({ triplet, count }));
  }

  // 12. Weekday trend (W10)
  function calcWeekdayTrend(data) {
    const monday = data.filter(d => new Date(d.date + 'T00:00:00').getDay() === 1);
    const thursday = data.filter(d => new Date(d.date + 'T00:00:00').getDay() === 4);
    function freqFor(subset) {
      const freq = {};
      for (let n = 1; n <= 43; n++) freq[n] = 0;
      subset.forEach(d => d.nums.forEach(n => freq[n]++));
      const result = {};
      for (let n = 1; n <= 43; n++) {
        result[n] = { count: freq[n], rate: subset.length > 0 ? freq[n] / subset.length : 0 };
      }
      return result;
    }
    return {
      monday: { count: monday.length, frequency: freqFor(monday) },
      thursday: { count: thursday.length, frequency: freqFor(thursday) },
    };
  }

  // Trend / Moving avg
  function calcMovingAvg(data, windowSize) {
    windowSize = windowSize || 20;
    const scores = {};
    for (let n = 1; n <= 43; n++) {
      const recent = data.slice(0, windowSize);
      const older = data.slice(windowSize, windowSize * 2);
      const recentCount = recent.filter(d => d.nums.includes(n)).length;
      const olderCount = older.filter(d => d.nums.includes(n)).length;
      const recentRate = windowSize > 0 ? recentCount / windowSize : 0;
      const olderRate = older.length > 0 ? olderCount / older.length : 0;
      scores[n] = { recentRate, olderRate, slope: recentRate - olderRate };
    }
    return scores;
  }

  // Spread score helper
  function calcSpreadScore(nums) {
    if (nums.length < 2) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
    const idealGap = 42 / 5;
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return Math.max(0, 1 - Math.abs(avgGap - idealGap) / idealGap);
  }

  // Full analysis
  function fullAnalysis(data, lastN) {
    return {
      frequency: calcFrequency(data, lastN),
      dormancy: calcDormancy(data),
      oddEven: calcOddEven(data, lastN),
      rangeDist: calcRangeDistribution(data, lastN),
      sumStats: calcSumStats(data, lastN),
      consecutive: calcConsecutive(data, lastN),
      lastDigit: calcLastDigit(data, lastN),
      intervalDist: calcIntervalDistribution(data),
      hotCold: calcHotColdCycle(data),
      correlation: calcCorrelation(data),
      triplets: calcTriplets(data),
      weekdayTrend: calcWeekdayTrend(data),
      movingAvg: calcMovingAvg(data),
      sampleSize: _slice(data, lastN).length,
    };
  }

  return {
    calcFrequency, calcDormancy, calcOddEven, calcRangeDistribution,
    calcSumStats, calcConsecutive, calcLastDigit, calcIntervalDistribution,
    calcHotColdCycle, calcCorrelation, calcTriplets, calcWeekdayTrend,
    calcMovingAvg, calcSpreadScore, fullAnalysis,
  };
})();
