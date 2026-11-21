'use strict';
const assert = require('assert');
const C = require('../public/cloud.js');

// Empty local takes remote
const m1 = C.mergeStates({ version: 1, games: [], journal: [] }, { version: 1, games: [{ id: 'g1', name: 'Elden Ring', stage: 'Editing', updatedAt: 200 }], journal: [{ id: 'j1', title: 'Hi', updatedAt: 100 }] });
assert.strictEqual(m1.games.length, 1);
assert.strictEqual(m1.games[0].name, 'Elden Ring');
assert.strictEqual(m1.journal.length, 1);

// Empty remote keeps local
const m2 = C.mergeStates({ version: 1, games: [{ id: 'g1', name: 'Hades II', stage: 'Writing', updatedAt: 200 }], journal: [] }, { version: 1, games: [], journal: [] });
assert.strictEqual(m2.games.length, 1);
assert.strictEqual(m2.games[0].name, 'Hades II');

// Both have data: newer timestamp wins per game, while preserving PC-only fields (launchTarget, projectFolder, cover)
const m3 = C.mergeStates(
  { version: 1, games: [{ id: 'g1', name: 'RE4', stage: 'Writing', launchTarget: 'steam://1', projectFolder: 'D:\\RE4', cover: '/media/re4.jpg', updatedAt: 100 }, { id: 'g2', name: 'LocalOnly', stage: 'Planned', updatedAt: 150 }], journal: [{ id: 'j1', title: 'Old', updatedAt: 100 }] },
  { version: 1, games: [{ id: 'g1', name: 'RE4', stage: 'Editing', updatedAt: 300 }, { id: 'g3', name: 'PhoneAdded', stage: 'Backlogged', updatedAt: 250 }], journal: [{ id: 'j1', title: 'Updated on phone', updatedAt: 300 }] }
);
assert.strictEqual(m3.games.length, 3);
const g1 = m3.games.find((g) => g.id === 'g1');
assert.strictEqual(g1.stage, 'Editing');
assert.strictEqual(g1.launchTarget, 'steam://1');
assert.strictEqual(g1.projectFolder, 'D:\\RE4');
assert.strictEqual(g1.cover, '/media/re4.jpg');
assert.strictEqual(m3.journal[0].title, 'Updated on phone');

// cleanForFirestore strips undefined
const cleaned = C.cleanForFirestore({ a: 1, b: undefined, c: { d: undefined, e: 'ok' } });
assert.deepStrictEqual(cleaned, { a: 1, c: { e: 'ok' } });

console.log('ALL PASSED (cloud sync merge & sanitize)');
