/* ============================================================
   拾忆 · 回忆录  —  app.js
   单文件原型：书 / 卷 / 篇 / 人物 / 时间线 / 分享 / 导出
   ============================================================ */
(() => {
'use strict';

/* ==================== 0. 工具 ==================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowISO = () => new Date().toISOString();
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind === 'warn' ? ' warn' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast'; }, 2400);
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}
function countImgs(html) { return ((html || '').match(/<img/gi) || []).length; }
function firstImg(html) { const m = /<img[^>]+src="([^"]+)"/i.exec(html || ''); return m ? m[1] : null; }
function sanitize(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((a) => {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      if ((a.name === 'href' || a.name === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return d.innerHTML;
}
function download(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

/* ==================== 1. 图标 ==================== */
const ICON = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.6"/>',
  chart: '<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/>',
  trash: '<path d="M4 6h16"/><path d="M9 6V4h6v2"/><path d="M6 6l1 14h10l1-14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ''}</svg>`; }

/* ==================== 2. 数据层 ==================== */
const KEY = 'shiyi.memoir.v1';
const PRECISIONS = [['day', '日'], ['month', '月'], ['year', '年'], ['season', '季节'], ['decade', '年代'], ['unknown', '记不清']];
const SEASONS = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
const SEASON_MID = { spring: 2.5, summer: 5.5, autumn: 8.5, winter: 11.5 };
const TEMPLATES = [
  { title: '第一次远行', qs: ['那年你多大？为什么出发？', '路上最难忘的一幕是什么？', '回来之后，你看世界的方式变了吗？'] },
  { title: '一位重要的人', qs: ['你第一次见 TA 是什么场景？', 'TA 说话是什么语气？', '有没有一句话，你记到现在？'] },
  { title: '家的味道', qs: ['谁做的饭？厨房是什么样子？', '那个味道让你想起哪个季节？', '现在还能吃到吗？'] },
  { title: '一个改变你的决定', qs: ['当时你在犹豫什么？', '谁支持了你，谁又反对？', '如果重来一次，你还会这么选吗？'] },
  { title: '老照片里的那天', qs: ['照片上都有谁？', '拍完这张照片之后发生了什么？', '那天天气怎么样？'] },
];

let db = null;
let memoryFallback = null;
let quotaWarned = false;
/* 本次会话里已经算过访问的分享（只在内存里，不落库） */
const seenShares = new Set();

/* 分享范围：返回 null 表示整本书，否则返回卷 id 数组。
   兼容历史上写成 'volume' 的旧数据。 */
function shareScopeIds(s) {
  const sc = (s && s.scope) || {};
  if (sc.type === 'book') return null;
  return Array.isArray(sc.volumeIds) ? sc.volumeIds : [];
}

const IMG_PH = '图片说明（可点开编辑）';
/* 老版本新建图片时会写入「图片说明（可点开编辑）」占位文字，
   这里一次性清空，之后图注只在真写过内容时才显示 */
function stripImagePlaceholders(d) {
  let changed = false;
  /* 占位文字可能被用户接着写字，变成「撒旦图片说明（可点开编辑）」，所以按「出现在图注里」来清，保留用户自己写的部分 */
  const figRe = /(<figcaption[^>]*>)([\s\S]*?)(<\/figcaption>)/g;
  ((d && d.books) || []).forEach((b) => {
    (b.entries || []).forEach((e) => {
      if (typeof e.html !== 'string') return;
      // 去掉占位短语；如果图注因此变空（或者本来就是空图注），把整段 figcaption 删掉
      const next = e.html.replace(figRe, (m, open, body, close) => {
        const kept = body.split(IMG_PH).join('').trim();
        if (!kept) return '';
        return open + kept + close;
      });
      if (next !== e.html) { e.html = next; changed = true; }
    });
  });
  return changed;
}

function loadDB() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = memoryFallback; }
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.books) && d.books.length) return d;
    } catch (e) { /* ignore */ }
  }
  return seed();
}

function persist() {
  const raw = JSON.stringify(db);
  try {
    localStorage.setItem(KEY, raw);
    memoryFallback = raw;
    lastSavedAt = Date.now();
    scheduleBackup(raw);
    scheduleDirSave();
    hostSaveSoon(raw);
    renderStorage();
    persist._dirty = false;
    return true;
  } catch (e) {
    memoryFallback = raw;
    lastSavedAt = Date.now();
    scheduleBackup(raw);
    scheduleDirSave();
    hostSaveSoon(raw);
    renderStorage();
    /* 程序版：内容已经交给硬盘上的数据文件，浏览器缓存写满了也不影响 */
    if (HOST_ON) return true;
    if (!quotaWarned) {
      quotaWarned = true;
      toast('无法写入本机存储；当前内容只暂存在页面内，刷新后可能丢失。请先导出备份或释放空间。', 'warn');
    }
    return false;
  }
}
/* ==================== 桌面程序（exe）里的原生存盘 ====================
   打包成 拾忆.exe 之后，页面跑在 WebView2 里，可以走宿主的通道直接写文件，
   不需要用户点“连接文件夹”：程序自己在项目目录建 数据\ 并写 回忆录数据.json。 */
const hostApi = (function () {
  try {
    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects) {
      return window.chrome.webview.hostObjects;
    }
  } catch (e) { /* 普通浏览器 */ }
  return null;
})();
const HOST_ON = !!hostApi;

function hostSaveSoon(raw) {
  if (!HOST_ON) return;
  clearTimeout(hostSaveSoon._t);
  hostSaveSoon._t = setTimeout(function () {
    try {
      const p = hostApi.shiyi.Save(raw);
      if (p && p.catch) p.catch(function () {});
      if (typeof p === 'string' && p.indexOf('err:') === 0) {
        if (!hostSaveSoon._warned) {
          hostSaveSoon._warned = true;
          toast('写数据文件失败：' + p.slice(4), 'warn');
        }
      }
    } catch (e) { /* 宿主不在就算了，localStorage 那份还在 */ }
  }, 400);
}

function hostLoad(done) {
  if (!HOST_ON) { done(null); return; }
  let settled = false;
  const finish = function (v) { if (!settled) { settled = true; done(v); } };
  setTimeout(function () { finish(null); }, 2500);
  try {
    hostApi.shiyi.Load().then(function (txt) { finish(txt || null); }, function () { finish(null); });
  } catch (e) { finish(null); }
}

/* 数据文件放哪（设置页显示用） */
const HOST_FILE_LABEL = '数据\\回忆录数据.json';

let persistTimer = null;
function schedulePersist() {
  setSaveState('pending');
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { persistTimer = null; setSaveState(persist() ? 'saved' : 'failed'); }, 500);
}

/* ---------- 自动备份：主库在 localStorage，另存一份到 IndexedDB ---------- */
/* 目的：万一 localStorage 被浏览器清掉，下次打开还能从备份捞回来，不必天天手动导出 */
const BAK_NAME = 'shiyi.memoir.bak';
let bakTimer = null;
let bakLast = '';
let lastSavedAt = 0;

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
    const rq = indexedDB.open(BAK_NAME, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains('kv')) rq.result.createObjectStore('kv');
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error || new Error('idb open failed'));
  });
}

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise((resolve, reject) => { setTimeout(() => reject(new Error('timeout')), ms); }),
  ]);
}

async function backupPut(raw) {
  try {
    const d = await withTimeout(idbOpen(), 1500);
    await withTimeout(new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ at: Date.now(), raw }, 'last');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }), 4000);
    d.close();
    return true;
  } catch (e) {
    return false;
  }
}

async function backupGet() {
  try {
    const d = await withTimeout(idbOpen(), 1500);
    const v = await withTimeout(new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get('last');
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    }), 3000);
    d.close();
    return v;
  } catch (e) {
    return null;
  }
}

function scheduleBackup(raw) {
  if (raw === bakLast) return;
  clearTimeout(bakTimer);
  bakTimer = setTimeout(() => {
    bakTimer = null;
    bakLast = raw;
    backupPut(raw);
  }, 1200);
}

/* ==================== 数据文件夹（真正的落盘） ====================
   浏览器里的 localStorage / IndexedDB 只当“临时工作区”，
   用户选一个文件夹后，每次改动异步写回文件夹里的 回忆录数据.json，
   下次打开优先读文件夹里的那份。
   能力来源：File System Access API（file:// 下可用，需要一次用户手势授权）。 */
const DATA_FILE = '回忆录数据.json';
let dirHandle = null;
let dirReady = false;        // 有句柄且已授权可写
let dirState = 'none';       // none | stored | ready | unsupported
let dirDirty = false;
let dirTimer = null;
let dirLastJson = '';

function dirSupported() { return typeof window.showDirectoryPicker === 'function'; }

function handleDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
    const rq = indexedDB.open('shiyi.memoir.handles', 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains('kv')) rq.result.createObjectStore('kv');
    };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

async function handlePut(h) {
  try {
    const d = await handleDB();
    await new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(h, 'dir');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    d.close();
    return true;
  } catch (e) { return false; }
}

async function handleGet() {
  try {
    const d = await handleDB();
    const v = await new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readonly');
      const rq = tx.objectStore('kv').get('dir');
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => reject(rq.error);
    });
    d.close();
    return v;
  } catch (e) { return null; }
}

async function handleDel() {
  try {
    const d = await handleDB();
    await new Promise((resolve, reject) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete('dir');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    d.close();
    return true;
  } catch (e) { return false; }
}

async function dirRead() {
  if (!dirHandle) return null;
  try {
    const fh = await dirHandle.getFileHandle(DATA_FILE);
    const f = await fh.getFile();
    return await f.text();
  } catch (e) { return null; }
}

async function dirWrite(text) {
  if (!dirHandle) return false;
  const fh = await dirHandle.getFileHandle(DATA_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
  return true;
}

/* ---------- 照片存成文件：`<数据文件夹>/图片/xxx.jpg`，正文里只留相对路径 ---------- */
const IMG_DIR = '图片';

function dataUrlToBlob(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: m[1] });
}

function imgRelPrefix() {
  return (dirHandle ? dirHandle.name : '数据') + '/' + IMG_DIR + '/';
}

function isLocalImgSrc(src) {
  return !!src && !/^data:/i.test(src) && !/^https?:/i.test(src) && !/^blob:/i.test(src);
}

async function imgDirHandle(create) {
  if (!dirHandle) throw new Error('no-handle');
  return dirHandle.getDirectoryHandle(IMG_DIR, { create: !!create });
}

/* 把一张 dataURL 照片写进图片文件夹，返回相对路径（如 `数据/图片/e1-ab12.jpg`） */
async function saveImageToFolder(dataUrl, entryId) {
  const dir = await imgDirHandle(true);
  const m = /^data:image\/([a-z0-9]+);base64,/i.exec(dataUrl || '');
  let ext = (m && m[1] ? m[1] : 'jpeg').toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  const name = (entryId || 'pic') + '-' + Date.now().toString(36) + '.' + ext;
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(dataUrlToBlob(dataUrl));
  await w.close();
  return imgRelPrefix() + name;
}

/* 读回文件内容，用于导出时把路径还原成内嵌图片 */
async function readFolderImage(relSrc) {
  try {
    const prefix = imgRelPrefix();
    if (relSrc.indexOf(prefix) !== 0) return null;
    const name = relSrc.slice(prefix.length);
    const dir = await imgDirHandle(false);
    const fh = await dir.getFileHandle(name);
    const f = await fh.getFile();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    });
  } catch (e) { return null; }
}

/* ---------- 语音：`<数据>/语音/xxx.m4a`，正文里只留相对路径 ---------- */
const AUDIO_DIR = '语音';

function audioRelPrefix() {
  return (dirHandle ? dirHandle.name : '数据') + '/' + AUDIO_DIR + '/';
}

/* 程序版（WebView2）：直接让宿主把附件写到硬盘 */
function hostSaveFile(relPath, base64) {
  if (!HOST_ON) return false;
  try {
    const r = hostApi.shiyi.SaveFile(relPath, base64);
    if (r && typeof r.then === 'function') { r.catch(function () {}); return true; }
    return String(r).indexOf('ok') === 0;
  } catch (e) { return false; }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(new Error('读取失败'));
    r.readAsDataURL(blob);
  });
}

function audioExt(file) {
  const n = (file.name || '').toLowerCase();
  const m = /\.([a-z0-9]+)$/.exec(n);
  if (m && /^(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac|weba)$/.test(m[1])) return m[1] === 'weba' ? 'webm' : m[1];
  const t = (file.type || '').split('/')[1];
  if (t && /^(mpeg|mp4|x-m4a|m4a|wav|x-wav|ogg|webm|flac|aac)$/.test(t)) {
    return ({ mpeg: 'mp3', mp4: 'm4a', 'x-m4a': 'm4a', 'x-wav': 'wav', weba: 'webm' })[t] || t;
  }
  return 'm4a';
}

