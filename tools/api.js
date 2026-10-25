/* Мини-режим (адрес с #mini): дежурные дня с фигурой без фона и параметрами, для узкого окна рядом с чатом. */
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
  const T = todayInfo(s), o = T ? T.o : null, dk = T ? T.k : null;
  const list = T ? T.her.map(id => ({ h: herOf(id), live: null })).filter(x => x.h) : [];
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
  const tl = T && T.t ? (T.t.emoji ? T.t.emoji + ' ' : '') + (T.t.label || '') : '';
  const head = dk ? '<header class="mn-hd"><b>' + dk.split('-')[0] + '月' + dk.split('-')[1] + '日</b><span>' + esc(tl) + '</span><a class="mn-full" href="#" title="Полный компаньон">⤢</a></header>' : '';
  box.innerHTML = head + (list.length ? list.map(card).join('') : '<p class="mn-empty">На сегодня дежурных нет. Они появятся после лотереи или записи в журнал.</p>');
}
function setMini(on) { document.body.classList.toggle('mini', on); if (on) renderMini(); }
window.addEventListener('hashchange', () => setMini(location.hash === '#mini'));
document.addEventListener('click', e => {
  const c = e.target.closest('#mini .mn-card');
  if (c) { history.replaceState(null, '', location.pathname); setMini(false); ui.view = 'scen'; render(); openCard(c.dataset.her); }
});
{ const b = document.createElement('a'); b.id = 'mini-btn'; b.href = '#mini'; b.title = 'Мини-режим'; b.textContent = '◧'; document.body.appendChild(b); }
/* данные изменились: мини-окно обновляется вместе с основным */
for (const c of ['scenarios', 'heroines', 'caldays']) window.claude.use('db').then(db => db.collection(c).onSnapshot(() => { if (document.body.classList.contains('mini')) setTimeout(renderMini, 0); }));
setTimeout(() => setMini(location.hash === '#mini'), 0);

/* Пост Slutify, сохранённый из чата ST раньше (только просмотр в окне дня). */
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
