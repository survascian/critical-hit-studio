'use strict';
// Stand-in for Twitch auth + IGDB + IGDB image CDN, shaped like the real responses. For tests only.
const http = require('http');
const PNG = require('fs').readFileSync(require('path').join(__dirname, 'cover.png'));
const GAMES = [
  { id: 119133, name: 'Elden Ring', slug: 'elden-ring', summary: 'A big open-world action RPG.', first_release_date: 1645747200, hypes: 410, follows: 12000, total_rating: 95.4,
    cover: { id: 1, image_id: 'co4jni' }, artworks: [{ id: 5, image_id: 'ar9wide' }], screenshots: [{ id: 6, image_id: 'sc1shot' }],
    involved_companies: [{ developer: true, publisher: false, company: { name: 'FromSoftware' } }, { developer: false, publisher: true, company: { name: 'Bandai Namco' } }],
    genres: [{ name: 'Role-playing (RPG)' }, { name: 'Adventure' }], platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'PlayStation 5' }] },
  { id: 40000, name: 'Hades II', slug: 'hades-ii', summary: 'The sequel.', first_release_date: 1715644800, hypes: 900, follows: 300, total_rating: 92,
    cover: { id: 2, image_id: 'co7hd2' }, screenshots: [{ id: 7, image_id: 'sc2shot' }],
    involved_companies: [{ developer: true, publisher: true, company: { name: 'Supergiant Games' } }],
    genres: [{ name: 'Roguelike' }], platforms: [{ name: 'PC (Microsoft Windows)' }] },
  { id: 1943, name: 'Resident Evil 4', slug: 'resident-evil-4', summary: 'Survival horror.', first_release_date: 1107216000, hypes: 5, follows: 900, total_rating: 93,
    cover: { id: 3, image_id: 'co1re4' }, screenshots: [{ id: 8, image_id: 'sc3shot' }],
    involved_companies: [{ developer: true, publisher: true, company: { name: 'Capcom' } }],
    genres: [{ name: 'Shooter' }, { name: 'Adventure' }], themes: [{ name: 'Action' }, { name: 'Horror' }, { name: 'Survival' }], platforms: [{ name: 'PlayStation 2' }, { name: 'PC (Microsoft Windows)' }] },
  { id: 1944, name: 'Resident Evil Village', slug: 'resident-evil-village', summary: 'More survival horror.', first_release_date: 1620345600, hypes: 50, follows: 2000, total_rating: 88,
    cover: { id: 4, image_id: 'co1rev' }, screenshots: [{ id: 9, image_id: 'sc4shot' }],
    involved_companies: [{ developer: true, publisher: true, company: { name: 'Capcom' } }],
    genres: [{ name: 'Shooter' }, { name: 'Adventure' }], themes: [{ name: 'Action' }, { name: 'Horror' }, { name: 'Survival' }], platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'PlayStation 5' }, { name: 'Xbox Series X|S' }] },
  { id: 777, name: 'Unreleased Mystery "Game"', slug: 'mystery', hypes: 77, involved_companies: [], genres: [], platforms: [] }
];
let log = [];
function start(port, creds) {
  const srv = http.createServer((req, res) => {
    const chunks = []; req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url, 'http://x');
      log.push(req.method + ' ' + url.pathname);
      const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (url.pathname === '/oauth2/token') {
        const f = new URLSearchParams(body);
        if (f.get('client_id') === creds.id && f.get('client_secret') === creds.secret && f.get('grant_type') === 'client_credentials') return json(200, { access_token: 'tok-' + Date.now(), expires_in: 3600, token_type: 'bearer' });
        return json(400, { status: 400, message: 'invalid client secret' });
      }
      if (url.pathname.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); return res.end(PNG); }
      if (!/^Bearer tok-/.test(req.headers.authorization || '') || req.headers['client-id'] !== creds.id) return json(401, { message: 'Authorization Failure' });
      if (url.pathname === '/v4/games') {
        const m = /^search "((?:[^"\\]|\\.)*)"/.exec(body);
        if (m) { const q = m[1].toLowerCase(); return json(200, GAMES.filter((g) => g.name.toLowerCase().includes(q) || q === 'zelda').slice(0, 12)); }
        if (process.env.FAKE_NO_THEMES && body.includes('themes.name')) return json(400, { message: 'Invalid field themes.name' });
        const w = /where id = (\d+)/.exec(body);
        if (w) return json(200, GAMES.filter((g) => g.id === +w[1]).map((g) => { if (!body.includes('themes.name')) { const c = { ...g }; delete c.themes; return c; } return g; }));   // only return themes when they were asked for
        return json(200, []);
      }
      if (url.pathname === '/v4/game_time_to_beats') {
        const w = /where game_id = (\d+)/.exec(body);
        if (w && +w[1] === 119133) return json(200, [{ id: 1, game_id: 119133, hastily: 148000, normally: 238000, completely: 360000, count: 55 }]);
        if (w && process.env.FAKE_TTB_FAIL) return json(400, { message: 'boom' });
        return json(200, w ? [] : [{ id: 1, game_id: 1, normally: 1 }]);
      }
      json(404, { message: 'not found' });
    });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, log: () => log })));
}
module.exports = { start };
if (require.main === module) start(parseInt(process.env.FAKE_PORT || '9301', 10), { id: 'cid', secret: 'sec' }).then(() => console.log('fake igdb up'));