function fmtDur(sec) {
  if (!isFinite(sec) || sec < 0) return '';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/* 读时长，用于图注（失败就返回 0） */
function probeDuration(blob) {
  return new Promise((resolve) => {
    let url;
    try { url = URL.createObjectURL(blob); } catch (e) { resolve(0); return; }
    const a = new Audio();
    const done = (v) => { try { URL.revokeObjectURL(url); } catch (e) {} resolve(v || 0); };
    const t = setTimeout(() => done(0), 4000);
    a.onloadedmetadata = () => { clearTimeout(t); done(a.duration); };
    a.onerror = () => { clearTimeout(t); done(0); };
    a.preload = 'metadata';
    a.src = url;
  });
}

/* 存一段语音，返回正文里该写的 src */
async function saveAudio(blob, entryId, ext) {
  const name = (entryId || 'voice') + '-' + Date.now().toString(36) + '.' + ext;
  const rel = AUDIO_DIR + '/' + name;

  if (HOST_ON) {
    const b64 = await blobToBase64(blob);
    if (hostSaveFile('数据/' + rel, b64)) return { src: '数据/' + rel, where: '数据\\' + AUDIO_DIR.replace('/', '\\') };
  }

  if (dirReady && dirHandle) {
    try {
      const dir = await dirHandle.getDirectoryHandle(AUDIO_DIR, { create: true });
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return { src: audioRelPrefix() + name, where: dirHandle.name + '\\' + AUDIO_DIR };
    } catch (e) { /* 落到内嵌 */ }
  }

  /* 既没有宿主也没有文件夹：只能内嵌成 base64 */
  const b64 = await blobToBase64(blob);
  return { src: 'data:' + (blob.type || 'audio/mpeg') + ';base64,' + b64, where: '数据文件里（内嵌）' };
}

/* 把已经存成 base64 的照片批量搬进文件夹，正文里换成相对路径 */
async function migrateImagesToFolder() {
  if (!dirReady || !dirHandle) { toast('先连上数据文件夹再搬', 'warn'); return; }
  if (!confirm('把正文里已存的照片搬到「' + dirHandle.name + '\\' + IMG_DIR + '」，正文改成引用文件？\n搬完浏览器里那份会变小，原图仍然在文件夹里。')) return;
  let moved = 0, failed = 0;
  for (const e of liveEntries()) {
    if (!e.html || e.html.indexOf('data:image/') < 0) continue;
    let html = e.html;
    const srcs = Array.from(new Set((html.match(/src="data:image\/[^"]+"/g) || []).map((s) => s.slice(5, -1))));
    for (const dataUrl of srcs) {
      try {
        const rel = await saveImageToFolder(dataUrl, e.id);
        html = html.split(dataUrl).join(rel);
        moved += 1;
      } catch (err) { failed += 1; }
    }
    if (html !== e.html) e.html = html;
  }
  persist();
  render();
  if (moved) toast('已把 ' + moved + ' 张照片移进文件夹' + (failed ? '，' + failed + ' 张失败' : ''), failed ? 'warn' : 'ok');
  else toast('没有需要搬的照片，或者全部失败', 'warn');
}
function hasLocalImg(html) {
  return /<img\b[^>]*\bsrc="(?!data:|https?:|blob:)/i.test(html || '');
}
/* 导出前把正文里指向文件夹的图片就地换成 dataURL，导出的文件才能单独打开 */
async function inlineFolderImages(html) {
  if (!dirReady || !dirHandle) return html;
  const out = document.createElement('div');
  out.innerHTML = html || '';
  const imgs = Array.from(out.querySelectorAll('img'));
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (!isLocalImgSrc(src)) continue;
    const data = await readFolderImage(src);
    if (data) img.setAttribute('src', data);
  }
  return out.innerHTML;
}

let backupOnce = false;
async function dirFlush() {
  if (!dirReady || !dirHandle || !dirDirty) return;
  const json = JSON.stringify(db, null, 2);
  dirDirty = false;
  try {
    // 第一次要覆盖已有文件时，先把旧内容另存一份，防止整本被顶掉
    if (!backupOnce) {
      backupOnce = true;
      const old = await dirRead();
      if (old && old.trim() && old.trim() !== json.trim()) {
        const d = new Date();
        const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
          '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
        try {
          const fh = await dirHandle.getFileHandle('回忆录数据-覆盖前' + stamp + '.json', { create: true });
          const w = await fh.createWritable();
          await w.write(old);
          await w.close();
        } catch (e) { /* 备份失败也继续写主文件 */ }
      }
    }
    await dirWrite(json);
    dirLastJson = json;
    const tag = $('#e-saved');
    if (tag) {
      tag.textContent = '已存到文件夹';
      tag.classList.remove('pending', 'failed');
    }
  } catch (e) {
    dirReady = false;
    dirState = 'stored';
    showFolderBar('写文件夹失败（' + (e && e.name ? e.name : e) + '），点这里重新授权', 'folder-restore', '重新授权');
    toast('写文件夹失败，内容还在浏览器里，记得重连文件夹', 'warn');
  }
}

function scheduleDirSave() {
  if (!dirReady || !dirHandle) return;
  dirDirty = true;
  clearTimeout(dirTimer);
  dirTimer = setTimeout(() => { dirTimer = null; dirFlush(); }, 1200);
}

function showFolderBar(text, act, label) {
  const bar = $('#folder-bar');
  if (!bar) return;
  $('#folder-bar-text').textContent = text || '上次的数据文件夹还没授权';
  const btn = bar.querySelector('[data-act]');
  if (btn) {
    if (act) btn.dataset.act = act;
    if (label) btn.textContent = label;
  }
  bar.hidden = false;
}

function hideFolderBar() {
  const bar = $('#folder-bar');
  if (bar) bar.hidden = true;
}

function applyLoadedDB(d, why) {
  db = d;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* 配额问题先不管 */ }
  applyTheme();
  parseRoute();
  render();
  if (why) toast(why);
}

async function connectFolder() {
  if (!dirSupported()) {
    toast('这个浏览器不支持直接写文件夹，请用「导出备份」');
    return;
  }
  let h;
  try {
    h = await window.showDirectoryPicker({ id: 'shiyi-memoir', mode: 'readwrite' });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast('没连上文件夹：' + (e && e.message ? e.message : e), 'warn');
    return;
  }
  dirHandle = h;
  dirReady = true;
  dirState = 'ready';
  hideFolderBar();
  render();
  handlePut(h).catch(() => {});
  const raw = await dirRead();
  let picked = 'local';
  if (raw) {
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (d && Array.isArray(d.books) && d.books.length) {
      const n = (d.books[0].entries || []).filter((x) => !x.deletedAt).length;
      picked = confirm('这个文件夹里已经有数据（' + n + ' 篇）。\n\n点「确定」= 用文件夹里的内容，覆盖当前页面；\n点「取消」= 用当前内容覆盖文件夹。')
        ? 'folder' : 'local';
      if (picked === 'folder') {
        dirReady = true;
        dirState = 'ready';
        hideFolderBar();
        applyLoadedDB(d, '已读取文件夹里的内容');
        render();
        return;
      }
    }
  }
  dirReady = true;
  dirState = 'ready';
  dirDirty = true;
  hideFolderBar();
  await dirFlush();
  render();
  toast('已连到文件夹「' + h.name + '」，之后自动存这里');
}

async function restoreFolderAccess() {
  if (!dirHandle) {
    const h = await handleGet();
    if (!h) { toast('没有记住的文件夹，请先「选择文件夹」'); return; }
    dirHandle = h;
  }
  try {
    const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { toast('没拿到授权，内容仍只存在浏览器里'); return; }
  } catch (e) {
    toast('授权失败：' + (e && e.message ? e.message : e), 'warn');
    return;
  }
  dirReady = true;
  dirState = 'ready';
  hideFolderBar();
  const raw = await dirRead();
  if (raw) {
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (d && Array.isArray(d.books) && d.books.length) {
      applyLoadedDB(d, '已从文件夹读取最新内容');
      return;
    }
  }
  scheduleDirSave();
  render();
  toast('文件夹已连上');
}

async function forgetFolder() {
  if (!confirm('断开文件夹？之后内容只保存在浏览器里。')) return;
  dirHandle = null;
  dirReady = false;
  dirState = dirSupported() ? 'none' : 'unsupported';
  await handleDel();
  hideFolderBar();
  render();
  toast('已断开，内容仍在本机浏览器里');
}

async function initFolder() {
  if (!dirSupported()) { dirState = 'unsupported'; return; }
  const h = await withTimeout(handleGet(), 700).catch(() => null);
  if (!h) {
    let off = false;
    try { off = localStorage.getItem('shiyi.memoir.barOff') === '1'; } catch (e) {}
    if (!off) {
      showFolderBar('浏览器里存一份，也往项目里的「数据」文件夹存一份 —— 点一下授权，之后全自动', 'folder-connect', '连接文件夹');
    }
    return;
  }
  dirHandle = h;
  let perm = 'prompt';
  try {
    perm = await h.queryPermission({ mode: 'readwrite' });
  } catch (e) {
    perm = 'prompt';
  }
  if (perm === 'granted') {
    dirReady = true;
    dirState = 'ready';
    const raw = await dirRead();
    if (raw) {
      let d = null;
      try { d = JSON.parse(raw); } catch (e) { d = null; }
      if (d && Array.isArray(d.books) && d.books.length) {
        if (JSON.stringify(d) !== JSON.stringify(db)) {
          db = d;
          try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
          applyTheme();
          parseRoute();
          render();
          toast('已读取文件夹「' + h.name + '」里的内容');
        }
        return;
      }
    }
    scheduleDirSave();
  } else {
    dirState = 'stored';
    showFolderBar('「' + h.name + '」还没授权，点一下继续用它', 'folder-restore', '点一下继续用');
  }
}

function seed() {
  const b = {
    id: 'b1',
    title: '我的一生',
    subtitle: '写给还没出生的人',
    author: '',
    intro: '',
    volumes: [
      { id: 'v1', title: '童年' },
      { id: 'v2', title: '求学' },
      { id: 'v3', title: '工作' },
      { id: 'v4', title: '家庭' },
      { id: 'v5', title: '此刻' },
    ],
    people: [
      { id: 'p1', name: '母亲', relation: '妈妈', note: '说话很轻，手很粗。' },
      { id: 'p2', name: '父亲', relation: '爸爸', note: '一辈子没说过软话。' },
      { id: 'p3', name: '阿姐', relation: '姐姐', note: '' },
      { id: 'p4', name: '老周', relation: '师傅', note: '车间里第一个教我摇手柄的人。' },
      { id: 'p5', name: '秀兰', relation: '妻子', note: '来借书的那天，穿蓝布衫。' },
    ],
    entries: [
      {
        id: 'e1', volumeId: 'v1', title: '发大水那年',
        html: '<p>那年夏天，雨下了整整四十天。</p><p>家门口的水漫过第三级台阶时，母亲把家里的相册全部装进一个铁皮饼干盒，用塑料布裹了三层，塞到房梁上。她踩着小板凳，我扶着凳腿，听见她在上面说：「人在，相片就在。」</p><p>后来水退了，墙根留了一道黄印子，齐到我胸口。那道印子在家里待了很多年，像一条不肯褪掉的线。</p>',
        time: { precision: 'season', date: '1998-07-01', season: 'summer', note: '农历六月，雨一直没停' },
        place: '老家 · 沿河镇', people: ['p1', 'p3'], tags: ['水灾', '老屋'], milestone: false,
        createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-03T09:12:00.000Z', deletedAt: null,
      },
      {
        id: 'e2', volumeId: 'v2', title: '第一次坐火车',
        html: '<p>录取通知书来的第三天，父亲送我去省城。他背着一个蛇皮袋，我拎着一只帆布包，袋子里有母亲煮的十个鸡蛋，还用盐水浸过，说这样不容易坏。</p><p>绿皮车开了十四个小时。父亲一路没怎么说话，快到站的时候才说一句：「到了那边，别舍不得吃。」</p><p>站台上人挤人，他把袋子递给我，转身就走了，没回头。</p>',
        time: { precision: 'month', date: '1999-09-01', season: 'autumn', note: '' },
        place: '省城 · 火车站', people: ['p2'], tags: ['第一次', '离别'], milestone: true,
        createdAt: '2026-09-02T10:00:00.000Z', updatedAt: '2026-09-05T08:00:00.000Z', deletedAt: null,
      },
      {
        id: 'e3', volumeId: 'v3', title: '第一个月的工资',
        html: '<p>三百二十七块。装在牛皮纸信封里，捏在手上有点厚度。</p><p>我先去邮局给家里汇了两百，剩下的一百二，请老周在巷口的小馆子吃了一顿。他喝到第三杯，拍着桌子说：「以后别学我，一辈子就会摇手柄。」</p><p>那顿饭的钱，是我这辈子花得最痛快的一笔。</p>',
        time: { precision: 'year', date: '2003-06-01', season: 'summer', note: '' },
        place: '县城 · 老巷口', people: ['p4'], tags: ['工作', '第一笔钱'], milestone: false,
        createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-06T12:30:00.000Z', deletedAt: null,
      },
      {
        id: 'e4', volumeId: 'v4', title: '她来借书的那天',
        html: '<p>秀兰来我们家借《平凡的世界》，下册。她说上册早就看完了，一直没找着下册。</p><p>我翻箱倒柜找出来，书角卷了，她接过去的时候用手指一点点抚平。</p><p>那天下午的光很斜，落在她手背上。</p>',
        time: { precision: 'day', date: '2006-04-15', season: 'spring', note: '' },
        place: '老家 · 供销社后面', people: ['p5'], tags: ['相遇'], milestone: true,
        createdAt: '2026-09-07T10:00:00.000Z', updatedAt: '2026-09-08T16:00:00.000Z', deletedAt: null,
      },
    ],
    comments: [
      { id: 'c1', entryId: 'e4', author: '阿姐', text: '那天我就在窗外站着，你们俩谁都没看见我。', at: '2026-09-11T12:00:00.000Z' },
    ],
    shares: [
      { id: 'sh1', token: 'demo7f3a', title: '给家人的两段', scope: { type: 'volumes', volumeIds: ['v1', 'v4'] }, password: '', createdAt: '2026-09-10T09:00:00.000Z', expiresAt: null, revoked: false, views: 0 },
    ],
  };
  return { version: 1, theme: 'paper', activeBookId: 'b1', books: [b] };
}

function book() { return db.books.find((b) => b.id === db.activeBookId) || db.books[0]; }
function liveEntries() { return book().entries.filter((e) => !e.deletedAt); }
function deletedEntries() { return book().entries.filter((e) => e.deletedAt); }
function entryById(id) { return book().entries.find((e) => e.id === id); }
function personById(id) { return book().people.find((p) => p.id === id); }
function personName(id) { const p = personById(id); return p ? p.name : ''; }
function volumeName(id) { const v = book().volumes.find((x) => x.id === id); return v ? v.title : '未分卷'; }
function entriesOfVolume(vid) { return liveEntries().filter((e) => e.volumeId === vid); }

/* ==================== 3. 时间 ==================== */
function timeRank(t) {
  if (!t || !t.date) return 8.6e12;
  const d = new Date(t.date + 'T00:00:00');
  if (isNaN(d)) return 8.6e12;
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  switch (t.precision) {
    case 'day': return y * 10000 + m * 100 + day;
    case 'month': return y * 10000 + m * 100 + 15;
    case 'season': return y * 10000 + (SEASON_MID[t.season] || 6) * 100;
    case 'decade': return y * 10000 + 700;
    case 'year': return y * 10000 + 700;
    default: return 8.6e12;
  }
}
function yearOf(t) {
  if (!t || !t.date) return null;
  const d = new Date(t.date + 'T00:00:00');
  return isNaN(d) ? null : d.getFullYear();
}
function timeLabel(t) {
  if (!t || !t.date) return t && t.note ? t.note : '未定时';
  const d = new Date(t.date + 'T00:00:00');
  if (isNaN(d)) return '未定时';
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  let base = '';
  switch (t.precision) {
    case 'day': base = `${y} 年 ${m} 月 ${day} 日`; break;
    case 'month': base = `${y} 年 ${m} 月`; break;
    case 'season': base = `${y} 年 ${SEASONS[t.season] || ''}`; break;
    case 'decade': base = `${Math.floor(y / 10) * 10} 年代`; break;
    case 'year': base = `${y} 年`; break;
    default: base = t.note || '记不清了';
  }
  if (t.note && t.precision !== 'unknown') base += ` · ${t.note}`;
  return base;
}
function sortEntries(list) {
  return list.slice().sort((a, b) => (timeRank(a.time) - timeRank(b.time)) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

/* ==================== 4. 路由与状态 ==================== */
const state = {
  route: 'home', entryId: null, personId: null, shareToken: null,
  search: '', collapsed: new Set(), sidebar: false,
};
const ROUTES = ['home', 'write', 'read', 'readall', 'timeline', 'book', 'people', 'person', 'places', 'place', 'stats', 'share', 'trash', 'settings', 's'];

function parseRoute() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) { state.route = 'home'; return; }
  const [head, arg] = parts;
  state.route = ROUTES.includes(head) ? head : 'home';
  if (state.route === 'write' || state.route === 'read') state.entryId = arg || null;
  else if (state.route !== 's') state.entryId = null;
  if (state.route === 'person') state.personId = arg || null;
  if (state.route === 'place') state.placeName = arg ? decodeURIComponent(arg) : null;
  if (state.route === 'book') state.timelineMode = 'book';
  if (state.route === 'timeline') state.timelineMode = 'line';
  if (state.route === 's') {
    const next = arg || null;
    if (state.shareToken !== next) state.shareUnlocked = false;
    state.shareToken = next;
  }
}

function go(hash) {
  if (location.hash === hash) { parseRoute(); render(); return; }
  location.hash = hash;
}

/* ==================== 5. 渲染骨架 ==================== */
const NAV = [
  ['home', '首页', 'home'],
  ['timeline', '时间线', 'clock'],
  ['people', '人物', 'user'],
  ['places', '地点', 'pin'],
  ['stats', '统计', 'chart'],
  ['share', '分享', 'share'],
  ['trash', '回收站', 'trash'],
  ['settings', '设置', 'gear'],
];

function renderShell() {
  const b = book();
  $('#topbar-title').textContent = b.title;
  document.title = `${b.title} · 拾忆`;

  $('#nav').innerHTML = NAV.map(([r, label, ic]) => {
    const active = state.route === r || (r === 'people' && state.route === 'person') || (r === 'places' && state.route === 'place');
    const n = r === 'trash' ? deletedEntries().length : '';
    return `<button class="nav-item ${active ? 'active' : ''}" data-nav="${r}">
      ${icon(ic)}<span>${label}</span>${n ? `<span class="nav-count">${n}</span>` : ''}
    </button>`;
  }).join('');

  $('#vol-total').textContent = `${liveEntries().length} 篇`;

  $('#volumes').innerHTML = b.volumes.map((v) => {
    const es = entriesOfVolume(v.id);
    const collapsed = state.collapsed.has(v.id);
    return `<div class="vol-group ${collapsed ? 'collapsed' : ''}" data-vol="${v.id}">
      <div class="vol-row">
        <button data-voltoggle="${v.id}">
          <span class="vol-caret">▾</span>
          <span class="vol-name">${esc(v.title)}</span>
          <span class="vol-n">${es.length || ''}</span>
        </button>
        <button class="vol-add" data-voladd="${v.id}" title="在这一卷里写一篇">＋</button>
      </div>
      <div class="vol-entries">
        ${es.length ? es.map((e) => `<button class="vol-entry ${state.entryId === e.id ? 'active' : ''}" data-entry="${e.id}">${esc(e.title || '无题')}</button>`).join('') : '<div class="vol-empty">还没有故事</div>'}
      </div>
    </div>`;
  }).join('');

  renderStorage();
}

function renderStorage() {
  /* 按 UTF-8 字节算（中文一个字占 3 字节），字符数会低估；配额是按字节给的 */
  const json = JSON.stringify(db);
  const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : json.length * 2;
  const txt = $('#storage-text');
  if (!txt) return;
  const kb = bytes / 1024;
  const sizeText = kb < 1024 ? `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  const bar = $('#storage-bar');
  const box = $('.storage');

  /* 程序版：真正的家在硬盘上，localStorage 只是缓存，不该拿 5 MB 配额吓人 */
  if (HOST_ON) {
    const lbl = box && box.querySelector('.storage-top span');
    if (lbl) lbl.textContent = '数据文件';
    txt.textContent = sizeText;
    if (box) {
      box.classList.remove('warn');
      box.title = '内容存放在 ' + HOST_FILE_LABEL + '（硬盘上），这里显示它的体积；硬盘有多大就能存多大。';
    }
    return;
  }

  const limit = 5 * 1024 * 1024;
  const pct = clamp((bytes / limit) * 100, 0, 100);
  txt.textContent = sizeText + ` · ${pct.toFixed(1)}%`;
  if (bar) bar.style.width = pct.toFixed(1) + '%';
  if (box) box.classList.toggle('warn', pct > 80);
}

/* ==================== 6. 视图渲染 ==================== */
function render() {
  document.body.classList.toggle('reading', state.route === 's');
  document.body.classList.toggle('bookmode', state.route === 'readall');
  renderShell();
  const view = $('#view');
  const y = view.scrollTop;
  view.innerHTML = renderView();
  if (state.route !== 'write') view.scrollTop = 0;
  const pageKey = state.route + '|' + (state.entryId || '');
  if (pageKey !== render._page) {
    render._page = pageKey;
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
  }
  bindView();
  if (state.route === 'write') requestAnimationFrame(() => { view.scrollTop = y; });
  if (state.route === 'readall') {
    requestAnimationFrame(() => {
      layoutBook(true);
      $$('#bk-flow img').forEach((img) => {
        if (!img.complete) img.addEventListener('load', () => layoutBook(false));
      });
      if (window.ResizeObserver) {
        if (bkRO) bkRO.disconnect();
        const st = $('#bk-stage');
        if (st) {
          bkRO = new ResizeObserver(() => {
            if (state.route !== 'readall') return;
            layoutBook(false);
          });
          bkRO.observe(st);
        }
      }
    });
  }
}

function renderView() {
  switch (state.route) {
    case 'home': return viewHome();
    case 'write': return state.entryId && entryById(state.entryId) ? viewEditor() : viewBook(false);
    case 'read': return viewReader();
    case 'readall': return viewReadAll();
    case 'timeline': return viewTimeline();
    case 'book': return viewBook(true);
    case 'people': return viewPeople();
    case 'person': return viewPerson();
    case 'places': return viewPlaces();
    case 'place': return viewPlace();
    case 'stats': return viewStats();
    case 'share': return viewShare();
    case 's': return viewSharePage();
    case 'trash': return viewTrash();
    case 'settings': return viewSettings();
    default: return viewHome();
  }
}
function viewReader() {
  const e = entryById(state.entryId);
  if (!e || e.deletedAt) return '<div class="empty"><p>找不到这段回忆。</p><button class="btn" data-nav="timeline">返回时间线</button></div>';
  const meta = timeLabel(e.time) + (e.place ? ' · ' + e.place : '');
  return '<article class="reader">' +
    '<div class="view-actions"><button class="btn btn-ghost btn-sm" data-nav="timeline">← 返回</button><button class="btn btn-sm" data-act="edit-entry">编辑这篇</button></div>' +
    '<h1 class="reader-title">' + esc(e.title || '无题') + '</h1>' +
    '<p class="reader-meta">' + esc(meta) + '</p>' +
    '<div class="prose">' + sanitize(e.html || '') + '</div>' +
    '</article>';
}


/* ---------- 从头读起：整本书分页阅读 ---------- */
const bookPage = { i: 0, total: 1 };
let bkRO = null;

function viewReadAll() {
  const b = book();
  const es = sortEntries(liveEntries());
  if (!es.length) {
    return '<div class="empty"><p>还没有可以读的故事。</p><button class="btn" data-nav="home">回首页</button></div>';
  }
  const arts = es.map((e) => {
    const meta = timeLabel(e.time) + (e.place ? ' · ' + e.place : '');
    return `<article class="bk-entry">
      <h2 class="bk-h">${esc(e.title || '无题')}</h2>
      <p class="bk-meta">${esc(meta)}</p>
      <div class="prose">${sanitize(e.html || '')}</div>
    </article>`;
  }).join('');
  return `
  <div class="bk">
    <div class="bk-bar">
      <button class="btn btn-ghost btn-sm" data-nav="home">← 退出</button>
      <span class="bk-name">${esc(b.title)}</span>
      <span class="bk-pos" id="bk-pos">第 1 / 1 页</span>
    </div>
    <div class="bk-stage" id="bk-stage">
      <div class="bk-flow" id="bk-flow">
        <section class="bk-cover"><div class="bk-cover-inner">
          <p class="bk-kicker">从头读起</p>
          <h1>${esc(b.title)}</h1>
          <p class="bk-sub">${esc(b.subtitle || '')}</p>
          <p class="bk-total">共 ${es.length} 篇</p>
        </div></section>
        ${arts}
      </div>
    </div>
    <div class="bk-foot">
      <button class="btn btn-sm" id="bk-prev" data-bkprev>← 上一页</button>
      <span class="bk-hint">← → 翻页，Esc 退出</span>
      <button class="btn btn-primary btn-sm" id="bk-next" data-bknext>下一页 →</button>
    </div>
  </div>`;
}

/* 用 CSS 多栏把整本书切成一屏一页，再横向平移 */
function layoutBook(reset) {
  const stage = $('#bk-stage');
  const flow = $('#bk-flow');
  if (!stage || !flow) return;
  const G = 64;
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const W = Math.max(240, stage.clientWidth - padX);
  const H = Math.max(200, stage.clientHeight - padY);
  flow.style.width = W + 'px';
  flow.style.height = H + 'px';
  flow.style.columnWidth = W + 'px';
  flow.style.columnGap = G + 'px';
  flow.style.setProperty('--bh', H + 'px');
  flow.style.transform = 'translateX(0px)';
  const total = Math.max(1, Math.ceil((flow.scrollWidth + G) / (W + G) - 0.01));
  bookPage.total = total;
  if (reset) bookPage.i = 0;
  bookPage.i = clamp(bookPage.i, 0, total - 1);
  flow.style.transform = `translateX(${-bookPage.i * (W + G)}px)`;
  const pos = $('#bk-pos');
  if (pos) pos.textContent = `第 ${bookPage.i + 1} / ${total} 页`;
  const prev = $('#bk-prev');
  const next = $('#bk-next');
  if (prev) prev.style.visibility = bookPage.i <= 0 ? 'hidden' : 'visible';
  if (next) next.style.visibility = bookPage.i >= total - 1 ? 'hidden' : 'visible';
}

function turnBook(delta) {
  if (state.route !== 'readall') return;
  const to = clamp(bookPage.i + delta, 0, bookPage.total - 1);
  if (to === bookPage.i) return;
  bookPage.i = to;
  layoutBook(false);
}
function viewHome() {
  const b = book();
  const es = liveEntries();
  const words = es.reduce((s, e) => s + stripHtml(e.html).length, 0);
  const photos = es.reduce((s, e) => s + countImgs(e.html), 0);
  const years = es.map((e) => yearOf(e.time)).filter(Boolean);
  const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0;
  const recent = es.slice().sort((a, c) => String(c.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 4);
  const first = sortEntries(es)[0];

  const h = new Date().getHours();
  const greet = h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '午后好' : '晚上好';

  return `
  <section class="hero">
    <canvas class="hero-dust"></canvas>
    <div class="hero-lamp"></div>
    <div class="hero-stage">
      <div class="hero-cover">
        <div class="cover-label"><b>${esc(b.title)}</b><span class="cover-sub">回忆录</span></div>
        <span class="cover-seal">忆</span>
      </div>
    </div>
    <div class="hero-body">
      <div class="hero-kicker">${greet}，今天想起了什么？</div>
      <h1>${esc(b.title)}</h1>
      <p class="hero-sub">${esc(b.subtitle || '一个人，一本书，慢慢写。')}</p>
      <div class="hero-stats">
        <div class="hstat"><b>${es.length}</b><span>篇故事</span></div>
        <div class="hstat"><b>${words.toLocaleString()}</b><span>字</span></div>
        <div class="hstat"><b>${photos}</b><span>张照片</span></div>
        <div class="hstat"><b>${span || '—'}</b><span>年跨度</span></div>
      </div>
      <div class="hero-actions">
        <button class="btn btn-primary" data-act="continue">继续写</button>
        ${es.length ? '<button class="btn" data-nav="readall">从头读起</button>' : ''}
        <button class="btn" data-act="share">本机分享预览</button>
        <a class="btn" href="星图时间线.html" data-star-link>回忆时间线</a>
      </div>
    </div>
  </section>

  <div class="section-title">最近落笔</div>
  ${recent.length ? `<div class="card recent-list">${recent.map((e) => `
      <button class="recent-item" data-entry="${e.id}">
        <span class="recent-year">${yearOf(e.time) || '—'}</span>
        <span class="recent-main"><b>${esc(e.title || '无题')}</b><span>${esc(timeLabel(e.time))}${e.place ? ' · ' + esc(e.place) : ''}</span></span>
        <span class="recent-date">${fmtTime(e.updatedAt)}</span>
        <span class="recent-go">→</span>
      </button>`).join('')}</div>` : '<div class="empty"><p>还没有故事。从下面挑一个问题开始吧。</p></div>'}

  <div class="section-title">不知道写什么？试试这些</div>
  <div class="tpl-grid">
    ${TEMPLATES.map((t, i) => `<button class="tpl" data-tpl="${i}"><i>${'壹贰叁肆伍陆柒捌玖拾'[i] || i + 1}</i><b>${esc(t.title)}</b><span>${esc(t.qs[0])}</span><em>从这里开始写 →</em></button>`).join('')}
  </div>`;
}

/* ---------- 编辑器 ---------- */
function viewEditor() {
  const e = entryById(state.entryId);
  const t = e.time || { precision: 'unknown', date: '', season: 'spring', note: '' };
  const people = e.people || [];
  const tags = e.tags || [];
  return `
  <article class="editor">
    <div class="e-head">
      <input class="e-title" id="e-title" placeholder="给这段回忆起个名字" value="${esc(e.title)}" autocomplete="off">
      <span class="e-saved" id="e-saved">已保存</span>
    </div>

    <div class="e-meta">
      <div class="m-item wide">
        <span>时间</span>
        <select class="m-input small" id="e-precision">
          ${PRECISIONS.map(([v, l]) => `<option value="${v}" ${t.precision === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input class="m-input" type="date" id="e-date" value="${esc(t.date || '')}" style="max-width:160px${t.precision === 'unknown' ? ';display:none' : ''}">
        <select class="m-input small" id="e-season" style="${t.precision === 'season' ? '' : 'display:none'}">
          ${Object.entries(SEASONS).map(([v, l]) => `<option value="${v}" ${t.season === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input class="m-input" id="e-tnote" placeholder="记不清？保留原话，比如「发大水那年」" value="${esc(t.note || '')}">
      </div>
      <div class="m-item">
        <span>地点</span>
        <input class="m-input" id="e-place" placeholder="哪里发生的事" value="${esc(e.place || '')}">
      </div>
      <div class="m-item">
        <span>分卷</span>
        <select class="m-input" id="e-volume">
          ${book().volumes.map((v) => `<option value="${v.id}" ${e.volumeId === v.id ? 'selected' : ''}>${esc(v.title)}</option>`).join('')}
        </select>
      </div>
      <div class="m-item wide">
        <span>人物</span>
        <div class="chip-row" id="e-people">
          ${people.map((id) => `<span class="chip">${esc(personName(id) || '已删除')}<button data-unperson="${id}">×</button></span>`).join('')}
          <button class="chip-add" id="e-addperson">＋ 加一个人</button>
        </div>
      </div>
      <div class="m-item wide">
        <span>标签</span>
        <div class="chip-row" id="e-tags">
          ${tags.map((x) => `<span class="chip plain">${esc(x)}<button data-untag="${esc(x)}">×</button></span>`).join('')}
          <input class="m-input" id="e-taginput" placeholder="回车添加" style="flex:0 0 110px">
        </div>
      </div>
      <div class="m-item wide">
        <label class="m-check"><input type="checkbox" id="e-milestone" ${e.milestone ? 'checked' : ''}> 标记为人生里程碑（会在时间轴上突出显示）</label>
      </div>
    </div>

    <div class="e-toolbar">
      <button data-cmd="bold" title="加粗"><b>B</b></button>
      <button data-cmd="italic" title="斜体"><i>I</i></button>
      <button data-cmd="formatBlock" data-val="h2">小标题</button>
      <button data-cmd="formatBlock" data-val="blockquote">引用</button>
      <span class="sep"></span>
      <button data-cmd="insertHorizontalRule">分隔线</button>
      <button id="e-img">插图</button>
      <button id="e-audio">语音</button>
      <button data-cmd="removeFormat">清除格式</button>
    </div>

    <div class="prose" id="e-body" contenteditable="true" spellcheck="false">${sanitize(e.html || '')}</div>

    <div class="e-foot">
      <span id="e-words">0 字</span>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" data-act="read-entry">阅读预览</button>
      <button class="btn btn-ghost btn-sm" id="e-export">导出本篇</button>
      <button class="btn btn-ghost btn-sm danger" id="e-delete">删除</button>
    </div>
  </article>`;
}

/* ---------- 时间线 ---------- */
function viewTimeline() {
  const es = sortEntries(liveEntries());
  const groups = [];
  for (const e of es) {
    const y = yearOf(e.time);
    const label = y || '未定时';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return `
  <div class="view-head">
    <div>
      <h1 class="view-title">时间线</h1>
      <p class="view-sub">${es.length} 段回忆，${groups.filter((g) => typeof g.label === 'number').length} 个年份</p>
    </div>
    <div class="view-actions">
      <div class="seg">
        <button class="on" data-tlmode="line">时间线</button>
        <button data-tlmode="book">目录</button>
      </div>
      <button class="btn btn-sm" data-act="new">＋ 写一篇</button>
    </div>
  </div>
  ${es.length ? `<div class="tl">${groups.map((g) => `
    <div class="tl-group ${typeof g.label === 'number' ? '' : 'tl-undated'}">
      <div class="tl-year">${g.label}${typeof g.label === 'number' ? `<small>${g.items.length} 篇</small>` : ''}</div>
      <div class="tl-items">${g.items.map((e) => timelineCard(e)).join('')}</div>
    </div>`).join('')}</div>`
    : `<div class="empty"><p>时间轴上还没有东西。</p><button class="btn btn-primary" data-act="new">写第一段回忆</button></div>`}`;
}

function timelineCard(e) {
  const img = firstImg(e.html);
  const ex = stripHtml(e.html).slice(0, 100);
  const pp = (e.people || []).map(personName).filter(Boolean);
  return `<button class="tl-card ${e.milestone ? 'milestone' : ''}" data-entry="${e.id}">
    <div class="tl-card-body">
      <div class="tl-card-date">${esc(timeLabel(e.time))}</div>
      <h3 class="tl-card-title">${esc(e.title || '无题')}</h3>
      ${ex ? `<p class="tl-card-ex">${esc(ex)}</p>` : ''}
      <div class="tl-card-meta">
        ${e.place ? `<span>◈ ${esc(e.place)}</span>` : ''}
        ${pp.length ? `<span>❏ ${esc(pp.join('、'))}</span>` : ''}
        ${(e.tags || []).length ? `<span>#${esc(e.tags.join(' #'))}</span>` : ''}
      </div>
    </div>
    ${img ? `<img class="tl-thumb" src="${img}" alt="">` : ''}
  </button>`;
}

/* ---------- 目录 / 书本视图 ---------- */
function viewBook(showToggle) {
  const b = book();
  return `
  <div class="view-head">
    <div>
      <h1 class="view-title">目录</h1>
      <p class="view-sub">像翻一本书那样读</p>
    </div>
    <div class="view-actions">
      ${showToggle ? `<div class="seg"><button data-tlmode="line">时间线</button><button class="on" data-tlmode="book">目录</button></div>` : ''}
      <button class="btn btn-sm" data-act="new">＋ 写一篇</button>
    </div>
  </div>
  <div class="book">
    <div class="book-cover">
      <h1>${esc(b.title)}</h1>
      <p>${esc(b.subtitle || '')}</p>
      <div class="rule"></div>
      <p style="margin-top:18px;font-size:11px;letter-spacing:.2em">${esc(b.author || '佚名')} · 共 ${liveEntries().length} 篇</p>
    </div>
    ${b.volumes.map((v) => {
      const es = sortEntries(entriesOfVolume(v.id));
      return `<section class="vol-section">
        <h3>${esc(v.title)}<small>${es.length} 篇</small></h3>
        ${es.length ? es.map((e) => `<button class="toc-item" data-entry="${e.id}">
          <span class="t">${e.milestone ? '★ ' : ''}${esc(e.title || '无题')}</span>
          <span class="dots"></span>
          <span class="d">${esc(timeLabel(e.time))}</span>
        </button>`).join('') : '<p class="muted" style="font-size:12px;padding-left:8px">这一卷还空着</p>'}
      </section>`;
    }).join('')}
  </div>`;
}

/* ---------- 人物 ---------- */
function viewPeople() {
  const ps = book().people;
  return `
  <div class="view-head">
    <div><h1 class="view-title">人物</h1><p class="view-sub">写故事时 @ 到他们，这里会聚在一起</p></div>
    <div class="view-actions"><button class="btn btn-sm" data-act="newperson">＋ 新建人物</button></div>
  </div>
  ${ps.length ? `<div class="people-grid">${ps.map((p) => {
    const cnt = liveEntries().filter((e) => (e.people || []).includes(p.id)).length;
    return `<button class="person-card" data-person="${p.id}">
      <span class="avatar">${esc(p.name.slice(0, 1))}</span>
      <span><b>${esc(p.name)}</b><span>${esc(p.relation || '')}</span></span>
      <span class="cnt">${cnt} 篇</span>
    </button>`;
  }).join('')}</div>` : `<div class="empty"><p>还没有人物卡片。</p><button class="btn btn-primary" data-act="newperson">建第一张人物卡片</button></div>`}`;
}

function viewPerson() {
  const p = personById(state.personId);
  if (!p) return `<div class="empty"><p>找不到这个人。</p></div>`;
  const es = sortEntries(liveEntries().filter((e) => (e.people || []).includes(p.id)));
  const photos = es.flatMap((e) => {
    const out = [];
    const re = /<img[^>]+src="([^"]+)"/gi;
    let m;
    while ((m = re.exec(e.html || ''))) out.push({ src: m[1], id: e.id });
    return out;
  }).slice(0, 8);
  return `
  <button class="btn btn-ghost btn-sm" data-nav="people" style="margin-bottom:16px">← 所有人物</button>
  <div class="person-hero">
    <span class="avatar">${esc(p.name.slice(0, 1))}</span>
    <div style="flex:1">
      <h2>${esc(p.name)}</h2>
      <p>${esc(p.relation || '')}${p.note ? ' · ' + esc(p.note) : ''}</p>
    </div>
    <button class="btn btn-sm" data-editperson="${p.id}">编辑</button>
  </div>
  ${photos.length ? `<div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">${photos.map((x) => `<img src="${x.src}" data-entry="${x.id}" style="width:88px;height:88px;object-fit:cover;border-radius:8px;cursor:pointer">`).join('')}</div>` : ''}
  <div class="section-title">与 TA 有关的 ${es.length} 段回忆</div>
  ${es.length ? `<div class="tl" style="padding-left:0">${es.map((e) => timelineCard(e)).join('')}</div>` : `<div class="empty"><p>还没有写到 TA。</p></div>`}`;
}

/* ---------- 地点 ---------- */
function viewPlaces() {
  const es = liveEntries().filter((e) => e.place);
  const map = new Map();
  es.forEach((e) => {
    const key = e.place.trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  });
  const items = Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  return `
  <div class="view-head">
    <div><h1 class="view-title">地点</h1><p class="view-sub">${items.length} 个地方，${es.length} 段故事</p></div>
  </div>
  ${items.length ? `<div class="card" style="padding:8px"><div class="place-list">${items.map(([name, list]) => {
    const ys = list.map((e) => yearOf(e.time)).filter(Boolean);
    return `<button class="place-item" data-place="${esc(name)}">
      <span class="avatar" style="width:30px;height:30px;font-size:13px">${esc(name.slice(0, 1))}</span>
      <span class="place-name">${esc(name)}</span>
      <span class="place-years">${ys.length ? (Math.min(...ys) === Math.max(...ys) ? Math.min(...ys) : Math.min(...ys) + '–' + Math.max(...ys)) : '未定时'}</span>
      <span class="place-cnt">${list.length} 篇</span>
    </button>`;
  }).join('')}</div></div>` : `<div class="empty"><p>还没有记录地点。写故事时填一下「地点」，这里会自动聚合。</p></div>`}
  <p class="hint" style="margin-top:14px">地图视图需要地图服务，当前版本先做聚合列表。</p>`;
}

/* ---------- 单个地点 ---------- */
function viewPlace() {
  const name = (state.placeName || '').trim();
  const es = sortEntries(liveEntries().filter((e) => (e.place || '').trim() === name));
  const ys = es.map((e) => yearOf(e.time)).filter(Boolean);
  const span = ys.length ? (Math.min(...ys) === Math.max(...ys) ? String(Math.min(...ys)) : Math.min(...ys) + '–' + Math.max(...ys)) : '';
  return `
  <div class="view-actions"><button class="btn btn-ghost btn-sm" data-nav="places">← 所有地点</button></div>
  <div class="view-head">
    <div>
      <h1 class="view-title">${esc(name || '未命名地点')}</h1>
      <p class="view-sub">${es.length} 段故事${span ? ' · ' + span : ''}</p>
    </div>
  </div>
  ${es.length ? `<div class="tl" style="padding-left:0">${es.map((e) => timelineCard(e)).join('')}</div>` : '<div class="empty"><p>这里还没有故事。</p></div>'}`;
}

/* ---------- 统计 ---------- */
function viewStats() {
  const es = liveEntries();
  const words = es.reduce((s, e) => s + stripHtml(e.html).length, 0);
  const photos = es.reduce((s, e) => s + countImgs(e.html), 0);
  const places = new Set(es.map((e) => e.place).filter(Boolean));
  const years = es.map((e) => yearOf(e.time)).filter(Boolean);
  const minY = years.length ? Math.min(...years) : 0;
  const maxY = years.length ? Math.max(...years) : 0;
  const counts = {};
  years.forEach((y) => { counts[y] = (counts[y] || 0) + 1; });
  const span = maxY - minY + 1;
  const bars = [];
  for (let y = minY; y <= maxY; y++) bars.push([y, counts[y] || 0]);
  const maxC = Math.max(1, ...bars.map((b) => b[1]));
  const blank = bars.filter((b) => b[1] === 0).map((b) => b[0]);
  const tagCount = {};
  es.forEach((e) => (e.tags || []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return `
  <div class="view-head"><div><h1 class="view-title">统计</h1><p class="view-sub">看看这本书记下了多少</p></div></div>
  <div class="stats-grid">
    <div class="stat-card"><b>${es.length}</b><span>篇故事</span></div>
    <div class="stat-card"><b>${words.toLocaleString()}</b><span>字</span></div>
    <div class="stat-card"><b>${photos}</b><span>张照片</span></div>
    <div class="stat-card"><b>${places.size}</b><span>个地方</span></div>
    <div class="stat-card"><b>${book().people.length}</b><span>个人物</span></div>
    <div class="stat-card"><b>${span || '—'}</b><span>年跨度</span></div>
  </div>

  <div class="section-title">时间轴覆盖度</div>
  ${bars.length ? `<div class="card" style="padding:16px 18px">
    <div class="chart">${bars.map(([y, c]) => `<div class="bar ${c ? 'has' : 'empty'}" style="height:${Math.max(2, (c / maxC) * 100)}%" title="${y} 年：${c} 篇"></div>`).join('')}</div>
    <div class="chart-x"><span>${minY}</span><span>${maxY}</span></div>
    <div class="legend">
      <span>共 ${bars.filter((b) => b[1]).length} 年有记录</span>
      ${blank.length ? `<span>空白年份：${blank.slice(0, 12).join('、')}${blank.length > 12 ? '…' : ''}</span>` : '<span>时间轴上没有断档，了不起。</span>'}
    </div>
  </div>` : '<div class="empty">记录第一篇之后，这里会长出一张时间轴。</div>'}

  ${topTags.length ? `<div class="section-title">常写的标签</div>
  <div class="chip-row">${topTags.map(([t, c]) => `<span class="chip plain">${esc(t)} <b style="opacity:.55">${c}</b></span>`).join('')}</div>` : ''}`;
}

/* ---------- 分享 ---------- */
function shareUrl(s) { return location.href.split('#')[0] + '#/s/' + s.token; }

function viewShare() {
  const list = book().shares.slice().reverse();
  return `
  <div class="view-head">
    <div><h1 class="view-title">分享</h1><p class="view-sub">本机只读预览；当前不支持跨设备访问</p></div>
    <div class="view-actions"><button class="btn btn-primary btn-sm" data-act="newshare">创建本机预览</button></div>
  </div>
  ${list.length ? list.map((s) => {
    const expired = s.expiresAt && Date.now() > s.expiresAt;
    const stateTxt = s.revoked ? '已撤回' : expired ? '已过期' : (s.password ? '需口令' : '可访问');
    const ids = shareScopeIds(s);
    const scope = ids === null ? '整本书' : ids.map(volumeName).join('、');
    return `<div class="share-card">
      <div class="share-top">
        <b>${esc(scope || '整本书')}</b>
        <span class="badge ${s.revoked || expired ? 'off' : ''}">${stateTxt}</span>
        <span class="muted" style="font-size:11.5px">${s.views || 0} 次访问 · ${fmtTime(s.createdAt)}</span>
      </div>
      <div class="share-url">${esc(shareUrl(s))}</div>
      <div class="share-actions">
        <button class="btn btn-sm" data-preview="${s.token}">预览</button>
        <button class="btn btn-sm" data-copyshare="${s.token}">复制本机预览链接</button>
        ${s.revoked ? '' : `<button class="btn btn-sm danger" data-revoke="${s.id}">撤回</button>`}
        <button class="btn btn-sm danger" data-delshare="${s.id}">删除</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty"><p>还没有分享。选几卷，做成一本只读的小册子发给家人。</p><button class="btn btn-primary" data-act="newshare">创建第一个分享</button></div>`}`;
}

function viewSharePage() {
  const s = book().shares.find((x) => x.token === state.shareToken);
  if (!s) return `<div class="empty"><p>这个分享链接不存在，可能已被删除。</p><button class="btn" data-nav="share">返回</button></div>`;
  if (s.revoked) return `<div class="empty"><p>分享已被作者撤回。</p></div>`;
  if (s.expiresAt && Date.now() > s.expiresAt) return `<div class="empty"><p>这个分享链接已过期。</p></div>`;
  if (s.password && !state.shareUnlocked) {
    return `<div class="share-page"><div class="sp-cover">
      <div class="sp-mark">这是一本需要口令的小册子</div>
      <h1>${esc(book().title)}</h1>
      <p>请输入作者告诉你的口令</p>
      <div style="margin-top:26px;display:flex;gap:8px;justify-content:center">
        <input class="input" id="sp-pass" type="password" placeholder="口令" style="max-width:200px">
        <button class="btn btn-primary" id="sp-unlock">打开</button>
      </div>
    </div></div>`;
  }
  if (!seenShares.has(s.token)) { seenShares.add(s.token); s.views = (s.views || 0) + 1; persist(); }
  const owned = book().shares.some((x) => x.token === s.token);
  const ids = shareScopeIds(s);
  const es = sortEntries(liveEntries().filter((e) => ids === null || ids.includes(e.volumeId)));
  return `
  <div class="share-page">
    ${owned ? `<button class="reader-back" data-nav="share">← 退出预览</button>` : ""}
    <div class="sp-cover">
      <div class="sp-mark">献给读到这里的你</div>
      <h1>${esc(book().title)}</h1>
      <p>${esc(book().subtitle || '')}</p>
    </div>
    ${es.map((e) => `
      <article class="sp-entry">
        <h2>${esc(e.title || '无题')}</h2>
        <div class="sp-date">${esc(timeLabel(e.time))}${e.place ? ' · ' + esc(e.place) : ''}</div>
        <div class="prose">${sanitize(e.html)}</div>
        <div class="sp-comments">
          <h4>留言</h4>
          ${book().comments.filter((c) => c.entryId === e.id).map((c) => `<div class="comment"><span class="c-av">${esc(c.author.slice(0, 1))}</span><div><b>${esc(c.author)}</b>${esc(c.text)}<span class="c-time">${fmtTime(c.at)}</span></div></div>`).join('')}
          <div class="c-form">
            <input class="input" data-comment-input="${e.id}" placeholder="写一句寄语…" style="padding:6px 10px">
            <button class="btn btn-sm" data-comment-send="${e.id}">寄出</button>
          </div>
        </div>
      </article>`).join('')}
    <p class="hint" style="text-align:center;margin-top:30px">本机只读预览 · 内容保存在当前浏览器，不是加密文件或外发链接</p>
  </div>`;
}

/* ---------- 回收站 ---------- */
function viewTrash() {
  const ds = deletedEntries();
  return `
  <div class="view-head"><div><h1 class="view-title">回收站</h1><p class="view-sub">删掉的故事还能捡回来</p></div></div>
  ${ds.length ? `<div class="card">${ds.map((e) => `
    <div class="trash-row">
      <div><b>${esc(e.title || '无题')}</b><div class="meta">${esc(timeLabel(e.time))} · 删除于 ${fmtTime(e.deletedAt)}</div></div>
      <div class="acts">
        <button class="btn btn-sm" data-restore="${e.id}">恢复</button>
        <button class="btn btn-sm danger" data-purge="${e.id}">彻底删除</button>
      </div>
    </div>`).join('')}</div>` : `<div class="empty"><p>回收站是空的。</p></div>`}`;
}

/* ---------- 设置 ---------- */
function viewSettings() {
  const b = book();
  return `
  <div class="view-head"><div><h1 class="view-title">设置</h1><p class="view-sub">纸色、书名、备份</p></div></div>
  <div class="card" style="padding:6px 18px">
    <div class="setting-row">
      <div class="lbl">纸色<small>怀旧的、干净的、或者夜里写</small></div>
      <div class="ctl">
        <button class="swatch sw-paper ${db.theme === 'paper' ? 'on' : ''}" data-theme-btn="paper" title="旧纸"></button>
        <button class="swatch sw-sepia ${db.theme === 'sepia' ? 'on' : ''}" data-theme-btn="sepia" title="更黄一点"></button>
        <button class="swatch sw-dark ${db.theme === 'dark' ? 'on' : ''}" data-theme-btn="dark" title="夜写"></button>
      </div>
    </div>
    <div class="setting-row">
      <div class="lbl">书名与副标题</div>
      <div class="ctl">
        <button class="btn btn-sm" data-act="editbook">修改</button>
      </div>
    </div>
    <div class="setting-row">
      <div class="lbl">分卷管理<small>新建、改名或删除空卷</small></div>
      <div class="ctl"><button class="btn btn-sm" data-act="manage-volumes">管理分卷</button></div>
    </div>
    <div class="setting-row">
      <div class="lbl">数据文件夹<small>${dirRowHint()}</small></div>
      <div class="ctl">${dirRowCtl()}</div>
    </div>
    <div class="setting-row">
      <div class="lbl">自动保存<small>改一个字就存一次，不用手动保存</small></div>
      <div class="ctl"><span class="badge ok" id="autosave-note">${savedAgoText()}</span></div>
    </div>
    <div class="setting-row">
      <div class="lbl">备份<small>导出一个 JSON 文件，换设备也能带走</small></div>
      <div class="ctl">
        <button class="btn btn-sm" data-act="backup">导出备份</button>
        <button class="btn btn-sm" data-act="restore">导入备份</button>
      </div>
    </div>
    <div class="setting-row">
      <div class="lbl">打印成册<small>用浏览器打印，另存为 PDF</small></div>
      <div class="ctl"><button class="btn btn-sm" data-act="print">打印 / PDF</button></div>
    </div>
    <div class="setting-row">
      <div class="lbl">清空所有数据<small>不可恢复，请先备份</small></div>
      <div class="ctl"><button class="btn btn-sm danger" data-act="wipe">清空</button></div>
    </div>
  </div>
  <p class="hint" style="margin-top:18px">${HOST_ON
    ? '程序版：每次改动都会自动写进 <b>数据\\回忆录数据.json</b>（覆盖前会留一份 回忆录数据-上一版.json）；下次打开自动读取。换电脑时把整个文件夹拷走即可。'
    : '内容每次改动都会自动存在这台设备的浏览器里（localStorage），并另存一份到 IndexedDB 以防被清掉；下次打开自动读取。换设备或彻底清理浏览器数据后仍需用「导出备份」的文件恢复。'}</p>`;
}

function dirRowHint() {
  if (HOST_ON) return '程序自己维护：' + HOST_FILE_LABEL + '，改一下就自动写进去';
  if (dirState === 'unsupported') return '这个浏览器不支持直接写文件夹';
  if (dirReady && dirHandle) return '已连到「' + dirHandle.name + '」，照片会存成图片文件，改动自动写进去';
  if (dirState === 'stored' && dirHandle) return '「' + dirHandle.name + '」等待授权';
  return '选一个文件夹，内容直接存成文件，不再只放浏览器里';
}

function dirRowCtl() {
  if (HOST_ON) {
    return '<span class="badge ok">自动保存中</span>';
  }
  if (dirState === 'unsupported') {
    return '<button class="btn btn-sm" data-act="backup">导出备份</button>';
  }
  if (dirReady && dirHandle) {
    return '<span class="badge ok">已连接</span> <button class="btn btn-sm" data-act="img-migrate">把照片移进文件夹</button> <button class="btn btn-sm" data-act="folder-forget">断开</button>';
  }
  if (dirState === 'stored' && dirHandle) {
    return '<button class="btn btn-sm btn-primary" data-act="folder-restore">授权继续用</button>';
  }
  return '<button class="btn btn-sm btn-primary" data-act="folder-connect">选择文件夹</button>';
}

function savedAgoText() {
  if (!lastSavedAt) return '已就绪';
  const s = Math.round((Date.now() - lastSavedAt) / 1000);
  if (s < 60) return '刚刚保存';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} 分钟前保存`;
  const d = new Date(lastSavedAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 保存`;
}

/* ==================== 7. 交互绑定 ==================== */
function bindView() {
  const v = $('#view');
  v.onclick = (ev) => {
    const t = ev.target.closest('[data-entry],[data-nav],[data-act],[data-person],[data-tpl],[data-voladd],[data-tlmode],[data-place],[data-unperson],[data-untag],[data-preview],[data-copyshare],[data-revoke],[data-delshare],[data-restore],[data-purge],[data-theme-btn],[data-editperson],[data-comment-send],[data-cmd],[data-precision],[data-bkprev],[data-bknext]');
    if (!t) return;
    const d = t.dataset;

    if (d.entry) { go('#/read/' + d.entry); return; }
    if (t.hasAttribute('data-bkprev')) { turnBook(-1); return; }
    if (t.hasAttribute('data-bknext')) { turnBook(1); return; }
    if (d.nav) { go('#/' + d.nav); return; }
    if (d.person) { go('#/person/' + d.person); return; }
    if (d.voladd) { newEntry(d.voladd); return; }
    if (d.tlmode) { go(d.tlmode === 'book' ? '#/book' : '#/timeline'); return; }
    if (d.themeBtn) { setTheme(d.themeBtn); return; }
    if (d.restore) { const e = entryById(d.restore); if (e) { e.deletedAt = null; persist(); render(); toast('已恢复'); } return; }
    if (d.purge) { if (confirm('彻底删除后无法恢复，确定吗？')) { book().entries = book().entries.filter((e) => e.id !== d.purge); persist(); render(); } return; }
    if (d.revoke) { const s = book().shares.find((x) => x.id === d.revoke); if (s && confirm('撤回后这个链接就失效了，确定？')) { s.revoked = true; persist(); render(); } return; }
    if (d.delshare) { const s = book().shares.find((x) => x.id === d.delshare); if (s && confirm('删除这条分享记录？')) { book().shares = book().shares.filter((x) => x.id !== d.delshare); persist(); render(); } return; }
    if (d.preview) { go('#/s/' + d.preview); return; }
    if (d.copyshare) { copyText(shareUrl({ token: d.copyshare })); return; }
    if (d.tpl) { startFromTemplate(Number(d.tpl)); return; }
    if (d.place) { go('#/place/' + encodeURIComponent(d.place)); return; }
    if (d.editperson) { openPersonModal(d.editperson); return; }

    if (d.act) { handleAct(d.act, t); return; }
  };

  if (state.route === 'write' && state.entryId && $('#e-body')) bindEditor();
  if (state.route === 's' && document.querySelector('.share-page')) bindSharePage();
  if (state.route === 'person') { /* noop */ }
}

function handleAct(act, el) {
  switch (act) {
    case 'new': newEntry(); break;
    case 'read-entry': go('#/read/' + state.entryId); break;
    case 'edit-entry': go('#/write/' + state.entryId); break;
    case 'manage-volumes': openVolumeManager(); break;
    case 'continue': {
      const list = liveEntries().slice().sort((a, c) => String(c.updatedAt).localeCompare(String(a.updatedAt)));
      if (list.length) go('#/write/' + list[0].id); else newEntry();
      break;
    }
    case 'share': go('#/share'); break;
    case 'newperson': openPersonModal(); break;
    case 'editperson': openPersonModal(el.dataset.editperson); break;
    case 'newshare': openShareModal(); break;
    case 'editbook': openBookModal(); break;
    case 'backup': backupJSON(); break;
    case 'folder-connect': connectFolder(); break;
    case 'img-migrate': migrateImagesToFolder(); break;
    case 'folder-restore': restoreFolderAccess(); break;
    case 'folder-forget': forgetFolder(); break;
    case 'restore': $('#file-import').click(); break;
    case 'print': printBook(); break;
    case 'wipe': if (confirm('将删除这台设备上的全部回忆录数据，且无法恢复。确定吗？')) { db = seed(); persist(); go('#/'); } break;
  }
}

/* ---------- 主题 ---------- */
function setTheme(t) {
  db.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  persist();
  if (state.route === 'settings') render();
}

/* ---------- 新建 / 编辑 ---------- */
function newEntry(volumeId, preset) {
  const b = book();
  const e = {
    id: uid('e'),
    volumeId: volumeId || (b.volumes[b.volumes.length - 1] || {}).id || '',
    title: preset && preset.title ? preset.title : '',
    html: preset && preset.html ? preset.html : '',
    time: { precision: 'unknown', date: '', season: 'spring', note: '' },
    place: '', people: [], tags: [], milestone: false,
    createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null,
  };
  b.entries.push(e);
  persist();
  go('#/write/' + e.id);
}

/* 从一个写作提示开始：标题已填，正文先放好引导问题，边写边删 */
function startFromTemplate(i) {
  const t = TEMPLATES[i];
  if (!t) { newEntry(); return; }
  const html = '<blockquote>' + t.qs.map((q) => esc(q)).join('<br>') + '</blockquote><p><br></p>';
  newEntry(null, { title: t.title, html });
}

function setSaveState(s) {
  const el = $('#e-saved');
  if (!el) return;
  el.textContent = s === 'pending' ? '正在保存…' : s === 'failed' ? '保存失败·刷新可能丢失' : '已保存在本机';
  el.classList.toggle('pending', s === 'pending');
  el.classList.toggle('failed', s === 'failed');
}

let savedRange = null;

function bindEditor() {
  const e = entryById(state.entryId);
  if (!e) return;
  if (!e.time) e.time = { precision: 'unknown', date: '', season: 'spring', note: '' };
  const body = $('#e-body');
  const title = $('#e-title');

  const touch = () => { e.updatedAt = nowISO(); schedulePersist(); };

  title.addEventListener('input', () => {
    e.title = title.value;
    touch();
    const active = document.querySelector('.vol-entry.active');
    if (active) active.textContent = title.value || '无题';
  });

  body.addEventListener('input', () => {
    e.html = body.innerHTML;
    updateWords();
    touch();
  });
  updateWords();

  function updateWords() {
    const n = stripHtml(body.innerHTML).replace(/\s/g, '').length;
    $('#e-words').textContent = `${n} 字`;
  }

  // 时间
  $('#e-precision').addEventListener('change', (ev) => {
    e.time.precision = ev.target.value;
    $('#e-season').style.display = e.time.precision === 'season' ? '' : 'none';
    $('#e-date').style.display = e.time.precision === 'unknown' ? 'none' : '';
    touch();
  });
  $('#e-date').addEventListener('change', (ev) => { e.time.date = ev.target.value; touch(); });
  $('#e-season').addEventListener('change', (ev) => { e.time.season = ev.target.value; touch(); });
  $('#e-tnote').addEventListener('input', (ev) => { e.time.note = ev.target.value; touch(); });
  $('#e-place').addEventListener('input', (ev) => { e.place = ev.target.value; touch(); });
  $('#e-volume').addEventListener('change', (ev) => { e.volumeId = ev.target.value; touch(); renderShell(); });
  $('#e-milestone').addEventListener('change', (ev) => { e.milestone = ev.target.checked; touch(); });

  // 标签
  const tagInput = $('#e-taginput');
  tagInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && tagInput.value.trim()) {
      ev.preventDefault();
      e.tags = Array.from(new Set([...(e.tags || []), tagInput.value.trim()]));
      tagInput.value = '';
      persist(); rerenderChips();
    }
  });
  $('#e-tags').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-untag]');
    if (b) { e.tags = (e.tags || []).filter((x) => x !== b.dataset.untag); persist(); rerenderChips(); }
  });
  function rerenderChips() {
    const wrap = $('#e-tags');
    if (!wrap) return;
    const input = $('#e-taginput');
    wrap.innerHTML = (e.tags || []).map((x) => `<span class="chip plain">${esc(x)}<button data-untag="${esc(x)}">×</button></span>`).join('');
    wrap.appendChild(input);
    input.focus();
  }

  // 人物
  $('#e-people').addEventListener('click', (ev) => {
    if (ev.target.closest('#e-addperson')) { openPersonPicker(e); return; }
    const b = ev.target.closest('[data-unperson]');
    if (b) { e.people = (e.people || []).filter((id) => id !== b.dataset.unperson); persist(); render(); }
  });

  // 工具栏
  $$('.e-toolbar button[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (ev) => ev.preventDefault());
    btn.addEventListener('click', () => {
      body.focus();
      if (savedRange && body.contains(savedRange.startContainer)) restoreRange(savedRange);
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      e.html = body.innerHTML; touch();
    });
  });

  body.addEventListener('mouseup', saveRange);
  body.addEventListener('keyup', saveRange);
  function saveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreRange(r) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // 插图
  $('#e-img').addEventListener('click', () => {
    body.focus();
    saveRange();
    $('#file-image').click();
  });

  // 导入语音
  $('#e-audio').addEventListener('click', () => {
    body.focus();
    saveRange();
    $('#file-audio').click();
  });

  // 删除
  $('#e-delete').addEventListener('click', () => {
    if (!confirm('删除后可以在回收站找回，确定吗？')) return;
    e.deletedAt = nowISO();
    persist();
    go('#/timeline');
    toast('已移入回收站');
  });

  // 导出本篇
  $('#e-export').addEventListener('click', () => {
    const md = `# ${e.title || '无题'}\n\n> ${timeLabel(e.time)}${e.place ? ' · ' + e.place : ''}\n\n${htmlToMd(e.html)}\n`;
    download(`${(e.title || '无题').replace(/[\\/:*?"<>|]/g, '_')}.md`, md, 'text/markdown;charset=utf-8');
  });
}

function openPersonPicker(e) {
  const ps = book().people;
  const body = `
    <div class="hint" style="margin-bottom:10px">点一下加入这篇故事；也能在下面新建，或删掉不要的人。</div>
    <div class="people-grid" style="grid-template-columns:1fr 1fr">
      ${ps.map((p) => `<div class="ppl">
        <button class="person-card" data-pick="${p.id}" style="padding:10px 32px 10px 10px">
          <span class="avatar" style="width:32px;height:32px;font-size:14px">${esc(p.name.slice(0, 1))}</span>
          <span><b style="font-size:13px">${esc(p.name)}</b><span>${esc(p.relation || '')}</span></span>
          ${(e.people || []).includes(p.id) ? '<span class="badge" style="margin-left:auto">已加入</span>' : ''}
        </button>
        <button class="ppl-del" data-delperson="${p.id}" title="删除这个人物" aria-label="删除 ${esc(p.name)}">×</button>
      </div>`).join('')}
    </div>
    <div class="field" style="margin-top:16px">
      <label>新建人物</label>
      <div style="display:flex;gap:8px">
        <input class="input" id="np-name" placeholder="名字">
        <input class="input" id="np-rel" placeholder="关系，如 父亲" style="max-width:140px">
      </div>
    </div>`;
  const m = openModal({ title: '加入人物', body, actions: [{ label: '新建', onClick: () => {
    const n = $('#np-name').value.trim();
    if (!n) { toast('先写个名字'); return; }
    const p = { id: uid('p'), name: n, relation: $('#np-rel').value.trim(), note: '' };
    book().people.push(p);
    e.people = Array.from(new Set([...(e.people || []), p.id]));
    persist(); closeModal(); render();
  } }] });
  $$('[data-pick]', m).forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.pick;
    e.people = (e.people || []).includes(id) ? e.people.filter((x) => x !== id) : [...(e.people || []), id];
    persist(); closeModal(); render();
  }));
  $$('[data-delperson]', m).forEach((btn) => btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const id = btn.dataset.delperson;
    const p = book().people.find((x) => x.id === id);
    if (!p) return;
    const used = book().entries.filter((x) => !x.deletedAt && (x.people || []).includes(id)).length;
    const msg = used
      ? `删除「${p.name}」？它会从 ${used} 篇回忆里一并移除，这个操作不能撤销。`
      : `删除「${p.name}」？这个操作不能撤销。`;
    if (!confirm(msg)) return;
    book().people = book().people.filter((x) => x.id !== id);
    book().entries.forEach((x) => { if (x.people) x.people = x.people.filter((y) => y !== id); });
    persist();
    render();
    closeModal();
    openPersonPicker(entryById(e.id) || e);
    toast(`已删除「${p.name}」`);
  }));
}

/* ---------- 图片 ---------- */
function compressImage(file, maxW = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width, maxW / img.height);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}

