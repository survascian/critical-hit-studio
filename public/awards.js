'use strict';
// Special awards for Critical Hit List entries (GOTY, Best Horror 2025, Best Horror of All Time...).
// They are NOT scores: they mark an entry as special without changing where it ranks.
// Shared by the Hit List (draws the emblems), the Planner (planned awards) and the tests.
// To add a category, add a line to CATS (and an icon to ICONS if you want a new picture).
// To add a look, add it to STYLES and give it a drawing in EMBLEMS.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_AWARDS = api;
}(typeof self !== 'undefined' ? self : this, function () {
  const MAX = 2;                       // awards shown per entry; raise it here if you want more
  const GOLD = '#FFC700';
  const CATS = [
    { id: 'goty',      label: 'Game of the Year', short: 'GOTY',      color: GOLD,      icon: 'trophy', yearOnly: true },
    { id: 'action',    label: 'Best Action',      short: 'ACTION',    color: '#FB923C', icon: 'sword' },
    { id: 'adventure', label: 'Best Adventure',   short: 'ADVENTURE', color: '#22D3EE', icon: 'compass' },
    { id: 'horror',    label: 'Best Horror',      short: 'HORROR',    color: '#FF4D4D', icon: 'skull' },
    { id: 'rpg',       label: 'Best RPG',         short: 'RPG',       color: '#A78BFA', icon: 'shield' },
    { id: 'indie',     label: 'Best Indie',       short: 'INDIE',     color: '#2ECC71', icon: 'pad' },
    { id: 'story',     label: 'Best Story',       short: 'STORY',     color: '#F472B6', icon: 'book' },
    { id: 'custom',    label: 'Custom award',     short: 'AWARD',     color: '#DDE3EE', icon: 'star', custom: true }
  ];
  const byId = (id) => CATS.find((c) => c.id === id) || null;

  // The looks. Every one is drawn in code, so there are no image files to lose.
  const STYLES = [
    { id: 'laurel', label: 'Laurel wreath' },
    { id: 'medal',  label: 'Medal' },
    { id: 'hex',    label: 'Neon hex' }
  ];
  // How the awards sit on an entry. '' in an entry's settings means "use the default" (first value of each list).
  const LAYOUT_OPTIONS = {
    arrange: [['row', 'Side by side'], ['stack', 'Stacked']],
    size:    [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']],
    side:    [['right', 'Right of the entry'], ['left', 'Left, before the title']],
    text:    [['full', 'Icon + text'], ['icon', 'Icon only']]
  };
  // Every Hit List entry has the same fixed height, so awards are scaled to fit inside it:
  // one row of awards is at most 83px tall, two stacked awards are at most 83px tall together.
  const SCALE = { row: { sm: 0.8, md: 1, lg: 1.3 }, stack: { sm: 0.46, md: 0.54, lg: 0.62 } };

  // 24x24 pictures drawn inside the emblem (stroke icons, they take the award colour)
  const ICONS = {
    trophy:  '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4"/>',
    sword:   '<path d="M19 5 8.5 15.5M14 5h5v5M7 12l5 5M5 19l2-2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    skull:   '<path d="M12 3a7 7 0 0 0-7 7c0 2.2 1 4 2.5 5.2V19h9v-3.8C18 14 19 12.2 19 10a7 7 0 0 0-7-7z"/><circle cx="9.2" cy="11" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11" r="1.5" fill="currentColor" stroke="none"/><path d="M10 19v-2.2M12 19v-2.2M14 19v-2.2"/>',
    shield:  '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
    pad:     '<path d="M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2L14.5 14h-5l-1.3 1A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4z"/><path d="M8 10.5v3M6.5 12h3M16 11h.01M18 13h.01"/>',
    book:    '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h6"/>',
    star:    '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Clean up a list that came from a form, a file or an old version. Unknown categories are dropped.
  function normalize(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((a) => {
      if (!a || typeof a !== 'object') return;
      const cat = byId(a.cat); if (!cat) return;
      const scope = cat.yearOnly ? 'year' : (a.scope === 'alltime' ? 'alltime' : 'year');
      const year = scope === 'year' && /^\d{4}$/.test(String(a.year || '').trim()) ? String(a.year).trim() : '';
      const text = cat.custom ? String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 24) : '';
      const item = { cat: cat.id, scope, year, text };
      if (out.some((o) => o.cat === item.cat && o.scope === item.scope && o.year === item.year && o.text === item.text)) return;
      out.push(item);
    });
    return out.slice(0, MAX);
  }

  // The per-entry layout. Anything missing or unknown becomes '' (= use the default).
  function normalizeLayout(l) {
    l = l && typeof l === 'object' ? l : {};
    const pick = (v, allowed) => (allowed.includes(v) ? v : '');
    return {
      style: pick(l.style, STYLES.map((s) => s.id)),
      arrange: pick(l.arrange, LAYOUT_OPTIONS.arrange.map((o) => o[0])),
      size: pick(l.size, LAYOUT_OPTIONS.size.map((o) => o[0])),
      side: pick(l.side, LAYOUT_OPTIONS.side.map((o) => o[0])),
      text: pick(l.text, LAYOUT_OPTIONS.text.map((o) => o[0]))
    };
  }
  // Fill the blanks with defaults. defaultStyle comes from the Hit List's Awards setting.
  function resolveLayout(l, defaultStyle) {
    const n = normalizeLayout(l);
    const ds = STYLES.some((s) => s.id === defaultStyle) ? defaultStyle : 'laurel';
    return { style: n.style || ds, arrange: n.arrange || 'row', size: n.size || 'md', side: n.side || 'right', text: n.text || 'full' };
  }

  // What to print for one award: two text lines, a colour and an icon. All-time awards are gold.
  function describe(a) {
    const cat = byId(a && a.cat); if (!cat) return null;
    const allTime = !cat.yearOnly && a.scope === 'alltime';
    let line1, line2;
    if (cat.id === 'goty') { line1 = 'GAME OF THE YEAR'; line2 = a.year || ''; }
    else if (cat.custom) { line1 = (a.text || 'AWARD').toUpperCase(); line2 = allTime ? 'OF ALL TIME' : (a.year || ''); }
    else { line1 = 'BEST ' + cat.short; line2 = allTime ? 'OF ALL TIME' : (a.year || 'OF THE YEAR'); }
    return { cat: cat.id, line1, line2, color: allTime ? GOLD : cat.color, icon: cat.icon, gold: allTime || cat.id === 'goty', allTime };
  }
  const label = (a) => { const d = describe(a); return d ? (d.line2 ? d.line1 + ' ' + d.line2 : d.line1) : ''; };

  // ---- the three looks (72x72 drawings) ----
  const iconG = (color, iconKey, x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" style="color:${color}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconKey] || ICONS.star}</g>`;

  function laurelSvg(color, iconKey) {
    const R = 27, N = 7; let side = '';
    for (let i = 0; i < N; i++) {
      const deg = 100 + i * (135 / (N - 1)), th = deg * Math.PI / 180;
      [[R + 2.6, deg + 30], [R - 2.6, deg - 30]].forEach(([r, rot]) => {
        const x = (36 + r * Math.cos(th)).toFixed(2), y = (36 + r * Math.sin(th)).toFixed(2);
        side += `<ellipse cx="${x}" cy="${y}" rx="2.9" ry="6.2" transform="rotate(${rot.toFixed(1)} ${x} ${y})"/>`;
      });
    }
    const a0 = 100 * Math.PI / 180, a1 = 235 * Math.PI / 180;
    const p = (a) => (36 + R * Math.cos(a)).toFixed(2) + ' ' + (36 + R * Math.sin(a)).toFixed(2);
    const stem = `<path d="M${p(a0)} A${R} ${R} 0 0 1 ${p(a1)}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`;
    const branch = `<g fill="${color}">${side}</g>${stem}`;
    return `<svg class="aw-emblem aw-laurel" viewBox="0 0 72 72" aria-hidden="true">${branch}<g transform="translate(72 0) scale(-1 1)">${branch}</g>${iconG(color, iconKey, 21.6, 21.6, 1.2)}</svg>`;
  }

  // A round medal on two ribbon tails
  function medalSvg(color, iconKey) {
    const tail = `<polygon points="25,44 17,70 27,64 33,70 38,46" fill="${color}" fill-opacity=".72" stroke="#000" stroke-opacity=".35" stroke-width="1"/>`;
    return `<svg class="aw-emblem aw-medal" viewBox="0 0 72 72" aria-hidden="true">${tail}<g transform="translate(72 0) scale(-1 1)">${tail}</g>` +
      `<circle cx="36" cy="30" r="24" fill="${color}"/><circle cx="36" cy="30" r="24" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1"/>` +
      `<circle cx="36" cy="30" r="19" fill="#0d1017"/><circle cx="36" cy="30" r="19" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="2 3" opacity=".7"/>` +
      `<path d="M20 22a18 18 0 0 1 14-9" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>` +
      iconG(color, iconKey, 24, 18, 1) + '</svg>';
  }

  // A glowing hexagon, esports style
  function hexSvg(color, iconKey) {
    const hex = (r) => [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 180) * (60 * i - 90); return (36 + r * Math.cos(a)).toFixed(1) + ',' + (36 + r * Math.sin(a)).toFixed(1); }).join(' ');
    const dots = [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 180) * (60 * i - 90); return `<circle cx="${(36 + 29 * Math.cos(a)).toFixed(1)}" cy="${(36 + 29 * Math.sin(a)).toFixed(1)}" r="2" fill="${color}"/>`; }).join('');
    return `<svg class="aw-emblem aw-hex" viewBox="0 0 72 72" aria-hidden="true">` +
      `<polygon points="${hex(28)}" fill="${color}" fill-opacity=".14" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/>` +
      `<polygon points="${hex(21)}" fill="none" stroke="${color}" stroke-opacity=".5" stroke-width="1"/>${dots}` +
      iconG(color, iconKey, 24, 24, 1) + '</svg>';
  }
  const EMBLEMS = { laurel: laurelSvg, medal: medalSvg, hex: hexSvg };
  const emblem = (style, color, iconKey) => (EMBLEMS[style] || laurelSvg)(color, iconKey);

  // The flashy "pop" adds sparks and a ring round the emblem
  const sparks = () => Array.from({ length: 10 }, (_, i) => `<i class="aw-spark" style="--a:${i * 36}deg;--d:${44 + (i % 3) * 12}px"></i>`).join('');

  // HTML for one entry's awards, wrapped with its layout. Returns { side, html, layout }.
  //   opts.defaultStyle  the style to use when the entry has none of its own
  //   opts.reveal        true = quiet entrance after the entry animation, 'pop' = the flashy pop
  //   opts.held          true = draw the awards invisibly, holding their space (they are popped in later)
  function renderWrap(list, layout, opts) {
    opts = opts || {};
    const awards = normalize(list);
    const L = resolveLayout(layout, opts.defaultStyle);
    if (!awards.length) return { side: L.side, html: '', layout: L };
    const scale = SCALE[L.arrange][L.size].toFixed(3);
    const units = awards.map((a, i) => {
      const d = describe(a);
      const cls = 'aw' + (d.allTime ? ' aw-alltime' : '') + (opts.reveal === 'pop' ? ' aw-pop' : opts.reveal ? ' aw-reveal' : '');
      return `<div class="${cls}" style="--aw:${d.color};--dl:${(i * 0.3).toFixed(2)}s" title="${esc(label(a))}">` +
        emblem(L.style, d.color, d.icon) + (opts.reveal === 'pop' ? sparks() : '') +
        (L.text === 'full' ? `<div class="aw-text"><span class="aw-l1">${esc(d.line1)}</span>${d.line2 ? `<span class="aw-l2">${esc(d.line2)}</span>` : ''}</div>` : '') + '</div>';
    }).join('');
    const html = `<div class="aw-wrap aw-${L.arrange} aw-th-${L.style}${opts.held ? ' aw-held' : ''}" data-side="${L.side}" style="--aws:${scale}">${units}</div>`;
    return { side: L.side, html, layout: L };
  }

  // ---- styles (injected once, so the Hit List and the Planner both get them) ----
  const CSS = `
.aw-wrap{display:flex;align-items:center;gap:14px;flex:none;zoom:var(--aws,1)}
.aw-wrap.aw-stack{flex-direction:column;align-items:flex-start;gap:4px}
.aw-wrap.aw-held{visibility:hidden}   /* waiting for the pop: invisible, but it keeps its space so nothing moves or refits when it appears */
.aw{position:relative;display:flex;align-items:center;gap:7px;flex:none;color:var(--aw,#FFC700);filter:drop-shadow(0 2px 3px rgba(0,0,0,.75)) drop-shadow(0 0 1px rgba(0,0,0,.9))}
.aw-emblem{width:64px;height:64px;flex:none;display:block}
.aw-th-hex .aw-emblem{filter:drop-shadow(0 0 5px var(--aw))}
.aw-text{display:flex;flex-direction:column;gap:2px;line-height:1;max-width:150px}
.aw-l1{font:700 10px 'Orbitron',sans-serif;letter-spacing:.12em;color:#f2f4f8;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 2px #000}
.aw-l2{font:900 20px 'Orbitron',sans-serif;letter-spacing:.04em;color:var(--aw);white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 2px #000}
.aw-th-medal .aw-l2{letter-spacing:.09em}
.aw-th-hex .aw-l1{color:var(--aw)}
.aw-th-hex .aw-l2{color:#fff;text-shadow:0 0 10px var(--aw),0 0 3px var(--aw),0 1px 2px #000}
.aw-alltime .aw-emblem{animation:awGlow 3.2s ease-in-out infinite}
@keyframes awGlow{0%,100%{filter:drop-shadow(0 0 2px rgba(255,199,0,.35))}50%{filter:drop-shadow(0 0 9px rgba(255,199,0,.95))}}
.aw-reveal{animation:awPop .7s cubic-bezier(.2,1.4,.4,1) 1s both}
@keyframes awPop{0%{opacity:0;transform:scale(.4) rotate(-8deg)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:none}}
/* the flashy pop: spin in big and bright, ring, sparks, then settle */
.aw-pop{animation:awFlair 1.05s cubic-bezier(.2,1.5,.35,1) var(--dl,0s) both}
@keyframes awFlair{
 0%{opacity:0;transform:scale(.15) rotate(-40deg);filter:brightness(5)}
 35%{opacity:1;transform:scale(1.28) rotate(7deg);filter:brightness(2.6) drop-shadow(0 0 26px var(--aw))}
 58%{transform:scale(.9) rotate(-4deg);filter:brightness(1.5) drop-shadow(0 0 14px var(--aw))}
 78%{transform:scale(1.07) rotate(1deg)}
 100%{opacity:1;transform:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.75)) drop-shadow(0 0 1px rgba(0,0,0,.9))}}
.aw-pop::before{content:'';position:absolute;left:0;top:50%;width:64px;height:64px;margin-top:-32px;border-radius:50%;border:3px solid var(--aw);box-shadow:0 0 18px var(--aw);opacity:0;animation:awRing .9s ease-out calc(var(--dl,0s) + .08s) both;pointer-events:none}
@keyframes awRing{0%{opacity:.95;transform:scale(.4)}100%{opacity:0;transform:scale(3.1)}}
.aw-spark{position:absolute;left:32px;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--aw);box-shadow:0 0 8px var(--aw);opacity:0;pointer-events:none;animation:awSpark .95s ease-out calc(var(--dl,0s) + .1s) both}
@keyframes awSpark{0%{opacity:1;transform:rotate(var(--a)) translateX(8px) scale(1.3)}100%{opacity:0;transform:rotate(var(--a)) translateX(var(--d)) scale(.1)}}
.aw-flash{position:absolute;inset:0;z-index:35;pointer-events:none;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.75) 50%,transparent 70%);transform:translateX(-110%);animation:awSweep .95s ease-out forwards}
@keyframes awSweep{to{transform:translateX(110%)}}
@media (prefers-reduced-motion:reduce){.aw-alltime .aw-emblem,.aw-reveal,.aw-pop,.aw-pop::before,.aw-spark,.aw-flash{animation:none}.aw-spark,.aw-flash{display:none}}
.awx{display:flex;flex-direction:column;gap:8px;font:600 14px 'Rajdhani',system-ui,sans-serif;color:#d5dbe8}
.awx-list{display:flex;flex-wrap:wrap;gap:6px;min-height:6px}
.awx-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 4px 3px 9px;border-radius:999px;border:1px solid var(--aw);background:#0f1117;color:#f2f4f8;font-size:13px}
.awx-chip i{width:8px;height:8px;border-radius:50%;background:var(--aw);display:inline-block}
.awx-chip button{all:unset;cursor:pointer;width:20px;height:20px;border-radius:50%;text-align:center;line-height:20px;color:#8e96a8}
.awx-chip button:hover{background:#2a2f3d;color:#fff}
.awx-add{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.awx select,.awx input{background:#0f1117;color:#f2f4f8;border:1px solid #2a2f3d;border-radius:8px;padding:6px 8px;font:600 14px 'Rajdhani',system-ui,sans-serif;min-width:0}
.awx-add input.awx-year{width:70px}.awx-add input.awx-text{width:150px}
.awx-add button{background:#1d212b;color:#ffc700;border:1px solid rgba(255,199,0,.45);border-radius:8px;padding:6px 12px;font:700 12px 'Orbitron',sans-serif;letter-spacing:.08em;cursor:pointer}
.awx-add button:hover{background:rgba(255,199,0,.12)}
.awx-note{font-size:12px;color:#8e96a8}
.awx-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;padding-top:4px;border-top:1px solid #2a2f3d}
.awx-layout label{display:flex;flex-direction:column;gap:3px;font:700 10px 'Orbitron',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#ffc700}
.awx-layout select{font-size:13px}
.awx-preview{background:#0b0d12;border:1px solid #2a2f3d;border-radius:10px;padding:10px 14px;display:flex;justify-content:flex-end;min-height:84px;align-items:center;overflow:hidden}
.awx [hidden]{display:none!important}
`;
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('chl-awards-css')) return;
    const s = document.createElement('style'); s.id = 'chl-awards-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s);
  }

  // A small editor: chips for the awards already set, one row to add another, and (optionally) the layout
  // controls with a live preview. mountEditor(hostElement, { onChange(list, layout), layout: true, defaultStyle: () => 'laurel' })
  //   -> { get(), set(list), getLayout(), setLayout(layout) }
  function mountEditor(host, opts) {
    injectCss();
    opts = opts || {};
    const withLayout = opts.layout !== false && opts.layout !== undefined ? !!opts.layout : false;
    let list = [], layout = normalizeLayout({});
    host.classList.add('awx');
    const sel = (k, title, choices, first) => `<label>${title}<select data-l="${k}"><option value="">${first}</option>${choices.map((c) => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></label>`;
    host.innerHTML = '<div class="awx-list"></div>' +
      '<div class="awx-add"><select data-k="cat"></select><select data-k="scope"><option value="year">Of the year</option><option value="alltime">Of all time</option></select>' +
      '<input data-k="year" class="awx-year" inputmode="numeric" maxlength="4" placeholder="Year"><input data-k="text" class="awx-text" maxlength="24" placeholder="Award name" hidden><button type="button" data-k="add">+ ADD</button></div>' +
      '<div class="awx-note"></div>' +
      (withLayout ? '<div class="awx-layout" hidden>' + sel('style', 'Look', STYLES.map((s) => [s.id, s.label]), 'Default (Hit List setting)') + sel('arrange', 'Arrangement', LAYOUT_OPTIONS.arrange, 'Default (side by side)') +
        sel('size', 'Size', LAYOUT_OPTIONS.size, 'Default (medium)') + sel('side', 'Position', LAYOUT_OPTIONS.side, 'Default (right)') + sel('text', 'Labels', LAYOUT_OPTIONS.text, 'Default (icon + text)') + '</div><div class="awx-preview" hidden></div>' : '');
    const q = (k) => host.querySelector('[data-k="' + k + '"]');
    q('cat').innerHTML = CATS.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
    q('year').value = String(new Date().getFullYear());

    function sync() {
      const cat = byId(q('cat').value);
      q('scope').disabled = !!cat.yearOnly; if (cat.yearOnly) q('scope').value = 'year';
      q('year').hidden = q('scope').value === 'alltime';
      q('text').hidden = !cat.custom;
    }
    function draw() {
      host.querySelector('.awx-list').innerHTML = list.map((a, i) => { const d = describe(a); return `<span class="awx-chip" style="--aw:${d.color}"><i></i>${esc(label(a))}<button type="button" data-rm="${i}" title="Remove" aria-label="Remove award">✕</button></span>`; }).join('');
      const full = list.length >= MAX;
      host.querySelector('.awx-add').style.display = full ? 'none' : '';
      host.querySelector('.awx-note').textContent = full ? `Up to ${MAX} awards per game. Remove one to add another.` : (list.length ? '' : 'No awards. Awards show on the right of the entry and never change its rank.');
      if (withLayout) {
        const lay = host.querySelector('.awx-layout'), pre = host.querySelector('.awx-preview');
        lay.hidden = pre.hidden = !list.length;
        Object.keys(layout).forEach((k) => { const s = lay.querySelector('[data-l="' + k + '"]'); if (s) s.value = layout[k]; });
        if (list.length) pre.innerHTML = renderWrap(list, layout, { defaultStyle: opts.defaultStyle ? opts.defaultStyle() : 'laurel' }).html;
      }
    }
    const changed = () => { if (opts.onChange) opts.onChange(list.slice(), Object.assign({}, layout)); };
    host.addEventListener('change', (e) => {
      if (e.target === q('cat') || e.target === q('scope')) sync();
      if (e.target.dataset && e.target.dataset.l) { layout = normalizeLayout(Object.assign({}, layout, { [e.target.dataset.l]: e.target.value })); draw(); changed(); }
    });
    host.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { list.splice(+rm.dataset.rm, 1); draw(); changed(); return; }
      if (e.target.closest('[data-k="add"]')) {
        const next = normalize(list.concat([{ cat: q('cat').value, scope: q('scope').value, year: q('year').value, text: q('text').value }]));
        if (next.length === list.length) return;           // duplicate or full: nothing to add
        list = next; draw(); changed();
      }
    });
    sync(); draw();
    return {
      get: () => list.slice(),
      set: (l) => { list = normalize(l); draw(); },
      getLayout: () => Object.assign({}, layout),
      setLayout: (l) => { layout = normalizeLayout(l); draw(); }
    };
  }

  injectCss();
  return { MAX, CATS, STYLES, LAYOUT_OPTIONS, ICONS, normalize, normalizeLayout, resolveLayout, describe, label, emblem, renderWrap, mountEditor };
}));
