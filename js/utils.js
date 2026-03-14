/* ===== Utility Functions (v3 Enhanced) ===== */

const Utils = (() => {
  'use strict';
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function getWeekday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return WEEKDAYS[d.getDay()];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function nextDrawDate(fromDate) {
    const d = fromDate ? new Date(fromDate) : new Date();
    d.setHours(0,0,0,0);
    const dow = d.getDay();
    let daysToMon = (8 - dow) % 7;
    let daysToThu = (11 - dow) % 7;
    if (daysToMon === 0) daysToMon = 7;
    if (daysToThu === 0) daysToThu = 7;
    const next = Math.min(daysToMon, daysToThu);
    const nd = new Date(d);
    nd.setDate(nd.getDate() + next);
    return nd;
  }

  function nextDrawInfo() {
    const nd = nextDrawDate();
    const dateStr = toDateStr(nd);
    const weekday = WEEKDAYS[nd.getDay()];
    const allData = getAllDrawData();
    const lastId = allData.length > 0 ? allData[0].id : 2084;
    const now = new Date();
    const daysUntil = Math.max(0, Math.ceil((nd - now) / 86400000));
    return { id: lastId + 1, date: dateStr, weekday, formatted: `${formatDate(dateStr)}（${weekday}）`, daysUntil };
  }

  function getAllDrawData() {
    const builtin = typeof LOTO6_BUILTIN_DATA !== 'undefined' ? LOTO6_BUILTIN_DATA : [];
    const user = Storage.getUserDraws();
    const merged = [...builtin];
    const ids = new Set(builtin.map(d => d.id));
    for (const ud of user) {
      if (!ids.has(ud.id)) { merged.push(ud); ids.add(ud.id); }
    }
    merged.sort((a, b) => b.id - a.id);
    return merged;
  }

  function getBallColorClass(num) {
    if (num <= 9) return 'ball-1-9';
    if (num <= 19) return 'ball-10-19';
    if (num <= 29) return 'ball-20-29';
    if (num <= 39) return 'ball-30-39';
    return 'ball-40-43';
  }

  function renderBall(num, options = {}) {
    const cls = ['ball', getBallColorClass(num)];
    if (options.animate) cls.push('ball-animate');
    if (options.matched) cls.push('ball-matched');
    if (options.bonus) cls.push('ball-bonus');
    if (options.clickable) cls.push('ball-clickable');
    const delay = options.delay || 0;
    const style = delay ? `animation-delay: ${delay}ms` : '';
    const numStr = String(num).padStart(2, '0');
    const dataAttr = options.clickable ? `data-ball-num="${num}" onclick="App.showBallDetail(${num})"` : '';
    return `<span class="${cls.join(' ')}" ${style ? `style="${style}"` : ''} ${dataAttr}>${numStr}</span>`;
  }

  function renderBalls(nums, options = {}) {
    return nums.map((n, i) => renderBall(n, {
      ...options,
      delay: options.animate ? i * 300 : 0,
      matched: options.matchedNums ? options.matchedNums.includes(n) : (options.matched || false),
    })).join('');
  }

  function calcSum(nums) { return nums.reduce((a, b) => a + b, 0); }

  function calcOddEvenStr(nums) {
    const odd = nums.filter(n => n % 2 === 1).length;
    return `${odd}:${6 - odd}`;
  }

  function calcOddEvenObj(nums) {
    const odd = nums.filter(n => n % 2 === 1).length;
    return { odd, even: nums.length - odd };
  }

  function prizeTier(matchCount, bonusMatch) {
    if (matchCount === 6) return '1等';
    if (matchCount === 5 && bonusMatch) return '2等';
    if (matchCount === 5) return '3等';
    if (matchCount === 4) return '4等';
    if (matchCount === 3) return '5等';
    return 'ハズレ';
  }

  function prizeClass(tier) {
    const map = {'1等':'prize-1','2等':'prize-2','3等':'prize-3','4等':'prize-4','5等':'prize-5'};
    return map[tier] || 'prize-miss';
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => showToast('コピーしました')).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('コピーしました');
  }

  function showToast(msg, duration) {
    duration = duration || 2000;
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  function hapticFeedback() {
    if (navigator.vibrate) navigator.vibrate([30]);
  }

  function renderMarkSheet(nums) {
    const selected = new Set(nums);
    let html = '<div class="marksheet">';
    for (let n = 1; n <= 43; n++) {
      const cls = selected.has(n) ? 'ms-num ms-marked' : 'ms-num';
      html += `<div class="${cls}">${String(n).padStart(2, '0')}</div>`;
    }
    html += '</div>';
    return html;
  }

  function renderCopyableTextarea(text, id) {
    return `<textarea readonly class="copyable-textarea" id="${id || ''}" onfocus="this.select()" onclick="this.select()">${text}</textarea>`;
  }

  function debounce(fn, ms) {
    let timer;
    return function() {
      clearTimeout(timer);
      const args = arguments;
      const ctx = this;
      timer = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }

  return {
    getWeekday, formatDate, formatDateTime, toDateStr,
    nextDrawDate, nextDrawInfo, getAllDrawData,
    getBallColorClass, renderBall, renderBalls,
    calcSum, calcOddEvenStr, calcOddEvenObj, prizeTier, prizeClass,
    copyToClipboard, showToast, hapticFeedback,
    renderMarkSheet, renderCopyableTextarea, debounce
  };
})();