$('#file-audio').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const e = entryById(state.entryId);
  const body = $('#e-body');
  if (!e || !body) return;

  const mb = file.size / (1024 * 1024);
  if (mb > 60) { toast('这段语音有 ' + mb.toFixed(0) + ' MB，太长了，先剪一段再导进来', 'warn'); return; }

  const btn = $('#e-audio');
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '读取中…'; }
  try {
    const sec = await probeDuration(file);
    const info = await saveAudio(file, e.id, audioExt(file));
    const cap = '语音' + (sec ? ' · ' + fmtDur(sec) : '') + (mb >= 1 ? ' · ' + mb.toFixed(1) + ' MB' : '');
    const html = `<figure class="audio"><audio controls preload="metadata" src="${info.src}"></audio><figcaption>${esc(cap)}</figcaption></figure><p><br></p>`;
    body.focus();
    if (savedRange && body.contains(savedRange.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(savedRange);
    }
    document.execCommand('insertHTML', false, html);
    e.html = body.innerHTML;
    schedulePersist();
    toast('语音已存入「' + info.where + '」');
  } catch (err) {
    toast('这段语音没能读进来', 'warn');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = old || '语音'; }
  }
});

$('#file-image').addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const e = entryById(state.entryId);
  const body = $('#e-body');
  if (!e || !body) return;
  try {
    const dataUrl = await compressImage(file);
    let src = dataUrl;
    if (dirReady && dirHandle) {
      try {
        src = await saveImageToFolder(dataUrl, e.id);
        toast('照片已存进「' + dirHandle.name + '」的「' + IMG_DIR + '」文件夹');
      } catch (err) {
        src = dataUrl;
        toast('照片没能写进文件夹，先存在浏览器里', 'warn');
      }
    }
    const html = `<figure><img src="${src}" alt=""></figure><p><br></p>`;
    body.focus();
    if (savedRange && body.contains(savedRange.startContainer)) {
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(savedRange);
    }
    document.execCommand('insertHTML', false, html);
    e.html = body.innerHTML;
    schedulePersist();
  } catch (err) {
    toast('这张图没能读进来', 'warn');
  }
});

