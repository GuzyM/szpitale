(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const num = (n, digits = 0) => n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : new Intl.NumberFormat('pl-PL', { maximumFractionDigits: digits }).format(n);
  const money = n => n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : new Intl.NumberFormat('pl-PL', {style:'currency',currency:'PLN',maximumFractionDigits:2}).format(n);
  const date = value => { const d = new Date(value); return !value || Number.isNaN(d.getTime()) ? 'data niepodana' : new Intl.DateTimeFormat('pl-PL').format(d); };
  function link(url, title, className = 'source-link') {
    try { const u = new URL(url); if (u.protocol !== 'https:') return escape(title); return `<a class="${className}" href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">${escape(title)} ↗</a>`; } catch { return escape(title); }
  }
  const paths = {
    home:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    compare:'M7 3v18M17 3v18M3 7h8M13 17h8',
    chart:'M3 3v18h18M7 16l4-6 4 3 6-8',
    law:'M4 20h16M12 3v17M5 7h14M5 7l-3 7h6L5 7zM19 7l-3 7h6l-3-7z',
    book:'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1',
    people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    note:'M4 3h16v18H4zM8 8h8M8 12h8M8 16h4',
    star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    arrow:'M4 12h16m-6-6 6 6-6 6',
    menu:'M3 6h18M3 12h18M3 18h18',
    close:'m6 6 12 12M6 18 18 6',
    check:'m4 12 5 5L20 6'
  };
  const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.note}"/></svg>`;
  const empty = (title, text) => `<div class="empty"><span class="empty-icon">${icon('note')}</span><h3>${escape(title)}</h3><p>${escape(text)}</p></div>`;
  const field = (id, label, value = '', options = '') => `<label class="field" for="${id}"><span>${escape(label)}</span><input id="${id}" name="${id}" type="number" inputmode="decimal" step="any" min="0" value="${escape(value)}" ${options}></label>`;
  root.HospitalUI = { escape, num, money, date, link, icon, empty, field };
})(window);
