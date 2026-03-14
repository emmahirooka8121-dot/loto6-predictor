/* ===== Prediction Engine (v3 - 5 Strategies + Portfolio) ===== */

const Predictor = (() => {
  'use strict';

  const STRATEGY_NAMES = {
    optimal: 'AI最適解',
    trend: 'トレンド重視',
    overdue: '出遅れ回帰',
    correlation: '高相関ネットワーク',
    balanced: '分散バランス',
  };

  const STRATEGY_KEYS = ['optimal', 'trend', 'overdue', 'correlation', 'balanced'];

  // Calculate overlap between two number sets
  function _overlap(a, b) {
    return a.filter(n => b.includes(n)).length;
  }

  // Portfolio optimization: select 5 sets minimizing overlap
  function _portfolioSelect(candidates, analysis, weights) {
    if (candidates.length < 5) return candidates.slice(0, 5);

    // Sort by fitness descending
    candidates.sort((a, b) => b.fitness - a.fitness);

    // Assign strategy preferences
    const strategyScorers = {
      optimal: (c) => c.fitness,
      trend: (c) => {
        let s = c.fitness;
        c.nums.forEach(n => {
          if (analysis.hotCold && analysis.hotCold[n] && analysis.hotCold[n].state === 'hot') s += 0.1;
          if (analysis.movingAvg && analysis.movingAvg[n]) s += analysis.movingAvg[n].slope;
        });
        return s;
      },
      overdue: (c) => {
        let s = c.fitness;
        c.nums.forEach(n => {
          if (analysis.intervalDist && analysis.intervalDist[n]) s += analysis.intervalDist[n].probNext * 0.5;
          s += (analysis.dormancy[n] || 0) / 100;
        });
        return s;
      },
      correlation: (c) => {
        let s = c.fitness;
        const topPairs = new Set((analysis.correlation || []).slice(0, 20).map(p => p.pair));
        for (let i = 0; i < c.nums.length; i++) {
          for (let j = i + 1; j < c.nums.length; j++) {
            if (topPairs.has(`${c.nums[i]}-${c.nums[j]}`)) s += 0.2;
          }
        }
        return s;
      },
      balanced: (c) => {
        let s = c.fitness;
        s += Analyzer.calcSpreadScore(c.nums) * 0.5;
        const odd = c.nums.filter(n => n % 2 === 1).length;
        s += (1 - Math.abs(odd - 3) / 3) * 0.3;
        const digitSet = new Set(c.nums.map(n => n % 10));
        s += digitSet.size / 10 * 0.2;
        return s;
      },
    };

    const selected = [];
    const usedIndices = new Set();

    for (const strategy of STRATEGY_KEYS) {
      const scorer = strategyScorers[strategy];
      // Score all unused candidates for this strategy
      let bestIdx = -1;
      let bestStratScore = -Infinity;

      for (let i = 0; i < candidates.length; i++) {
        if (usedIndices.has(i)) continue;
        let stratScore = scorer(candidates[i]);

        // Penalize overlap with already selected sets
        for (const sel of selected) {
          stratScore -= _overlap(candidates[i].nums, sel.nums) * 0.3;
        }

        if (stratScore > bestStratScore) {
          bestStratScore = stratScore;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        usedIndices.add(bestIdx);
        selected.push({
          nums: candidates[bestIdx].nums,
          strategy,
          fitness: candidates[bestIdx].fitness,
          confidence: candidates[bestIdx].confidence || 0,
          algo: candidates[bestIdx].algo,
        });
      }
    }

    return selected;
  }

  // Calculate coverage (unique numbers across all 5 sets)
  function _calcCoverage(sets) {
    const allNums = new Set();
    sets.forEach(s => s.nums.forEach(n => allNums.add(n)));
    return allNums.size;
  }

  // Main generate function
  function generate(data, advancedMode) {
    const { candidates, analysis, weights } = AIEngine.generateCandidates(data, advancedMode);
    const selected = _portfolioSelect(candidates, analysis, weights);
    const coverage = _calcCoverage(selected);

    // Check for consecutive numbers (Improvement 2)
    const consecRate = analysis.consecutive ? analysis.consecutive.rate : 0.6;
    selected.forEach(s => {
      // ~60% chance to include a consecutive pair based on historical rate
      if (Math.random() < consecRate) {
        const sorted = [...s.nums].sort((a, b) => a - b);
        let hasConsec = false;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i + 1] - sorted[i] === 1) { hasConsec = true; break; }
        }
        // Already has consecutive - fine. If not, don't force it.
      }
    });

    const info = Utils.nextDrawInfo();
    const prediction = {
      targetDrawId: info.id,
      targetDate: info.date,
      targetWeekday: info.weekday,
      createdAt: new Date().toISOString(),
      mode: advancedMode ? 'advanced' : 'normal',
      sets: selected,
      coverage,
      verified: false,
    };

    Storage.savePrediction(prediction);
    return prediction;
  }

  return { generate, STRATEGY_NAMES, STRATEGY_KEYS };
})();
