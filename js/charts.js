/* ===== Chart.js Graph Rendering ===== */

const Charts = (() => {
  const chartInstances = {};

  function _destroy(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function _getCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return canvas.getContext('2d');
  }

  function _isDark() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function _colors() {
    const dark = _isDark();
    return {
      text: dark ? '#e4e4e7' : '#1a1a2e',
      muted: dark ? '#9ca3af' : '#6b7280',
      grid: dark ? '#2a2a3e' : '#e5e7eb',
      bg: dark ? '#141420' : '#ffffff',
    };
  }

  function renderFrequencyChart(canvasId, frequency) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const nums = Object.keys(frequency).map(Number).sort((a,b) => a-b);
    const counts = nums.map(n => frequency[n].count);

    // Highlight top 6 and bottom 6
    const sorted = nums.map(n => ({n, count: frequency[n].count})).sort((a,b) => b.count - a.count);
    const hotNums = new Set(sorted.slice(0, 6).map(x => x.n));
    const coldNums = new Set(sorted.slice(-6).map(x => x.n));

    const colors = nums.map(n => {
      if (hotNums.has(n)) return '#ef4444';
      if (coldNums.has(n)) return '#3b82f6';
      return '#6b7280';
    });

    const c = _colors();
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: nums.map(String),
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderRadius: 3,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `${item.raw}回 (${(frequency[nums[item.dataIndex]].rate * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: c.grid },
            ticks: { color: c.muted, font: { size: 10 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: c.text, font: { size: 9, family: 'JetBrains Mono' } },
          },
        },
      },
    });
  }

  function renderRangeChart(canvasId, rangeDist) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const labels = Object.keys(rangeDist);
    const data = labels.map(k => rangeDist[k].count);
    const bgColors = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7'];

    const c = _colors();
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.text, font: { size: 11 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const rd = rangeDist[labels[item.dataIndex]];
                return `${rd.count}回 (${(rd.rate * 100).toFixed(1)}%)`;
              }
            }
          }
        },
      },
    });
  }

  function renderOddEvenChart(canvasId, oddEven) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const entries = Object.entries(oddEven).sort((a,b) => b[1] - a[1]);
    const labels = entries.map(([k]) => `奇${k.split(':')[0]}:偶${k.split(':')[1]}`);
    const data = entries.map(([,v]) => v);

    const c = _colors();
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: '#f59e0b',
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 10 } } },
          y: { grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 } } },
        },
      },
    });
  }

  function renderSumHistogram(canvasId, sumStats) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx || !sumStats.distribution) return;

    const labels = Object.keys(sumStats.distribution);
    const data = Object.values(sumStats.distribution);

    const c = _colors();
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: '#a855f7',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: undefined,
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 9 }, maxRotation: 45 } },
          y: { grid: { color: c.grid }, ticks: { color: c.muted, font: { size: 10 } } },
        },
      },
    });
  }

  function renderStrategyChart(canvasId, strategyStats) {
    _destroy(canvasId);
    const ctx = _getCtx(canvasId);
    if (!ctx) return;

    const strategies = Object.keys(strategyStats);
    const labels = strategies.map(s => Predictor.STRATEGY_NAMES[s] || s);
    const data = strategies.map(s => strategyStats[s].avgMatch);
    const colors = strategies.map(s => {
      const m = {hot:'#ef4444',cold:'#3b82f6',overdue:'#f97316',balanced:'#22c55e',composite:'#a855f7'};
      return m[s] || '#6b7280';
    });

    const c = _colors();
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '平均一致数',
          data,
          backgroundColor: colors,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `平均: ${item.raw}個`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { color: c.muted, stepSize: 0.5 }, min: 0 },
        },
      },
    });
  }

  function destroyAll() {
    for (const id of Object.keys(chartInstances)) {
      _destroy(id);
    }
  }

  return {
    renderFrequencyChart, renderRangeChart, renderOddEvenChart,
    renderSumHistogram, renderStrategyChart, destroyAll,
  };
})();
