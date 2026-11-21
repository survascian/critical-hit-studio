'use strict';
// SteamGridDB (steamgriddb.com) client: finds a game, lists poster / banner / logo artwork, and downloads the one you pick.
// Auth is a Bearer API key. The base URL can be overridden by an env var so it can be tested against a fake server.
const crypto = require('crypto');
const SGDB_BASE = process.env.CHL_SGDB_URL || 'https://www.steamgriddb.com/api/v2';

class SgdbError extends Error { constructor(message, status) { super(message); this.status = status || 502; } }

const KINDS = { grid: 'grids', hero: 'heroes', logo: 'logos' };        // grid = poster, hero = wide banner
const POSTER_SIZES = '600x900,342x482,660x930';                          // SteamGridDB's portrait sizes

async function call(pathAndQuery, key) {
  if (!key) throw new SgdbError('No SteamGridDB API key yet. Add one in Settings.', 400);
  let r;
  try { r = await fetch(SGDB_BASE + pathAndQuery, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } }); }
  catch (e) { throw new SgdbError('Could not reach SteamGridDB (' + e.message + ').', 502); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new SgdbError('SteamGridDB rejected the API key. Check it in Settings.', 400);
  if (r.status === 404) return { success: true, data: [] };
  if (!r.ok || j.success === false) {
    const msg = (j.errors && j.errors[0]) || j.error || ('HTTP ' + r.status);
    const e = new SgdbError('SteamGridDB said: ' + String(msg).slice(0, 160), r.status === 400 ? 400 : 502); e.badRequest = r.status === 400; throw e;
  }
  return j;
}

const clean = (s) => String(s || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 120);

async function search(term, key) {
  const t = clean(term); if (t.length < 2) return [];
  const j = await call('/search/autocomplete/' + encodeURIComponent(t), key);
  return (j.data || []).slice(0, 12).map((g) => ({ id: g.id, name: g.name, verified: !!g.verified }));
}

function normalize(it) {
  return { id: it.id, url: it.url, thumb: it.thumb || it.url, score: typeof it.score === 'number' ? it.score : 0, style: it.style || '',
    width: it.width || null, height: it.height || null, mime: it.mime || '', author: (it.author && it.author.name) || '' };
}

async function assets(kind, gameId, key) {
  const seg = KINDS[kind]; const gid = parseInt(gameId, 10);
  if (!seg || !gid) throw new SgdbError('Bad artwork request.', 400);
  // Ask for sensible sizes first; if SteamGridDB rejects a filter, retry with none rather than failing
  const q = kind === 'grid' ? `?dimensions=${POSTER_SIZES}&nsfw=false&humor=false` : '?nsfw=false&humor=false';
  let j;
  try { j = await call(`/${seg}/game/${gid}${q}`, key); }
  catch (e) { if (!e.badRequest) throw e; j = await call(`/${seg}/game/${gid}`, key); }
  let list = (j.data || []).filter((x) => x && /^https:\/\//.test(x.url || '') || (x && process.env.CHL_SGDB_URL)).map(normalize);
  if (kind === 'grid') { const portrait = list.filter((x) => !x.width || !x.height || x.height > x.width); if (portrait.length) list = portrait; }
  return list.sort((a, b) => b.score - a.score).slice(0, 40);
}

function hostAllowed(u) {
  const h = u.hostname.toLowerCase();
  if (process.env.CHL_SGDB_URL) { try { if (new URL(process.env.CHL_SGDB_URL).host === u.host) return true; } catch (e) { /* fall through */ } }   // test mode
  return u.protocol === 'https:' && (h === 'steamgriddb.com' || h.endsWith('.steamgriddb.com'));
}

// Downloads one picked image. Only steamgriddb.com hosts and real image types are accepted, and the size is capped.
async function download(url, kind, gameId) {
  let u; try { u = new URL(String(url)); } catch (e) { throw new SgdbError('Bad image address.', 400); }
  if (!hostAllowed(u)) throw new SgdbError('Only steamgriddb.com images can be used.', 400);
  let r;
  try { r = await fetch(u.href); } catch (e) { throw new SgdbError('Could not download the image (' + e.message + ').', 502); }
  if (!r.ok) throw new SgdbError('SteamGridDB image download failed (HTTP ' + r.status + ').', 502);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[type];
  if (!ext) throw new SgdbError('That file is not a usable image (' + (type || 'unknown type') + ').', 502);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new SgdbError('That image is larger than 15 MB.', 502);
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  return { name: `sgdb_${KINDS[kind] ? kind : 'img'}_${parseInt(gameId, 10) || 0}_${hash}.${ext}`, buf };
}

module.exports = { search, assets, download, SgdbError, KINDS };
