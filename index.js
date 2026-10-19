/* Компаньон внутри SillyTavern: панель с компаньоном и состояние дня в промпте. */
const MOD = 'companion';
const BASE = new URL('.', import.meta.url).pathname;
const DEF = { inject: true, depth: 1, width: 62, open: false };
const ctx = () => SillyTavern.getContext();
function cfg() { const es = ctx().extensionSettings; es[MOD] = Object.assign({}, DEF, es[MOD] || {}); return es[MOD]; }
const save = () => ctx().saveSettingsDebounced();

let panel, frame;
const api = () => { try { return frame && frame.contentWindow && frame.contentWindow.companionState ? frame.contentWindow.companionState() : null; } catch (e) { return null; } };

function stateText() {
    const st = api(); if (!st || !st.text) return '';
    return '[Game state from the companion app. Treat as facts of the world; do not quote this block.]\n' + st.text;
}
function inject() {
    const c = ctx(), on = cfg().inject, t = on ? stateText() : '';
    c.setExtensionPrompt(MOD, t, 1 /* IN_CHAT */, Number(cfg().depth) || 0, false, 0 /* SYSTEM */);
    const pv = document.getElementById('cmp-preview'); if (pv) pv.textContent = t || (on ? '(день в игре не выбран)' : '(выключено)');
}

function setOpen(v) {
    cfg().open = v; save();
    panel.classList.toggle('open', v);
    document.getElementById('cmp-icon').classList.toggle('openIcon', v);
    document.getElementById('cmp-icon').classList.toggle('closedIcon', !v);
}
function setWidth(vw) { const w = Math.max(30, Math.min(95, vw)); cfg().width = w; panel.style.setProperty('--cmp-w', w + 'vw'); }

function mount() {
    panel = document.createElement('div');
    panel.id = 'cmp-panel';
    panel.innerHTML = '<div class="cmp-grip" title="Потяните, чтобы изменить ширину"></div>' +
        '<button class="cmp-x fa-solid fa-xmark" title="Закрыть"></button>' +
        '<iframe id="cmp-frame" src="' + BASE + 'companion.html"></iframe>';
    document.body.appendChild(panel);
    frame = panel.querySelector('iframe');
    setWidth(cfg().width);

    const btn = document.createElement('div');
    btn.id = 'cmp-btn'; btn.className = 'drawer';
    btn.innerHTML = '<div class="drawer-header"><div id="cmp-icon" class="drawer-icon fa-solid fa-book-open fa-fw closedIcon interactable" title="Компаньон" tabindex="0"></div></div>';
    const holder = document.getElementById('top-settings-holder');
    holder.appendChild(btn);
    btn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
    panel.querySelector('.cmp-x').addEventListener('click', () => setOpen(false));

    const grip = panel.querySelector('.cmp-grip');
    grip.addEventListener('pointerdown', e => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId); panel.classList.add('drag');
        const mv = ev => setWidth((window.innerWidth - ev.clientX) / window.innerWidth * 100);
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); panel.classList.remove('drag'); save(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    frame.addEventListener('load', () => setTimeout(inject, 300));
    window.addEventListener('companion-changed', () => inject());
    if (cfg().open) setOpen(true);
}

function settingsUi() {
    const html = '<div class="cmp-settings"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Компаньон</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>' +
        '<div class="inline-drawer-content">' +
        '<label class="checkbox_label"><input type="checkbox" id="cmp-inject"><span>Добавлять состояние дня в промпт</span></label>' +
        '<label for="cmp-depth">Глубина вставки (0 = после последнего сообщения)</label><input id="cmp-depth" class="text_pole" type="number" min="0" max="50">' +
        '<small>Что сейчас уходит модели:</small><pre id="cmp-preview" class="cmp-pre"></pre>' +
        '</div></div></div>';
    const box = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    box.insertAdjacentHTML('beforeend', html);
    const inj = document.getElementById('cmp-inject'), dep = document.getElementById('cmp-depth');
    inj.checked = cfg().inject; dep.value = cfg().depth;
    inj.addEventListener('change', () => { cfg().inject = inj.checked; save(); inject(); });
    dep.addEventListener('input', () => { cfg().depth = Math.max(0, Number(dep.value) || 0); save(); inject(); });
}

jQuery(() => {
    mount();
    settingsUi();
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.GENERATION_STARTED, inject);
    eventSource.on(event_types.CHAT_CHANGED, inject);
});
