#!/usr/bin/env python3
"""v6 Part 2: Pattern scoring updates (A4,A5,A6,A8,B2,B3,B5 in all patterns) + new functions (selectCoreNumbers, predictStableA/B, calcPurchaseScore, calcPatternExpectedHits)"""

with open('loto6-predictor.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# Helper: Build the v6 scoring block for attack patterns (P1-P3)
# This replaces the old hotStreak/slide/consecutive scoring in each pattern
# ============================================================
V6_SCORING_BLOCK_ATTACK = """    // [v6-A6] Hot streak with decay
    if (excl.hotStreakInfo && excl.hotStreakInfo.has(i)) {
      const hsInfo = excl.hotStreakInfo.get(i);
      if (hsInfo.count === 2) score += 3;
      else if (hsInfo.count === 3) score += 1;
      else if (hsInfo.count >= 4) score -= 2;
    } else if (excl.coolingNums.has(i)) { score *= 0.85; }
    if (excl.slideNums && excl.slideNums.has(i) && !excl.lastDraw.n.includes(i)) score += 3;
    if (excl.consecutiveNums && excl.consecutiveNums.has(i)) score += 4;
    // [v6-A4] 2-draw-ago slide
    if (excl.slide2Nums && excl.slide2Nums.has(i) && !excl.lastDraw.n.includes(i) && !(data.length>=2 && data[data.length-2].n.includes(i))) score += 1.5;
    // [v6-B5] Disappearance risk (attack patterns only)
    if (excl.disappearRisk && excl.disappearRisk.has(i)) score -= 1;
    // [v6-A5] Position stability
    const _ctx = prepareScoreContext(data);
    if (_ctx.positionStability && _ctx.positionStability[i]) score += _ctx.positionStability[i];
    // [v6-B2] Long-term cold regression preparation bonus
    if (iv && iv.since >= iv.avg * 1.2 && iv.since <= iv.avg * 1.8) score += 2;
    // [v6-A8] Compound condition bonus
    let _strongConds = 0;
    if (excl.slideNums && excl.slideNums.has(i) && !excl.lastDraw.n.includes(i)) _strongConds++;
    if (excl.hotStreakInfo && excl.hotStreakInfo.has(i)) _strongConds++;
    if (excl.consecutiveNums && excl.consecutiveNums.has(i)) _strongConds++;
    if (excl.slide2Nums && excl.slide2Nums.has(i)) _strongConds++;
    if (_ctx.positionStability && _ctx.positionStability[i]) _strongConds++;
    if (_strongConds >= 2) score += 2;
    if (_strongConds >= 3) score += 3;"""

# We also need a modified B3 (bonus→main conditional) block:
V6_B3_BLOCK = """    // [v6-B3] Bonus→main conditional scoring
    for (let r = 0; r < recent3.length; r++) {
      const bNum = recent3[recent3.length-1-r].b;
      if (i === bNum) {
        const bIdx = data.indexOf(recent3[recent3.length-1-r]);
        if (bIdx >= 0 && bIdx + 1 < data.length && data[bIdx+1].n.includes(bNum)) {
          score += (3-r);
        } else {
          score += Math.max(0, 1-r*0.3);
        }
      }
    }"""

# ============================================================
# Pattern 1: Replace scoring block
# ============================================================
OLD_P1_SCORING = """    // [S6] Relaxed cooling
    if (excl.hotStreakNums && excl.hotStreakNums.has(i)) { score += 3; }
    else if (excl.coolingNums.has(i)) { score *= 0.85; }
    if (excl.slideNums && excl.slideNums.has(i) && !excl.lastDraw.n.includes(i)) score += 3;
    if (excl.consecutiveNums && excl.consecutiveNums.has(i)) score += 4;
    // [A8] Low carry period
    if (excl.isLowCarryPeriod && excl.lastDraw.n.includes(i)) score *= 0.7;
    // [B8] Set ball + rising
    if (setBall.hotBySet.includes(i)) score += 3;
    if (setBall.risingBySet.includes(i)) score += 2;
    // [C4] Day of week bonus with sample size correction
    if (targetDay === 1 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].monday * 5 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].thursday * 5 * dw;
    // [A2] Middle layer bonus
    const iv = intervals[i];
    const isMiddle = !excl.coolingNums.has(i) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[i] >= 4 && freq50[i] <= 9;
    if (isMiddle) score += 2;
    // [B9] Bonus history
    for (let r = 0; r < recent3.length; r++) { if (i === recent3[recent3.length-1-r].b) score += (3-r); }
    // [A5] Halved noise
    score += rng() * 1.0;"""

NEW_P1_SCORING = """    // [A8] Low carry period
    if (excl.isLowCarryPeriod && excl.lastDraw.n.includes(i)) score *= 0.7;
    // [B8] Set ball + rising
    if (setBall.hotBySet.includes(i)) score += 3;
    if (setBall.risingBySet.includes(i)) score += 2;
    // [C4] Day of week bonus with sample size correction
    if (targetDay === 1 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].monday * 5 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].thursday * 5 * dw;
    // [A2] Middle layer bonus
    const iv = intervals[i];
    const isMiddle = !excl.coolingNums.has(i) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[i] >= 4 && freq50[i] <= 9;
    if (isMiddle) score += 2;
""" + V6_SCORING_BLOCK_ATTACK + "\n" + V6_B3_BLOCK + """
    // [A5] Halved noise
    score += rng() * 1.0;"""

content = content.replace(OLD_P1_SCORING, NEW_P1_SCORING)
print("  [OK] Pattern 1 scoring updated")

# ============================================================
# Pattern 2: Replace scoring block
# ============================================================
OLD_P2_SCORING = """    if (excl.hotStreakNums && excl.hotStreakNums.has(i)) { score += 3; }
    else if (excl.coolingNums.has(i)) { score *= 0.85; }
    if (excl.slideNums && excl.slideNums.has(i) && !excl.lastDraw.n.includes(i)) score += 3;
    if (excl.consecutiveNums && excl.consecutiveNums.has(i)) score += 4;
    if (excl.isLowCarryPeriod && excl.lastDraw.n.includes(i)) score *= 0.7;
    const peri = periodicities[i];
    if (peri && peri.confidence > 0.3 && peri.isAlmostDue) score += 5;
    if (targetDay === 1 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].monday * 3 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].thursday * 3 * dw;
    const isMiddle = !excl.coolingNums.has(i) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[i] >= 4 && freq50[i] <= 9;
    if (isMiddle) score += 2;
    for (let r = 0; r < recent3.length; r++) { if (i === recent3[recent3.length-1-r].b) score += (3-r); }
    score += rng() * 1.0;"""

NEW_P2_SCORING = """    if (excl.isLowCarryPeriod && excl.lastDraw.n.includes(i)) score *= 0.7;
    const peri = periodicities[i];
    if (peri && peri.confidence > 0.3 && peri.isAlmostDue) score += 5;
    if (targetDay === 1 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].monday * 3 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[i]) score += dayPattern.dayBias[i].thursday * 3 * dw;
    const isMiddle = !excl.coolingNums.has(i) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[i] >= 4 && freq50[i] <= 9;
    if (isMiddle) score += 2;
""" + V6_SCORING_BLOCK_ATTACK.replace("    const iv = intervals[i];\n", "").replace("if (iv && iv.since", "if (iv.since") + "\n" + V6_B3_BLOCK + """
    score += rng() * 1.0;"""

# Need to handle the iv variable already declared in P2
# In P2, iv is already declared as `const iv = intervals[i];` earlier in the loop
# So we need to be more careful - the V6_SCORING_BLOCK already references iv
content = content.replace(OLD_P2_SCORING, NEW_P2_SCORING)
print("  [OK] Pattern 2 scoring updated")

# ============================================================
# Pattern 3: Replace scoring block (Markov)
# ============================================================
OLD_P3_SCORING = """    if (lastDraw.includes(n) && rng() < excl.expectedCarry / 6) score += 5;
    // [B11] Bonus→main reduced
    if (n === excl.lastDraw.b && rng() < excl.bonusAppearRate) score += 1.5;
    if (excl.coolingNums.has(n)) score *= 0.85;
    if (excl.isLowCarryPeriod && lastDraw.includes(n)) score *= 0.7;
    // [B4] Transition bonus strengthened
    if (transitionCandidates.has(n)) score += 5;
    if (targetDay === 1 && dayPattern.dayBias[n]) score += dayPattern.dayBias[n].monday * 3 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[n]) score += dayPattern.dayBias[n].thursday * 3 * dw;
    const iv = intervals[n];
    const isMiddle = !excl.coolingNums.has(n) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[n] >= 4 && freq50[n] <= 9;
    if (isMiddle) score += 2;
    for (let r = 0; r < recent3.length; r++) { if (n === recent3[recent3.length-1-r].b) score += (3-r); }
    score += rng() * 1.0;"""

# Build P3 version (uses 'n' instead of 'i')
V6_P3_SCORING = V6_SCORING_BLOCK_ATTACK.replace('(i)', '(n)').replace('[i]', '[n]').replace('.has(i)', '.has(n)').replace('includes(i)', 'includes(n)')
V6_P3_B3 = V6_B3_BLOCK.replace('i === bNum', 'n === bNum')

NEW_P3_SCORING = """    if (lastDraw.includes(n) && rng() < excl.expectedCarry / 6) score += 5;
    // [B11] Bonus→main reduced
    if (n === excl.lastDraw.b && rng() < excl.bonusAppearRate) score += 1.5;
    if (excl.isLowCarryPeriod && lastDraw.includes(n)) score *= 0.7;
    // [B4] Transition bonus strengthened
    if (transitionCandidates.has(n)) score += 5;
    if (targetDay === 1 && dayPattern.dayBias[n]) score += dayPattern.dayBias[n].monday * 3 * dw;
    else if (targetDay === 4 && dayPattern.dayBias[n]) score += dayPattern.dayBias[n].thursday * 3 * dw;
    const iv = intervals[n];
    const isMiddle = !excl.coolingNums.has(n) && iv.since >= iv.avg * 0.3 && iv.since <= iv.avg * 1.3 && freq50[n] >= 4 && freq50[n] <= 9;
    if (isMiddle) score += 2;
""" + V6_P3_SCORING.replace("    const iv = intervals[i];\n", "").replace("    const iv = intervals[n];\n", "").replace("if (iv && iv.since", "if (iv.since") + "\n" + V6_P3_B3 + """
    score += rng() * 1.0;"""

content = content.replace(OLD_P3_SCORING, NEW_P3_SCORING)
print("  [OK] Pattern 3 scoring updated")

# ============================================================
# Pattern 4 (old number theory) - will be replaced by stableA
# Pattern 5 (old ensemble) - will be replaced by stableB
# But we keep the old functions for backtest comparison,
# and add new predictStableA/B functions
# ============================================================

# ============================================================
# Add new functions before generatePredictions
# ============================================================
NEW_FUNCTIONS = """
// ============================================================
// [v6-S2] Core number selection for stable patterns
// ============================================================
function selectCoreNumbers(data, type) {
  const lastDraw = data[data.length - 1];
  const prev2Draw = data.length >= 2 ? data[data.length - 2] : null;
  const coreScores = [];
  const recent6 = data.slice(-6);
  const freq6 = new Array(44).fill(0);
  for (const d of recent6) for (const n of d.n) freq6[n]++;
  const last2 = data.slice(-2);
  const last3sorted = data.slice(-3).map(d => [...d.n].sort((a,b) => a-b));
  const recent5 = data.slice(-5);
  const zoneTrend = [0,0,0,0,0];
  for (const d of recent5) for (const num of d.n) {
    if (num<=9) zoneTrend[0]++; else if (num<=18) zoneTrend[1]++;
    else if (num<=27) zoneTrend[2]++; else if (num<=36) zoneTrend[3]++;
    else zoneTrend[4]++;
  }

  for (let n = 1; n <= 43; n++) {
    let score = 0;
    const inLast = lastDraw.n.includes(n);
    const inPrev2 = prev2Draw && prev2Draw.n.includes(n);
    if (inLast && inPrev2) score += 5;
    else if (inLast) score += 3;
    if (freq6[n] >= 3 && last2[0].n.includes(n) && last2[1].n.includes(n)) {
      let consecutive = 0;
      for (let k = data.length - 1; k >= Math.max(0, data.length - 6); k--) {
        if (data[k].n.includes(n)) consecutive++; else break;
      }
      if (consecutive === 2) score += 4;
      else if (consecutive === 3) score += 2;
      else if (consecutive >= 4) score += 0;
    }
    const isSlide = lastDraw.n.some(ln => Math.abs(ln - n) === 1) && !inLast;
    const isSlide2 = prev2Draw && prev2Draw.n.some(ln => Math.abs(ln - n) === 1) && !inLast && !(prev2Draw.n.includes(n));
    if (isSlide) score += (type === 'B' ? 4 : 2);
    if (isSlide2) score += 1.5;
    if (last3sorted.length === 3) {
      for (let pos = 0; pos < 6; pos++) {
        if (last3sorted[1][pos] === n && last3sorted[2][pos] === n) score += 3;
        else if (last3sorted[0][pos] === n && last3sorted[2][pos] === n) score += 1.5;
      }
    }
    const nZone = n<=9?0:n<=18?1:n<=27?2:n<=36?3:4;
    if (zoneTrend[nZone] > 7.2) score += 2;
    if (score > 0) coreScores.push({ n, score });
  }
  coreScores.sort((a, b) => b.score - a.score);
  const cores = coreScores.slice(0, 3).map(c => c.n);
  if (cores.length < 3) {
    const freq50 = calcFrequency(data, 50);
    for (let n = 1; n <= 43 && cores.length < 3; n++) {
      if (!cores.includes(n) && freq50[n] >= 6) cores.push(n);
    }
  }
  return cores;
}

// ============================================================
// [v6-S3] Stable Pattern A (carryover-focused)
// ============================================================
function predictStableA(data, rng, targetDay) {
  const cores = selectCoreNumbers(data, 'A');
  const excl = calcExclusions(data);
  const intervals = calcIntervals(data);
  const freq50 = calcFrequency(data, 50);
  const dynFreq = calcDynamicFrequency(data);
  const coreSum = cores.reduce((a,b) => a+b, 0);
  const coreOdd = cores.filter(n => n%2===1).length;
  const coreZones = [0,0,0,0,0];
  for (const n of cores) {
    if (n<=9) coreZones[0]++; else if (n<=18) coreZones[1]++;
    else if (n<=27) coreZones[2]++; else if (n<=36) coreZones[3]++;
    else coreZones[4]++;
  }
  const targetSum = 132;
  const remainOdd = 3 - coreOdd;
  const candidates = [];
  for (let n = 1; n <= 43; n++) {
    if (cores.includes(n)) continue;
    let score = dynFreq[n] * 10 + freq50[n] * 1.5;
    const nZone = n<=9?0:n<=18?1:n<=27?2:n<=36?3:4;
    if (coreZones[nZone] === 0) score += 3;
    const isOdd = n % 2 === 1;
    if (remainOdd > 0 && isOdd) score += 1.5;
    else if (remainOdd <= 0 && !isOdd) score += 1.5;
    if (excl.slideNums && excl.slideNums.has(n) && !excl.lastDraw.n.includes(n)) score += 2;
    if (excl.consecutiveNums && excl.consecutiveNums.has(n)) score += 3;
    if (excl.hotStreakInfo && excl.hotStreakInfo.has(n)) {
      const hs = excl.hotStreakInfo.get(n);
      if (hs.count === 2) score += 2;
      else if (hs.count === 3) score += 1;
    } else if (excl.coolingNums.has(n)) score *= 0.85;
    let condCount = 0;
    if (excl.slideNums && excl.slideNums.has(n)) condCount++;
    if (excl.hotStreakInfo && excl.hotStreakInfo.has(n)) condCount++;
    if (excl.consecutiveNums && excl.consecutiveNums.has(n)) condCount++;
    if (condCount >= 2) score += 2;
    if (condCount >= 3) score += 5;
    const iv = intervals[n];
    if (iv && iv.since >= iv.avg * 1.2 && iv.since <= iv.avg * 1.8) score += 2;
    score += rng() * 0.8;
    candidates.push({ n, score });
  }
  candidates.sort((a,b) => b.score - a.score);
  const scoreFn = buildScoreFn(data, 3);
  const pool = candidates.slice(0, 15);
  let bestCombo = null, bestScore = -Infinity;
  for (let it = 0; it < 10000; it++) {
    const varPool = [...pool];
    const varNums = [];
    for (let j = 0; j < 3 && varPool.length > 0; j++) {
      const totalW = varPool.reduce((a,c) => a + Math.max(c.score, 0.1), 0);
      let r = rng() * totalW;
      let picked = varPool[0];
      for (const c of varPool) { r -= Math.max(c.score, 0.1); if (r <= 0) { picked = c; break; } }
      varNums.push(picked.n);
      varPool.splice(varPool.indexOf(picked), 1);
    }
    const combo = [...cores, ...varNums];
    if (combo.length !== 6) continue;
    if (isImpossibleCombo(combo)) continue;
    const s = scoreFn(combo);
    if (s > bestScore) { bestScore = s; bestCombo = combo; }
  }
  const numbers = bestCombo ? bestCombo.sort((a,b) => a-b) : [...cores, ...candidates.slice(0,3).map(c=>c.n)].sort((a,b)=>a-b);
  const bonusScores = predictBonus(data, numbers);
  const bonus = bonusScores.length > 0 ? bonusScores[Math.floor(rng()*Math.min(3,bonusScores.length))].n : 1;
  return { numbers, bonus, cores };
}

// ============================================================
// [v6-S3b] Stable Pattern B (slide-focused)
// ============================================================
function predictStableB(data, rng, targetDay, sharedCores) {
  const allCoresB = selectCoreNumbers(data, 'B');
  // Share 2 cores with pattern A, differ on 3rd
  let cores;
  if (sharedCores && sharedCores.length >= 2) {
    const shared2 = sharedCores.slice(0, 2);
    const third = allCoresB.find(c => !shared2.includes(c)) || allCoresB[allCoresB.length - 1];
    cores = [...shared2, third];
  } else {
    cores = allCoresB.slice(0, 3);
  }
  const excl = calcExclusions(data);
  const intervals = calcIntervals(data);
  const freq50 = calcFrequency(data, 50);
  const dynFreq = calcDynamicFrequency(data);
  const coreOdd = cores.filter(n => n%2===1).length;
  const coreZones = [0,0,0,0,0];
  for (const n of cores) {
    if (n<=9) coreZones[0]++; else if (n<=18) coreZones[1]++;
    else if (n<=27) coreZones[2]++; else if (n<=36) coreZones[3]++;
    else coreZones[4]++;
  }
  const remainOdd = 3 - coreOdd;
  const candidates = [];
  for (let n = 1; n <= 43; n++) {
    if (cores.includes(n)) continue;
    let score = dynFreq[n] * 10 + freq50[n] * 1.5;
    const nZone = n<=9?0:n<=18?1:n<=27?2:n<=36?3:4;
    if (coreZones[nZone] === 0) score += 3;
    const isOdd = n % 2 === 1;
    if (remainOdd > 0 && isOdd) score += 1.5;
    else if (remainOdd <= 0 && !isOdd) score += 1.5;
    // Slide-focused: stronger slide bonus
    if (excl.slideNums && excl.slideNums.has(n) && !excl.lastDraw.n.includes(n)) score += 4;
    if (excl.slide2Nums && excl.slide2Nums.has(n) && !excl.lastDraw.n.includes(n)) score += 2;
    if (excl.consecutiveNums && excl.consecutiveNums.has(n)) score += 2;
    if (excl.hotStreakInfo && excl.hotStreakInfo.has(n)) {
      const hs = excl.hotStreakInfo.get(n);
      if (hs.count === 2) score += 2;
      else if (hs.count === 3) score += 1;
    } else if (excl.coolingNums.has(n)) score *= 0.85;
    const iv = intervals[n];
    if (iv && iv.since >= iv.avg * 1.2 && iv.since <= iv.avg * 1.8) score += 2;
    score += rng() * 0.8;
    candidates.push({ n, score });
  }
  candidates.sort((a,b) => b.score - a.score);
  const scoreFn = buildScoreFn(data, 4);
  const pool = candidates.slice(0, 15);
  let bestCombo = null, bestScore = -Infinity;
  for (let it = 0; it < 10000; it++) {
    const varPool = [...pool];
    const varNums = [];
    for (let j = 0; j < 3 && varPool.length > 0; j++) {
      const totalW = varPool.reduce((a,c) => a + Math.max(c.score, 0.1), 0);
      let r = rng() * totalW;
      let picked = varPool[0];
      for (const c of varPool) { r -= Math.max(c.score, 0.1); if (r <= 0) { picked = c; break; } }
      varNums.push(picked.n);
      varPool.splice(varPool.indexOf(picked), 1);
    }
    const combo = [...cores, ...varNums];
    if (combo.length !== 6) continue;
    if (isImpossibleCombo(combo)) continue;
    const s = scoreFn(combo);
    if (s > bestScore) { bestScore = s; bestCombo = combo; }
  }
  const numbers = bestCombo ? bestCombo.sort((a,b) => a-b) : [...cores, ...candidates.slice(0,3).map(c=>c.n)].sort((a,b)=>a-b);
  const bonusScores = predictBonus(data, numbers);
  const bonus = bonusScores.length > 0 ? bonusScores[Math.floor(rng()*Math.min(3,bonusScores.length))].n : 1;
  return { numbers, bonus, cores };
}

// ============================================================
// [v6-S4] Purchase recommendation score
// ============================================================
function calcPurchaseScore(data) {
  let score = 50;
  const excl = calcExclusions(data);
  if (excl.hotStreakNums && excl.hotStreakNums.size >= 2) score += 15;
  const carry = calcCarryoverStats(data);
  const recentCarry = carry.carryCounts.slice(-3);
  const avgCarry = recentCarry.length > 0 ? recentCarry.reduce((a,b)=>a+b,0) / recentCarry.length : 1;
  if (avgCarry >= 2) score += 15;
  const coFlag = LS.get('carryoverFlag') || false;
  if (coFlag) score += 10;
  const lastSum = data[data.length-1].n.reduce((a,b)=>a+b,0);
  const sumStats = calcSumStats(data);
  if (Math.abs(lastSum - sumStats.mean) > sumStats.std * 0.8) score += 5;
  const recent3 = data.slice(-3);
  const oe33count = recent3.filter(d => d.n.filter(n=>n%2===1).length === 3).length;
  if (oe33count >= 2) score += 5;
  return Math.min(100, score);
}

// ============================================================
// [v6-A9] Pattern expected hits (cached)
// ============================================================
let _patternExpCache = null;
function calcPatternExpectedHits(data) {
  if (_patternExpCache && _patternExpCache.dataLen === data.length) return _patternExpCache.result;
  const history = LS.get('predHistory') || [];
  const dataMap = {};
  for (const d of data) dataMap[d.id] = d;
  const patternHits = [[],[],[],[],[]];
  for (const pred of history) {
    const actual = dataMap[pred.round];
    if (!actual) continue;
    for (let i = 0; i < Math.min(5, pred.predictions.length); i++) {
      const hits = pred.predictions[i].numbers.filter(n => actual.n.includes(n)).length;
      patternHits[i].push(hits);
    }
  }
  const result = [];
  for (let i = 0; i < 5; i++) {
    if (patternHits[i].length < 3) { result.push(null); continue; }
    const total = patternHits[i].length;
    const g5 = patternHits[i].filter(h => h >= 3).length;
    const g4 = patternHits[i].filter(h => h >= 4).length;
    result.push({ total, g5rate: (g5/total*100).toFixed(1), g4rate: (g4/total*100).toFixed(1), avg: (patternHits[i].reduce((a,b)=>a+b,0)/total).toFixed(2) });
  }
  _patternExpCache = { dataLen: data.length, result };
  return result;
}

"""

# Insert before generatePredictions
content = content.replace(
    "function generatePredictions(targetDate, targetRound) {",
    NEW_FUNCTIONS + "function generatePredictions(targetDate, targetRound) {"
)
print("  [OK] New functions added (selectCoreNumbers, predictStableA/B, calcPurchaseScore, calcPatternExpectedHits)")

with open('loto6-predictor.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("\n=== Part 2 complete ===")
