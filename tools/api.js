/* Мост для расширения ST: состояние дня текстом для промпта. Вставляется в конец основного скрипта компаньона. */
window.companionState = function () {
  const s = scen(); if (!s) return null;
  const T = todayInfo(s); if (!T) return { scenario: s.name || '', text: '' };
  const hs = hersIn(s.id), nm = h => h.nick || h.name || '?';
  const ph = h => { if (isPreg(h)) { const w = pregWeek(s, h); return 'pregnant' + (w ? ' (week ' + w + ')' : ''); } const p = phaseAt(s, h, T.o); return p ? PH[p.k][0] + ' ' + PH[p.k][1] + (p.k === 'ovu' ? ' (fertile, high chance)' : '') : 'cycle unknown'; };
  const cnts = s.counters || [];
  const lines = [];
  const [m, d] = T.k.split('-').map(Number), mon = (CAL_ALL.find(x => x[3] === m) || [])[0] || '';
  lines.push('Today in game: ' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][wdOf(s, T.o)] + ', ' + d + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + '.');
  if (T.t) lines.push('Day type: ' + (T.t.emoji ? T.t.emoji + ' ' : '') + (T.t.label || '') + (T.t.rule ? '. Rule of the day: ' + T.t.rule : '') + '.');
  const duty = T.her.map(herOf).filter(Boolean);
  if (duty.length) duty.forEach(h => {
    const c = cnts.map(x => ((h.cnt || {})[x.key] || 0) ? x.label + ' ' + h.cnt[x.key] : '').filter(Boolean).join(', ');
    lines.push('Duty student: ' + nm(h) + ' — ' + ph(h) + '; duties so far: ' + dutyOf(s, h.id) + (c ? '; ' + c : '') + '.');
  });
  else lines.push('Duty student: not chosen yet.');
  const ovu = hs.filter(h => !T.her.includes(h.id) && !isPreg(h) && (phaseAt(s, h, T.o) || {}).k === 'ovu').map(nm);
  if (ovu.length) lines.push('Also ovulating today: ' + ovu.join(', ') + '.');
  const preg = hs.filter(h => !T.her.includes(h.id) && isPreg(h)).map(h => nm(h) + (pregWeek(s, h) ? ' (week ' + pregWeek(s, h) + ')' : ''));
  if (preg.length) lines.push('Pregnant: ' + preg.join(', ') + '.');
  return { scenario: s.name || '', key: T.k, duty: duty.map(nm), text: lines.join('\n') };
};
/* Связь с шапкой сообщений ST: сопоставление имён и запись дня. */
window.companionMatch = function (names) {
  const s = scen(); if (!s) return [];
  const norm = x => String(x || '').toLowerCase().replace(/[^a-z぀-ヿ一-鿿 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const hs = hersIn(s.id);
  return names.map(n => {
    const v = norm(n), toks = v.split(' ');
    const h = hs.find(x => norm(x.name) === v || toks.slice().reverse().join(' ') === norm(x.name))
      || hs.find(x => [x.nick, ...String((x.f || {}).keys || '').split(',')].map(norm).filter(Boolean).some(k => toks.includes(k)));
    return h ? { name: n, id: h.id, nick: h.nick || h.name } : { name: n, id: null };
  });
};
window.companionToday = function () { const s = scen(); return s ? { key: s.calToday || '', her: (todayInfo(s) || {}).her || [] } : null; };
window.companionDayOrd = function (k) { const s = scen(); return s && k ? calOrd(s, k) : null; };
window.companionDayLabel = function (k) { const s = scen(); return s && calOrd(s, k) != null ? shortDay(s, k) : k; };
window.companionDayHer = function (k) { const s = scen(); return s ? (calDaysOf(s.id)[k] || {}).her || [] : []; };
window.companionSetToday = async function (k) {
  const s = scen(); if (!s || calOrd(s, k) == null) return false;
  if (!(await write('scenarios', s.id, { calToday: k }, true))) return false;
  const o = calOrd(s, k); ui.calW = Object.assign({}, ui.calW, { [s.id]: o - wdOf(s, o) }); saveUi(); return true;
};
window.companionSetDuty = async function (k, ids) {
  const s = scen(); if (!s || calOrd(s, k) == null) return false;
  const x = calDaysOf(s.id)[k] || {}, o = calOrd(s, k);
  const doc = { scenarioId: s.id, key: k, her: ids.slice(), type: x.type || typeByWd(s, wdOf(s, o)), note: x.note || '', rate: x.rate || 0 }; if (x.frame) doc.frame = x.frame;
  return write('caldays', calDocId(s.id, k), doc);
};
