/* Компаньон внутри SillyTavern: панель с компаньоном, состояние дня в промпте и чтение шапки сообщений. */
const MOD = 'companion';
const BASE = new URL('.', import.meta.url).pathname;
const DEF = { inject: true, depth: 1, width: 62, open: false, autoDate: true };
const ctx = () => SillyTavern.getContext();
function cfg() { const es = ctx().extensionSettings; es[MOD] = Object.assign({}, DEF, es[MOD] || {}); return es[MOD]; }
const save = () => ctx().saveSettingsDebounced();
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let panel, frame, strip;
const cw = () => { try { return frame && frame.contentWindow && frame.contentWindow.companionState ? frame.contentWindow : null; } catch (e) { return null; } };

/* ---------- состояние дня в промпт ---------- */
function stateText() {
    const w = cw(), st = w && w.companionState(); if (!st || !st.text) return '';
    return '[Game state from the companion app. Treat as facts of the world; do not quote this block.]\n' + st.text;
}
function inject() {
    const c = ctx(), on = cfg().inject, t = on ? stateText() : '';
    c.setExtensionPrompt(MOD, t, 1 /* IN_CHAT */, Number(cfg().depth) || 0, false, 0 /* SYSTEM */);
    const pv = document.getElementById('cmp-preview'); if (pv) pv.textContent = t || (on ? '(день в игре не выбран)' : '(выключено)');
}

/* ---------- шапка сообщения ---------- */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const WDJ = { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' };
function htmlToText(html) {
    const t = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|summary|details|h\d)>/gi, '\n').replace(/<[^>]+>/g, '');
    const ta = document.createElement('textarea'); ta.innerHTML = t; return ta.value;
}
export function parseHeader(mes) {
    if (!/SUBJECT:/i.test(mes || '')) return null;
    const head = String(mes).split('<!-- GFX_START -->')[0];
    const lines = htmlToText(head).split('\n').map(x => x.trim()).filter(Boolean);
    const r = { subjects: [] };
    for (let i = 0; i < lines.length; i++) {
        const L = lines[i]; let m;
        if (!r.key && (m = L.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:\s*·\s*(.+))?/))) {
            const mo = MON[m[2].toLowerCase()]; if (mo) r.key = mo + '-' + Number(m[3]);
            r.wd = m[1].toLowerCase(); r.time = m[4] || '';
            if (lines[i + 1] && !/^SUBJECT:/i.test(lines[i + 1])) r.dayType = lines[i + 1];
            continue;
        }
        if ((m = L.match(/^SUBJECT:\s*(.+?)\s*·\s*(.+)$/i))) { r.subjects.push({ name: m[1], phase: m[2] }); continue; }
        const cur = r.subjects[r.subjects.length - 1]; if (!cur) continue;
        if ((m = L.match(/^PANTIES:\s*(.+)$/i))) cur.panties = m[1];
        if ((m = L.match(/AROUSAL\s+(\d+)\s*%/i))) cur.arousal = +m[1];
        if ((m = L.match(/COMPOSURE\s+(\d+)\s*%/i))) cur.composure = +m[1];
        if ((m = L.match(/CREAMPIES\s*[×x]\s*(\d+)/i))) cur.creampies = +m[1];
        if ((m = L.match(/CONCEPTION\s+(\S+)/i))) cur.conception = m[1];
    }
    return r.subjects.length || r.key ? r : null;
}
function lastHeader() {
    const chat = ctx().chat || [];
    for (let i = chat.length - 1, n = 0; i >= 0 && n < 30; i--, n++) {
        const m = chat[i]; if (!m || m.is_user || m.is_system) continue;
        const h = parseHeader(m.mes); if (h) return Object.assign(h, { at: i });
    }
    return null;
}

let scene = null, autoDone = '';
async function updateScene() {
    scene = lastHeader();
    const w = cw();
    if (w && scene && scene.key && cfg().autoDate) {
        const t = w.companionToday(), so = w.companionDayOrd(scene.key), to = w.companionDayOrd(t && t.key);
        const tag = scene.at + ':' + scene.key;
        if (so != null && (to == null || so > to) && autoDone !== tag) {
            autoDone = tag;
            if (await w.companionSetToday(scene.key)) toastr.info('Компаньон: «сегодня» → ' + w.companionDayLabel(scene.key));
        }
    }
    drawStrip();
}