/* ---------- 人物弹窗 ---------- */
function openPersonModal(id) {
  const p = id ? personById(id) : { name: '', relation: '', note: '' };
  const body = `
    <div class="field"><label>名字</label><input class="input" id="p-name" value="${esc(p.name)}"></div>
    <div class="field"><label>和我的关系</label><input class="input" id="p-rel" value="${esc(p.relation || '')}" placeholder="母亲 / 师傅 / 老同学"></div>
    <div class="field"><label>一句话印象</label><textarea class="ta" id="p-note">${esc(p.note || '')}</textarea></div>`;
  openModal({
    title: id ? '编辑人物' : '新建人物',
    body,
    actions: [{ label: '保存', primary: true, onClick: () => {
      const name = $('#p-name').value.trim();
      if (!name) { toast('先写个名字'); return; }
      if (id) { Object.assign(personById(id), { name, relation: $('#p-rel').value.trim(), note: $('#p-note').value.trim() }); }
      else { book().people.push({ id: uid('p'), name, relation: $('#p-rel').value.trim(), note: $('#p-note').value.trim() }); }
      persist(); closeModal(); render();
    } }],
  });
}

/* ---------- 分享弹窗 ---------- */
function openShareModal() {
  const b = book();
  const body = `
    <div class="field">
      <label>预览范围</label>
      <div class="share-scope">
        <label class="check-row"><input type="radio" name="scope" value="book" checked> 整本书 <small>${liveEntries().length} 篇</small></label>
        ${b.volumes.map((v) => `<label class="check-row"><input type="checkbox" name="vol" value="${v.id}"> ${esc(v.title)} <small>${entriesOfVolume(v.id).length} 篇</small></label>`).join('')}
      </div>
      <div class="hint">勾选卷之后会覆盖「整本书」。注意：当前版本只生成本机预览，不会把内容同步给亲友；预览读取本机当前数据，并非独立快照。口令也不是加密保护。</div>
    </div>
    <div class="field"><label>本机预览口令（可留空）</label><input class="input" id="sh-pass" placeholder="例如：老家"></div>
    <div class="field"><label>预览有效期</label>
      <select class="select" id="sh-exp">
        <option value="7">7 天</option>
        <option value="30">30 天</option>
        <option value="0" selected>长期有效</option>
      </select>
    </div>`;
  openModal({
    title: '创建本机预览',
    body,
    actions: [{ label: '生成本机预览', primary: true, onClick: () => {
      const vols = $$('input[name="vol"]:checked').map((x) => x.value);
      const exp = Number($('#sh-exp').value);
      const s = {
        id: uid('s'), token: uid('t').slice(0, 10),
        scope: vols.length ? { type: 'volumes', volumeIds: vols } : { type: 'book' },
        password: $('#sh-pass').value.trim(),
        createdAt: nowISO(),
        expiresAt: exp ? Date.now() + exp * 864e5 : 0,
        revoked: false, views: 0,
      };
      b.shares.push(s);
      persist(); closeModal(); render();
      copyText(shareUrl(s));
      toast('本机预览链接已复制');
    } }],
  });
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
  function fallbackCopy(t) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }
}

