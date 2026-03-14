/* ===== AI Algorithm Engine (v3) ===== */
/* MC, GA, SA, Entropy, Correlation, Trend, Overdue */

const AIEngine = (() => {
  'use strict';

  // ---- Fitness function (12 components) ----
  function fitness(nums, analysis, weights) {
    const w = weights;
    const sorted = [...nums].sort((a, b) => a - b);
    let score = 0;

    // W1: Frequency score
    const freqScores = sorted.map(n => analysis.frequency[n] ? analysis.frequency[n].rate : 0);
    score += w.W1 * (freqScores.reduce((a, b) => a + b, 0) / 6) * 10;

    // W2: Dormancy score (higher dormancy = higher score for overdue)
    const maxDorm = Math.max(...Object.values(analysis.dormancy), 1);
    const dormScores = sorted.map(n => (analysis.dormancy[n] || 0) / maxDorm);
    score += w.W2 * (dormScores.reduce((a, b) => a + b, 0) / 6);

    // W3: Entropy score (information diversity)
    const digitSet = new Set(sorted.map(n => n % 10));
    const entropyScore = digitSet.size / Math.min(6, 10);
    score += w.W3 * entropyScore;

    // W4: Odd/Even balance (ideal ~3:3)
    const odd = sorted.filter(n => n % 2 === 1).length;
    const oeScore = 1 - Math.abs(odd - 3) / 3;
    score += w.W4 * oeScore;

    // W5: Sum balance (ideal around 132)
    const sum = sorted.reduce((a, b) => a + b, 0);
    const idealSum = analysis.sumStats ? analysis.sumStats.mean || 132 : 132;
    const stdDev = analysis.sumStats ? (analysis.sumStats.stdDev || 30) : 30;
    const sumScore = Math.exp(-(sum - idealSum) ** 2 / (2 * stdDev ** 2));
    score += w.W5 * sumScore;

    // W6: Spread (even distribution)
    score += w.W6 * Analyzer.calcSpreadScore(sorted);

    // W7: Range balance
    const rangeCounts = [0, 0, 0, 0, 0]; // 1-9, 10-19, 20-29, 30-39, 40-43
    sorted.forEach(n => {
      if (n <= 9) rangeCounts[0]++;
      else if (n <= 19) rangeCounts[1]++;
      else if (n <= 29) rangeCounts[2]++;
      else if (n <= 39) rangeCounts[3]++;
      else rangeCounts[4]++;
    });
    const rangeVariance = rangeCounts.reduce((s, c) => s + (c - 1.2) ** 2, 0) / 5;
    score += w.W7 * Math.max(0, 1 - rangeVariance / 2);

    // W8: Pair correlation
    if (analysis.correlation) {
      const topPairs = new Set(analysis.correlation.slice(0, 30).map(p => p.pair));
      let pairHits = 0;
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (topPairs.has(`${sorted[i]}-${sorted[j]}`)) pairHits++;
        }
      }
      score += w.W8 * Math.min(1, pairHits / 3);
    }

    // W9: Trend score
    if (analysis.movingAvg) {
      const trendScores = sorted.map(n => {
        const ma = analysis.movingAvg[n];
        return ma ? Math.max(0, ma.slope + 0.5) : 0.5;
      });
      score += w.W9 * (trendScores.reduce((a, b) => a + b, 0) / 6);
    }

    // W10: Weekday tendency
    if (analysis.weekdayTrend) {
      const now = new Date();
      const nextDraw = Utils.nextDrawDate();
      const isMonday = nextDraw.getDay() === 1;
      const wdData = isMonday ? analysis.weekdayTrend.monday : analysis.weekdayTrend.thursday;
      if (wdData && wdData.frequency) {
        const wdScores = sorted.map(n => wdData.frequency[n] ? wdData.frequency[n].rate : 0);
        score += w.W10 * (wdScores.reduce((a, b) => a + b, 0) / 6) * 7;
      }
    }

    // W11: Cycle score (Poisson)
    if (analysis.intervalDist) {
      const cycleScores = sorted.map(n => {
        const iv = analysis.intervalDist[n];
        return iv ? iv.probNext : 6 / 43;
      });
      score += w.W11 * (cycleScores.reduce((a, b) => a + b, 0) / 6);
    }

    // W12: Triplet score
    if (analysis.triplets) {
      const topTrips = new Set(analysis.triplets.slice(0, 20).map(t => t.triplet));
      let tripHits = 0;
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          for (let k = j + 1; k < sorted.length; k++) {
            if (topTrips.has(`${sorted[i]}-${sorted[j]}-${sorted[k]}`)) tripHits++;
          }
        }
      }
      score += w.W12 * Math.min(1, tripHits / 2);
    }

    return score;
  }

  // ---- Confidence score (Improvement 8) ----
  function calcConfidence(nums, analysis, weights) {
    const components = _getComponentScores(nums, analysis, weights);
    const aboveMedian = components.filter(c => c.score >= 0.5).length;
    return Math.round((aboveMedian / components.length) * 100);
  }

  function _getComponentScores(nums, analysis, weights) {
    const sorted = [...nums].sort((a, b) => a - b);
    const scores = [];

    // Frequency component
    const freqScores = sorted.map(n => analysis.frequency[n] ? analysis.frequency[n].rate : 0);
    scores.push({ name: 'freq', score: Math.min(1, (freqScores.reduce((a, b) => a + b, 0) / 6) * 7) });

    // Dormancy component
    const maxDorm = Math.max(...Object.values(analysis.dormancy), 1);
    const dormScores = sorted.map(n => (analysis.dormancy[n] || 0) / maxDorm);
    scores.push({ name: 'dormancy', score: dormScores.reduce((a, b) => a + b, 0) / 6 });

    // Entropy
    const digitSet = new Set(sorted.map(n => n % 10));
    scores.push({ name: 'entropy', score: digitSet.size / Math.min(6, 10) });

    // Odd/Even
    const odd = sorted.filter(n => n % 2 === 1).length;
    scores.push({ name: 'oddEven', score: 1 - Math.abs(odd - 3) / 3 });

    // Sum
    const sum = sorted.reduce((a, b) => a + b, 0);
    const idealSum = analysis.sumStats ? analysis.sumStats.mean || 132 : 132;
    scores.push({ name: 'sum', score: Math.exp(-(sum - idealSum) ** 2 / (2 * 900)) });

    // Spread
    scores.push({ name: 'spread', score: Analyzer.calcSpreadScore(sorted) });

    // Range balance
    const rc = [0, 0, 0, 0, 0];
    sorted.forEach(n => { if (n <= 9) rc[0]++; else if (n <= 19) rc[1]++; else if (n <= 29) rc[2]++; else if (n <= 39) rc[3]++; else rc[4]++; });
    scores.push({ name: 'range', score: Math.max(0, 1 - rc.reduce((s, c) => s + (c - 1.2) ** 2, 0) / 10) });

    // Pair
    if (analysis.correlation) {
      const topP = new Set(analysis.correlation.slice(0, 30).map(p => p.pair));
      let ph = 0;
      for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) if (topP.has(`${sorted[i]}-${sorted[j]}`)) ph++;
      scores.push({ name: 'pair', score: Math.min(1, ph / 3) });
    } else { scores.push({ name: 'pair', score: 0 }); }

    // Trend
    if (analysis.movingAvg) {
      const ts = sorted.map(n => { const m = analysis.movingAvg[n]; return m ? Math.max(0, Math.min(1, m.slope + 0.5)) : 0.5; });
      scores.push({ name: 'trend', score: ts.reduce((a, b) => a + b, 0) / 6 });
    } else { scores.push({ name: 'trend', score: 0.5 }); }

    // Weekday
    scores.push({ name: 'weekday', score: 0.5 });

    // Cycle
    if (analysis.intervalDist) {
      const cs = sorted.map(n => { const iv = analysis.intervalDist[n]; return iv ? iv.probNext : 6 / 43; });
      scores.push({ name: 'cycle', score: cs.reduce((a, b) => a + b, 0) / 6 });
    } else { scores.push({ name: 'cycle', score: 0.14 }); }

    // Triplet
    scores.push({ name: 'triplet', score: 0 });

    return scores;
  }

  // ---- Random set generator ----
  function _randomSet() {
    const nums = [];
    while (nums.length < 6) {
      const n = Math.floor(Math.random() * 43) + 1;
      if (!nums.includes(n)) nums.push(n);
    }
    return nums.sort((a, b) => a - b);
  }

  // ---- Weighted random set ----
  function _weightedRandomSet(scoreMap) {
    const entries = Object.entries(scoreMap).map(([n, s]) => [parseInt(n), Math.max(s, 0.001)]);
    const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
    const nums = [];
    const available = [...entries];
    while (nums.length < 6 && available.length > 0) {
      let r = Math.random() * available.reduce((s, [, w]) => s + w, 0);
      for (let i = 0; i < available.length; i++) {
        r -= available[i][1];
        if (r <= 0) {
          nums.push(available[i][0]);
          available.splice(i, 1);
          break;
        }
      }
    }
    return nums.sort((a, b) => a - b);
  }

  // ---- 1. Monte Carlo Simulation ----
  function monteCarlo(analysis, weights, iterations) {
    iterations = iterations || 50000;
    const scoreMap = {};
    for (let n = 1; n <= 43; n++) {
      scoreMap[n] = (analysis.frequency[n] ? analysis.frequency[n].rate : 0) * 5 +
                    (analysis.intervalDist && analysis.intervalDist[n] ? analysis.intervalDist[n].probNext : 0.14) +
                    (analysis.movingAvg && analysis.movingAvg[n] ? Math.max(0, analysis.movingAvg[n].slope + 0.5) : 0.5);
    }

    let bestSet = null;
    let bestScore = -Infinity;

    for (let i = 0; i < iterations; i++) {
      const set = _weightedRandomSet(scoreMap);
      const score = fitness(set, analysis, weights);
      if (score > bestScore) {
        bestScore = score;
        bestSet = set;
      }
    }
    return { nums: bestSet, fitness: bestScore };
  }

  // ---- 2. Genetic Algorithm ----
  function geneticAlgorithm(analysis, weights, options) {
    const popSize = (options && options.popSize) || 150;
    const generations = (options && options.generations) || 100;
    const mutationRate = 0.15;
    const eliteCount = Math.max(2, Math.floor(popSize * 0.1));

    // Build score map for initial population
    const scoreMap = {};
    for (let n = 1; n <= 43; n++) {
      scoreMap[n] = (analysis.frequency[n] ? analysis.frequency[n].rate : 0) * 3 + 0.5;
    }

    // Initialize population
    let population = [];
    for (let i = 0; i < popSize; i++) {
      population.push(_weightedRandomSet(scoreMap));
    }

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      const scored = population.map(p => ({ nums: p, score: fitness(p, analysis, weights) }));
      scored.sort((a, b) => b.score - a.score);

      const newPop = [];
      // Elitism
      for (let i = 0; i < eliteCount; i++) newPop.push(scored[i].nums);

      // Fill rest with crossover + mutation
      while (newPop.length < popSize) {
        // Tournament selection
        const parent1 = _tournament(scored, 5);
        const parent2 = _tournament(scored, 5);
        let child = _crossover(parent1, parent2);
        // Adaptive mutation (higher in later generations)
        const adaptiveMR = mutationRate * (1 + gen / generations);
        if (Math.random() < adaptiveMR) child = _mutate(child);
        newPop.push(child);
      }

      // Diversity injection every 20 generations
      if (gen > 0 && gen % 20 === 0) {
        for (let i = popSize - 5; i < popSize; i++) {
          newPop[i] = _weightedRandomSet(scoreMap);
        }
      }

      population = newPop;
    }

    // Return best
    const final = population.map(p => ({ nums: p, score: fitness(p, analysis, weights) }));
    final.sort((a, b) => b.score - a.score);
    return { nums: final[0].nums, fitness: final[0].score };
  }

  function _tournament(scored, k) {
    let best = null;
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * scored.length);
      if (!best || scored[idx].score > best.score) best = scored[idx];
    }
    return best.nums;
  }

  function _crossover(p1, p2) {
    const pool = new Set([...p1, ...p2]);
    const arr = Array.from(pool);
    // Shuffle and pick 6
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 6).sort((a, b) => a - b);
  }

  function _mutate(nums) {
    const result = [...nums];
    const idx = Math.floor(Math.random() * 6);
    let newNum;
    do { newNum = Math.floor(Math.random() * 43) + 1; } while (result.includes(newNum));
    result[idx] = newNum;
    return result.sort((a, b) => a - b);
  }

  // ---- 3. Simulated Annealing (Improvement 7) ----
  function simulatedAnnealing(analysis, weights, options) {
    const initTemp = (options && options.initTemp) || 1000;
    const coolRate = (options && options.coolRate) || 0.995;
    const trialsPerTemp = (options && options.trials) || 100;

    let current = _randomSet();
    let currentScore = fitness(current, analysis, weights);
    let best = current;
    let bestScore = currentScore;
    let temp = initTemp;

    while (temp > 0.1) {
      for (let i = 0; i < trialsPerTemp; i++) {
        const neighbor = _mutate([...current]);
        const neighborScore = fitness(neighbor, analysis, weights);
        const delta = neighborScore - currentScore;
        if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
          current = neighbor;
          currentScore = neighborScore;
          if (currentScore > bestScore) {
            best = current;
            bestScore = currentScore;
          }
        }
      }
      temp *= coolRate;
    }
    return { nums: best, fitness: bestScore };
  }

  // ---- 4. Entropy Optimization ----
  function entropyOptimization(analysis, weights, iterations) {
    iterations = iterations || 30000;
    let bestSet = null;
    let bestScore = -Infinity;

    for (let i = 0; i < iterations; i++) {
      // Build set emphasizing entropy (digit diversity) + dormancy + range
      const nums = [];
      const usedDigits = new Set();
      const usedRanges = new Set();

      while (nums.length < 6) {
        let candidates = [];
        for (let n = 1; n <= 43; n++) {
          if (nums.includes(n)) continue;
          let bonus = 0;
          const digit = n % 10;
          if (!usedDigits.has(digit)) bonus += 2;
          const range = Math.floor((n - 1) / 10);
          if (!usedRanges.has(range)) bonus += 1;
          const dormScore = (analysis.dormancy[n] || 0) / 50;
          candidates.push({ n, weight: 1 + bonus + dormScore + Math.random() * 0.5 });
        }
        candidates.sort((a, b) => b.weight - a.weight);
        const chosen = candidates[0].n;
        nums.push(chosen);
        usedDigits.add(chosen % 10);
        usedRanges.add(Math.floor((chosen - 1) / 10));
      }

      nums.sort((a, b) => a - b);
      const score = fitness(nums, analysis, weights);
      if (score > bestScore) {
        bestScore = score;
        bestSet = nums;
      }
    }
    return { nums: bestSet, fitness: bestScore };
  }

  // ---- 5. Correlation-based selection ----
  function correlationBased(analysis, weights) {
    const topPairs = analysis.correlation.slice(0, 15);
    const topTrips = analysis.triplets ? analysis.triplets.slice(0, 5) : [];

    let bestSet = null;
    let bestScore = -Infinity;

    for (let trial = 0; trial < 5000; trial++) {
      const nums = new Set();

      // Start with a high-correlation pair or triplet
      if (topTrips.length > 0 && Math.random() < 0.4) {
        const trip = topTrips[Math.floor(Math.random() * topTrips.length)];
        trip.triplet.split('-').map(Number).forEach(n => nums.add(n));
      } else if (topPairs.length > 0) {
        const pair = topPairs[Math.floor(Math.random() * topPairs.length)];
        pair.pair.split('-').map(Number).forEach(n => nums.add(n));
      }

      // Fill remaining with weighted random
      while (nums.size < 6) {
        const n = Math.floor(Math.random() * 43) + 1;
        nums.add(n);
      }

      const sorted = Array.from(nums).sort((a, b) => a - b).slice(0, 6);
      const score = fitness(sorted, analysis, weights);
      if (score > bestScore) {
        bestScore = score;
        bestSet = sorted;
      }
    }
    return { nums: bestSet, fitness: bestScore };
  }

  // ---- 6. Trend-following selection ----
  function trendFollowing(analysis, weights) {
    const hotCold = analysis.hotCold;
    const movingAvg = analysis.movingAvg;
    const scoreMap = {};

    for (let n = 1; n <= 43; n++) {
      let s = 1;
      if (hotCold && hotCold[n]) {
        if (hotCold[n].state === 'hot') s += 3;
        s += hotCold[n].trend * 5;
      }
      if (movingAvg && movingAvg[n]) {
        s += Math.max(0, movingAvg[n].slope * 10);
      }
      scoreMap[n] = Math.max(s, 0.01);
    }

    let bestSet = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 10000; i++) {
      const set = _weightedRandomSet(scoreMap);
      const score = fitness(set, analysis, weights);
      if (score > bestScore) {
        bestScore = score;
        bestSet = set;
      }
    }
    return { nums: bestSet, fitness: bestScore };
  }

  // ---- 7. Overdue regression selection ----
  function overdueRegression(analysis, weights) {
    const intervalDist = analysis.intervalDist;
    const dormancy = analysis.dormancy;
    const scoreMap = {};

    for (let n = 1; n <= 43; n++) {
      let s = 1;
      if (intervalDist && intervalDist[n]) {
        s += intervalDist[n].probNext * 5;
      }
      s += (dormancy[n] || 0) / 20;
      scoreMap[n] = Math.max(s, 0.01);
    }

    let bestSet = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 10000; i++) {
      const set = _weightedRandomSet(scoreMap);
      const score = fitness(set, analysis, weights);
      if (score > bestScore) {
        bestScore = score;
        bestSet = set;
      }
    }
    return { nums: bestSet, fitness: bestScore };
  }

  // ---- Generate all candidates ----
  function generateCandidates(data, advancedMode) {
    const weights = Storage.getWeights();
    const analysis = Analyzer.fullAnalysis(data);
    const candidates = [];

    const mcIter = advancedMode ? 200000 : 50000;
    const gaOpts = advancedMode ? { popSize: 300, generations: 200 } : { popSize: 150, generations: 100 };
    const entIter = advancedMode ? 100000 : 30000;

    // Run all algorithms
    candidates.push({ ...monteCarlo(analysis, weights, mcIter), algo: 'MC' });
    candidates.push({ ...geneticAlgorithm(analysis, weights, gaOpts), algo: 'GA' });
    candidates.push({ ...simulatedAnnealing(analysis, weights), algo: 'SA' });
    candidates.push({ ...entropyOptimization(analysis, weights, entIter), algo: 'Entropy' });
    candidates.push({ ...correlationBased(analysis, weights), algo: 'Corr' });
    candidates.push({ ...trendFollowing(analysis, weights), algo: 'Trend' });
    candidates.push({ ...overdueRegression(analysis, weights), algo: 'Overdue' });

    // Run additional rounds for more candidates
    const extraRounds = advancedMode ? 8 : 4;
    for (let r = 0; r < extraRounds; r++) {
      candidates.push({ ...monteCarlo(analysis, weights, mcIter / 2), algo: 'MC' });
      candidates.push({ ...geneticAlgorithm(analysis, weights, { popSize: gaOpts.popSize / 2, generations: gaOpts.generations / 2 }), algo: 'GA' });
      candidates.push({ ...simulatedAnnealing(analysis, weights, { initTemp: 500, coolRate: 0.99, trials: 50 }), algo: 'SA' });
      candidates.push({ ...entropyOptimization(analysis, weights, entIter / 2), algo: 'Entropy' });
      candidates.push({ ...trendFollowing(analysis, weights), algo: 'Trend' });
      candidates.push({ ...overdueRegression(analysis, weights), algo: 'Overdue' });
    }

    // Add confidence score
    candidates.forEach(c => {
      c.confidence = calcConfidence(c.nums, analysis, weights);
    });

    return { candidates, analysis, weights };
  }

  return {
    fitness, calcConfidence, generateCandidates,
    monteCarlo, geneticAlgorithm, simulatedAnnealing,
    entropyOptimization, correlationBased, trendFollowing, overdueRegression,
  };
})();
