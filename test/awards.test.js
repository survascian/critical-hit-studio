'use strict';
// Special awards. Run: node test/awards.test.js
const A = require('../public/awards.js');
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('FAIL', name, '->', JSON.stringify(got), 'expected', JSON.stringify(want)); } };

eq('not a list', A.normalize(null), []);
eq('junk entries dropped', A.normalize([null, 5, {}, { cat: 'nope' }]), []);
eq('goty keeps year and is year-only', A.normalize([{ cat: 'goty', scope: 'alltime', year: '2025' }]), [{ cat: 'goty', scope: 'year', year: '2025', text: '' }]);
eq('bad year is blanked', A.normalize([{ cat: 'horror', scope: 'year', year: '25' }]), [{ cat: 'horror', scope: 'year', year: '', text: '' }]);
eq('all-time drops the year', A.normalize([{ cat: 'horror', scope: 'alltime', year: '2025' }]), [{ cat: 'horror', scope: 'alltime', year: '', text: '' }]);
eq('custom text is trimmed and capped', A.normalize([{ cat: 'custom', scope: 'year', year: '2024', text: '   Most   Surprising   ' + 'x'.repeat(40) }])[0].text.length, 24);
eq('text ignored for non-custom', A.normalize([{ cat: 'action', year: '2025', text: 'zzz' }])[0].text, '');
eq('duplicates removed', A.normalize([{ cat: 'goty', year: '2025' }, { cat: 'goty', year: '2025' }]).length, 1);
eq('capped at MAX', A.normalize([{ cat: 'goty', year: '2025' }, { cat: 'horror', year: '2025' }, { cat: 'action', year: '2025' }]).length, A.MAX);

eq('GOTY text', A.label({ cat: 'goty', year: '2025' }), 'GAME OF THE YEAR 2025');
eq('Best Horror 2025', A.label({ cat: 'horror', scope: 'year', year: '2025' }), 'BEST HORROR 2025');
eq('Best Horror all time', A.label({ cat: 'horror', scope: 'alltime' }), 'BEST HORROR OF ALL TIME');
eq('category without year', A.label({ cat: 'action', scope: 'year', year: '' }), 'BEST ACTION OF THE YEAR');
eq('custom award', A.label({ cat: 'custom', scope: 'year', year: '2024', text: 'Most Surprising' }), 'MOST SURPRISING 2024');
eq('all-time is gold', A.describe({ cat: 'horror', scope: 'alltime' }).color, '#FFC700');
eq('year award uses its category colour', A.describe({ cat: 'horror', scope: 'year', year: '2025' }).color, '#FF4D4D');
eq('unknown cat -> null', A.describe({ cat: 'zzz' }), null);

const w = A.renderWrap([{ cat: 'goty', year: '2025' }, { cat: 'horror', scope: 'alltime' }], null, { reveal: true });
eq('two emblems drawn', (w.html.match(/<svg class="aw-emblem/g) || []).length, 2);
eq('default is laurel, right, side by side', [w.layout.style, w.layout.side, w.layout.arrange, w.layout.size, w.layout.text], ['laurel', 'right', 'row', 'md', 'full']);
eq('wrapper carries the scale', /--aws:1\.000/.test(w.html), true);
eq('all-time is marked', /aw-alltime/.test(w.html), true);
eq('quiet reveal flourish', /aw-reveal/.test(w.html) && !/aw-pop/.test(w.html), true);
const pop = A.renderWrap([{ cat: 'goty', year: '2025' }], null, { reveal: 'pop' });
eq('pop adds sparks and the pop class', /aw-pop/.test(pop.html) && (pop.html.match(/aw-spark/g) || []).length === 10, true);
eq('held draws the emblems invisibly so they hold their space', /<svg/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], null, { held: true }).html) && /aw-held/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], null, { held: true }).html), true);
eq('held and shown have the same size', /--aws:1\.000/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], null, { held: true }).html), true);
eq('nothing to draw', A.renderWrap([], null).html, '');
eq('escapes custom text', /<script>/.test(A.renderWrap([{ cat: 'custom', year: '2024', text: '<script>' }]).html), false);

// styles, per-entry layout
['laurel', 'medal', 'hex'].forEach((st) => {
  const r = A.renderWrap([{ cat: 'horror', year: '2025' }], { style: st });
  eq(st + ' style draws its own emblem', new RegExp('aw-emblem aw-' + st).test(r.html), true);
});
eq('settings style used when the entry has none', A.renderWrap([{ cat: 'horror', year: '2025' }], {}, { defaultStyle: 'hex' }).layout.style, 'hex');
eq('entry style beats the setting', A.renderWrap([{ cat: 'horror', year: '2025' }], { style: 'medal' }, { defaultStyle: 'hex' }).layout.style, 'medal');
eq('unknown setting style falls back to laurel', A.resolveLayout({}, 'nope').style, 'laurel');
eq('stacked shrinks to fit the row', /--aws:0\.540/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], { arrange: 'stack' }).html), true);
eq('stacked + large', /--aws:0\.620/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], { arrange: 'stack', size: 'lg' }).html), true);
eq('small row', /--aws:0\.800/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], { size: 'sm' }).html), true);
eq('left side is reported', A.renderWrap([{ cat: 'goty', year: '2025' }], { side: 'left' }).side, 'left');
eq('icon only hides the text', /aw-text/.test(A.renderWrap([{ cat: 'goty', year: '2025' }], { text: 'icon' }).html), false);
eq('layout junk is blanked', A.normalizeLayout({ style: 'zzz', arrange: 'diagonal', size: 'huge', side: 'up', text: 1 }), { style: '', arrange: '', size: '', side: '', text: '' });
eq('layout from nothing', A.normalizeLayout(null), { style: '', arrange: '', size: '', side: '', text: '' });
eq('layout keeps valid values', A.normalizeLayout({ style: 'medal', arrange: 'stack', size: 'lg', side: 'left', text: 'icon' }), { style: 'medal', arrange: 'stack', size: 'lg', side: 'left', text: 'icon' });
A.STYLES.forEach((st) => eq('every style has a drawing: ' + st.id, /aw-emblem/.test(A.emblem(st.id, '#fff', 'star')), true));
Object.keys(A.ICONS).forEach((k) => eq('icon ' + k + ' is svg markup', /^</.test(A.ICONS[k]), true));
A.CATS.forEach((c) => eq('category ' + c.id + ' has an icon', !!A.ICONS[c.icon], true));

if (bad) { console.log(bad + ' award test(s) failed'); process.exit(1); }
console.log('awards tests passed');

// the tallest award block must fit inside the fixed entry height (92px tile, 2px borders, 6px air)
const fits = (arr, size) => { const sc = Number(/--aws:([\d.]+)/.exec(A.renderWrap([{ cat: 'goty', year: '2025' }], { arrange: arr, size }).html)[1]); return arr === 'stack' ? (2 * 64 * sc + 4 * sc) : 64 * sc; };
['sm', 'md', 'lg'].forEach((sz) => ['row', 'stack'].forEach((ar) => { const h = fits(ar, sz); if (h > 84) { console.log('FAIL', ar, sz, 'is', h, 'px tall, over the 84px budget'); process.exit(1); } }));
console.log('award sizes fit the fixed entry height');