/* ---------- 分享页 ---------- */
function bindSharePage() {
  const unlock = $('#sp-unlock');
  if (unlock) {
    unlock.addEventListener('click', () => {
      const s = book().shares.find((x) => x.token === state.shareToken);
      if ($('#sp-pass').value === s.password) { state.shareUnlocked = true; render(); }
      else toast('口令不对', 'warn');
    });
    return;
  }
  const v = $('#view');
  v.onclick = (ev) => {
    const b = ev.target.closest('[data-comment-send]');
    if (b) {
      const id = b.dataset.commentSend;
      const input = $(`[data-comment-input="${id}"]`);
      const text = input.value.trim();
      if (!text) return;
      const author = prompt('署名：', '家人') || '匿名';
      book().comments.push({ id: uid('c'), entryId: id, author, text, at: nowISO() });
      persist(); render();
      toast('留言已寄出');
    }
    /* 分享页事件结束 */
    if (ev.target.closest('[data-nav]')) go('#/share');
  };
}

function openVolumeManager() {
  const b = book();
  const saveNames = (root) => {
    $$('[data-volume-title]', root).forEach((input) => {
      const v = b.volumes.find((x) => x.id === input.dataset.volumeTitle);
      if (v) v.title = input.value.trim() || '未命名卷';
    });
  };
  const rows = b.volumes.map((v) => {
    const count = entriesOfVolume(v.id).length;
    const hasEntries = b.entries.some((e) => e.volumeId === v.id);
    const disabled = hasEntries || b.volumes.length <= 1 ? 'disabled' : '';
    return '<div class="field"><label>' + esc(v.title) + ' · ' + count + ' 篇</label>' +
      '<div style="display:flex;gap:8px"><input class="input" data-volume-title="' + esc(v.id) + '" value="' + esc(v.title) + '">' +
      '<button class="btn btn-sm danger" data-volume-delete="' + esc(v.id) + '" ' + disabled + '>删除</button></div></div>';
  }).join('');
  const m = openModal({
    title: '管理分卷',
    body: '<div>' + rows + '</div><button class="btn btn-sm" id="volume-add">＋ 新建一卷</button><p class="hint">已有故事的卷不能删除；请先在文章编辑页把故事移到其他卷。</p>',
    actions: [{ label: '保存', primary: true, onClick: () => {
      saveNames(m);
      if (!persist()) return;
      closeModal();
      render();
    } }],
  });
  $('#volume-add', m).addEventListener('click', () => {
    saveNames(m);
    b.volumes.push({ id: uid('v'), title: '新卷 ' + (b.volumes.length + 1) });
    persist();
    openVolumeManager();
  });
  $$('[data-volume-delete]', m).forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.volumeDelete;
    if (b.entries.some((e) => e.volumeId === id) || b.volumes.length <= 1) return;
    if (!confirm('删除这个空卷？此操作不能撤销。')) return;
    saveNames(m);
    b.volumes = b.volumes.filter((v) => v.id !== id);
    persist();
    openVolumeManager();
  }));
}

