/* ===== Utility Functions ===== */

const Utils = (() => {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function getWeekday(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return WEEKDAYS[d.getDay()];
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatDateTime(isoStr) {
    const d = new Date(isoStr);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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
    const dateStr = nd.toISOString().split('T')[0];
    const weekday = WEEKDAYS[nd.getDay()];
    const allData = getAllDrawData();
    const lastId = allData.length > 0 ? allData[0].id : 2084;
    const nextId = lastId + 1;
    // Check if there's already a draw for today or a future unmatched draw
    return { id: nextId, date: dateStr, weekday, formatted: formatDate(dateStr) };
  }

  function getAllDrawData() {
    const builtin = typeof LOTO6_BUILTIN_DATA !== 'undefined' ? LOTO6_BUILTIN_DATA : [];
    const user = Storage.getUserDraws();
    const merged = [...builtin];
    const ids = new Set(builtin.map(d => d.id));
    for (const ud of user) {
      if (!ids.has(ud.id)) {
        merged.push(ud);
        ids.add(ud.id);
      }
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
    if (options.animate) cls.push('animate');
    if (options.matched) cls.push('matched');
    if (options.bonus) cls.push('bonus');
    const delay = options.delay || 0;
    const style = delay ? `animation-delay: ${delay}s` : '';
    return `<span class="${cls.join(' ')}" ${style ? `style="${style}"` : ''}>${num}</span>`;
  }

  function renderBalls(nums, options = {}) {
    return nums.map((n, i) => renderBall(n, {
      ...options,
      delay: options.animate ? i * 0.08 : 0,
      matched: options.matchedNums ? options.matchedNums.includes(n) : false,
    })).join('');
  }

  function calcSum(nums) {
    return nums.reduce((a, b) => a + b, 0);
  }

  function calcOddEven(nums) {
    const odd = nums.filter(n => n % 2 === 1).length;
    return `${odd}:${6 - odd}`;
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

  return {
    getWeekday, formatDate, formatDateTime, nextDrawDate, nextDrawInfo,
    getAllDrawData, getBallColorClass, renderBall, renderBalls,
    calcSum, calcOddEven, prizeTier, prizeClass
  };
})();
