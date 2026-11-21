'use strict';
// Score tier strip. Run: node test/tier.test.js
const T = require('../public/tier.js');
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('FAIL', name, '->', JSON.stringify(got), 'expected', JSON.stringify(want)); } };

eq('10/10 in a tag', T.parse('Critical Hit! (10/10)'), 10);
eq('plain 9/10', T.parse('9/10'), 9);
eq('spaces', T.parse('Epic Scale ( 9.5 / 10 )'), 9.5);
eq('comma decimal', T.parse('Solid (8,5/10)'), 8.5);
eq('out of', T.parse('9 out of 10'), 9);
eq('out of 100', T.parse('Great 90/100'), 9);
eq('out of 5', T.parse('4.5/5'), 9);
eq('percent', T.parse('Banger 95%'), 9.5);
eq('unicode fraction slash', T.parse('Pure Joy (9⁄10)'), 9);
eq('single bare number', T.parse('Masterpiece 9'), 9);
eq('no number', T.parse('Critical Hit!'), null);
eq('empty', T.parse(''), null);
eq('undefined', T.parse(undefined), null);
eq('year is not a score', T.parse('Remake 2023'), null);
eq('two numbers, no fraction', T.parse('Tier 3 of 12 picks'), null);
eq('impossible 12/10', T.parse('12/10'), null);

eq('gold', T.color('10/10'), '#FFC700');
eq('gold edge 9.5', T.color('9.5/10'), '#FFC700');
eq('green', T.color('9/10'), '#2ECC71');
eq('green edge 8.5', T.color('8.5/10'), '#2ECC71');
eq('cyan', T.color('8/10'), '#22D3EE');
eq('cyan edge 7.5', T.color('7.5/10'), '#22D3EE');
eq('orange', T.color('7/10'), '#FB923C');
eq('orange edge 6', T.color('6/10'), '#FB923C');
eq('red', T.color('5.5/10'), '#EF4444');
eq('zero is red', T.color('0/10'), '#EF4444');
eq('no number -> no strip', T.color('Critical Hit!'), null);

if (bad) { console.log(bad + ' tier test(s) failed'); process.exit(1); }
console.log('tier tests passed');
