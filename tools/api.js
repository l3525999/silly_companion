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
/* Мини-режим: девушки текущей сцены с фигурой без фона и параметрами. scene приходит из расширения (шапка ответа). */
let miniScene = null;
function miniFig(h, maxW, maxH) {
  const o = outfitsOf(h), r = o.find(x => x && x.assetId);
  if (!r) return '<div class="mn-sil" style="height:' + maxH + 'px">' + esc((h.nick || h.name || '?').slice(0, 1)) + '</div>';
  if (!r.fig) setTimeout(() => ensureFigs(h.id, o.indexOf(r)), 0);
  const W = r.w || 1600, H = r.h || 900, all = r.fig || thirds(), f = all[0], nx = all[1];
  const fw = f.x1 - f.x0, fh = f.y1 - f.y0, ex = Math.max(fw * .2, fh * H / W * .08);
  const bx0 = Math.max(0, f.x0 - ex), bx1 = Math.min(1, nx ? (f.x1 + nx.x0) / 2 : 1, f.x1 + ex), by0 = Math.max(0, f.y0 - fh * .03);
  const k = Math.min(maxH / Math.max(1, (f.y1 - by0) * H), maxW / Math.max(1, (bx1 - bx0) * W));
  const cut = r.keepBg ? null : cutState(r.assetId); if (cut === 'wait') { cutQueue.add(r.assetId); setTimeout(runCuts, 0); }
  const src = cut && cut !== 'wait' ? cut : blobUrl(r.assetId);
  return '<div class="mn-fig' + (cut && cut !== 'wait' ? ' cut' : '') + '"' + (cut === 'wait' ? ' data-cut="' + r.assetId + '"' : '') + ' role="img" aria-label="' + esc(h.name) + '" style="width:' + Math.round((bx1 - bx0) * W * k) + 'px;height:' + Math.round((f.y1 - by0) * H * k) + 'px;background-image:url(' + src + ');background-size:' + Math.round(W * k) + 'px ' + Math.round(H * k) + 'px;background-position:' + Math.round(-bx0 * W * k) + 'px ' + Math.round(-by0 * H * k) + 'px"></div>';
}
function miniBar(label, v) { return '<div class="mn-bar"><span>' + label + '</span><i><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></i><b>' + v + '%</b></div>'; }
function renderMini() {
  let box = document.getElementById('mini'); if (!box) { box = document.createElement('div'); box.id = 'mini'; document.body.appendChild(box); }
  const s = scen(); if (!s) { box.innerHTML = '<p class="mn-empty">Сценарий не загружен</p>'; return; }
  const T = todayInfo(s), sc = miniScene, so = sc && sc.key ? calOrd(s, sc.key) : null, o = so != null ? so : T ? T.o : null, dk = so != null ? sc.key : T ? T.k : null;
  const subs = sc && sc.subjects && sc.subjects.length ? window.companionMatch(sc.subjects.map(x => x.name)).map((m, i) => ({ h: m.id ? herOf(m.id) : null, live: sc.subjects[i] })).filter(x => x.h) : [];
  const list = subs.length ? subs : (T ? T.her.map(id => ({ h: herOf(id), live: null })).filter(x => x.h) : []);
  const n = list.length, maxH = n > 1 ? 250 : 380;
  const card = ({ h, live }) => {
    const F = h.f || {}, ht = String(F.height || '').match(/\d{2,3}/), kg = String(F.weight || '').match(/\d+/);
    const p = o != null ? phaseAt(s, h, o) : null, pw = pregWeek(s, h), duty = dutyOf(s, h.id);
    const ph = isPreg(h) ? ik('preg') + ' беременна' + (pw ? ', ' + pw + ' нед.' : '') : p && PH[p.k] ? PH[p.k][0] + ' ' + PH[p.k][2] : '';
    const rows = [['Рост', ht ? ht[0] + ' см' : ''], ['Вес', kg ? kg[0] + ' кг' : ''], ['BWH', String(F.bwh || '').trim()], ['Cup', String(F.cup || '').trim()]].filter(r => r[1]);
    return '<article class="mn-card' + (p && p.k === 'ovu' && !isPreg(h) ? ' ovu' : '') + '" data-her="' + h.id + '">' +
      '<div class="mn-figbox">' + miniFig(h, 150, maxH) + '</div>' +
      '<div class="mn-info"><div class="mn-nm">' + hanko(h, true) + '<div><b>' + esc(h.nick || h.name) + '</b><small>' + esc(h.name || '') + '</small></div>' + (h.rating ? '<em class="mn-rt">' + h.rating + '</em>' : '') + '</div>' +
      (ph ? '<div class="mn-ph">' + ph + '</div>' : '') +
      '<dl>' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '<dt>Дежурств</dt><dd>' + duty + '</dd></dl>' +
      (live ? (live.arousal != null ? miniBar('♥', live.arousal) : '') + (live.composure != null ? miniBar('理', live.composure) : '') +
        '<div class="mn-live">' + [live.panties ? 'Бельё: ' + esc(live.panties) : '', live.creampies != null ? 'CP ×' + live.creampies : '', live.conception && live.conception !== '—' ? 'Зачатие: ' + esc(live.conception) : ''].filter(Boolean).map(x => '<span>' + x + '</span>').join('') + '</div>' : '') +
      '</div></article>';
  };
  const tl = so != null && sc.dayType ? sc.dayType : T && T.t ? (T.t.emoji ? T.t.emoji + ' ' : '') + (T.t.label || '') : '';
  const head = dk ? '<header class="mn-hd"><b>' + dk.split('-')[0] + '月' + dk.split('-')[1] + '日</b><span>' + esc(tl) + '</span>' + (sc && sc.time ? '<em>' + esc(sc.time) + '</em>' : '') + '</header>' : '';
  box.innerHTML = head + (list.length ? list.map(card).join('') : '<p class="mn-empty">В сцене пока никого. Девушки появятся по шапке ответа или после лотереи.</p>');
}
window.companionMini = function (on, scene) {
  document.body.classList.toggle('mini', !!on); if (scene !== undefined) miniScene = scene;
  if (on) renderMini();
};
window.companionOpenCard = function (id) { document.body.classList.remove('mini'); ui.view = 'scen'; render(); openCard(id); };
document.addEventListener('click', e => { const c = e.target.closest('#mini .mn-card'); if (c && window.parent !== window) window.parent.dispatchEvent(new CustomEvent('companion-open-her', { detail: c.dataset.her })); });

