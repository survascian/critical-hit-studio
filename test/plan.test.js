'use strict';
const assert = require('assert');
const P = require('../public/plan.js');
const DAY = 86400000; const now = Date.UTC(2026, 10, 18, 12);
let n = 0; const t = (name, fn) => { fn(); n++; };

t('normalize clamps, repairs, and migrates legacy moments and f fields', () => {
  const p = P.normalize({ angle: 'x'.repeat(999), f: { hook: 'open', bogus: 'no' }, moments: [{ kind: 'funny', time: '1:02:10', text: 'boom' }, { text: '' }], chosen: 7 });
  assert.strictEqual(p.angle.length, 400); assert.strictEqual(p.hook, 'open');
  assert.strictEqual(p.notes, '- [1:02:10] boom');
  assert.strictEqual(p.chosen, -1); assert.strictEqual(p.titles.length, 3);
  assert.strictEqual(p.thumbs.length, 3); assert.strictEqual(p.chosenThumb, -1);
  assert.ok(!P.isEmpty({ thumbs: ['/media/thumb_abc.png'] }));
  assert.deepStrictEqual(P.gameFormats({ format: 'hitlist' }), ['hitlist']);
  assert.deepStrictEqual(P.gameFormats({ format: 'hitlist', formats: ['hitlist', 'supercut', 'hitlist'] }), ['hitlist', 'supercut']);
  assert.ok(P.isEmpty(null)); assert.ok(!P.isEmpty({ f: { hook: 'a' } })); assert.ok(!P.isEmpty({ angle: 'great' })); assert.ok(!P.isEmpty({ notes: 'boss glitched' }));
  assert.strictEqual(P.normalize({ notes: 'kept', moments: [{ text: 'old' }] }).notes, 'kept');
});
t('customizable formats', () => {
  assert.deepStrictEqual(P.FORMATS.map((f) => f.id), ['hitlist', 'bite', 'supercut', 'funny']);
  const custom = P.normalizeFormats([{ id: 'essay', label: 'Video Essay', short: 'essay', color: '#123456' }, { label: '' }]);
  assert.strictEqual(custom.length, 1); assert.strictEqual(custom[0].short, 'ESSAY');
  assert.strictEqual(P.formatOf('essay', custom).label, 'Video Essay');
  assert.strictEqual(P.formatOf('nope'), null);
  assert.strictEqual(P.guessFormat(['Critical Bite', 'x']), 'bite'); assert.strictEqual(P.guessFormat(['Souls-likes']), '');
  assert.strictEqual(P.guessFormat(['Supercuts']), 'supercut');
});
t('monthly and yearly recap', () => {
  const games = [
    { name: 'Game A', stage: 'Published', publishedAt: '2026-11-05', hoursPlayed: 12, format: 'hitlist', video: { views: 5000 }, awards: [{ cat: 'goty', year: '2026' }] },
    { name: 'Game B', stage: 'Published', video: { publishedAt: '2026-10-12T10:00:00Z', views: 9000 }, hoursPlayed: 8.5, format: 'supercut' },
    { name: 'Game D', stage: 'Published', dueDate: '2026-11-22', hoursPlayed: 3.2, format: 'essay', video: { views: 1200 } },
    { name: 'Game C', stage: 'Editing', dueDate: '2026-11-20', hoursPlayed: 5 }
  ];
  const customFormats = P.FORMATS.concat([{ id: 'essay', label: 'Essay', short: 'ESSAY', color: '#00ffaa' }]);
  const m = P.recap(games, 'month', '2026', '11', customFormats);
  assert.strictEqual(m.periodLabel, 'November 2026');
  assert.strictEqual(m.count, 2); assert.strictEqual(m.hours, 15.2); assert.strictEqual(m.views, 6200); assert.strictEqual(m.awards.length, 1);
  assert.strictEqual(m.games[0].name, 'Game D');
  assert.strictEqual(m.topViews[0].name, 'Game A');
  assert.strictEqual(m.byFormat.length, 2);
  const y = P.recap(games, 'year', '2026', null, customFormats);
  assert.strictEqual(y.periodLabel, '2026');
  assert.strictEqual(y.count, 3); assert.strictEqual(y.hours, 23.7); assert.strictEqual(y.views, 15200);
  assert.strictEqual(y.topViews[0].name, 'Game B');
});
t('stuck days and levels', () => {
  const g = { stage: 'Editing', history: [{ stage: 'Writing', at: now - 20 * DAY }, { stage: 'Editing', at: now - 9 * DAY }] };
  assert.strictEqual(P.stuckDays(g, now), 9); assert.deepStrictEqual(P.stuck(g, now), { days: 9, level: 'warn' });
  assert.strictEqual(P.stuck({ stage: 'Editing', history: [{ stage: 'Editing', at: now - 15 * DAY }] }, now).level, 'bad');
  assert.strictEqual(P.stuck({ stage: 'Editing', history: [{ stage: 'Editing', at: now - 1 * DAY }] }, now).level, 'ok');
  assert.strictEqual(P.stuck({ stage: 'Published', history: [{ stage: 'Published', at: 0 }] }, now), null);
  assert.strictEqual(P.stuckDays({ stage: 'Editing' }, now), 0);
});
t('forecast needs enough history', () => {
  const mk = (id, w, e, r) => ({ id, stage: 'Published', history: [{ stage: 'Writing', at: 0 }, { stage: 'Editing', at: w * DAY }, { stage: 'Reviewing', at: (w + e) * DAY }, { stage: 'Published', at: (w + e + r) * DAY }] });
  const cur = { id: 'cur', stage: 'Editing', history: [{ stage: 'Editing', at: Date.now() - 2 * DAY }] };
  assert.strictEqual(P.forecast(cur, [mk('a', 2, 4, 1)]), null);
  const done = [mk('a', 2, 4, 1), mk('b', 3, 6, 1), mk('c', 1, 5, 2)];
  assert.strictEqual(P.forecast(cur, done.concat(cur)).days, 4);
  assert.strictEqual(P.forecast({ id: 'z', stage: 'Planned' }, done), null);
});
t('cadence slots and buffer', () => {
  assert.deepStrictEqual(P.cleanDays([5, '2', 2, 9, 'x']), [2, 5]);
  assert.ok(P.isSlot('2026-11-20', [5])); assert.ok(!P.isSlot('2026-11-19', [5]));
  assert.deepStrictEqual(P.nextSlots([5, 2], '2026-11-18', 3), ['2026-11-20', '2026-11-24', '2026-11-27']);
  assert.deepStrictEqual(P.nextSlots([], '2026-11-18', 3), []);
  const games = [{ stage: 'Reviewing' }, { stage: 'Editing' }, { stage: 'Published' }];
  assert.deepStrictEqual(P.buffer(games, 'Reviewing', [5]), { ready: 1, days: 7, perWeek: 1 });
  assert.deepStrictEqual(P.buffer(games, 'Editing', [2, 5]), { ready: 2, days: 7, perWeek: 2 });
  assert.strictEqual(P.buffer(games, 'Reviewing', []).days, null);
});
t('journal entries', () => {
  const e = P.normJournal({ title: 'x'.repeat(300), date: '2026-13', games: ['a', 'a', '', 'b'], text: 5 });
  assert.strictEqual(e.title.length, 120); assert.strictEqual(e.date, ''); assert.deepStrictEqual(e.games, ['a', 'b']); assert.strictEqual(e.text, '5'); assert.ok(e.id && e.createdAt > 0);
  const list = [{ date: '2026-11-01', createdAt: 1 }, { date: '2026-11-20', createdAt: 1 }, { date: '2026-11-20', createdAt: 5 }, { date: '', createdAt: 9 }];
  assert.deepStrictEqual(P.sortJournal(list).map((x) => x.createdAt), [5, 1, 1, 9]);
  assert.strictEqual(P.sortJournal(list)[2].date, '2026-11-01');
});
console.log('plan.test.js: ' + n + ' groups passed');
