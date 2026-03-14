/* ===== localStorage Operations (v3 Enhanced - W1-W12) ===== */

const Storage = (() => {
  'use strict';

  const KEYS = {
    userDraws: 'loto6_user_draws',
    predictions: 'loto6_predictions',
    verifications: 'loto6_verifications',
    settings: 'loto6_settings',
    learningHistory: 'loto6_learning_history',
    schedulerState: 'loto6_scheduler',
    backtestResults: 'loto6_backtest',
  };

  const DEFAULT_WEIGHTS = {
    W1: 0.16,  // freq
    W2: 0.12,  // dormancy
    W3: 0.08,  // entropy
    W4: 0.08,  // oddEven
    W5: 0.08,  // sumBalance
    W6: 0.07,  // spread
    W7: 0.07,  // range
    W8: 0.08,  // correlation
    W9: 0.07,  // trend
    W10: 0.05, // weekday
    W11: 0.07, // cycle
    W12: 0.07, // triplet
  };

  const WEIGHT_LABELS = {
    W1: '出現頻度', W2: '出遅れ度', W3: 'エントロピー', W4: '奇偶バランス',
    W5: '合計値バランス', W6: '分散', W7: '番号帯', W8: 'ペア相関',
    W9: 'トレンド', W10: '曜日傾向', W11: '出現周期', W12: 'トリプレット',
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    autoLearn: true,
    weights: { ...DEFAULT_WEIGHTS },
  };

  function _get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }

  function _set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
  }

  function getUserDraws() { return _get(KEYS.userDraws, []); }
  function saveUserDraw(draw) {
    const draws = getUserDraws();
    const idx = draws.findIndex(d => d.id === draw.id);
    if (idx >= 0) draws[idx] = draw; else draws.push(draw);
    draws.sort((a, b) => b.id - a.id);
    _set(KEYS.userDraws, draws);
  }

  function getPredictions() { return _get(KEYS.predictions, []); }
  function savePrediction(pred) {
    const preds = getPredictions();
    preds.unshift(pred);
    _set(KEYS.predictions, preds);
  }
  function updatePrediction(targetDrawId, updates) {
    const preds = getPredictions();
    const idx = preds.findIndex(p => p.targetDrawId === targetDrawId);
    if (idx >= 0) Object.assign(preds[idx], updates);
    _set(KEYS.predictions, preds);
  }

  function getVerifications() { return _get(KEYS.verifications, []); }
  function saveVerification(ver) {
    const vers = getVerifications();
    const idx = vers.findIndex(v => v.targetDrawId === ver.targetDrawId);
    if (idx >= 0) vers[idx] = ver; else vers.unshift(ver);
    _set(KEYS.verifications, vers);
  }

  function getSettings() {
    const s = _get(KEYS.settings, null);
    if (!s) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    return {
      theme: s.theme || DEFAULT_SETTINGS.theme,
      autoLearn: s.autoLearn !== undefined ? s.autoLearn : true,
      weights: { ...DEFAULT_WEIGHTS, ...(s.weights || {}) },
    };
  }

  function saveSettings(s) { _set(KEYS.settings, s); }

  function getWeights() { return getSettings().weights; }
  function saveWeights(w) {
    const s = getSettings();
    s.weights = w;
    saveSettings(s);
  }

  function getLearningHistory() { return _get(KEYS.learningHistory, []); }
  function saveLearningEntry(entry) {
    const h = getLearningHistory();
    h.unshift(entry);
    if (h.length > 50) h.length = 50;
    _set(KEYS.learningHistory, h);
  }

  function getSchedulerState() { return _get(KEYS.schedulerState, null); }
  function saveSchedulerState(state) { _set(KEYS.schedulerState, state); }

  function getBacktestResults() { return _get(KEYS.backtestResults, null); }
  function saveBacktestResults(results) { _set(KEYS.backtestResults, results); }

  function exportAll() {
    const data = {};
    for (const [name, key] of Object.entries(KEYS)) {
      data[name] = _get(key, null);
    }
    data._exportedAt = new Date().toISOString();
    data._version = 'v3';
    return data;
  }

  function importAll(data) {
    for (const [name, key] of Object.entries(KEYS)) {
      if (data[name] !== undefined && data[name] !== null) {
        _set(key, data[name]);
      }
    }
  }

  function resetAll() {
    for (const key of Object.values(KEYS)) localStorage.removeItem(key);
  }

  function getStorageSize() {
    let total = 0;
    for (const key of Object.values(KEYS)) {
      const v = localStorage.getItem(key);
      if (v) total += v.length * 2;
    }
    return total;
  }

  return {
    getUserDraws, saveUserDraw,
    getPredictions, savePrediction, updatePrediction,
    getVerifications, saveVerification,
    getSettings, saveSettings, getWeights, saveWeights,
    getLearningHistory, saveLearningEntry,
    getSchedulerState, saveSchedulerState,
    getBacktestResults, saveBacktestResults,
    exportAll, importAll, resetAll, getStorageSize,
    DEFAULT_SETTINGS, DEFAULT_WEIGHTS, WEIGHT_LABELS,
  };
})();
