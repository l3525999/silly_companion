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
