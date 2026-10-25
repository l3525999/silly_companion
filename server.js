#!/usr/bin/env node
/* Компаньон отдельно от SillyTavern: отдаёт страницу и хранит данные и картинки в папке.
   Запуск:  node server.js            (настройки через переменные окружения, см. README)
   Перенос: node server.js import <companion-migration.json | companion-db.json> [папка с картинками] */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = __dirname;
const DATA = path.resolve(process.env.COMPANION_DATA || path.join(ROOT, 'data'));
const IMG = path.join(DATA, 'images'), BAK = path.join(DATA, 'backups'), DB = path.join(DATA, 'db.json');
const PORT = +process.env.COMPANION_PORT || 8787;
const HOST = process.env.COMPANION_HOST || '127.0.0.1';
const PASS = process.env.COMPANION_PASSWORD || '';
const KEEP = 30; // дневных копий
const NAME = /^[A-Za-z0-9_\-.]{1,120}$/;
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

for (const d of [DATA, IMG, BAK]) fs.mkdirSync(d, { recursive: true });

function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function backup(text, tag) {
  const name = 'db-' + (tag || new Date().toISOString().slice(0, 10)) + '.json';
  writeAtomic(path.join(BAK, name), text);
  const old = fs.readdirSync(BAK).filter(f => /^db-\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
  for (const f of old.slice(0, Math.max(0, old.length - KEEP))) fs.unlinkSync(path.join(BAK, f));
}

function saveDb(data) {
  const text = JSON.stringify({ app: 'companion', version: 1, savedAt: new Date().toISOString(), data });
  writeAtomic(DB, text);
  backup(text);
}

/* ---------- перенос ---------- */
if (process.argv[2] === 'import') {
  const src = process.argv[3], imgDir = process.argv[4];
  if (!src) { console.log('node server.js import <companion-migration.json | companion-db.json> [папка с картинками]'); process.exit(1); }
  const j = JSON.parse(fs.readFileSync(src, 'utf8'));
  if (!j || typeof j.data !== 'object') { console.error('В файле нет данных компаньона (поле data).'); process.exit(1); }
  if (fs.existsSync(DB)) {
    const tag = 'before-import-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DB, path.join(BAK, 'db-' + tag + '.json'));
    console.log('Прежние данные сохранены в backups/db-' + tag + '.json');
  }
  let n = 0;
  for (const [name, b64] of Object.entries(j.files || {})) {
    if (!NAME.test(name)) continue;
    fs.writeFileSync(path.join(IMG, name), Buffer.from(b64, 'base64')); n++;
  }
  if (imgDir) for (const name of fs.readdirSync(imgDir)) {
    if (!NAME.test(name) || !TYPES[name.split('.').pop().toLowerCase()]) continue;
    fs.copyFileSync(path.join(imgDir, name), path.join(IMG, name)); n++;
  }
  saveDb(j.data);
  const cols = Object.entries(j.data).map(([c, v]) => c + ' ' + Object.keys(v || {}).length).join(', ');
  console.log('Готово: ' + cols + '; картинок ' + n + '. Папка данных: ' + DATA);
  process.exit(0);
}

if (!PASS && !/^(127\.|localhost$|::1$)/.test(HOST)) {
  console.error('Компаньон открыт в сеть (COMPANION_HOST=' + HOST + '), задайте пароль: COMPANION_PASSWORD=...');
  process.exit(1);
}

/* ---------- сервер ---------- */
function authed(req) {
  if (!PASS) return true;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const given = Buffer.from(Buffer.from(m[1], 'base64').toString().replace(/^[^:]*:/, ''));
  const want = Buffer.from(PASS);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function body(req, limit) {
  return new Promise((ok, no) => {
    const parts = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { no(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else parts.push(c); });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', no);
  });
}

function send(res, status, data, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!authed(req)) { res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Companion", charset="UTF-8"' }); return res.end(); }
    const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
    if (req.method === 'GET' && (p === '/' || p === '/index.html'))
      return send(res, 200, fs.readFileSync(path.join(ROOT, 'companion.html')), 'text/html; charset=utf-8');
    if (p === '/api/db') {
      if (req.method === 'GET') return send(res, 200, fs.existsSync(DB) ? fs.readFileSync(DB) : '{"data":{}}', 'application/json');
      if (req.method === 'PUT') {
        const j = JSON.parse((await body(req, 50e6)).toString('utf8'));
        if (!j || typeof j.data !== 'object') return send(res, 400, 'no data');
        saveDb(j.data);
        return send(res, 200, 'ok');
      }
    }
    const im = /^\/(?:api\/)?images\/([^/]+)$/.exec(p);
    if (im) {
      const name = im[1], file = path.join(IMG, name);
      if (!NAME.test(name)) return send(res, 400, 'bad name');
      if (req.method === 'GET') {
        if (!fs.existsSync(file)) return send(res, 404, 'not found');
        res.writeHead(200, { 'Content-Type': TYPES[name.split('.').pop().toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=31536000, immutable' });
        return fs.createReadStream(file).pipe(res);
      }
      if (req.method === 'PUT') { writeAtomic(file, await body(req, 40e6)); return send(res, 200, 'ok'); }
      if (req.method === 'DELETE') { if (fs.existsSync(file)) fs.unlinkSync(file); return send(res, 200, 'ok'); }
    }
    send(res, 404, 'not found');
  } catch (e) {
    console.error(e);
    send(res, e.status || 500, String(e.message || e));
  }
});

server.listen(PORT, HOST, () => console.log('Компаньон: http://' + (HOST.includes(':') ? '[' + HOST + ']' : HOST) + ':' + PORT + '/  данные: ' + DATA));
