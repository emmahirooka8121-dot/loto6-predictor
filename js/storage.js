/* ===== localStorage Operations ===== */

const Storage = (() => {
  const KEYS = {
    userDraws: 'loto6_user_draws',
    predictions: 'loto6_predictions',
    verifications: 'loto6_verifications',
    settings: 'loto6_settings',
    learningHistory: 'loto6_learning_history',
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    autoLearn: true,
    weights: { frequency: 25, dormancy: 20, correlation: 20, trend: 15, balance: 10, weekday: 10 }
  };

  function _get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }

  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // User draws
  function getUserDraws() { return _get(KEYS.userDraws, []); }
  function saveUserDraw(draw) {
    const draws = getUserDraws();
    const idx = draws.findIndex(d => d.id === draw.id);
    if (idx >= 0) draws[idx] = draw; else draws.push(draw);
    draws.sort((a, b) => b.id - a.id);
    _set(KEYS.userDraws, draws);
  }

  // Predictions
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

  // Verifications
  function getVerifications() { return _get(KEYS.verifications, []); }
  function saveVerification(ver) {
    const vers = getVerifications();
    const idx = vers.findIndex(v => v.targetDrawId === ver.targetDrawId);
    if (idx >= 0) vers[idx] = ver; else vers.unshift(ver);
    _set(KEYS.verifications, vers);
  }

  // Settings
  function getSettings() {
    const s = _get(KEYS.settings, null);
    return s ? { ...DEFAULT_SETTINGS, ...s, weights: { ...DEFAULT_SETTINGS.weights, ...(s.weights || {}) } } : { ...DEFAULT_SETTINGS };
  }
  function saveSettings(settings) { _set(KEYS.settings, settings); }
  function getWeights() { return getSettings().weights; }
  function saveWeights(weights) {
    const s = getSettings();
    s.weights = weights;
    saveSettings(s);
  }

  // Learning history
  function getLearningHistory() { return _get(KEYS.learningHistory, []); }
  function saveLearningEntry(entry) {
    const h = getLearningHistory();
    h.unshift(entry);
    if (h.length > 50) h.length = 50;
    _set(KEYS.learningHistory, h);
  }

  // Export / Import
  function exportAll() {
    const data = {};
    for (const [name, key] of Object.entries(KEYS)) {
      data[name] = _get(key, null);
    }
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
    for (const key of Object.values(KEYS)) {
      localStorage.removeItem(key);
    }
  }

  function getStorageSize() {
    let total = 0;
    for (const key of Object.values(KEYS)) {
      const v = localStorage.getItem(key);
      if (v) total += v.length * 2; // UTF-16
    }
    return total;
  }

  return {
    getUserDraws, saveUserDraw,
    getPredictions, savePrediction, updatePrediction,
    getVerifications, saveVerification,
    getSettings, saveSettings, getWeights, saveWeights,
    getLearningHistory, saveLearningEntry,
    exportAll, importAll, resetAll, getStorageSize,
    DEFAULT_SETTINGS,
  };
})();
