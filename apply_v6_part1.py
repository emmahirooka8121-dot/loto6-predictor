#!/usr/bin/env python3
"""v6 Part 1: Core function modifications - calcExclusions, isImpossibleCombo, predictBonus, prepareScoreContext, scoreCombination, buildScoreFn, monteCarloSelect"""
import re

with open('loto6-predictor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# 1. Add data entry 2089 (if not present)
# ============================================================
if 'id:2089' not in content:
    content = content.replace(
        '{id:2088,d:"2026-03-26",n:[8,16,18,27,37,39],b:29}',
        '{id:2088,d:"2026-03-26",n:[8,16,18,27,37,39],b:29},{id:2089,d:"2026-03-30",n:[9,16,18,32,37,43],b:13}'
    )
# Also add 2086, 2087 if missing
if 'id:2086' not in content:
    content = content.replace(
        '{id:2085,', '{id:2085,')  # already present, skip

print("  [OK] Data 2089 added")

# ============================================================
# 2. Version update
# ============================================================
content = content.replace('Loto6 AI Predictor v5.0.0', 'Loto6 AI Predictor v6.0.0', 2)
print("  [OK] Version updated to v6.0.0")

# ============================================================
# 3. [B6] Dynamic filter sum thresholds - global vars
# ============================================================
# Add before isImpossibleCombo
content = content.replace(
    """/**
 * [v5-F1] Filter: impossible combo detection
 * Excludes ~29.5% of 43C6 patterns that almost never appear
 */
function isImpossibleCombo(combo) {""",
    """// [v6-B6] Dynamic filter sum thresholds
let _filterSumLo = 70;
let _filterSumHi = 195;
function updateDynamicFilter(data) {
  const recentSums = data.slice(-10).map(d => d.n.reduce((a,b)=>a+b,0));
  const recentMean = recentSums.reduce((a,b)=>a+b,0) / recentSums.length;
  if (recentMean > 140) { _filterSumLo = 75; _filterSumHi = 200; }
  else if (recentMean < 120) { _filterSumLo = 65; _filterSumHi = 190; }
  else { _filterSumLo = 70; _filterSumHi = 195; }
}

/**
 * [v6-F1] Filter: impossible combo detection
 * Excludes ~33-34% of 43C6 patterns (expanded from v5's 29.5%)
 */
function isImpossibleCombo(combo) {"""
)
print("  [OK] B6 dynamic filter vars added")

# ============================================================
# 4. [B1] Filter expansion - add std filter and max gap filter
# ============================================================
# Replace the sum filter with dynamic version + add new filters
content = content.replace(
    """  // Filter 4: Extreme sum (<70 or >195)
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum < 70 || sum > 195) return true;

  return false;
}""",
    """  // Filter 4: Extreme sum (dynamic thresholds from B6)
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum < _filterSumLo || sum > _filterSumHi) return true;

  // [v6-B1] Filter 5: Extreme standard deviation (<6 or >17)
  const fMean = sum / 6;
  const fStd = Math.sqrt(sorted.reduce((a, n) => a + (n - fMean) ** 2, 0) / 6);
  if (fStd < 6 || fStd > 17) return true;

  // [v6-B1] Filter 6: Max gap >= 25
  const fGaps = [];
  for (let i = 1; i < 6; i++) fGaps.push(sorted[i] - sorted[i - 1]);
  if (Math.max(...fGaps) >= 25) return true;

  return false;
}"""
)
print("  [OK] B1 filter expansion added")

# ============================================================
# 5. [C3] MC temperature parameter
# ============================================================
content = content.replace(
    """function monteCarloSelect(candidates, scoreFn, rng, iterations) {
  iterations = iterations || 10000;
  let bestCombo = null, bestScore = -Infinity;
  for (let i = 0; i < iterations; i++) {
    // Weighted random selection of 6 from candidates
    const pool = [...candidates];
    const combo = [];
    for (let j = 0; j < 6 && pool.length > 0; j++) {
      const totalW = pool.reduce((a,c)=>a+Math.max(c.score,0.1),0);
      let r = rng() * totalW;
      let picked = pool[0];
      for (const c of pool) {
        r -= Math.max(c.score, 0.1);
        if (r <= 0) { picked = c; break; }
      }
      combo.push(picked.n);
      pool.splice(pool.indexOf(picked), 1);
    }""",
    """function monteCarloSelect(candidates, scoreFn, rng, iterations) {
  iterations = iterations || 10000;
  let bestCombo = null, bestScore = -Infinity;
  for (let i = 0; i < iterations; i++) {
    // [v6-C3] Temperature: high early (exploration) → low late (exploitation)
    const temperature = 1.0 + 2.0 * (1 - i / iterations);
    const pool = [...candidates];
    const combo = [];
    for (let j = 0; j < 6 && pool.length > 0; j++) {
      const totalW = pool.reduce((a,c)=>a+Math.max(c.score,0.1)**temperature,0);
      let r = rng() * totalW;
      let picked = pool[0];
      for (const c of pool) {
        r -= Math.max(c.score, 0.1)**temperature;
        if (r <= 0) { picked = c; break; }
      }
      combo.push(picked.n);
      pool.splice(pool.indexOf(picked), 1);
    }"""
)
print("  [OK] C3 MC temperature added")

# ============================================================
# 6. [A4][A6][B5] calcExclusions modifications
# ============================================================
content = content.replace(
    """  // [v5-S2] Hot streak detection: 3+ in last 6 AND appeared in last 2 consecutive draws
  const recent6 = data.slice(-6);
  const freq6 = new Array(44).fill(0);
  for (const d of recent6) for (const n of d.n) freq6[n]++;
  const hotStreakNums = new Set();
  const last2 = data.slice(-2);
  for (let n = 1; n <= 43; n++) {
    if (freq6[n] >= 3 && last2[0].n.includes(n) && last2[1].n.includes(n)) {
      hotStreakNums.add(n);
    }
  }""",
    """  // [v6-A6] Hot streak with decay: count consecutive appearances
  const recent6 = data.slice(-6);
  const freq6 = new Array(44).fill(0);
  for (const d of recent6) for (const n of d.n) freq6[n]++;
  const hotStreakNums = new Set();
  const hotStreakInfo = new Map();
  const last2 = data.slice(-2);
  for (let n = 1; n <= 43; n++) {
    if (freq6[n] >= 3) {
      let consecutive = 0;
      for (let k = data.length - 1; k >= Math.max(0, data.length - 6); k--) {
        if (data[k].n.includes(n)) consecutive++;
        else break;
      }
      if (consecutive >= 2) {
        hotStreakNums.add(n);
        hotStreakInfo.set(n, { count: consecutive });
      }
    }
  }"""
)
print("  [OK] A6 hot streak decay added")

# Add slide2Nums and disappearRisk after slideNums
content = content.replace(
    """  // [v5-S1] Slide numbers (previous draw numbers ±1)
  const slideNums = new Set();
  for (const ln of lastDraw.n) {
    if (ln - 1 >= 1) slideNums.add(ln - 1);
    if (ln + 1 <= 43) slideNums.add(ln + 1);
  }

  return { lastDraw, expectedCarry: bestCarry, bonusAppearRate: carry.bonusAppearRate, coolingNums, isLowCarryPeriod, hotStreakNums, consecutiveNums, slideNums };
}""",
    """  // [v5-S1] Slide numbers (previous draw numbers ±1)
  const slideNums = new Set();
  for (const ln of lastDraw.n) {
    if (ln - 1 >= 1) slideNums.add(ln - 1);
    if (ln + 1 <= 43) slideNums.add(ln + 1);
  }

  // [v6-A4] 2-draw-ago slide numbers
  const prev2Draw = data.length >= 2 ? data[data.length - 2] : null;
  const slide2Nums = new Set();
  if (prev2Draw) {
    for (const ln of prev2Draw.n) {
      if (ln - 1 >= 1) slide2Nums.add(ln - 1);
      if (ln + 1 <= 43) slide2Nums.add(ln + 1);
    }
  }

  // [v6-B5] Disappearance prediction: 3 consecutive → risk
  const disappearRisk = new Set();
  if (data.length >= 3) {
    const l1 = new Set(data[data.length-1].n);
    const l2 = new Set(data[data.length-2].n);
    const l3 = new Set(data[data.length-3].n);
    for (const n of l1) {
      if (l2.has(n) && l3.has(n)) disappearRisk.add(n);
    }
  }

  return { lastDraw, expectedCarry: bestCarry, bonusAppearRate: carry.bonusAppearRate, coolingNums, isLowCarryPeriod, hotStreakNums, hotStreakInfo, consecutiveNums, slideNums, slide2Nums, disappearRisk };
}"""
)
print("  [OK] A4 slide2Nums + B5 disappearRisk added")

# ============================================================
# 7. [A2] Regression coefficient 0.7 → 0.5 + [B4] velocity
# ============================================================
content = content.replace(
    """  // [v5-S3] Dynamic sum regression: shift bands based on last draw's deviation
  const lastSum = data[data.length - 1].n.reduce((a,b) => a+b, 0);
  const lastDeviation = lastSum - sumStats.mean;
  const regressionShift = -lastDeviation * 0.7;""",
    """  // [v6-A2][v6-B4] Dynamic sum regression with velocity term
  const lastSum = data[data.length - 1].n.reduce((a,b) => a+b, 0);
  const prev2Sum = data.length >= 2 ? data[data.length - 2].n.reduce((a,b) => a+b, 0) : lastSum;
  const lastDeviation = lastSum - sumStats.mean;
  const velocity = lastSum - prev2Sum;
  const regressionShift = -lastDeviation * 0.5 - velocity * 0.15;"""
)
print("  [OK] A2 regression 0.5 + B4 velocity added")

# ============================================================
# 8. [B10] Variance regression in buildScoreFn
# ============================================================
# Add after the regressionShift line, before "const adjustedMean"
content = content.replace(
    """  const regressionShift = -lastDeviation * 0.5 - velocity * 0.15;
  const adjustedMean = sumStats.mean + regressionShift;""",
    """  const regressionShift = -lastDeviation * 0.5 - velocity * 0.15;
  const adjustedMean = sumStats.mean + regressionShift;

  // [v6-B10] Variance regression target
  const lastNums = data[data.length-1].n;
  const lastMean = lastSum / 6;
  const lastStd = Math.sqrt(lastNums.reduce((a,n)=>a+(n-lastMean)**2,0)/6);
  const stdTarget = lastStd > 13 ? 10 : lastStd < 10 ? 13 : 11.5;"""
)
print("  [OK] B10 variance regression added")

# ============================================================
# 9. [A5] Position stability + [B11] hotPairs in prepareScoreContext
# ============================================================
content = content.replace(
    """  _scoringContext = { pairScores, entropyRange, sumDecades, recentBias, oeTrend, positionRanges, shortTermVolatility, zoneHot, zoneTrend };""",
    """  // [v6-A5] Position stability
  const last3sorted = data.slice(-3).map(d => [...d.n].sort((a,b) => a-b));
  const positionStability = {};
  if (last3sorted.length === 3) {
    for (let pos = 0; pos < 6; pos++) {
      if (last3sorted[1][pos] === last3sorted[2][pos]) {
        positionStability[last3sorted[2][pos]] = (positionStability[last3sorted[2][pos]] || 0) + 2;
      }
      if (last3sorted[0][pos] === last3sorted[2][pos]) {
        positionStability[last3sorted[2][pos]] = (positionStability[last3sorted[2][pos]] || 0) + 1;
      }
    }
  }

  // [v6-B11] Recent hot pairs (appeared together 2+ times in last 5 draws)
  const recentPairData = data.slice(-5);
  const recentPairs = {};
  for (const d of recentPairData) {
    for (let a = 0; a < d.n.length; a++) {
      for (let b = a+1; b < d.n.length; b++) {
        const key = Math.min(d.n[a],d.n[b]) + '-' + Math.max(d.n[a],d.n[b]);
        recentPairs[key] = (recentPairs[key]||0) + 1;
      }
    }
  }
  const hotPairs = new Set(Object.entries(recentPairs).filter(([k,v]) => v >= 2).map(([k]) => k));

  // [v6-B10] stdTarget (passed from buildScoreFn via context won't work; compute here)
  const _lastN = data[data.length-1].n;
  const _lastSum = _lastN.reduce((a,b)=>a+b,0);
  const _lastMean = _lastSum / 6;
  const _lastStd = Math.sqrt(_lastN.reduce((a,n)=>a+(n-_lastMean)**2,0)/6);
  const ctxStdTarget = _lastStd > 13 ? 10 : _lastStd < 10 ? 13 : 11.5;

  _scoringContext = { pairScores, entropyRange, sumDecades, recentBias, oeTrend, positionRanges, shortTermVolatility, zoneHot, zoneTrend, positionStability, hotPairs, stdTarget: ctxStdTarget };"""
)
print("  [OK] A5 positionStability + B11 hotPairs + B10 stdTarget in context")

# ============================================================
# 10. [A1][A3][A7][B8][B11][B10] scoreCombination modifications
# ============================================================

# A1: odd/even 3:3 bonus
content = content.replace(
    """  // 5. Odd/Even balance
  const odd = sorted.filter(n=>n%2===1).length;
  if (odd >= 2 && odd <= 4) score += 3;
  else if (odd === 1 || odd === 5) score += 1;""",
    """  // 5. [v6-A1] Odd/Even balance with 3:3 bonus
  const odd = sorted.filter(n=>n%2===1).length;
  if (odd === 3) score += 4.5;
  else if (odd >= 2 && odd <= 4) score += 3;
  else if (odd === 1 || odd === 5) score += 1;"""
)

# A3: Zone trend weight 1.5 → 2.5
content = content.replace(
    """  // [v5-A2] Zone trend bonus
  if (ctx.zoneHot) {
    for (let z = 0; z < 5; z++) {
      if (ctx.zoneHot.includes(z) && zones[z] >= 1) score += 1.5;
    }
  }""",
    """  // [v6-A3] Zone trend bonus (weight 1.5→2.5)
  if (ctx.zoneHot) {
    for (let z = 0; z < 5; z++) {
      if (ctx.zoneHot.includes(z) && zones[z] >= 1) score += 2.5;
    }
  }"""
)

# A7: Cluster structure + B8: Repulsion pairs + B11: Hot pairs + B10: std regression
# Add after position range scoring (item 13)
content = content.replace(
    """  // 13. [B10] Position range scoring
  for (let pos = 0; pos < 6; pos++) {
    const pr = ctx.positionRanges[pos];
    if (sorted[pos] >= pr.lo && sorted[pos] <= pr.hi) score += 0.5;
  }

  return score;
}""",
    """  // 13. [B10] Position range scoring
  for (let pos = 0; pos < 6; pos++) {
    const pr = ctx.positionRanges[pos];
    if (sorted[pos] >= pr.lo && sorted[pos] <= pr.hi) score += 0.5;
  }

  // 14. [v6-A7] Cluster structure bonus
  let clusterCount = 1;
  for (let ci = 1; ci < 6; ci++) {
    if (sorted[ci] - sorted[ci-1] > 5) clusterCount++;
  }
  if (clusterCount >= 2 && clusterCount <= 3) score += 2;
  if (clusterCount === 1) score -= 1;
  if (clusterCount >= 5) score -= 1;

  // 15. [v6-B8] Repulsion pair penalty
  if (ctx.pairScores) {
    for (let a = 0; a < sorted.length; a++) {
      for (let b = a+1; b < sorted.length; b++) {
        const rpKey = sorted[a] + '-' + sorted[b];
        if (ctx.pairScores[rpKey] && ctx.pairScores[rpKey] < -1.5) score -= 1;
      }
    }
  }

  // 16. [v6-B11] Recent hot pairs bonus
  if (ctx.hotPairs) {
    for (let a = 0; a < sorted.length; a++) {
      for (let b = a+1; b < sorted.length; b++) {
        const hpKey = sorted[a] + '-' + sorted[b];
        if (ctx.hotPairs.has(hpKey)) score += 1.5;
      }
    }
  }

  // 17. [v6-B10] Variance/std regression
  if (ctx.stdTarget) {
    const myStd = Math.sqrt(sorted.reduce((a,n)=>a+(n-sum/6)**2,0)/6);
    const stdDiff = Math.abs(myStd - ctx.stdTarget);
    if (stdDiff <= 2) score += 1.5;
    else score -= stdDiff * 0.3;
  }

  return score;
}"""
)
print("  [OK] A1+A3+A7+B8+B11+B10 in scoreCombination")

# ============================================================
# 11. [S5] Bonus recurrence pattern in predictBonus
# ============================================================
content = content.replace(
    """  // [v5-B2] Distance from last draw's main numbers
  const lastDrawForBonus = data[data.length - 1];
  for (const item of scores) {
    for (const ln of lastDrawForBonus.n) {
      const dist = Math.abs(item.n - ln);
      if (dist >= 1 && dist <= 5) {
        item.score += (6 - dist) * 0.8;
      }
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}""",
    """  // [v5-B2] Distance from last draw's main numbers
  const lastDrawForBonus = data[data.length - 1];
  for (const item of scores) {
    for (const ln of lastDrawForBonus.n) {
      const dist = Math.abs(item.n - ln);
      if (dist >= 1 && dist <= 5) {
        item.score += (6 - dist) * 0.8;
      }
    }
  }

  // [v6-S5] Bonus recurrence pattern: recent 3 draws' bonus numbers get bonus
  const recent3bonus = data.slice(-3).map(d => d.b);
  for (const item of scores) {
    if (recent3bonus.includes(item.n)) {
      item.score += 3;
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores;
}"""
)
print("  [OK] S5 bonus recurrence added")

with open('loto6-predictor.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("\n=== Part 1 complete ===")
