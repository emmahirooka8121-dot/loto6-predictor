/* ===== Prediction Engine (5 Strategies) ===== */

const Predictor = (() => {
  const NUM_RANGE = Array.from({length: 43}, (_, i) => i + 1);

  const STRATEGY_NAMES = {
    hot: 'ホット',
    cold: 'コールド',
    overdue: '出遅れ',
    balanced: 'バランス',
    composite: '統合AI',
  };

  function _weightedSample(scores, k = 6) {
    const entries = Object.entries(scores).map(([n, s]) => [parseInt(n), Math.max(s, 0.001)]);
    const selected = [];
    let available = [...entries];

    for (let i = 0; i < k && available.length > 0; i++) {
      const total = available.reduce((acc, [,w]) => acc + w, 0);
      let r = Math.random() * total;
      let chosen = available[0][0];
      for (const [n, w] of available) {
        r -= w;
        if (r <= 0) { chosen = n; break; }
      }
      selected.push(chosen);
      available = available.filter(([n]) => n !== chosen);
    }
    return selected.sort((a, b) => a - b);
  }

  function strategyHot(data, weights) {
    const recent = data.slice(0, 50);
    const freq = Analyzer.calcFrequency(recent);
    const trend = Analyzer.calcMovingAvg(data, 20);
    const corr = Analyzer.calcCorrelation(recent, 50);

    const corrScore = {};
    corr.forEach(({pair, count}) => {
      const [a, b] = pair.split('-').map(Number);
      corrScore[a] = (corrScore[a] || 0) + count;
      corrScore[b] = (corrScore[b] || 0) + count;
    });
    const maxCorr = Math.max(...Object.values(corrScore), 1);

    const scores = {};
    NUM_RANGE.forEach(n => {
      const f = freq[n]?.rate || 0;
      const t = trend[n] ? (trend[n].slope + 1) / 2 : 0.5;
      const c = (corrScore[n] || 0) / maxCorr;
      scores[n] = f * 0.6 + t * 0.3 + c * 0.1;
    });
    return _weightedSample(scores);
  }

  function strategyCold(data) {
    const freq = Analyzer.calcFrequency(data);
    const dorm = Analyzer.calcDormancy(data);
    const maxDorm = Math.max(...Object.values(dorm), 1);
    const theoreticalRate = 6 / 43;

    const scores = {};
    NUM_RANGE.forEach(n => {
      const actualRate = freq[n]?.rate || 0;
      const deviation = Math.max(theoreticalRate - actualRate, 0) / theoreticalRate;
      const d = (dorm[n] || 0) / maxDorm;
      scores[n] = deviation * 0.7 + d * 0.3;
    });
    return _weightedSample(scores);
  }

  function strategyOverdue(data) {
    const freq = Analyzer.calcFrequency(data);
    const dorm = Analyzer.calcDormancy(data);
    const maxDorm = Math.max(...Object.values(dorm), 1);
    const theoreticalRate = 6 / 43;

    const scores = {};
    NUM_RANGE.forEach(n => {
      const d = (dorm[n] || 0) / maxDorm;
      const actualRate = freq[n]?.rate || 0;
      const inv = Math.max(theoreticalRate - actualRate, 0) / theoreticalRate;
      scores[n] = d * 0.7 + inv * 0.3;
    });
    return _weightedSample(scores);
  }

  function strategyBalanced(data) {
    const freq = Analyzer.calcFrequency(data);
    const oe = Analyzer.calcOddEven(data);
    const sumStats = Analyzer.calcSumStats(data);
    const corr = Analyzer.calcCorrelation(data, 20);

    // Target odd count from most common pattern
    let targetOdd = 3;
    if (Object.keys(oe).length > 0) {
      const best = Object.entries(oe).sort((a,b) => b[1]-a[1])[0][0];
      targetOdd = parseInt(best.split(':')[0]);
    }

    const sumMin = (sumStats.mean || 132) - (sumStats.std || 30);
    const sumMax = (sumStats.mean || 132) + (sumStats.std || 30);

    const pairBoost = {};
    corr.slice(0, 20).forEach(({pair, count}) => { pairBoost[pair] = count; });

    const rangeGroups = {
      a: NUM_RANGE.filter(n => n <= 9),
      b: NUM_RANGE.filter(n => n >= 10 && n <= 19),
      c: NUM_RANGE.filter(n => n >= 20 && n <= 29),
      d: NUM_RANGE.filter(n => n >= 30 && n <= 39),
      e: NUM_RANGE.filter(n => n >= 40),
    };

    let best = null, bestScore = -1;

    for (let attempt = 0; attempt < 500; attempt++) {
      const candidate = [];
      const groups = Object.values(rangeGroups);
      // Pick one from each range group (5 numbers)
      for (const group of groups) {
        const pick = group[Math.floor(Math.random() * group.length)];
        if (!candidate.includes(pick)) candidate.push(pick);
      }
      // Fill remaining from full range
      while (candidate.length < 6) {
        const pick = NUM_RANGE[Math.floor(Math.random() * 43)];
        if (!candidate.includes(pick)) candidate.push(pick);
      }
      if (candidate.length !== 6) continue;

      candidate.sort((a,b) => a-b);
      const total = candidate.reduce((a,b) => a+b, 0);

      let score = 0;
      if (total >= sumMin && total <= sumMax) score += 3;
      const oddCount = candidate.filter(n => n % 2 === 1).length;
      if (oddCount === targetOdd) score += 2;
      for (let i = 0; i < candidate.length; i++) {
        for (let j = i+1; j < candidate.length; j++) {
          const pk = `${candidate[i]}-${candidate[j]}`;
          if (pairBoost[pk]) score += pairBoost[pk] * 0.01;
        }
      }

      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    return best || _weightedSample(Object.fromEntries(NUM_RANGE.map(n => [n, freq[n]?.rate || 0.01])));
  }

  function strategyComposite(data, weights) {
    const w = weights || Storage.getWeights();
    const wFreq = (w.frequency || 25) / 100;
    const wDorm = (w.dormancy || 20) / 100;
    const wCorr = (w.correlation || 20) / 100;
    const wTrend = (w.trend || 15) / 100;
    const wBalance = (w.balance || 10) / 100;
    const wWeekday = (w.weekday || 10) / 100;

    const recent = data.slice(0, 50);
    const freq = Analyzer.calcFrequency(recent);
    const dorm = Analyzer.calcDormancy(data);
    const maxDorm = Math.max(...Object.values(dorm), 1);
    const trend = Analyzer.calcMovingAvg(data, 20);
    const corr = Analyzer.calcCorrelation(recent, 50);
    const wdTrend = Analyzer.calcWeekdayTrend(data);

    const corrScore = {};
    corr.forEach(({pair, count}) => {
      const [a, b] = pair.split('-').map(Number);
      corrScore[a] = (corrScore[a] || 0) + count;
      corrScore[b] = (corrScore[b] || 0) + count;
    });
    const maxCorrVal = Math.max(...Object.values(corrScore), 1);

    // Determine next draw day
    const nd = Utils.nextDrawDate();
    const isMonday = nd.getDay() === 1;
    const wdFreq = isMonday ? wdTrend.monday?.frequency : wdTrend.thursday?.frequency;

    const scores = {};
    NUM_RANGE.forEach(n => {
      const f = freq[n]?.rate || 0;
      const d = (dorm[n] || 0) / maxDorm;
      const c = (corrScore[n] || 0) / maxCorrVal;
      const t = trend[n] ? (trend[n].slope + 1) / 2 : 0.5;
      const wd = wdFreq ? (wdFreq[n]?.rate || 0) : 0;
      scores[n] = f * wFreq + d * wDorm + c * wCorr + t * wTrend + wBalance + wd * wWeekday;
    });
    return _weightedSample(scores);
  }

  function generate(data) {
    if (!data || data.length === 0) return [];
    const weights = Storage.getWeights();
    const drawInfo = Utils.nextDrawInfo();
    const generatedSets = new Set();
    const strategies = [
      { name: 'hot', fn: () => strategyHot(data, weights) },
      { name: 'cold', fn: () => strategyCold(data) },
      { name: 'overdue', fn: () => strategyOverdue(data) },
      { name: 'balanced', fn: () => strategyBalanced(data) },
      { name: 'composite', fn: () => strategyComposite(data, weights) },
    ];

    const sets = [];
    for (const {name, fn} of strategies) {
      let nums;
      for (let attempt = 0; attempt < 100; attempt++) {
        nums = fn();
        const key = nums.join(',');
        if (!generatedSets.has(key)) {
          generatedSets.add(key);
          break;
        }
      }
      sets.push({ strategy: name, nums });
    }

    const prediction = {
      targetDrawId: drawInfo.id,
      targetDate: drawInfo.date,
      targetWeekday: drawInfo.weekday,
      createdAt: new Date().toISOString(),
      weightsUsed: { ...weights },
      verified: false,
      sets,
    };

    Storage.savePrediction(prediction);
    return prediction;
  }

  return { generate, STRATEGY_NAMES };
})();
