'use strict';
// Critical Hit Studio backend: serves the app, stores planner data, proxies IGDB, relays live updates to OBS.
// Runs inside Electron (main.js) or on its own:  node server/server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { IgdbClient, IgdbError, imageUrl } = require('./igdb');
const { fetchVideo, fetchChannel, fetchChannelVideos, videoIdFrom, parseChannelInput, YoutubeError } = require('./youtube');
const sgdb = require('./sgdb');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon'
};

function startServer(opts) {
  const dataDir = opts.dataDir;
  const publicDir = opts.publicDir || path.join(__dirname, '..', 'public');
  const preferredPort = opts.port || 8787;
  const lan = !!opts.lan;                       // false = only this computer can connect
  const host = lan ? '0.0.0.0' : '127.0.0.1';

  const mediaDir = path.join(dataDir, 'media');
  const relayImgDir = path.join(dataDir, 'relay-images');
  const backupDir = path.join(dataDir, 'backups');
  [dataDir, mediaDir, relayImgDir, backupDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

  const settingsFile = path.join(dataDir, 'settings.json');
  const plannerFile = path.join(dataDir, 'planner.json');

  // ---------- small JSON file helpers ----------
  const readJsonFile = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } };
  function writeJsonAtomic(f, obj, mode) {
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode: mode || 0o644 });
    fs.renameSync(tmp, f);
  }

  const getSettings = () => readJsonFile(settingsFile, {});
  const igdb = new IgdbClient({ getCreds: () => { const s = getSettings(); return { clientId: (s.igdbClientId || '').trim(), clientSecret: (s.igdbClientSecret || '').trim() }; } });

  // ---------- relay (live sync controller -> OBS display) ----------
  const sseClients = new Set();
  function broadcast(data) {
    const line = 'data: ' + data + '\n\n';
    for (const res of sseClients) { try { res.write(line); } catch (e) { sseClients.delete(res); } }
  }

  // ---------- helpers ----------
  function readBody(req, limit) {
    return new Promise((resolve, reject) => {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  const safeKey = (k) => /^[A-Za-z0-9_.-]{1,100}$/.test(k) && !k.includes('..');

  // Cache an IGDB image on disk so covers/banners work offline (and in OBS) afterwards
  async function cacheImage(imageId, size, name) {
    if (!imageId) return null;
    const file = path.join(mediaDir, name);
    try {
      const r = await fetch(imageUrl(imageId, size));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return '/media/' + name;
    } catch (e) { return null; }
  }

  async function cacheAvatar(rawUrl) {
    if (!rawUrl) return '';
    let u; try { u = new URL(String(rawUrl)); } catch (e) { return ''; }
    const h = u.hostname.toLowerCase();
    const okHost = u.protocol === 'https:' && (h.endsWith('.ggpht.com') || h.endsWith('.googleusercontent.com'));
    if (!okHost) return '';
    try {
      const r = await fetch(u.href);
      if (!r.ok) return '';
      const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type] || 'jpg';
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 5 * 1024 * 1024) return '';
      const name = 'yt_channel_avatar.' + ext;
      fs.writeFileSync(path.join(mediaDir, name), buf);
      return '/media/' + name + '?v=' + Date.now();
    } catch (e) { return ''; }
  }

  // ---------- security: local only, same-origin only ----------
  function requestAllowed(req, port) {
    if (!lan) {
      const h = (req.headers.host || '').toLowerCase();
      if (h !== `127.0.0.1:${port}` && h !== `localhost:${port}`) return false;   // blocks DNS-rebinding tricks
    }
    const origin = req.headers.origin;
    if (origin && req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const o = new URL(origin);
        if (!lan && o.origin !== `http://127.0.0.1:${port}` && o.origin !== `http://localhost:${port}`) return false;
      } catch (e) { return false; }
    }
    return true;
  }

  function serveFile(res, file, extraHeaders) {
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      if (path.extname(file).toLowerCase() === '.html') {
        // pages carry {{VERSION}}, branding and linked YouTube channel tokens, filled in by the server so the top bar stays in sync
        return fs.readFile(file, 'utf8', (e, html) => {
          if (e) { res.writeHead(404); return res.end('not found'); }
          const st = getSettings();
          const ch = st.youtubeChannel || null;
          const escAttr = (v) => String(v || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
          const accent = /^#[0-9a-f]{6}$/i.test(st.accentColor || '') ? st.accentColor : '#e60000';
          const theme = ['default', 'isac', 'discord'].includes(st.theme) ? st.theme : 'default';
          const showHitList = st.showHitList !== false;
          const chLabel = (ch && (ch.handle || ch.title)) || '';
          const studioUrl = ch && ch.id ? 'https://studio.youtube.com/channel/' + encodeURIComponent(ch.id) : (chLabel ? 'https://studio.youtube.com/' : '');
          const chUrl = ch && ch.handle ? 'https://www.youtube.com/' + encodeURIComponent(ch.handle).replace('%40', '@') : (ch && ch.id ? 'https://www.youtube.com/channel/' + encodeURIComponent(ch.id) : '');
          const avSrc = (ch && ch.avatar && (/^(\/media\/|https:\/\/)/.test(ch.avatar))) ? ch.avatar : '';
          const initChar = (chLabel.replace(/^@/, '').charAt(0) || 'Y').toUpperCase();
          const avHtml = avSrc ? `<img src="${escAttr(avSrc)}" alt="">` : `<span class="sbar-av-init">${escAttr(initChar)}</span>`;
          const out = html
            .split('{{VERSION}}').join(require('../package.json').version)
            .split('{{ACCENT}}').join(accent)
            .split('{{THEME}}').join(theme)
            .split('{{HITLIST_HIDE}}').join(showHitList ? '' : 'hidden')
            .split('{{CHANNEL}}').join(escAttr(chLabel))
            .split('{{STUDIO_URL}}').join(escAttr(studioUrl))
            .split('{{STUDIO_HIDE}}').join(studioUrl ? '' : 'hidden')
            .split('{{CHANNEL_URL}}').join(escAttr(chUrl))
            .split('{{CHANNEL_HIDE}}').join(chUrl ? '' : 'hidden')
            .split('{{CHANNEL_AVATAR}}').join(avHtml);
          res.writeHead(200, Object.assign({ 'Content-Type': type }, extraHeaders || {}));
          res.end(out);
        });
      }
      res.writeHead(200, Object.assign({ 'Content-Type': type }, extraHeaders || {}));
      fs.createReadStream(file).pipe(res);
    });
  }

  function underDir(dir, rel) {
    const full = path.normalize(path.join(dir, rel));
    return full.startsWith(path.normalize(dir + path.sep)) ? full : null;
  }

  // ---------- the HTTP server ----------
  const server = http.createServer(async (req, res) => {
    const port = server.address() && server.address().port;
    if (!requestAllowed(req, port)) { res.writeHead(403); return res.end('forbidden'); }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const noStore = { 'Cache-Control': 'no-store' };

    try {
      // ----- pages -----
      if (p === '/' || p === '/planner') return serveFile(res, path.join(publicDir, 'planner.html'), noStore);
      if (p === '/mobile') return serveFile(res, path.join(publicDir, 'mobile.html'), noStore);
      if (p === '/hitlist') return serveFile(res, path.join(publicDir, 'hitlist.html'), noStore);

      if (p === '/api/info') return sendJson(res, 200, { version: require('../package.json').version });

      // ----- relay -----
      if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'text/plain', ...noStore }); return res.end('chl-relay'); }
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
        res.write('retry: 1000\n\n');
        sseClients.add(res);
        const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) { /* ignore */ } }, 15000);
        req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
        return;
      }
      if (p === '/api/send' && req.method === 'POST') {
        const body = (await readBody(req, 30 * 1024 * 1024)).toString('utf8');
        JSON.parse(body);
        broadcast(body);
        res.writeHead(204); return res.end();
      }
      if (p.startsWith('/api/img/')) {
        const key = decodeURIComponent(p.slice('/api/img/'.length));
        if (!safeKey(key)) { res.writeHead(400); return res.end('bad key'); }
        const file = path.join(relayImgDir, key);
        if (req.method === 'PUT') {
          const buf = await readBody(req, 30 * 1024 * 1024);
          fs.writeFileSync(file, buf);
          fs.writeFileSync(file + '.type', req.headers['content-type'] || 'application/octet-stream');
          res.writeHead(204); return res.end();
        }
        if (req.method === 'GET' && fs.existsSync(file)) {
          let type = 'application/octet-stream';
          try { type = fs.readFileSync(file + '.type', 'utf8'); } catch (e) { /* default */ }
          res.writeHead(200, { 'Content-Type': type, ...noStore });
          return fs.createReadStream(file).pipe(res);
        }
        res.writeHead(404); return res.end('not found');
      }

      // ----- cached IGDB media -----
      if (p.startsWith('/media/')) {
        const rel = decodeURIComponent(p.slice('/media/'.length));
        const full = safeKey(rel) ? underDir(mediaDir, rel) : null;
        if (!full) { res.writeHead(400); return res.end('bad path'); }
        return serveFile(res, full, { 'Cache-Control': 'public, max-age=86400' });
      }

      // ----- planner data -----
      if (p === '/api/planner') {
        if (req.method === 'GET') return sendJson(res, 200, readJsonFile(plannerFile, { version: 1, games: [] }));
        if (req.method === 'PUT') {
          const doc = JSON.parse((await readBody(req, 20 * 1024 * 1024)).toString('utf8'));
          if (!doc || typeof doc !== 'object' || !Array.isArray(doc.games)) return sendJson(res, 400, { error: 'Invalid planner data' });
          // one backup per day of the previous state, kept for safety
          try {
            if (fs.existsSync(plannerFile)) {
              const day = new Date().toISOString().slice(0, 10);
              const bk = path.join(backupDir, `planner-${day}.json`);
              if (!fs.existsSync(bk)) fs.copyFileSync(plannerFile, bk);
              const all = fs.readdirSync(backupDir).filter((f) => f.startsWith('planner-')).sort();
              while (all.length > 30) fs.unlinkSync(path.join(backupDir, all.shift()));
            }
          } catch (e) { /* backups are best effort */ }
          writeJsonAtomic(plannerFile, doc);
          return sendJson(res, 200, { ok: true });
        }
      }

      // ----- Hit List safety copy (the page keeps its live data in browser storage; this is the recoverable backup) -----
      if (p === '/api/hitlist-backup' && req.method === 'PUT') {
        const body = (await readBody(req, 30 * 1024 * 1024)).toString('utf8');
        const doc = JSON.parse(body);
        if (!doc || !Array.isArray(doc.list)) return sendJson(res, 400, { error: 'Invalid backup' });
        fs.writeFileSync(path.join(backupDir, 'hitlist-latest.json'), body);
        fs.writeFileSync(path.join(backupDir, `hitlist-${new Date().toISOString().slice(0, 10)}.json`), body);
        try {
          const all = fs.readdirSync(backupDir).filter((f) => /^hitlist-\d{4}-/.test(f)).sort();
          while (all.length > 30) fs.unlinkSync(path.join(backupDir, all.shift()));
        } catch (e) { /* best effort */ }
        res.writeHead(204); return res.end();
      }

      // ----- settings (the secret is write-only) -----
      if (p === '/api/settings') {
        if (req.method === 'GET') {
          const s = getSettings();
          return sendJson(res, 200, { igdbClientId: s.igdbClientId || '', igdbHasSecret: !!s.igdbClientSecret, igdbConfigured: !!(s.igdbClientId && s.igdbClientSecret), youtubeHasKey: !!s.youtubeApiKey, youtubeChannel: s.youtubeChannel || null, sgdbHasKey: !!s.sgdbApiKey, theme: ['default', 'isac', 'discord'].includes(s.theme) ? s.theme : 'default', accentColor: s.accentColor || '#e60000', showHitList: s.showHitList !== false, useScores: !!s.useScores });
        }
        if (req.method === 'PUT') {
          const b = JSON.parse((await readBody(req, 100 * 1024)).toString('utf8'));
          const s = getSettings();
          if (typeof b.igdbClientId === 'string') s.igdbClientId = b.igdbClientId.trim();
          if (typeof b.igdbClientSecret === 'string' && b.igdbClientSecret.trim()) s.igdbClientSecret = b.igdbClientSecret.trim();
          if (typeof b.youtubeApiKey === 'string' && b.youtubeApiKey.trim()) s.youtubeApiKey = b.youtubeApiKey.trim();
          if (typeof b.sgdbApiKey === 'string' && b.sgdbApiKey.trim()) s.sgdbApiKey = b.sgdbApiKey.trim();
          if (b.clearSgdb) delete s.sgdbApiKey;
          if (b.clearIgdb) { delete s.igdbClientId; delete s.igdbClientSecret; }
          if (b.clearYoutube) delete s.youtubeApiKey;
          if (b.clearYoutubeChannel) delete s.youtubeChannel;
          else if (b.youtubeChannel && typeof b.youtubeChannel === 'object') {
            const c = b.youtubeChannel;
            const parsed = parseChannelInput(c.handle || c.id || '');
            const id = /^UC[\w-]{22}$/.test(String(c.id || '')) ? String(c.id) : (parsed && parsed.id) || '';
            const rawH = String(c.handle || (parsed && parsed.handle) || '').trim().slice(0, 40);
            const handle = rawH ? (rawH.startsWith('@') ? rawH : '@' + rawH) : '';
            const title = String(c.title || '').trim().slice(0, 80);
            if (handle || id || title) {
              const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
              const av = typeof c.avatar === 'string' && /^(\/media\/|https:\/\/)/.test(c.avatar) ? c.avatar.slice(0, 400) : '';
              const up = typeof c.uploadsId === 'string' && /^[A-Za-z0-9_-]{10,60}$/.test(c.uploadsId) ? c.uploadsId : '';
              s.youtubeChannel = { id, handle, title, avatar: av, uploadsId: up, subscribers: num(c.subscribers), views: num(c.views), videos: num(c.videos), fetchedAt: num(c.fetchedAt) };
            }
          }
          if (typeof b.theme === 'string' && ['default', 'isac', 'discord'].includes(b.theme)) s.theme = b.theme;
          if (typeof b.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(b.accentColor.trim())) s.accentColor = b.accentColor.trim();
          if (typeof b.showHitList === 'boolean') s.showHitList = b.showHitList;
          if (typeof b.useScores === 'boolean') s.useScores = b.useScores;
          writeJsonAtomic(settingsFile, s, 0o600);
          igdb.reset();
          return sendJson(res, 200, { ok: true, igdbConfigured: !!(s.igdbClientId && s.igdbClientSecret) });
        }
      }

      // ----- SteamGridDB (poster / banner / logo artwork) -----
      if (p === '/api/sgdb/search' && req.method === 'GET') return sendJson(res, 200, { results: await sgdb.search(url.searchParams.get('q') || '', getSettings().sgdbApiKey) });
      if (p === '/api/sgdb/assets' && req.method === 'GET') return sendJson(res, 200, { items: await sgdb.assets(url.searchParams.get('kind'), url.searchParams.get('game'), getSettings().sgdbApiKey) });
      if (p === '/api/sgdb/pick' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 100 * 1024)).toString('utf8'));
        const img = await sgdb.download(b.url, b.kind, b.game);
        fs.writeFileSync(path.join(mediaDir, img.name), img.buf);
        return sendJson(res, 200, { path: '/media/' + img.name });
      }

      // ----- YouTube (public video & channel statistics) -----
      if (p === '/api/youtube/video' && req.method === 'GET') {
        const id = videoIdFrom(url.searchParams.get('id') || url.searchParams.get('url') || '');
        if (!id) return sendJson(res, 400, { error: 'That does not look like a YouTube video link.' });
        return sendJson(res, 200, await fetchVideo(id, getSettings().youtubeApiKey));
      }
      if (p === '/api/youtube/channel' && req.method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const ch = await fetchChannel(q, getSettings().youtubeApiKey);
        const cached = await cacheAvatar(ch.avatarUrl);
        ch.avatar = cached || ch.avatarUrl || '';
        delete ch.avatarUrl;
        return sendJson(res, 200, ch);
      }
      if (p === '/api/youtube/channel-videos' && req.method === 'GET') {
        const s = getSettings();
        if (!s.youtubeApiKey) return sendJson(res, 400, { error: 'Add a YouTube API key in Settings first.' });
        let ch = s.youtubeChannel;
        if (!ch || (!ch.id && !ch.handle)) return sendJson(res, 400, { error: 'Link your YouTube channel in Settings first.' });
        let uploadsId = ch.uploadsId || '';
        if (!uploadsId) {
          const fresh = await fetchChannel(ch.id || ch.handle, s.youtubeApiKey);
          uploadsId = fresh.uploadsId;
          ch.uploadsId = uploadsId;
          if (!ch.avatar && fresh.avatarUrl) ch.avatar = (await cacheAvatar(fresh.avatarUrl)) || fresh.avatarUrl;
          writeJsonAtomic(settingsFile, s, 0o600);
        }
        const videos = await fetchChannelVideos(uploadsId, s.youtubeApiKey, 50);
        return sendJson(res, 200, { videos });
      }

      // ----- IGDB -----
      if (p === '/api/igdb/test' && req.method === 'POST') return sendJson(res, 200, { steps: await igdb.test() });
      if (p === '/api/igdb/search' && req.method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2) return sendJson(res, 200, { results: [] });
        return sendJson(res, 200, { results: await igdb.search(q) });
      }
      if (p.startsWith('/api/igdb/game/') && req.method === 'GET') {
        const id = parseInt(p.slice('/api/igdb/game/'.length), 10);
        const d = await igdb.detail(id);
        const g = d.game;
        const [cover, banner] = await Promise.all([
          cacheImage(g.coverId, 't_cover_big', `igdb_${id}_cover.jpg`),
          cacheImage(g.bannerId, 't_1080p', `igdb_${id}_banner.jpg`)
        ]);
        if (g.coverId && !cover) d.warnings.push('Cover image could not be downloaded.');
        return sendJson(res, 200, { game: { ...g, cover, banner }, ttb: d.ttb, warnings: d.warnings });
      }

      // ----- static files -----
      if (req.method === 'GET') {
        const rel = decodeURIComponent(p.slice(1));
        const full = underDir(publicDir, rel);
        if (full) return serveFile(res, full, noStore);
      }
      res.writeHead(404); res.end('not found');
    } catch (e) {
      if (e instanceof IgdbError || e instanceof YoutubeError || e instanceof sgdb.SgdbError) return sendJson(res, e.status, { error: e.message });
      if (!res.headersSent) sendJson(res, 400, { error: e.message || 'bad request' });
    }
  });

  return new Promise((resolve, reject) => {
    // The port is fixed on purpose: the Hit List's saved data is tied to this address, so a silent switch to another port would make it look empty.
    const port = preferredPort;
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') reject(new Error(`Port ${port} is already in use. Is Critical Hit Studio (or the older chl-server) already running? Close it and try again.`));
      else reject(err);
    });
    server.on('listening', () => resolve({ port: server.address().port, host, server, close: () => new Promise((r) => { for (const c of sseClients) { try { c.end(); } catch (e) { /* ignore */ } } server.close(r); }) }));
    server.listen(port, host);
  });
}

module.exports = { startServer };

// Standalone mode: node server/server.js
if (require.main === module) {
  const os = require('os');
  const dataDir = process.env.CHL_DATA_DIR || path.join(os.homedir(), '.critical-hit-studio');
  startServer({ dataDir, port: parseInt(process.env.PORT, 10) || 8787, lan: process.env.CHL_LAN === '1' }).then((s) => {
    console.log('\n  Critical Hit Studio is running');
    console.log('  App:               http://localhost:' + s.port + '/');
    console.log('  OBS Browser Source: http://localhost:' + s.port + '/hitlist?display=1');
    console.log('  Data folder:        ' + dataDir + '\n');
  }).catch((e) => { console.error('Could not start:', e.message); process.exit(1); });
}