/* ---------- 书信息 ---------- */
function openBookModal() {
  const b = book();
  openModal({
    title: '书名',
    body: `
      <div class="field"><label>书名</label><input class="input" id="bk-title" value="${esc(b.title)}"></div>
      <div class="field"><label>副标题</label><input class="input" id="bk-sub" value="${esc(b.subtitle || '')}" placeholder="写给谁"></div>
      <div class="field"><label>作者</label><input class="input" id="bk-author" value="${esc(b.author || '')}"></div>`,
    actions: [{ label: '保存', primary: true, onClick: () => {
      b.title = $('#bk-title').value.trim() || '我的一生';
      b.subtitle = $('#bk-sub').value.trim();
      b.author = $('#bk-author').value.trim();
      persist(); closeModal(); render();
    } }],
  });
}

/* ==================== 8. 弹窗 ==================== */
let modalEl = null;
function openModal({ title, body, actions = [] }) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn x" data-close>✕</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-act-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div>`;
  document.body.appendChild(wrap);
  modalEl = wrap;
  wrap.addEventListener('click', (ev) => {
    if (ev.target === wrap || ev.target.closest('[data-close]')) closeModal();
  });
  $$('[data-act-i]', wrap).forEach((btn) => {
    btn.addEventListener('click', () => actions[Number(btn.dataset.actI)].onClick());
  });
  return wrap;
}
function closeModal() {
  if (modalEl) { modalEl.remove(); modalEl = null; }
}

