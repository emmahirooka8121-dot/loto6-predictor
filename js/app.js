/* ===== Main Application (v3 Enhanced - All 7 Tabs) ===== */

const App = (() => {
  'use strict';

  let currentTab = 'tabPredict';
  let historyPage = 0;
  const HISTORY_PAGE_SIZE = 20;

  /* ---------- Init ---------- */
  function init() {
    applyTheme();
    renderHeader();
    bindTabEvents();
    bindPredictEvents();
    bindHistoryEvents();
    bindRecordsEvents();
    bindVerifyEvents();
    bindBacktestEvents();
    bindSettingsEvents();

    // Scheduler check
    Scheduler.checkExpiry();
    Scheduler.tryAutoGenerate();

    renderCurrentTab();

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() {});
    }

    // Pull-to-refresh (Improvement 11)
    initPullToRefresh();
  }

  /* ---------- Theme ---------- */
  function applyTheme() {
    var settings = Storage.getSettings();
    var theme = settings.theme || 'dark';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.body.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });
  }

  /* ---------- Header ---------- */
  function renderHeader() {
    var info = Utils.nextDrawInfo();
    var el = document.getElementById('nextDrawInfo');
    if (el) el.textContent = '次回第' + info.id + '回 ' + info.formatted;
  }

  /* ---------- Tabs ---------- */
  function bindTabEvents() {
    document.querySelectorAll('.tab-item').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.tab-item').forEach(function(el) { el.classList.remove('active'); });
    var tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    var tabBtn = document.querySelector('[data-tab="' + tabId + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    Charts.destroyAll();
    renderCurrentTab();
  }

  function renderCurrentTab() {
    switch (currentTab) {
      case 'tabPredict': renderPredict(); break;
      case 'tabAnalysis': renderAnalysis(); break;
      case 'tabHistory': renderHistory(); break;
      case 'tabRecords': renderRecords(); break;
      case 'tabVerify': renderVerify(); break;
      case 'tabBacktest': renderBacktest(); break;
      case 'tabSettings': renderSettings(); break;
    }
  }

  /* ========== 1. PREDICT TAB ========== */
  function bindPredictEvents() {
    document.getElementById('btnGenerate').addEventListener('click', function() {
      if (Scheduler.isLocked()) {
        Utils.showToast('予測はロック中です');
        return;
      }
      doGenerate(false);
    });

    document.getElementById('btnAdvanced').addEventListener('click', function() {
      if (Scheduler.isLocked()) {
        if (!confirm('ロック中ですが、高度探索で上書きしますか？')) return;
      }
      doGenerate(true);
    });
  }

  function doGenerate(advanced) {
    var data = Utils.getAllDrawData();
    if (data.length === 0) { alert('抽選データがありません。'); return; }

    var overlay = document.getElementById('loadingOverlay');
    var loadText = document.getElementById('loadingText');
    overlay.classList.add('active');
    loadText.textContent = advanced ? 'AI高度探索モードで解析中...' : 'AIが予測を生成中...';

    Utils.hapticFeedback();

    setTimeout(function() {
      try {
        if (advanced && Scheduler.isLocked()) {
          Scheduler.forceOverride(data);
        } else {
          Predictor.generate(data, advanced);
        }
      } catch (e) {
        console.error(e);
        alert('予測生成中にエラーが発生しました。');
      }
      overlay.classList.remove('active');
      Utils.hapticFeedback();
      renderPredict();
    }, 100);
  }

  function renderPredict() {
    // Dashboard widgets (Improvement 13)
    renderDashboardWidgets();
    // Scheduler status
    renderSchedulerStatus();

    var predictions = Storage.getPredictions();
    var container = document.getElementById('predictionsDisplay');

    // Algorithm tags
    var tagsEl = document.getElementById('algoTags');
    tagsEl.innerHTML = ['モンテカルロ', '遺伝的アルゴリズム', '焼きなまし法', 'エントロピー最適化', '相関ネットワーク', 'トレンド追従', '出遅れ回帰']
      .map(function(t) { return '<span class="algo-tag">' + t + '</span>'; }).join('');

    if (predictions.length === 0) {
      container.innerHTML = '<div class="card" style="text-align:center;padding:32px"><p style="color:var(--text-muted)">下のボタンをタップして予想番号を生成してください</p></div>';
      return;
    }

    var latest = predictions[0];
    var html = '<div class="card"><h3>第' + latest.targetDrawId + '回 ' + Utils.formatDate(latest.targetDate) + '（' + latest.targetWeekday + '）抽選分</h3>';
    html += '<div style="font-size:0.7rem;color:var(--text-muted)">生成: ' + Utils.formatDateTime(latest.createdAt) + ' / モード: ' + (latest.mode === 'advanced' ? '高度探索' : '通常') + ' / カバー率: ' + (latest.coverage || '-') + '/43</div></div>';

    latest.sets.forEach(function(set, i) {
      var name = Predictor.STRATEGY_NAMES[set.strategy] || set.strategy;
      var sum = Utils.calcSum(set.nums);
      var oe = Utils.calcOddEvenStr(set.nums);
      var conf = set.confidence || 0;
      var confClass = conf >= 70 ? 'confidence-high' : conf >= 50 ? 'confidence-mid' : 'confidence-low';
      var numsText = set.nums.map(function(n) { return String(n).padStart(2, '0'); }).join(' ');

      html += '<div class="prediction-card" style="animation-delay:' + (i * 0.08) + 's">';
      html += '<div class="prediction-card-header">';
      html += '<span class="strategy-label">' + ['①','②','③','④','⑤'][i] + ' ' + name + '</span>';
      html += '<span class="confidence-badge ' + confClass + '">確信度 ' + conf + '%</span>';
      html += '</div>';
      html += '<div class="balls-row">' + Utils.renderBalls(set.nums, { animate: true, clickable: true }) + '</div>';
      html += '<div class="prediction-meta">合計: ' + sum + ' / 奇偶: ' + oe + (set.algo ? ' / Algo: ' + set.algo : '') + '</div>';

      // Copyable textarea (required spec)
      html += Utils.renderCopyableTextarea(numsText, 'copy_pred_' + i);

      // Copy button + Mark sheet
      html += '<div class="prediction-actions">';
      html += '<button class="btn-copy" onclick="Utils.copyToClipboard(\'' + numsText + '\')">番号をコピー</button>';
      html += '</div>';
      html += Utils.renderMarkSheet(set.nums);
      html += '</div>';
    });

    container.innerHTML = html;

    // Update generate button state
    var locked = Scheduler.isLocked();
    document.getElementById('btnGenerate').disabled = locked;
  }

  function renderDashboardWidgets() {
    var el = document.getElementById('dashboardWidgets');
    var info = Utils.nextDrawInfo();
    var learningStatus = Learner.getStatus();
    var predictions = Storage.getPredictions();

    el.innerHTML =
      '<div class="widget-card"><div class="widget-value">' + info.daysUntil + '日</div><div class="widget-label">次回抽選まで</div></div>' +
      '<div class="widget-card"><div class="widget-value">' + learningStatus.learningCount + '回</div><div class="widget-label">学習回数</div></div>' +
      '<div class="widget-card"><div class="widget-value">' + (learningStatus.maxMatch || 0) + '個</div><div class="widget-label">最高一致</div></div>' +
      '<div class="widget-card"><div class="widget-value">' + predictions.length + '回</div><div class="widget-label">累計予測</div></div>';
  }

  function renderSchedulerStatus() {
    var status = Scheduler.getLockStatus();
    var statusEl = document.getElementById('schedulerStatus');
    var bannerEl = document.getElementById('lockBanner');

    statusEl.innerHTML = '<span class="status-dot ' + status.color + '"></span><span>' + status.label + ': ' + status.message + '</span>';

    if (status.status === 'locked') {
      bannerEl.innerHTML = '<div class="lock-banner">この予測は' + (status.lockTime ? Utils.formatDateTime(status.lockTime) : '') + 'にロックされました。解除予定: ' + (status.unlockTime ? Utils.formatDateTime(status.unlockTime) : '') + '</div>';
    } else {
      bannerEl.innerHTML = '';
    }
  }

  /* ========== 2. ANALYSIS TAB ========== */
  function renderAnalysis(period) {
    var data = Utils.getAllDrawData();
    if (data.length === 0) {
      document.getElementById('analysisContent').innerHTML = '<p style="text-align:center;color:var(--text-muted)">データがありません</p>';
      return;
    }

    period = period || parseInt(document.querySelector('.period-btn.active').dataset.period) || 10;
    if (isNaN(period)) period = null;

    var analysis = Analyzer.fullAnalysis(data, period === 'all' ? null : period);
    var content = document.getElementById('analysisContent');

    var html = '';

    // (a) Frequency chart
    html += '<div class="card"><h3>出現頻度</h3><div class="chart-container" style="height:' + (43 * 18) + 'px"><canvas id="chartFreq"></canvas></div></div>';

    // (b) Heatmap (Improvement 17)
    html += '<div class="card"><h3>番号ヒートマップ</h3>' + renderHeatmap(analysis.frequency) + '</div>';

    // (c) Range chart
    html += '<div class="card"><h3>番号帯分布</h3><div class="chart-container" style="height:250px"><canvas id="chartRange"></canvas></div></div>';

    // (d) Odd/Even
    html += '<div class="card"><h3>奇偶パターン</h3><div class="chart-container" style="height:200px"><canvas id="chartOE"></canvas></div></div>';

    // (e) Sum histogram
    html += '<div class="card"><h3>合計値ヒストグラム（平均: ' + (analysis.sumStats.mean || '-') + '）</h3><div class="chart-container" style="height:200px"><canvas id="chartSum"></canvas></div></div>';

    // (f) Dormancy ranking
    html += '<div class="card"><h3>出遅れランキング TOP10</h3><ul class="dormancy-list">' + renderDormancyList(analysis.dormancy) + '</ul></div>';

    // (g) Pairs + Triplets (Improvement 6)
    html += '<div class="card"><h3>番号ペア TOP10</h3><ul class="correlation-list">' + renderCorrelationList(analysis.correlation) + '</ul>';
    html += '<h3 style="margin-top:12px">トリプレット TOP5</h3><ul class="correlation-list">' + renderTripletList(analysis.triplets) + '</ul></div>';

    // (h) Weekday
    html += '<div class="card"><h3>月曜 vs 木曜の傾向</h3><p style="font-size:0.75rem;color:var(--text-muted)">月曜: ' + (analysis.weekdayTrend.monday.count || 0) + '回 / 木曜: ' + (analysis.weekdayTrend.thursday.count || 0) + '回</p>' + renderWeekdayDiff(analysis.weekdayTrend) + '</div>';

    // (i) Consecutive (Improvement 2)
    html += '<div class="card"><h3>連番パターン分析</h3><p style="font-size:0.8rem">連番出現率: <strong>' + (analysis.consecutive.rate * 100).toFixed(1) + '%</strong>（' + analysis.consecutive.withConsec + '/' + analysis.consecutive.total + '回）</p>';
    if (analysis.consecutive.topPairs.length > 0) {
      html += '<ul class="dormancy-list">' + analysis.consecutive.topPairs.slice(0, 5).map(function(p) {
        var nums = p.pair.split('-').map(Number);
        return '<li><span>' + Utils.renderBall(nums[0]) + Utils.renderBall(nums[1]) + '</span><span style="font-family:var(--font-mono);font-weight:700">' + p.count + '回</span></li>';
      }).join('') + '</ul>';
    }
    html += '</div>';

    // (j) Last digit (Improvement 3)
    html += '<div class="card"><h3>末尾数字分布</h3><div class="chart-container" style="height:200px"><canvas id="chartLastDigit"></canvas></div></div>';

    // (k) Interval distribution (Improvement 4)
    html += '<div class="card"><h3>出現間隔分析（次回出現確率 TOP10）</h3>' + renderIntervalTop(analysis.intervalDist) + '</div>';

    // (l) Hot/Cold (Improvement 5)
    html += '<div class="card"><h3>温冷サイクル</h3>' + renderHotCold(analysis.hotCold) + '</div>';

    content.innerHTML = html;

    // Render charts after DOM update
    requestAnimationFrame(function() {
      Charts.renderFrequencyChart('chartFreq', analysis.frequency);
      Charts.renderRangeChart('chartRange', analysis.rangeDist);
      Charts.renderOddEvenChart('chartOE', analysis.oddEven);
      Charts.renderSumHistogram('chartSum', analysis.sumStats);
      Charts.renderLastDigitChart('chartLastDigit', analysis.lastDigit);
    });

    // Period button binding
    document.querySelectorAll('.period-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        Charts.destroyAll();
        var p = btn.dataset.period;
        renderAnalysis(p === 'all' ? 'all' : parseInt(p));
      });
    });
  }

  function renderHeatmap(frequency) {
    var maxCount = Math.max.apply(null, Object.values(frequency).map(function(f) { return f.count; }));
    var html = '<div class="heatmap-grid">';
    for (var n = 1; n <= 43; n++) {
      var count = frequency[n] ? frequency[n].count : 0;
      var intensity = maxCount > 0 ? count / maxCount : 0;
      var r = Math.round(59 + intensity * 180);
      var g = Math.round(59 - intensity * 30);
      var b = Math.round(59 - intensity * 40);
      var bg = 'rgb(' + r + ',' + g + ',' + b + ')';
      html += '<div class="heatmap-cell" style="background:' + bg + '" title="番号' + n + ': ' + count + '回">' + String(n).padStart(2, '0') + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderDormancyList(dormancy) {
    if (!dormancy) return '<li>データなし</li>';
    return Object.entries(dormancy)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 10)
      .map(function(entry) {
        return '<li><span>' + Utils.renderBall(parseInt(entry[0])) + ' 番号' + entry[0] + '</span><span style="font-family:var(--font-mono);font-weight:700">' + entry[1] + '回不出</span></li>';
      }).join('');
  }

  function renderCorrelationList(correlation) {
    if (!correlation || correlation.length === 0) return '<li>データなし</li>';
    return correlation.slice(0, 10).map(function(item) {
      var nums = item.pair.split('-').map(Number);
      return '<li><span>' + Utils.renderBall(nums[0]) + Utils.renderBall(nums[1]) + '</span><span style="font-family:var(--font-mono);font-weight:700">' + item.count + '回</span></li>';
    }).join('');
  }

  function renderTripletList(triplets) {
    if (!triplets || triplets.length === 0) return '<li>データなし</li>';
    return triplets.slice(0, 5).map(function(item) {
      var nums = item.triplet.split('-').map(Number);
      return '<li><span>' + nums.map(function(n) { return Utils.renderBall(n); }).join('') + '</span><span style="font-family:var(--font-mono);font-weight:700">' + item.count + '回</span></li>';
    }).join('');
  }

  function renderWeekdayDiff(wt) {
    if (!wt.monday.frequency || !wt.thursday.frequency) return '<p style="font-size:0.75rem;color:var(--text-muted)">データ不足</p>';
    var diffs = [];
    for (var n = 1; n <= 43; n++) {
      var mr = wt.monday.frequency[n] ? wt.monday.frequency[n].rate : 0;
      var tr = wt.thursday.frequency[n] ? wt.thursday.frequency[n].rate : 0;
      var diff = mr - tr;
      if (Math.abs(diff) > 0.03) diffs.push({ num: n, diff: diff });
    }
    if (diffs.length === 0) return '<p style="font-size:0.75rem;color:var(--text-muted)">目立った差なし</p>';
    diffs.sort(function(a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
    return '<ul class="dormancy-list">' + diffs.slice(0, 8).map(function(d) {
      var label = d.diff > 0 ? '月曜+' : '木曜+';
      var color = d.diff > 0 ? 'var(--hot)' : 'var(--cold)';
      return '<li><span>' + Utils.renderBall(d.num) + '</span><span style="color:' + color + '">' + label + (Math.abs(d.diff) * 100).toFixed(1) + '%</span></li>';
    }).join('') + '</ul>';
  }

  function renderIntervalTop(intervalDist) {
    if (!intervalDist) return '<p style="color:var(--text-muted)">データなし</p>';
    var items = [];
    for (var n = 1; n <= 43; n++) {
      if (intervalDist[n] && intervalDist[n].probNext) {
        items.push({ num: n, prob: intervalDist[n].probNext, avgInt: intervalDist[n].avgInterval, dormancy: intervalDist[n].dormancy });
      }
    }
    items.sort(function(a, b) { return b.prob - a.prob; });
    return '<ul class="dormancy-list">' + items.slice(0, 10).map(function(item) {
      return '<li><span>' + Utils.renderBall(item.num) + ' 番号' + item.num + '</span><span style="font-family:var(--font-mono);font-size:0.75rem">' + (item.prob * 100).toFixed(1) + '% (平均' + (item.avgInt ? item.avgInt.toFixed(1) : '-') + '回間隔)</span></li>';
    }).join('') + '</ul>';
  }

  function renderHotCold(hotCold) {
    if (!hotCold) return '<p style="color:var(--text-muted)">データなし</p>';
    var hot = [], cold = [];
    for (var n = 1; n <= 43; n++) {
      if (hotCold[n]) {
        if (hotCold[n].state === 'hot') hot.push(n);
        else if (hotCold[n].state === 'cold') cold.push(n);
      }
    }
    return '<div style="margin-bottom:8px"><span class="tag-hot">HOT: </span>' + (hot.length > 0 ? hot.map(function(n) { return Utils.renderBall(n); }).join('') : 'なし') + '</div>' +
           '<div><span class="tag-cold">COLD: </span>' + (cold.length > 0 ? cold.map(function(n) { return Utils.renderBall(n); }).join('') : 'なし') + '</div>';
  }

  /* ========== 3. HISTORY TAB ========== */
  function bindHistoryEvents() {
    document.getElementById('historySearch').addEventListener('input', function(e) {
      historyPage = 0;
      renderHistory(e.target.value.trim());
    });
    document.getElementById('btnAddDraw').addEventListener('click', openAddDrawModal);
    document.getElementById('btnLoadMore').addEventListener('click', function() {
      historyPage++;
      appendHistory();
    });
    document.getElementById('btnFetchResult').addEventListener('click', tryFetchResult);
  }

  function renderHistory(searchNum) {
    var data = Utils.getAllDrawData();
    var filtered = data;
    if (searchNum && !isNaN(parseInt(searchNum))) {
      var num = parseInt(searchNum);
      filtered = data.filter(function(d) { return d.nums.indexOf(num) >= 0 || d.bonus === num; });
    }

    // Latest draw
    var latestEl = document.getElementById('latestDraw');
    if (data.length > 0) {
      var d = data[0];
      latestEl.innerHTML = '<h3>最新: 第' + d.id + '回 ' + Utils.formatDate(d.date) + '（' + Utils.getWeekday(d.date) + '）</h3>' +
        '<div class="balls-row">' + Utils.renderBalls(d.nums, { clickable: true }) + Utils.renderBall(d.bonus, { bonus: true }) + '</div>';
    } else {
      latestEl.innerHTML = '<p style="color:var(--text-muted)">データなし</p>';
    }

    historyPage = 0;
    var list = document.getElementById('historyList');
    var page = filtered.slice(0, HISTORY_PAGE_SIZE);
    list.innerHTML = page.map(renderDrawRow).join('');
    document.getElementById('btnLoadMore').style.display = filtered.length > HISTORY_PAGE_SIZE ? 'block' : 'none';
  }

  function appendHistory() {
    var data = Utils.getAllDrawData();
    var search = document.getElementById('historySearch').value.trim();
    var filtered = data;
    if (search && !isNaN(parseInt(search))) {
      var num = parseInt(search);
      filtered = data.filter(function(d) { return d.nums.indexOf(num) >= 0; });
    }
    var start = historyPage * HISTORY_PAGE_SIZE;
    var page = filtered.slice(start, start + HISTORY_PAGE_SIZE);
    document.getElementById('historyList').innerHTML += page.map(renderDrawRow).join('');
    document.getElementById('btnLoadMore').style.display = start + HISTORY_PAGE_SIZE < filtered.length ? 'block' : 'none';
  }

  function renderDrawRow(d) {
    return '<div class="draw-row"><span class="draw-id">#' + d.id + '</span><span class="draw-date">' + Utils.formatDate(d.date) + '(' + Utils.getWeekday(d.date) + ')</span><span class="draw-balls">' + d.nums.map(function(n) { return Utils.renderBall(n); }).join('') + Utils.renderBall(d.bonus, { bonus: true }) + '</span></div>';
  }

  // Auto-fetch result (Improvement 19)
  function tryFetchResult() {
    Utils.showToast('結果を取得中...');
    // Try CORS-friendly endpoint
    fetch('https://www.mk-mode.com/rails/loto/loto6/latest.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.id && data.nums) {
          Storage.saveUserDraw(data);
          Verifier.verifyAll();
          renderHistory();
          Utils.showToast('最新結果を取得しました');
        }
      })
      .catch(function() {
        Utils.showToast('自動取得に失敗。手動で追加してください。');
      });
  }

  /* --- Add Draw Modal --- */
  var selectedNums = [];
  var selectedBonus = null;

  function openAddDrawModal() {
    var modal = document.getElementById('addDrawModal');
    var data = Utils.getAllDrawData();
    var nextId = data.length > 0 ? data[0].id + 1 : 1;
    document.getElementById('inputDrawId').value = nextId;
    document.getElementById('inputDrawDate').value = new Date().toISOString().split('T')[0];
    selectedNums = [];
    selectedBonus = null;
    renderNumberGrids();
    updateSelectedDisplay();
    document.getElementById('formError').textContent = '';
    modal.classList.add('active');

    document.getElementById('modalClose').onclick = function() { modal.classList.remove('active'); };
    document.getElementById('modalCancel').onclick = function() { modal.classList.remove('active'); };
    document.getElementById('modalSave').onclick = saveNewDraw;
  }

  function renderNumberGrids() {
    var grid = document.getElementById('numberGrid');
    var bonusGrid = document.getElementById('bonusGrid');
    grid.innerHTML = '';
    bonusGrid.innerHTML = '';
    for (var n = 1; n <= 43; n++) {
      (function(num) {
        var btn = document.createElement('button');
        btn.textContent = num;
        btn.addEventListener('click', function() { toggleNumber(num); });
        grid.appendChild(btn);
        var bBtn = document.createElement('button');
        bBtn.textContent = num;
        bBtn.addEventListener('click', function() { toggleBonus(num); });
        bonusGrid.appendChild(bBtn);
      })(n);
    }
  }

  function toggleNumber(n) {
    var idx = selectedNums.indexOf(n);
    if (idx >= 0) selectedNums.splice(idx, 1);
    else if (selectedNums.length < 6) selectedNums.push(n);
    updateNumberGridUI();
    updateSelectedDisplay();
  }

  function toggleBonus(n) {
    selectedBonus = selectedBonus === n ? null : n;
    updateNumberGridUI();
    updateSelectedDisplay();
  }

  function updateNumberGridUI() {
    document.querySelectorAll('#numberGrid button').forEach(function(btn, i) {
      var n = i + 1;
      btn.classList.toggle('selected', selectedNums.indexOf(n) >= 0);
      btn.classList.toggle('disabled-num', selectedNums.length >= 6 && selectedNums.indexOf(n) < 0);
    });
    document.querySelectorAll('#bonusGrid button').forEach(function(btn, i) {
      var n = i + 1;
      btn.classList.toggle('selected', selectedBonus === n);
    });
  }

  function updateSelectedDisplay() {
    var sorted = selectedNums.slice().sort(function(a, b) { return a - b; });
    document.getElementById('selectedNums').textContent = selectedNums.length > 0 ? '選択: ' + sorted.join(', ') + ' (' + selectedNums.length + '/6)' : '選択: なし';
    document.getElementById('selectedBonus').textContent = selectedBonus ? '選択: ' + selectedBonus : '選択: なし';
  }

  function saveNewDraw() {
    var id = parseInt(document.getElementById('inputDrawId').value);
    var date = document.getElementById('inputDrawDate').value;
    var errEl = document.getElementById('formError');
    if (!id || id < 1) { errEl.textContent = '回号を入力してください'; return; }
    if (!date) { errEl.textContent = '日付を入力してください'; return; }
    if (selectedNums.length !== 6) { errEl.textContent = '本数字を6個選択してください'; return; }
    if (selectedBonus === null) { errEl.textContent = 'ボーナス数字を選択してください'; return; }
    if (selectedNums.indexOf(selectedBonus) >= 0) { errEl.textContent = 'ボーナス数字は本数字と異なる必要があります'; return; }

    var draw = {
      id: id,
      date: date,
      nums: selectedNums.slice().sort(function(a, b) { return a - b; }),
      bonus: selectedBonus,
    };
    Storage.saveUserDraw(draw);
    var verified = Verifier.verifyAll();
    document.getElementById('addDrawModal').classList.remove('active');
    renderHistory();
    renderHeader();
    if (verified > 0) Utils.showToast(verified + '件の予想を自動検証しました');
    else Utils.showToast('結果を保存しました');
  }

  /* ========== 4. RECORDS TAB ========== */
  function bindRecordsEvents() {
    document.getElementById('recordsFilter').addEventListener('change', renderRecords);
    document.getElementById('recordsSort').addEventListener('change', renderRecords);
  }

  function renderRecords() {
    var predictions = Storage.getPredictions();
    var verifications = Storage.getVerifications();
    var verMap = {};
    verifications.forEach(function(v) { verMap[v.targetDrawId] = v; });

    // Summary
    var summaryEl = document.getElementById('recordsSummary');
    var totalPreds = predictions.length;
    var totalMatch = 0, matchCount = 0;
    verifications.forEach(function(v) { v.results.forEach(function(r) { totalMatch += r.matchCount; matchCount++; }); });
    var avgMatch = matchCount > 0 ? (totalMatch / matchCount).toFixed(1) : '-';

    summaryEl.innerHTML =
      '<div class="stat-card"><div class="stat-value">' + totalPreds + '</div><div class="stat-label">総予測回数</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + avgMatch + '</div><div class="stat-label">平均一致数</div></div>';

    var listEl = document.getElementById('recordsList');
    if (predictions.length === 0) {
      listEl.innerHTML = '<div class="no-records"><p>まだ予測がありません。</p><button class="btn btn-secondary btn-sm" onclick="App.switchTab(\'tabPredict\')">予想タブへ</button></div>';
      return;
    }

    var filter = document.getElementById('recordsFilter').value;
    var sort = document.getElementById('recordsSort').value;
    var filtered = predictions.slice();
    if (filter === 'verified') filtered = filtered.filter(function(p) { return p.verified; });
    if (filter === 'unverified') filtered = filtered.filter(function(p) { return !p.verified; });
    if (sort === 'oldest') filtered.reverse();
    if (sort === 'bestmatch') {
      filtered.sort(function(a, b) {
        var va = verMap[a.targetDrawId];
        var vb = verMap[b.targetDrawId];
        var ma = va ? Math.max.apply(null, va.results.map(function(r) { return r.matchCount; })) : -1;
        var mb = vb ? Math.max.apply(null, vb.results.map(function(r) { return r.matchCount; })) : -1;
        return mb - ma;
      });
    }

    listEl.innerHTML = filtered.map(function(pred, idx) {
      var ver = verMap[pred.targetDrawId];
      var statusBadge, statusClass;
      if (ver) { statusBadge = '検証済み'; statusClass = 'badge-verified'; }
      else { statusBadge = '未検証'; statusClass = 'badge-unverified'; }

      var setsHtml = pred.sets.map(function(set) {
        var name = Predictor.STRATEGY_NAMES[set.strategy] || set.strategy;
        var verResult = ver ? ver.results.find(function(r) { return r.strategy === set.strategy; }) : null;
        var matchHtml = '';
        if (verResult) {
          matchHtml = '<span class="record-match-info">' + verResult.matchCount + '個一致' + (verResult.bonusMatch ? '+B' : '') + ' <span class="prize-badge ' + Utils.prizeClass(verResult.prize) + '">' + verResult.prize + '</span></span>';
        }
        var matchedSet = verResult ? verResult.matched : [];
        var balls = set.nums.map(function(n) { return Utils.renderBall(n, { matched: matchedSet.indexOf(n) >= 0 }); }).join('');
        return '<div class="record-strategy-row"><span class="record-strategy-name">' + name + '</span>' + balls + matchHtml + '</div>';
      }).join('');

      var numsText = pred.sets.map(function(s, i) {
        var name = Predictor.STRATEGY_NAMES[s.strategy] || s.strategy;
        return ['①','②','③','④','⑤'][i] + ' ' + name + ': ' + s.nums.map(function(n) { return String(n).padStart(2, '0'); }).join(' ');
      }).join('\n');

      var footerHtml = '';
      if (ver) {
        footerHtml = '<div class="record-footer">当選番号: ' + Utils.renderBalls(ver.actualNums) + ' ' + Utils.renderBall(ver.actualBonus, { bonus: true }) + '</div>';
      }

      return '<div class="record-card" style="animation-delay:' + (idx * 0.03) + 's">' +
        '<div class="record-card-header"><div><div class="record-draw-info">第' + pred.targetDrawId + '回 ' + Utils.formatDate(pred.targetDate) + '（' + pred.targetWeekday + '）</div><div class="record-created">生成: ' + Utils.formatDateTime(pred.createdAt) + '</div></div><span class="verification-badge ' + statusClass + '">' + statusBadge + '</span></div>' +
        '<div class="record-strategies">' + setsHtml + '</div>' +
        Utils.renderCopyableTextarea(numsText, 'record_ta_' + idx) +
        footerHtml + '</div>';
    }).join('');
  }

  /* ========== 5. VERIFY TAB ========== */
  function bindVerifyEvents() {
    document.getElementById('btnVerify').addEventListener('click', function() {
      var count = Verifier.verifyAll();
      if (count > 0) Utils.showToast(count + '件を検証しました');
      else Utils.showToast('検証対象なし');
      renderVerify();
    });
  }

  function renderVerify() {
    var verifications = Storage.getVerifications();
    var stats = Verifier.getStats();
    var learningStatus = Learner.getStatus();

    // Latest verification
    var latestEl = document.getElementById('latestVerification');
    if (verifications.length > 0) {
      var v = verifications[0];
      var html = '<div class="card"><h3>最新検証: 第' + v.targetDrawId + '回 (' + Utils.formatDate(v.drawDate) + ')</h3>';
      html += '<div style="margin-bottom:8px">当選番号: ' + Utils.renderBalls(v.actualNums) + ' ' + Utils.renderBall(v.actualBonus, { bonus: true }) + '</div>';
      v.results.forEach(function(r) {
        var name = Predictor.STRATEGY_NAMES[r.strategy] || r.strategy;
        html += '<div class="verification-result-card"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700">' + name + '</span><span class="prize-badge ' + Utils.prizeClass(r.prize) + '">' + r.prize + '</span></div>';
        html += '<div style="margin:4px 0"><span class="match-count">' + r.matchCount + '</span><span style="font-size:0.8rem">個一致' + (r.bonusMatch ? ' +B' : '') + '</span></div>';
        if (r.matched.length > 0) html += '<div style="font-size:0.7rem;color:var(--text-muted)">一致: ' + r.matched.join(', ') + '</div>';
        html += '</div>';
      });
      html += '</div>';
      latestEl.innerHTML = html;
    } else {
      latestEl.innerHTML = '<div class="card"><h3>検証結果</h3><p style="color:var(--text-muted)">まだ検証がありません</p></div>';
    }

    // Stats
    var statsEl = document.getElementById('verificationStats');
    if (stats.total > 0) {
      statsEl.innerHTML =
        '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-value">' + stats.total + '</div><div class="stat-label">検証回数</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.avgMatch + '</div><div class="stat-label">平均一致</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.maxMatch + '</div><div class="stat-label">最高一致</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + (stats.prizeCount['5等'] || 0) + '</div><div class="stat-label">5等以上</div></div>' +
        '</div>' +
        '<div class="card"><h3>戦略別成績</h3><div class="chart-container" style="height:200px"><canvas id="chartStrategy"></canvas></div></div>';

      requestAnimationFrame(function() {
        Charts.renderStrategyChart('chartStrategy', stats.strategyStats);
      });
    } else {
      statsEl.innerHTML = '';
    }

    // Accuracy trend (Improvement 18)
    var trendSection = document.getElementById('accuracyTrendSection');
    var trendData = Verifier.getAccuracyTrend();
    if (trendData.length >= 2) {
      trendSection.innerHTML = '<div class="card"><h3>予測的中率の推移</h3><div class="chart-container" style="height:200px"><canvas id="chartAccTrend"></canvas></div></div>';
      requestAnimationFrame(function() {
        Charts.renderAccuracyTrend('chartAccTrend', trendData);
      });
    } else {
      trendSection.innerHTML = '';
    }

    // Learning status
    renderLearningStatus(learningStatus);
  }

  function renderLearningStatus(status) {
    var el = document.getElementById('learningStatus');
    var weights = status.currentWeights;
    var prev = status.previousWeights;

    var barsHtml = '';
    var keys = Object.keys(Storage.WEIGHT_LABELS);
    keys.forEach(function(key) {
      var label = Storage.WEIGHT_LABELS[key];
      var val = ((weights[key] || 0) * 100).toFixed(1);
      var changeHtml = '';
      if (prev) {
        var diff = (weights[key] || 0) - (prev[key] || 0);
        if (Math.abs(diff) > 0.001) {
          var cls = diff > 0 ? 'positive' : 'negative';
          changeHtml = '<span class="weight-change ' + cls + '">' + (diff > 0 ? '+' : '') + (diff * 100).toFixed(1) + '%</span>';
        }
      }
      barsHtml += '<div class="weight-bar"><span class="weight-bar-label">' + label + '</span><div class="weight-bar-track"><div class="weight-bar-fill" style="width:' + val + '%">' + val + '%</div></div>' + changeHtml + '</div>';
    });

    var historyHtml = status.recentHistory.slice(0, 5).map(function(h) {
      var stratName = Predictor.STRATEGY_NAMES[h.bestStrategy] || h.bestStrategy;
      return '<div class="learning-history-item">' + Utils.formatDateTime(h.learnedAt) + ' 第' + h.triggerDrawId + '回（最優秀: ' + stratName + '）</div>';
    }).join('');

    el.innerHTML = '<h3>学習状態</h3>' + barsHtml +
      '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">学習回数: ' + status.learningCount + '回 / サンプル: ' + status.totalSamples + '</div>' +
      (historyHtml ? '<div class="learning-history"><strong>学習履歴:</strong>' + historyHtml + '</div>' : '') +
      '<button class="btn btn-sm btn-secondary" id="btnResetLearn" style="margin-top:8px">学習をリセット</button>';

    var resetBtn = document.getElementById('btnResetLearn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (confirm('学習をリセットしますか？')) {
          Learner.resetWeights();
          renderVerify();
          if (currentTab === 'tabSettings') renderSettings();
        }
      });
    }
  }

  /* ========== 6. BACKTEST TAB ========== */
  function bindBacktestEvents() {
    document.getElementById('btnBacktest50').addEventListener('click', function() { runBacktest(50); });
    document.getElementById('btnBacktest100').addEventListener('click', function() { runBacktest(100); });
  }

  function runBacktest(n) {
    var data = Utils.getAllDrawData();
    if (data.length < 30) { alert('バックテストにはデータが不足しています（最低30回分必要）。'); return; }

    var overlay = document.getElementById('loadingOverlay');
    var loadText = document.getElementById('loadingText');
    overlay.classList.add('active');
    loadText.textContent = 'バックテスト実行中... (' + n + '回分)';

    setTimeout(function() {
      try {
        var weights = Storage.getWeights();
        Backtest.run(data, weights, n);
      } catch (e) {
        console.error(e);
        alert('バックテスト中にエラーが発生しました。');
      }
      overlay.classList.remove('active');
      renderBacktest();
    }, 100);
  }

  function renderBacktest() {
    var saved = Storage.getBacktestResults();
    if (!saved) {
      document.getElementById('backtestSummary').innerHTML = '';
      document.getElementById('backtestChart').style.display = 'none';
      document.getElementById('backtestDetails').innerHTML = '';
      return;
    }

    var summary = saved.summary;
    var results = saved.results;

    // Summary
    var summaryEl = document.getElementById('backtestSummary');
    summaryEl.innerHTML = '<div class="backtest-summary">' +
      '<div class="stat-card"><div class="stat-value">' + summary.totalDraws + '</div><div class="stat-label">テスト回数</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + summary.avgMatch + '</div><div class="stat-label">平均一致</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + summary.maxMatch + '</div><div class="stat-label">最高一致</div></div>' +
      '</div>' +
      '<div class="card"><h3>等級分布</h3>' +
      Object.entries(summary.prizeCount).map(function(entry) {
        return '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.8rem"><span>' + entry[0] + '</span><span style="font-weight:700">' + entry[1] + '回</span></div>';
      }).join('') +
      '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px">実行: ' + Utils.formatDateTime(summary.runAt) + '</div></div>';

    // Chart
    if (results.length > 0) {
      document.getElementById('backtestChart').style.display = 'block';
      requestAnimationFrame(function() {
        Charts.renderBacktestChart('chartBacktest', results);
      });
    }

    // Details (first 20)
    var detailsEl = document.getElementById('backtestDetails');
    detailsEl.innerHTML = '<div class="card"><h3>詳細結果</h3>' +
      results.slice(0, 20).map(function(r) {
        return '<div class="draw-row"><span class="draw-id">#' + r.drawId + '</span><span class="draw-date">' + Utils.formatDate(r.date) + '</span><span style="font-family:var(--font-mono);font-weight:700;color:' + (r.bestMatchCount >= 3 ? 'var(--success)' : 'var(--text-muted)') + '">' + r.bestMatchCount + '個一致</span><span class="prize-badge ' + Utils.prizeClass(r.bestPrize) + '">' + r.bestPrize + '</span></div>';
      }).join('') +
      '</div>';
  }

  /* ========== 7. SETTINGS TAB ========== */
  function bindSettingsEvents() {
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var settings = Storage.getSettings();
        settings.theme = btn.dataset.theme;
        Storage.saveSettings(settings);
        applyTheme();
      });
    });

    document.getElementById('toggleAutoLearn').addEventListener('change', function(e) {
      var settings = Storage.getSettings();
      settings.autoLearn = e.target.checked;
      Storage.saveSettings(settings);
    });

    document.getElementById('btnApplyLearned').addEventListener('click', function() {
      Utils.showToast('学習済みの値が適用されています');
    });

    document.getElementById('btnResetWeights').addEventListener('click', function() {
      if (confirm('重みをデフォルトに戻しますか？')) {
        Storage.saveWeights(JSON.parse(JSON.stringify(Storage.DEFAULT_WEIGHTS)));
        renderSettings();
        Utils.showToast('重みをリセットしました');
      }
    });

    document.getElementById('btnExport').addEventListener('click', function() {
      var data = Storage.exportAll();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'loto6_backup_' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnImport').addEventListener('click', function() {
      document.getElementById('fileImport').click();
    });

    document.getElementById('fileImport').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var data = JSON.parse(reader.result);
          Storage.importAll(data);
          Utils.showToast('インポート完了');
          location.reload();
        } catch (err) {
          alert('無効なファイルです。');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btnResetData').addEventListener('click', function() {
      if (confirm('すべてのデータをリセットしますか？この操作は取り消せません。')) {
        Storage.resetAll();
        location.reload();
      }
    });

    // QR Code (Improvement 20)
    document.getElementById('btnShowQR').addEventListener('click', function() {
      generateQR();
    });
  }

  function renderSettings() {
    var settings = Storage.getSettings();
    var weights = settings.weights;

    // Theme
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    // Auto-learn
    document.getElementById('toggleAutoLearn').checked = settings.autoLearn;

    // Weight sliders (W1-W12)
    var slidersEl = document.getElementById('weightsSliders');
    var keys = Object.keys(Storage.WEIGHT_LABELS);

    slidersEl.innerHTML = keys.map(function(key) {
      var label = Storage.WEIGHT_LABELS[key];
      var val = Math.round((weights[key] || 0) * 100);
      return '<div class="weight-slider-row"><div class="weight-slider-label"><span>' + key + ': ' + label + '</span><span id="wv_' + key + '">' + val + '%</span></div><input type="range" min="3" max="25" value="' + val + '" data-key="' + key + '" oninput="document.getElementById(\'wv_' + key + '\').textContent=this.value+\'%\'"></div>';
    }).join('');

    slidersEl.querySelectorAll('input[type="range"]').forEach(function(slider) {
      slider.addEventListener('change', function() {
        var newWeights = {};
        slidersEl.querySelectorAll('input[type="range"]').forEach(function(s) {
          newWeights[s.dataset.key] = parseInt(s.value) / 100;
        });
        // Normalize to 1.0
        var total = Object.values(newWeights).reduce(function(s, v) { return s + v; }, 0);
        for (var k in newWeights) newWeights[k] = parseFloat((newWeights[k] / total).toFixed(4));
        Storage.saveWeights(newWeights);
        renderSettings();
      });
    });

    // Weights chart
    requestAnimationFrame(function() {
      Charts.renderWeightsChart('chartWeights', weights);
    });

    // Data info
    var data = Utils.getAllDrawData();
    var sizeKB = (Storage.getStorageSize() / 1024).toFixed(1);
    document.getElementById('dataInfo').textContent = '保存データ量: ' + sizeKB + ' KB';
    document.getElementById('dataRange').textContent = data.length > 0 ?
      '内蔵データ: 第' + data[data.length - 1].id + '回〜第' + data[0].id + '回 (' + data.length + '件)' : 'データなし';
  }

  function generateQR() {
    var container = document.getElementById('qrDisplay');
    var data = Storage.exportAll();
    var json = JSON.stringify(data);

    // QR codes have size limits, compress
    if (json.length > 4000) {
      // For large data, only export recent predictions and settings
      var compact = {
        settings: data.settings,
        predictions: (data.predictions || []).slice(0, 5),
        verifications: (data.verifications || []).slice(0, 5),
        learningHistory: (data.learningHistory || []).slice(0, 3),
        _version: 'v3-compact',
      };
      json = JSON.stringify(compact);
    }

    container.innerHTML = '<div class="qr-container"><div id="qrCanvas"></div></div><p style="font-size:0.65rem;color:var(--text-muted);text-align:center;margin-top:4px">データサイズ: ' + (json.length / 1024).toFixed(1) + ' KB</p>';

    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(document.getElementById('qrCanvas'), {
          text: json,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.L,
        });
      } catch (e) {
        container.innerHTML = '<p style="color:var(--danger);font-size:0.75rem">QRコード生成に失敗しました（データが大きすぎる可能性があります）</p>';
      }
    } else {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem">QRCodeライブラリが読み込めませんでした</p>';
    }
  }

  /* ---------- Ball Detail Popup (Improvement 12) ---------- */
  function showBallDetail(num) {
    var data = Utils.getAllDrawData();
    var analysis = Analyzer.fullAnalysis(data);
    var freq = analysis.frequency[num] || { count: 0, rate: 0 };
    var dormancy = analysis.dormancy[num] || 0;
    var hotCold = analysis.hotCold[num] || { state: 'normal', recentRate: 0 };
    var interval = analysis.intervalDist[num] || { avgInterval: null, probNext: 0 };

    // Find last appearance date
    var lastDate = '-';
    for (var i = 0; i < data.length; i++) {
      if (data[i].nums.indexOf(num) >= 0) {
        lastDate = Utils.formatDate(data[i].date);
        break;
      }
    }

    var stateLabel = hotCold.state === 'hot' ? '<span class="tag-hot">HOT</span>' : hotCold.state === 'cold' ? '<span class="tag-cold">COLD</span>' : '<span class="tag-normal">NORMAL</span>';

    var popup = document.getElementById('ballDetailPopup');
    var content = document.getElementById('ballDetailContent');
    content.innerHTML =
      '<div style="margin-bottom:12px">' + Utils.renderBall(num) + '</div>' +
      '<div style="font-size:1rem;font-weight:700;margin-bottom:12px">番号 ' + num + ' ' + stateLabel + '</div>' +
      '<div class="popup-stat"><span class="popup-stat-label">出現回数</span><span class="popup-stat-value">' + freq.count + '回 (' + (freq.rate * 100).toFixed(1) + '%)</span></div>' +
      '<div class="popup-stat"><span class="popup-stat-label">出遅れ</span><span class="popup-stat-value">' + dormancy + '回不出</span></div>' +
      '<div class="popup-stat"><span class="popup-stat-label">前回出現</span><span class="popup-stat-value">' + lastDate + '</span></div>' +
      '<div class="popup-stat"><span class="popup-stat-label">平均間隔</span><span class="popup-stat-value">' + (interval.avgInterval ? interval.avgInterval.toFixed(1) + '回' : '-') + '</span></div>' +
      '<div class="popup-stat"><span class="popup-stat-label">次回出現確率</span><span class="popup-stat-value">' + (interval.probNext * 100).toFixed(1) + '%</span></div>' +
      '<button class="btn btn-sm btn-secondary" style="margin-top:12px;width:100%" onclick="document.getElementById(\'ballDetailPopup\').classList.remove(\'active\')">閉じる</button>';
    popup.classList.add('active');
    popup.onclick = function(e) { if (e.target === popup) popup.classList.remove('active'); };
  }

  /* ---------- Pull-to-refresh (Improvement 11) ---------- */
  function initPullToRefresh() {
    var startY = 0;
    var pulling = false;

    document.addEventListener('touchstart', function(e) {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!pulling) return;
      var diff = e.touches[0].pageY - startY;
      if (diff > 80 && window.scrollY === 0) {
        pulling = false;
        Utils.hapticFeedback();
        renderCurrentTab();
        Utils.showToast('更新しました');
      }
    }, { passive: true });

    document.addEventListener('touchend', function() { pulling = false; }, { passive: true });
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', init);

  return { switchTab: switchTab, showBallDetail: showBallDetail };
})();
