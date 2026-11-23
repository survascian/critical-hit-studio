'use strict';
// Video planning helpers (v1.9.0): customizable formats, optional scratchpad + take/cold open, packaging,
// monthly/yearly recap, "stuck" detection, stage-time forecast, upload buffer and journal helpers.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_PLAN = api;
}(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;
  const MAX_NOTES = 20000;

  const FORMATS = [
    { id: 'hitlist',  label: 'Critical Hit List', short: 'HIT LIST', color: '#FFC700' },
    { id: 'bite',     label: 'Critical Bite',     short: 'BITE',     color: '#FB923C' },
    { id: 'supercut', label: 'Supercut',          short: 'SUPERCUT', color: '#A78BFA' },
    { id: 'funny',    label: 'Funny Moments',     short: 'FUNNY',    color: '#22D3EE' }
  ];
  const rid = () => Math.random().toString(36).slice(2, 8);
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);

  function normalizeFormats(list) {
    if (!Array.isArray(list) || !list.length) return FORMATS.map((f) => Object.assign({}, f));
    const out = []; const seen = new Set();
    list.forEach((f) => {
      if (!f || typeof f !== 'object') return;
      const label = str(f.label, 32).trim(); if (!label) return;
      const id = str(f.id, 24).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || ('f_' + rid());
      if (seen.has(id)) return;
      seen.add(id);
      const short = (str(f.short, 14).trim() || label.slice(0, 10)).toUpperCase();
      const color = /^#[0-9a-f]{6}$/i.test(String(f.color || '').trim()) ? String(f.color).trim() : '#FFC700';
      out.push({ id, label, short, color });
    });
    return out.length ? out.slice(0, 16) : FORMATS.map((f) => Object.assign({}, f));
  }
  const formatOf = (id, list) => (Array.isArray(list) && list.length ? list : FORMATS).find((f) => f.id === id) || null;
  function gameFormats(g) {
    if (!g) return [];
    const arr = Array.isArray(g.formats) && g.formats.length ? g.formats : (g.format ? [g.format] : []);
    return [...new Set(arr.map((x) => String(x || '').trim()).filter(Boolean))];
  }
  // old tags/series text -> format, used once when a game has no format yet
  const guessFormat = (tags) => { const t = (tags || []).join(' ').toLowerCase(); return /bite/.test(t) ? 'bite' : /super\s*cut/.test(t) ? 'supercut' : /funny|moments/.test(t) ? 'funny' : /hit\s*list|critical hit/.test(t) ? 'hitlist' : ''; };

  // Fold any legacy v1.7/1.8 moments into plain scratchpad lines so existing user notes are never lost
  function migrateMoments(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list.map((m) => {
      if (!m || typeof m !== 'object') return '';
      const time = str(m.time, 24).trim(), text = str(m.text, 280).trim();
      if (!time && !text) return '';
      return '- ' + (time ? '[' + time + '] ' : '') + text;
    }).filter(Boolean).join('\n');
  }

  function normalize(p) {
    p = p && typeof p === 'object' ? p : {};
    const f = p.f && typeof p.f === 'object' ? p.f : {};
    const angle = str(p.angle != null && p.angle !== '' ? p.angle : f.angle, 400);
    const hook = str(p.hook != null && p.hook !== '' ? p.hook : f.hook, 400);
    const notes = p.notes != null ? str(p.notes, MAX_NOTES) : str(migrateMoments(p.moments), MAX_NOTES);
    const titles = [0, 1, 2].map((i) => str(p.titles && p.titles[i], 120));
    const thumbs = [0, 1, 2].map((i) => str(p.thumbs && p.thumbs[i], 300));
    const thumbDates = [0, 1, 2].map((i) => Number(p.thumbDates && p.thumbDates[i]) || 0);
    return {
      angle, hook, notes, titles, thumb: str(p.thumb, 300),
      chosen: [0, 1, 2].includes(p.chosen) ? p.chosen : -1,
      thumbs,
      thumbDates,
      chosenThumb: [0, 1, 2].includes(p.chosenThumb) ? p.chosenThumb : -1
    };
  }
  const isEmpty = (p) => { p = normalize(p); return !(p.angle.trim() || p.hook.trim() || p.notes.trim() || p.titles.some(Boolean) || p.thumb || p.thumbs.some(Boolean)); };

  // ---- monthly / yearly recap
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function pubDateOf(g) {
    if (!g || g.stage !== 'Published') return '';
    const d = g.publishedAt || (g.video && g.video.publishedAt ? String(g.video.publishedAt).slice(0, 10) : '') || g.dueDate || '';
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
  }
  function recap(games, mode, year, month, formats) {
    const y = String(year || new Date().getFullYear());
    const m = mode === 'month' ? String(month || (new Date().getMonth() + 1)).padStart(2, '0') : '';
    const prefix = mode === 'month' ? `${y}-${m}` : y;
    const list = (games || []).filter((g) => pubDateOf(g).startsWith(prefix))
      .sort((a, b) => pubDateOf(b).localeCompare(pubDateOf(a)));
    const hours = Math.round(list.reduce((s, g) => s + (Number(g.hoursPlayed) || 0), 0) * 10) / 10;
    const views = list.reduce((s, g) => s + ((g.video && Number(g.video.views)) || 0), 0);
    const awards = [];
    list.forEach((g) => { (Array.isArray(g.awards) ? g.awards : []).forEach((a) => awards.push({ game: g.name, award: a })); });
    const fmts = Array.isArray(formats) && formats.length ? formats : FORMATS;
    const byFormat = fmts.map((f) => ({ label: f.label, color: f.color, v: list.filter((g) => gameFormats(g).includes(f.id)).length })).filter((r) => r.v > 0);
    const topViews = list.filter((g) => g.video && g.video.views != null).sort((a, b) => b.video.views - a.video.views).slice(0, 5);
    const periodLabel = mode === 'month' ? `${MONTHS[Math.max(0, Math.min(11, (+m || 1) - 1))]} ${y}` : y;
    return { mode, year: y, month: m, periodLabel, count: list.length, games: list, hours, views, awards, byFormat, topViews };
  }

  // ---- journal entries
  function normJournal(e) {
    e = e && typeof e === 'object' ? e : {};
    const now = Date.now();
    return { id: str(e.id, 16) || rid(), title: str(e.title, 120), date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : '', text: str(e.text, 60000),
      games: [...new Set((Array.isArray(e.games) ? e.games : []).map((x) => str(x, 40)).filter(Boolean))].slice(0, 40),
      createdAt: Number.isFinite(+e.createdAt) && +e.createdAt > 0 ? +e.createdAt : now, updatedAt: Number.isFinite(+e.updatedAt) && +e.updatedAt > 0 ? +e.updatedAt : now };
  }
  const sortJournal = (list) => (list || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.createdAt - x.createdAt);

  // ---- time in stage
  const stageSince = (g) => { const h = g && Array.isArray(g.history) && g.history.length ? g.history[g.history.length - 1] : null; return h ? h.at : (g && (g.stageChangedAt || g.createdAt)) || null; };
  function stuckDays(g, now) { const at = stageSince(g); return at == null ? 0 : Math.max(0, Math.floor(((now == null ? Date.now() : now) - at) / DAY)); }
  const WORK = ['Recording', 'Writing', 'Editing', 'Reviewing'];
  // chip only for the working stages; warns from `warn` days (default 7), red from `bad` (default 14)
  function stuck(g, now, warn, bad) {
    if (!g || !WORK.includes(g.stage)) return null;
    const d = stuckDays(g, now); const w = warn || 7, b = bad || 14;
    return { days: d, level: d >= b ? 'bad' : d >= w ? 'warn' : 'ok' };
  }

  const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // days each game spent in each stage, from completed history stretches only
  function stageDurations(games) {
    const out = {};
    (games || []).forEach((g) => {
      const h = Array.isArray(g.history) ? g.history : [];
      for (let i = 0; i + 1 < h.length; i++) { const d = (h[i + 1].at - h[i].at) / DAY; if (d >= 0) (out[h[i].stage] = out[h[i].stage] || []).push(d); }
    });
    return out;
  }
  // Rough days left for a game, only when at least `min` finished games back up every remaining stage.
  function forecast(g, games, min) {
    min = min || 3;
    const order = ['Recording', 'Writing', 'Editing', 'Reviewing'];
    const i = order.indexOf(g && g.stage); if (i < 0) return null;
    const dur = stageDurations((games || []).filter((x) => x.id !== g.id));
    let total = 0;
    for (let k = i; k < order.length; k++) {
      const a = dur[order[k]] || []; if (a.length < min) return null;
      const med = median(a);
      total += k === i ? Math.max(0, med - stuckDays(g)) : med;
    }
    return { days: Math.round(total) };
  }

  // ---- upload cadence (days are JS getDay(): 0 Sun .. 6 Sat)
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const cleanDays = (a) => [...new Set((Array.isArray(a) ? a : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  const isSlot = (isoStr, days) => { const d = parse(isoStr); return !!d && cleanDays(days).includes(d.getDay()); };
  function nextSlots(days, fromIso, n) {
    days = cleanDays(days); const out = []; const d = parse(fromIso) || new Date();
    if (!days.length) return out;
    for (let i = 0; i < 400 && out.length < n; i++) { if (days.includes(d.getDay())) out.push(iso(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  // Videos sitting in the "ready" stage (or later but unpublished) and how many days of uploads they cover.
  function buffer(games, readyStage, days) {
    const order = ['Backlogged', 'Planned', 'Recording', 'Writing', 'Editing', 'Reviewing', 'Published'];
    const at = order.indexOf(readyStage || 'Reviewing');
    const ready = (games || []).filter((g) => { const i = order.indexOf(g.stage); return i >= at && i < order.indexOf('Published'); });
    const per = cleanDays(days).length;
    return { ready: ready.length, days: per ? Math.round((ready.length * 7) / per) : null, perWeek: per };
  }
  return { normJournal, sortJournal, FORMATS, normalizeFormats, formatOf, gameFormats, guessFormat, normalize, isEmpty, MONTHS, pubDateOf, recap, stageSince, stuckDays, stuck, stageDurations, forecast, cleanDays, isSlot, nextSlots, buffer, median, rid };
}));
