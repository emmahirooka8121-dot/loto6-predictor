/* ===== Auto-Learning Engine (v3 - W1-W12) ===== */

const Learner = (() => {
  'use strict';

  const LEARNING_RATE = 0.1;
  const MIN_SAMPLES = 3;
  const MIN_WEIGHT = 0.03;
  const MAX_WEIGHT = 0.25;

  const WEIGHT_KEYS = ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'];

  // Strategy to weight factor mapping
  const STRATEGY_BOOSTS = {
    optimal: ['W1','W8','W9'],
    trend: ['W9','W5','W6'],
    overdue: ['W2','W11','W4'],
    correlation: ['W8','W12','W3'],
    balanced: ['W6','W7','W4','W5'],
  };

  function autoLearn() {
    const verifications = Storage.getVerifications();
    if (verifications.length < MIN_SAMPLES) return null;

    const currentWeights = Storage.getWeights();
    const previousWeights = { ...currentWeights };

    // Calculate strategy performance
    const stratPerf = {};
    verifications.forEach(v => {
      v.results.forEach(r => {
        if (!stratPerf[r.strategy]) stratPerf[r.strategy] = { sum: 0, count: 0 };
        stratPerf[r.strategy].sum += r.matchCount;
        stratPerf[r.strategy].count++;
      });
    });

    // Find best performing strategy
    let bestStrategy = null;
    let bestAvg = 0;
    for (const [strat, perf] of Object.entries(stratPerf)) {
      const avg = perf.sum / perf.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestStrategy = strat;
      }
    }

    if (!bestStrategy) return null;

    // Calculate overall average
    let totalSum = 0, totalCount = 0;
    for (const perf of Object.values(stratPerf)) {
      totalSum += perf.sum;
      totalCount += perf.count;
    }
    const overallAvg = totalCount > 0 ? totalSum / totalCount : 0;

    // Adjust weights based on best strategy
    const newWeights = { ...currentWeights };
    const boostKeys = STRATEGY_BOOSTS[bestStrategy] || [];

    // Boost weights associated with best strategy
    for (const key of WEIGHT_KEYS) {
      const isBoost = boostKeys.includes(key);
      if (isBoost && bestAvg > overallAvg) {
        // Increase this weight
        newWeights[key] += LEARNING_RATE * (bestAvg - overallAvg) * 0.02;
      } else if (!isBoost && bestAvg > overallAvg) {
        // Slightly decrease non-boost weights
        newWeights[key] -= LEARNING_RATE * (bestAvg - overallAvg) * 0.005;
      }
    }

    // Clamp weights
    for (const key of WEIGHT_KEYS) {
      newWeights[key] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeights[key]));
    }

    // Normalize to sum to 1.0
    const total = WEIGHT_KEYS.reduce((s, k) => s + newWeights[k], 0);
    for (const key of WEIGHT_KEYS) {
      newWeights[key] = parseFloat((newWeights[key] / total).toFixed(4));
    }

    // Ensure sum is exactly 1.0
    const finalTotal = WEIGHT_KEYS.reduce((s, k) => s + newWeights[k], 0);
    if (Math.abs(finalTotal - 1.0) > 0.001) {
      newWeights.W1 += 1.0 - finalTotal;
    }

    Storage.saveWeights(newWeights);

    // Save learning entry
    const entry = {
      learnedAt: new Date().toISOString(),
      triggerDrawId: verifications[0].targetDrawId,
      bestStrategy,
      bestAvg: bestAvg,
      overallAvg,
      previousWeights,
      newWeights: { ...newWeights },
      sampleCount: verifications.length,
    };
    Storage.saveLearningEntry(entry);

    return entry;
  }

  function resetWeights() {
    Storage.saveWeights({ ...Storage.DEFAULT_WEIGHTS });
  }

  function getStatus() {
    const verifications = Storage.getVerifications();
    const history = Storage.getLearningHistory();
    const currentWeights = Storage.getWeights();
    const previousWeights = history.length > 0 ? history[0].previousWeights : null;

    // Find best strategy
    const stratPerf = {};
    verifications.forEach(v => {
      v.results.forEach(r => {
        if (!stratPerf[r.strategy]) stratPerf[r.strategy] = { sum: 0, count: 0 };
        stratPerf[r.strategy].sum += r.matchCount;
        stratPerf[r.strategy].count++;
      });
    });

    let bestStrategy = null;
    let bestStrategyAvg = 0;
    for (const [strat, perf] of Object.entries(stratPerf)) {
      const avg = perf.sum / perf.count;
      if (avg > bestStrategyAvg) {
        bestStrategyAvg = avg;
        bestStrategy = strat;
      }
    }

    // Max match
    let maxMatch = 0;
    verifications.forEach(v => {
      v.results.forEach(r => {
        if (r.matchCount > maxMatch) maxMatch = r.matchCount;
      });
    });

    return {
      learningCount: history.length,
      totalSamples: verifications.length,
      currentWeights,
      previousWeights,
      bestStrategy,
      bestStrategyAvg,
      maxMatch,
      recentHistory: history.slice(0, 10),
    };
  }

  return { autoLearn, resetWeights, getStatus };
})();
