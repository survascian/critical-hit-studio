'use strict';
// Minimal IGDB client (Twitch client-credentials auth). No dependencies; uses the global fetch (Node 18+).
// Base URLs can be overridden by env vars so the whole flow can be tested against a fake server.

const TWITCH_TOKEN_URL = process.env.CHL_TWITCH_URL || 'https://id.twitch.tv/oauth2/token';
const IGDB_BASE = process.env.CHL_IGDB_URL || 'https://api.igdb.com/v4';
const IMG_BASE = process.env.CHL_IMG_URL || 'https://images.igdb.com/igdb/image/upload';

const GENRES = require('../public/genres.js');   // shared with the Planner: decides which genre comes first

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class IgdbError extends Error {
  constructor(message, status) { super(message); this.status = status || 502; }
}

// ---- normalisation helpers ----
// Quotes/backslashes/semicolons can't be escaped reliably in IGDB's query language, so they are dropped: typed text can never alter the query
const qstr = (s) => String(s).replace(/["\\;\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const uniq = (a) => [...new Set(a.filter(Boolean))];
const names = (a) => uniq((a || []).map((x) => x && x.name));
const toIsoDate = (sec) => (typeof sec === 'number' ? new Date(sec * 1000).toISOString().slice(0, 10) : null);
const toHours = (sec) => (typeof sec === 'number' && sec > 0 ? Math.round(sec / 360) / 10 : null); // seconds -> hours, 1 decimal

function companiesBy(ic, flag) {
  return uniq((ic || []).filter((x) => x && x[flag] && x.company).map((x) => x.company.name));
}

function normalizeGame(g) {
  const developers = companiesBy(g.involved_companies, 'developer');
  const publishers = companiesBy(g.involved_companies, 'publisher');
  const art = (g.artworks && g.artworks[0]) || (g.screenshots && g.screenshots[0]) || null;
  return {
    igdbId: g.id,
    name: g.name || '',
    slug: g.slug || '',
    summary: g.summary || '',
    releaseDate: toIsoDate(g.first_release_date),
    developers: developers.length ? developers : uniq((g.involved_companies || []).map((x) => x && x.company && x.company.name)).slice(0, 1),
    publishers,
    genres: GENRES.order(names(g.genres), names(g.themes)),   // ordered: defining theme (Horror...) first, then specific-to-generic gameplay genres
    igdbGenres: names(g.genres),
    igdbThemes: names(g.themes),
    platforms: names(g.platforms),
    hypes: typeof g.hypes === 'number' ? g.hypes : null,
    follows: typeof g.follows === 'number' ? g.follows : null,
    rating: typeof g.total_rating === 'number' ? Math.round(g.total_rating) : (typeof g.rating === 'number' ? Math.round(g.rating) : null),
    coverId: (g.cover && g.cover.image_id) || null,
    bannerId: (art && art.image_id) || null
  };
}

function normalizeTtb(t) {
  if (!t) return null;
  const o = { hastily: toHours(t.hastily), normally: toHours(t.normally), completely: toHours(t.completely), count: typeof t.count === 'number' ? t.count : null };
  return (o.hastily || o.normally || o.completely) ? o : null;
}

const imageUrl = (imageId, size) => `${IMG_BASE}/${size}/${imageId}.jpg`;

class IgdbClient {
  constructor(opts) {
    this.getCreds = opts.getCreds;
    this.token = null; this.tokenExp = 0; this.tokenFor = '';
    this.lastCall = 0; this.chain = Promise.resolve();
  }

  reset() { this.token = null; this.tokenExp = 0; this.tokenFor = ''; }

  async getToken(force) {
    const { clientId, clientSecret } = this.getCreds();
    if (!clientId || !clientSecret) throw new IgdbError('IGDB is not set up yet. Add your Twitch Client ID and Secret in Settings.', 400);
    const key = clientId + ':' + clientSecret.length;
    if (!force && this.token && this.tokenFor === key && Date.now() < this.tokenExp - 60000) return this.token;
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' });
    let r;
    try { r = await fetch(TWITCH_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }); }
    catch (e) { throw new IgdbError('Could not reach Twitch to sign in (' + e.message + '). Check your internet connection.', 502); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new IgdbError('Twitch rejected the Client ID / Secret' + (j.message ? ' (' + j.message + ')' : '') + '.', 401);
    this.token = j.access_token; this.tokenFor = key; this.tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
    return this.token;
  }

  // IGDB allows ~4 requests/second: serialise calls and keep them >= 260 ms apart
  _throttle() {
    const run = this.chain.then(async () => {
      const wait = this.lastCall + 260 - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastCall = Date.now();
    });
    this.chain = run.catch(() => {});
    return run;
  }

  async query(endpoint, body, retry = true) {
    await this._throttle();
    const token = await this.getToken(false);
    const { clientId } = this.getCreds();
    let r;
    try {
      r = await fetch(`${IGDB_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Client-ID': clientId, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Content-Type': 'text/plain' },
        body
      });
    } catch (e) { throw new IgdbError('Could not reach IGDB (' + e.message + ').', 502); }
    if (r.status === 401 && retry) { await this.getToken(true); return this.query(endpoint, body, false); }
    if (r.status === 429) throw new IgdbError('IGDB rate limit reached. Wait a moment and try again.', 429);
    const text = await r.text();
    if (!r.ok) throw new IgdbError(`IGDB /${endpoint} failed (${r.status}): ${text.slice(0, 200)}`, 502);
    try { return JSON.parse(text); } catch (e) { throw new IgdbError(`IGDB /${endpoint} returned something that is not JSON.`, 502); }
  }

  async search(q) {
    const rows = await this.query('games',
      `search "${qstr(q)}"; fields name,slug,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name,platforms.name,genres.name,hypes; limit 12;`);
    return rows.map((g) => {
      const n = normalizeGame(g);
      return { igdbId: n.igdbId, name: n.name, releaseDate: n.releaseDate, developers: n.developers, genres: n.genres, platforms: n.platforms, hypes: n.hypes, coverUrl: n.coverId ? imageUrl(n.coverId, 't_cover_small') : null };
    });
  }

  // Full details. Time-to-beat is fetched separately and is allowed to fail without losing the rest.
  async detail(id) {
    const gid = parseInt(id, 10);
    if (!gid) throw new IgdbError('Bad game id', 400);
    const base = 'name,slug,summary,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,genres.name,platforms.name,hypes,follows,total_rating';
    let rows;
    try { rows = await this.query('games', `fields ${base},themes.name; where id = ${gid};`); }
    catch (e) {
      // if IGDB ever rejects the themes field, still return the game (genres only) instead of failing the whole lookup
      if (!(e instanceof IgdbError) || !/\(400\)/.test(e.message)) throw e;
      rows = await this.query('games', `fields ${base}; where id = ${gid};`);
    }
    if (!rows.length) throw new IgdbError('IGDB has no game with that id.', 404);
    const game = normalizeGame(rows[0]);
    const warnings = [];
    let ttb = null;
    try {
      const t = await this.query('game_time_to_beats', `fields hastily,normally,completely,count,game_id; where game_id = ${gid};`);
      ttb = normalizeTtb(t[0]);
    } catch (e) { warnings.push('Time to beat unavailable: ' + e.message); }
    return { game, ttb, warnings };
  }

  // Upcoming hype (next ~120 days) and trending recent releases (last ~45 days)
  async radar() {
    const now = Math.floor(Date.now() / 1000);
    const fields = 'name,slug,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name,platforms.name,genres.name,hypes,total_rating';
    const mapRow = (g) => {
      const n = normalizeGame(g);
      return {
        igdbId: n.igdbId,
        name: n.name,
        releaseDate: n.releaseDate,
        developers: n.developers,
        genres: n.genres,
        platforms: n.platforms,
        hypes: n.hypes,
        rating: n.rating,
        coverUrl: n.coverId ? imageUrl(n.coverId, 't_cover_big') : null
      };
    };
    const upRows = await this.query('games',
      `fields ${fields}; where first_release_date >= ${now} & first_release_date <= ${now + 120 * 86400} & hypes != null & version_parent = null; sort hypes desc; limit 24;`);
    const trRows = await this.query('games',
      `fields ${fields}; where first_release_date >= ${now - 45 * 86400} & first_release_date <= ${now} & (hypes != null | total_rating_count != null) & version_parent = null; sort hypes desc; limit 24;`);
    return { upcoming: (upRows || []).map(mapRow), trending: (trRows || []).map(mapRow), fetchedAt: Date.now() };
  }

  // Step-by-step diagnostic so a failure points at the exact piece that is wrong
  async test() {
    const steps = [];
    const run = async (name, fn) => {
      try { const detail = await fn(); steps.push({ name, ok: true, detail: detail || '' }); return true; }
      catch (e) { steps.push({ name, ok: false, detail: e.message }); return false; }
    };
    if (!(await run('Sign in to Twitch', async () => { await this.getToken(true); return 'Token received'; }))) return steps;
    let id = null;
    await run('Search games', async () => { const r = await this.search('zelda'); if (!r.length) throw new Error('No results'); id = r[0].igdbId; return `${r.length} results (e.g. ${r[0].name})`; });
    if (id) {
      await run('Game details (companies, genres, hype, artwork)', async () => { const d = await this.detail(id); return d.game.name + (d.warnings.length ? '' : ''); });
      await run('Time to beat', async () => { const t = await this.query('game_time_to_beats', `fields hastily,normally,completely,count,game_id; limit 1;`); return t.length ? 'OK' : 'Endpoint reachable (no data returned)'; });
    }
    return steps;
  }
}

module.exports = { IgdbClient, IgdbError, normalizeGame, normalizeTtb, imageUrl, IMG_BASE };
