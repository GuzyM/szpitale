(function (root) {
  'use strict';
  const KEY = 'hospitalapp-workspace-v2';
  let available = true;
  function read(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { available = false; return fallback; } }
  function initial() {
    const old = read('hospitalapp-jgp-v06', null) || read('hospitalapp-jgp-v05', {}) || {};
    const saved = read(KEY, {}) || {};
    const notes = read('hospitalapp-local-notes-v1', []);
    const preferences = read('hospitalapp-mz-legislation-preferences-v1', {}) || {};
    const payroll = read('hospitalapp-payroll-impact-v09', {}) || {};
    const coefficients = {};
    for (const [code, rows] of Object.entries(old.coefficientsByGroup || {})) {
      if (!Array.isArray(rows) || old.coefficientEnabledByGroup?.[code] === false) continue;
      coefficients[code] = rows.map(row => ({ value: row.value, operation: row.combination === 'multiply' ? 'multiply' : 'sum', name: row.name || '' }));
    }
    const value = { favorites: [], compare: [], scenarios: [], price: old.customPrice ?? '', selected: old.groupCode || null,
      coefficients, notes: Array.isArray(notes) ? notes : [], preferences, payroll, ...saved };
    value.scenarios = Array.isArray(value.scenarios) ? value.scenarios.filter(s => s && typeof s.id === 'string' && s.input && typeof s.input === 'object').slice(0,30) : [];
    value.notes = Array.isArray(value.notes) ? value.notes.filter(n => n && typeof n.id === 'string' && (typeof n.text === 'string' || typeof n.content === 'string')) : [];
    if (!value.scenarioDraft || typeof value.scenarioDraft !== 'object' || Array.isArray(value.scenarioDraft)) value.scenarioDraft = {};
    return value;
  }
  function save(value) { try { localStorage.setItem(KEY, JSON.stringify(value)); available = true; return true; } catch { available = false; return false; } }
  root.HospitalStorage = { initial, save, get available() { return available; } };
})(window);
