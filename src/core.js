/* Pure calculation and search functions. No network or browser state. */
(function (root) {
  'use strict';
  const modes = { ordinary: 'Hospitalizacja', planned: 'Hospitalizacja planowa', oneDayTreatment: 'Leczenie jednego dnia', under12h: 'Pobyt do 12 godzin', sameDay: 'Przyjęcie i wypis tego samego dnia', oneDayHosp: 'Hospitalizacja 1-dniowa', twoDayHosp: 'Hospitalizacja 2-dniowa' };
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().trim();
  function numeric(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function nonnegative(value) { const n = numeric(value); return n !== null && n >= 0 ? n : null; }
  function availableModes(group) {
    if (!group) return [];
    return Object.entries(modes).filter(([key]) => nonnegative(group[key]) !== null && !(group.catalogVariant === '1ae' && key === 'ordinary'));
  }
  function combinedFactor(rows = []) {
    let additive = 1, multiplier = 1;
    for (const row of rows) {
      const value = nonnegative(row.value);
      if (value === null || value === 0 || !['sum', 'multiply'].includes(row.operation)) return null;
      if (row.operation === 'sum') additive += value - 1; else multiplier *= value;
    }
    return additive >= 0 ? additive * multiplier : null;
  }
  function tariff(group, mode, price, rows = []) {
    if (!availableModes(group).some(([key]) => key === mode)) return null;
    const points = nonnegative(group[mode]), rate = nonnegative(price), factor = combinedFactor(rows);
    if (points === null || rate === null || factor === null) return null;
    return { points, rate, factor, base: points * rate, total: points * rate * factor };
  }
  function scenario(input) {
    const keys = ['volume', 'revenue', 'fixed', 'variable', 'days', 'dayCost', 'targetDays', 'targetVariable'];
    const v = Object.fromEntries(keys.map(key => [key, nonnegative(input[key])]));
    if (Object.values(v).some(x => x === null) || v.volume <= 0 || !Number.isInteger(v.volume)) return null;
    const currentUnit = v.variable + v.days * v.dayCost;
    const targetUnit = v.targetVariable + v.targetDays * v.dayCost;
    const current = v.volume * (v.revenue - currentUnit) - v.fixed;
    const target = v.volume * (v.revenue - targetUnit) - v.fixed;
    const contribution = v.revenue - targetUnit;
    return { ...v, currentUnit, targetUnit, current, target, impact: target - current,
      freedDays: (v.days - v.targetDays) * v.volume,
      breakEven: contribution > 0 ? Math.ceil(v.fixed / contribution) : null,
      margin: v.revenue > 0 ? target / (v.volume * v.revenue) * 100 : null };
  }
  function payroll(groups, input) {
    const previous = nonnegative(input.previousBase), current = nonnegative(input.currentBase), oncost = nonnegative(input.oncost);
    if (previous === null || current === null || oncost === null) return null;
    const rows = groups.map(g => {
      const fte = nonnegative(input.headcounts?.[g.id] ?? 0);
      if (fte === null) return null;
      const before = Math.round(previous * g.coefficient * 100) / 100;
      const after = Math.round(current * g.coefficient * 100) / 100;
      return { ...g, fte, before, after, delta: (after - before) * fte * (input.includeOncost ? 1 + oncost / 100 : 1) };
    });
    if (rows.some(x => x === null)) return null;
    const monthly = rows.reduce((sum, r) => sum + r.delta, 0);
    return { rows, monthly, annual: monthly * 12, secondHalf: monthly * 6, fte: rows.reduce((sum, r) => sum + r.fte, 0) };
  }
  function referencedBlocks(code, blocks) {
    const seen = new Set(), queue = [code], result = [];
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      const b = blocks[current];
      if (!b) continue;
      result.push([current, b]);
      (b.references || []).forEach(r => queue.push(r.code));
    }
    return result;
  }
  function createSearch(groups, blocks) {
    const direct = groups.map(g => ({ group: g, text: normalize(`${g.code} ${g.name} ${g.productCode}`) }));
    const medical = new Map();
    return function search(query, mode = 'group', section = '') {
      const q = normalize(query);
      if (mode === 'group') return direct.filter(x => (!section || x.group.section === section) && (!q || x.text.includes(q)))
        .sort((a, b) => Number(normalize(b.group.code) === q) - Number(normalize(a.group.code) === q)).map(x => ({ group: x.group, context: x.group.section }));
      if (!q) return [];
      const system = mode === 'diagnosis' ? 'ICD-10' : 'ICD-9';
      if (!medical.has(system)) medical.set(system, groups.map(group => ({ group, entries: referencedBlocks(group.code, blocks).flatMap(([, b]) => (b.segments || []).filter(s => s.type === 'list' && s.system === system).flatMap(s => s.items)).map(text => ({ text, normalized: normalize(text) })) })));
      return medical.get(system).filter(x => !section || x.group.section === section).flatMap(x => {
        const entry = x.entries.find(e => e.normalized.includes(q));
        return entry ? [{ group: x.group, context: entry.text }] : [];
      });
    };
  }
  function freshness(timestamp, now = Date.now(), hours = 36) {
    const date = Date.parse(timestamp);
    return Number.isFinite(date) && date <= now + 300000 && now - date <= hours * 3600000;
  }
  function csv(rows) {
    return '\ufeff' + rows.map(row => row.map(value => {
      let s = String(value ?? '');
      if (/^[\s]*[=+@-]/.test(s) && typeof value !== 'number') s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(';')).join('\r\n');
  }
  const api = { modes, normalize, numeric, nonnegative, availableModes, combinedFactor, tariff, scenario, payroll, referencedBlocks, createSearch, freshness, csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HospitalCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