/* ==================== 9. 导出 ==================== */
function htmlToMd(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  /* 图片：保留真实图片（base64 内嵌），而不是丢掉 */
  d.querySelectorAll('figure').forEach((f) => {
    const img = f.querySelector('img');
    const cap = f.querySelector('figcaption');
    const alt = ((cap && cap.textContent) || (img && img.alt) || '照片').trim() || '照片';
    if (img && img.getAttribute('src')) {
      f.replaceWith(document.createTextNode(`\n\n![${alt}](${img.getAttribute('src')})\n\n`));
    } else {
      f.replaceWith(document.createTextNode(`\n\n（照片${cap && cap.textContent ? '：' + cap.textContent : ''}）\n\n`));
    }
  });
  d.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    const alt = (img.getAttribute('alt') || '照片').trim() || '照片';
    img.replaceWith(document.createTextNode(src ? `\n\n![${alt}](${src})\n\n` : `\n\n（照片）\n\n`));
  });
  let t = d.innerHTML
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<[^>]+>/g, '');
  const ta = document.createElement('textarea');
  ta.innerHTML = t;
  return ta.value.replace(/\n{3,}/g, '\n\n').trim();
}

async function exportMarkdown() {
  const b = book();
  let out = `# ${b.title}\n\n`;
  let leftLocal = false;
  if (b.subtitle) out += `> ${b.subtitle}\n\n`;
  for (const v of b.volumes) {
    const es = sortEntries(entriesOfVolume(v.id));
    if (!es.length) continue;
    out += `\n## ${v.title}\n\n`;
    for (const e of es) {
      out += `### ${e.title || '无题'}\n\n`;
      out += `*${timeLabel(e.time)}${e.place ? ' · ' + e.place : ''}*\n\n`;
      const h = await inlineFolderImages(e.html);
      if (hasLocalImg(h)) leftLocal = true;
      out += htmlToMd(h) + '\n\n';
    }
  }
  download(`${b.title}.md`, out, 'text/markdown;charset=utf-8');
  toast(leftLocal ? 'Markdown 已导出；有照片还指向文件夹，导出文件里看不到那几张' : 'Markdown 已导出（图片已内嵌，文件会偏大）', leftLocal ? 'warn' : 'ok');
}

/* 导出成一个自带图片的 HTML 文件：双击就能看，也可以直接打印成 PDF */
async function exportHTML() {
  const b = book();
  let leftLocal = false;
  let body = `<header class="cover"><h1>${esc(b.title)}</h1>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}${b.author ? `<p class="byline">${esc(b.author)}</p>` : ''}</header>`;
  for (const v of b.volumes) {
    const es = sortEntries(entriesOfVolume(v.id));
    if (!es.length) continue;
    body += `<section class="vol"><h2>${esc(v.title)}</h2>`;
    for (const e of es) {
      const h = await inlineFolderImages(e.html);
      if (hasLocalImg(h)) leftLocal = true;
      body += `<article><h3>${esc(e.title || '无题')}</h3><p class="meta">${esc(timeLabel(e.time))}${e.place ? ' · ' + esc(e.place) : ''}</p><div class="prose">${sanitize(h)}</div></article>`;
    }
    body += '</section>';
  }
  const css = [
    'body{margin:0;background:#f7f3ea;color:#2a241d;font-family:"Songti SC","Noto Serif CJK SC",Georgia,serif;line-height:1.9}',
    '.page{max-width:760px;margin:0 auto;padding:64px 28px 96px}',
    '.cover{text-align:center;margin-bottom:56px}',
    '.cover h1{font-size:34px;letter-spacing:.12em;margin:0 0 12px}',
    '.cover p{color:#7a6f60;margin:4px 0}',
    '.vol{margin-top:54px}',
    '.vol > h2{font-size:14px;letter-spacing:.3em;color:#8a7f6f;border-bottom:1px solid #ddd3c2;padding-bottom:10px;font-weight:400}',
    'article{margin:34px 0}',
    'article h3{font-size:22px;margin:0 0 6px}',
    '.meta{color:#8a7f6f;font-size:13px;margin:0 0 18px}',
    '.prose p{margin:0 0 1em}',
    '.prose img{max-width:100%;height:auto;border-radius:4px;display:block;margin:16px 0 4px}',
    '.prose figure{margin:18px 0}',
    '.prose figcaption{font-size:13px;color:#8a7f6f;text-align:center}',
    '.prose blockquote{border-left:2px solid #d8cbb4;margin:1em 0;padding:2px 0 2px 16px;color:#5b5040}',
    '.prose hr{border:0;border-top:1px solid #e2d9c8;margin:1.6em 0}',
    '@media print{body{background:#fff}.page{max-width:none;padding:0}article{page-break-inside:avoid}}',
  ].join('\n');
  const doc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.title)}</title><style>${css}</style></head><body><div class="page">${body}</div></body></html>`;
  download(`${b.title}.html`, doc, 'text/html;charset=utf-8');
  toast(leftLocal ? '网页已导出；有照片还指向文件夹，导出文件里看不到那几张' : '网页已导出（图片已内嵌，双击即可看）', leftLocal ? 'warn' : 'ok');
}

function backupJSON() {
  download(`拾忆备份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json');
  toast('备份已导出');
}

$('#file-import').addEventListener('change', (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(String(r.result));
      if (!d || d.version !== 1 || !Array.isArray(d.books) || !d.books.length) throw new Error('备份版本或书籍列表不正确');
      for (const b of d.books) {
        if (!b || typeof b.id !== 'string' || !Array.isArray(b.volumes) || !Array.isArray(b.entries)) throw new Error('书籍数据不完整');
        if (!Array.isArray(b.people)) b.people = [];
        if (!Array.isArray(b.comments)) b.comments = [];
        if (!Array.isArray(b.shares)) b.shares = [];
        if (b.entries.some((e) => !e || typeof e.id !== 'string')) throw new Error('文章数据不完整');
      }
      if (!d.books.some((b) => b.id === d.activeBookId)) d.activeBookId = d.books[0].id;
      if (!confirm('导入会替换当前浏览器里的全部回忆录数据。建议先导出一份备份。确定继续吗？')) return;
      const previous = db;
      db = d;
      if (!persist()) {
        db = previous;
        persist();
        toast('保存失败，未完成导入。', 'warn');
        return;
      }
      applyTheme(); render();
      toast('备份已导入');
    } catch (e) { toast('这个文件读不出来', 'warn'); }
  };
  r.readAsText(f);
});

function buildPrintHTML() {
  const b = book();
  let html = `<div class="p-page p-cover"><h1>${esc(b.title)}</h1><p>${esc(b.subtitle || '')}</p><p style="margin-top:30pt">${esc(b.author || '')}</p></div>`;
  b.volumes.forEach((v) => {
    const es = sortEntries(entriesOfVolume(v.id));
    if (!es.length) return;
    html += `<div class="p-page"><h2 class="p-vol">${esc(v.title)}</h2>`;
    es.forEach((e) => {
      html += `<div class="p-entry"><h2>${esc(e.title || '无题')}</h2><div class="p-date">${esc(timeLabel(e.time))}${e.place ? ' · ' + esc(e.place) : ''}</div><div class="prose">${sanitize(e.html)}</div></div>`;
    });
    html += '</div>';
  });
  return html;
}

function printBook() {
  $('#print-root').innerHTML = buildPrintHTML();
  setTimeout(() => window.print(), 120);
}

/* 直接用浏览器打印（Ctrl+P）时也要有内容可印 */
window.addEventListener('beforeprint', () => {
  const root = $('#print-root');
  if (root && !root.innerHTML.trim()) root.innerHTML = buildPrintHTML();
});
window.addEventListener('afterprint', () => {
  const root = $('#print-root');
  if (root) root.innerHTML = '';
});

/* ==================== 10. 全局事件 ==================== */
$('#btn-new').addEventListener('click', () => newEntry());
$('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#btn-theme').addEventListener('click', () => {
  const order = ['paper', 'sepia', 'dark'];
  setTheme(order[(order.indexOf(db.theme) + 1) % 3]);
});

$('#btn-export').addEventListener('click', () => {
  openModal({
    title: '导出与备份',
    body: `<div class="share-scope" style="max-height:none">
      <p class="hint" style="margin-top:0">导出不会上传任何内容，全部在你的浏览器里完成。</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      <button class="btn" data-ex="md">导出 Markdown（文字 + 内嵌图片）</button>
      <button class="btn" data-ex="html">导出网页（单文件 HTML，含图片）</button>
      <button class="btn" data-ex="json">导出 JSON 备份</button>
      <button class="btn" data-ex="print">打印 / 另存为 PDF</button>
      <button class="btn" data-ex="import">从备份恢复</button>
    </div>`,
    actions: [],
  });
  $$('[data-ex]').forEach((btn) => btn.addEventListener('click', () => {
    const k = btn.dataset.ex;
    closeModal();
    if (k === 'md') exportMarkdown().catch(() => toast('导出 Markdown 失败', 'warn'));
    if (k === 'html') exportHTML().catch(() => toast('导出网页失败', 'warn'));
    if (k === 'json') backupJSON();
    if (k === 'print') printBook();
    if (k === 'import') $('#file-import').click();
  }));
});

$('#nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-nav]');
  if (b) go('#/' + b.dataset.nav);
});
$('#volumes').addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-voltoggle]');
  if (t) {
    const id = t.dataset.voltoggle;
    state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id);
    renderShell();
    return;
  }
  const a = ev.target.closest('[data-voladd]');
  if (a) { newEntry(a.dataset.voladd); return; }
  const e = ev.target.closest('[data-entry]');
  if (e) { go('#/write/' + e.dataset.entry); closeSidebar(); }
});

let searchTimer = null;
$('#search').addEventListener('input', (ev) => {
  const q = ev.target.value.trim();
  state.search = q;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (q) { renderSearchResults(q); }
    else { parseRoute(); render(); }
  }, 180);
});

function renderSearchResults(q) {
  const kw = q.toLowerCase();
  const hits = liveEntries().filter((e) => {
    const hay = [e.title, stripHtml(e.html), e.place, (e.tags || []).join(' '), (e.people || []).map(personName).join(' ')].join(' ').toLowerCase();
    return hay.includes(kw);
  });
  const view = $('#view');
  view.innerHTML = `
    <div class="view-head"><div><h1 class="view-title">搜索「${esc(q)}」</h1><p class="view-sub">${hits.length} 条结果</p></div></div>
    ${hits.length ? `<div class="tl" style="padding-left:0">${sortEntries(hits).map((e) => timelineCard(e)).join('')}</div>`
      : `<div class="empty"><p>没有找到。试试人物的名字，或者「火车站」这样的地点。</p></div>`}`;
  bindView();
}

function closeSidebar() { $('#sidebar').classList.remove('open'); }

document.addEventListener('keydown', (ev) => {
  if (state.route === 'readall' && !modalEl) {
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); turnBook(1); return; }
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); turnBook(-1); return; }
    if (ev.key === 'Escape') { ev.preventDefault(); go('#/'); return; }
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    const ok = persist();
    setSaveState(ok ? 'saved' : 'failed');
    if (ok) toast('已保存在本机');
  }
  if (ev.key === 'Escape') {
    if (modalEl) closeModal();
    closeSidebar();
  }
});

let bkResizeTimer = null;
window.addEventListener('resize', () => {
  if (state.route !== 'readall') return;
  clearTimeout(bkResizeTimer);
  bkResizeTimer = setTimeout(() => layoutBook(false), 160);
});

