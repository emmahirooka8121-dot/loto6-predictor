/* ===== Verification Engine ===== */

const Verifier = (() => {

  function verifyPrediction(prediction, draw) {
    const actualNums = new Set(draw.nums);
    const results = prediction.sets.map(set => {
      const matched = set.nums.filter(n => actualNums.has(n));
      const bonusMatch = set.nums.includes(draw.bonus);
      const matchCount = matched.length;
      const prize = Utils.prizeTier(matchCount, bonusMatch);
      return {
        strategy: set.strategy,
        matched,
        matchCount,
        bonusMatch,
        prize,
      };
    });

    const bestResult = results.reduce((best, r) =>
      r.matchCount > best.matchCount ? r : best, results[0]);

    return {
      targetDrawId: prediction.targetDrawId,
      drawDate: draw.date,
      actualNums: draw.nums,
      actualBonus: draw.bonus,
      results,
      bestMatch: { strategy: bestResult.strategy, matchCount: bestResult.matchCount },
      verifiedAt: new Date().toISOString(),
      learningApplied: false,
    };
  }

  function verifyAll() {
    const predictions = Storage.getPredictions();
    const allDraws = Utils.getAllDrawData();
    const drawMap = {};
    allDraws.forEach(d => drawMap[d.id] = d);

    let newVerifications = 0;

    predictions.forEach(pred => {
      if (pred.verified) return;
      const draw = drawMap[pred.targetDrawId];
      if (!draw) return;

      const verification = verifyPrediction(pred, draw);
      Storage.saveVerification(verification);
      Storage.updatePrediction(pred.targetDrawId, { verified: true });
      newVerifications++;

      // Auto-learn if enabled
      const settings = Storage.getSettings();
      if (settings.autoLearn) {
        const result = Learner.autoLearn();
        if (result) {
          verification.learningApplied = true;
          Storage.saveVerification(verification);
        }
      }
    });

    return newVerifications;
  }

  function getStats(lastN) {
    let vers = Storage.getVerifications();
    if (lastN) vers = vers.slice(0, lastN);

    if (vers.length === 0) {
      return { total: 0, avgMatch: 0, maxMatch: 0, prizeCount: {}, strategyStats: {} };
    }

    const prizeCount = {'1等':0,'2等':0,'3等':0,'4等':0,'5等':0,'ハズレ':0};
    const strategyTotals = {};
    let totalMatch = 0, maxMatch = 0, totalResults = 0;

    vers.forEach(v => {
      v.results.forEach(r => {
        totalMatch += r.matchCount;
        totalResults++;
        if (r.matchCount > maxMatch) maxMatch = r.matchCount;
        prizeCount[r.prize] = (prizeCount[r.prize] || 0) + 1;
        if (!strategyTotals[r.strategy]) {
          strategyTotals[r.strategy] = { total: 0, matchSum: 0, maxMatch: 0 };
        }
        strategyTotals[r.strategy].total++;
        strategyTotals[r.strategy].matchSum += r.matchCount;
        if (r.matchCount > strategyTotals[r.strategy].maxMatch) {
          strategyTotals[r.strategy].maxMatch = r.matchCount;
        }
      });
    });

    const strategyStats = {};
    for (const [s, data] of Object.entries(strategyTotals)) {
      strategyStats[s] = {
        total: data.total,
        avgMatch: Math.round(data.matchSum / data.total * 100) / 100,
        maxMatch: data.maxMatch,
      };
    }

    return {
      total: vers.length,
      totalResults,
      avgMatch: totalResults > 0 ? Math.round(totalMatch / totalResults * 100) / 100 : 0,
      maxMatch,
      prizeCount,
      strategyStats,
    };
  }

  return { verifyPrediction, verifyAll, getStats };
})();
