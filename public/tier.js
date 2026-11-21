'use strict';
// Score tiers for the Critical Hit List colour strip (shared by the Planner and the Hit List).
// Reads a number out of the score tag, then picks a tier. Edit TIERS to change the colours or cut-offs.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_TIER = api;
}(typeof self !== 'undefined' ? self : this, function () {
  // min = lowest score (out of 10) in this tier, checked from the top down
  const TIERS = [
    { min: 9.5, color: '#FFC700', name: 'Gold' },
    { min: 8.5, color: '#2ECC71', name: 'Green' },
    { min: 7.5, color: '#22D3EE', name: 'Cyan' },
    { min: 6,   color: '#FB923C', name: 'Orange' },
    { min: 0,   color: '#EF4444', name: 'Red' }
  ];

  const num = (s) => parseFloat(String(s).replace(',', '.'));

  // Returns a score out of 10, or null when the tag has no number we can read.
  // Understands: 9/10, 9 / 10, 9.5/10, (8,5/10), "9 out of 10", 90/100, 4.5/5, 95%, and a bare 0-10 number.
  function parse(text) {
    const t = String(text == null ? '' : text).replace(/[⁄∕／]/g, '/').replace(/ /g, ' ');
    let m = /(\d+(?:[.,]\d+)?)\s*(?:\/|out\s+of)\s*(\d+(?:[.,]\d+)?)/i.exec(t);
    if (m) { const a = num(m[1]), d = num(m[2]); if (d > 0 && a <= d) return Math.round((a / d) * 100) / 10; }
    m = /(\d+(?:[.,]\d+)?)\s*%/.exec(t);
    if (m && num(m[1]) <= 100) return Math.round(num(m[1])) / 10;
    m = /^\D*?(\d+(?:[.,]\d+)?)\D*$/.exec(t);      // only one number in the whole tag, e.g. "Masterpiece 9"
    if (m && num(m[1]) <= 10) return num(m[1]);
    return null;
  }

  function tier(text) {
    const n = parse(text);
    if (n == null) return null;
    for (const t of TIERS) if (n >= t.min) return { score: n, color: t.color, name: t.name };
    return null;
  }
  const color = (text) => { const t = tier(text); return t ? t.color : null; };

  return { TIERS, parse, tier, color };
}));
