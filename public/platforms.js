'use strict';
// The one list of platforms used by BOTH the Planner and the Critical Hit List.
// To add or rename a platform, edit LIST below. Nothing else needs to change.
//
//   id      short key saved in your data (don't rename an existing one)
//   label   full name shown in dropdowns
//   short   compact name shown on pills
//   family  decides the colour (see FAMILIES)
//   icon    reserved for logos later: put a path like '/icons/ps5.svg' and pills will show it
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_PLATFORMS = api;
})(typeof self !== 'undefined' ? self : this, function () {

  // color = fill, text = text on a filled pill, ink = text/border on dark backgrounds (outline and soft pills)
  const FAMILIES = {
    pc:          { label: 'PC',          color: '#F4F4F5', text: '#0B0C10', ink: '#F4F4F5' },
    playstation: { label: 'PlayStation', color: '#2B6FF0', text: '#FFFFFF', ink: '#5B9BFF' },
    xbox:        { label: 'Xbox',        color: '#2DBE4E', text: '#04210B', ink: '#3EDD62' },
    nintendo:    { label: 'Nintendo',    color: '#E60012', text: '#FFFFFF', ink: '#FF4B5C' },
    mobile:      { label: 'Mobile',      color: '#8B5CF6', text: '#FFFFFF', ink: '#A78BFA' }
  };

  const LIST = [
    { id: 'pc',     label: 'PC',                          short: 'PC',     family: 'pc',          icon: null },
    { id: 'ps1',    label: 'PlayStation',                 short: 'PS1',    family: 'playstation', icon: null },
    { id: 'ps2',    label: 'PlayStation 2',               short: 'PS2',    family: 'playstation', icon: null },
    { id: 'ps3',    label: 'PlayStation 3',               short: 'PS3',    family: 'playstation', icon: null },
    { id: 'ps4',    label: 'PlayStation 4',               short: 'PS4',    family: 'playstation', icon: null },
    { id: 'ps5',    label: 'PlayStation 5',               short: 'PS5',    family: 'playstation', icon: null },
    { id: 'vita',   label: 'PlayStation Vita',            short: 'VITA',   family: 'playstation', icon: null },
    { id: 'x360',   label: 'Xbox 360',                    short: 'X360',   family: 'xbox',        icon: null },
    { id: 'xone',   label: 'Xbox One',                    short: 'XBOX ONE', family: 'xbox',      icon: null },
    { id: 'xsx',    label: 'Xbox Series X|S',             short: 'SERIES X|S', family: 'xbox',    icon: null },
    { id: 'switch', label: 'Nintendo Switch',             short: 'SWITCH', family: 'nintendo',    icon: null },
    { id: 'switch2', label: 'Nintendo Switch 2',          short: 'SWITCH 2', family: 'nintendo',  icon: null },
    { id: 'ds',     label: 'Nintendo DS',                 short: 'DS',     family: 'nintendo',    icon: null },
    { id: '3ds',    label: 'Nintendo 3DS',                short: '3DS',    family: 'nintendo',    icon: null },
    { id: 'gb',     label: 'Game Boy / Game Boy Advance', short: 'GB/GBA', family: 'nintendo',    icon: null },
    { id: 'wii',    label: 'Nintendo Wii',                short: 'WII',    family: 'nintendo',    icon: null },
    { id: 'wiiu',   label: 'Nintendo Wii U',              short: 'WII U',  family: 'nintendo',    icon: null },
    { id: 'mobile', label: 'Mobile',                      short: 'MOBILE', family: 'mobile',      icon: null }
  ];

  const byId = (id) => LIST.find((p) => p.id === id) || null;

  const hexToRgb = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  };

  // Everything a pill needs to be drawn, from a platform id
  function colorsOf(id) {
    const p = byId(id); if (!p) return null;
    const f = FAMILIES[p.family];
    return { color: f.color, text: f.text, ink: f.ink, rgb: hexToRgb(f.ink), family: p.family };
  }

  // Free text -> platform id (for old saved data and IGDB platform names). Returns '' when nothing matches.
  // Platforms that aren't in LIST (PlayStation VR2, PSP, Sega, ...) deliberately return ''.
  // Order matters: the more specific names (Switch 2, 3DS, Wii U, Series X|S) must come before the plain ones.
  const RULES = [
    ['vita',    /\b(ps ?vita|playstation vita|vita)\b/],
    ['xsx',     /\b(xbox series|series [xs])\b/],
    ['switch2', /\bswitch ?2\b/],
    ['3ds',     /\b(nintendo )?3ds\b/],
    ['wiiu',    /\bwii ?u\b/],
    ['ps5',    /\b(ps ?5|playstation ?5)\b/],
    ['ps4',    /\b(ps ?4|playstation ?4)\b/],
    ['ps3',    /\b(ps ?3|playstation ?3)\b/],
    ['ps2',    /\b(ps ?2|playstation ?2)\b/],
    ['ps1',    /^(ps ?1|psx|psone|ps|playstation)$/],
    ['xone',   /\b(xbox ?one|xone)\b/],
    ['x360',   /\b(xbox ?360|x360)\b/],
    ['switch', /\b(nintendo )?switch\b(?! ?2)/],
    ['ds',     /\b(nintendo )?ds\b/],
    ['gb',     /\b(game ?boy|gba|gbc)\b/],
    ['wii',    /\bwii\b/],
    ['mobile', /\b(mobile|android|ios|iphone|ipad)\b/],
    ['pc',     /\b(pc|windows|steam|mac|macos|linux)\b/]
  ];
  function detect(text) {
    const t = String(text || '').toLowerCase().trim();
    if (!t) return '';
    for (const [id, re] of RULES) if (re.test(t)) return id;
    return '';
  }

  const label = (id, mode) => { const p = byId(id); return p ? (mode === 'full' ? p.label : p.short) : ''; };

  return { FAMILIES, LIST, byId, colorsOf, detect, label };
});
