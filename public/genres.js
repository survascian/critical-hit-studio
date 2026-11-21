'use strict';
// Decides which genre label comes FIRST for a game.
//
// IGDB keeps two separate lists: "genres" (gameplay: Shooter, RPG, Adventure...) and "themes" (feel: Horror, Survival, Open world...).
// The old behaviour only used genres, so Resident Evil showed "Shooter" and never "Horror".
// Here the themes that define a game (Horror first of all) come before the gameplay genres, and the gameplay genres are
// sorted from specific to generic, so "Adventure" and "Indie" end up last instead of first.
//
// To change the behaviour, edit the tables below. Anything you set by hand in the Planner always wins over this.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_GENRES = api;
})(typeof self !== 'undefined' ? self : this, function () {

  // Shorter labels for IGDB's long genre names (matched case-insensitively on the start of the name)
  const SHORT = [
    [/^role-playing/i, 'RPG'],
    [/^hack and slash/i, 'Hack and Slash'],
    [/^turn-based strategy/i, 'Turn-Based Strategy'],
    [/^real time strategy/i, 'RTS'],
    [/^card & board game/i, 'Card & Board Game'],
    [/^quiz\/trivia/i, 'Trivia']
  ];

  // Lower number = more defining. A gameplay genre with a low number is shown before one with a high number.
  const GENRE_ORDER = [
    'Fighting', 'Racing', 'Music', 'Puzzle', 'Visual Novel', 'Pinball', 'Card & Board Game', 'Trivia', 'MOBA',
    'Platform', 'Sport', 'Simulator', 'Tactical', 'RTS', 'Turn-Based Strategy', 'Strategy',
    'Point-and-click', 'Hack and Slash', 'RPG',
    'Shooter', 'Arcade', 'Adventure', 'Indie'
  ];

  // Themes strong enough to be the headline of a game. Order here is the order they appear in.
  // "Horror" is always first; "Horror" + "Survival" together become "Survival Horror".
  const DEFINING_THEMES = ['Horror', 'Survival', '4X (explore, expand, exploit, and exterminate)', 'Sandbox', 'Party'];   // Stealth, Open world, Action, Fantasy etc. are NOT headlines: the gameplay genre (RPG, Shooter...) leads instead
  const THEME_LABEL = { 'open world': 'Open World', '4x (explore, expand, exploit, and exterminate)': '4X' };

  const norm = (s) => String(s || '').trim();
  const lc = (s) => norm(s).toLowerCase();
  const shortName = (g) => { const n = norm(g); for (const [re, label] of SHORT) if (re.test(n)) return label; return n; };
  const rank = (label) => { const i = GENRE_ORDER.findIndex((x) => lc(x) === lc(label)); return i === -1 ? GENRE_ORDER.indexOf('Shooter') - 0.5 : i; };   // unknown genres sit just ahead of the generic ones

  // genres, themes: arrays of IGDB names. Returns the ordered labels to show (at most `limit`).
  function order(genres, themes, limit) {
    const T = (themes || []).map(norm).filter(Boolean);
    const has = (name) => T.some((t) => lc(t) === lc(name));
    const out = [];
    const push = (x) => { if (x && !out.some((o) => lc(o) === lc(x))) out.push(x); };

    for (const name of DEFINING_THEMES) {
      if (!has(name)) continue;
      if (lc(name) === 'horror') push(has('Survival') ? 'Survival Horror' : 'Horror');
      else if (lc(name) === 'survival') { if (!has('Horror')) push('Survival'); }      // folded into "Survival Horror" otherwise
      else push(THEME_LABEL[lc(name)] || name);
    }

    const g = (genres || []).map(shortName).filter(Boolean);
    // stable sort: ties keep IGDB's own order
    g.map((label, i) => ({ label, i })).sort((a, b) => rank(a.label) - rank(b.label) || a.i - b.i).forEach((x) => push(x.label));

    return out.slice(0, limit || 4);
  }

  // Every label a person might want to pick as "the main genre" (for the tap-to-reorder chips)
  function candidates(genres, themes) {
    const all = [];
    const push = (x) => { if (x && !all.some((o) => lc(o) === lc(x))) all.push(x); };
    order(genres, themes, 99).forEach(push);
    (themes || []).forEach((t) => push(THEME_LABEL[lc(t)] || norm(t)));
    return all;
  }

  return { order, candidates, shortName };
});
