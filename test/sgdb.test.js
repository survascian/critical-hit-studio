'use strict';
// SteamGridDB client against a stand-in server. Run: node test/sgdb.test.js
const fake = require('./fake-igdb.js');
let bad = 0; const ok = (l, c, d) => { if (!c) { bad++; console.log('FAIL', l, d === undefined ? '' : d); } };
(async () => {
  await fake.startSgdb(9421, 'k');
  process.env.CHL_SGDB_URL = 'http://127.0.0.1:9421';
  const sg = require('../server/sgdb.js');

  const r = await sg.search('resident evil 4', 'k');
  ok('search returns games', r.length === 2 && r[0].id === 5001 && r[0].verified === true, JSON.stringify(r));
  ok('search too short -> empty', (await sg.search('a', 'k')).length === 0);
  ok('search no results', (await sg.search('nothing here', 'k')).length === 0);

  const posters = await sg.assets('grid', 5001, 'k');
  ok('posters: best score first, landscape dropped', posters.map((x) => x.id).join() === '2,1', posters.map((x) => x.id).join());
  ok('item shape', posters[0].thumb.endsWith('-t.png') && posters[0].author === 'user2' && posters[0].width === 600);
  const heroes = await sg.assets('hero', 5001, 'k');
  ok('banners sorted by score', heroes.map((x) => x.id).join() === '5,4');
  ok('logos', (await sg.assets('logo', 5001, 'k')).length === 1);
  ok('unknown game -> empty list (404)', (await sg.assets('grid', 9999, 'k')).length === 0);
  process.env.FAKE_SGDB_NO_FILTER = '1';
  ok('filter rejected by API -> retried without filters', (await sg.assets('grid', 5001, 'k')).length === 2);
  delete process.env.FAKE_SGDB_NO_FILTER;

  const err = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };
  ok('wrong key -> clear message, key not echoed', /rejected the API key/.test(await err(() => sg.search('zelda', 'wrong'))) && !/wrong/.test(await err(() => sg.search('zelda', 'wrong'))));
  ok('no key -> asks for one', /API key/.test(await err(() => sg.search('zelda', ''))));
  ok('bad kind refused', /Bad artwork/.test(await err(() => sg.assets('banana', 5001, 'k'))));

  const d = await sg.download('http://127.0.0.1:9421/img/grids-2.png', 'grid', 5001);
  ok('download returns png file', /^sgdb_grid_5001_[0-9a-f]{10}\.png$/.test(d.name) && d.buf.length > 20, d.name);
  ok('non-image content refused', /not a usable image/.test(await err(() => sg.download('http://127.0.0.1:9421/img/bad.png', 'grid', 1))));
  ok('foreign host refused', /Only steamgriddb\.com/.test(await err(() => sg.download('https://evil.example.com/a.png', 'grid', 1))));
  ok('lookalike host refused', /Only steamgriddb\.com/.test(await err(() => sg.download('https://steamgriddb.com.evil.io/a.png', 'grid', 1))));
  ok('plain http to real host refused', /Only steamgriddb\.com/.test(await err(() => sg.download('http://cdn2.steamgriddb.com/a.png', 'grid', 1))));
  ok('garbage url refused', /Bad image/.test(await err(() => sg.download('not a url', 'grid', 1))));
  console.log(bad ? bad + ' FAILED' : 'ALL PASSED (SteamGridDB client)');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); process.exit(1); });
