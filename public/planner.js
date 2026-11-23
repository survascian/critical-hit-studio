'use strict';
// Critical Hit Studio - Planner (Trello-style board for video-game content)

const STAGES = [
  { id: 'Backlogged', color: '#8b93a7' },
  { id: 'Planned',    color: '#4da3ff' },
  { id: 'Recording',  color: '#e60000' },
  { id: 'Writing',    color: '#ffc700' },
  { id: 'Editing',    color: '#b36bff' },
  { id: 'Reviewing',  color: '#22d3ee' },
  { id: 'Published',  color: '#2ecc71' },
  { id: 'Shelved',    color: '#6b7280' },
  { id: 'Cancelled',  color: '#b91c1c' }
];
const ARCHIVED = ['Shelved', 'Cancelled'];
const DONE_STAGES = ['Published', 'Shelved', 'Cancelled'];   // no due-date warnings once a game is here

// The to-do list a game gets when it enters a stage. Editable in Settings; these are only the starting suggestions.
const DEFAULT_TEMPLATES = {
  Backlogged: [],
  Planned:   ['Decide the video format', 'Set a target date'],   // Planned = committed to playing it, so no platform or embargo chores
  Recording: ['Gameplay captured', 'Voiceover recorded', 'Extra footage / B-roll'],
  Writing:   ['Outline', 'First draft', 'Fact-check', 'Final script'],
  Editing:   ['Rough cut', 'Music and sound', 'Thumbnail', 'Title and description'],
  Reviewing: ['Watch-through', 'Fix notes', 'Captions', 'Schedule the upload'],
  Published: ['Pin a comment', 'Add to the Critical Hit List', 'Reply to comments']
};
const OLD_PLANNED = ['Pick the platform', 'Check release and embargo dates'];
const TEMPLATE_STAGES = ['Backlogged', 'Planned', 'Recording', 'Writing', 'Editing', 'Reviewing', 'Published'];

const P = CHL_PLATFORMS;   // shared platform list (platforms.js)
const GN = CHL_GENRES;     // which genre comes first (genres.js)
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const safeUrl = (u) => (/^(\/media\/|https?:\/\/)/.test(u || '') ? u : '');
// single quotes: the result is placed inside double-quoted style="" attributes
const cssUrl = (u) => (safeUrl(u) ? `url('${safeUrl(u).replace(/['"<>\s]/g, (c) => encodeURIComponent(c))}')` : 'none');

let state = { version: 1, games: [], templates: null, display: null, cadence: null, journal: [], formats: null, ownerships: null };
const PL = CHL_PLAN;   // formats, scratchpad, recap, stuck/forecast, upload buffer (plan.js)
let appSettings = { igdbConfigured: false, igdbClientId: '', igdbHasSecret: false, youtubeHasKey: false, theme: 'default', accentColor: '#e60000', showHitList: true, useScores: false };
const DEFAULT_OWNERSHIPS = [{ id: 'owned', label: 'Owned', color: '#2ECC71' }, { id: 'shanks', label: 'Shanks', color: '#FB923C' }];
const formatsOf = () => PL.normalizeFormats(state.formats);
const formatById = (id) => PL.formatOf(id, formatsOf());
function ownershipsOf() {
  if (!Array.isArray(state.ownerships)) return DEFAULT_OWNERSHIPS;
  return state.ownerships.filter((o) => o && o.id && o.label);
}
const ownershipOf = (id) => ownershipsOf().find((o) => o.id === id) || null;
let qFormat = '', qPlatform = '', qSeries = '';
let view = 'board';          // board | calendar | stats
let hideArchived = false;
let simpleBoard = false;
let openId = null;           // game open in the detail drawer
let searchSeq = 0;

// ------------------------------------------------------------------ api / save
async function api(path, opts) {
  const r = await fetch(path, opts);
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch (e) { b = t; }
  if (!r.ok) throw new Error((b && b.error) || ('HTTP ' + r.status));
  return b;
}
const putJson = (path, obj) => api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

let saveTimer = null, dirty = false, saving = false, retryTimer = null, skipCloudPush = false;
let loaded = false;          // never save before the stored board has loaded, so a failed load can't wipe it
function setStatus(kind, msg) {
  const el = $('saveStatus');
  el.className = 'save-status' + (kind === 'saved' ? '' : ' ' + kind);
  el.textContent = kind === 'saving' ? 'Saving…' : kind === 'error' ? 'NOT SAVED' : 'Saved';
  el.title = msg || '';
}
function save(immediate) {
  dirty = true; setStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, immediate ? 0 : 350);
}
async function flush() {
  if (!loaded) { setStatus('error', 'Your board has not loaded, so nothing is being saved (this protects your data). Restart the app.'); return; }
  if (saving || !dirty) return;
  saving = true; dirty = false;
  const doCloud = !skipCloudPush; skipCloudPush = false;
  try {
    await putJson('/api/planner', state);
    if (doCloud && window.CHL_CLOUD && CHL_CLOUD.getUser()) {
      CHL_CLOUD.pushState(state).catch(() => {});
    }
    saving = false; setStatus(dirty ? 'saving' : 'saved'); if (dirty) flush();
  }
  catch (e) { saving = false; dirty = true; setStatus('error', e.message); clearTimeout(retryTimer); retryTimer = setTimeout(flush, 3000); }
}
window.addEventListener('pagehide', () => { if (dirty) { try { fetch('/api/planner', { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }); } catch (e) { /* best effort */ } } });

// ------------------------------------------------------------------ toast / confirm
let toastTimer = null;
function toast(msg, link, ms) {
  $('toastMsg').textContent = msg;
  const a = $('toastLink');
  if (link) { a.textContent = link.label; a.onclick = link.fn; a.classList.remove('hidden'); } else a.classList.add('hidden');
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), ms || 5000);
}
let confirmCb = null;
function confirmBox(msg, label, cb) { $('confirmMsg').textContent = msg; $('confirmYes').textContent = label || 'CONFIRM'; confirmCb = cb; openModal('confirmModal'); }
$('confirmYes').onclick = () => { closeModal('confirmModal'); const cb = confirmCb; confirmCb = null; if (cb) cb(); };

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); if (id === 'detailModal') { openId = null; renderBoard(); } }
function closeTopModal() {
  for (const id of ['confirmModal', 'thumbModal', 'wizardModal', 'artModal', 'sendModal', 'settingsModal', 'addModal', 'detailModal']) {
    if (!$(id).classList.contains('hidden')) { closeModal(id); return true; }
  }
  return false;
}
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('mousedown', (e) => { if (e.target === m) closeModal(m.id); });
  m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal(m.id)));
});

// ------------------------------------------------------------------ helpers for display
const findGame = (id) => state.games.find((g) => g.id === id);
const studioOf = (g) => (g.developers || []).join(', ');
const yearOf = (g) => (g.releaseDate ? g.releaseDate.slice(0, 4) : '');
function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function releaseChip(g) {
  const n = daysUntil(g.releaseDate);
  if (n === null) return '';
  if (n > 0 && g.stage !== 'Planned') return `<span class="chip up" title="${esc(g.releaseDate)}">OUT IN ${n}D</span>`;
  return `<span class="chip">${esc(yearOf(g))}</span>`;
}
function platChip(id) {
  const c = P.colorsOf(id); if (!c) return '';
  return `<span class="chip plat" style="--pc:${c.color};--pt:${c.text}" title="Played on ${esc(P.label(id, 'full'))}">${esc(P.label(id, 'short'))}</span>`;
}
// Dropdown of the allowed platforms, grouped by family and tinted with each family's colour.
// Platforms IGDB lists for this game are marked so you can tell which ones it exists on.
function fillPlatformSelect(sel, value, g) {
  const onIgdb = new Set(((g && g.platforms) || []).map((n) => P.detect(n)).filter(Boolean));
  let html = '<option value="">— Not set —</option>';
  Object.keys(P.FAMILIES).forEach((fam) => {
    const items = P.LIST.filter((p) => p.family === fam);
    if (!items.length) return;
    const f = P.FAMILIES[fam];
    html += `<optgroup label="${esc(f.label)}" style="color:${f.ink}">` + items.map((p) =>
      `<option value="${p.id}" style="color:${f.ink}">${esc(p.label)}${onIgdb.has(p.id) ? '   ·  on IGDB' : ''}</option>`).join('') + '</optgroup>';
  });
  sel.innerHTML = html; sel.value = value || '';
}
// Platforms IGDB lists for this game, narrowed to the ones in our list (no duplicates, our order)
function igdbPlatformIds(g) {
  const set = new Set(((g && g.platforms) || []).map((n) => P.detect(n)).filter(Boolean));
  return P.LIST.map((p) => p.id).filter((id) => set.has(id));
}
function renderPlatPreview(g) {
  const box = $('dPlatPreview');
  if (g.playedOn) box.innerHTML = platChip(g.playedOn) + `<span>${esc(P.label(g.playedOn, 'full'))}</span>`;
  else if (g.playedOnLegacy) box.textContent = `Previously typed: "${g.playedOnLegacy}". Pick a platform from the list.`;
  else box.textContent = 'Pick the platform you played on.';
  const ids = igdbPlatformIds(g);
  {
    const sug = ids.filter((id) => id !== g.playedOn);
    if (sug.length) box.insertAdjacentHTML('beforeend', `<div class="plat-suggest"><span class="lbl">On IGDB, tap to set:</span>${sug.map((id) => { const c = P.colorsOf(id); return `<button type="button" class="chip plat" data-suggest="${id}" style="--pc:${c.color};--pt:${c.text}" title="Set Played on to ${esc(P.label(id, 'full'))}">${esc(P.label(id, 'short'))}</button>`; }).join('')}</div>`);
  }
}
$('dPlatPreview').addEventListener('click', (e) => {
  const b = e.target.closest('[data-suggest]'); if (!b) return;
  const g = findGame(openId); if (!g) return;
  g.playedOn = b.dataset.suggest; delete g.playedOnLegacy;
  $('dPlayedOn').value = g.playedOn; renderPlatPreview(g); touch(g);
});

