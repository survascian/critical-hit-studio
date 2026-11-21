'use strict';
// Platform list + name matching (used for IGDB hints and for converting old free-text data)
const P = require('../public/platforms.js');
const cases = {
  'PC (Microsoft Windows)': 'pc', 'PC': 'pc', 'Mac': 'pc', 'PlayStation 5': 'ps5', 'PS5': 'ps5', 'ps 4': 'ps4', 'PlayStation 4': 'ps4',
  'PlayStation 3': 'ps3', 'PlayStation 2': 'ps2', 'PlayStation': 'ps1', 'PSX': 'ps1', 'PlayStation VR2': '', 'PlayStation Vita': 'vita', 'PS Vita': 'vita',
  'Xbox One': 'xone', 'Xbox 360': 'x360', 'Xbox Series X|S': 'xsx', 'Xbox Series S': 'xsx', 'Xbox': '', 'Nintendo Switch': 'switch', 'Switch': 'switch',
  'Nintendo Switch 2': 'switch2', 'Switch 2': 'switch2', 'Nintendo DS': 'ds', 'Nintendo 3DS': '3ds', 'New Nintendo 3DS': '3ds', 'Game Boy Advance': 'gb', 'Game Boy': 'gb', 'GBA': 'gb',
  'Wii': 'wii', 'Wii U': 'wiiu', 'Android': 'mobile', 'iOS': 'mobile', 'Mobile': 'mobile', '': '', 'Sega Genesis': '', 'PlayStation Portable': '', 'Xbox One X': 'xone', 'PC · 2022': 'pc'
};
let bad = 0;
for (const [k, v] of Object.entries(cases)) { const g = P.detect(k); if (g !== v) { bad++; console.log('FAIL', JSON.stringify(k), '->', g, 'expected', v); } }
const fam = { pc: '#F4F4F5', playstation: '#2B6FF0', xbox: '#2DBE4E', nintendo: '#E60012' };
['pc', 'ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'vita', 'x360', 'xone', 'xsx', 'switch', 'switch2', 'ds', '3ds', 'gb', 'wii', 'wiiu'].forEach((id) => {
  const c = P.colorsOf(id); const want = fam[P.byId(id).family];
  if (c.color !== want) { bad++; console.log('FAIL colour', id, c.color, want); }
});
if (P.LIST.length !== 18) { bad++; console.log('FAIL expected 18 platforms, got', P.LIST.length); }
console.log(bad ? bad + ' FAILED' : 'ALL PASSED (' + Object.keys(cases).length + ' name cases, colours, 18 platforms)');
process.exit(bad ? 1 : 0);
