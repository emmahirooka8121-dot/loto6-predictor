/* ===== Scheduler (Auto-generate + Lock) ===== */

const Scheduler = (() => {
  'use strict';

  // Auto-generate: Sunday/Wednesday noon (day before draw)
  // Lock: After auto-generate until draw day +1 midnight

  function getState() {
    const saved = Storage.getSchedulerState();
    if (saved) return saved;
    return { lockedPredictionId: null, lockTime: null, unlockTime: null, status: 'idle' };
  }

  function saveState(state) {
    Storage.saveSchedulerState(state);
  }

  function getNextDrawInfo() {
    return Utils.nextDrawInfo();
  }

  // Check if currently locked
  function isLocked() {
    const state = getState();
    if (!state.lockTime || !state.unlockTime) return false;
    const now = new Date();
    return now >= new Date(state.lockTime) && now < new Date(state.unlockTime);
  }

  // Get lock status details
  function getLockStatus() {
    const state = getState();
    const locked = isLocked();
    const info = getNextDrawInfo();

    if (locked) {
      return {
        status: 'locked',
        label: 'ロック中',
        color: 'green',
        message: `第${state.lockedPredictionId}回 抽選に向けてロック済み`,
        lockTime: state.lockTime,
        unlockTime: state.unlockTime,
      };
    }

    // Check if we should auto-generate
    const now = new Date();
    const drawDate = new Date(info.date + 'T00:00:00');
    const prevDay = new Date(drawDate);
    prevDay.setDate(prevDay.getDate() - 1);
    prevDay.setHours(12, 0, 0, 0);

    if (now >= prevDay && now < drawDate) {
      return {
        status: 'pending',
        label: '自動生成待ち',
        color: 'yellow',
        message: `第${info.id}回 ${info.formatted} の予測を自動生成します`,
      };
    }

    return {
      status: 'idle',
      label: '待機中',
      color: 'gray',
      message: `次回: 第${info.id}回 ${info.formatted}（あと${info.daysUntil}日）`,
      daysUntil: info.daysUntil,
    };
  }

  // Try auto-generate (called on app init and periodically)
  function tryAutoGenerate() {
    if (isLocked()) return false;

    const info = getNextDrawInfo();
    const now = new Date();
    const drawDate = new Date(info.date + 'T00:00:00');
    const prevDay = new Date(drawDate);
    prevDay.setDate(prevDay.getDate() - 1);
    prevDay.setHours(12, 0, 0, 0);

    if (now < prevDay) return false;

    // Check if we already have a prediction for this draw
    const predictions = Storage.getPredictions();
    const existing = predictions.find(p => p.targetDrawId === info.id);
    if (existing) {
      // Lock existing prediction
      const unlockDate = new Date(drawDate);
      unlockDate.setDate(unlockDate.getDate() + 1);
      saveState({
        lockedPredictionId: info.id,
        lockTime: now.toISOString(),
        unlockTime: unlockDate.toISOString(),
        status: 'locked',
      });
      return false;
    }

    // Auto-generate
    const data = Utils.getAllDrawData();
    if (data.length === 0) return false;

    Predictor.generate(data, false);

    // Lock
    const unlockDate = new Date(drawDate);
    unlockDate.setDate(unlockDate.getDate() + 1);
    saveState({
      lockedPredictionId: info.id,
      lockTime: now.toISOString(),
      unlockTime: unlockDate.toISOString(),
      status: 'locked',
    });

    return true;
  }

  // Force override (advanced search while locked)
  function forceOverride(data) {
    const state = getState();
    const prediction = Predictor.generate(data, true);

    // Re-lock with same times
    saveState({
      ...state,
      status: 'locked',
    });

    return prediction;
  }

  // Check and possibly unlock expired locks
  function checkExpiry() {
    const state = getState();
    if (state.unlockTime && new Date() >= new Date(state.unlockTime)) {
      saveState({ lockedPredictionId: null, lockTime: null, unlockTime: null, status: 'idle' });
    }
  }

  return {
    getState, isLocked, getLockStatus,
    tryAutoGenerate, forceOverride, checkExpiry,
  };
})();