const bar = v => '<i class="cs-bar"><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></i>';
function drawStrip() {
    if (!strip) return;
    const w = cw(), sc = scene;
    let html = '';
    if (!sc) html = '<span class="cs-muted">В последних ответах нет шапки дня</span>';
    else {
        const subs = w ? w.companionMatch(sc.subjects.map(x => x.name)) : [];
        html += '<span class="cs-date">' + (sc.wd ? '<b>' + (WDJ[sc.wd] || '') + '</b> ' : '') + esc(sc.key && w ? w.companionDayLabel(sc.key) : '') + (sc.time ? ' · ' + esc(sc.time) : '') + '</span>';
        if (sc.dayType) html += '<span class="cs-type">' + esc(sc.dayType) + '</span>';
        html += sc.subjects.map((x, i) => '<span class="cs-sub" title="' + esc([x.panties && 'Panties: ' + x.panties, x.conception && 'Conception: ' + x.conception].filter(Boolean).join(' · ')) + '">' +
            '<b>' + esc(subs[i] && subs[i].id ? subs[i].nick : x.name) + '</b> <span>' + esc(x.phase.split(' ')[0]) + '</span>' +
            (x.arousal != null ? ' <span class="cs-k">♥</span>' + bar(x.arousal) : '') + (x.composure != null ? ' <span class="cs-k">理</span>' + bar(x.composure) : '') +
            (x.creampies ? ' <span class="cs-cp">×' + x.creampies + '</span>' : '') + '</span>').join('');
        if (w && sc.key && w.companionDayOrd(sc.key) != null) {
            const t = w.companionToday();
            if (t && t.key !== sc.key) html += '<button class="cs-btn" data-act="today">Сделать ' + esc(w.companionDayLabel(sc.key)) + ' сегодня</button>';
            const ids = subs.filter(x => x.id).map(x => x.id), had = w.companionDayHer(sc.key);
            if (ids.length && !had.length) html += '<button class="cs-btn" data-act="duty">Записать дежурными: ' + esc(subs.filter(x => x.id).map(x => x.nick).join(', ')) + '</button>';
        }
    }
    strip.querySelector('.cs-body').innerHTML = html;
}

/* ---------- панель ---------- */
function setOpen(v) {
    cfg().open = v; save();
    panel.classList.toggle('open', v);
    const ic = document.getElementById('cmp-icon'); ic.classList.toggle('openIcon', v); ic.classList.toggle('closedIcon', !v);
}
function setWidth(vw) { const w = Math.max(30, Math.min(95, vw)); cfg().width = w; panel.style.setProperty('--cmp-w', w + 'vw'); }

function mount() {
    panel = document.createElement('div');
    panel.id = 'cmp-panel';
    panel.innerHTML = '<div class="cmp-grip" title="Потяните, чтобы изменить ширину"></div>' +
        '<div class="cmp-col"><div class="cmp-strip"><div class="cs-body"></div><button class="cmp-x fa-solid fa-xmark" title="Закрыть"></button></div>' +
        '<iframe id="cmp-frame" src="' + BASE + 'companion.html"></iframe></div>';
    document.body.appendChild(panel);
    frame = panel.querySelector('iframe');
    strip = panel.querySelector('.cmp-strip');
    setWidth(cfg().width);

    const btn = document.createElement('div');
    btn.id = 'cmp-btn'; btn.className = 'drawer';
    btn.innerHTML = '<div class="drawer-header"><div id="cmp-icon" class="drawer-icon fa-solid fa-book-open fa-fw closedIcon interactable" title="Компаньон" tabindex="0"></div></div>';
    document.getElementById('top-settings-holder').appendChild(btn);
    btn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    panel.querySelector('.cmp-x').addEventListener('click', () => setOpen(false));
    strip.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]'); const w = cw(); if (!b || !w || !scene) return;
        if (b.dataset.act === 'today') await w.companionSetToday(scene.key);
        if (b.dataset.act === 'duty') await w.companionSetDuty(scene.key, w.companionMatch(scene.subjects.map(x => x.name)).filter(x => x.id).map(x => x.id));
        setTimeout(() => { drawStrip(); inject(); }, 50);
    });

    const grip = panel.querySelector('.cmp-grip');
    grip.addEventListener('pointerdown', e => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); panel.classList.add('drag');
        const mv = ev => setWidth((window.innerWidth - ev.clientX) / window.innerWidth * 100);
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); panel.classList.remove('drag'); save(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    frame.addEventListener('load', () => setTimeout(() => { updateScene(); inject(); }, 400));
    let ch = 0;
    window.addEventListener('companion-changed', () => { clearTimeout(ch); ch = setTimeout(() => { inject(); drawStrip(); }, 30); });
    if (cfg().open) setOpen(true);
}

