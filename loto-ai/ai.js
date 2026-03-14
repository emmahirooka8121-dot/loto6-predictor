/**
 * ロトAI Ω∞ AUTONOMOUS — AI Orchestrator
 * Coordinates AI Engine + Scheduler + History + UI
 */
var LotoAI = (function () {
  "use strict";

  var LABELS = ["A", "B", "C", "D", "E"];
  var STORAGE_KEY = "lotoai_history";

  // ============================================================
  //  History management (localStorage)
  // ============================================================

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { predictions: [], metadata: { version: "1.0.0", system: "ロトAI Ω∞ AUTONOMOUS" } };
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) { /* ignore */ }
  }

  function addPredictionToHistory(targetDate, sets, mode) {
    var history = loadHistory();
    history.predictions.unshift({
      id: Date.now(),
      targetDate: targetDate,
      generatedAt: new Date().toISOString(),
      mode: mode || "manual",
      sets: sets
    });
    // Keep last 200 predictions
    if (history.predictions.length > 200) {
      history.predictions = history.predictions.slice(0, 200);
    }
    saveHistory(history);
    return history;
  }

  // ============================================================
  //  Generate predictions
  // ============================================================

  function generate(mode) {
    var freq = AIEngine.buildFrequency(null);
    var portfolio;

    if (mode === "deep") {
      portfolio = AIEngine.deepSearch(freq);
    } else {
      portfolio = AIEngine.generatePortfolio(freq, false);
    }

    var targetDate = Scheduler.getNextDrawDate();
    var dateStr = Scheduler.formatDate(targetDate);

    addPredictionToHistory(dateStr, portfolio, mode || "manual");

    return {
      targetDate: dateStr,
      sets: portfolio,
      mode: mode || "manual",
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================
  //  Render predictions to DOM
  // ============================================================

  function renderPredictions(result) {
    // Update target date
    var dateEl = document.getElementById("targetDate");
    if (dateEl) dateEl.textContent = result.targetDate;

    // Update mode indicator
    var modeEl = document.getElementById("genMode");
    if (modeEl) {
      if (result.mode === "deep") {
        modeEl.textContent = "AI DEEP SEARCH";
        modeEl.className = "gen-mode deep";
      } else if (result.mode === "auto") {
        modeEl.textContent = "AUTO GENERATED";
        modeEl.className = "gen-mode auto";
      } else {
        modeEl.textContent = "MANUAL";
        modeEl.className = "gen-mode manual";
      }
    }

    // Render cards
    var container = document.getElementById("predictions");
    if (!container) return;
    container.innerHTML = "";

    for (var i = 0; i < result.sets.length; i++) {
      var card = document.createElement("div");
      card.className = "pred-card";
      card.style.animation = "none";
      void card.offsetHeight;
      card.style.animation = "";

      var label = document.createElement("div");
      label.className = "pred-label";
      label.textContent = "Prediction " + LABELS[i];
      card.appendChild(label);

      var grid = document.createElement("div");
      grid.className = "numbers";

      for (var j = 0; j < result.sets[i].length; j++) {
        var ball = document.createElement("div");
        ball.className = "num-ball";
        if (result.sets[i][j] >= 32) ball.classList.add("high");
        ball.textContent = String(result.sets[i][j]).padStart(2, "0");
        grid.appendChild(ball);
      }

      card.appendChild(grid);
      container.appendChild(card);
    }

    // Update timestamp
    var tsEl = document.getElementById("genTimestamp");
    if (tsEl) {
      var now = new Date();
      tsEl.textContent = "Generated: " + now.toLocaleString("ja-JP");
    }
  }

  // ============================================================
  //  Render history panel
  // ============================================================

  function renderHistory() {
    var histPanel = document.getElementById("historyPanel");
    if (!histPanel) return;

    var history = loadHistory();
    if (history.predictions.length === 0) {
      histPanel.innerHTML = '<div class="hist-empty">No prediction history yet.</div>';
      return;
    }

    var html = "";
    var limit = Math.min(history.predictions.length, 10);

    for (var i = 0; i < limit; i++) {
      var p = history.predictions[i];
      html += '<div class="hist-entry">';
      html += '<div class="hist-meta">';
      html += '<span class="hist-date">' + p.targetDate + '</span>';
      html += '<span class="hist-mode ' + (p.mode || "manual") + '">' + (p.mode || "manual").toUpperCase() + '</span>';
      html += '</div>';

      for (var s = 0; s < p.sets.length; s++) {
        html += '<div class="hist-set">';
        html += '<span class="hist-label">' + LABELS[s] + '</span>';
        for (var n = 0; n < p.sets[s].length; n++) {
          html += '<span class="hist-num">' + String(p.sets[s][n]).padStart(2, "0") + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    histPanel.innerHTML = html;
  }

  // ============================================================
  //  Public API
  // ============================================================

  return {
    generate: generate,
    renderPredictions: renderPredictions,
    renderHistory: renderHistory,
    loadHistory: loadHistory,
    LABELS: LABELS
  };
})();