// ------------------------------------------------------------------ stages, history, checklists
const templatesOf = () => state.templates || DEFAULT_TEMPLATES;
const sameArr = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function ensureHistory(g) { if (!Array.isArray(g.history) || !g.history.length) g.history = [{ stage: g.stage, at: g.stageChangedAt || g.createdAt || Date.now() }]; }
function ensureChecks(g, stage) {
  if (!g.checks || typeof g.checks !== 'object') g.checks = {};
  if (!Array.isArray(g.checks[stage])) g.checks[stage] = (templatesOf()[stage] || []).map((t) => ({ t, done: false }));
}
function initGame(g) { ensureHistory(g); ensureChecks(g, g.stage); return g; }
// Every stage change goes through here so the history, the checklist and the publish date stay right
function setStage(g, stage) {
  if (g.stage === stage) return false;
  ensureHistory(g);
  g.stage = stage; g.stageChangedAt = Date.now(); g.history.push({ stage, at: g.stageChangedAt });
  ensureChecks(g, stage);
  if (stage === 'Published' && !g.publishedAt) g.publishedAt = todayIso();
  return true;
}
function promptSend(g) {
  if (!g || g.stage !== 'Published' || g.sentToHitList) return;
  toast(`"${g.name}" is Published`, { label: 'SEND TO HIT LIST', fn: () => { $('toast').classList.add('hidden'); openDetail(g.id); $('dSend').click(); } }, 12000);
}
function checkProgress(g, stage) {
  const list = (g.checks && g.checks[stage]) || [];
  return { done: list.filter((x) => x.done).length, total: list.length };
}
const daysSince = (ms) => Math.max(0, Math.floor((Date.now() - ms) / 86400000));
function stageSince(g) { ensureHistory(g); return g.history[g.history.length - 1].at; }
const compact = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n));
function ytId(v) {
  v = String(v || '').trim(); if (/^[\w-]{11}$/.test(v)) return v;
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(v) ? v : 'https://' + v); } catch (e) { return ''; }
  const host = u.hostname.replace(/^www\.|^m\./, ''); let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com') { if (u.pathname === '/watch') id = u.searchParams.get('v') || ''; else { const m = /^\/(shorts|live|embed|v)\/([\w-]{11})/.exec(u.pathname); if (m) id = m[2]; } }
  return /^[\w-]{11}$/.test(id) ? id : '';
}
function dueChip(g) {
  if (!g.dueDate || DONE_STAGES.includes(g.stage)) return '';
  const n = daysUntil(g.dueDate); if (n === null) return '';
  const d = new Date(g.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (n < 0) return `<span class="chip due over" title="Target date ${esc(g.dueDate)}">OVERDUE ${-n}D</span>`;
  if (n === 0) return '<span class="chip due today" title="Target date is today">DUE TODAY</span>';
  return `<span class="chip due" title="Target date ${esc(g.dueDate)}">DUE ${esc(d.toUpperCase())}</span>`;
}

// ---- Script links: Google Docs/Drive links OR local document files on this PC.
const GOOGLE_HOSTS = ['docs.google.com', 'drive.google.com'];
const SCRIPT_FILE_RE = /^([a-z]:[\\/]|\\\\[^\\]|\/).+\.(txt|md|docx|doc|odt|rtf|pdf|fountain|fdx)$/i;
function googleUrl(v) {
  v = String(v || '').trim(); if (!v || /^[a-z]:[\\/]|^\\\\|^\//i.test(v)) return '';
  if (!/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return u.protocol === 'https:' && GOOGLE_HOSTS.includes(u.hostname) ? u.href : ''; } catch (e) { return ''; }
}
function localScriptPath(v) {
  v = String(v || '').trim();
  return SCRIPT_FILE_RE.test(v) && !v.split(/[\\/]/).includes('..') ? v : '';
}
function hasValidScript(v) { return !!(googleUrl(v) || localScriptPath(v)); }
async function openScriptTarget(v) {
  const u = googleUrl(v);
  if (u) { window.open(u, '_blank', 'noopener'); return; }
  const p = localScriptPath(v);
  if (!p) return;
  if (window.chlDesktop && window.chlDesktop.openScript) {
    try { const r = await window.chlDesktop.openScript(p); if (!r.ok) toast(r.error); }
    catch (e) { toast('Could not open script: ' + e.message); }
  } else {
    toast('Opening local files only works in the desktop app.');
  }
}
const driveSearchUrl = (g) => 'https://drive.google.com/drive/search?q=' + encodeURIComponent((g.name || '') + ' type:document');
function renderLinks(g) {
  const s = googleUrl(g.scriptUrl), loc = localScriptPath(g.scriptUrl), sh = googleUrl(g.sheetUrl);
  const openBtn = $('dScriptOpen');
  if (s) { openBtn.href = s; openBtn.classList.remove('disabled'); openBtn.onclick = null; }
  else if (loc) { openBtn.href = '#'; openBtn.classList.remove('disabled'); openBtn.onclick = (e) => { e.preventDefault(); openScriptTarget(loc); }; }
  else { openBtn.removeAttribute('href'); openBtn.classList.add('disabled'); openBtn.onclick = null; }
  $('dScriptPick').classList.toggle('hidden', !window.chlDesktop);
  const shBtn = $('dSheetOpen');
  if (sh) { shBtn.href = sh; shBtn.classList.remove('disabled'); } else { shBtn.removeAttribute('href'); shBtn.classList.add('disabled'); }
  $('dScriptFind').href = driveSearchUrl(g);
  const bad = [];
  if (g.scriptUrl && !s && !loc) bad.push('Use a docs.google.com / drive.google.com link, or a local document path (.docx, .txt, .md, .pdf…).');
  if (g.sheetUrl && !sh) bad.push('The Video Planner link must be a docs.google.com or drive.google.com link.');
  const hint = $('dLinkHint'); hint.className = 'span2 small ' + (bad.length ? 'bad' : 'muted');
  hint.textContent = bad.length ? bad.join(' ') : (s || loc ? '' : 'No script linked yet. Paste a Google Doc link, browse for a local file, or search Drive.');
}
$('dScriptPick').onclick = async () => {
  const g = findGame(openId); if (!g || !window.chlDesktop || !window.chlDesktop.pickScript) return;
  const p = await window.chlDesktop.pickScript(); if (!p) return;
  g.scriptUrl = p; $('dScript').value = p; renderLinks(g); touch(g);
};
const hrs = (n) => (Number.isInteger(n) ? n : n.toFixed(1)) + 'h';

// ------------------------------------------------------------------ board
// Which parts of a board card are shown (Settings → Board cards). Everything is on unless switched off.
const DISPLAY_OPTIONS = [
  ['cover', 'Cover image'], ['studio', 'Studio name'], ['platform', 'Platform played on'], ['release', 'Release year'], ['genre', 'Genre'],
  ['series', 'Series / Franchise'], ['hype', 'Public hype'], ['beat', 'Time to beat'], ['played', 'Hours played'], ['score', 'Your score'], ['due', 'Target date'],
  ['tasks', 'Checklist progress'], ['video', 'Video views'], ['format', 'Video format'], ['script', 'Script button'], ['folder', 'Project folder button'], ['launch', 'Launch button'], ['hitlist', 'On Hit List'], ['owned', 'Ownership label under poster'], ['stuck', 'Days in stage (Writing / Editing alert)'], ['timely', 'Timely flag']
];
const show = (k) => !(state.display && state.display[k] === false);
const PLAY_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>';

function cardEl(g) {
  const c = document.createElement('div');
  c.className = 'card' + (simpleBoard ? ' simple-card' : ''); c.dataset.id = g.id; c.style.setProperty('--stage', (STAGES.find((s) => s.id === g.stage) || STAGES[0]).color);
  if (simpleBoard) {
    const logo = g.useLogo && g.logo && safeUrl(g.logo);
    c.innerHTML = `
      <div class="card-cover-col"><div class="card-cover ${g.cover ? '' : 'none'}" style="background-image:${cssUrl(g.cover)}">${g.cover ? '' : esc((g.name || '?').charAt(0).toUpperCase())}</div></div>
      <div class="card-main">
        ${logo ? `<div class="card-title has-logo"><img class="card-logo ${logoCls(logo)}" data-src="${esc(logo)}" src="${esc(logoSrc(logo))}" alt="${esc(g.name)}" title="${esc(g.name)}"></div>` : `<div class="card-title">${esc(g.name)}</div>`}
        <div class="card-sub">${esc(studioOf(g) || 'Unknown studio')}</div>
      </div>`;
    if (logo) fitLogo(logo);
    c.addEventListener('click', () => openDetail(g.id));
    return c;
  }
  const chips = [];
  if (show('platform') && g.playedOn) chips.push(platChip(g.playedOn));
  if (show('release')) chips.push(releaseChip(g));
  if (show('genre') && g.genres && g.genres[0]) chips.push(`<span class="chip">${esc(g.genres[0])}</span>`);
  if (show('series') && g.series) chips.push(`<span class="chip series" title="Series / Franchise">${esc(g.series)}</span>`);
  if (appSettings.useScores && show('score') && g.myScore != null && g.myScore !== '') chips.push(`<span class="chip score" title="Your score">★ ${esc(g.myScore)}/10</span>`);
  if (show('due')) chips.push(dueChip(g));
  if (show('tasks')) { const pr = checkProgress(g, g.stage); if (pr.total) chips.push(`<span class="chip tasks ${pr.done === pr.total ? 'full' : ''}" title="${esc(g.stage)} checklist">TASKS ${pr.done}/${pr.total}</span>`); }
  if (show('video') && g.video && g.video.views != null) chips.push(`<span class="chip video" title="Views on YouTube${g.video.fetchedAt ? ' (updated ' + new Date(g.video.fetchedAt).toLocaleDateString() + ')' : ''}">▶ ${compact(g.video.views)}</span>`);
  if (show('format')) {
    PL.gameFormats(g).forEach((fid) => {
      const fm = formatById(fid);
      if (fm) chips.push(`<span class="chip fmt" style="--fc:${fm.color}" title="Video format: ${esc(fm.label)}">${esc(fm.short)}</span>`);
    });
    if (g.part > 0) chips.push(`<span class="chip part" title="Part ${g.part}">PT ${g.part}</span>`);
  }
  const beat = g.ttb && (g.ttb.normally || g.ttb.hastily || g.ttb.completely);
  if (show('beat') && beat) chips.push(`<span class="chip" title="IGDB time to beat">BEAT ~${hrs(beat)}</span>`);
  if (show('played') && g.hoursPlayed > 0) chips.push(`<span class="chip">PLAYED ${hrs(g.hoursPlayed)}</span>`);
  if (show('script') && hasValidScript(g.scriptUrl)) chips.push('<span class="chip script" data-open="script" title="Open the linked script">SCRIPT ↗</span>');
  if (show('folder') && g.projectFolder) chips.push('<span class="chip folder" data-open="folder" title="Open project / footage folder">FOLDER ↗</span>');
  if (show('stuck')) { const st = PL.stuck(g); if (st && (st.level !== 'ok' || ['Writing', 'Editing'].includes(g.stage))) { const fc = PL.forecast(g, state.games); chips.push(`<span class="chip stuck-${st.level}" title="${st.days} day${st.days === 1 ? '' : 's'} in ${esc(g.stage)}${fc ? '. Usually about ' + fc.days + ' more days to publish' : ''}">${esc(g.stage.toUpperCase())} ${st.days}d</span>`); } }
  if (show('timely') && g.timely && !DONE_STAGES.includes(g.stage)) chips.push('<span class="chip timely" title="Timely: post soon after release or the event">⚡ TIMELY</span>');
  if (show('hitlist') && g.sentToHitList) chips.push('<span class="chip list" title="Sent to the Critical Hit List">ON HIT LIST</span>');
  const logo = g.useLogo && g.logo && safeUrl(g.logo);
  const launchOn = show('launch');
  const ownObj = show('owned') ? ownershipOf(g.ownership) : null;
  const ownTxt = ownObj ? ownObj.label : '';
  const hypeN = (show('hype') && g.hype > 0) ? Math.min(5, Math.max(0, Math.round(Number(g.hype)))) : 0;
  const launchTip = g.launchTarget ? 'Launch ' + g.name : 'Link a shortcut to launch this game';
  c.classList.toggle('has-launch', launchOn);
  c.innerHTML = `
    ${(show('cover') || ownTxt || hypeN) ? `<div class="card-cover-col">${show('cover') ? `<div class="card-cover ${g.cover ? '' : 'none'}" style="background-image:${cssUrl(g.cover)}">${g.cover ? '' : esc((g.name || '?').charAt(0).toUpperCase())}</div>` : ''}${ownTxt ? `<div class="card-own" style="--oc:${esc(ownObj.color)}" title="Ownership">${esc(ownTxt)}</div>` : ''}${hypeN ? `<div class="card-hype" title="Public hype: ${hypeN}/5" aria-label="Public hype ${hypeN} out of 5">${'🔥'.repeat(hypeN)}</div>` : ''}</div>` : ''}
    <div class="card-main">
      ${logo ? `<div class="card-title has-logo"><img class="card-logo ${logoCls(logo)}" data-src="${esc(logo)}" src="${esc(logoSrc(logo))}" alt="${esc(g.name)}" title="${esc(g.name)}"></div>` : `<div class="card-title">${esc(g.name)}</div>`}
      ${show('studio') ? `<div class="card-sub">${esc(studioOf(g) || 'Unknown studio')}</div>` : ''}
      <div class="chips">${chips.join('')}</div>
    </div>
    ${launchOn ? `<button type="button" class="card-launch${g.launchTarget ? '' : ' unset'}" data-launch title="${esc(launchTip)}" aria-label="${esc(launchTip)}">${PLAY_SVG}</button>` : ''}`;
  if (logo) fitLogo(logo);
  c.addEventListener('click', (e) => {
    if (e.target.closest('[data-launch]')) { e.stopPropagation(); launchGame(g); return; }
    if (e.target.closest('[data-open="script"]')) { e.stopPropagation(); openScriptTarget(g.scriptUrl); return; }
    if (e.target.closest('[data-open="folder"]')) { e.stopPropagation(); openProjectFolder(g.projectFolder); return; }
    openDetail(g.id);
  });
  return c;
}

// ---- launch a game from its card (desktop app only for files; store links also work in a browser)
const STORE_LINK = /^(steam|com\.epicgames\.launcher|goggalaxy|battlenet|uplay|origin2|eadesktop|xbox):\/\//i;
async function runLaunch(g) {
  const t = String(g.launchTarget || '').trim();
  if (window.chlDesktop) {
    try { const r = await window.chlDesktop.launch(t); toast(r.ok ? `Launching "${g.name}"…` : r.error); }
    catch (e) { toast('Could not launch: ' + e.message); }
  } else if (STORE_LINK.test(t)) { window.open(t, '_blank'); toast(`Opening "${g.name}" in your launcher…`); }
  else toast('Launching a file only works in the desktop app. A steam:// link also works in a browser.');
}
async function launchGame(g) {
  if (g.launchTarget) return runLaunch(g);
  if (window.chlDesktop) {                                   // first click: choose the shortcut, then launch
    const picked = await window.chlDesktop.pickLauncher();
    if (!picked) return;
    g.launchTarget = picked; save(true); renderBoard();
    return runLaunch(g);
  }
  openDetail(g.id); setTimeout(() => $('dLaunch').focus(), 60);
  toast('Paste the game\'s steam:// link here (browser mode cannot browse for files).');
}

function renderQuickFilters() {
  const pills = $('qFilterPills'); if (!pills) return;
  if (!state.games.length) { pills.innerHTML = ''; return; }
  const fmts = formatsOf();
  if (qFormat && !fmts.some((f) => f.id === qFormat)) qFormat = '';
  const usedPlats = [...new Set(state.games.map((g) => g.playedOn).filter(Boolean))];
  const usedSeries = [...new Set(state.games.map((g) => (g.series || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (qPlatform && !usedPlats.includes(qPlatform)) qPlatform = '';
  if (qSeries && !usedSeries.includes(qSeries)) qSeries = '';
  let html = `<button type="button" class="qpill${!qFormat ? ' on' : ''}" data-qfmt="">ALL</button>` +
    fmts.map((f) => `<button type="button" class="qpill${qFormat === f.id ? ' on' : ''}" data-qfmt="${esc(f.id)}" style="--fc:${esc(f.color)}">${esc(f.short)}</button>`).join('');
  if (usedPlats.length) {
    html += '<span class="qbar-sep"></span><select id="qPlatSel" class="field" aria-label="Filter by platform"><option value="">All platforms</option>' +
      usedPlats.map((id) => `<option value="${esc(id)}"${qPlatform === id ? ' selected' : ''}>${esc(P.label(id, 'full') || id)}</option>`).join('') + '</select>';
  }
  if (usedSeries.length) {
    html += '<select id="qSeriesSel" class="field" aria-label="Filter by series"><option value="">All series</option>' +
      usedSeries.map((s) => `<option value="${esc(s)}"${qSeries === s ? ' selected' : ''}>${esc(s)}</option>`).join('') + '</select>';
  }
  if (qFormat || qPlatform || qSeries) html += '<button type="button" class="qpill" data-qclear="1">✕ Clear</button>';
  pills.innerHTML = html;
}
$('qFilterBar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.qclear) { qFormat = ''; qPlatform = ''; qSeries = ''; renderBoardView(); return; }
  if ('qfmt' in b.dataset) { qFormat = b.dataset.qfmt; renderBoardView(); }
});
$('qFilterBar').addEventListener('change', (e) => {
  if (e.target.id === 'qPlatSel') { qPlatform = e.target.value; renderBoardView(); }
  else if (e.target.id === 'qSeriesSel') { qSeries = e.target.value; renderBoardView(); }
});

function renderBoardView() {
  renderQuickFilters();
  const board = $('board');
  const q = $('filterInput').value.trim().toLowerCase();
  board.innerHTML = '';
  STAGES.forEach((st) => {
    if (hideArchived && ARCHIVED.includes(st.id)) return;
    const games = state.games.filter((g) => g.stage === st.id);
    const col = document.createElement('section');
    col.className = 'column'; col.style.setProperty('--stage', st.color);
    col.innerHTML = `<header class="col-head"><h2>${st.id}</h2><span class="col-count">${games.length}</span><button class="col-add" title="Add a game to ${st.id}" aria-label="Add a game to ${st.id}">+</button></header><div class="col-list" data-stage="${st.id}"></div>`;
    col.querySelector('.col-add').onclick = () => openAdd(st.id);
    const list = col.querySelector('.col-list');
    games.forEach((g) => {
      const c = cardEl(g);
      const fmtLabels = PL.gameFormats(g).map((fid) => (formatById(fid) || {}).label || '').join(' ');
      const missText = q && ![g.name, studioOf(g), g.series || '', (g.genres || []).join(' '), P.label(g.playedOn, 'full'), (g.platforms || []).join(' '), fmtLabels, g.part ? 'part ' + g.part : ''].join(' ').toLowerCase().includes(q);
      const missFmt = qFormat && !PL.gameFormats(g).includes(qFormat);
      const missPlat = qPlatform && g.playedOn !== qPlatform;
      const missSeries = qSeries && (g.series || '').trim() !== qSeries;
      if (missText || missFmt || missPlat || missSeries) c.classList.add('dim');
      list.appendChild(c);
    });
    board.appendChild(col);
    new Sortable(list, { group: 'cards', animation: 160, ghostClass: 'ghost', chosenClass: 'chosen', delay: 120, delayOnTouchOnly: true, onEnd: () => setTimeout(onDragEnd, 0) });
  });
  const empty = state.games.length === 0;
  $('emptyState').classList.toggle('hidden', !empty);
  $('emptyImportYt').classList.toggle('hidden', !(appSettings.youtubeHasKey && appSettings.youtubeChannel));
  $('board').style.visibility = empty ? 'hidden' : 'visible';
}

// Rebuild the master order from what is on screen (cards hidden by the filter stay in the DOM, so nothing is lost)
function onDragEnd() {
  const byId = new Map(state.games.map((g) => [g.id, g]));
  const next = []; const seen = new Set(); const moved = [];
  document.querySelectorAll('.col-list').forEach((list) => {
    const stage = list.dataset.stage;
    [...list.children].forEach((c) => {
      const g = byId.get(c.dataset.id); if (!g) return;
      if (setStage(g, stage)) moved.push(g);
      next.push(g); seen.add(g.id);
    });
  });
  state.games.forEach((g) => { if (!seen.has(g.id)) next.push(g); });   // games in hidden (archived) columns
  state.games = next;
  save(true); renderBoard();
  promptSend(moved.find((g) => g.stage === 'Published'));
}

// ------------------------------------------------------------------ add game
function fillStageSelect(sel, value) {
  sel.innerHTML = STAGES.map((s) => `<option value="${s.id}">${s.id}</option>`).join('');
  sel.value = value || 'Backlogged';
}
function openAdd(stage) {
  fillStageSelect($('addStage'), stage || 'Backlogged');
  $('addNotice').classList.toggle('hidden', appSettings.igdbConfigured);
  $('searchInput').value = ''; $('searchInput').disabled = !appSettings.igdbConfigured;
  document.querySelector('#addModal .manual').open = !appSettings.igdbConfigured;   // manual add is the main path until IGDB is set up
  $('searchResults').innerHTML = appSettings.igdbConfigured ? '<div class="hint">Type at least two letters to search IGDB.</div>' : '';
  openModal('addModal');
  setTimeout(() => (appSettings.igdbConfigured ? $('searchInput') : $('manName')).focus(), 30);
}

let searchTimer = null;
$('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = $('searchInput').value.trim();
  if (q.length < 2) { $('searchResults').innerHTML = '<div class="hint">Type at least two letters to search IGDB.</div>'; return; }
  searchTimer = setTimeout(() => runSearch(q), 350);
});

async function runSearch(q) {
  const seq = ++searchSeq; const box = $('searchResults');
  box.innerHTML = '<div class="hint">Searching…</div>';
  try {
    const { results } = await api('/api/igdb/search?q=' + encodeURIComponent(q));
    if (seq !== searchSeq) return;
    if (!results.length) { box.innerHTML = '<div class="hint">No games found. Try fewer words, or add it manually below.</div>'; return; }
    box.innerHTML = '';
    results.forEach((r) => {
      const dup = state.games.find((g) => g.igdbId === r.igdbId);
      const el = document.createElement('div'); el.className = 'result';
      el.innerHTML = `<div class="card-cover ${r.coverUrl ? '' : 'none'}" style="background-image:${r.coverUrl ? `url('${esc(r.coverUrl)}')` : 'none'}">${r.coverUrl ? '' : '?'}</div>
        <div class="result-info"><b>${esc(r.name)}</b>
          <div>${esc((r.developers || []).join(', ') || 'Unknown studio')} · ${esc(r.releaseDate ? r.releaseDate.slice(0, 4) : 'TBA')}</div>
          <div>${esc((r.platforms || []).slice(0, 4).join(', '))}</div></div>
        <button class="btn ${dup ? '' : 'primary'}">${dup ? 'ON BOARD' : 'ADD'}</button>`;
      el.querySelector('button').onclick = (ev) => { if (dup) { closeModal('addModal'); openDetail(dup.id); } else addFromIgdb(r, ev.currentTarget); };
      box.appendChild(el);
    });
  } catch (e) { if (seq === searchSeq) box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

function gameFromIgdb(d, existing) {
  const g = d.game;
  // Genres are only replaced when you haven't set them by hand. "Untouched" = empty, the automatic pick, or the old raw IGDB order.
  const ex = existing || {};
  const untouched = !ex.genres || !ex.genres.length || (!ex.genresManual && (sameArr(ex.genres, ex.genresAuto) || sameArr(ex.genres, g.igdbGenres)));
  return Object.assign(existing || {}, {
    igdbGenres: g.igdbGenres || [], igdbThemes: g.igdbThemes || [],
    genres: untouched ? g.genres : ex.genres, genresAuto: untouched ? g.genres : ex.genresAuto,
    igdbId: g.igdbId, slug: g.slug, summary: g.summary, developers: g.developers, publishers: g.publishers, platforms: g.platforms,
    releaseDate: g.releaseDate, igdbHypes: g.hypes, follows: g.follows, rating: g.rating,
    cover: ex.coverCustom ? ex.cover : (g.cover || ex.cover || ''), banner: ex.bannerCustom ? ex.banner : (g.banner || ex.banner || ''),   // art you picked yourself is kept
    coverId: g.coverId || ex.coverId || null,
    coverRemote: ex.coverCustom ? (ex.coverRemote || '') : (g.coverId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.coverId}.jpg` : (ex.coverRemote || '')),
    ttb: d.ttb, syncedAt: Date.now()
  });
}

async function addFromIgdb(r, btn) {
  btn.disabled = true; btn.textContent = 'ADDING…';
  try {
    const d = await api('/api/igdb/game/' + r.igdbId);
    const g = gameFromIgdb(d, { id: uid(), name: d.game.name, stage: $('addStage').value, playedOn: '', hoursPlayed: 0, hype: 0, sentToHitList: false, createdAt: Date.now() });
    const only = igdbPlatformIds(g); if (only.length === 1) g.playedOn = only[0];   // single-platform game: pre-fill, still editable
    initGame(g); state.games.unshift(g);
    save(true); renderBoard(); closeModal('addModal');
    toast(`Added "${g.name}" to ${g.stage}` + (d.warnings.length ? ` (${d.warnings[0]})` : ''));
  } catch (e) { btn.disabled = false; btn.textContent = 'ADD'; toast(e.message); }
}

$('manAdd').onclick = () => {
  const name = $('manName').value.trim(); if (!name) { $('manName').focus(); return; }
  state.games.unshift(initGame({ id: uid(), igdbId: null, name, developers: csv($('manStudio').value), publishers: [], genres: [], platforms: [], releaseDate: '', stage: $('addStage').value, playedOn: '', hoursPlayed: 0, hype: 0, cover: '', banner: '', ttb: null, sentToHitList: false, createdAt: Date.now() }));
  $('manName').value = ''; $('manStudio').value = '';
  save(true); renderBoard(); closeModal('addModal'); toast(`Added "${name}"`);
};
$('manName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('manAdd').click(); });

// ------------------------------------------------------------------ detail drawer
let detailTimer = null;
function openDetail(id) {
  const g = findGame(id); if (!g) return;
  openId = id;
  fillStageSelect($('dStage'), g.stage);
  $('dBanner').style.backgroundImage = cssUrl(g.banner || g.cover);
  $('dHeading').textContent = g.name;
  $('dName').value = g.name || '';
  $('dStudio').value = studioOf(g);
  $('dRelease').value = g.releaseDate || '';
  $('dGenres').value = (g.genres || []).join(', ');
  fillPlatformSelect($('dPlayedOn'), g.playedOn, g); renderPlatPreview(g);
  $('dHours').value = g.hoursPlayed || '';
  $('dSeries').value = g.series || '';
  const allSeries = [...new Set(state.games.map((x) => (x.series || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $('seriesList').innerHTML = allSeries.map((s) => `<option value="${esc(s)}">`).join('');
  $('dOwned').innerHTML = '<option value="">Not set</option>' + ownershipsOf().map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('');
  $('dOwned').value = ownershipOf(g.ownership) ? g.ownership : '';
  $('dScoreWrap').classList.toggle('hidden', !appSettings.useScores);
  $('dScore').value = g.myScore == null ? '' : g.myScore; $('dDue').value = g.dueDate || '';
  $('dPart').value = g.part > 0 ? g.part : '';
  renderDetailFormats(g); renderGcal(g);
  $('dSend').classList.toggle('hidden', appSettings.showHitList === false);
  renderGenreSug(g); renderChecks(g); renderLaunch(g); renderArt(g);
  $('dVideo').value = g.videoUrl || ''; renderVideo(g);
  $('dScript').value = g.scriptUrl || ''; $('dSheet').value = g.sheetUrl || ''; renderLinks(g);
  dAwardsEd.set(g.awards);
  $('dTimely').value = g.timely ? '1' : '';
  renderPlan(g);
  renderPips(g.hype || 0);
  renderFacts(g);
  $('dSummary').textContent = g.summary || '';
  $('dWarn').classList.add('hidden');
  $('dIgdbLink').classList.toggle('hidden', !g.slug);
  if (g.slug) $('dIgdbLink').href = 'https://www.igdb.com/games/' + encodeURIComponent(g.slug);
  $('dRefresh').classList.toggle('hidden', !g.igdbId);
  $('dSynced').textContent = g.syncedAt ? 'Last synced with IGDB: ' + new Date(g.syncedAt).toLocaleString() : (g.igdbId ? '' : 'Added manually (not linked to IGDB).');
  ['dDetailsBox', 'plPack', 'dAboutBox', 'dChecksBox', 'dPubBox', 'dArtBox'].forEach((boxId) => { const el = $(boxId); if (el) el.open = true; });
  $('dSaved').textContent = '';
  openModal('detailModal');
}

// ---- genre: tap a label to make it the headline (or go back to the automatic pick)
function renderGenreSug(g) {
  const box = $('dGenreSug');
  const cands = GN.candidates(g.igdbGenres && g.igdbGenres.length ? g.igdbGenres : (g.genres || []), g.igdbThemes || []);
  (g.genres || []).forEach((x) => { if (!cands.some((c) => c.toLowerCase() === x.toLowerCase())) cands.push(x); });
  const cur = (g.genres || [])[0];
  let html = cands.length > 1 ? '<span class="lbl">Make first:</span>' + cands.map((c) => `<button type="button" class="chip gsug${cur && cur.toLowerCase() === c.toLowerCase() ? ' on' : ''}" data-genre="${esc(c)}">${esc(c)}</button>`).join('') : '';
  if (g.genresManual && (g.igdbGenres || []).length) html += '<button type="button" class="chip gsug" data-genre-auto="1" title="Let the app pick the genre order again">↺ auto</button>';
  box.innerHTML = html;
}
$('dGenreSug').addEventListener('click', (e) => {
  const g = findGame(openId); if (!g) return;
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.genreAuto) { g.genres = GN.order(g.igdbGenres || [], g.igdbThemes || []); g.genresAuto = g.genres.slice(); g.genresManual = false; }
  else if (b.dataset.genre) { const pick = b.dataset.genre; g.genres = [pick].concat((g.genres || []).filter((x) => x.toLowerCase() !== pick.toLowerCase())); g.genresManual = true; }
  else return;
  $('dGenres').value = g.genres.join(', '); renderGenreSug(g); touch(g);
});

function renderPips(n) {
  const box = $('dHype'); box.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pip' + (i <= n ? ' on' : ''); b.textContent = i; b.setAttribute('aria-label', 'Hype ' + i);
    b.onclick = () => { const g = findGame(openId); if (!g) return; g.hype = g.hype === i ? 0 : i; renderPips(g.hype); touch(g); };
    box.appendChild(b);
  }
}

function renderFacts(g) {
  const f = [];
  const add = (label, value, unit) => f.push(`<div class="fact"><span>${label}</span><b>${esc(value)}${unit ? ` <small>${unit}</small>` : ''}</b></div>`);
  if (g.ttb) {
    if (g.ttb.hastily) add('Rushed', g.ttb.hastily, 'hrs');
    if (g.ttb.normally) add('Main story', g.ttb.normally, 'hrs');
    if (g.ttb.completely) add('Completionist', g.ttb.completely, 'hrs');
  }
  if (g.igdbHypes != null) add('IGDB hype', g.igdbHypes, 'follows pre-release');
  if (g.follows != null) add('IGDB followers', g.follows);
  if (g.rating != null) add('IGDB rating', g.rating, '/ 100');
  if ((g.publishers || []).length) add('Publisher', g.publishers.join(', '));
  if ((g.platforms || []).length) add('Platforms', g.platforms.length + ' on IGDB');
  $('dFacts').innerHTML = f.join('') || '<div class="muted small">No IGDB data on this card yet.</div>';
  $('dFacts').title = (g.platforms || []).join(', ');
}

// edits write straight to the game and save
function touch(g) { save(false); $('dSaved').textContent = 'Saving…'; $('dSaved').className = 'save-status saving'; clearTimeout(detailTimer); detailTimer = setTimeout(() => { $('dSaved').textContent = 'Saved'; $('dSaved').className = 'save-status'; }, 600); $('dHeading').textContent = g.name; }
const bind = (id, apply) => $(id).addEventListener('input', () => { const g = findGame(openId); if (!g) return; apply(g, $(id).value); touch(g); });
bind('dName', (g, v) => { g.name = v; $('dScriptFind').href = driveSearchUrl(g); });
bind('dScript', (g, v) => { g.scriptUrl = v.trim(); renderLinks(g); });
bind('dSheet', (g, v) => { g.sheetUrl = v.trim(); renderLinks(g); });
bind('dStudio', (g, v) => { g.developers = csv(v); });
bind('dRelease', (g, v) => { g.releaseDate = v; });
bind('dGenres', (g, v) => { g.genres = csv(v); g.genresManual = true; renderGenreSug(g); });
bind('dScore', (g, v) => { const n = parseFloat(v); g.myScore = Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : null; });
bind('dDue', (g, v) => { g.dueDate = v; renderGcal(g); });
bind('dVideo', (g, v) => { g.videoUrl = v.trim(); renderVideo(g); });
bind('dPlayedOn', (g, v) => { g.playedOn = v; delete g.playedOnLegacy; renderPlatPreview(g); });
bind('dSeries', (g, v) => { const s = v.trim().slice(0, 60); if (s) g.series = s; else delete g.series; });
bind('dOwned', (g, v) => { if (ownershipOf(v)) g.ownership = v; else delete g.ownership; });
bind('dTimely', (g, v) => { if (v) g.timely = true; else delete g.timely; });
bind('dHours', (g, v) => { g.hoursPlayed = Math.max(0, parseFloat(v) || 0); });
// planned Hit List awards: a note on the game that travels with it into the Send dialog (awards.js draws the picker)
const dAwardsEd = CHL_AWARDS.mountEditor($('dAwards'), { onChange: (list) => { const g = findGame(openId); if (!g) return; g.awards = list; touch(g); } });
$('dStage').addEventListener('change', () => {
  const g = findGame(openId); if (!g) return;
  setStage(g, $('dStage').value); renderChecks(g); touch(g);
  if (g.stage === 'Published' && !g.sentToHitList) toast(`"${g.name}" is Published`, { label: 'SEND TO HIT LIST', fn: () => { $('toast').classList.add('hidden'); $('dSend').click(); } }, 12000);
});

$('dRefresh').onclick = async () => {
  const g = findGame(openId); if (!g || !g.igdbId) return;
  const b = $('dRefresh'); b.disabled = true; b.textContent = '↻ Refreshing…';
  try {
    const d = await api('/api/igdb/game/' + g.igdbId);
    gameFromIgdb(d, g);                       // updates IGDB facts only; your title, stage, hours and hype stay
    if (d.game.releaseDate) $('dRelease').value = g.releaseDate;
    $('dStudio').value = studioOf(g); $('dGenres').value = (g.genres || []).join(', '); renderGenreSug(g);
    fillPlatformSelect($('dPlayedOn'), g.playedOn, g); renderPlatPreview(g);
    $('dBanner').style.backgroundImage = cssUrl(g.banner || g.cover); renderArt(g);
    renderFacts(g); $('dSummary').textContent = g.summary || '';
    $('dSynced').textContent = 'Last synced with IGDB: ' + new Date(g.syncedAt).toLocaleString();
    const w = $('dWarn'); if (d.warnings.length) { w.textContent = d.warnings.join(' '); w.classList.remove('hidden'); } else w.classList.add('hidden');
    save(true); toast('Refreshed from IGDB');
  } catch (e) { toast(e.message); }
  b.disabled = false; b.textContent = '↻ Refresh from IGDB';
};

$('dDelete').onclick = () => {
  const g = findGame(openId); if (!g) return;
  confirmBox(`Delete "${g.name}" from the board?`, 'DELETE', () => {
    const at = state.games.findIndex((x) => x.id === g.id);
    state.games = state.games.filter((x) => x.id !== g.id);
    closeModal('detailModal'); save(true); renderBoard();
    toast(`Deleted "${g.name}"`, { label: 'UNDO', fn: () => {
      if (!state.games.some((x) => x.id === g.id)) state.games.splice(Math.min(at, state.games.length), 0, g);
      $('toast').classList.add('hidden'); save(true); renderBoard();
    } }, 10000);
  });
};


// ------------------------------------------------------------------ scratchpad & packaging (drawer)
const planOf = (g) => { g.plan = PL.normalize(g.plan); return g.plan; };
const planTouch = (g) => { renderPlanSums(g); touch(g); };
function renderPlanSums(g) {
  const p = planOf(g);
  $('plNotesSum').textContent = (p.notes.trim() || p.angle.trim() || p.hook.trim()) ? 'has notes' : 'empty';
  const n = p.titles.filter(Boolean).length;
  const tn = p.thumbs.filter(Boolean).length;
  const parts = [];
  if (p.chosen >= 0 && p.titles[p.chosen]) parts.push('title chosen');
  else if (n) parts.push(n + '/3 titles');
  if (tn) parts.push(tn + '/3 thumbs');
  $('plPackSum').textContent = parts.length ? parts.join(' · ') : 'empty';
}
function renderTitles(g) {
  const p = planOf(g);
  $('plTitles').innerHTML = p.titles.map((t, i) => `<div class="ttl"><button type="button" class="pick${p.chosen === i ? ' on' : ''}" data-i="${i}" title="Use this title" aria-label="Choose title ${i + 1}"></button><input class="field" data-i="${i}" value="${esc(t)}" maxlength="120" placeholder="Title option ${i + 1}"><small class="muted">${t.length ? t.length + (t.length > 60 ? ' (may cut off)' : '') : ''}</small></div>`).join('');
}
let thumbPickSlot = -1, thumbPrevIdx = 0, tcView = 'canvas';
function renderThumbs(g) {
  const p = planOf(g);
  $('plThumbs').innerHTML = p.thumbs.map((src, i) => {
    const ok = safeUrl(src);
    if (!ok) return `<div class="th-slot" data-th-slot="${i}" title="Attach thumbnail version ${i + 1}"><span class="th-empty">+ THUMB ${i + 1}</span></div>`;
    const isWin = p.chosenThumb === i;
    return `<div class="th-slot filled${isWin ? ' winner' : ''}" data-th-prev="${i}" title="Click to preview &amp; check version ${i + 1}">
      <img src="${esc(ok)}" alt="Thumbnail ${i + 1}">
      <span class="th-badge">V${i + 1}</span>
      <div class="th-acts">
        <button type="button" class="th-btn win${isWin ? ' on' : ''}" data-th-win="${i}" title="Pick as winner">★</button>
        <button type="button" class="th-btn" data-th-slot="${i}" title="Replace image">↻</button>
        <button type="button" class="th-btn del" data-th-del="${i}" title="Remove">✕</button>
      </div>
    </div>`;
  }).join('');
}
function tcBadgeText() {
  const t = $('tcDurType').value;
  if (t === 'long') return { text: '48:15', live: false };
  if (t === 'live') return { text: 'LIVE', live: true };
  if (t === 'custom') return { text: ($('tcDurCustom').value || 'PREMIERE').trim().slice(0, 15), live: false };
  return { text: '14:25', live: false };
}
function tcImgBoxHtml(src, allowHover) {
  const ovSafe = $('tcOvSafe').checked;
  const ovBadge = $('tcOvBadge').checked;
  const ovHover = allowHover && $('tcOvHover').checked;
  const ovProg = $('tcOvProg').checked;
  const b = tcBadgeText();
  return `<div class="tc-imgbox">
    <img src="${esc(src)}" alt="Thumbnail preview">
    ${ovSafe ? '<div class="tc-safe"></div>' : ''}
    ${ovHover ? '<div class="tc-hover-acts"><span class="tc-hover-ic" title="Watch Later">🕒</span><span class="tc-hover-ic" title="Add to queue">☰</span></div>' : ''}
    ${ovBadge ? `<span class="tc-badge${b.live ? ' live' : ''}">${esc(b.text)}</span>` : ''}
    ${ovProg ? '<div class="tc-prog"></div>' : ''}
  </div>`;
}
function renderThumbCheckerStage() {
  const g = findGame(openId); if (!g) return;
  const p = planOf(g);
  const src = safeUrl(p.thumbs[thumbPrevIdx]); if (!src) return;
  const title = $('tcTitleInput').value.trim() || g.name || 'Untitled Video';
  const ch = appSettings.youtubeChannel;
  const chName = (ch && (ch.title || ch.handle)) || 'Your Channel';
  const avHtml = (ch && ch.avatar && safeUrl(ch.avatar))
    ? `<img src="${esc(ch.avatar)}" alt="">`
    : esc(chName.replace(/^@/, '').charAt(0).toUpperCase() || 'C');

  const stage = $('tcStage');
  if (tcView === 'canvas') {
    stage.innerHTML = `<div class="tc-canvas-wrap">${tcImgBoxHtml(src, true)}</div>`;
  } else if (tcView === 'home') {
    stage.innerHTML = `<div class="yt-card">
      ${tcImgBoxHtml(src, true)}
      <div class="yt-card-meta">
        <div class="yt-card-av">${avHtml}</div>
        <div class="yt-card-txt">
          <div class="yt-card-t">${esc(title)}</div>
          <div class="yt-card-s">${esc(chName)} · 45K views · 3 hours ago</div>
        </div>
      </div>
    </div>`;
  } else if (tcView === 'sidebar') {
    const ghost = `<div class="tc-sb-item tc-sb-ghost"><div class="tc-sb-thumb"></div><div style="flex:1"><div class="tc-ghost-line" style="width:92%"></div><div class="tc-ghost-line" style="width:65%"></div><div class="tc-ghost-line" style="width:45%"></div></div></div>`;
    stage.innerHTML = `<div class="tc-sidebar-wrap">
      <div class="yt-card-lbl">Up Next (Desktop Sidebar · 168px)</div>
      <div class="tc-sb-item hi">
        <div class="tc-sb-thumb">${tcImgBoxHtml(src, true)}</div>
        <div class="yt-card-txt">
          <div class="yt-card-t">${esc(title)}</div>
          <div class="yt-card-s">${esc(chName)}</div>
          <div class="yt-card-s">45K views · 3 hours ago</div>
        </div>
      </div>
      ${ghost}${ghost}
    </div>`;
  } else if (tcView === 'mobile') {
    stage.innerHTML = `<div class="tc-phone">
      <div class="tc-phone-top"><div><span class="tc-phone-yt">▶</span>YouTube</div><span style="opacity:.6">🔍</span></div>
      ${tcImgBoxHtml(src, false)}
      <div class="tc-phone-meta">
        <div class="yt-card-av">${avHtml}</div>
        <div class="yt-card-txt">
          <div class="yt-card-t">${esc(title)}</div>
          <div class="yt-card-s">${esc(chName)} · 45K views · 3 hours ago</div>
        </div>
      </div>
      <div class="tc-phone-ghost"><div class="ph-box"></div><div class="tc-ghost-line" style="width:80%"></div></div>
    </div>`;
  } else if (tcView === 'tv') {
    stage.innerHTML = `<div style="width:100%;max-width:540px">
      <div class="tc-tv">
        ${tcImgBoxHtml(src, false)}
        <div class="tc-tv-meta">
          <div class="yt-card-av">${avHtml}</div>
          <div class="yt-card-txt">
            <div class="yt-card-t" style="font-size:16px">${esc(title)}</div>
            <div class="yt-card-s">${esc(chName)} · 45K views · 3 hours ago</div>
          </div>
        </div>
      </div>
      <div class="tc-tv-stand"></div>
    </div>`;
  }
}
function openThumbPreview(g, idx) {
  const p = planOf(g);
  thumbPrevIdx = idx;
  const src = safeUrl(p.thumbs[idx]); if (!src) return;
  $('thumbPrevTitle').textContent = `THUMBNAIL CHECKER · V${idx + 1}`;
  const chosenTitle = (p.chosen >= 0 && p.titles[p.chosen]) || p.titles.find(Boolean) || g.name || 'Untitled Video';
  if ($('thumbModal').classList.contains('hidden')) $('tcTitleInput').value = chosenTitle;
  const nonEmptyTitles = p.titles.map((t, i) => ({ t: t.trim(), i })).filter((x) => x.t);
  $('tcTitleChips').innerHTML = nonEmptyTitles.map((x) => `<button type="button" class="tc-tchip" data-tc-t="${esc(x.t)}" title="${esc(x.t)}">T${x.i + 1}: ${esc(x.t)}</button>`).join('');
  $('thumbPrevTabs').innerHTML = [0, 1, 2].map((i) => {
    const has = !!safeUrl(p.thumbs[i]);
    return `<button type="button" class="btn${i === idx ? ' primary' : ''}" data-tp-idx="${i}" ${has ? '' : 'disabled'}>V${i + 1}${p.chosenThumb === i ? ' ★' : ''}</button>`;
  }).join('');
  $('thumbPrevPick').textContent = p.chosenThumb === idx ? '★ WINNER' : 'SET AS WINNER';
  document.querySelectorAll('.tc-vtab').forEach((b) => b.classList.toggle('on', b.dataset.tcView === tcView));
  openModal('thumbModal');
  renderThumbCheckerStage();
}
document.querySelectorAll('.tc-vtab').forEach((b) => {
  b.addEventListener('click', () => {
    tcView = b.dataset.tcView;
    document.querySelectorAll('.tc-vtab').forEach((x) => x.classList.toggle('on', x === b));
    renderThumbCheckerStage();
  });
});
['tcTitleInput', 'tcDurCustom'].forEach((id) => $(id).addEventListener('input', renderThumbCheckerStage));
['tcOvSafe', 'tcOvBadge', 'tcOvHover', 'tcOvProg'].forEach((id) => $(id).addEventListener('change', renderThumbCheckerStage));
$('tcDurType').addEventListener('change', () => {
  $('tcDurCustom').classList.toggle('hidden', $('tcDurType').value !== 'custom');
  renderThumbCheckerStage();
});
$('tcTitleChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tc-t]'); if (!b) return;
  $('tcTitleInput').value = b.dataset.tcT;
  renderThumbCheckerStage();
});
$('plThumbs').addEventListener('click', (e) => {
  const g = findGame(openId); if (!g) return;
  const p = planOf(g);
  const winBtn = e.target.closest('[data-th-win]');
  if (winBtn) { e.stopPropagation(); const i = +winBtn.dataset.thWin; p.chosenThumb = p.chosenThumb === i ? -1 : i; renderThumbs(g); planTouch(g); return; }
  const delBtn = e.target.closest('[data-th-del]');
  if (delBtn) { e.stopPropagation(); const i = +delBtn.dataset.thDel; p.thumbs[i] = ''; if (p.chosenThumb === i) p.chosenThumb = -1; renderThumbs(g); planTouch(g); return; }
  const slotBtn = e.target.closest('[data-th-slot]');
  if (slotBtn) { e.stopPropagation(); thumbPickSlot = +slotBtn.dataset.thSlot; $('plThumbFile').value = ''; $('plThumbFile').click(); return; }
  const prevBtn = e.target.closest('[data-th-prev]');
  if (prevBtn) { openThumbPreview(g, +prevBtn.dataset.thPrev); }
});
$('plThumbFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  const g = findGame(openId);
  if (!file || !g || thumbPickSlot < 0) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast('Please pick a PNG, JPG, or WebP image.'); return; }
  try {
    const r = await fetch('/api/thumb/upload', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Upload failed');
    const p = planOf(g);
    p.thumbs[thumbPickSlot] = j.path;
    renderThumbs(g); planTouch(g);
    toast(`Thumbnail V${thumbPickSlot + 1} attached`);
  } catch (err) { toast('Thumbnail upload failed: ' + err.message); }
});
$('thumbPrevTabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tp-idx]'); const g = findGame(openId);
  if (!b || !g || b.disabled) return;
  openThumbPreview(g, +b.dataset.tpIdx);
});
$('thumbPrevPick').addEventListener('click', () => {
  const g = findGame(openId); if (!g) return;
  const p = planOf(g);
  p.chosenThumb = p.chosenThumb === thumbPrevIdx ? -1 : thumbPrevIdx;
  renderThumbs(g); planTouch(g); openThumbPreview(g, thumbPrevIdx);
});
function renderPlan(g) {
  const p = planOf(g);
  $('plNotes').value = p.notes; $('plAngle').value = p.angle; $('plHook').value = p.hook; $('plNotesBox').open = false;
  $('plThumb').value = p.thumb;
  renderTitles(g); renderThumbs(g); renderPlanSums(g);
}
function renderDetailFormats(g) {
  const active = PL.gameFormats(g);
  $('dFormats').innerHTML = formatsOf().map((f) => {
    const on = active.includes(f.id);
    return `<button type="button" class="fmt-ed-btn${on ? ' on' : ''}" data-dfmt="${esc(f.id)}" style="--fc:${esc(f.color)}">${esc(f.label)}</button>`;
  }).join('');
  $('dSplitFmt').classList.toggle('hidden', active.length < 2);
}
function spawnSiblingCard(src, overrides) {
  const copy = {
    id: uid(),
    name: src.name,
    igdbId: src.igdbId || null,
    slug: src.slug || '',
    summary: src.summary || '',
    developers: (src.developers || []).slice(),
    publishers: (src.publishers || []).slice(),
    genres: (src.genres || []).slice(),
    genresAuto: (src.genresAuto || []).slice(),
    igdbGenres: (src.igdbGenres || []).slice(),
    igdbThemes: (src.igdbThemes || []).slice(),
    platforms: (src.platforms || []).slice(),
    releaseDate: src.releaseDate || '',
    igdbHypes: src.igdbHypes || null,
    follows: src.follows || null,
    rating: src.rating || null,
    playedOn: src.playedOn || '',
    series: src.series || '',
    ownership: src.ownership || '',
    hype: src.hype || 0,
    hoursPlayed: 0, // hours stay logged on the original card so Stats never double-counts playtime
    ttb: src.ttb || null,
    cover: src.cover || '',
    coverCustom: !!src.coverCustom,
    coverId: src.coverId || null,
    coverRemote: src.coverRemote || '',
    coverThumb: src.coverThumb || '',
    banner: src.banner || '',
    bannerCustom: !!src.bannerCustom,
    logo: src.logo || '',
    useLogo: !!src.useLogo,
    launchTarget: src.launchTarget || '',
    projectFolder: src.projectFolder || '',
    stage: src.stage === 'Published' ? 'Planned' : src.stage,
    sentToHitList: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    plan: PL.normalize({})
  };
  Object.assign(copy, overrides || {});
  return initGame(copy);
}
$('dFormats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dfmt]'); const g = findGame(openId); if (!b || !g) return;
  const fid = b.dataset.dfmt;
  const cur = PL.gameFormats(g);
  const next = cur.includes(fid) ? cur.filter((x) => x !== fid) : cur.concat([fid]);
  if (next.length) { g.formats = next; g.format = next[0]; } else { delete g.formats; delete g.format; }
  renderDetailFormats(g); renderGcal(g); touch(g);
});
$('dPart').addEventListener('input', () => {
  const g = findGame(openId); if (!g) return;
  const n = parseInt($('dPart').value, 10);
  if (Number.isInteger(n) && n >= 1 && n <= 99) g.part = n; else delete g.part;
  renderGcal(g); touch(g);
});
$('dSplitFmt').addEventListener('click', () => {
  const g = findGame(openId); if (!g) return;
  const fmts = PL.gameFormats(g);
  if (fmts.length < 2) return;
  const first = fmts[0];
  const rest = fmts.slice(1);
  g.formats = [first]; g.format = first; g.updatedAt = Date.now();
  const created = rest.map((fid) => {
    const c = spawnSiblingCard(g, { format: fid, formats: [fid] });
    state.games.unshift(c);
    return c;
  });
  renderDetailFormats(g); renderGcal(g); save(true); renderBoard();
  const names = created.map((c) => (formatById(c.format) || {}).label || c.format).join(', ');
  toast(`Split! Created ${created.length} new card${created.length > 1 ? 's' : ''} (${names})`, {
    label: 'OPEN NEW CARD',
    fn: () => { $('toast').classList.add('hidden'); openDetail(created[0].id); }
  }, 8000);
});
$('dAddPart').addEventListener('click', () => {
  const g = findGame(openId); if (!g) return;
  if (!g.part) { g.part = 1; $('dPart').value = '1'; }
  const primaryFmt = PL.gameFormats(g)[0] || '';
  const sameGames = state.games.filter((x) =>
    ((g.igdbId && x.igdbId === g.igdbId) || x.name.toLowerCase() === g.name.toLowerCase()) &&
    (!primaryFmt || PL.gameFormats(x).includes(primaryFmt))
  );
  const maxPart = sameGames.reduce((m, x) => Math.max(m, Number(x.part) || 0), 1);
  const nextPart = maxPart + 1;
  const newCard = spawnSiblingCard(g, {
    part: nextPart,
    format: primaryFmt,
    formats: primaryFmt ? [primaryFmt] : []
  });
  state.games.unshift(newCard);
  save(true); renderBoard();
  toast(`Created "${g.name}" Part ${nextPart}`, {
    label: `OPEN PART ${nextPart}`,
    fn: () => { $('toast').classList.add('hidden'); openDetail(newCard.id); }
  }, 8000);
});
bind('plNotes', (g, v) => { planOf(g).notes = v; renderPlanSums(g); });
bind('plAngle', (g, v) => { planOf(g).angle = v; renderPlanSums(g); });
bind('plHook',  (g, v) => { planOf(g).hook = v; renderPlanSums(g); });
bind('plThumb', (g, v) => { planOf(g).thumb = v; renderPlanSums(g); });
$('plTitles').addEventListener('input', (e) => { const g = findGame(openId); const i = +e.target.dataset.i; if (!g || !(i >= 0) || e.target.tagName !== 'INPUT') return; planOf(g).titles[i] = e.target.value; const sm = e.target.nextElementSibling; if (sm) sm.textContent = e.target.value.length ? e.target.value.length + (e.target.value.length > 60 ? ' (may cut off)' : '') : ''; planTouch(g); });
$('plTitles').addEventListener('click', (e) => { const b = e.target.closest('.pick'); const g = findGame(openId); if (!b || !g) return; const p = planOf(g); const i = +b.dataset.i; p.chosen = p.chosen === i ? -1 : i; renderTitles(g); planTouch(g); });

// ------------------------------------------------------------------ upload schedule + buffer (header strip, calendar slots)
const cadenceOf = () => ({ days: PL.cleanDays(state.cadence && state.cadence.days), ready: (state.cadence && state.cadence.ready) || 'Reviewing', showBuffer: !!(state.cadence && state.cadence.showBuffer) });
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function renderPipeBar() {
  const c = cadenceOf();
  const bar = $('pipeBar');
  bar.classList.toggle('hidden', !c.showBuffer);
  if (!c.showBuffer) return;
  const b = PL.buffer(state.games, c.ready, c.days);
  const slots = PL.nextSlots(c.days, todayIso(), 1);
  const nxt = slots[0] ? new Date(slots[0] + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  let msg;
  if (!c.days.length) msg = '<span class="muted">Set your upload days in Settings to track your video buffer.</span>';
  else {
    const lvl = b.ready === 0 ? 'bad' : b.days < 7 ? 'warn' : 'ok';
    msg = `<span class="pb-k">BUFFER</span><b class="pb-${lvl}">${b.ready} ready</b><span class="muted">≈ ${b.days} day${b.days === 1 ? '' : 's'} of uploads (${esc(c.ready)}+ not yet published)</span>${nxt ? `<span class="pb-sep"></span><span class="pb-k">NEXT UPLOAD</span><b>${esc(nxt)}</b>` : ''}`;
  }
  bar.innerHTML = msg;
}
function renderCadenceSettings() {
  const c = cadenceOf();
  $('cadBox').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="inline-check"><input type="checkbox" data-day="${d}" ${c.days.includes(d) ? 'checked' : ''}> ${DOW[d]}</label>`).join('');
  $('cadReady').innerHTML = ['Editing', 'Reviewing'].map((st) => `<option value="${st}" ${c.ready === st ? 'selected' : ''}>${st} or later</option>`).join('');
  $('cadShowBuffer').checked = c.showBuffer;
}
function saveCadence() {
  const days = [...document.querySelectorAll('#cadBox [data-day]')].filter((x) => x.checked).map((x) => +x.dataset.day);
  state.cadence = { days: PL.cleanDays(days), ready: $('cadReady').value || 'Reviewing', showBuffer: !!$('cadShowBuffer').checked };
  save(false); renderPipeBar(); if (view === 'calendar') renderCalendar();
}
$('cadBox').addEventListener('change', saveCadence); $('cadReady').addEventListener('change', saveCadence); $('cadShowBuffer').addEventListener('change', saveCadence);


// ------------------------------------------------------------------ logo fit (1.8)
// Logos come in all shapes and many have empty margins. Trim the transparent edges once, then size the card logo by its shape
// so a square or tall logo (Lies of P) gets a bigger box than a wide one (Resident Evil 2).
const logoCache = new Map();      // url -> { src, ar } once measured, 'busy' while loading, null if it could not be read
const logoCls = (url) => { const c = logoCache.get(url); const ar = c && c !== 'busy' ? c.ar : 0; return !ar ? 'ar-mid' : ar >= 2.2 ? 'ar-wide' : ar >= 1.25 ? 'ar-mid' : ar >= 0.65 ? 'ar-sq' : 'ar-tall'; };
const logoSrc = (url) => { const c = logoCache.get(url); return c && c !== 'busy' ? c.src : url; };
function measureLogo(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth || 1, h = im.naturalHeight || 1; const plain = { src: url, ar: w / h };
      try {
        const sc = Math.min(1, 480 / Math.max(w, h)); const cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cw, ch);
        const d = cx.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) return resolve(plain);
        const tw = x1 - x0 + 1, th = y1 - y0 + 1;
        if (tw >= cw * 0.96 && th >= ch * 0.96) return resolve(plain);          // nothing worth trimming
        const out = document.createElement('canvas'); out.width = tw; out.height = th; out.getContext('2d').drawImage(cv, x0, y0, tw, th, 0, 0, tw, th);
        resolve({ src: out.toDataURL('image/png'), ar: tw / th });
      } catch (e) { resolve(plain); }                                            // a picture from another site can't be read; use it as it is
    };
    im.onerror = () => resolve(null);
    im.crossOrigin = 'anonymous'; im.src = url;
  });
}
function fitLogo(url) {
  if (logoCache.has(url)) return;
  logoCache.set(url, 'busy');
  measureLogo(url).then((r) => {
    logoCache.set(url, r);
    if (!r) return;
    document.querySelectorAll('img.card-logo').forEach((im) => { if (im.dataset.src === url) { im.src = r.src; im.className = 'card-logo ' + logoCls(url); } });
  });
}

// ------------------------------------------------------------------ drawer: simple / advanced, Google Calendar
function setDrawerMode(adv) {
  const box = $('dSheetBox'); box.classList.toggle('simple', !adv); box.classList.toggle('advanced', !!adv);
  $('dModeSimple').classList.toggle('on', !adv); $('dModeAdv').classList.toggle('on', !!adv);
  try { localStorage.setItem('chl_drawer_mode', adv ? 'adv' : 'simple'); } catch (e) { /* ignore */ }
}
$('dModeSimple').onclick = () => setDrawerMode(false); $('dModeAdv').onclick = () => setDrawerMode(true);
try { setDrawerMode(localStorage.getItem('chl_drawer_mode') === 'adv'); } catch (e) { setDrawerMode(false); }

const gcalDate = (iso) => iso.replace(/-/g, '');
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const eventTitle = (g) => { const fm = formatById(PL.gameFormats(g)[0]); return g.name + (g.part > 0 ? ' Pt ' + g.part : '') + (fm ? ' (' + fm.label + ')' : '') + (g.stage === 'Published' ? '' : ' - publish'); };
function renderGcal(g) {
  const a = $('dGcal'); const d = g.dueDate;
  a.classList.toggle('disabled', !d);
  if (d) a.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(eventTitle(g)) + '&dates=' + gcalDate(d) + '/' + gcalDate(addDays(d, 1)) + '&details=' + encodeURIComponent('Planned in Critical Hit Studio. Stage: ' + g.stage);
  else a.removeAttribute('href');
}
// calendar file: every dated game, plus your weekly upload days. The UIDs stay the same, so importing again updates instead of duplicating.
const icsEsc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (l) => { const out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); };
function buildIcs() {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Critical Hit Studio//Planner//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Critical Hit Studio'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  state.games.filter((g) => !ARCHIVED.includes(g.stage) && calDateOf(g)).forEach((g) => {
    const d = calDateOf(g);
    L.push('BEGIN:VEVENT', 'UID:chl-' + g.id + '@critical-hit-studio', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + gcalDate(d), 'DTEND;VALUE=DATE:' + gcalDate(addDays(d, 1)),
      'SUMMARY:' + icsEsc(g.stage === 'Published' ? g.name + ' (published)' : eventTitle(g)), 'DESCRIPTION:' + icsEsc('Stage: ' + g.stage + (g.dueDate ? '' : ' (publish date)')), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  });
  const c = cadenceOf(); const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  PL.nextSlots(c.days, todayIso(), 7).slice(0, c.days.length).forEach((d) => {
    const wd = new Date(d + 'T00:00:00').getDay();
    L.push('BEGIN:VEVENT', 'UID:chl-upload-' + wd + '@critical-hit-studio', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + gcalDate(d), 'DTEND;VALUE=DATE:' + gcalDate(addDays(d, 1)), 'RRULE:FREQ=WEEKLY;BYDAY=' + BY[wd], 'SUMMARY:Upload day', 'TRANSP:TRANSPARENT', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function exportIcs() {
  const text = buildIcs(); const n = (text.match(/BEGIN:VEVENT/g) || []).length;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })); a.download = 'critical-hit-studio.ics'; document.body.appendChild(a); a.click(); a.remove();
  toast(`Saved ${n} event${n === 1 ? '' : 's'}. In Google Calendar choose Settings, Import & export, then pick critical-hit-studio.ics`, { label: 'OPEN IMPORT PAGE', fn: () => window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank', 'noopener') }, 15000);
}

// ------------------------------------------------------------------ journal (1.8)
let jrSel = null, jrFilter = '';
const jrOf = (id) => (state.journal || []).find((e) => e.id === id);
const jrTouch = (e) => { e.updatedAt = Date.now(); save(false); };
function jrWords(t) { const n = (String(t).trim().match(/\S+/g) || []).length; return n + (n === 1 ? ' word' : ' words'); }
function jrDateLabel(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? 'No date' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function jrItemsHtml() {
  const q = jrFilter.trim().toLowerCase();
  const list = PL.sortJournal(state.journal || []).filter((e) => !q || [e.title, e.text, ...(e.games || []).map((id) => (findGame(id) || {}).name || '')].join(' ').toLowerCase().includes(q));
  return list.map((e) => `<button type="button" class="jr-item${e.id === jrSel ? ' on' : ''}" data-id="${esc(e.id)}"><b>${esc(e.title || 'Untitled entry')}</b><span class="jr-date">${esc(jrDateLabel(e.date))}</span><span class="jr-snip">${esc(e.text.replace(/\s+/g, ' ').slice(0, 90))}</span>${(e.games || []).length ? `<span class="jr-n">🎮 ${e.games.length}</span>` : ''}</button>`).join('') || `<div class="muted small jr-none">${q ? 'No entries match.' : 'No entries yet. Press New entry.'}</div>`;
}
function jrEditorHtml(e) {
  const linked = (e.games || []).map((id) => findGame(id)).filter(Boolean);
  const free = state.games.filter((g) => !(e.games || []).includes(g.id)).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="jr-row"><input id="jrTitle" class="field jr-title" maxlength="120" placeholder="Title" value="${esc(e.title)}"><input id="jrDate" class="field" type="date" value="${esc(e.date)}" title="Defaults to the day you started the entry"></div>
    <div class="jr-games"><span class="fg-title">Games</span>${linked.map((g) => `<span class="jr-chip"><button type="button" class="jr-open" data-open="${esc(g.id)}" title="Open ${esc(g.name)}">${esc(g.name)}</button><button type="button" class="jr-x" data-unlink="${esc(g.id)}" aria-label="Unlink ${esc(g.name)}">×</button></span>`).join('')}
      <select id="jrAddGame" class="field" aria-label="Link a game"><option value="">+ Link a game…</option>${free.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></div>
    <textarea id="jrText" class="field jr-text" placeholder="What happened in the studio today? Ideas, what's stalling, what worked…">${esc(e.text)}</textarea>
    <div class="jr-foot"><span id="jrCount" class="muted small">${jrWords(e.text)}</span><span id="jrSaved" class="muted small"></span><button type="button" id="jrDel" class="btn danger">Delete entry</button></div>`;
}
function renderJournal() {
  const box = $('journalView'); const sel = jrOf(jrSel);
  if (!sel && jrSel) jrSel = null;
  box.innerHTML = `<div class="jr"><aside class="jr-side"><div class="jr-top"><button type="button" class="btn primary" id="jrNew">+ NEW ENTRY</button><input id="jrSearch" class="field" type="search" placeholder="Search entries…" value="${esc(jrFilter)}"></div><div class="jr-items" id="jrItems">${jrItemsHtml()}</div></aside>
    <section class="jr-edit" id="jrEdit">${sel ? jrEditorHtml(sel) : '<div class="jr-empty"><h3>Studio journal</h3><p class="muted">A place for your own notes: what you tried, what stalled, what made the edit click. Entries are dated automatically and can link to any game on your board.</p></div>'}</section></div>`;
}
function jrNew(gameId) {
  const e = PL.normJournal({ id: PL.rid(), date: todayIso(), createdAt: Date.now(), games: gameId ? [gameId] : [], title: gameId && findGame(gameId) ? findGame(gameId).name : '' });
  state.journal = [e].concat(state.journal || []); jrSel = e.id; save(false);
  view = 'journal'; try { localStorage.setItem('chl_view', view); } catch (x) { /* ignore */ }
  if (!$('detailModal').classList.contains('hidden')) closeModal('detailModal'); else renderBoard();
  { const t = $('jrTitle'); if (t) t.focus(); }
}
$('journalView').addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.closest('#jrNew')) return jrNew();
  const it = t.closest('.jr-item'); if (it) { jrSel = it.dataset.id; renderJournal(); return; }
  const e = jrOf(jrSel);
  const op = t.closest('[data-open]'); if (op) return openDetail(op.dataset.open);
  const un = t.closest('[data-unlink]'); if (un && e) { e.games = e.games.filter((x) => x !== un.dataset.unlink); jrTouch(e); renderJournal(); return; }
  if (t.closest('#jrDel') && e) confirmBox('Delete this journal entry?', 'DELETE', () => { state.journal = state.journal.filter((x) => x.id !== e.id); jrSel = null; save(true); renderJournal(); toast('Entry deleted'); });
});
$('journalView').addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'jrSearch') { jrFilter = t.value; $('jrItems').innerHTML = jrItemsHtml(); return; }
  const e = jrOf(jrSel); if (!e) return;
  if (t.id === 'jrTitle') e.title = t.value.slice(0, 120); else if (t.id === 'jrDate') e.date = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : e.date; else if (t.id === 'jrText') { e.text = t.value; $('jrCount').textContent = jrWords(e.text); } else return;
  jrTouch(e); $('jrItems').innerHTML = jrItemsHtml(); const s2 = $('jrSaved'); if (s2) s2.textContent = 'Saved';
});
$('journalView').addEventListener('change', (ev) => {
  if (ev.target.id !== 'jrAddGame') return; const e = jrOf(jrSel); const id = ev.target.value; if (!e || !id) return;
  e.games = (e.games || []).concat(id); jrTouch(e); renderJournal();
});
$('dJournalIt').onclick = () => { const g = findGame(openId); if (g) jrNew(g.id); };

// ------------------------------------------------------------------ send to the Critical Hit List
function hitListLength() {
  try { const a = JSON.parse(localStorage.getItem('chl_game_list') || 'null'); if (Array.isArray(a)) return a.length; } catch (e) { /* ignore */ }
  return 10;   // the Hit List starts with its 10 sample entries until it is first edited
}
let sendId = null;
$('dSend').onclick = () => {
  const g = findGame(openId); if (!g) return;
  sendId = g.id;
  $('sTitle').textContent = g.name; $('sDev').textContent = studioOf(g);
  $('sPreview').style.backgroundImage = cssUrl(g.banner || g.cover);
  $('sScore').value = g.scoreTag || (appSettings.useScores && g.myScore != null ? g.myScore + '/10' : ''); $('sMeta').value = ''; $('sRank').value = hitListLength() + 1;
  fillPlatformSelect($('sPlatform'), g.playedOn, g); $('sYear').value = yearOf(g);
  $('sHint').textContent = (g.banner ? 'The IGDB artwork will be used as the banner.' : g.cover ? 'No wide artwork on IGDB, so the cover will be used as the banner.' : 'No image available; the entry will have no banner.') + ` The list currently has ${hitListLength()} games, so the default rank is the bottom.`;
  { const aw = CHL_AWARDS.normalize(g.awards); $('sAwards').textContent = aw.length ? 'Awards going with it: ' + aw.map(CHL_AWARDS.label).join(' · ') + '.' : ''; }
  updateTierHint(); openModal('sendModal'); setTimeout(() => $('sScore').focus(), 30);
};
function updateTierHint() {
  const el = $('sTier'); if (!el) return;
  if (!appSettings.useScores) { el.className = 'tier-hint'; el.textContent = ''; return; }
  const t = CHL_TIER.tier($('sScore').value);
  if (t) { el.style.setProperty('--tier', t.color); el.className = 'tier-hint on'; el.textContent = `Tier strip: ${t.name} (${t.score}/10)`; }
  else { el.className = 'tier-hint'; el.textContent = $('sScore').value.trim() ? 'No number found, so no tier strip. Add something like 9/10.' : 'Add a number like 9/10 to get a tier strip.'; }
}
$('sScore').addEventListener('input', updateTierHint);
$('sConfirm').onclick = () => {
  const g = findGame(sendId); if (!g) return;
  const entry = {
    id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title: g.name.toUpperCase(), dev: studioOf(g), score: $('sScore').value.trim(), platform: $('sPlatform').value, year: $('sYear').value.trim().slice(0, 4), meta: $('sMeta').value.trim(),
    targetRank: Math.max(1, parseInt($('sRank').value, 10) || 1),
    bannerUrl: g.banner || g.cover || '', logoUrl: g.logo || '', overlayOpacity: 0.5, textMode: 'white', bannerX: 0, bannerY: 0, bannerZ: 100,
    awards: CHL_AWARDS.normalize(g.awards)
  };
  try {
    let arr = []; try { arr = JSON.parse(localStorage.getItem('chl_prelaunch') || '[]'); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(entry);
    localStorage.setItem('chl_prelaunch', JSON.stringify(arr));
  } catch (e) { toast('Could not save to the Hit List: ' + e.message); return; }
  g.scoreTag = $('sScore').value.trim(); g.sentToHitList = true; save(true); renderBoard();
  closeModal('sendModal'); closeModal('detailModal');
  toast(`"${g.name}" is in the Pre-Launch list`, { label: 'OPEN HIT LIST', fn: () => { location.href = '/hitlist'; } });
};

// ------------------------------------------------------------------ checklist (per stage)
function renderChecks(g) {
  ensureChecks(g, g.stage);
  const list = g.checks[g.stage];
  const pr = checkProgress(g, g.stage);
  const others = STAGES.map((s) => s.id).filter((id) => id !== g.stage).map((id) => ({ id, p: checkProgress(g, id) })).filter((x) => x.p.total);
  if ($('dChecksTitle')) $('dChecksTitle').textContent = g.stage.toUpperCase() + ' CHECKLIST';
  if ($('dChecksSum')) $('dChecksSum').textContent = pr.total ? pr.done + ' of ' + pr.total + ' done' : 'nothing yet';
  $('dChecks').innerHTML =
    list.map((it, i) => `<div class="chk"><label><input type="checkbox" data-i="${i}" ${it.done ? 'checked' : ''}><span class="${it.done ? 'done' : ''}">${esc(it.t)}</span></label><button type="button" class="x sm" data-del="${i}" aria-label="Remove item" title="Remove">✕</button></div>`).join('') +
    `<div class="row chk-add"><input id="chkNew" class="field grow" placeholder="Add an item and press Enter" autocomplete="off"></div>` +
    (others.length ? `<div class="chk-others muted small">Other stages: ${others.map((x) => `${esc(x.id)} ${x.p.done}/${x.p.total}${x.p.done === x.p.total ? ' ✓' : ''}`).join(' · ')}</div>` : '');
}
$('dChecks').addEventListener('change', (e) => {
  const g = findGame(openId); const cb = e.target.closest('input[type=checkbox]'); if (!g || !cb) return;
  const it = g.checks[g.stage][+cb.dataset.i]; if (!it) return;
  it.done = cb.checked; renderChecks(g); touch(g);
});
$('dChecks').addEventListener('click', (e) => {
  const g = findGame(openId); const b = e.target.closest('[data-del]'); if (!g || !b) return;
  g.checks[g.stage].splice(+b.dataset.del, 1); renderChecks(g); touch(g);
});
$('dChecks').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.id !== 'chkNew') return;
  const g = findGame(openId); const v = e.target.value.trim(); if (!g || !v) return;
  e.preventDefault(); g.checks[g.stage].push({ t: v.slice(0, 120), done: false }); renderChecks(g); touch(g); $('chkNew').focus();
});

// ------------------------------------------------------------------ published video + stats
function renderVideo(g) {
  const id = ytId(g.videoUrl);
  const open = $('dVideoOpen'), st = $('dVideoStudio');
  if (id) {
    open.href = 'https://www.youtube.com/watch?v=' + id; open.classList.remove('disabled');
    st.href = 'https://studio.youtube.com/video/' + id + '/edit'; st.classList.remove('disabled');
  } else {
    open.removeAttribute('href'); open.classList.add('disabled');
    st.removeAttribute('href'); st.classList.add('disabled');
  }
  $('dVideoRefresh').disabled = !id;
  const v = g.video && g.video.id === id ? g.video : null;
  renderVideoPicker(g);
  $('dVideoStats').textContent = !g.videoUrl ? '' : !id ? 'That does not look like a YouTube link.' :
    v ? `${compact(v.views)} views · ${compact(v.likes) || '–'} likes · ${compact(v.comments) || '–'} comments · updated ${new Date(v.fetchedAt).toLocaleDateString()}` :
    (appSettings.youtubeHasKey ? 'No stats yet. Press Update stats.' : 'Add a YouTube API key in Settings to show views and likes.');
}
async function loadVideoStats(g, quiet) {
  const id = ytId(g.videoUrl); if (!id) return false;
  try {
    const d = await api('/api/youtube/video?id=' + encodeURIComponent(id));
    g.video = d;
    if (d.publishedAt && g.stage === 'Published') g.publishedAt = d.publishedAt.slice(0, 10);
    save(false); return true;
  } catch (e) { if (!quiet) toast(e.message); return false; }
}
$('dVideo').addEventListener('change', async () => {
  const g = findGame(openId); if (!g || !appSettings.youtubeHasKey || !ytId(g.videoUrl)) return;
  if (g.video && g.video.id === ytId(g.videoUrl)) return;
  if (await loadVideoStats(g, true) && openId === g.id) { renderVideo(g); }
});
$('dVideoRefresh').onclick = async () => {
  const g = findGame(openId); if (!g) return;
  const b = $('dVideoRefresh'); b.disabled = true; b.textContent = '↻ Updating…';
  const ok = await loadVideoStats(g, false);
  b.disabled = false; b.textContent = '↻ Update stats'; if (ok) toast('Video stats updated'); renderVideo(g);
};

let channelVideosCache = null;
function renderVideoPicker(g) {
  const row = $('dVideoPickRow');
  const canPick = !!(appSettings.youtubeHasKey && appSettings.youtubeChannel);
  row.classList.toggle('hidden', !canPick);
  if (!canPick) return;
  const sel = $('dVideoPick');
  const curId = ytId(g.videoUrl);
  if (channelVideosCache) {
    sel.innerHTML = '<option value="">Pick a public upload from your channel…</option>' +
      channelVideosCache.map((v) => `<option value="${esc(v.url)}"${v.id === curId ? ' selected' : ''}>${esc(v.title)}${v.publishedAt ? ' (' + v.publishedAt.slice(0, 10) + ')' : ''}</option>`).join('');
  }
}
async function loadChannelVideos(quiet) {
  const btn = $('dVideoPickLoad'); btn.disabled = true; btn.textContent = '↻ Loading…';
  try {
    const { videos } = await api('/api/youtube/channel-videos');
    channelVideosCache = videos || [];
    const g = findGame(openId); if (g) renderVideoPicker(g);
    if (!quiet) toast(channelVideosCache.length ? `Loaded ${channelVideosCache.length} public uploads` : 'No public uploads found on this channel.');
  } catch (e) { if (!quiet) toast(e.message); }
  btn.disabled = false; btn.textContent = '↻ Load';
}
$('dVideoPickLoad').onclick = () => loadChannelVideos(false);
$('dVideoPick').addEventListener('change', async () => {
  const g = findGame(openId); const url = $('dVideoPick').value; if (!g || !url) return;
  g.videoUrl = url; $('dVideo').value = url; renderVideo(g); touch(g);
  if (await loadVideoStats(g, true) && openId === g.id) renderVideo(g);
});

// ------------------------------------------------------------------ views: board / calendar / stats
function renderBoard() {
  document.querySelectorAll('#viewTabs .vt').forEach((b) => { const on = b.dataset.view === view; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  $('board').classList.toggle('hidden', view !== 'board');
  $('calView').classList.toggle('hidden', view !== 'calendar');
  $('statsView').classList.toggle('hidden', view !== 'stats');
  $('journalView').classList.toggle('hidden', view !== 'journal');
  document.body.dataset.view = view;
  renderPipeBar();
  if (view === 'board') renderBoardView();
  else { $('emptyState').classList.add('hidden'); if (view === 'calendar') renderCalendar(); else if (view === 'journal') renderJournal(); else renderStats(); }
}
document.getElementById('viewTabs').addEventListener('click', (e) => {
  const b = e.target.closest('.vt'); if (!b) return;
  view = b.dataset.view; try { localStorage.setItem('chl_view', view); } catch (x) { /* ignore */ }
  renderBoard();
});

let calMonth = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
const calDateOf = (g) => g.dueDate || (g.stage === 'Published' ? g.publishedAt : '') || '';
function renderCalendar() {
  const box = $('calView'); const { y, m } = calMonth;
  const first = new Date(y, m, 1); const lead = (first.getDay() + 6) % 7;       // week starts on Monday
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((lead + days) / 7) * 7;
  const byDate = {};
  state.games.filter((g) => !ARCHIVED.includes(g.stage)).forEach((g) => { const d = calDateOf(g); if (d) (byDate[d] = byDate[d] || []).push(g); });
  const today = todayIso();
  let html = `<div class="cal-head"><button class="btn" id="calPrev" aria-label="Previous month">‹</button><h3>${esc(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</h3><button class="btn" id="calNext" aria-label="Next month">›</button><button class="btn" id="calToday">Today</button><button class="btn" id="calExport" title="Download your dates as a calendar file Google Calendar can import">⇪ Google Calendar</button><span class="muted small cal-hint">Drag a game onto a day to set its date</span></div><div class="cal-grid">` +
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < cells; i++) {
    const dn = i - lead + 1; const inMonth = dn >= 1 && dn <= days;
    if (!inMonth) { html += '<div class="cal-cell off"></div>'; continue; }
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dn).padStart(2, '0');
    const gs = byDate[iso] || [];
    html += `<div class="cal-cell${iso === today ? ' today' : ''}${PL.isSlot(iso, cadenceOf().days) ? ' slot' : ''}" data-date="${iso}"><div class="cal-num">${dn}${PL.isSlot(iso, cadenceOf().days) ? '<span class="cal-slot" title="Upload day">UPLOAD</span>' : ''}</div>` +
      gs.slice(0, 3).map((g) => `<button class="cal-item${!DONE_STAGES.includes(g.stage) && iso < today ? ' over' : ''}" data-id="${esc(g.id)}" style="--stage:${(STAGES.find((s) => s.id === g.stage) || STAGES[0]).color}" title="${esc(g.name)} · ${esc(g.stage)}">${esc(g.name)}</button>`).join('') +
      (gs.length > 3 ? `<div class="cal-more muted small">+${gs.length - 3} more</div>` : '') + '</div>';
  }
  html += '</div>';
  const unsched = state.games.filter((g) => !DONE_STAGES.includes(g.stage) && g.stage !== 'Backlogged' && !g.dueDate);
  html += `<div class="cal-unsched" data-date=""><h4>No target date yet <span class="muted small">(${unsched.length})</span></h4>` + (unsched.length ? unsched.map((g) => `<button class="cal-item" data-id="${esc(g.id)}" style="--stage:${(STAGES.find((s) => s.id === g.stage) || STAGES[0]).color}">${esc(g.name)} <small>${esc(g.stage)}</small></button>`).join('') : '<span class="muted small">Every game in progress has a date.</span>') + '</div>';
  box.innerHTML = html;
  const shift = (d) => { calMonth.m += d; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; } if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; } renderCalendar(); };
  $('calPrev').onclick = () => shift(-1); $('calNext').onclick = () => shift(1);
  $('calExport').onclick = exportIcs;
  $('calToday').onclick = () => { const d = new Date(); calMonth = { y: d.getFullYear(), m: d.getMonth() }; renderCalendar(); };
  box.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => openDetail(b.dataset.id); });
  wireCalendarDnD(box);
}

function barRows(rows, fmt, max) {
  const top = max || Math.max(1, ...rows.map((r) => r.v));
  return rows.map((r) => `<div class="bar-row"><span class="bar-label" title="${esc(r.label)}">${esc(r.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, (r.v / top) * 100)}%;${r.color ? 'background:' + r.color : ''}"></span></span><span class="bar-val">${esc(fmt ? fmt(r) : r.v)}</span></div>`).join('');
}
let recapMode = 'month';
let recapYear = String(new Date().getFullYear());
let recapMonth = String(new Date().getMonth() + 1).padStart(2, '0');

function renderRecapHtml(G) {
  const years = [...new Set([String(new Date().getFullYear())].concat(G.map((g) => PL.pubDateOf(g).slice(0, 4)).filter(Boolean)))].sort().reverse();
  if (!years.includes(recapYear)) recapYear = years[0];
  const rc = PL.recap(G, recapMode, recapYear, recapMonth, formatsOf());
  const awText = (x) => x.game + ' — ' + (CHL_AWARDS.label(x.award) || '');
  return `<section class="recap-card">
    <div class="recap-head">
      <h4>${esc(recapMode === 'month' ? 'Monthly Recap' : 'Year-End Recap')} · ${esc(rc.periodLabel)}</h4>
      <div class="recap-controls">
        <div class="seg" role="group" aria-label="Recap period">
          <button type="button" id="rcModeMonth" class="${recapMode === 'month' ? 'on' : ''}">MONTHLY</button>
          <button type="button" id="rcModeYear" class="${recapMode === 'year' ? 'on' : ''}">YEARLY</button>
        </div>
        ${recapMode === 'month' ? `<select id="rcMonth" class="field" aria-label="Month">${PL.MONTHS.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}"${v === recapMonth ? ' selected' : ''}>${m}</option>`; }).join('')}</select>` : ''}
        <select id="rcYear" class="field" aria-label="Year">${years.map((y) => `<option value="${y}"${y === recapYear ? ' selected' : ''}>${y}</option>`).join('')}</select>
        <button type="button" class="btn" id="rcCopy">Copy recap</button>
      </div>
    </div>
    <div class="facts">
      <div class="fact"><span>Published</span><b>${rc.count}</b></div>
      <div class="fact"><span>Hours played</span><b>${rc.hours ? hrs(rc.hours) : '–'}</b></div>
      <div class="fact"><span>Video views</span><b>${rc.views ? compact(rc.views) : '–'}</b></div>
      <div class="fact"><span>Awards given</span><b>${rc.awards.length}</b></div>
    </div>
    ${rc.count ? `<div class="recap-grid">
      <div><h5>Published in ${esc(rc.periodLabel)}</h5><div class="recap-list">${rc.games.map((g) => `<button type="button" class="recap-item" data-open-game="${esc(g.id)}"><span>${esc(g.name)}</span><small>${esc(PL.pubDateOf(g))}${g.video && g.video.views != null ? ' · ▶ ' + compact(g.video.views) : ''}</small></button>`).join('')}</div></div>
      <div>${rc.byFormat.length ? `<h5>By format</h5>${barRows(rc.byFormat, (r) => r.v)}` : ''}${rc.awards.length ? `<h5>Awards</h5><div class="recap-list">${rc.awards.map((a) => `<div class="recap-item" style="cursor:default"><span>${esc(awText(a))}</span></div>`).join('')}</div>` : ''}</div>
    </div>` : `<div class="muted small" style="margin-top:8px">No videos published in ${esc(rc.periodLabel)} yet.</div>`}
  </section>`;
}

function renderStats() {
  const box = $('statsView'); const G = state.games;
  const active = G.filter((g) => !ARCHIVED.includes(g.stage));
  const scored = G.filter((g) => g.myScore != null && g.myScore !== '');
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const hours = G.reduce((s, g) => s + (g.hoursPlayed || 0), 0);
  const views = G.reduce((s, g) => s + ((g.video && g.video.views) || 0), 0);
  const tileList = [
    ['Games', G.length], ['Published', G.filter((g) => g.stage === 'Published').length], ['In progress', G.filter((g) => ['Recording', 'Writing', 'Editing', 'Reviewing'].includes(g.stage)).length],
    ['Hours played', hours ? Math.round(hours * 10) / 10 : '–'], ['Video views', views ? compact(views) : '–']
  ];
  if (appSettings.useScores) tileList.splice(4, 0, ['Average score', scored.length ? (Math.round(avg(scored.map((g) => +g.myScore)) * 10) / 10) + '/10' : '–']);
  const tiles = tileList.map(([k, v]) => `<div class="stat-tile"><span>${k}</span><b>${esc(v)}</b></div>`).join('');

  const pipeline = barRows(STAGES.map((s) => ({ label: s.id, v: G.filter((g) => g.stage === s.id).length, color: s.color })), (r) => r.v);

  // time: first Planned -> Published, and games that have sat longest in a working stage
  const lead = G.map((g) => { ensureHistory(g); const a = g.history.find((h) => h.stage === 'Planned' || h.stage === 'Recording'); const b = g.history.find((h) => h.stage === 'Published'); return a && b && b.at > a.at ? (b.at - a.at) / 86400000 : null; }).filter((x) => x != null);
  const stuck = active.filter((g) => !['Backlogged', 'Published'].includes(g.stage)).map((g) => ({ g, d: daysSince(stageSince(g)) })).sort((a, b) => b.d - a.d).slice(0, 6);

  const group = (keyFn) => { const m = {}; scored.forEach((g) => { const k = keyFn(g); if (k) (m[k] = m[k] || []).push(+g.myScore); }); return Object.entries(m).map(([label, a]) => ({ label, v: avg(a), n: a.length })).sort((x, y) => y.v - x.v).slice(0, 8); };
  const byPlat = group((g) => P.label(g.playedOn, 'full'));
  const byGenre = group((g) => (g.genres || [])[0]);
  const hoursTop = G.filter((g) => g.hoursPlayed > 0).sort((a, b) => b.hoursPlayed - a.hoursPlayed).slice(0, 6);
  const vids = G.filter((g) => g.video && g.video.views != null).sort((a, b) => b.video.views - a.video.views).slice(0, 6);
  const fmts = formatsOf().map((f) => ({ label: f.label, v: G.filter((g) => PL.gameFormats(g).includes(f.id)).length, color: f.color })).filter((r) => r.v > 0);
  const seriesMap = {}; G.forEach((g) => { const s = (g.series || '').trim(); if (s) seriesMap[s] = (seriesMap[s] || 0) + 1; });
  const bySeries = Object.entries(seriesMap).map(([label, v]) => ({ label, v, color: '#93c5fd' })).sort((a, b) => b.v - a.v).slice(0, 8);
  const none = '<div class="muted small">Not enough data yet.</div>';
  const dur = PL.stageDurations(G);
  const durRows = ['Recording', 'Writing', 'Editing', 'Reviewing'].filter((st) => (dur[st] || []).length >= 2).map((st) => ({ label: st, v: Math.round(PL.median(dur[st]) * 10) / 10, color: (STAGES.find((x) => x.id === st) || {}).color }));
  const stageTimes = durRows.length ? barRows(durRows, (r) => r.v + 'd') + '<div class="muted small">Median days a video spends in each stage. If one bar towers over the rest, that is where it stalls.</div>' : '<div class="muted small">Shows once at least two videos have moved through a stage. History starts from when you installed this version.</div>';

  const ch = appSettings.youtubeChannel;
  const chCard = ch ? `<section class="stat-card"><h4>YouTube channel ${esc(ch.handle || ch.title || '')}</h4>
    ${(ch.subscribers != null || ch.views != null || ch.videos != null)
      ? `<div class="facts">
          ${ch.subscribers != null ? `<div class="fact"><span>Subscribers</span><b>${esc(compact(ch.subscribers))}</b></div>` : ''}
          ${ch.views != null ? `<div class="fact"><span>Total views</span><b>${esc(compact(ch.views))}</b></div>` : ''}
          ${ch.videos != null ? `<div class="fact"><span>Videos</span><b>${esc(compact(ch.videos))}</b></div>` : ''}
        </div>`
      : '<div class="muted small">Add a YouTube API key in Settings to show subscriber and channel stats.</div>'}
    <div class="row">
      <a class="btn" href="${esc(ch.id ? 'https://studio.youtube.com/channel/' + ch.id : 'https://studio.youtube.com/')}" target="_blank" rel="noopener">Open YouTube Studio ↗</a>
      ${appSettings.youtubeHasKey ? '<button id="statsChannelRefresh" class="btn" type="button">↻ Refresh channel</button>' : ''}
    </div></section>` : '';

  box.innerHTML = `<div class="stat-tiles">${tiles}</div>${renderRecapHtml(G)}<div class="stat-grid">
    ${chCard}
    <section class="stat-card"><h4>Pipeline</h4>${pipeline}</section>
    <section class="stat-card"><h4>Time in the pipeline</h4>
      <div class="muted small">${lead.length ? `Average ${Math.round(avg(lead) * 10) / 10} days from Planned/Recording to Published (${lead.length} game${lead.length > 1 ? 's' : ''}). History starts from when you installed this version.` : 'Shows once a game has moved from Planned or Recording to Published.'}</div>
      <h5>Longest in their current stage</h5>${stuck.length ? stuck.map((x) => `<button class="stuck" data-id="${esc(x.g.id)}"><span>${esc(x.g.name)}</span><small>${esc(x.g.stage)}</small><b class="${x.d >= 14 ? 'bad' : ''}">${x.d}d</b></button>`).join('') : none}</section>
    <section class="stat-card"><h4>Where the time goes</h4>${stageTimes}</section>
    ${appSettings.useScores ? `<section class="stat-card"><h4>Average score by platform</h4>${byPlat.length ? barRows(byPlat, (r) => (Math.round(r.v * 10) / 10) + ' (' + r.n + ')', 10) : none}</section>` : ''}
    ${appSettings.useScores ? `<section class="stat-card"><h4>Average score by main genre</h4>${byGenre.length ? barRows(byGenre, (r) => (Math.round(r.v * 10) / 10) + ' (' + r.n + ')', 10) : none}</section>` : ''}
    <section class="stat-card"><h4>Most hours played</h4>${hoursTop.length ? barRows(hoursTop.map((g) => ({ label: g.name, v: g.hoursPlayed })), (r) => hrs(r.v)) : none}</section>
    <section class="stat-card"><h4>Video views</h4>${vids.length ? barRows(vids.map((g) => ({ label: g.name, v: g.video.views })), (r) => compact(r.v)) : none}
      <div class="row"><button id="statsVideos" class="btn" ${appSettings.youtubeHasKey ? '' : 'disabled title="Add a YouTube API key in Settings first"'}>↻ Update all video stats</button><span id="statsVideosMsg" class="muted small"></span></div></section>
    ${fmts.length ? `<section class="stat-card"><h4>Videos by format</h4>${barRows(fmts, (r) => r.v + ' video' + (r.v > 1 ? 's' : ''))}</section>` : ''}
    ${bySeries.length ? `<section class="stat-card"><h4>Games by series</h4>${barRows(bySeries, (r) => r.v + ' game' + (r.v > 1 ? 's' : ''))}</section>` : ''}
  </div>`;
  box.querySelectorAll('[data-open-game]').forEach((b) => { b.onclick = () => openDetail(b.dataset.openGame); });
  if ($('rcModeMonth')) $('rcModeMonth').onclick = () => { recapMode = 'month'; renderStats(); };
  if ($('rcModeYear')) $('rcModeYear').onclick = () => { recapMode = 'year'; renderStats(); };
  if ($('rcMonth')) $('rcMonth').onchange = () => { recapMonth = $('rcMonth').value; renderStats(); };
  if ($('rcYear')) $('rcYear').onchange = () => { recapYear = $('rcYear').value; renderStats(); };
  if ($('rcCopy')) $('rcCopy').onclick = async () => {
    const rc = PL.recap(G, recapMode, recapYear, recapMonth, formatsOf());
    const lines = [
      `${recapMode === 'month' ? 'MONTHLY' : 'YEAR-END'} RECAP: ${rc.periodLabel}`,
      `Published: ${rc.count} | Hours: ${rc.hours}h | Views: ${compact(rc.views) || 0} | Awards: ${rc.awards.length}`
    ];
    if (rc.games.length) { lines.push('', 'VIDEOS'); rc.games.forEach((g) => lines.push(`- ${g.name} (${PL.pubDateOf(g)})${g.video && g.video.views != null ? ' — ' + compact(g.video.views) + ' views' : ''}`)); }
    if (rc.awards.length) { lines.push('', 'AWARDS'); rc.awards.forEach((a) => lines.push(`- ${a.game}: ${CHL_AWARDS.label(a.award)}`)); }
    try { await navigator.clipboard.writeText(lines.join('\n')); toast('Recap copied to clipboard'); }
    catch (e) { toast('Could not copy recap'); }
  };
  box.querySelectorAll('.stuck').forEach((b) => { b.onclick = () => openDetail(b.dataset.id); });
  const sc = $('statsChannelRefresh');
  if (sc && appSettings.youtubeChannel) sc.onclick = async () => {
    sc.disabled = true; sc.textContent = '↻ Refreshing…';
    try {
      const q = appSettings.youtubeChannel.id || appSettings.youtubeChannel.handle;
      const d = await api('/api/youtube/channel?q=' + encodeURIComponent(q));
      await putJson('/api/settings', { youtubeChannel: d });
      await loadSettings(); toast('Channel stats updated');
    } catch (e) { toast(e.message); sc.disabled = false; sc.textContent = '↻ Refresh channel'; }
  };
  const uv = $('statsVideos');
  if (uv) uv.onclick = async () => {
    const list = state.games.filter((g) => ytId(g.videoUrl)); let ok = 0;
    uv.disabled = true;
    for (let i = 0; i < list.length; i++) { $('statsVideosMsg').textContent = `${i + 1}/${list.length}…`; if (await loadVideoStats(list[i], true)) ok++; }
    save(true); renderStats(); $('statsVideosMsg').textContent = list.length ? `Updated ${ok} of ${list.length}` : 'No games have a video link yet.';
  };
}

// ------------------------------------------------------------------ launch shortcut (drawer)
async function openProjectFolder(folder) {
  const t = String(folder || '').trim(); if (!t) return;
  if (window.chlDesktop && window.chlDesktop.openFolder) {
    try { const r = await window.chlDesktop.openFolder(t); if (!r.ok) toast(r.error); }
    catch (e) { toast('Could not open folder: ' + e.message); }
  } else toast('Opening local folders only works in the desktop app.');
}
function renderLaunch(g) {
  $('dLaunch').value = g.launchTarget || '';
  $('dLaunchPick').classList.toggle('hidden', !window.chlDesktop);
  $('dLaunchGo').disabled = !g.launchTarget;
  $('dFolder').value = g.projectFolder || '';
  $('dFolderPick').classList.toggle('hidden', !window.chlDesktop);
  $('dFolderOpen').disabled = !g.projectFolder;
}
bind('dLaunch', (g, v) => { g.launchTarget = v.trim(); $('dLaunchGo').disabled = !g.launchTarget; });
bind('dFolder', (g, v) => { const s = v.trim(); if (s) g.projectFolder = s; else delete g.projectFolder; $('dFolderOpen').disabled = !g.projectFolder; });
$('dLaunch').addEventListener('change', () => renderBoard());
$('dFolder').addEventListener('change', () => renderBoard());
$('dLaunchGo').onclick = () => { const g = findGame(openId); if (g) runLaunch(g); };
$('dFolderOpen').onclick = () => { const g = findGame(openId); if (g) openProjectFolder(g.projectFolder); };
$('dLaunchPick').onclick = async () => {
  const g = findGame(openId); if (!g || !window.chlDesktop) return;
  const p = await window.chlDesktop.pickLauncher(); if (!p) return;
  g.launchTarget = p; $('dLaunch').value = p; $('dLaunchGo').disabled = false; touch(g); renderBoard();
};
$('dFolderPick').onclick = async () => {
  const g = findGame(openId); if (!g || !window.chlDesktop || !window.chlDesktop.pickFolder) return;
  const p = await window.chlDesktop.pickFolder(); if (!p) return;
  g.projectFolder = p; $('dFolder').value = p; $('dFolderOpen').disabled = false; touch(g); renderBoard();
};

// ------------------------------------------------------------------ artwork from SteamGridDB
const ART_KINDS = { grid: { label: 'POSTER', cls: 'poster' }, hero: { label: 'BANNER', cls: 'banner' }, logo: { label: 'LOGO', cls: 'logomark' } };
let art = null;     // { kind, gameId, sgdbId, done }
function renderArt(g) {
  [['dArtPoster', g.cover], ['dArtBanner', g.banner], ['dArtLogo', g.logo]].forEach(([id, url]) => {
    const el = $(id); el.style.backgroundImage = cssUrl(url); el.classList.toggle('no-art', !safeUrl(url));
    el.textContent = safeUrl(url) ? '' : el.title.split(' ')[0].toUpperCase();
  });
  $('dUseLogo').checked = !!g.useLogo; $('dUseLogo').disabled = !g.logo;
  $('dArtMsg').textContent = appSettings.sgdbHasKey ? (g.coverCustom || g.bannerCustom || g.logo ? 'Custom art in use' : '') : 'Add a SteamGridDB key in Settings to choose art.';
}
$('dUseLogo').addEventListener('change', () => { const g = findGame(openId); if (!g) return; g.useLogo = $('dUseLogo').checked && !!g.logo; touch(g); renderBoard(); });

function openArt(kind, g, done) {
  if (!appSettings.sgdbHasKey) { toast('Add your SteamGridDB API key in Settings first.'); openSettings('connections'); return; }
  art = { kind, gameId: g.id, sgdbId: g.sgdbId || null, done };
  $('artTitle').textContent = 'CHOOSE ' + ART_KINDS[kind].label + ' · ' + g.name;
  $('artSearch').value = g.sgdbName || g.name; $('artGames').innerHTML = ''; $('artGrid').innerHTML = ''; $('artHint').textContent = '';
  openModal('artModal');
  if (art.sgdbId) { showArtGames([{ id: art.sgdbId, name: g.sgdbName || g.name }], art.sgdbId); loadArt(art.sgdbId); } else artSearch();
}
async function artSearch() {
  const q = $('artSearch').value.trim(); if (q.length < 2) return;
  $('artGames').innerHTML = '<span class="muted small">Searching…</span>'; $('artGrid').innerHTML = '';
  try {
    const { results } = await api('/api/sgdb/search?q=' + encodeURIComponent(q));
    if (!results.length) { $('artGames').innerHTML = ''; $('artHint').textContent = 'No game with that name on SteamGridDB. Try a shorter name.'; return; }
    showArtGames(results, results[0].id); loadArt(results[0].id);
  } catch (e) { $('artGames').innerHTML = ''; $('artHint').textContent = e.message; }
}
function showArtGames(list, activeId) {
  $('artGames').innerHTML = list.map((r) => `<button type="button" class="chip gsug${r.id === activeId ? ' on' : ''}" data-sg="${r.id}" data-name="${esc(r.name)}">${esc(r.name)}</button>`).join('');
}
$('artGames').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sg]'); if (!b) return;
  $('artGames').querySelectorAll('.gsug').forEach((x) => x.classList.toggle('on', x === b));
  loadArt(+b.dataset.sg, b.dataset.name);
});
async function loadArt(sgId, name) {
  if (!art) return; art.sgdbId = sgId;
  const g = findGame(art.gameId); if (g) { g.sgdbId = sgId; if (name) g.sgdbName = name; save(false); }
  $('artGrid').innerHTML = '<span class="muted small">Loading artwork…</span>'; $('artHint').textContent = '';
  try {
    const { items } = await api(`/api/sgdb/assets?kind=${art.kind}&game=${sgId}`);
    if (!art || art.sgdbId !== sgId) return;
    if (!items.length) { $('artGrid').innerHTML = ''; $('artHint').textContent = 'SteamGridDB has no ' + ART_KINDS[art.kind].label.toLowerCase() + ' art for this game. Try another match above.'; return; }
    $('artGrid').innerHTML = items.map((it, i) => `<button type="button" class="art-item ${ART_KINDS[art.kind].cls}" data-i="${i}" title="${esc([it.style, it.author].filter(Boolean).join(' · '))}"><img src="${esc(it.thumb)}" loading="lazy" alt=""><span>${esc(it.style || '')}${it.author ? ' · ' + esc(it.author) : ''}</span></button>`).join('');
    art.items = items;
  } catch (e) { $('artGrid').innerHTML = ''; $('artHint').textContent = e.message; }
}
$('artGrid').addEventListener('click', async (e) => {
  const b = e.target.closest('.art-item'); if (!b || !art || !art.items) return;
  const it = art.items[+b.dataset.i]; if (!it) return;
  const g = findGame(art.gameId); if (!g) return;
  $('artHint').textContent = 'Downloading…'; $('artGrid').classList.add('busy');
  try {
    const { path } = await api('/api/sgdb/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: it.url, kind: art.kind, game: art.sgdbId }) });
    const done = art.done; art = null;
    closeModal('artModal');
    if (done) done(g, path, it.url);
  } catch (err) { $('artHint').textContent = err.message; }
  $('artGrid').classList.remove('busy');
});
$('artSearchBtn').onclick = artSearch;
$('artSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); artSearch(); } });
function applyArt(kind) {
  return (g, path, remoteUrl) => {
    if (kind === 'grid') { g.cover = path; g.coverCustom = true; if (remoteUrl && /^https:\/\//.test(remoteUrl)) { g.coverRemote = remoteUrl; delete g.coverThumb; } }
    else if (kind === 'hero') { g.banner = path; g.bannerCustom = true; }
    else { const first = !g.logo; g.logo = path; if (first) g.useLogo = true; }
    save(true); renderBoard();
    if (openId === g.id) { renderArt(g); $('dBanner').style.backgroundImage = cssUrl(g.banner || g.cover); }
    if (!$('sendModal').classList.contains('hidden') && sendId === g.id) $('sPreview').style.backgroundImage = cssUrl(g.banner || g.cover);
    toast(kind === 'logo' ? 'Logo set. It replaces the title on the board (untick it in the drawer to keep the text).' : (kind === 'hero' ? 'Banner set' : 'Poster set'));
  };
}
document.querySelectorAll('[data-art]').forEach((b) => b.addEventListener('click', () => { const g = findGame(openId); if (g) openArt(b.dataset.art, g, applyArt(b.dataset.art)); }));
$('sBanner').onclick = () => { const g = findGame(sendId); if (g) openArt('hero', g, applyArt('hero')); };
$('dArtReset').onclick = () => {
  const g = findGame(openId); if (!g) return;
  g.coverCustom = false; g.bannerCustom = false; g.logo = ''; g.useLogo = false;
  if (g.igdbId) { $('dRefresh').click(); toast('Back to the IGDB art'); }
  else { g.cover = ''; g.banner = ''; save(true); renderBoard(); renderArt(g); $('dBanner').style.backgroundImage = 'none'; toast('Art cleared'); }
  renderArt(g); touch(g);
};

// ------------------------------------------------------------------ calendar: drag a game onto a day
function setGameDate(id, iso) {
  const g = findGame(id); if (!g) return;
  if (g.stage === 'Published') { g.publishedAt = iso; g.dueDate = ''; } else g.dueDate = iso;
  save(true); renderCalendar();
  toast(iso ? `"${g.name}" → ${new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : `"${g.name}" has no target date now`);
}
function wireCalendarDnD(box) {
  let dragId = null;
  box.querySelectorAll('.cal-item[data-id]').forEach((b) => {
    b.draggable = true;
    b.addEventListener('dragstart', (e) => { dragId = b.dataset.id; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; b.classList.add('dragging'); box.classList.add('dragging-on'); });
    b.addEventListener('dragend', () => { b.classList.remove('dragging'); box.classList.remove('dragging-on'); box.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); });
  });
  const targets = [...box.querySelectorAll('.cal-cell[data-date]'), box.querySelector('.cal-unsched')].filter(Boolean);
  targets.forEach((t) => {
    t.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; t.classList.add('drop'); });
    t.addEventListener('dragleave', (e) => { if (!t.contains(e.relatedTarget)) t.classList.remove('drop'); });
    t.addEventListener('drop', (e) => {
      e.preventDefault(); t.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain') || dragId; if (id) setGameDate(id, t.dataset.date || '');
    });
  });
}

// ------------------------------------------------------------------ settings: SteamGridDB key + card display
$('sgdbSave').onclick = async () => {
  try { await putJson('/api/settings', { sgdbApiKey: $('setSgdb').value }); await loadSettings(); $('setSgdb').value = ''; $('setSgdb').placeholder = appSettings.sgdbHasKey ? '•••••••• saved (leave blank to keep)' : 'Paste your SteamGridDB API key'; $('sgdbMsg').textContent = appSettings.sgdbHasKey ? 'Saved. Press TEST to check it.' : 'Nothing to save.'; if (openId) renderArt(findGame(openId)); }
  catch (e) { toast(e.message); }
};
$('sgdbTest').onclick = async () => {
  $('sgdbMsg').textContent = 'Testing…';
  try { const { results } = await api('/api/sgdb/search?q=zelda'); $('sgdbMsg').textContent = results.length ? `Works: found ${results.length} games (e.g. ${results[0].name}).` : 'Connected, but the search returned nothing.'; }
  catch (e) { $('sgdbMsg').textContent = e.message; }
};
$('sgdbClear').onclick = () => confirmBox('Remove the saved SteamGridDB key from this computer?', 'REMOVE', async () => { await putJson('/api/settings', { clearSgdb: true }); await loadSettings(); openSettings(); toast('SteamGridDB key removed'); });

function renderDisplayOptions() {
  $('dispBox').innerHTML = DISPLAY_OPTIONS.map(([k, label]) => `<label class="inline-check"><input type="checkbox" data-disp="${k}" ${show(k) ? 'checked' : ''}> ${esc(label)}</label>`).join('') +
    '<div class="row disp-actions"><button class="btn" type="button" id="dispAll">Show all</button><button class="btn" type="button" id="dispSimple">Simple (poster + title + studio)</button><button class="btn" type="button" id="dispMin">Title only</button></div>';
}
function setDisplay(map) { state.display = map; save(false); renderBoard(); renderDisplayOptions(); }
$('dispBox').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-disp]'); if (!cb) return;
  const d = Object.assign({}, state.display || {}); if (cb.checked) delete d[cb.dataset.disp]; else d[cb.dataset.disp] = false;
  state.display = Object.keys(d).length ? d : null; save(false); renderBoard();
});
$('dispBox').addEventListener('click', (e) => {
  if (e.target.id === 'dispAll') setDisplay(null);
  else if (e.target.id === 'dispSimple') { const d = {}; DISPLAY_OPTIONS.forEach(([k]) => { if (k !== 'cover' && k !== 'studio') d[k] = false; }); setDisplay(d); }
  else if (e.target.id === 'dispMin') { const d = {}; DISPLAY_OPTIONS.forEach(([k]) => { if (k !== 'cover') d[k] = false; }); setDisplay(d); }
});

// ------------------------------------------------------------------ settings
function updateChannelUI() {
  const ch = appSettings.youtubeChannel;
  const label = (ch && (ch.handle || ch.title)) || '';
  const el = $('sbarCh'); if (el) el.setAttribute('data-ch', label);
  const btn = $('ytStudioBtn');
  if (btn) {
    const url = ch && ch.id ? 'https://studio.youtube.com/channel/' + encodeURIComponent(ch.id) : (label ? 'https://studio.youtube.com/' : '');
    btn.classList.toggle('hidden', !url);
    if (url) { btn.href = url; btn.title = 'Open YouTube Studio' + (label ? ' (' + label + ')' : ''); }
    else btn.removeAttribute('href');
  }
  const av = $('ytAvatarBtn');
  if (av) {
    const chUrl = ch && ch.handle ? 'https://www.youtube.com/' + encodeURIComponent(ch.handle).replace('%40', '@') : (ch && ch.id ? 'https://www.youtube.com/channel/' + encodeURIComponent(ch.id) : '');
    av.classList.toggle('hidden', !chUrl);
    if (chUrl) {
      av.href = chUrl;
      av.title = 'Open YouTube channel' + (label ? ' (' + label + ')' : '');
      const avSrc = ch && ch.avatar && safeUrl(ch.avatar);
      const initChar = (label.replace(/^@/, '').charAt(0) || 'Y').toUpperCase();
      av.innerHTML = avSrc ? `<img src="${esc(avSrc)}" alt="${esc(label)}">` : `<span class="sbar-av-init">${esc(initChar)}</span>`;
    } else {
      av.removeAttribute('href');
    }
  }
}
function applyBrandingUI() {
  const th = ['default', 'isac', 'discord'].includes(appSettings.theme) ? appSettings.theme : 'default';
  document.documentElement.setAttribute('data-theme', th);
  if (th === 'default' && /^#[0-9a-f]{6}$/i.test(appSettings.accentColor || '')) {
    document.documentElement.style.setProperty('--red', appSettings.accentColor);
  } else {
    document.documentElement.style.removeProperty('--red');
  }
  const aw = $('accentRowWrap'); if (aw) aw.classList.toggle('hidden', th !== 'default');
  document.querySelectorAll('#themePicker .theme-card').forEach((c) => c.classList.toggle('on', c.dataset.themePick === th));
  const hl = $('navHitList'); if (hl) hl.classList.toggle('hidden', appSettings.showHitList === false);
}
$('themePicker').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-theme-pick]'); if (!b) return;
  const th = b.dataset.themePick;
  appSettings.theme = th;
  applyBrandingUI();
  try { await putJson('/api/settings', { theme: th }); toast('Theme changed to ' + (th === 'isac' ? 'ISAC // SHD' : th === 'discord' ? 'Discord' : 'Vanilla')); }
  catch (err) { toast(err.message); }
});
function updatePill() {
  const p = $('igdbPill');
  p.className = 'pill ' + (appSettings.igdbConfigured ? 'ok' : 'off');
  p.textContent = appSettings.igdbConfigured ? 'IGDB: connected' : 'IGDB: set up';
  applyBrandingUI();
  updateChannelUI();
}
async function loadSettings() { try { appSettings = await api('/api/settings'); } catch (e) { /* offline server? keep defaults */ } updatePill(); if (loaded) renderBoard(); }
function renderFormatSettings() {
  const list = formatsOf();
  $('fmtCfgList').innerHTML = list.map((f, i) => `<div class="cfg-row" data-fi="${i}">
    <input class="field" data-fk="label" value="${esc(f.label)}" maxlength="32" placeholder="Format name">
    <input class="field" data-fk="short" value="${esc(f.short)}" maxlength="14" placeholder="Short tag">
    <input type="color" data-fk="color" value="${esc(f.color)}" title="Badge colour">
    <button type="button" class="btn icon danger" data-fdel="${i}" title="Remove" ${list.length <= 1 ? 'disabled' : ''}>×</button>
  </div>`).join('');
}
function renderOwnershipSettings() {
  const list = ownershipsOf();
  $('ownCfgList').innerHTML = list.map((o, i) => `<div class="cfg-row own" data-oi="${i}">
    <input class="field" data-ok="label" value="${esc(o.label)}" maxlength="20" placeholder="Label (e.g. Owned)">
    <input type="color" data-ok="color" value="${esc(o.color)}" title="Text colour">
    <button type="button" class="btn icon danger" data-odel="${i}" title="Remove">×</button>
  </div>`).join('') || '<div class="muted small">No ownership labels configured.</div>';
}
$('fmtCfgList').addEventListener('input', (e) => {
  const row = e.target.closest('[data-fi]'); if (!row) return;
  const list = formatsOf(); const f = list[+row.dataset.fi]; if (!f) return;
  const k = e.target.dataset.fk; if (!k) return;
  f[k] = k === 'short' ? e.target.value.toUpperCase() : e.target.value;
  state.formats = list; save(false); renderBoard();
});
$('fmtCfgList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fdel]'); if (!b) return;
  const list = formatsOf(); if (list.length <= 1) return;
  list.splice(+b.dataset.fdel, 1); state.formats = list; save(true); renderFormatSettings(); renderBoard();
});
$('fmtCfgAdd').onclick = () => {
  const list = formatsOf(); if (list.length >= 16) return toast('Up to 16 formats.');
  list.push({ id: 'f_' + PL.rid(), label: 'New Format', short: 'NEW', color: '#22D3EE' });
  state.formats = list; save(false); renderFormatSettings(); renderBoard();
};
$('fmtCfgReset').onclick = () => confirmBox('Reset video formats to defaults?', 'RESET', () => { state.formats = null; save(true); renderFormatSettings(); renderBoard(); });

