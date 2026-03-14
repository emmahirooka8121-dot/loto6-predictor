/* ===== Backtest Engine (Improvement 16) ===== */

const Backtest = (() => {
  'use strict';

  function run(data, currentWeights, lastN) {
    lastN = lastN || 100;
    const results = [];
    const maxIdx = Math.min(lastN, data.length - 20); // Need at least 20 prior draws

    for (let i = 0; i < maxIdx; i++) {
      const targetDraw = data[i];
      const priorData = data.slice(i + 1); // Only use data before this draw

      if (priorData.length < 20) continue;

      // Generate analysis from prior data
      const analysis = Analyzer.fullAnalysis(priorData);

      // Generate 5 candidates using simplified versions of algorithms
      const candidates = [];

      // Quick MC
      let bestMC = null, bestMCS = -Infinity;
      for (let t = 0; t < 5000; t++) {
        const nums = _quickWeightedSet(analysis);
        const score = _quickFitness(nums, analysis, currentWeights);
        if (score > bestMCS) { bestMCS = score; bestMC = nums; }
      }
      if (bestMC) candidates.push({ nums: bestMC, fitness: bestMCS });

      // Quick GA
      let pop = [];
      for (let p = 0; p < 50; p++) pop.push(_quickWeightedSet(analysis));
      for (let gen = 0; gen < 30; gen++) {
        const scored = pop.map(p => ({ nums: p, score: _quickFitness(p, analysis, currentWeights) }));
        scored.sort((a, b) => b.score - a.score);
        const newPop = [scored[0].nums, scored[1].nums];
        while (newPop.length < 50) {
          const p1 = scored[Math.floor(Math.random() * 10)].nums;
          const p2 = scored[Math.floor(Math.random() * 10)].nums;
          const child = _crossover(p1, p2);
          newPop.push(Math.random() < 0.2 ? _mutate(child) : child);
        }
        pop = newPop;
      }
      const gaScored = pop.map(p => ({ nums: p, score: _quickFitness(p, analysis, currentWeights) }));
      gaScored.sort((a, b) => b.score - a.score);
      candidates.push({ nums: gaScored[0].nums, fitness: gaScored[0].score });

      // Quick SA
      let current = _quickWeightedSet(analysis);
      let cs = _quickFitness(current, analysis, currentWeights);
      let best = current, bs = cs, temp = 500;
      while (temp > 1) {
        for (let t = 0; t < 20; t++) {
          const neighbor = _mutate([...current]);
          const ns = _quickFitness(neighbor, analysis, currentWeights);
          if (ns > cs || Math.random() < Math.exp((ns - cs) / temp)) { current = neighbor; cs = ns; }
          if (cs > bs) { best = current; bs = cs; }
        }
        temp *= 0.95;
      }
      candidates.push({ nums: best, fitness: bs });

      // Additional random weighted sets
      for (let t = 0; t < 2000; t++) {
        const nums = _quickWeightedSet(analysis);
        const score = _quickFitness(nums, analysis, currentWeights);
        candidates.push({ nums, fitness: score });
      }

      // Select top 5 with diversity
      candidates.sort((a, b) => b.fitness - a.fitness);
      const selected = [candidates[0]];
      for (let c = 1; c < candidates.length && selected.length < 5; c++) {
        const overlap = selected.some(s => s.nums.filter(n => candidates[c].nums.includes(n)).length >= 4);
        if (!overlap) selected.push(candidates[c]);
      }

      // Check matches
      const matchResults = selected.map(s => {
        const matched = s.nums.filter(n => targetDraw.nums.includes(n));
        const bonusMatch = s.nums.includes(targetDraw.bonus);
        return {
          nums: s.nums,
          matched,
          matchCount: matched.length,
          bonusMatch,
          prize: Utils.prizeTier(matched.length, bonusMatch),
        };
      });

      const bestResult = matchResults.reduce((b, r) => r.matchCount > b.matchCount ? r : b, matchResults[0]);

      results.push({
        drawId: targetDraw.id,
        date: targetDraw.date,
        actual: targetDraw.nums,
        predictions: matchResults,
        bestMatchCount: bestResult.matchCount,
        bestPrize: bestResult.prize,
      });
    }

    // Aggregate stats
    const totalMatches = results.reduce((s, r) => s + r.bestMatchCount, 0);
    const avgMatch = results.length > 0 ? (totalMatches / results.length).toFixed(2) : '0';
    const maxMatch = results.length > 0 ? Math.max(...results.map(r => r.bestMatchCount)) : 0;
    const prizeCount = {};
    results.forEach(r => {
      prizeCount[r.bestPrize] = (prizeCount[r.bestPrize] || 0) + 1;
    });

    const summary = {
      totalDraws: results.length,
      avgMatch,
      maxMatch,
      prizeCount,
      runAt: new Date().toISOString(),
    };

    const output = { summary, results };
    Storage.saveBacktestResults(output);
    return output;
  }

  function _quickWeightedSet(analysis) {
    const scoreMap = {};
    for (let n = 1; n <= 43; n++) {
      scoreMap[n] = (analysis.frequency[n] ? analysis.frequency[n].rate : 0) * 5 +
                    (analysis.dormancy[n] || 0) / 50 + 0.5 + Math.random() * 0.3;
    }
    return _weightedSample(scoreMap, 6);
  }

  function _weightedSample(scoreMap, k) {
    const entries = Object.entries(scoreMap).map(([n, s]) => [parseInt(n), Math.max(s, 0.001)]);
    const nums = [];
    const avail = [...entries];
    while (nums.length < k && avail.length > 0) {
      const total = avail.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total;
      for (let i = 0; i < avail.length; i++) {
        r -= avail[i][1];
        if (r <= 0) { nums.push(avail[i][0]); avail.splice(i, 1); break; }
      }
    }
    return nums.sort((a, b) => a - b);
  }

  function _quickFitness(nums, analysis, weights) {
    const sorted = [...nums].sort((a, b) => a - b);
    let score = 0;
    const freqScores = sorted.map(n => analysis.frequency[n] ? analysis.frequency[n].rate : 0);
    score += (weights.W1 || 0.16) * (freqScores.reduce((a, b) => a + b, 0) / 6) * 10;
    const maxDorm = Math.max(...Object.values(analysis.dormancy), 1);
    score += (weights.W2 || 0.12) * sorted.reduce((s, n) => s + (analysis.dormancy[n] || 0) / maxDorm, 0) / 6;
    const odd = sorted.filter(n => n % 2 === 1).length;
    score += (weights.W4 || 0.08) * (1 - Math.abs(odd - 3) / 3);
    const sum = sorted.reduce((a, b) => a + b, 0);
    score += (weights.W5 || 0.08) * Math.exp(-(sum - 132) ** 2 / 1800);
    score += (weights.W6 || 0.07) * Analyzer.calcSpreadScore(sorted);
    return score;
  }

  function _crossover(p1, p2) {
    const pool = Array.from(new Set([...p1, ...p2]));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 6).sort((a, b) => a - b);
  }

  function _mutate(nums) {
    const result = [...nums];
    const idx = Math.floor(Math.random() * 6);
    let newNum;
    do { newNum = Math.floor(Math.random() * 43) + 1; } while (result.includes(newNum));
    result[idx] = newNum;
    return result.sort((a, b) => a - b);
  }

  return { run };
})();
