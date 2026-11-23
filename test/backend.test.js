'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const fake = require('./fake-igdb');
(async () => {
  const F = await fake.start(9301, { id: 'cid', secret: 'sec' });
  process.env.CHL_TWITCH_URL = 'http://127.0.0.1:9301/oauth2/token';
  process.env.CHL_IGDB_URL = 'http://127.0.0.1:9301/v4';
  process.env.CHL_IMG_URL = 'http://127.0.0.1:9301/img';
  const { startServer } = require('../server/server');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chl-'));
  const s = await startServer({ dataDir: dir, port: 8801 });
  const base = 'http://127.0.0.1:' + s.port;
  let fails = 0;
  const ok = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
  const j = async (p, init) => { const r = await fetch(base + p, init); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t; } return { status: r.status, body: b }; };
  const put = (p, o) => j(p, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

  let r = await j('/api/igdb/search?q=elden');
  ok('search before setup -> clear 400 message', r.status === 400 && /not set up/i.test(r.body.error), r.body.error);
  r = await put('/api/settings', { igdbClientId: 'cid', igdbClientSecret: 'WRONG' });
  r = await j('/api/igdb/test', { method: 'POST' });
  ok('wrong secret -> test fails at sign-in step', r.body.steps[0].ok === false, r.body.steps[0].detail);
  r = await put('/api/settings', { igdbClientId: 'cid', igdbClientSecret: 'sec' });
  r = await j('/api/settings');
  ok('settings never return the secret', r.body.igdbConfigured && r.body.igdbHasSecret && !JSON.stringify(r.body).includes('sec"'), JSON.stringify(r.body));
  ok('secret file is private', process.platform === 'win32' ? fs.existsSync(path.join(dir, 'settings.json')) : (fs.statSync(path.join(dir, 'settings.json')).mode & 0o077) === 0);

  // theme, branding, toggles & YouTube channel persistence + server-side HTML injection
  r = await put('/api/settings', { theme: 'isac', accentColor: '#ff7700', showHitList: false, useScores: true, youtubeChannel: { id: 'UC1234567890123456789012', handle: '@Survascian', title: 'Survascian', subscribers: 42000 } });
  ok('settings theme/branding saved', r.status === 200);
  r = await j('/api/settings');
  ok('settings theme/branding round-trips', r.body.theme === 'isac' && r.body.accentColor === '#ff7700' && r.body.showHitList === false && r.body.useScores === true && r.body.youtubeChannel && r.body.youtubeChannel.handle === '@Survascian', JSON.stringify(r.body));
  // invalid theme and accent should be ignored
  await put('/api/settings', { theme: 'bogus', accentColor: 'not-a-color' });
  r = await j('/api/settings');
  ok('invalid theme/accent ignored', r.body.theme === 'isac' && r.body.accentColor === '#ff7700');
  const plannerHtml = await (await fetch(base + '/planner')).text();
  ok('planner HTML injects theme, accent, channel & hitlist hide', plannerHtml.includes('data-theme="isac"') && plannerHtml.includes('#ff7700') && plannerHtml.includes('@Survascian') && plannerHtml.includes('studio.youtube.com/channel/UC1234567890123456789012'));
  const hitlistHtml = await (await fetch(base + '/hitlist')).text();
  ok('hitlist HTML injects data-theme and keeps data-page="hitlist"', hitlistHtml.includes('data-theme="isac"') && hitlistHtml.includes('data-page="hitlist"'));
  const mobileHtml = await (await fetch(base + '/mobile')).text();
  ok('mobile HTML serves and injects accent & version', mobileHtml.includes('#ff7700') && mobileHtml.includes('/mobile.js') && !mobileHtml.includes('{{VERSION}}'));
  // reset back to defaults for cleanliness
  await put('/api/settings', { theme: 'default', accentColor: '#e60000', showHitList: true, useScores: false, clearYoutubeChannel: true });
  r = await j('/api/settings');
  ok('clearYoutubeChannel removes channel', r.body.youtubeChannel === null && r.body.theme === 'default');
  r = await j('/api/igdb/test', { method: 'POST' });
  ok('diagnostic: all steps pass', r.body.steps.every((x) => x.ok), r.body.steps.map((x) => x.name + ':' + x.ok).join(', '));
  r = await j('/api/igdb/search?q=elden');
  ok('search returns normalised result', r.body.results.length === 1 && r.body.results[0].developers[0] === 'FromSoftware' && r.body.results[0].releaseDate === '2022-02-25' && /t_cover_small/.test(r.body.results[0].coverUrl), JSON.stringify(r.body.results[0]));
  r = await j('/api/igdb/search?q=' + encodeURIComponent('Mystery "Game"'));
  ok('search text with quotes/semicolons cannot break the query', r.status === 200 && Array.isArray(r.body.results));
  r = await j('/api/igdb/search?q=' + encodeURIComponent('x"; fields *; where id = 1; "'));
  ok('injection attempt stays a plain search', r.status === 200);
  r = await j('/api/igdb/game/119133');
  const g = r.body.game;
  ok('detail: studio/publisher/genres/platforms/hype/rating', g.developers[0] === 'FromSoftware' && g.publishers[0] === 'Bandai Namco' && g.genres.length === 2 && g.platforms.length === 2 && g.hypes === 410 && g.follows === 12000 && g.rating === 95, JSON.stringify({ d: g.developers, h: g.hypes, r: g.rating }));
  ok('detail: time to beat in hours', r.body.ttb && r.body.ttb.hastily === 41.1 && r.body.ttb.normally === 66.1 && r.body.ttb.completely === 100, JSON.stringify(r.body.ttb));
  ok('detail: images cached locally', g.cover === '/media/igdb_119133_cover.jpg' && g.banner === '/media/igdb_119133_banner.jpg', g.cover + ' ' + g.banner);
  const img = await fetch(base + g.banner);
  ok('cached banner is served', img.status === 200 && /image/.test(img.headers.get('content-type')));
  r = await j('/api/igdb/game/40000');
  ok('detail without artwork falls back to screenshot, no ttb is not an error', r.status === 200 && r.body.game.banner && r.body.ttb === null);
  r = await j('/api/igdb/game/777');
  ok('sparse game (no companies/cover) still works', r.status === 200 && r.body.game.developers.length === 0 && r.body.game.cover === null, JSON.stringify(r.body.warnings));
  r = await j('/api/igdb/game/424242');
  ok('unknown game -> 404 message', r.status === 404);

  // planner persistence + backup
  r = await j('/api/planner');
  ok('planner starts empty', r.body.games.length === 0);
  r = await put('/api/planner', { version: 1, games: [{ id: 'a', name: 'X', stage: 'Planned' }] });
  r = await put('/api/planner', { version: 1, games: [{ id: 'a', name: 'X', stage: 'Editing' }] });
  r = await j('/api/planner');
  ok('planner round-trips', r.body.games[0].stage === 'Editing');
  ok('daily backup created', fs.readdirSync(path.join(dir, 'backups')).some((f) => f.startsWith('planner-')));
  r = await put('/api/planner', { nope: 1 });
  ok('invalid planner doc rejected', r.status === 400);

  // relay + security
  r = await j('/api/ping');
  ok('relay ping', r.body === 'chl-relay');
  let rr = await fetch(base + '/api/settings', { headers: { Host: 'evil.example.com' } }).catch(() => null);
  const evil = await new Promise((res) => { const q = require('http').request({ host: '127.0.0.1', port: s.port, path: '/api/settings', headers: { Host: 'evil.example.com' } }, (x) => res(x.statusCode)); q.end(); });
  ok('foreign Host header (DNS rebinding) rejected', evil === 403, String(evil));
  rr = await fetch(base + '/api/planner', { method: 'PUT', headers: { Origin: 'https://evil.example.com', 'Content-Type': 'application/json' }, body: '{"games":[]}' });
  ok('cross-site write rejected', rr.status === 403, String(rr.status));
  rr = await fetch(base + '/api/planner', { method: 'PUT', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: '{"games":[]}' });
  ok('other localhost port write rejected', rr.status === 403, String(rr.status));
  rr = await fetch(base + '/media/..%2Fsettings.json');
  ok('path traversal blocked', rr.status === 400 || rr.status === 404, String(rr.status));
  rr = await fetch(base + '/api/img/..%2F..%2Fx', { method: 'PUT', body: 'x' });
  ok('relay image key traversal blocked', rr.status === 400);

  // thumbnail upload + updater helpers
  const pngBuf = fs.readFileSync(path.join(__dirname, 'cover.png'));
  const upOk = await fetch(base + '/api/thumb/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: pngBuf });
  const upBody = await upOk.json();
  ok('thumbnail upload saves under /media/', upOk.status === 200 && /^\/media\/thumb_[0-9a-f]+\.png$/.test(upBody.path), JSON.stringify(upBody));
  const upBad = await fetch(base + '/api/thumb/upload', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'nope' });
  ok('thumbnail upload rejects non-images', upBad.status === 400, String(upBad.status));
  const upd = require('../server/updater');
  ok('updater semver compare works', upd.compareSemver('2.2.0', '2.1.0') === 1 && upd.compareSemver('2.2.0', '2.2.0') === 0 && upd.compareSemver('2.1.9', '2.2.0') === -1);
  ok('updater download URL & filename allowlist', upd.isAllowedDownloadUrl('https://github.com/survascian/critical-hit-studio/releases/download/v2.2.0/Critical-Hit-Studio-2.2.0-win-setup.exe') && !upd.isAllowedDownloadUrl('https://evil.com/x.exe') && !!upd.safeInstallerName('Critical-Hit-Studio-2.2.0-win-setup.exe') && !upd.safeInstallerName('../evil.exe'));

  // token reuse: only one token request for many calls
  const tokenCalls = F.log().filter((l) => l.includes('/oauth2/token')).length;
  console.log('token requests so far:', tokenCalls);
  await s.close(); F.srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
