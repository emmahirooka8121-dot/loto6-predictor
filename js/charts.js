/* ===== Chart.js Graph Rendering (v3 - Heatmap, Trends) ===== */

const Charts = (() => {
  'use strict';

  const chartInstances = {};

  function _destroy(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function destroyAll() {
    for (const id of Object.keys(chartInstances)) _destroy(id);
  }

  function _colors() {
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    return {
      text: isDark ? '#e4e4e7' : '#1a1a2e',
      grid: isDark ? '#333' : '#ddd',
      bg: isDark ? '#141420' : '#fff',
      accent: '#f59e0b',
      accent2: '#00e5ff',
      hot: '#ef4444',
      cold: '#3b82f6',
    };
  }

  // 1. Frequency horizontal bar chart
  function renderFrequencyChart(canvasId, frequency) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const labels = [];
    const counts = [];
    const bgColors = [];
    const avg = Object.values(frequency).reduce((s, f) => s + f.count, 0) / 43;

    for (let n = 1; n <= 43; n++) {
      labels.push(String(n).padStart(2, '0'));
      counts.push(frequency[n] ? frequency[n].count : 0);
      const cnt = frequency[n] ? frequency[n].count : 0;
      bgColors.push(cnt >= avg * 1.2 ? c.hot : cnt <= avg * 0.8 ? c.cold : c.accent);
    }

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: bgColors,
          borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text }, grid: { color: c.grid } },
          y: { ticks: { color: c.text, font: { size: 10, family: 'JetBrains Mono' } }, grid: { display: false } },
        },
      },
    });
  }

  // 2. Range distribution doughnut
  function renderRangeChart(canvasId, rangeDist) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    chartInstances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(rangeDist),
        datasets: [{
          data: Object.values(rangeDist),
          backgroundColor: ['#eab308', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: c.text, font: { size: 12 } } },
        },
      },
    });
  }

  // 3. Odd/Even bar chart
  function renderOddEvenChart(canvasId, oddEven) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const labels = Object.keys(oddEven);
    const values = Object.values(oddEven);
    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: c.accent, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text } },
          y: { ticks: { color: c.text }, grid: { color: c.grid } },
        },
      },
    });
  }

  // 4. Sum histogram
  function renderSumHistogram(canvasId, sumStats) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const labels = Object.keys(sumStats.histogram);
    const values = Object.values(sumStats.histogram);
    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: c.accent2, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: sumStats.mean ? {
            annotations: { meanLine: { type: 'line', xMin: sumStats.mean, xMax: sumStats.mean, borderColor: c.hot, borderWidth: 2 } }
          } : undefined,
        },
        scales: {
          x: { ticks: { color: c.text, font: { size: 10 } } },
          y: { ticks: { color: c.text }, grid: { color: c.grid } },
        },
      },
    });
  }

  // 5. Strategy comparison bar chart
  function renderStrategyChart(canvasId, strategyStats) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const names = {
      optimal: 'AI最適解', trend: 'トレンド', overdue: '出遅れ',
      correlation: '高相関', balanced: '分散',
      hot: 'ホット', cold: 'コールド', composite: '統合AI',
    };
    const labels = Object.keys(strategyStats).map(k => names[k] || k);
    const avgs = Object.values(strategyStats).map(s => parseFloat(s.avgMatch));
    const colors = ['#f59e0b', '#00e5ff', '#ef4444', '#22c55e', '#a855f7', '#ec4899', '#6366f1', '#14b8a6'];

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: '平均一致数', data: avgs, backgroundColor: colors.slice(0, labels.length), borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, font: { size: 11 } } },
          y: { ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true },
        },
      },
    });
  }

  // 6. Accuracy trend line chart (Improvement 18)
  function renderAccuracyTrend(canvasId, trendData) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: trendData.map(t => `#${t.drawId}`),
        datasets: [
          {
            label: '各回平均一致数',
            data: trendData.map(t => t.avgMatch),
            borderColor: c.accent,
            backgroundColor: c.accent + '33',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
          {
            label: '累積平均',
            data: trendData.map(t => t.cumAvg),
            borderColor: c.accent2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: c.text } } },
        scales: {
          x: { ticks: { color: c.text, font: { size: 9 }, maxRotation: 45 }, grid: { color: c.grid } },
          y: { ticks: { color: c.text }, grid: { color: c.grid }, beginAtZero: true },
        },
      },
    });
  }

  // 7. Backtest results bar chart
  function renderBacktestChart(canvasId, results) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const colors = results.map(r => {
      if (r.bestMatchCount >= 5) return '#ef4444';
      if (r.bestMatchCount >= 4) return '#f59e0b';
      if (r.bestMatchCount >= 3) return '#22c55e';
      if (r.bestMatchCount >= 2) return '#3b82f6';
      return '#6b7280';
    });

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: results.map(r => `#${r.drawId}`),
        datasets: [{
          label: '最高一致数',
          data: results.map(r => r.bestMatchCount),
          backgroundColor: colors,
          borderRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, font: { size: 8 }, maxRotation: 90 }, grid: { display: false } },
          y: { ticks: { color: c.text, stepSize: 1 }, grid: { color: c.grid }, beginAtZero: true, max: 6 },
        },
      },
    });
  }

  // 8. Last digit distribution bar chart
  function renderLastDigitChart(canvasId, lastDigit) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const labels = Object.keys(lastDigit);
    const values = Object.values(lastDigit).map(d => d.count);
    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: c.accent, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text }, title: { display: true, text: '末尾数字', color: c.text } },
          y: { ticks: { color: c.text }, grid: { color: c.grid } },
        },
      },
    });
  }

  // 9. Weight bars chart (W1-W12)
  function renderWeightsChart(canvasId, weights) {
    _destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _colors();
    const labels = Object.keys(Storage.WEIGHT_LABELS).map(k => Storage.WEIGHT_LABELS[k]);
    const values = Object.keys(Storage.WEIGHT_LABELS).map(k => (weights[k] || 0) * 100);
    const colors = ['#f59e0b','#ef4444','#8b5cf6','#22c55e','#3b82f6','#ec4899',
                    '#14b8a6','#f97316','#06b6d4','#84cc16','#6366f1','#e11d48'];

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: c.text, font: { size: 9 }, maxRotation: 45 } },
          y: { ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid }, beginAtZero: true },
        },
      },
    });
  }

  return {
    renderFrequencyChart, renderRangeChart, renderOddEvenChart,
    renderSumHistogram, renderStrategyChart, renderAccuracyTrend,
    renderBacktestChart, renderLastDigitChart, renderWeightsChart,
    destroyAll,
  };
})();
