/**
 * ロトAI Ω∞ AUTONOMOUS — AI Engine
 * Core prediction algorithms for Loto6 (1-43, pick 6)
 */
var AIEngine = (function () {
  "use strict";

  var TOTAL = 43;
  var PICK = 6;
  var IDEAL_SUM = 132; // (1+43)*6/2

  // ============================================================
  //  Utility helpers
  // ============================================================

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomSet() {
    var s = [];
    while (s.length < PICK) {
      var n = randomInt(1, TOTAL);
      if (s.indexOf(n) === -1) s.push(n);
    }
    s.sort(function (a, b) { return a - b; });
    return s;
  }

  function setSum(nums) {
    var s = 0;
    for (var i = 0; i < nums.length; i++) s += nums[i];
    return s;
  }

  function entropy(nums) {
    var sum = setSum(nums);
    if (sum === 0) return 0;
    var e = 0;
    for (var i = 0; i < nums.length; i++) {
      var p = nums[i] / sum;
      if (p > 0) e -= p * Math.log2(p);
    }
    return e;
  }

  function oddCount(nums) {
    var c = 0;
    for (var i = 0; i < nums.length; i++) if (nums[i] % 2 === 1) c++;
    return c;
  }

  function oddEvenBalance(nums) {
    return 1 - Math.abs(oddCount(nums) - 3) / 3;
  }

  function sumBalance(nums) {
    return 1 - Math.abs(setSum(nums) - IDEAL_SUM) / IDEAL_SUM;
  }

  function spreadScore(nums) {
    var gaps = [];
    for (var i = 1; i < nums.length; i++) gaps.push(nums[i] - nums[i - 1]);
    var avg = (nums[nums.length - 1] - nums[0]) / (nums.length - 1);
    var dev = 0;
    for (var i = 0; i < gaps.length; i++) dev += Math.abs(gaps[i] - avg);
    return 1 / (1 + dev / nums.length);
  }

  function overlap(a, b) {
    var c = 0;
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) !== -1) c++;
    }
    return c;
  }

  // ============================================================
  //  Fitness function (shared across algorithms)
  // ============================================================

  function fitness(s, freq) {
    var freqScore = 0;
    if (freq) {
      for (var i = 0; i < s.length; i++) freqScore += (freq[s[i]] || 0);
    }
    var ent = entropy(s);
    var oeb = oddEvenBalance(s);
    var sb = sumBalance(s);
    var sp = spreadScore(s);
    return freqScore * 0.25 + ent * 2.0 + oeb * 1.5 + sb * 1.2 + sp * 1.0;
  }

  // ============================================================
  //  1. Frequency Analysis
  // ============================================================

  function buildFrequency(history) {
    var freq = new Array(TOTAL + 1).fill(0);
    if (history && history.length > 0) {
      for (var r = 0; r < history.length; r++) {
        var nums = history[r];
        for (var k = 0; k < nums.length; k++) freq[nums[k]]++;
      }
    } else {
      // Bootstrap with seeded pseudo-random simulation
      var seed = Date.now() % 999999;
      for (var r2 = 0; r2 < 500; r2++) {
        var drawn = [];
        while (drawn.length < PICK) {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          var n = (seed % TOTAL) + 1;
          if (drawn.indexOf(n) === -1) drawn.push(n);
        }
        for (var k2 = 0; k2 < drawn.length; k2++) freq[drawn[k2]]++;
      }
    }
    return freq;
  }

  // ============================================================
  //  2. Monte Carlo Simulation (100,000 iterations)
  // ============================================================

  function monteCarlo(freq, iterations) {
    iterations = iterations || 100000;
    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < iterations; i++) {
      var s = randomSet();
      var score = fitness(s, freq);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return { set: best, score: bestScore };
  }

  // ============================================================
  //  3. Genetic Algorithm
  // ============================================================

  function geneticAlgorithm(freq, options) {
    var POP_SIZE = (options && options.popSize) || 100;
    var GENERATIONS = (options && options.generations) || 80;
    var MUT_RATE = (options && options.mutRate) || 0.15;
    var ELITE = Math.max(4, Math.floor(POP_SIZE * 0.1));
    var TOURNAMENT = 5;

    // Initialize population
    var pop = [];
    for (var i = 0; i < POP_SIZE; i++) pop.push(randomSet());

    function tournamentSelect() {
      var best = null;
      var bestF = -Infinity;
      for (var t = 0; t < TOURNAMENT; t++) {
        var idx = randomInt(0, pop.length - 1);
        var f = fitness(pop[idx], freq);
        if (f > bestF) { bestF = f; best = pop[idx]; }
      }
      return best;
    }

    function crossover(p1, p2) {
      var pool = [];
      for (var k = 0; k < p1.length; k++) if (pool.indexOf(p1[k]) === -1) pool.push(p1[k]);
      for (var k2 = 0; k2 < p2.length; k2++) if (pool.indexOf(p2[k2]) === -1) pool.push(p2[k2]);
      // Shuffle
      for (var k3 = pool.length - 1; k3 > 0; k3--) {
        var j = randomInt(0, k3);
        var tmp = pool[k3]; pool[k3] = pool[j]; pool[j] = tmp;
      }
      var child = pool.slice(0, PICK);
      child.sort(function (a, b) { return a - b; });
      return child;
    }

    function mutate(s) {
      if (Math.random() >= MUT_RATE) return s;
      var copy = s.slice();
      var idx = randomInt(0, PICK - 1);
      var nn;
      do { nn = randomInt(1, TOTAL); } while (copy.indexOf(nn) !== -1);
      copy[idx] = nn;
      copy.sort(function (a, b) { return a - b; });
      return copy;
    }

    // Evolution loop
    for (var g = 0; g < GENERATIONS; g++) {
      // Sort by fitness
      pop.sort(function (a, b) { return fitness(b, freq) - fitness(a, freq); });

      var next = pop.slice(0, ELITE); // Elitism

      while (next.length < POP_SIZE) {
        var p1 = tournamentSelect();
        var p2 = tournamentSelect();
        var child = crossover(p1, p2);
        child = mutate(child);
        next.push(child);
      }
      pop = next;
    }

    pop.sort(function (a, b) { return fitness(b, freq) - fitness(a, freq); });
    return { set: pop[0], score: fitness(pop[0], freq) };
  }

  // ============================================================
  //  4. Entropy Optimization
  // ============================================================

  function entropyOptimized(freq, iterations) {
    iterations = iterations || 50000;
    var best = null;
    var bestEntropy = -Infinity;

    for (var i = 0; i < iterations; i++) {
      var s = randomSet();
      var ent = entropy(s);
      var sp = spreadScore(s);
      var score = ent * 3 + sp * 2 + oddEvenBalance(s) * 1.5 + sumBalance(s);
      if (score > bestEntropy) {
        bestEntropy = score;
        best = s;
      }
    }
    return { set: best, score: bestEntropy };
  }

  // ============================================================
  //  5. Human Bias Avoidance Model
  // ============================================================

  function humanBiasSet(freq) {
    var bestSet = null;
    var bestScore = -Infinity;

    for (var attempt = 0; attempt < 10000; attempt++) {
      var s = [];

      // Ensure at least 2 numbers from 32-43 (avoid birthday bias)
      while (s.length < 2) {
        var h = randomInt(32, TOTAL);
        if (s.indexOf(h) === -1) s.push(h);
      }

      // Fill remaining, limiting 1-31 cluster
      while (s.length < PICK) {
        var n = randomInt(1, TOTAL);
        if (s.indexOf(n) === -1) {
          var lowCount = 0;
          for (var k = 0; k < s.length; k++) if (s[k] <= 31) lowCount++;
          if (n <= 31 && lowCount >= 4) continue;
          s.push(n);
        }
      }
      s.sort(function (a, b) { return a - b; });

      var score = fitness(s, freq);
      if (score > bestScore) {
        bestScore = score;
        bestSet = s;
      }
    }
    return { set: bestSet, score: bestScore };
  }

  // ============================================================
  //  6. Portfolio Optimization (5 sets, minimize overlap)
  // ============================================================

  function generatePortfolio(freq, deepSearch) {
    var candidates = [];

    // Generate candidate pool from all algorithms
    var mcResult = monteCarlo(freq, deepSearch ? 100000 : 50000);
    candidates.push(mcResult);

    var gaResult = geneticAlgorithm(freq, deepSearch ? { popSize: 150, generations: 120 } : undefined);
    candidates.push(gaResult);

    var entResult = entropyOptimized(freq, deepSearch ? 50000 : 20000);
    candidates.push(entResult);

    var biasResult = humanBiasSet(freq);
    candidates.push(biasResult);

    // Generate extra candidates
    for (var extra = 0; extra < 20; extra++) {
      if (extra % 3 === 0) candidates.push(monteCarlo(freq, deepSearch ? 30000 : 10000));
      else if (extra % 3 === 1) candidates.push(geneticAlgorithm(freq));
      else candidates.push(entropyOptimized(freq, 10000));
    }

    // Greedy portfolio selection: pick 5 with minimum overlap
    var portfolio = [];
    var used = [];

    // Start with the best overall candidate
    candidates.sort(function (a, b) { return b.score - a.score; });
    portfolio.push(candidates[0].set);
    used.push(0);

    while (portfolio.length < 5) {
      var bestIdx = -1;
      var bestPortScore = -Infinity;

      for (var i = 0; i < candidates.length; i++) {
        if (used.indexOf(i) !== -1) continue;

        var overlapPenalty = 0;
        for (var p = 0; p < portfolio.length; p++) {
          overlapPenalty += overlap(candidates[i].set, portfolio[p]) * 4;
        }

        var portScore = candidates[i].score - overlapPenalty;
        if (portScore > bestPortScore) {
          bestPortScore = portScore;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        portfolio.push(candidates[bestIdx].set);
        used.push(bestIdx);
      } else {
        // Fallback
        portfolio.push(randomSet());
      }
    }

    return portfolio;
  }

  // ============================================================
  //  Deep AI Search mode (higher iterations)
  // ============================================================

  function deepSearch(freq) {
    return generatePortfolio(freq, true);
  }

  // ============================================================
  //  Public API
  // ============================================================

  return {
    TOTAL: TOTAL,
    PICK: PICK,
    buildFrequency: buildFrequency,
    monteCarlo: monteCarlo,
    geneticAlgorithm: geneticAlgorithm,
    entropyOptimized: entropyOptimized,
    humanBiasSet: humanBiasSet,
    generatePortfolio: generatePortfolio,
    deepSearch: deepSearch,
    fitness: fitness,
    randomSet: randomSet
  };
})();
