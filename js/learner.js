/* ===== Auto-Learning Engine ===== */

const Learner = (() => {
  const LEARNING_RATE = 0.1;
  const MIN_SAMPLES = 3;
  const MIN_WEIGHT = 5;
  const MAX_WEIGHT = 50;

  const STRATEGY_FACTOR_MAP = {
    hot: 'frequency',
    cold: 'dormancy',     // cold doing well means dormancy matters
    overdue: 'dormancy',
    balanced: 'balance',
    composite: 'correlation',
  };

  function autoLearn() {
    const verifications = Storage.getVerifications();
    if (verifications.length < MIN_SAMPLES) return null;

    const currentWeights = Storage.getWeights();
    const beforeWeights = { ...currentWeights };

    // Calculate average match count per strategy
    const strategyScores = {};
    const strategyCounts = {};

    verifications.forEach(v => {
      v.results.forEach(r => {
        if (!strategyScores[r.strategy]) {
          strategyScores[r.strategy] = 0;
          strategyCounts[r.strategy] = 0;
        }
        strategyScores[r.strategy] += r.matchCount;
        strategyCounts[r.strategy]++;
      });
    });

    const avgScores = {};
    for (const s of Object.keys(strategyScores)) {
      avgScores[s] = strategyCounts[s] > 0 ? strategyScores[s] / strategyCounts[s] : 0;
    }

    // Find best strategy
    let bestStrategy = 'composite';
    let bestScore = 0;
    for (const [s, score] of Object.entries(avgScores)) {
      if (score > bestScore) { bestScore = score; bestStrategy = s; }
    }

    // Calculate total average
    const totalAvg = Object.values(avgScores).reduce((a,b) => a+b, 0) / Object.keys(avgScores).length || 1;

    // Adjust weights based on strategy performance
    const weightKeys = ['frequency', 'dormancy', 'correlation', 'trend', 'balance', 'weekday'];
    const targetWeights = { ...currentWeights };

    for (const [strategy, score] of Object.entries(avgScores)) {
      const factor = STRATEGY_FACTOR_MAP[strategy];
      if (!factor || targetWeights[factor] === undefined) continue;

      const ratio = totalAvg > 0 ? score / totalAvg : 1;
      // If this strategy is performing above average, increase its associated weight
      if (ratio > 1) {
        targetWeights[factor] = Math.min(MAX_WEIGHT, targetWeights[factor] * (1 + (ratio - 1) * 0.3));
      } else {
        targetWeights[factor] = Math.max(MIN_WEIGHT, targetWeights[factor] * (1 - (1 - ratio) * 0.15));
      }
    }

    // Apply learning rate for smooth transition
    const newWeights = {};
    for (const key of weightKeys) {
      const current = currentWeights[key] || 10;
      const target = targetWeights[key] || 10;
      newWeights[key] = Math.round(current + LEARNING_RATE * (target - current));
      newWeights[key] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeights[key]));
    }

    // Normalize to 100%
    const total = Object.values(newWeights).reduce((a,b) => a+b, 0);
    for (const key of weightKeys) {
      newWeights[key] = Math.round(newWeights[key] / total * 100);
    }
    // Fix rounding to ensure exactly 100
    const sum = Object.values(newWeights).reduce((a,b) => a+b, 0);
    if (sum !== 100) {
      const maxKey = weightKeys.reduce((a, b) => newWeights[a] >= newWeights[b] ? a : b);
      newWeights[maxKey] += 100 - sum;
    }

    // Check if anything changed
    const changed = weightKeys.some(k => newWeights[k] !== beforeWeights[k]);
    if (!changed) return null;

    // Save
    Storage.saveWeights(newWeights);

    // Record learning history
    const entry = {
      learnedAt: new Date().toISOString(),
      triggerDrawId: verifications[0]?.targetDrawId,
      beforeWeights,
      afterWeights: { ...newWeights },
      strategyScores: avgScores,
      bestStrategy,
      totalSamples: verifications.length,
    };
    Storage.saveLearningEntry(entry);

    return entry;
  }

  function resetWeights() {
    Storage.saveWeights({ ...Storage.DEFAULT_SETTINGS.weights });
  }

  function getStatus() {
    const history = Storage.getLearningHistory();
    const weights = Storage.getWeights();
    const verifications = Storage.getVerifications();

    // Find previous weights for comparison
    let previousWeights = null;
    if (history.length > 0) {
      previousWeights = history[0].beforeWeights;
    }

    return {
      currentWeights: weights,
      previousWeights,
      learningCount: history.length,
      totalSamples: verifications.length,
      recentHistory: history.slice(0, 5),
      bestStrategy: history.length > 0 ? history[0].bestStrategy : null,
      bestStrategyAvg: history.length > 0 ? history[0].strategyScores?.[history[0].bestStrategy] : null,
    };
  }

  return { autoLearn, resetWeights, getStatus };
})();