$('ownCfgList').addEventListener('input', (e) => {
  const row = e.target.closest('[data-oi]'); if (!row) return;
  const list = ownershipsOf().map((o) => Object.assign({}, o)); const o = list[+row.dataset.oi]; if (!o) return;
  const k = e.target.dataset.ok; if (!k) return;
  o[k] = e.target.value; state.ownerships = list; save(false); renderBoard();
});
$('ownCfgList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-odel]'); if (!b) return;
  const list = ownershipsOf().map((o) => Object.assign({}, o));
  list.splice(+b.dataset.odel, 1); state.ownerships = list; save(true); renderOwnershipSettings(); renderBoard();
});
$('ownCfgAdd').onclick = () => {
  const list = ownershipsOf().map((o) => Object.assign({}, o)); if (list.length >= 10) return toast('Up to 10 labels.');
  list.push({ id: 'o_' + PL.rid(), label: 'Label', color: '#22D3EE' });
  state.ownerships = list; save(false); renderOwnershipSettings(); renderBoard();
};
$('ownCfgReset').onclick = () => confirmBox('Reset ownership labels to defaults?', 'RESET', () => { state.ownerships = null; save(true); renderOwnershipSettings(); renderBoard(); });

$('setAccentReset').onclick = () => { $('setAccent').value = '#e60000'; };
$('brandSave').onclick = async () => {
  try {
    await putJson('/api/settings', {
      theme: appSettings.theme || 'default',
      accentColor: $('setAccent').value || '#e60000',
      showHitList: !!$('setShowHitList').checked,
      useScores: !!$('setUseScores').checked
    });
    await loadSettings(); toast('Appearance saved');
  } catch (e) { toast(e.message); }
};

