'use strict';
// Which genre comes first. Run: node test/genres.test.js
const G = require('../public/genres.js');
let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('FAIL', name, '->', JSON.stringify(got), 'expected', JSON.stringify(want)); } };

eq('Resident Evil (Shooter, Adventure + Horror, Survival)', G.order(['Shooter', 'Adventure'], ['Action', 'Horror', 'Survival']), ['Survival Horror', 'Shooter', 'Adventure']);
eq('Horror without Survival', G.order(['Shooter', 'Adventure'], ['Action', 'Horror']), ['Horror', 'Shooter', 'Adventure']);
eq('old data, no themes: generic genres go last', G.order(['Adventure', 'Role-playing (RPG)', 'Indie']), ['RPG', 'Adventure', 'Indie']);
eq('Elden Ring: RPG leads, Open world/Fantasy are not headlines', G.order(['Role-playing (RPG)', 'Adventure'], ['Action', 'Fantasy', 'Open world']), ['RPG', 'Adventure']);
eq('Survival alone', G.order(['Simulator', 'Adventure'], ['Survival', 'Sandbox']), ['Survival', 'Sandbox', 'Simulator', 'Adventure']);
eq('4X', G.order(['Strategy', 'Turn-based strategy (TBS)'], ['4X (explore, expand, exploit, and exterminate)']), ['4X', 'Turn-Based Strategy', 'Strategy']);
eq('Fighting beats Arcade', G.order(['Arcade', 'Fighting'], []), ['Fighting', 'Arcade']);
eq('Hack and slash short name', G.order(["Hack and slash/Beat 'em up", 'Adventure'], []), ['Hack and Slash', 'Adventure']);
eq('limit', G.order(['Fighting', 'Racing', 'Music', 'Puzzle', 'Sport'], [], 3), ['Fighting', 'Racing', 'Music']);
eq('unknown genre sits ahead of generic ones', G.order(['Adventure', 'Weird New Genre'], []), ['Weird New Genre', 'Adventure']);
eq('empty', G.order([], []), []);
eq('themes case-insensitive', G.order(['Shooter'], ['horror']), ['Horror', 'Shooter']);
eq('stable for ties', G.order(['Platform', 'Puzzle'], []), ['Puzzle', 'Platform']);
const c = G.candidates(['Shooter', 'Adventure'], ['Action', 'Horror', 'Survival']);
eq('candidates start with the ranked list and include raw themes', c, ['Survival Horror', 'Shooter', 'Adventure', 'Action', 'Horror', 'Survival']);
console.log(bad ? bad + ' FAILED' : 'ALL PASSED (genre ordering)');
process.exit(bad ? 1 : 0);