/* Пост Slutify из ответов модели, по дням (только для просмотра в окне дня). */
function storyOf(s, k) { return D.stories.find(x => x.id === calDocId(s.id, k)) || null; }
function storyHtml(s, k) {
  const st = storyOf(s, k); if (!st || !st.post) return '';
  const p = st.post;
  const post = p ? '<div class="sty-post"><div class="sty-app">🌿 Slutify' + (p.title ? ' · ' + esc(p.title) : '') + '</div>' +
    (p.author ? '<div class="sty-au">' + esc(p.author) + '</div>' : '') +
    (p.photo ? '<div class="sty-ph">' + esc(p.photo) + '</div>' : '') +
    (p.caption ? '<div class="sty-cap">«' + esc(p.caption) + '»</div>' : '') +
    ((p.comments || []).length ? '<div class="sty-cm">' + p.comments.map(c => '<div><b>@' + esc(c.who) + '</b>' + (c.role ? ' <span>' + esc(c.role) + '</span>' : '') + ': ' + esc(c.text) + '</div>').join('') + '</div>' : '') +
    (p.likes ? '<div class="sty-lk">❤️ ' + esc(p.likes) + '</div>' : '') + '</div>' : '';
  return '<div class="fld"><span class="lab">Пост дня в Slutify · из чата</span><div class="sty">' + post + '</div></div>';
}
window.companionSetStory = async function (k, part) {
  const s = scen(); if (!s || calOrd(s, k) == null || !part.post) return false;
  const id = calDocId(s.id, k), old = D.stories.find(x => x.id === id) || {};
  const doc = { scenarioId: s.id, key: k, post: part.post };
  if (JSON.stringify(doc.post) === JSON.stringify(old.post || null) && !old.gm) return true;
  doc.updatedAt = now();
  return write('stories', id, doc);
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