async function importRecentYoutubeUploads(btn) {
  if (!appSettings.youtubeHasKey || !appSettings.youtubeChannel) { toast('Link your YouTube channel and API key in Settings first.'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Importing…';
  try {
    const { videos } = await api('/api/youtube/channel-videos');
    const existingIds = new Set(state.games.map((g) => ytId(g.videoUrl)).filter(Boolean));
    let added = 0;
    (videos || []).slice(0, 20).forEach((v) => {
      if (!v.id || existingIds.has(v.id)) return;
      existingIds.add(v.id);
      const g = initGame({
        id: uid(), igdbId: null, name: v.title || 'Untitled Video', developers: [], publishers: [], genres: [], platforms: [],
        releaseDate: '', stage: 'Published', publishedAt: v.publishedAt ? v.publishedAt.slice(0, 10) : todayIso(),
        videoUrl: v.url, playedOn: '', hoursPlayed: 0, hype: 0, cover: '', banner: '', ttb: null, sentToHitList: false, createdAt: Date.now()
      });
      state.games.unshift(g); added++;
    });
    if (added) { save(true); renderBoard(); }
    toast(added ? `Imported ${added} recent video${added === 1 ? '' : 's'} into Published` : 'All recent uploads are already on your board.');
  } catch (e) { toast(e.message); }
  btn.disabled = false; btn.textContent = orig;
}
$('ytChImport').onclick = () => importRecentYoutubeUploads($('ytChImport'));
$('emptyImportYt').onclick = () => importRecentYoutubeUploads($('emptyImportYt'));

let settingsTab = 'appearance';
function setSettingsTab(tab) {
  settingsTab = tab || 'appearance';
  document.querySelectorAll('#settingsNav .set-tab').forEach((b) => {
    const on = b.dataset.stab === settingsTab;
    b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('#settingsPane .set-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.spanel !== settingsTab));
  const pane = $('settingsPane'); if (pane) pane.scrollTop = 0;
}
$('settingsNav').addEventListener('click', (e) => {
  const b = e.target.closest('.set-tab'); if (b) setSettingsTab(b.dataset.stab);
});
$('reopenWizardBtn').onclick = () => { closeModal('settingsModal'); openWizard(); };

function openSettings(tab) {
  setSettingsTab(typeof tab === 'string' ? tab : settingsTab);
  $('setAccent').value = appSettings.accentColor || '#e60000';
  $('setShowHitList').checked = appSettings.showHitList !== false;
  $('setUseScores').checked = !!appSettings.useScores;
  renderFormatSettings(); renderOwnershipSettings();
  $('setId').value = appSettings.igdbClientId || ''; $('setSecret').value = '';
  $('setSecret').placeholder = appSettings.igdbHasSecret ? '•••••••• saved (leave blank to keep)' : 'Paste your Client Secret';
  $('testSteps').innerHTML = ''; $('setYt').value = ''; $('ytMsg').textContent = '';
  $('setYt').placeholder = appSettings.youtubeHasKey ? '•••••••• saved (leave blank to keep)' : 'Paste your API key';
  const ch = appSettings.youtubeChannel;
  $('setYtCh').value = (ch && (ch.handle || ch.id)) || '';
  $('ytChImport').disabled = !(appSettings.youtubeHasKey && ch);
  $('ytChMsg').textContent = ch ? ('Linked: ' + (ch.handle || ch.title || ch.id) + (ch.subscribers != null ? ' · ' + compact(ch.subscribers) + ' subscribers' : '') + (ch.id ? ' · direct Studio link active' : '')) : '';
  $('resyncMsg').textContent = '';
  $('setSgdb').value = ''; $('sgdbMsg').textContent = ''; $('setSgdb').placeholder = appSettings.sgdbHasKey ? '•••••••• saved (leave blank to keep)' : 'Paste your SteamGridDB API key';
  renderDisplayOptions(); renderCadenceSettings(); renderTemplates(); openModal('settingsModal');
}

// ---- YouTube channel linking
$('ytChSave').onclick = async () => {
  const raw = $('setYtCh').value.trim();
  if (!raw) { $('ytChMsg').textContent = 'Enter a @handle or YouTube channel link first.'; return; }
  $('ytChMsg').textContent = appSettings.youtubeHasKey ? 'Looking up channel…' : 'Saving…';
  try {
    let ch = { handle: raw };
    if (appSettings.youtubeHasKey) {
      try { ch = await api('/api/youtube/channel?q=' + encodeURIComponent(raw)); }
      catch (e) { $('ytChMsg').textContent = e.message + ' (Saved handle anyway.)'; }
    }
    channelVideosCache = null; await putJson('/api/settings', { youtubeChannel: ch });
    await loadSettings();
    const cur = appSettings.youtubeChannel;
    if (cur) {
      $('setYtCh').value = cur.handle || cur.id || raw;
      $('ytChMsg').textContent = 'Linked: ' + (cur.handle || cur.title || cur.id) + (cur.subscribers != null ? ' · ' + compact(cur.subscribers) + ' subscribers' : '') + (cur.id ? ' · direct Studio link active' : '');
      toast('YouTube channel linked');
    } else {
      $('ytChMsg').textContent = 'That does not look like a YouTube @handle or channel link.';
    }
  } catch (e) { $('ytChMsg').textContent = e.message; }
};
$('ytChClear').onclick = () => confirmBox('Unlink your YouTube channel from the app?', 'UNLINK', async () => {
  channelVideosCache = null; await putJson('/api/settings', { clearYoutubeChannel: true });
  await loadSettings(); $('setYtCh').value = ''; $('ytChMsg').textContent = 'Channel unlinked.'; toast('YouTube channel unlinked');
});

// ---- YouTube key
$('ytSave').onclick = async () => {
  try { await putJson('/api/settings', { youtubeApiKey: $('setYt').value }); await loadSettings(); $('setYt').value = ''; $('setYt').placeholder = appSettings.youtubeHasKey ? '•••••••• saved (leave blank to keep)' : 'Paste your API key'; $('ytMsg').textContent = appSettings.youtubeHasKey ? 'Saved. Press TEST to check it.' : 'Nothing to save.'; if (openId) renderVideo(findGame(openId)); }
  catch (e) { toast(e.message); }
};
$('ytTest').onclick = async () => {
  $('ytMsg').textContent = 'Testing…';
  try { const d = await api('/api/youtube/video?id=jNQXAC9IVRw'); $('ytMsg').textContent = 'Works: read "' + d.title + '" (' + compact(d.views) + ' views).'; }
  catch (e) { $('ytMsg').textContent = e.message; }
};
$('ytClear').onclick = () => confirmBox('Remove the saved YouTube API key from this computer?', 'REMOVE', async () => { await putJson('/api/settings', { clearYoutube: true }); await loadSettings(); openSettings(); toast('YouTube key removed'); });

// ---- checklist templates
function renderTemplates() {
  const t = templatesOf();
  $('tplBox').innerHTML = TEMPLATE_STAGES.map((st) => `<label><span>${esc(st)}</span><textarea class="field" rows="4" data-stage="${esc(st)}" placeholder="One item per line">${esc((t[st] || []).join('\n'))}</textarea></label>`).join('');
}
$('tplBox').addEventListener('input', (e) => {
  const ta = e.target.closest('textarea'); if (!ta) return;
  if (!state.templates) state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  state.templates[ta.dataset.stage] = ta.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 30);
  save(false);
});
$('tplReset').onclick = () => confirmBox('Reset every stage checklist to the defaults? Lists already on cards stay as they are.', 'RESET', () => { state.templates = null; save(true); renderTemplates(); toast('Checklists reset'); });

// ---- re-sync every IGDB game (throttled by the server to IGDB's rate limit)
$('resyncBtn').onclick = () => {
  const list = state.games.filter((g) => g.igdbId);
  if (!list.length) { $('resyncMsg').textContent = 'No IGDB-linked games yet.'; return; }
  confirmBox(`Re-fetch ${list.length} game${list.length > 1 ? 's' : ''} from IGDB? This takes about ${Math.max(1, Math.round(list.length * 0.8))} second${list.length > 1 ? 's' : ''} or more.`, 'RE-SYNC', async () => {
    const b = $('resyncBtn'); b.disabled = true; let ok = 0, fail = 0, firstErr = '';
    for (let i = 0; i < list.length; i++) {
      $('resyncMsg').textContent = `${i + 1}/${list.length}: ${list[i].name}`;
      try { gameFromIgdb(await api('/api/igdb/game/' + list[i].igdbId), list[i]); ok++; }
      catch (e) { fail++; firstErr = firstErr || e.message; if (/rate limit|not set up|rejected/i.test(e.message)) break; }
    }
    save(true); renderBoard(); b.disabled = false;
    $('resyncMsg').textContent = `Updated ${ok}` + (fail ? `, ${fail} failed (${firstErr})` : '') + '.';
  });
};
$('setSave').onclick = async () => {
  try {
    await putJson('/api/settings', { igdbClientId: $('setId').value, igdbClientSecret: $('setSecret').value });
    await loadSettings(); $('setSecret').value = ''; $('setSecret').placeholder = appSettings.igdbHasSecret ? '•••••••• saved (leave blank to keep)' : 'Paste your Client Secret';
    toast(appSettings.igdbConfigured ? 'IGDB credentials saved. Press TEST CONNECTION to check them.' : 'Saved. Both Client ID and Secret are needed.');
  } catch (e) { toast(e.message); }
};
$('setTest').onclick = async () => {
  const ul = $('testSteps'); ul.innerHTML = '<li>Testing…</li>'; $('setTest').disabled = true;
  try {
    const { steps } = await api('/api/igdb/test', { method: 'POST' });
    ul.innerHTML = steps.map((s) => `<li class="${s.ok ? 'ok' : 'bad'}">${esc(s.name)}<small>${esc(s.detail)}</small></li>`).join('');
  } catch (e) { ul.innerHTML = `<li class="bad">${esc(e.message)}</li>`; }
  $('setTest').disabled = false;
};
$('setClear').onclick = () => confirmBox('Remove the saved IGDB credentials from this computer?', 'REMOVE', async () => {
  await putJson('/api/settings', { clearIgdb: true }); await loadSettings(); openSettings(); toast('Credentials removed');
});
$('expBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = 'critical-hit-planner-backup.json'; document.body.appendChild(a); a.click(); a.remove();
};
$('impBtn').onclick = () => $('impFile').click();
$('impFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const doc = JSON.parse(await f.text());
    if (!doc || !Array.isArray(doc.games)) throw new Error('not a planner backup');
    confirmBox(`Replace the board with ${doc.games.length} games from this file? Your current board will be overwritten (a daily backup is kept).`, 'REPLACE', () => {
      state = { version: 1, games: doc.games, templates: doc.templates || null, display: doc.display || null, cadence: doc.cadence || null, journal: (Array.isArray(doc.journal) ? doc.journal : []).map(PL.normJournal), formats: doc.formats || null, ownerships: doc.ownerships || null }; save(true); renderBoard(); closeModal('settingsModal'); toast(`Imported ${doc.games.length} games`);
    });
  } catch (err) { toast('Import failed: ' + err.message); }
};

// ------------------------------------------------------------------ wiring / keyboard / init
$('addBtn').onclick = () => openAdd('Backlogged');
$('emptyAdd').onclick = () => openAdd('Backlogged');
function openWizard() {
  $('wizYtCh').value = (appSettings.youtubeChannel && (appSettings.youtubeChannel.handle || appSettings.youtubeChannel.id)) || '';
  $('wizShowHitList').checked = appSettings.showHitList !== false;
  $('wizUseScores').checked = !!appSettings.useScores;
  $('wizIgdbId').value = appSettings.igdbClientId || ''; $('wizIgdbSec').value = '';
  $('wizStep1').classList.remove('hidden'); $('wizStep2').classList.add('hidden');
  $('wizDot1').classList.add('on'); $('wizDot2').classList.remove('on');
  openModal('wizardModal');
}
$('emptyWizard').onclick = openWizard;
$('wizSkip').onclick = () => { try { localStorage.setItem('chl_wiz_done', '1'); } catch (e) {} closeModal('wizardModal'); };
$('wizNext').onclick = () => {
  $('wizStep1').classList.add('hidden'); $('wizStep2').classList.remove('hidden');
  $('wizDot2').classList.add('on');
};
$('wizBack').onclick = () => {
  $('wizStep2').classList.add('hidden'); $('wizStep1').classList.remove('hidden');
  $('wizDot2').classList.remove('on');
};
$('wizFinish').onclick = async () => {
  const payload = {
    showHitList: !!$('wizShowHitList').checked,
    useScores: !!$('wizUseScores').checked
  };
  const ch = $('wizYtCh').value.trim();
  if (ch) payload.youtubeChannel = { handle: ch };
  const cid = $('wizIgdbId').value.trim(), csec = $('wizIgdbSec').value.trim();
  if (cid) payload.igdbClientId = cid;
  if (csec) payload.igdbClientSecret = csec;
  try { await putJson('/api/settings', payload); await loadSettings(); } catch (e) { toast(e.message); }
  try { localStorage.setItem('chl_wiz_done', '1'); } catch (e) {}
  closeModal('wizardModal'); toast('Setup saved! Add your first game whenever you are ready.');
};
$('settingsBtn').onclick = openSettings;
$('igdbPill').onclick = () => openSettings('connections');
$('noticeSetup').onclick = () => { closeModal('addModal'); openSettings('connections'); };
$('filterInput').addEventListener('input', renderBoard);
$('hideArchived').addEventListener('change', () => { hideArchived = $('hideArchived').checked; try { localStorage.setItem('chl_hide_archived', hideArchived ? '1' : '0'); } catch (e) { /* ignore */ } renderBoard(); });
$('simpleBoard').addEventListener('change', () => { simpleBoard = $('simpleBoard').checked; document.body.classList.toggle('simple-board', simpleBoard); try { localStorage.setItem('chl_simple_board', simpleBoard ? '1' : '0'); } catch (e) { /* ignore */ } renderBoard(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (closeTopModal()) e.preventDefault(); else if (document.activeElement === $('filterInput')) { $('filterInput').value = ''; renderBoard(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement; const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
  if (typing) return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  if (e.key === '/') { e.preventDefault(); $('filterInput').focus(); }
  else if (e.key.toLowerCase() === 'n') { e.preventDefault(); openAdd('Backlogged'); }
});

(async function init() {
  try { hideArchived = localStorage.getItem('chl_hide_archived') === '1'; $('hideArchived').checked = hideArchived; simpleBoard = localStorage.getItem('chl_simple_board') === '1'; $('simpleBoard').checked = simpleBoard; document.body.classList.toggle('simple-board', simpleBoard); const v = localStorage.getItem('chl_view'); if (['board', 'calendar', 'stats', 'journal'].includes(v)) view = v; } catch (e) { /* ignore */ }
  { const qv = new URLSearchParams(location.search).get('view'); if (['board', 'calendar', 'stats', 'journal'].includes(qv)) { view = qv; try { localStorage.setItem('chl_view', qv); } catch (e) { /* ignore */ } } }   // links from the Hit List page
  try {
    const doc = await api('/api/planner');
    let migrated = false;
    state = { version: 1, templates: doc.templates || null, display: doc.display || null, cadence: doc.cadence || null, journal: (Array.isArray(doc.journal) ? doc.journal : []).map(PL.normJournal), formats: doc.formats || null, ownerships: doc.ownerships || null, games: (doc.games || []).map((g) => {
      const game = Object.assign({ stage: 'Backlogged', developers: [], genres: [], platforms: [], publishers: [], hype: 0, hoursPlayed: 0 }, g);
      // "Played on" used to be free text; it is now one of the platform ids. Convert old values once.
      if (game.playedOn && !P.byId(game.playedOn)) {
        const id = P.detect(game.playedOn);
        if (!id) game.playedOnLegacy = game.playedOn;
        game.playedOn = id; migrated = true;
      }
      // 1.8: viewer requests are gone; old tags/series text becomes a video format when it names one; Planned no longer asks about platform or embargo
      if ('requests' in game) { delete game.requests; migrated = true; }
      if (!game.format) { const f = PL.guessFormat(game.tags); if (f) { game.format = f; migrated = true; } }
      if (game.checks && Array.isArray(game.checks.Planned)) { const n = game.checks.Planned.length; game.checks.Planned = game.checks.Planned.filter((x) => !OLD_PLANNED.includes(x.t)); if (game.checks.Planned.length !== n) migrated = true; }
      const had = !!(game.history && game.history.length && game.checks);
      initGame(game); if (!had) migrated = true;     // adds the stage history and this stage's checklist to older cards
      return game;
    }) };
    if (state.templates && Array.isArray(state.templates.Planned) && state.templates.Planned.some((t) => OLD_PLANNED.includes(t))) { state.templates.Planned = state.templates.Planned.filter((t) => !OLD_PLANNED.includes(t)); migrated = true; }
    loaded = true; setStatus('saved');
    if (migrated) save(true);
  } catch (e) { setStatus('error', 'Could not load your board: ' + e.message); toast('Could not load your board. Changes will NOT be saved until the app is restarted.'); }
  renderBoard();
  await loadSettings();
  try { if (loaded && state.games.length === 0 && !localStorage.getItem('chl_wiz_done')) openWizard(); } catch (e) {}
  api('/api/info').then((i) => { $('verLine').textContent = 'Critical Hit Studio v' + i.version + '.'; }).catch(() => {});
  renderChangelog();
  initCloudSync();
  initUpdater();
})();

// ------------------------------------------------------------------ GitHub Releases Updater
function initUpdater() {
  let latestInfo = null;
  const setMsg = (t, isErr) => { const el = $('updMsg'); if (!el) return; el.textContent = t || ''; el.className = 'small ' + (isErr ? 'bad' : 'muted'); };

  async function checkUpdates(manual) {
    if (manual) setMsg('Checking GitHub Releases…');
    try {
      const info = await api('/api/update/check');
      latestInfo = info;
      const pill = $('updatePill');
      if (info.hasUpdate) {
        pill.textContent = `Update v${info.latest}`;
        pill.classList.remove('hidden');
        $('updVerTitle').textContent = `Critical Hit Studio v${info.latest} is available!`;
        $('updRelLink').href = info.releaseUrl;
        $('updNotes').textContent = info.notes || 'Includes the latest improvements and fixes.';
        const apk = $('updApkLink');
        if (info.apkAsset && info.apkAsset.url) { apk.href = info.apkAsset.url; apk.classList.remove('hidden'); }
        else apk.classList.add('hidden');
        $('updInstallBtn').disabled = !info.winAsset;
        $('updInstallBtn').textContent = window.chlDesktop && window.chlDesktop.installUpdate ? 'DOWNLOAD & INSTALL UPDATE' : 'DOWNLOAD INSTALLER ↗';
        $('updBox').classList.remove('hidden');
        setMsg('');
      } else {
        pill.classList.add('hidden');
        $('updBox').classList.add('hidden');
        if (manual) setMsg(`You're up to date (v${info.current}).`);
      }
    } catch (e) {
      if (manual) setMsg('Could not check for updates: ' + e.message, true);
    }
  }

  $('updatePill').onclick = () => openSettings('changelog');
  $('updCheckBtn').onclick = () => checkUpdates(true);
  $('updInstallBtn').onclick = async () => {
    if (!latestInfo || !latestInfo.winAsset) return;
    if (!(window.chlDesktop && window.chlDesktop.installUpdate)) {
      window.open(latestInfo.winAsset.url, '_blank', 'noopener');
      return;
    }
    const btn = $('updInstallBtn');
    btn.disabled = true; btn.textContent = 'DOWNLOADING… 0%';
    $('updProgWrap').classList.remove('hidden');
    $('updProgFill').style.width = '0%';
    setMsg('Downloading installer from GitHub Releases…');
    window.chlDesktop.onUpdateProgress((p) => {
      const pct = (p && p.pct) || 0;
      $('updProgFill').style.width = pct + '%';
      btn.textContent = `DOWNLOADING… ${pct}%`;
    });
    const res = await window.chlDesktop.installUpdate(latestInfo.winAsset);
    if (!res || !res.ok) {
      btn.disabled = false; btn.textContent = 'DOWNLOAD & INSTALL UPDATE';
      $('updProgWrap').classList.add('hidden');
      setMsg('Update failed: ' + ((res && res.error) || 'Unknown error'), true);
    } else {
      btn.textContent = 'LAUNCHING INSTALLER…';
      setMsg('Installer launched — Critical Hit Studio will close so the update can apply.');
    }
  };

  setTimeout(() => checkUpdates(false), 3000);
}

function renderChangelog() {
  const box = $('changelogBox');
  if (!box || !Array.isArray(window.CHL_CHANGELOG)) return;
  box.innerHTML = window.CHL_CHANGELOG.map((rel) =>
    `<div class="cl-entry">
      <div class="cl-head"><span class="cl-ver">v${esc(rel.version)}</span><span class="cl-title">${esc(rel.title)}</span></div>
      <ul class="cl-list">${(rel.items || []).map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
    </div>`
  ).join('');
}

// ------------------------------------------------------------------ Cloud Sync (Firebase)
function initCloudSync() {
  if (!window.CHL_CLOUD) return;
  const setCloudMsg = (t, isErr) => { const el = $('cloudMsg'); if (!el) return; el.textContent = t || ''; el.className = 'small ' + (isErr ? 'bad' : 'muted'); };
  let syncedUid = null;

  function applyMerged(remoteDoc, fromLive) {
    if (!remoteDoc || !loaded) return;
    const merged = CHL_CLOUD.mergeStates(state, remoteDoc);
    merged.games = (merged.games || []).map((g) => initGame(Object.assign({ stage: 'Backlogged', developers: [], genres: [], platforms: [], publishers: [], hype: 0, hoursPlayed: 0 }, g)));
    merged.journal = (merged.journal || []).map(PL.normJournal);
    state = merged;
    skipCloudPush = true;
    save(true);
    renderBoard();
    if (fromLive) toast('Synced update from cloud', null, 2500);
  }

  function makeThumb(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = 110, h = Math.max(70, Math.min(165, Math.round((img.naturalHeight / (img.naturalWidth || 1)) * w)));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.68));
        } catch (e) { resolve(''); }
      };
      img.onerror = () => resolve('');
      img.src = url;
    });
  }
  async function ensureMobileThumbs() {
    let added = 0, ready = 0, withCover = 0;
    let totalBytes = JSON.stringify(state).length;
    for (const g of state.games) {
      if (g.cover || g.coverRemote || g.coverId || g.coverThumb) withCover++;
      if (g.coverRemote || g.coverId || g.coverThumb) { ready++; continue; }
      if (!g.cover || !g.cover.startsWith('/media/')) continue;
      if (totalBytes > 750000) continue; // keep safely under Firestore 1MB doc limit
      const thumb = await makeThumb(g.cover);
      if (thumb && thumb.length < 30000) {
        g.coverThumb = thumb;
        g.updatedAt = Date.now();
        totalBytes += thumb.length;
        added++; ready++;
      }
    }
    if (added) { skipCloudPush = true; save(true); }
    return { added, ready, withCover };
  }

  async function syncNow(showToast) {
    if (!CHL_CLOUD.getUser()) return;
    setCloudMsg('Syncing…');
    try {
      const rem = await CHL_CLOUD.pullOnce();
      if (rem) applyMerged(rem, false);
      const t = await ensureMobileThumbs();
      await CHL_CLOUD.pushState(state);
      setCloudMsg(`Synced at ${new Date().toLocaleTimeString()} · ${t.ready}/${t.withCover} posters ready for mobile`);
      if (showToast) toast(`Cloud sync complete (${t.ready}/${t.withCover} posters)`);
    } catch (e) { setCloudMsg('Sync failed: ' + e.message, true); }
  }

  CHL_CLOUD.init({
    onAuth: async (user) => {
      $('cloudSignedOut').classList.toggle('hidden', !!user);
      $('cloudSignedIn').classList.toggle('hidden', !user);
      if (user) {
        $('cloudUserEmail').textContent = user.email || 'Signed in';
        if (syncedUid !== user.uid) { syncedUid = user.uid; await syncNow(false); }
      } else {
        syncedUid = null;
        setCloudMsg('');
      }
    },
    onRemoteState: (remoteDoc) => applyMerged(remoteDoc, true),
    onStatus: (kind, msg) => { if (kind === 'error') setCloudMsg(msg, true); }
  });

  $('cloudSignIn').onclick = async () => {
    setCloudMsg('Signing in…');
    try { await CHL_CLOUD.signIn($('cloudEmail').value, $('cloudPass').value); $('cloudPass').value = ''; }
    catch (e) { setCloudMsg(e.message, true); }
  };
  $('cloudSignUp').onclick = async () => {
    setCloudMsg('Creating account…');
    try { await CHL_CLOUD.signUp($('cloudEmail').value, $('cloudPass').value); $('cloudPass').value = ''; toast('Account created & syncing!'); }
    catch (e) { setCloudMsg(e.message, true); }
  };
  $('cloudReset').onclick = async () => {
    const email = $('cloudEmail').value.trim();
    if (!email) { setCloudMsg('Enter your email above first.', true); return; }
    try { await CHL_CLOUD.resetPassword(email); setCloudMsg('Password reset email sent to ' + email + '.'); }
    catch (e) { setCloudMsg(e.message, true); }
  };
  $('cloudSyncNow').onclick = () => syncNow(true);
  $('cloudSignOut').onclick = async () => {
    await CHL_CLOUD.signOut();
    toast('Signed out of Cloud Sync (local data kept)');
  };
}
