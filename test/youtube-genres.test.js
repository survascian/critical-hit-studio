'use strict';
// YouTube link parsing + stats fetch, and IGDB themes (including the fallback when IGDB rejects the themes field)
const fake = require('./fake-igdb.js');
let bad = 0; const ok = (l, c, d) => { if (!c) { bad++; console.log('FAIL', l, d === undefined ? '' : d); } };
(async () => {
  await fake.start(9411, { id: 'cid', secret: 'sec' });
  await fake.startYoutube(9412, 'k');
  process.env.CHL_TWITCH_URL = 'http://127.0.0.1:9411/oauth2/token'; process.env.CHL_IGDB_URL = 'http://127.0.0.1:9411/v4'; process.env.CHL_YT_URL = 'http://127.0.0.1:9412';
  const { videoIdFrom, parseChannelInput, fetchVideo, fetchChannel, fetchChannelVideos } = require('../server/youtube.js');
  const { IgdbClient } = require('../server/igdb.js');

  const id = 'abcDEFghi12';
  [['https://www.youtube.com/watch?v=' + id + '&t=5', id], ['youtu.be/' + id + '?si=z', id], ['https://m.youtube.com/watch?v=' + id, id], ['https://www.youtube.com/shorts/' + id, id], ['https://youtube.com/live/' + id, id], [id, id],
   ['https://evil.com/watch?v=' + id, ''], ['https://youtube.com.evil.com/watch?v=' + id, ''], ['javascript:alert(1)', ''], ['', ''], ['https://www.youtube.com/watch?v=short', '']]
    .forEach(([i, want]) => ok('videoIdFrom ' + i, videoIdFrom(i) === want, videoIdFrom(i)));

  const cid = 'UC1234567890123456789012';
  [
    ['@Survascian', { id: '', handle: '@Survascian' }],
    ['Survascian', { id: '', handle: '@Survascian' }],
    ['https://www.youtube.com/@Survascian/videos', { id: '', handle: '@Survascian' }],
    ['youtube.com/@Survascian', { id: '', handle: '@Survascian' }],
    [cid, { id: cid, handle: '' }],
    ['https://www.youtube.com/channel/' + cid, { id: cid, handle: '' }],
    ['https://studio.youtube.com/channel/' + cid + '/videos', { id: cid, handle: '' }],
    ['https://evil.com/@Survascian', null],
    ['javascript:alert(1)', null],
    ['', null]
  ].forEach(([i, want]) => {
    const got = parseChannelInput(i);
    ok('parseChannelInput ' + i, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  });

  const v = await fetchVideo(id, 'k');
  ok('fetchVideo numbers', v.views === 12345 && v.likes === 987 && v.comments === 45 && v.title === 'Elden Ring Review' && v.publishedAt.startsWith('2026-11-10'), JSON.stringify(v));
  let e1 = ''; try { await fetchVideo(id, 'wrong'); } catch (e) { e1 = e.message; }
  ok('bad key gives a readable error', /API key not valid/.test(e1) && !/wrong/.test(e1), e1);
  let e2 = ''; try { await fetchVideo('AAAAAAAAAAA', 'k'); } catch (e) { e2 = e.message + e.status; }
  ok('missing video -> 404 message', /no public video/.test(e2) && /404/.test(e2), e2);
  let e3 = ''; try { await fetchVideo(id, ''); } catch (e) { e3 = e.message; }
  ok('no key -> asks for one', /API key/.test(e3), e3);

  const ch = await fetchChannel('@Survascian', 'k');
  ok('fetchChannel normalises stats and uploadsId', ch.id === cid && ch.handle === '@Survascian' && ch.title === 'Survascian' && ch.subscribers === 42000 && ch.views === 1500000 && ch.videos === 87 && ch.uploadsId === 'UU1234567890123456789012' && /avatar\.jpg/.test(ch.avatarUrl), JSON.stringify(ch));
  let ec1 = ''; try { await fetchChannel('@missingchannel', 'k'); } catch (e) { ec1 = e.message + e.status; }
  ok('missing channel -> 404 message', /no public channel/.test(ec1) && /404/.test(ec1), ec1);
  let ec2 = ''; try { await fetchChannel('https://evil.com/@x', 'k'); } catch (e) { ec2 = e.message + e.status; }
  ok('bad channel input -> 400 message', /handle or channel link/.test(ec2) && /400/.test(ec2), ec2);

  const vids = await fetchChannelVideos(ch.uploadsId, 'k', 20);
  ok('fetchChannelVideos returns uploads', vids.length === 2 && vids[0].id === 'abcDEFghi12' && vids[0].url === 'https://www.youtube.com/watch?v=abcDEFghi12', JSON.stringify(vids));
  const vids1 = await fetchChannelVideos(ch.uploadsId, 'k', 1);
  ok('fetchChannelVideos respects limit', vids1.length === 1, JSON.stringify(vids1));
  let ev1 = ''; try { await fetchChannelVideos('', 'k'); } catch (e) { ev1 = e.message + e.status; }
  ok('missing uploadsId -> 400 message', /uploads playlist/.test(ev1) && /400/.test(ev1), ev1);

  const c = new IgdbClient({ getCreds: () => ({ clientId: 'cid', clientSecret: 'sec' }) });
  let d = await c.detail(1943);
  ok('themes: Resident Evil = Survival Horror first', d.game.genres[0] === 'Survival Horror' && d.game.igdbThemes.includes('Horror') && d.game.igdbGenres.join() === 'Shooter,Adventure', JSON.stringify(d.game.genres));
  process.env.FAKE_NO_THEMES = '1';
  d = await c.detail(1943);
  ok('IGDB rejecting themes still returns the game (genres only)', d.game.name === 'Resident Evil 4' && d.game.genres[0] === 'Shooter' && d.game.igdbThemes.length === 0, JSON.stringify(d.game.genres));
  console.log(bad ? bad + ' FAILED' : 'ALL PASSED (YouTube parsing/fetch, IGDB themes + fallback)');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('ERROR', e); process.exit(1); });