// Stand-in for the YouTube Data API v3 (videos.list, channels.list, playlistItems.list), for tests only
module.exports.startYoutube = function (port, key) {
  const srv = require('http').createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.searchParams.get('key') !== key) return json(400, { error: { message: 'API key not valid. Please pass a valid API key.' } });
    if (url.pathname === '/videos') {
      if (url.searchParams.get('id') === 'AAAAAAAAAAA') return json(200, { items: [] });
      return json(200, { items: [{ id: url.searchParams.get('id'), snippet: { title: 'Elden Ring Review', channelTitle: 'Alan', publishedAt: '2026-11-10T09:00:00Z' }, statistics: { viewCount: '12345', likeCount: '987', commentCount: '45' } }] });
    }
    if (url.pathname === '/channels') {
      const h = (url.searchParams.get('forHandle') || '').toLowerCase();
      const cid = url.searchParams.get('id') || '';
      if (h === 'missingchannel' || cid === 'UC0000000000000000000000') return json(200, { items: [] });
      return json(200, {
        items: [{
          id: cid || 'UC1234567890123456789012',
          snippet: { title: 'Survascian', customUrl: '@Survascian', thumbnails: { medium: { url: 'https://yt3.ggpht.com/avatar.jpg' } } },
          statistics: { subscriberCount: '42000', viewCount: '1500000', videoCount: '87' },
          contentDetails: { relatedPlaylists: { uploads: 'UU1234567890123456789012' } }
        }]
      });
    }
    if (url.pathname === '/playlistItems') {
      const pid = url.searchParams.get('playlistId');
      if (pid === 'UU_EMPTY') return json(200, { items: [] });
      const max = parseInt(url.searchParams.get('maxResults') || '50', 10);
      const items = [
        { snippet: { title: 'Elden Ring Supercut', publishedAt: '2026-11-10T09:00:00Z', resourceId: { videoId: 'abcDEFghi12' } } },
        { snippet: { title: 'Hades II Critical Bite', publishedAt: '2026-11-01T12:00:00Z', resourceId: { videoId: 'xyz98765432' } } }
      ].slice(0, max);
      return json(200, { items });
    }
    return json(404, {});
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv })));
};

// Stand-in for the SteamGridDB API v2, for tests only
module.exports.startSgdb = function (port, key) {
  const http = require('http');
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const base = 'http://127.0.0.1:' + port;
    if (url.pathname.startsWith('/img/')) { res.writeHead(200, { 'Content-Type': url.pathname.includes('bad') ? 'text/plain' : 'image/png' }); return res.end(url.pathname.includes('bad') ? 'not an image' : PNG); }
    if (req.headers.authorization !== 'Bearer ' + key) return json(401, { success: false, errors: ['Unauthorized'] });
    let m;
    if ((m = /^\/search\/autocomplete\/(.+)$/.exec(url.pathname))) {
      const t = decodeURIComponent(m[1]).toLowerCase();
      if (t.includes('nothing')) return json(200, { success: true, data: [] });
      return json(200, { success: true, data: [{ id: 5001, name: 'Resident Evil 4', verified: true, types: ['steam'] }, { id: 5002, name: 'Resident Evil 4 (2023)', verified: false }] });
    }
    if ((m = /^\/(grids|heroes|logos)\/game\/(\d+)$/.exec(url.pathname))) {
      if (process.env.FAKE_SGDB_NO_FILTER && [...url.searchParams.keys()].length) return json(400, { success: false, errors: ['bad filter'] });
      if (+m[2] === 9999) return json(404, { success: false, errors: ['Game not found'] });
      const mk = (i, score, w, h) => ({ id: i, score, style: i % 2 ? 'alternate' : 'material', width: w, height: h, url: `${base}/img/${m[1]}-${i}.png`, thumb: `${base}/img/${m[1]}-${i}-t.png`, author: { name: 'user' + i } });
      const items = m[1] === 'grids' ? [mk(1, 2, 600, 900), mk(2, 9, 600, 900), mk(3, 5, 920, 430)] : m[1] === 'heroes' ? [mk(4, 1, 1920, 620), mk(5, 7, 1920, 620)] : [mk(6, 3, 800, 400)];
      return json(200, { success: true, page: 0, total: items.length, limit: 50, data: items });
    }
    json(404, { success: false });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv })));
};
