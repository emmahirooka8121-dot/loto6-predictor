/* ===== Verification Engine (v3) ===== */

const Verifier = (() => {
  'use strict';

  function verifyPrediction(prediction, draw) {
    const results = prediction.sets.map(set => {
      const matched = set.nums.filter(n => draw.nums.includes(n));
      const bonusMatch = set.nums.includes(draw.bonus);
      const prize = Utils.prizeTier(matched.length, bonusMatch);
      return {
        strategy: set.strategy,
        nums: set.nums,
        matched,
        matchCount: matched.length,
        bonusMatch,
        prize,
        confidence: set.confidence || 0,
      };
    });

    const bestMatch = results.reduce((best, r) =>
      r.matchCount > best.matchCount ? r : best, results[0]);

    const verification = {
      targetDrawId: prediction.targetDrawId,
      drawDate: draw.date,
      actualNums: draw.nums,
      actualBonus: draw.bonus,
      results,
      bestMatch: { strategy: bestMatch.strategy, matchCount: bestMatch.matchCount },
      verifiedAt: new Date().toISOString(),
    };

    Storage.saveVerification(verification);
    Storage.updatePrediction(prediction.targetDrawId, { verified: true });

    // Auto-learn if enabled
    const settings = Storage.getSettings();
    if (settings.autoLearn) {
      Learner.autoLearn();
    }

    return verification;
  }

  function verifyAll() {
    const predictions = Storage.getPredictions();
    const draws = Utils.getAllDrawData();
    const verifications = Storage.getVerifications();
    const verifiedIds = new Set(verifications.map(v => v.targetDrawId));

    let count = 0;
    predictions.forEach(pred => {
      if (pred.verified || verifiedIds.has(pred.targetDrawId)) return;
      const draw = draws.find(d => d.id === pred.targetDrawId);
      if (draw) {
        verifyPrediction(pred, draw);
        count++;
      }
    });
    return count;
  }

  function getStats(lastN) {
    const verifications = Storage.getVerifications();
    const data = lastN ? verifications.slice(0, lastN) : verifications;

    if (data.length === 0) {
      return { total: 0, avgMatch: '0', maxMatch: 0, prizeCount: {}, strategyStats: {} };
    }

    let totalMatch = 0;
    let totalSets = 0;
    let maxMatch = 0;
    const prizeCount = {};
    const strategyStats = {};

    data.forEach(v => {
      v.results.forEach(r => {
        totalMatch += r.matchCount;
        totalSets++;
        if (r.matchCount > maxMatch) maxMatch = r.matchCount;
        prizeCount[r.prize] = (prizeCount[r.prize] || 0) + 1;

        if (!strategyStats[r.strategy]) {
          strategyStats[r.strategy] = { total: 0, matchSum: 0, prizes: {} };
        }
        strategyStats[r.strategy].total++;
        strategyStats[r.strategy].matchSum += r.matchCount;
        strategyStats[r.strategy].prizes[r.prize] = (strategyStats[r.strategy].prizes[r.prize] || 0) + 1;
      });
    });

    // Compute averages
    for (const key of Object.keys(strategyStats)) {
      strategyStats[key].avgMatch = (strategyStats[key].matchSum / strategyStats[key].total).toFixed(2);
    }

    return {
      total: data.length,
      totalSets,
      avgMatch: totalSets > 0 ? (totalMatch / totalSets).toFixed(2) : '0',
      maxMatch,
      prizeCount,
      strategyStats,
    };
  }

  // Get accuracy trend data for chart
  function getAccuracyTrend() {
    const verifications = Storage.getVerifications();
    if (verifications.length === 0) return [];

    // Reverse to chronological order
    const sorted = [...verifications].reverse();
    const trend = [];
    let cumSum = 0;
    let cumCount = 0;

    sorted.forEach((v, idx) => {
      const avgForThis = v.results.reduce((s, r) => s + r.matchCount, 0) / v.results.length;
      cumSum += avgForThis;
      cumCount++;
      trend.push({
        drawId: v.targetDrawId,
        date: v.drawDate,
        avgMatch: avgForThis,
        cumAvg: cumSum / cumCount,
        idx: idx + 1,
      });
    });

    return trend;
  }

  return { verifyPrediction, verifyAll, getStats, getAccuracyTrend };
})();