window.addEventListener('beforeunload', () => {
  try { persist(); } catch (e) {}
  try { dirFlush(); } catch (e) {}
});
window.addEventListener('pagehide', () => { try { dirFlush(); } catch (e) {} });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { try { dirFlush(); } catch (e) {} }
});
/* 顶部文件夹提示条不在 #view 里，单独委托一下 */
document.addEventListener('click', (ev) => {
  const x = ev.target.closest('#folder-bar-close');
  if (x) {
    hideFolderBar();
    try { localStorage.setItem('shiyi.memoir.barOff', '1'); } catch (e) {}
    return;
  }
  const b = ev.target.closest('#folder-bar [data-act]');
  if (!b) return;
  ev.preventDefault();
  handleAct(b.dataset.act, b);
});

window.addEventListener('hashchange', () => { parseRoute(); state.search = ''; $('#search').value = ''; closeSidebar(); render(); });

/* ==================== 10.5 光影 ==================== */
const LIT_SEL = '.hero,.card,.tpl,.tl-card,.person-card,.stat-card,.share-card,.book-cover,.e-meta,.modal';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let lightEv = null;
let lightRaf = 0;

// 鼠标位置 → 卡片光斑、书的转动、环境光视差
document.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch') return;
  lightEv = ev;
  if (!lightRaf) lightRaf = requestAnimationFrame(applyLight);
}, { passive: true });

function applyLight() {
  lightRaf = 0;
  const ev = lightEv;
  const x = ev.clientX;
  const y = ev.clientY;

  const lit = ev.target.closest && ev.target.closest(LIT_SEL);
  if (lit) {
    const r = lit.getBoundingClientRect();
    lit.style.setProperty('--mx', (x - r.left) + 'px');
    lit.style.setProperty('--my', (y - r.top) + 'px');
  }

  const amb = $('#ambient');
  amb.style.setProperty('--px', ((x / innerWidth) * 2 - 1).toFixed(3));
  amb.style.setProperty('--py', ((y / innerHeight) * 2 - 1).toFixed(3));

  const cover = $('.hero-cover');
  if (!cover || reduceMotion.matches) return;
  const hr = cover.closest('.hero').getBoundingClientRect();
  if (x < hr.left || x > hr.right || y < hr.top || y > hr.bottom) {
    ['--tx', '--ty', '--gx', '--gy'].forEach((p) => cover.style.removeProperty(p));
    return;
  }
  const cr = cover.getBoundingClientRect();
  const nx = clamp((x - cr.left) / cr.width, -0.5, 1.5);
  const ny = clamp((y - cr.top) / cr.height, -0.5, 1.5);
  cover.style.setProperty('--ty', ((nx - 0.5) * 16).toFixed(2) + 'deg');
  cover.style.setProperty('--tx', (-(ny - 0.5) * 10).toFixed(2) + 'deg');
  cover.style.setProperty('--gx', (nx * 100).toFixed(1) + '%');
  cover.style.setProperty('--gy', (ny * 100).toFixed(1) + '%');
}

// 首页台灯下的浮尘：只在灯光里看得见。hero 每次 render 都会重建，所以每帧重新找 canvas
function initDust() {
  let cv = null, ctx = null;
  let W = 0, H = 0;
  const motes = [];

  const spawn = (m = {}, fromBottom) => {
    m.x = Math.random() * W;
    m.y = fromBottom ? H + 6 : Math.random() * H;
    m.r = 0.5 + Math.random() * 1.6;
    m.vx = (Math.random() - 0.5) * 0.14;
    m.vy = -0.04 - Math.random() * 0.12;
    m.ph = Math.random() * Math.PI * 2;
    m.a = 0.4 + Math.random() * 0.6;
    return m;
  };

  function attach() {
    const el = $('.hero-dust');
    if (!el) { cv = ctx = null; return false; }
    const w = el.clientWidth, h = el.clientHeight;
    if (el !== cv || w !== W || h !== H) {
      cv = el;
      ctx = el.getContext('2d');
      W = w;
      H = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes.length = 0;
      for (let i = 0; i < (W < 600 ? 22 : 44); i++) motes.push(spawn());
    }
    return true;
  }

  // 灯在左上方，与 .hero-lamp 的位置一致
  function lightAt(x, y) {
    const dx = x - W * 0.2, dy = y + H * 0.25;
    const r = Math.max(W * 0.5, H * 1.1);
    return Math.exp(-(dx * dx + dy * dy) / (r * r));
  }

  function draw(step) {
    if (!attach()) return;
    ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      if (step) {
        m.ph += 0.012;
        m.x += m.vx + Math.sin(m.ph) * 0.09;
        m.y += m.vy + Math.cos(m.ph * 0.7) * 0.04;
        if (m.y < -8 || m.x < -8 || m.x > W + 8) spawn(m, true);
      }
      const a = m.a * lightAt(m.x, m.y) * (0.55 + 0.45 * Math.sin(m.ph * 1.7));
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(255,222,176,${a.toFixed(3)})`;
      ctx.shadowColor = `rgba(255,190,120,${(a * 0.9).toFixed(3)})`;
      ctx.shadowBlur = m.r * 6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (reduceMotion.matches) {
    const still = () => { draw(false); setTimeout(still, 500); };
    still();
    return;
  }
  const loop = () => { draw(true); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

/* ==================== 11. 启动 ==================== */
function applyTheme() { document.documentElement.setAttribute('data-theme', db.theme || 'paper'); }

/* 首页「回忆时间线」：复用同一个窗口，前一个没关就顶掉它，顺便重播开场。
   重要：必须趁这个窗口还在前台、还带着这次点击的授权，先把音乐放起来，
   再打开星图。否则窗口一被挤到后台，浏览器会挂起后台标签的音频加载，
   音频元素会出现「paused:false 但 readyState:0、currentTime 一直是 0」的死状态。 */
document.addEventListener('click', (ev) => {
  const a = ev.target && ev.target.closest ? ev.target.closest('[data-star-link]') : null;
  if (!a) return;
  ev.preventDefault();
  const url = '星图时间线.html?t=' + Date.now();
  let opened = false;
  const openOnce = () => {
    if (opened) return;
    opened = true;
    let win = null;
    try { win = window.open(url, 'shiyi-star'); } catch (e2) { win = null; }
    /* 打包版（WebView2）里 window.open 会返回 null——窗口由程序自己开，不再补开 _blank，
       否则一次点击会开出两个星图窗口。 */
    if (!win) return;
    try { win.focus(); } catch (e4) { /* 忽略 */ }
  };
  if (window.__shiyiHostedApp) {
    /* 打包版：星图窗口自己有「允许自动播放」的权限，让它自己出声，这边别放，免得两处重音 */
    openOnce();
    return;
  }

  bgmStart()
    .then((r) => { setTimeout(openOnce, r && r.playing ? 420 : 0); })
    .catch(() => openOnce());
  setTimeout(openOnce, 1200); /* 兜底：播放卡住也要把窗口打开 */
});

/* 给星图窗口代播背景音乐：
   星图是新窗口，没有用户手势，浏览器不许它自动出声；
   但这个页面刚刚被点过，浏览器允许它播放，所以由这里出声、那边只管画面。 */
let bgmEl = null;
const BGM_SONG = '风之谷';
const BGM_EXTS = ['mp3', 'm4a', 'ogg', 'wav'];
const BGM_DIRS = ['数据/音乐/', '音乐/', ''];

function bgmCandidates() {
  const out = [];
  let saved = null;
  try { saved = localStorage.getItem('shiyi.bgm'); } catch (e) { saved = null; }
  if (saved) out.push(saved);
  BGM_DIRS.forEach((d) => BGM_EXTS.forEach((x) => out.push(d + BGM_SONG + '.' + x)));
  return out;
}

/* 直接 play()：能出声就说明文件在；文件不存在会报 NotSupportedError，
   被自动播放策略拦住会报 NotAllowedError（此时文件是好的，记下来等手势）。
   无音频设备的机器上 play() 可能一直不 settle，所以给个 2.2 秒上限。 */
function bgmPlay(a) {
  return Promise.race([
    a.play().then(() => 'ok', (e) => (e && e.name) || 'err'),
    new Promise((r) => setTimeout(() => r('slow'), 2200)),
  ]);
}

/* 探一个候选文件：只靠加载事件判断，不调用 play()。
   注意：没有用户激活时 play() 会直接以 NotAllowedError 被拒，
   它并不能说明文件存在与否——所以不能用 play() 来探测。 */
function bgmProbeOne(src, ms) {
  return new Promise((res) => {
    const a = new Audio();
    a.preload = 'auto';
    a.loop = true;
    a.src = src;
    let done = false;
    const fin = (ok) => {
      if (done) return;
      done = true;
      res(ok ? a : null);
    };
    a.addEventListener('loadedmetadata', () => fin(true));
    a.addEventListener('canplay', () => fin(true));
    a.addEventListener('error', () => fin(false));
    setTimeout(() => fin(false), ms || 2500);
    try { a.load(); } catch (e) { fin(false); }
  });
}

async function bgmFind() {
  const list = bgmCandidates();
  for (let k = 0; k < list.length; k++) {
    const a = await bgmProbeOne(list[k], 2500);
    if (a) { try { a.pause(); a.volume = BGM_VOL; } catch (e) { /* 忽略 */ } return a; }
  }
  return null;
}

/* 不要在后台标签页里做音量渐变：首页在这里是背景页，定时器被压到 1 秒一次，
   从 0 慢慢加会卡在听不见的位置。直接给目标音量，稳定可靠。 */
const BGM_VOL = 0.5;

function bgmFadeIn() {
  if (!bgmEl) return;
  try { bgmEl.muted = false; bgmEl.volume = BGM_VOL; } catch (e) { /* 忽略 */ }
}

/* 返回 { has, playing }：has=找到曲子，playing=真在响 */
async function bgmStart() {
  if (!bgmEl) bgmEl = await bgmFind();
  if (!bgmEl) return { has: false, playing: false };
  if (!bgmEl.paused) { bgmFadeIn(); return { has: true, playing: true }; }
  const r = await bgmPlay(bgmEl);
  if (r === 'ok' || r === 'slow') {
    bgmFadeIn();
    return { has: true, playing: true };
  }
  return { has: true, playing: false };
}

/* 提前把曲子读进缓冲区：等用户点「回忆时间线」时，媒体已经 readyState>=2，
   点击当下就能立刻出声，不会被「边加载边被挂起」卡住。 */
async function bgmPrewarm() {
  if (bgmEl) return bgmEl;
  const a = await bgmFind();
  if (!a) return null;
  bgmEl = a;
  try {
    a.pause();
    a.volume = BGM_VOL;
  } catch (e) { /* 忽略 */ }
  return bgmEl;
}

function bgmStop() {
  if (!bgmEl) return;
  const el = bgmEl;
  const t = setInterval(() => {
    try { el.volume = Math.max(0, el.volume - 0.12); } catch (e) { /* 忽略 */ }
    if (el.volume <= 0.001) clearInterval(t);
  }, 80);
  /* 兜底：后台标签页的定时器可能被拖慢，900ms 后无论如何停掉 */
  setTimeout(() => {
    clearInterval(t);
    try { el.volume = 0; el.pause(); } catch (e) { /* 忽略 */ }
  }, 900);
}

window.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (!d || d.ch !== 'shiyi-music') return;
  const reply = (has, playing) => {
    try {
      ev.source.postMessage({
        ch: 'shiyi-music', type: 'state', has, playing,
        vol: bgmEl ? bgmEl.volume : 0,
        paused: bgmEl ? bgmEl.paused : true,
      }, '*');
    } catch (e) { /* 忽略 */ }
  };
  if (d.type === 'stop') { bgmStop(); reply(!!bgmEl, false); return; }
  bgmStart().then((r) => reply(r.has, r.playing));
});
window.addEventListener('pagehide', bgmStop);
window.__bgm = { start: bgmStart, stop: bgmStop, el: () => bgmEl, cand: bgmCandidates };

(function boot() {
  let hadStore = false;
  try { hadStore = !!localStorage.getItem(KEY); } catch (e) { hadStore = false; }
  db = loadDB();
  if (HOST_ON) document.body.classList.add('hosted');
  if (stripImagePlaceholders(db)) persist();
  try {
    if (!hadStore) persist();
  } catch (e) {
    persist();
  }
  applyTheme();
  parseRoute();
  render();
  initDust();
  if (navigator.storage && navigator.storage.persist) {
    try { navigator.storage.persist().catch(() => {}); } catch (e) { /* 老浏览器 */ }
  }
  /* 打包版首次启动：把 数据\回忆录数据.json 带进来（exe 传 ?file=…） */
  const bootFile = (function () {
    try { return new URLSearchParams(location.search).get('file'); } catch (e) { return null; }
  })();
  /* 程序版（exe）：数据文件由宿主直接读写，本地没数据就先从 数据\回忆录数据.json 读回来 */
  if (HOST_ON && !hadStore) {
    hostLoad((txt) => {
      if (!txt) return;
      let d = null;
      try { d = JSON.parse(txt); } catch (e) { return; }
      if (!d || !Array.isArray(d.books) || !d.books.length) return;
      db = d;
      persist();
      applyTheme();
      parseRoute();
      render();
      toast('已从 ' + HOST_FILE_LABEL + ' 载入你的内容');
    });
  } else if (bootFile && !hadStore) {
    fetch(bootFile).then((r) => (r.ok ? r.text() : null)).then((txt) => {
      if (!txt) return;
      let d = null;
      try { d = JSON.parse(txt); } catch (e) { return; }
      if (!d || !Array.isArray(d.books) || !d.books.length) return;
      db = d;
      persist();
      applyTheme();
      parseRoute();
      render();
      toast('已从 ' + bootFile + ' 载入你的内容');
    }).catch(() => {});
  }

  /* 程序版不需要“连接文件夹”；浏览器版才问一句要不要继续用（不阻塞首屏） */
  if (!HOST_ON) initFolder().catch(() => {});

  /* 主库空了才去翻备份，且绝不阻塞首屏 */
  if (!hadStore) {
    backupGet().then((bak) => {
      if (!bak || !bak.raw) return;
      if (dirReady) return;
      let d = null;
      try { d = JSON.parse(bak.raw); } catch (e) { return; }
      if (!d || !Array.isArray(d.books) || !d.books.length) return;
      if (JSON.stringify(d) === JSON.stringify(db)) return;
      db = d;
      persist();
      applyTheme();
      parseRoute();
      render();
      toast('已从自动备份恢复上次写的内容');
    }).catch(() => {});
  }

  /* 先把背景音乐读进缓冲区（不发声），点「回忆时间线」时才能立刻响 */
  setTimeout(() => { bgmPrewarm().catch(() => {}); }, 700);
})();

})();