/* ---------- перенос из компаньона на claude.ai ---------- */
const b64text = t => { const u = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function putFile(name, text) {
    const r = await fetch('/api/files/upload', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ name, data: b64text(text) }) });
    if (!r.ok) throw new Error('файл ' + name + ': ' + r.status);
}
async function importBundle(file, say) {
    say('Читаю файл…');
    const j = JSON.parse(await file.text());
    if (!j || j.app !== 'companion-migration' || !j.data) throw new Error('это не файл переноса компаньона');
    const old = await fetch('/user/files/companion-db.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => '');
    if (old) {
        let has = false; try { has = Object.keys((JSON.parse(old).data || {}).heroines || {}).length > 0; } catch (e) { /* пусто */ }
        if (has && !confirm('В компаньоне в ST уже есть данные. Заменить их данными из файла? Старые сохранятся в companion-db-before-import.json.')) { say('Отменено'); return; }
        await putFile('companion-db-before-import.json', old);
    }
    const names = Object.keys(j.files || {});
    for (let i = 0; i < names.length; i++) {
        const name = names[i], ext = name.split('.').pop().toLowerCase();
        say('Картинки ' + (i + 1) + ' из ' + names.length + '…');
        const r = await fetch('/api/images/upload', { method: 'POST', headers: ctx().getRequestHeaders(), body: JSON.stringify({ image: j.files[name], format: ext, ch_name: 'companion', filename: name }) });
        if (!r.ok) throw new Error('картинка ' + name + ': ' + r.status);
    }
    say('Сохраняю данные…');
    await putFile('companion-db.json', JSON.stringify({ app: 'companion-st', version: 1, savedAt: new Date().toISOString(), data: j.data }));
    frame.src = BASE + 'companion.html?t=' + Date.now();
    const n = Object.keys(j.data.heroines || {}).length;
    say('Готово: ' + Object.keys(j.data.scenarios || {}).length + ' сценарий, ' + n + ' персонажей, ' + names.length + ' картинок.');
}

function settingsUi() {
    const html = '<div class="cmp-settings"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Компаньон</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
        '<div class="inline-drawer-content">' +
        '<label class="checkbox_label"><input type="checkbox" id="cmp-inject"><span>Добавлять состояние дня в промпт</span></label>' +
        '<label class="checkbox_label"><input type="checkbox" id="cmp-auto"><span>Сдвигать «сегодня» в журнале по дате из шапки ответа (только вперёд)</span></label>' +
        '<label for="cmp-depth">Глубина вставки (0 = после последнего сообщения)</label><input id="cmp-depth" class="text_pole" type="number" min="0" max="50">' +
        '<small>Что сейчас уходит модели:</small><pre id="cmp-preview" class="cmp-pre"></pre>' +
        '<hr><b>Перенос с claude.ai</b><small>Файл companion-migration.json: данные и картинки компаньона.</small>' +
        '<input type="file" id="cmp-import" accept=".json,application/json" hidden><div class="menu_button" id="cmp-import-btn">Загрузить файл переноса</div><small id="cmp-import-st"></small>' +
        '</div></div></div>';
    const box = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    box.insertAdjacentHTML('beforeend', html);
    const inj = document.getElementById('cmp-inject'), dep = document.getElementById('cmp-depth'), au = document.getElementById('cmp-auto');
    inj.checked = cfg().inject; dep.value = cfg().depth; au.checked = cfg().autoDate;
    inj.addEventListener('change', () => { cfg().inject = inj.checked; save(); inject(); });
    au.addEventListener('change', () => { cfg().autoDate = au.checked; save(); updateScene(); });
    dep.addEventListener('input', () => { cfg().depth = Math.max(0, Number(dep.value) || 0); save(); inject(); });
    const imp = document.getElementById('cmp-import'), st = document.getElementById('cmp-import-st');
    document.getElementById('cmp-import-btn').addEventListener('click', () => imp.click());
    imp.addEventListener('change', async () => {
        const f = imp.files[0]; imp.value = ''; if (!f) return;
        try { await importBundle(f, t => { st.textContent = t; }); } catch (e) { st.textContent = 'Не получилось: ' + e.message; }
    });
}

jQuery(() => {
    mount();
    settingsUi();
    const { eventSource, event_types: E } = ctx();
    eventSource.on(E.GENERATION_STARTED, inject);
    eventSource.on(E.CHAT_CHANGED, () => { autoDone = ''; updateScene(); inject(); });
    [E.MESSAGE_RECEIVED, E.MESSAGE_EDITED, E.MESSAGE_SWIPED, E.MESSAGE_DELETED].forEach(ev => ev && eventSource.on(ev, () => setTimeout(updateScene, 50)));
});
