/* ===== Main Application ===== */

const App = (() => {
  let currentTab = 'tabPredict';
  let historyPage = 0;
  const HISTORY_PAGE_SIZE = 20;

  /* --- Initialization --- */
  function init() {
    applyTheme();
    renderHeader();
    bindTabEvents();
    bindPredictEvents();
    bindHistoryEvents();
    bindRecordsEvents();
    bindVerifyEvents();
    bindSettingsEvents();
    renderCurrentTab();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  /* --- Theme --- */
  function applyTheme() {
    const settings = Storage.getSettings();
    let theme = settings.theme || 'dark';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.body.setAttribute('data-theme', theme);
    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });
  }

  /* --- Header --- */
  function renderHeader() {
    const info = Utils.nextDrawInfo();
    document.getElementById('nextDrawInfo').textContent =
      `次回: 第${info.id}回 ${info.formatted}（${info.weekday}）`;
  }

  /* --- Tab Navigation --- */
  function bindTabEvents() {
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
    renderCurrentTab();
  }

  function renderCurrentTab() {
    switch (currentTab) {
      case 'tabPredict': renderPredict(); break;
      case 'tabAnalysis': renderAnalysis(); break;
      case 'tabHistory': renderHistory(); break;
      case 'tabRecords': renderRecords(); break;
      case 'tabVerify': renderVerify(); break;
      case 'tabSettings': renderSettings(); break;
    }
  }

  /* ===== 1. Predict Tab ===== */
  function bindPredictEvents() {
    document.getElementById('btnGenerate').addEventListener('click', () => {
      const data = Utils.getAllDrawData();
      if (data.length === 0) {
        alert('抽選データがありません。');
        return;
      }
      Predictor.generate(data);
      renderPredict();
    });
  }

  function renderPredict() {
    const predictions = Storage.getPredictions();
    const container = document.getElementById('predictionsDisplay');

    if (predictions.length === 0) {
      container.innerHTML = `
        <div class="target-draw-info">下のボタンをタップして予想番号を生成してください</div>
      `;
      return;
    }

    const latest = predictions[0];
    const learningStatus = Learner.getStatus();

    let html = `
      <div class="target-draw-info">
        対象: 第${latest.targetDrawId}回 ${Utils.formatDate(latest.targetDate)}（${latest.targetWeekday}）抽選分
      </div>
    `;

    latest.sets.forEach((set, i) => {
      const name = Predictor.STRATEGY_NAMES[set.strategy] || set.strategy;
      const sum = Utils.calcSum(set.nums);
      const oe = Utils.calcOddEven(set.nums);
      html += `
        <div class="prediction-card ${set.strategy}" style="animation-delay: ${i * 0.05}s">
          <div class="prediction-card-header">
            <span class="strategy-name">${['①','②','③','④','⑤'][i]} ${name}</span>
            <span class="prediction-meta">合計:${sum} 奇偶:${oe}</span>
          </div>
          <div class="prediction-balls">${Utils.renderBalls(set.nums, { animate: true })}</div>
          <div class="prediction-meta">生成日時: ${Utils.formatDateTime(latest.createdAt)}</div>
          ${set.strategy === 'composite' ? `
            <div class="learning-info">
              学習回数: ${learningStatus.learningCount}回
              ${learningStatus.bestStrategy ? ` / 最優秀: ${Predictor.STRATEGY_NAMES[learningStatus.bestStrategy]}（平均${learningStatus.bestStrategyAvg?.toFixed(1) || '-'}個）` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /* ===== 2. Analysis Tab ===== */
  function renderAnalysis(period) {
    const data = Utils.getAllDrawData();
    if (data.length === 0) {
      document.getElementById('analysisContent').innerHTML = '<p style="text-align:center;color:var(--text-muted)">データがありません</p>';
      return;
    }

    period = period || parseInt(document.querySelector('.period-btn.active')?.dataset?.period) || 10;
    if (isNaN(period)) period = 'all';

    const analysis = Analyzer.fullAnalysis(data, period === 'all' ? null : period);
    const content = document.getElementById('analysisContent');

    content.innerHTML = `
      <div class="analysis-card">
        <h3>出現頻度（${period === 'all' ? '全期間' : '直近' + period + '回'}）</h3>
        <div class="chart-container" style="height:${43 * 18}px"><canvas id="chartFreq"></canvas></div>
      </div>
      <div class="analysis-card">
        <h3>番号帯分布</h3>
        <div class="chart-container" style="height:250px"><canvas id="chartRange"></canvas></div>
      </div>
      <div class="analysis-card">
        <h3>奇数・偶数パターン</h3>
        <div class="chart-container" style="height:200px"><canvas id="chartOE"></canvas></div>
      </div>
      <div class="analysis-card">
        <h3>合計値ヒストグラム（平均: ${analysis.sumStats.mean || '-'} / 中央値: ${analysis.sumStats.median || '-'}）</h3>
        <div class="chart-container" style="height:200px"><canvas id="chartSum"></canvas></div>
      </div>
      <div class="analysis-card">
        <h3>出遅れ番号 TOP10</h3>
        <ul class="dormancy-list">${renderDormancyList(analysis.dormancy)}</ul>
      </div>
      <div class="analysis-card">
        <h3>よく一緒に出る番号ペア TOP10</h3>
        <ul class="correlation-list">${renderCorrelationList(analysis.correlation)}</ul>
      </div>
      <div class="analysis-card">
        <h3>月曜 vs 木曜の傾向</h3>
        <p style="font-size:0.8rem;color:var(--text-muted)">
          月曜データ: ${analysis.weekdayTrend.monday?.count || 0}回 / 木曜データ: ${analysis.weekdayTrend.thursday?.count || 0}回
        </p>
        ${renderWeekdayDiff(analysis.weekdayTrend)}
      </div>
    `;

    // Render charts after DOM update
    requestAnimationFrame(() => {
      Charts.renderFrequencyChart('chartFreq', analysis.frequency);
      Charts.renderRangeChart('chartRange', analysis.rangeDist);
      Charts.renderOddEvenChart('chartOE', analysis.oddEven);
      Charts.renderSumHistogram('chartSum', analysis.sumStats);
    });

    // Bind period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Charts.destroyAll();
        const p = btn.dataset.period;
        renderAnalysis(p === 'all' ? 'all' : parseInt(p));
      });
    });
  }

  function renderDormancyList(dormancy) {
    if (!dormancy || Object.keys(dormancy).length === 0) return '<li>データなし</li>';
    return Object.entries(dormancy)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 10)
      .map(([num, count]) => `
        <li>
          <span>${Utils.renderBall(parseInt(num))} 番号 ${num}</span>
          <span style="font-family:'JetBrains Mono';font-weight:700">${count}回不出</span>
        </li>
      `).join('');
  }

  function renderCorrelationList(correlation) {
    if (!correlation || correlation.length === 0) return '<li>データなし</li>';
    return correlation.slice(0, 10).map(({pair, count}) => {
      const [a, b] = pair.split('-').map(Number);
      return `<li><span>${Utils.renderBall(a)}${Utils.renderBall(b)}</span><span style="font-family:'JetBrains Mono';font-weight:700">${count}回</span></li>`;
    }).join('');
  }

  function renderWeekdayDiff(wt) {
    if (!wt.monday?.frequency || !wt.thursday?.frequency) return '<p style="font-size:0.8rem;color:var(--text-muted)">データ不足</p>';
    const diffs = [];
    for (let n = 1; n <= 43; n++) {
      const monRate = wt.monday.frequency[n]?.rate || 0;
      const thuRate = wt.thursday.frequency[n]?.rate || 0;
      const diff = monRate - thuRate;
      if (Math.abs(diff) > 0.03) {
        diffs.push({num: n, diff, monRate, thuRate});
      }
    }
    if (diffs.length === 0) return '<p style="font-size:0.8rem;color:var(--text-muted)">目立った差はありません</p>';
    diffs.sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff));
    return `<ul class="dormancy-list">${diffs.slice(0, 8).map(({num, diff}) => `
      <li>
        <span>${Utils.renderBall(num)} 番号${num}</span>
        <span style="color:${diff > 0 ? 'var(--hot)' : 'var(--cold)'}">
          ${diff > 0 ? '月曜+' : '木曜+'}${(Math.abs(diff)*100).toFixed(1)}%
        </span>
      </li>
    `).join('')}</ul>`;
  }

  /* ===== 3. History Tab ===== */
  function bindHistoryEvents() {
    document.getElementById('historySearch').addEventListener('input', (e) => {
      historyPage = 0;
      renderHistory(e.target.value.trim());
    });
    document.getElementById('btnAddDraw').addEventListener('click', openAddDrawModal);
    document.getElementById('btnLoadMore').addEventListener('click', () => {
      historyPage++;
      appendHistory();
    });
  }

  function renderHistory(searchNum) {
    const data = Utils.getAllDrawData();
    let filtered = data;
    if (searchNum && !isNaN(parseInt(searchNum))) {
      const num = parseInt(searchNum);
      filtered = data.filter(d => d.nums.includes(num) || d.bonus === num);
    }

    // Latest draw
    const latestEl = document.getElementById('latestDraw');
    if (data.length > 0) {
      const d = data[0];
      latestEl.innerHTML = `
        <div class="draw-label">最新: 第${d.id}回 ${Utils.formatDate(d.date)}（${Utils.getWeekday(d.date)}）</div>
        <div class="prediction-balls">
          ${Utils.renderBalls(d.nums)}
          ${Utils.renderBall(d.bonus, { bonus: true })}
        </div>
      `;
    } else {
      latestEl.innerHTML = '<p style="color:var(--text-muted)">データなし</p>';
    }

    // History list
    historyPage = 0;
    const list = document.getElementById('historyList');
    const page = filtered.slice(0, HISTORY_PAGE_SIZE);
    list.innerHTML = page.map(d => renderDrawRow(d)).join('');
    document.getElementById('btnLoadMore').style.display =
      filtered.length > HISTORY_PAGE_SIZE ? 'block' : 'none';
  }

  function appendHistory() {
    const data = Utils.getAllDrawData();
    const search = document.getElementById('historySearch').value.trim();
    let filtered = data;
    if (search && !isNaN(parseInt(search))) {
      filtered = data.filter(d => d.nums.includes(parseInt(search)));
    }
    const start = historyPage * HISTORY_PAGE_SIZE;
    const page = filtered.slice(start, start + HISTORY_PAGE_SIZE);
    const list = document.getElementById('historyList');
    list.innerHTML += page.map(d => renderDrawRow(d)).join('');
    document.getElementById('btnLoadMore').style.display =
      start + HISTORY_PAGE_SIZE < filtered.length ? 'block' : 'none';
  }

  function renderDrawRow(d) {
    return `
      <div class="draw-row">
        <span class="draw-id">#${d.id}</span>
        <span class="draw-date">${Utils.formatDate(d.date)}</span>
        <span class="draw-balls">
          ${d.nums.map(n => Utils.renderBall(n)).join('')}
          ${Utils.renderBall(d.bonus, { bonus: true })}
        </span>
      </div>
    `;
  }

  /* --- Add Draw Modal --- */
  let selectedNums = [];
  let selectedBonus = null;

  function openAddDrawModal() {
    const modal = document.getElementById('addDrawModal');
    const data = Utils.getAllDrawData();
    const nextId = data.length > 0 ? data[0].id + 1 : 1;
    document.getElementById('inputDrawId').value = nextId;
    document.getElementById('inputDrawDate').value = new Date().toISOString().split('T')[0];
    selectedNums = [];
    selectedBonus = null;
    renderNumberGrids();
    updateSelectedDisplay();
    document.getElementById('formError').textContent = '';
    modal.classList.add('active');

    document.getElementById('modalClose').onclick = () => modal.classList.remove('active');
    document.getElementById('modalCancel').onclick = () => modal.classList.remove('active');
    document.getElementById('modalSave').onclick = saveNewDraw;
  }

  function renderNumberGrids() {
    const grid = document.getElementById('numberGrid');
    const bonusGrid = document.getElementById('bonusGrid');
    grid.innerHTML = '';
    bonusGrid.innerHTML = '';

    for (let n = 1; n <= 43; n++) {
      // Main grid
      const btn = document.createElement('button');
      btn.textContent = n;
      btn.addEventListener('click', () => toggleNumber(n));
      grid.appendChild(btn);

      // Bonus grid
      const bBtn = document.createElement('button');
      bBtn.textContent = n;
      bBtn.addEventListener('click', () => toggleBonus(n));
      bonusGrid.appendChild(bBtn);
    }
  }

  function toggleNumber(n) {
    if (selectedNums.includes(n)) {
      selectedNums = selectedNums.filter(x => x !== n);
    } else if (selectedNums.length < 6) {
      selectedNums.push(n);
    }
    updateNumberGridUI();
    updateSelectedDisplay();
  }

  function toggleBonus(n) {
    selectedBonus = selectedBonus === n ? null : n;
    updateNumberGridUI();
    updateSelectedDisplay();
  }

  function updateNumberGridUI() {
    document.querySelectorAll('#numberGrid button').forEach((btn, i) => {
      const n = i + 1;
      btn.classList.toggle('selected', selectedNums.includes(n));
      btn.classList.toggle('disabled-num', selectedNums.length >= 6 && !selectedNums.includes(n));
    });
    document.querySelectorAll('#bonusGrid button').forEach((btn, i) => {
      const n = i + 1;
      btn.classList.toggle('selected', selectedBonus === n);
    });
  }

  function updateSelectedDisplay() {
    document.getElementById('selectedNums').textContent =
      selectedNums.length > 0 ? `選択: ${selectedNums.sort((a,b)=>a-b).join(', ')} (${selectedNums.length}/6)` : '選択: なし';
    document.getElementById('selectedBonus').textContent =
      selectedBonus ? `選択: ${selectedBonus}` : '選択: なし';
  }

  function saveNewDraw() {
    const id = parseInt(document.getElementById('inputDrawId').value);
    const date = document.getElementById('inputDrawDate').value;
    const errEl = document.getElementById('formError');

    if (!id || id < 1) { errEl.textContent = '回号を入力してください'; return; }
    if (!date) { errEl.textContent = '日付を入力してください'; return; }
    if (selectedNums.length !== 6) { errEl.textContent = '本数字を6個選択してください'; return; }
    if (selectedBonus === null) { errEl.textContent = 'ボーナス数字を選択してください'; return; }
    if (selectedNums.includes(selectedBonus)) { errEl.textContent = 'ボーナス数字は本数字と異なる必要があります'; return; }

    const draw = {
      id,
      date,
      nums: [...selectedNums].sort((a,b) => a-b),
      bonus: selectedBonus,
    };

    Storage.saveUserDraw(draw);

    // Auto-verify any unverified predictions for this draw
    const verified = Verifier.verifyAll();

    document.getElementById('addDrawModal').classList.remove('active');
    renderHistory();
    renderHeader();

    if (verified > 0) {
      alert(`結果を保存しました。${verified}件の予想を自動検証しました。`);
    }
  }

  /* ===== 4. Records Tab ===== */
  function bindRecordsEvents() {
    document.getElementById('recordsFilter').addEventListener('change', renderRecords);
    document.getElementById('recordsSort').addEventListener('change', renderRecords);
  }

  function renderRecords() {
    const predictions = Storage.getPredictions();
    const verifications = Storage.getVerifications();
    const verMap = {};
    verifications.forEach(v => verMap[v.targetDrawId] = v);

    const summaryEl = document.getElementById('recordsSummary');
    const listEl = document.getElementById('recordsList');

    // Summary
    const totalPreds = predictions.length;
    const latestDate = predictions.length > 0 ? predictions[0].targetDate : '-';
    let totalMatch = 0, matchCount = 0;
    verifications.forEach(v => v.results.forEach(r => { totalMatch += r.matchCount; matchCount++; }));
    const avgMatch = matchCount > 0 ? (totalMatch / matchCount).toFixed(1) : '-';

    summaryEl.innerHTML = `
      <div class="stat-item"><div class="stat-value">${totalPreds}</div><div class="stat-label">総予測回数</div></div>
      <div class="stat-item"><div class="stat-value">${latestDate !== '-' ? Utils.formatDate(latestDate) : '-'}</div><div class="stat-label">最新予測日</div></div>
      <div class="stat-item"><div class="stat-value">${avgMatch}</div><div class="stat-label">平均一致数</div></div>
    `;

    if (predictions.length === 0) {
      listEl.innerHTML = `
        <div class="no-records">
          <p>まだ予測がありません。</p>
          <p>予想タブで最初の予測を生成してください。</p>
          <button class="btn-secondary" onclick="document.querySelector('[data-tab=tabPredict]').click()">予想タブへ</button>
        </div>
      `;
      return;
    }

    // Filter & sort
    const filter = document.getElementById('recordsFilter').value;
    const sort = document.getElementById('recordsSort').value;

    let filtered = [...predictions];
    if (filter === 'verified') filtered = filtered.filter(p => p.verified);
    if (filter === 'unverified') filtered = filtered.filter(p => !p.verified);

    if (sort === 'oldest') filtered.reverse();
    if (sort === 'bestmatch') {
      filtered.sort((a, b) => {
        const va = verMap[a.targetDrawId];
        const vb = verMap[b.targetDrawId];
        const ma = va ? Math.max(...va.results.map(r => r.matchCount)) : -1;
        const mb = vb ? Math.max(...vb.results.map(r => r.matchCount)) : -1;
        return mb - ma;
      });
    }

    listEl.innerHTML = filtered.map((pred, idx) => {
      const ver = verMap[pred.targetDrawId];
      const hasDrawData = Utils.getAllDrawData().some(d => d.id === pred.targetDrawId);

      let statusBadge, statusClass;
      if (ver) {
        statusBadge = '検証済み';
        statusClass = 'badge-verified';
      } else if (hasDrawData) {
        statusBadge = '結果待ち';
        statusClass = 'badge-waiting';
      } else {
        statusBadge = '未検証';
        statusClass = 'badge-unverified';
      }

      let strategiesHtml = pred.sets.map(set => {
        const name = Predictor.STRATEGY_NAMES[set.strategy] || set.strategy;
        const verResult = ver?.results?.find(r => r.strategy === set.strategy);

        let matchHtml = '';
        if (verResult) {
          matchHtml = `<span class="record-match-info">${verResult.matchCount}個一致${verResult.bonusMatch ? '+B' : ''} → <span class="prize-badge ${Utils.prizeClass(verResult.prize)}">${verResult.prize}</span></span>`;
        } else {
          matchHtml = '<span class="record-match-info" style="opacity:0.5">抽選結果待ち</span>';
        }

        const matchedSet = verResult ? new Set(verResult.matched) : new Set();
        const balls = set.nums.map(n => Utils.renderBall(n, { matched: matchedSet.has(n) })).join('');

        return `
          <div class="record-strategy-row">
            <span class="record-strategy-name" style="color:var(--${set.strategy})">${name}</span>
            ${balls}
            ${matchHtml}
          </div>
        `;
      }).join('');

      let footerHtml = '';
      if (ver) {
        footerHtml = `
          <div class="record-footer">
            当選番号: ${Utils.renderBalls(ver.actualNums)} ${Utils.renderBall(ver.actualBonus, { bonus: true })}
            <br>最高: ${Predictor.STRATEGY_NAMES[ver.bestMatch.strategy]}（${ver.bestMatch.matchCount}個一致）
          </div>
        `;
      }

      return `
        <div class="record-card" style="animation-delay:${idx * 0.03}s">
          <div class="record-card-header">
            <div>
              <div class="record-draw-info">第${pred.targetDrawId}回 ${Utils.formatDate(pred.targetDate)}（${pred.targetWeekday}）</div>
              <div class="record-created">予測生成: ${Utils.formatDateTime(pred.createdAt)}</div>
            </div>
            <span class="verification-badge ${statusClass}">${statusBadge}</span>
          </div>
          <div class="record-strategies">${strategiesHtml}</div>
          ${footerHtml}
        </div>
      `;
    }).join('');
  }

  /* ===== 5. Verify Tab ===== */
  function bindVerifyEvents() {
    document.getElementById('btnVerify').addEventListener('click', () => {
      const count = Verifier.verifyAll();
      if (count > 0) {
        alert(`${count}件の予想を検証しました。`);
      } else {
        alert('検証対象の予想がありません。（未検証の予想に対する抽選結果が必要です）');
      }
      renderVerify();
    });
  }

  function renderVerify() {
    const verifications = Storage.getVerifications();
    const stats = Verifier.getStats();
    const learningStatus = Learner.getStatus();

    // Latest verification
    const latestEl = document.getElementById('latestVerification');
    if (verifications.length > 0) {
      const v = verifications[0];
      latestEl.innerHTML = `
        <div class="analysis-card">
          <h3>最新検証: 第${v.targetDrawId}回 (${Utils.formatDate(v.drawDate)})</h3>
          <div style="margin-bottom:8px">
            当選番号: ${Utils.renderBalls(v.actualNums)} ${Utils.renderBall(v.actualBonus, { bonus: true })}
          </div>
          ${v.results.map(r => {
            const name = Predictor.STRATEGY_NAMES[r.strategy] || r.strategy;
            return `
              <div class="verification-result-card">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-weight:700;color:var(--${r.strategy})">${name}</span>
                  <span class="prize-badge ${Utils.prizeClass(r.prize)}">${r.prize}</span>
                </div>
                <div style="margin:6px 0"><span class="match-count">${r.matchCount}</span> <span style="font-size:0.8rem">個一致${r.bonusMatch ? ' +ボーナス' : ''}</span></div>
                ${r.matched.length > 0 ? `<div style="font-size:0.75rem;color:var(--text-muted)">一致: ${r.matched.join(', ')}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      latestEl.innerHTML = '<div class="analysis-card"><h3>検証結果</h3><p style="color:var(--text-muted)">まだ検証がありません</p></div>';
    }

    // Stats
    const statsEl = document.getElementById('verificationStats');
    if (stats.total > 0) {
      const strategyOrder = ['hot','cold','overdue','balanced','composite'];
      const chartId = 'chartStrategy';

      statsEl.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">検証セット数</div></div>
          <div class="stat-card"><div class="stat-value">${stats.avgMatch}</div><div class="stat-label">平均一致数</div></div>
          <div class="stat-card"><div class="stat-value">${stats.maxMatch}</div><div class="stat-label">最高一致数</div></div>
          <div class="stat-card"><div class="stat-value">${stats.prizeCount['5等'] || 0}</div><div class="stat-label">5等以上</div></div>
        </div>
        <div class="analysis-card">
          <h3>戦略別成績</h3>
          <div class="chart-container" style="height:200px"><canvas id="${chartId}"></canvas></div>
        </div>
      `;

      requestAnimationFrame(() => {
        if (Object.keys(stats.strategyStats).length > 0) {
          Charts.renderStrategyChart(chartId, stats.strategyStats);
        }
      });
    } else {
      statsEl.innerHTML = '';
    }

    // Learning status
    renderLearningStatus(learningStatus);
  }

  function renderLearningStatus(status) {
    const el = document.getElementById('learningStatus');
    const weights = status.currentWeights;
    const prev = status.previousWeights;

    const weightKeys = [
      { key: 'frequency', label: '出現頻度' },
      { key: 'dormancy', label: '出遅れ度' },
      { key: 'correlation', label: '相関' },
      { key: 'trend', label: 'トレンド' },
      { key: 'balance', label: 'バランス' },
      { key: 'weekday', label: '曜日' },
    ];

    const barsHtml = weightKeys.map(({key, label}) => {
      const val = weights[key] || 0;
      let changeHtml = '';
      if (prev) {
        const diff = val - (prev[key] || 0);
        if (diff !== 0) {
          const cls = diff > 0 ? 'positive' : 'negative';
          changeHtml = `<span class="weight-change ${cls}">${diff > 0 ? '+' : ''}${diff}%</span>`;
        }
      }
      return `
        <div class="weight-bar">
          <span class="weight-bar-label">${label}</span>
          <div class="weight-bar-track">
            <div class="weight-bar-fill" style="width:${val}%">${val}%</div>
          </div>
          ${changeHtml}
        </div>
      `;
    }).join('');

    const historyHtml = status.recentHistory.slice(0, 5).map(h => `
      <div class="learning-history-item">
        ${Utils.formatDateTime(h.learnedAt)} — 第${h.triggerDrawId}回
        （最優秀: ${Predictor.STRATEGY_NAMES[h.bestStrategy] || h.bestStrategy}）
      </div>
    `).join('');

    el.innerHTML = `
      <h3>🧠 学習状態</h3>
      ${barsHtml}
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
        学習回数: ${status.learningCount}回 / サンプル数: ${status.totalSamples}
      </div>
      ${historyHtml ? `
        <div class="learning-history">
          <strong>学習履歴:</strong>
          ${historyHtml}
        </div>
      ` : ''}
      <button class="btn-secondary btn-reset-learn" id="btnResetLearn">学習をリセット</button>
    `;

    document.getElementById('btnResetLearn')?.addEventListener('click', () => {
      if (confirm('学習をリセットし、重みをデフォルトに戻しますか？')) {
        Learner.resetWeights();
        renderVerify();
        renderSettings();
      }
    });
  }

  /* ===== 6. Settings Tab ===== */
  function bindSettingsEvents() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const settings = Storage.getSettings();
        settings.theme = btn.dataset.theme;
        Storage.saveSettings(settings);
        applyTheme();
      });
    });

    document.getElementById('toggleAutoLearn').addEventListener('change', (e) => {
      const settings = Storage.getSettings();
      settings.autoLearn = e.target.checked;
      Storage.saveSettings(settings);
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      const data = Storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loto6_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('fileImport').click();
    });

    document.getElementById('fileImport').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          Storage.importAll(data);
          alert('データをインポートしました。');
          location.reload();
        } catch {
          alert('無効なファイルです。');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btnResetData').addEventListener('click', () => {
      if (confirm('すべてのデータをリセットしますか？この操作は取り消せません。')) {
        Storage.resetAll();
        location.reload();
      }
    });

    document.getElementById('btnApplyLearned').addEventListener('click', () => {
      renderSettings();
      alert('学習済みの値が適用されています。');
    });

    document.getElementById('btnResetWeights').addEventListener('click', () => {
      Storage.saveWeights({ ...Storage.DEFAULT_SETTINGS.weights });
      renderSettings();
    });
  }

  function renderSettings() {
    const settings = Storage.getSettings();
    const weights = settings.weights;

    // Theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });

    // Auto-learn toggle
    document.getElementById('toggleAutoLearn').checked = settings.autoLearn;

    // Weight sliders
    const slidersEl = document.getElementById('weightsSliders');
    const weightKeys = [
      { key: 'frequency', label: '出現頻度' },
      { key: 'dormancy', label: '出遅れ度' },
      { key: 'correlation', label: '相関' },
      { key: 'trend', label: 'トレンド' },
      { key: 'balance', label: 'バランス' },
      { key: 'weekday', label: '曜日' },
    ];

    slidersEl.innerHTML = weightKeys.map(({key, label}) => `
      <div class="weight-slider-row">
        <div class="weight-slider-label">
          <span>${label}</span>
          <span id="weightVal_${key}">${weights[key]}%</span>
        </div>
        <input type="range" min="5" max="50" value="${weights[key]}" data-key="${key}"
               oninput="document.getElementById('weightVal_${key}').textContent=this.value+'%'">
      </div>
    `).join('');

    // Save on slider change
    slidersEl.querySelectorAll('input[type="range"]').forEach(slider => {
      slider.addEventListener('change', () => {
        const newWeights = {};
        slidersEl.querySelectorAll('input[type="range"]').forEach(s => {
          newWeights[s.dataset.key] = parseInt(s.value);
        });
        // Normalize
        const total = Object.values(newWeights).reduce((a,b) => a+b, 0);
        for (const k of Object.keys(newWeights)) {
          newWeights[k] = Math.round(newWeights[k] / total * 100);
        }
        const sum = Object.values(newWeights).reduce((a,b) => a+b, 0);
        if (sum !== 100) {
          const maxK = Object.keys(newWeights).reduce((a,b) => newWeights[a] >= newWeights[b] ? a : b);
          newWeights[maxK] += 100 - sum;
        }
        Storage.saveWeights(newWeights);
        renderSettings();
      });
    });

    // Data info
    const data = Utils.getAllDrawData();
    const size = Storage.getStorageSize();
    const sizeKB = (size / 1024).toFixed(1);
    document.getElementById('dataInfo').textContent = `保存データ量: ${sizeKB} KB`;
    document.getElementById('dataRange').textContent =
      data.length > 0 ? `内蔵データ: 第${data[data.length-1].id}回〜第${data[0].id}回 (${data.length}件)` : 'データなし';
  }

  /* --- Start --- */
  document.addEventListener('DOMContentLoaded', init);

  return { switchTab };
})();
