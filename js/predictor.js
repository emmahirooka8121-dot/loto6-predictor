/* ===== Prediction Engine (5 Strategies - v2.0 Enhanced) ===== */

const Predictor = (() => {
  const NUM_RANGE = Array.from({length: 43}, (_, i) => i + 1);

  const STRATEGY_NAMES = {
    hot: 'ホット頻度',
    cold: '逆張り回帰',
    overdue: 'マルコフ連鎖',
    balanced: '数論バランス',
    composite: 'アンサンブルAI',
  };

  // Monte Carlo scoring function
  function _scoreCombination(combo, data) {
    let score = 0;
    const sorted = [...combo].sort((a,b)=>a-b);
    const sum = sorted.reduce((a,b)=>a+b,0);
    const sumStats = Analyzer.calcSumStats(data);
    const gapStats = Analyzer.calcGapStats(data);

    // Sum proximity to mean
    const sumDev = Math.abs(sum - (sumStats.mean||132)) / (sumStats.std||30);
    if (sumDev <= 1) score += 10 * (1 - sumDev);

    // Gap analysis
    const gaps = sorted.slice(1).map((n,i) => n - sorted[i]);
    const myGapMean = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const gapDiff = Math.abs(myGapMean - gapStats.gapMean) / gapStats.gapStd;
    score += Math.max(0, 5 - gapDiff * 2);

    // Consecutive pattern
    const hasConsec = gaps.some(g=>g===1);
    if (gapStats.consecRate > 0.4 && hasConsec) score += 3;
    if (gapStats.consecRate <= 0.4 && !hasConsec) score += 2;

    // 5-zone balance
    const zones = [0,0,0,0,0];
    for (const n of sorted) {
      if (n<=9) zones[0]++; else if (n<=18) zones[1]++; else if (n<=27) zones[2]++;
      else if (n<=36) zones[3]++; else zones[4]++;
    }
    score += zones.filter(z=>z>0).length * 1.5;

    // Odd/Even
    const odd = sorted.filter(n=>n%2===1).length;
    if (odd >= 2 && odd <= 4) score += 3;

    // Last digit diversity
    const digitSet = new Set(sorted.map(n=>n%10));
    score += digitSet.size * 0.5;
    const digitCounts = {};
    sorted.forEach(n => { const d = n%10; digitCounts[d]=(digitCounts[d]||0)+1; });
    if (Object.values(digitCounts).some(c=>c>2)) score -= 3;

    return score;
  }

  function _monteCarloSelect(candidates, scoreFn, iterations) {
    iterations = iterations || 8000;
    let bestCombo = null, bestScore = -Infinity;
    for (let i = 0; i < iterations; i++) {
      const pool = [...candidates];
      const combo = [];
      for (let j = 0; j < 6 && pool.length > 0; j++) {
        const totalW = pool.reduce((a,c)=>a+Math.max(c[1],0.1),0);
        let r = Math.random() * totalW;
        let picked = pool[0];
        for (const c of pool) {
          r -= Math.max(c[1], 0.1);
          if (r <= 0) { picked = c; break; }
        }
        combo.push(picked[0]);
        pool.splice(pool.indexOf(picked), 1);
      }
      if (combo.length !== 6) continue;
      const s = scoreFn(combo);
      if (s > bestScore) { bestScore = s; bestCombo = combo; }
    }
    return bestCombo ? bestCombo.sort((a,b)=>a-b) : candidates.slice(0,6).map(c=>c[0]).sort((a,b)=>a-b);
  }

  function _getCoolingNums(data) {
    const recent5 = data.slice(0, 5);
    const freq = {};
    recent5.forEach(d => d.nums.forEach(n => freq[n]=(freq[n]||0)+1));
    const cooling = new Set();
    for (const [n, c] of Object.entries(freq)) { if (c >= 3) cooling.add(parseInt(n)); }
    return cooling;
  }

  function strategyHot(data, weights) {
    const recent = data.slice(0, 50);
    const freq = Analyzer.calcFrequency(recent);
    const trend = Analyzer.calcMovingAvg(data, 20);
    const cooling = _getCoolingNums(data);

    const scores = {};
    NUM_RANGE.forEach(n => {
      const f = freq[n]?.rate || 0;
      const t = trend[n] ? (trend[n].slope + 1) / 2 : 0.5;
      let s = f * 0.6 + t * 0.3 + Math.random() * 0.1;
      if (cooling.has(n)) s *= 0.6;
      scores[n] = s;
    });

    const candidates = Object.entries(scores).map(([n,s])=>[parseInt(n),s]).sort((a,b)=>b[1]-a[1]).slice(0,25);
    const scoreFn = (combo) => _scoreCombination(combo, data);
    return _monteCarloSelect(candidates, scoreFn);
  }

  function strategyCold(data) {
    const freq = Analyzer.calcFrequency(data);
    const dorm = Analyzer.calcDormancy(data);
    const maxDorm = Math.max(...Object.values(dorm), 1);
    const theoreticalRate = 6 / 43;
    const cooling = _getCoolingNums(data);

    const scores = {};
    NUM_RANGE.forEach(n => {
      const actualRate = freq[n]?.rate || 0;
      const deviation = Math.max(theoreticalRate - actualRate, 0) / theoreticalRate;
      const d = (dorm[n] || 0) / maxDorm;
      const overdueRatio = d > 0.3 ? (d - 0.2) * 2 : d;
      let s = deviation * 0.5 + overdueRatio * 0.4 + Math.random() * 0.1;
      if (cooling.has(n)) s *= 0.7;
      if (actualRate < theoreticalRate * 0.5 && d > 0.5) s *= 0.5;
      scores[n] = s;
    });

    const candidates = Object.entries(scores).map(([n,s])=>[parseInt(n),s]).sort((a,b)=>b[1]-a[1]).slice(0,25);
    const scoreFn = (combo) => _scoreCombination(combo, data);
    return _monteCarloSelect(candidates, scoreFn);
  }

  function strategyOverdue(data) {
    const freq = Analyzer.calcFrequency(data);
    const recent = data.slice(0, 50);
    const corr = Analyzer.calcCorrelation(recent, 50);
    const cooling = _getCoolingNums(data);

    // Markov transition
    const transition = {};
    for (let i = 1; i < data.length; i++) {
      for (const prev of data[i-1].nums) {
        if (!transition[prev]) transition[prev] = {};
        for (const curr of data[i].nums) {
          transition[prev][curr] = (transition[prev][curr]||0) + 1;
        }
      }
    }
    // Normalize
    for (const prev of Object.keys(transition)) {
      const total = Object.values(transition[prev]).reduce((a,b)=>a+b,0);
      for (const curr of Object.keys(transition[prev])) {
        transition[prev][curr] /= total;
      }
    }

    const lastDraw = data[0].nums;
    const scores = {};
    NUM_RANGE.forEach(n => {
      let markovScore = 0;
      for (const prev of lastDraw) {
        markovScore += (transition[prev]?.[n] || 0) * 2;
      }
      const f = freq[n]?.rate || 0;
      let s = markovScore * 0.5 + f * 0.3 + Math.random() * 0.2;
      if (cooling.has(n)) s *= 0.7;
      scores[n] = s;
    });

    const candidates = Object.entries(scores).map(([n,s])=>[parseInt(n),s]).sort((a,b)=>b[1]-a[1]).slice(0,25);
    const scoreFn = (combo) => _scoreCombination(combo, data);
    return _monteCarloSelect(candidates, scoreFn);
  }

  function strategyBalanced(data) {
    const freq = Analyzer.calcFrequency(data);
    const cooling = _getCoolingNums(data);

    const fibs = new Set([1,2,3,5,8,13,21,34]);
    const primes = new Set([2,3,5,7,11,13,17,19,23,29,31,37,41,43]);
    const phi = 1.618033988749895;

    const scores = {};
    NUM_RANGE.forEach(n => {
      let s = 0;
      if (fibs.has(n)) s += 0.15;
      if (primes.has(n)) s += 0.1;
      const phiDist = Math.min(...[1,2,3,4,5].map(k => Math.abs(n - Math.round(phi*k*5.3))));
      s += Math.max(0, 0.25 - phiDist * 0.05);
      s += Math.exp(-Math.pow(n-22,2)/(2*100)) * 0.15;
      s += (freq[n]?.rate || 0) * 0.2 + Math.random() * 0.15;
      if (cooling.has(n)) s *= 0.7;
      scores[n] = s;
    });

    const candidates = Object.entries(scores).map(([n,s])=>[parseInt(n),s]).sort((a,b)=>b[1]-a[1]).slice(0,25);
    const scoreFn = (combo) => _scoreCombination(combo, data);
    return _monteCarloSelect(candidates, scoreFn);
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
    const cooling = _getCoolingNums(data);

    const corrScore = {};
    corr.forEach(({pair, count}) => {
      const [a, b] = pair.split('-').map(Number);
      corrScore[a] = (corrScore[a] || 0) + count;
      corrScore[b] = (corrScore[b] || 0) + count;
    });
    const maxCorrVal = Math.max(...Object.values(corrScore), 1);

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
      let s = f * wFreq + d * wDorm + c * wCorr + t * wTrend + wBalance + wd * wWeekday;
      if (cooling.has(n)) s *= 0.7;
      s += Math.random() * 0.05;
      scores[n] = s;
    });

    const candidates = Object.entries(scores).map(([n,s])=>[parseInt(n),s]).sort((a,b)=>b[1]-a[1]).slice(0,25);
    const scoreFn = (combo) => _scoreCombination(combo, data);
    return _monteCarloSelect(candidates, scoreFn, 10000);
  }

  function generate(data) {
    if (!data || data.length === 0) return [];
    const weights = Storage.getWeights();
    const drawInfo = Utils.nextDrawInfo();
    const strategies = [
      { name: 'hot', fn: () => strategyHot(data, weights) },
      { name: 'cold', fn: () => strategyCold(data) },
      { name: 'overdue', fn: () => strategyOverdue(data) },
      { name: 'balanced', fn: () => strategyBalanced(data) },
      { name: 'composite', fn: () => strategyComposite(data, weights) },
    ];

    const sets = [];
    const allUsedNumbers = {};

    for (const {name, fn} of strategies) {
      let nums;
      for (let attempt = 0; attempt < 100; attempt++) {
        nums = fn();
        // Check diversity: no number in more than 2 patterns
        let valid = true;
        for (const n of nums) {
          if ((allUsedNumbers[n] || 0) >= 2) { valid = false; break; }
        }
        if (valid) {
          nums.forEach(n => allUsedNumbers[n] = (allUsedNumbers[n]||0)+1);
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
