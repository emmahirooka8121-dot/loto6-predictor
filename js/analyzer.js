/* ===== Statistical Analysis Engine (v2.0 - Enhanced) ===== */

const Analyzer = (() => {
  const NUM_RANGE = Array.from({length: 43}, (_, i) => i + 1);

  function _slice(data, lastN) {
    if (!lastN || lastN === 'all' || lastN >= data.length) return data;
    return data.slice(0, lastN);
  }

  function calcFrequency(data, lastN) {
    const d = _slice(data, lastN);
    const counts = {};
    NUM_RANGE.forEach(n => counts[n] = 0);
    d.forEach(draw => draw.nums.forEach(n => counts[n]++));
    const total = d.length;
    const result = {};
    NUM_RANGE.forEach(n => {
      result[n] = {
        count: counts[n],
        rate: total > 0 ? counts[n] / total : 0,
      };
    });
    return result;
  }

  function calcOddEven(data) {
    const patterns = {};
    data.forEach(draw => {
      const odd = draw.nums.filter(n => n % 2 === 1).length;
      const key = `${odd}:${6 - odd}`;
      patterns[key] = (patterns[key] || 0) + 1;
    });
    return patterns;
  }

  function calcRangeDistribution(data) {
    const ranges = {'1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-43': 0};
    let total = 0;
    data.forEach(draw => draw.nums.forEach(n => {
      total++;
      if (n <= 9) ranges['1-9']++;
      else if (n <= 19) ranges['10-19']++;
      else if (n <= 29) ranges['20-29']++;
      else if (n <= 39) ranges['30-39']++;
      else ranges['40-43']++;
    }));
    const result = {};
    for (const [k, v] of Object.entries(ranges)) {
      result[k] = { count: v, rate: total > 0 ? v / total : 0 };
    }
    return result;
  }

  function calcSumStats(data) {
    if (!data.length) return {};
    const sums = data.map(d => d.nums.reduce((a, b) => a + b, 0));
    const sorted = [...sums].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sums.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 1 ? sorted[Math.floor(n/2)] : (sorted[n/2-1] + sorted[n/2]) / 2;
    const variance = sums.reduce((acc, s) => acc + (s - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    return {
      mean: Math.round(mean * 100) / 100,
      median, std: Math.round(std * 100) / 100,
      min: sorted[0], max: sorted[n-1],
      q1: sorted[Math.floor(n/4)],
      q3: sorted[Math.floor(3*n/4)],
      distribution: _buildHistogram(sums),
    };
  }

  function _buildHistogram(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = 10;
    const start = Math.floor(min / bucketSize) * bucketSize;
    const end = Math.ceil((max+1) / bucketSize) * bucketSize;
    const buckets = {};
    for (let i = start; i < end; i += bucketSize) {
      buckets[`${i}-${i+bucketSize-1}`] = 0;
    }
    values.forEach(v => {
      const key = `${Math.floor(v / bucketSize) * bucketSize}-${Math.floor(v / bucketSize) * bucketSize + bucketSize - 1}`;
      if (buckets[key] !== undefined) buckets[key]++;
    });
    return buckets;
  }

  function calcConsecutive(data) {
    let count = 0;
    const pairs = {};
    data.forEach(draw => {
      const nums = [...draw.nums].sort((a,b) => a-b);
      let hasConsec = false;
      for (let i = 0; i < nums.length - 1; i++) {
        if (nums[i+1] - nums[i] === 1) {
          hasConsec = true;
          const key = `${nums[i]}-${nums[i+1]}`;
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
      if (hasConsec) count++;
    });
    return { count, total: data.length, rate: data.length > 0 ? count / data.length : 0, pairs };
  }

  function calcDormancy(data) {
    if (!data.length) return {};
    const latestId = data[0].id;
    const lastSeen = {};
    for (let i = data.length - 1; i >= 0; i--) {
      data[i].nums.forEach(n => lastSeen[n] = data[i].id);
    }
    const result = {};
    NUM_RANGE.forEach(n => {
      result[n] = lastSeen[n] ? latestId - lastSeen[n] : latestId;
    });
    return result;
  }

  function calcCorrelation(data, topN = 20) {
    const pairs = {};
    data.forEach(draw => {
      const nums = [...draw.nums].sort((a,b) => a-b);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${nums[i]}-${nums[j]}`;
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
    });
    return Object.entries(pairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([pair, count]) => ({ pair, count }));
  }

  function calcWeekdayTrend(data) {
    const mon = data.filter(d => new Date(d.date + 'T00:00:00').getDay() === 1);
    const thu = data.filter(d => new Date(d.date + 'T00:00:00').getDay() === 4);
    return {
      monday: { count: mon.length, frequency: calcFrequency(mon) },
      thursday: { count: thu.length, frequency: calcFrequency(thu) },
    };
  }

  function calcMovingAvg(data, window = 20) {
    if (data.length < window) return {};
    const recent = data.slice(0, window);
    const allFreq = calcFrequency(data);
    const recentFreq = calcFrequency(recent);
    const result = {};
    NUM_RANGE.forEach(n => {
      const allRate = allFreq[n].rate;
      const recentRate = recentFreq[n].rate;
      const slope = recentRate - allRate;
      result[n] = {
        allRate: Math.round(allRate * 10000) / 10000,
        recentRate: Math.round(recentRate * 10000) / 10000,
        slope: Math.round(slope * 10000) / 10000,
        trending: slope > 0.02 ? 'up' : (slope < -0.02 ? 'down' : 'stable'),
      };
    });
    return result;
  }

  // NEW: Gap analysis
  function calcGapStats(data) {
    const allGaps = [];
    let consecDraws = 0;
    let tripleConsecDraws = 0;
    data.forEach(draw => {
      const nums = [...draw.nums].sort((a,b) => a-b);
      const gaps = nums.slice(1).map((n,i) => n - nums[i]);
      allGaps.push(...gaps);
      let hasConsec = false, hasTriple = false;
      for (let i = 0; i < gaps.length; i++) {
        if (gaps[i] === 1) {
          hasConsec = true;
          if (i < gaps.length-1 && gaps[i+1] === 1) hasTriple = true;
        }
      }
      if (hasConsec) consecDraws++;
      if (hasTriple) tripleConsecDraws++;
    });
    const gapMean = allGaps.reduce((a,b)=>a+b,0)/allGaps.length;
    const gapStd = Math.sqrt(allGaps.reduce((a,v)=>a+(v-gapMean)**2,0)/allGaps.length);
    return { gapMean, gapStd, consecRate: consecDraws/data.length, tripleConsecRate: tripleConsecDraws/data.length, allGaps };
  }

  // NEW: 5-zone distribution
  function calcZoneDistribution(data) {
    const patterns = {};
    data.forEach(draw => {
      const z = [0,0,0,0,0];
      draw.nums.forEach(n => {
        if (n<=9) z[0]++; else if (n<=18) z[1]++; else if (n<=27) z[2]++;
        else if (n<=36) z[3]++; else z[4]++;
      });
      const key = z.join('-');
      patterns[key] = (patterns[key]||0) + 1;
    });
    return Object.entries(patterns).sort((a,b)=>b[1]-a[1]).slice(0,10);
  }

  // NEW: Last digit distribution
  function calcLastDigitStats(data) {
    const digitCounts = new Array(10).fill(0);
    data.forEach(draw => draw.nums.forEach(n => digitCounts[n%10]++));
    return digitCounts;
  }

  // NEW: Carryover analysis
  function calcCarryoverStats(data) {
    const distribution = new Array(7).fill(0);
    let bonusCount = 0;
    for (let i = 1; i < data.length; i++) {
      const prev = new Set(data[i-1].nums);
      const carry = data[i].nums.filter(n => prev.has(n)).length;
      distribution[carry]++;
      if (data[i].nums.includes(data[i-1].bonus)) bonusCount++;
    }
    return { distribution, bonusAppearRate: data.length > 1 ? bonusCount/(data.length-1) : 0 };
  }

  function fullAnalysis(data, lastN) {
    const d = _slice(data, lastN);
    return {
      totalDraws: d.length,
      frequency: calcFrequency(d),
      oddEven: calcOddEven(d),
      rangeDist: calcRangeDistribution(d),
      sumStats: calcSumStats(d),
      consecutive: calcConsecutive(d),
      dormancy: calcDormancy(d),
      correlation: calcCorrelation(d),
      weekdayTrend: calcWeekdayTrend(d),
      movingAvg: calcMovingAvg(d),
      gapStats: calcGapStats(d),
      zoneDistribution: calcZoneDistribution(d),
      lastDigitStats: calcLastDigitStats(d),
      carryoverStats: calcCarryoverStats(d),
    };
  }

  return {
    calcFrequency, calcOddEven, calcRangeDistribution, calcSumStats,
    calcConsecutive, calcDormancy, calcCorrelation, calcWeekdayTrend,
    calcMovingAvg, calcGapStats, calcZoneDistribution, calcLastDigitStats,
    calcCarryoverStats, fullAnalysis,
  };
})();
