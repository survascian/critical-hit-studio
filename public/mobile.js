'use strict';
// Critical Hit Studio — Mobile Companion UI
// Shares the exact same planner.json data & UMD logic modules as desktop, with mobile-native interactions.

const STAGES = [
  { id: 'Backlogged', color: '#8b93a7', icon: '<path d="M4 6h16v12H4zM4 13h4l2 2h4l2-2h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>' },
  { id: 'Planned',    color: '#4da3ff', icon: '<rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4 10h16M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' },
  { id: 'Recording',  color: '#e60000', icon: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>' },
  { id: 'Writing',    color: '#ffc700', icon: '<path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>' },
  { id: 'Editing',    color: '#b36bff', icon: '<circle cx="6.5" cy="7.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="6.5" cy="16.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M20 5L8.6 14.5M20 19L8.6 9.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' },
  { id: 'Reviewing',  color: '#22d3ee', icon: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.9"/>' },
  { id: 'Published',  color: '#2ecc71', icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor"/>' },
  { id: 'Shelved',    color: '#6b7280', icon: '<path d="M4 6h16v4H4zM6 10v9h12v-9M10 14h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'Cancelled',  color: '#b91c1c', icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M6.5 6.5l11 11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' }
];
const ACTIVE_STAGES = ['Recording', 'Writing', 'Editing', 'Reviewing'];
const DONE_STAGES = ['Published', 'Shelved', 'Cancelled'];
const DEFAULT_TEMPLATES = {
  Backlogged: [],
  Planned:   ['Decide the video format', 'Set a target date'],
  Recording: ['Gameplay captured', 'Voiceover recorded', 'Extra footage / B-roll'],
  Writing:   ['Outline', 'First draft', 'Fact-check', 'Final script'],
  Editing:   ['Rough cut', 'Music and sound', 'Thumbnail', 'Title and description'],
  Reviewing: ['Watch-through', 'Fix notes', 'Captions', 'Schedule the upload'],
  Published: ['Pin a comment', 'Add to the Critical Hit List', 'Reply to comments']
};
const DEFAULT_OWNERSHIPS = [{ id: 'owned', label: 'Owned', color: '#2ECC71' }, { id: 'shanks', label: 'Shanks', color: '#FB923C' }];

const P = CHL_PLATFORMS;
const PL = CHL_PLAN;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const safeUrl = (u) => (/^(\/media\/|https?:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(u || '') ? u : '');
const cssUrl = (u) => (safeUrl(u) ? `url('${safeUrl(u).replace(/['"<>\s]/g, (c) => encodeURIComponent(c))}')` : 'none');
let hasLocalApi = false;
function coverUrlOf(g) {
  if (!g) return '';
  if (g.cover && /^https?:\/\//.test(g.cover)) return g.cover;
  if (hasLocalApi && g.cover && g.cover.startsWith('/media/')) return g.cover;
  if (g.coverRemote && /^https?:\/\//.test(g.coverRemote)) return g.coverRemote;
  if (g.coverId) return `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.coverId}.jpg`;
  if (g.coverThumb && /^data:image\//.test(g.coverThumb)) return g.coverThumb;
  return hasLocalApi ? (g.cover || '') : '';
}
function setCoverEl(el, g) {
  const url = safeUrl(coverUrlOf(g));
  const fallback = (g && g.name ? g.name : '?').charAt(0).toUpperCase();
  el.innerHTML = '';
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => { el.textContent = fallback; };
    el.appendChild(img);
  } else {
    el.textContent = fallback;
  }
}
const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const stageObj = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
const studioOf = (g) => (g.developers || []).join(', ');
const compact = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n));
const vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };

let state = { version: 1, games: [], templates: null, display: null, cadence: null, journal: [], formats: null, ownerships: null };
let appSettings = { igdbConfigured: false, accentColor: '#e60000', useScores: false, youtubeChannel: null };
let loaded = false, dirty = false, saving = false, saveTimer = null, retryTimer = null, skipCloudPush = false;
const LOCAL_CACHE_KEY = 'chl_mobile_state_v1';
function cacheLocal() { try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(state)); } catch (e) {} }
function loadLocalCache() { try { const s = localStorage.getItem(LOCAL_CACHE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

let activeTab = 'board';
let selectedStage = 'ACTIVE'; // 'ACTIVE' or stage id
let selectedFormat = '';
let searchQuery = '';
let openGameId = null;
let openNoteId = null;

let calDate = new Date();
let calSelectedDay = '';
let recapMode = 'month';
let recapYear = String(new Date().getFullYear());
let recapMonth = String(new Date().getMonth() + 1).padStart(2, '0');

const formatsOf = () => PL.normalizeFormats(state.formats);
const formatById = (id) => PL.formatOf(id, formatsOf());
const ownershipsOf = () => (Array.isArray(state.ownerships) ? state.ownerships.filter((o) => o && o.id && o.label) : DEFAULT_OWNERSHIPS);
const templatesOf = () => state.templates || DEFAULT_TEMPLATES;
const findGame = (id) => state.games.find((g) => g.id === id);

// ------------------------------------------------------------------ API & Save
async function api(path, opts) {
  const r = await fetch(path, opts);
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch (e) { b = t; }
  if (!r.ok) throw new Error((b && b.error) || ('HTTP ' + r.status));
  return b;
}
const putJson = (path, obj) => api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

function setSaveStatus(kind) {
  const el = $('mSaveStatus');
  el.className = 'msave' + (kind === 'saved' ? '' : ' ' + kind);
  el.textContent = kind === 'saving' ? 'Saving…' : kind === 'error' ? 'Offline' : 'Saved';
}
function save(immediate) {
  dirty = true; setSaveStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, immediate ? 0 : 350);
}
async function flush() {
  if (!loaded || saving || !dirty) return;
  saving = true; dirty = false;
  const doCloud = !skipCloudPush; skipCloudPush = false;
  cacheLocal();
  try {
    const tasks = [];
    if (hasLocalApi) tasks.push(putJson('/api/planner', state));
    if (doCloud && window.CHL_CLOUD && CHL_CLOUD.getUser()) tasks.push(CHL_CLOUD.pushState(state));
    if (tasks.length) await Promise.all(tasks);
    saving = false; setSaveStatus(dirty ? 'saving' : 'saved');
    if (dirty) flush();
  } catch (e) {
    saving = false; dirty = true; setSaveStatus('error');
    clearTimeout(retryTimer); retryTimer = setTimeout(flush, 3000);
  }
}
window.addEventListener('pagehide', () => {
  if (dirty && loaded) {
    cacheLocal();
    if (hasLocalApi) {
      try { fetch('/api/planner', { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }); } catch (e) {}
    }
  }
});

// ------------------------------------------------------------------ Toast
let toastTimer = null;
function toast(msg, action, ms) {
  $('mToastMsg').textContent = msg;
  const btn = $('mToastAction');
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => { $('mToast').classList.add('hidden'); action.fn(); };
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
  $('mToast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('mToast').classList.add('hidden'), ms || 4500);
}

// ------------------------------------------------------------------ Game Stage & Helpers
function ensureHistory(g) {
  if (!Array.isArray(g.history) || !g.history.length) g.history = [{ stage: g.stage, at: g.stageChangedAt || g.createdAt || Date.now() }];
}
function ensureChecks(g, stage) {
  if (!g.checks || typeof g.checks !== 'object') g.checks = {};
  if (!Array.isArray(g.checks[stage])) g.checks[stage] = (templatesOf()[stage] || []).map((t) => ({ t, done: false }));
}
function setStage(g, stage) {
  if (!g || g.stage === stage) return false;
  ensureHistory(g);
  g.stage = stage;
  g.stageChangedAt = Date.now();
  g.history.push({ stage, at: g.stageChangedAt });
  ensureChecks(g, stage);
  if (stage === 'Published' && !g.publishedAt) g.publishedAt = todayIso();
  return true;
}
function checkProgress(g, stage) {
  const list = (g.checks && g.checks[stage]) || [];
  return { done: list.filter((x) => x.done).length, total: list.length };
}
function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
function dueChipHtml(g) {
  if (!g.dueDate || DONE_STAGES.includes(g.stage)) return '';
  const n = daysUntil(g.dueDate); if (n === null) return '';
  const d = new Date(g.dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (n < 0) return `<span class="mchip due over">OVERDUE ${-n}D</span>`;
  if (n === 0) return '<span class="mchip due today">DUE TODAY</span>';
  return `<span class="mchip due">DUE ${esc(d.toUpperCase())}</span>`;
}
function googleUrl(v) {
  v = String(v || '').trim(); if (!v || /^[a-z]:[\\/]|^\\\\|^\//i.test(v)) return '';
  if (!/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return u.protocol === 'https:' && ['docs.google.com', 'drive.google.com'].includes(u.hostname) ? u.href : ''; } catch (e) { return ''; }
}
function isLocalPath(v) {
  return /^([a-z]:[\\/]|\\\\[^\\]|\/)/i.test(String(v || '').trim());
}
function ytUrl(v) {
  v = String(v || '').trim(); if (!v) return '';
  if (/^[\w-]{11}$/.test(v)) return 'https://www.youtube.com/watch?v=' + v;
  if (!/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && /(youtube\.com|youtu\.be)$/.test(u.hostname.replace(/^www\.|^m\./, '')) ? u.href : ''; } catch (e) { return ''; }
}

// ------------------------------------------------------------------ 8-ICON + CENTER X STAGE MOVE OVERLAY
let moveState = null; // { gameId, mode: 'drag' | 'tap', hoverStage: string | null, fromSheet: boolean }

function openMoveOverlay(gameId, mode, fromSheet) {
  const g = findGame(gameId); if (!g) return;
  moveState = { gameId, mode, hoverStage: null, fromSheet: !!fromSheet };
  setCoverEl($('moveGameCover'), g);
  $('moveGameName').textContent = g.name || 'Untitled';
  $('moveGameHint').textContent = mode === 'drag' ? 'Slide onto a stage and release (✕ to cancel)' : 'Tap a stage to move (✕ to cancel)';

  const others = STAGES.filter((s) => s.id !== g.stage); // always 8 stages!
  // 3x3 grid: indices 0..3 -> first 4 stages, index 4 -> center X cancel, indices 5..8 -> last 4 stages
  const cells = [
    others[0], others[1], others[2],
    others[3], { cancel: true }, others[4],
    others[5], others[6], others[7]
  ];
  const grid = $('moveGrid');
  grid.innerHTML = cells.map((c) => {
    if (c.cancel) {
      return `<button type="button" class="move-tile cancel" data-move-cancel="1" aria-label="Cancel move">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        <span>Cancel</span>
      </button>`;
    }
    return `<button type="button" class="move-tile" data-move-stage="${esc(c.id)}" style="--sc:${c.color}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${c.icon}</svg>
      <span>${esc(c.id)}</span>
    </button>`;
  }).join('');

  $('moveOverlay').classList.remove('hidden');
  vibrate(15);
}

function closeMoveOverlay() {
  moveState = null;
  $('moveOverlay').classList.add('hidden');
  document.querySelectorAll('.gcard.pressing').forEach((el) => el.classList.remove('pressing'));
}

function commitMove(gameId, targetStage, fromSheet) {
  const g = findGame(gameId); if (!g || !targetStage || g.stage === targetStage) return;
  const prevStage = g.stage;
  const prevHistLen = Array.isArray(g.history) ? g.history.length : 0;
  setStage(g, targetStage);
  save();
  vibrate(20);
  renderAll();
  if (fromSheet && openGameId === gameId) populateGameSheet(g);
  toast(`Moved "${g.name}" → ${targetStage}`, {
    label: 'UNDO',
    fn: () => {
      g.stage = prevStage;
      if (Array.isArray(g.history) && g.history.length > prevHistLen) g.history.pop();
      save();
      renderAll();
      if (openGameId === gameId) populateGameSheet(g);
    }
  }, 6000);
}

function updateDragHover(clientX, clientY) {
  if (!moveState || moveState.mode !== 'drag') return;
  const el = document.elementFromPoint(clientX, clientY);
  const tile = el && el.closest ? el.closest('.move-tile') : null;
  const prev = moveState.hoverStage;
  document.querySelectorAll('#moveGrid .move-tile.hover').forEach((t) => t.classList.remove('hover'));
  if (tile) {
    tile.classList.add('hover');
    if (tile.dataset.moveStage) {
      moveState.hoverStage = tile.dataset.moveStage;
      $('moveGameHint').textContent = `Release to move → ${tile.dataset.moveStage}`;
    } else {
      moveState.hoverStage = null;
      $('moveGameHint').textContent = 'Release to cancel';
    }
  } else {
    moveState.hoverStage = null;
    $('moveGameHint').textContent = 'Slide onto a stage (✕ to cancel)';
  }
  if (moveState.hoverStage !== prev && moveState.hoverStage) vibrate(8);
}

// Tap mode clicks on the overlay
$('moveOverlay').addEventListener('click', (e) => {
  if (!moveState || moveState.mode !== 'tap') return;
  const tile = e.target.closest('.move-tile');
  if (!tile || tile.dataset.moveCancel) { closeMoveOverlay(); return; }
  const target = tile.dataset.moveStage;
  const { gameId, fromSheet } = moveState;
  closeMoveOverlay();
  if (target) commitMove(gameId, target, fromSheet);
});

// Global pointer/touch handlers for press-and-hold drag release
function onGlobalDragMove(e) {
  if (!moveState || moveState.mode !== 'drag') return;
  if (e.cancelable) e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  updateDragHover(pt.clientX, pt.clientY);
}
function onGlobalDragEnd() {
  if (!moveState || moveState.mode !== 'drag') return;
  const { gameId, hoverStage, fromSheet } = moveState;
  closeMoveOverlay();
  if (hoverStage) commitMove(gameId, hoverStage, fromSheet);
}
window.addEventListener('touchmove', onGlobalDragMove, { passive: false });
window.addEventListener('touchend', onGlobalDragEnd);
window.addEventListener('touchcancel', () => { if (moveState && moveState.mode === 'drag') closeMoveOverlay(); });
window.addEventListener('mousemove', onGlobalDragMove);
window.addEventListener('mouseup', onGlobalDragEnd);

// Attach long-press drag + tap-to-open + tap-Move-button on a game card
function bindCardInteractions(card, g) {
  let holdTimer = null, startX = 0, startY = 0, held = false;

  const cancelHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    card.classList.remove('pressing');
  };

  const startHold = (x, y, target) => {
    if (target.closest('.gcard-move-btn')) return;
    held = false; startX = x; startY = y;
    holdTimer = setTimeout(() => {
      held = true;
      card.classList.add('pressing');
      openMoveOverlay(g.id, 'drag', false);
    }, 320);
  };

  const checkMove = (x, y) => {
    if (!holdTimer) return;
    if (Math.hypot(x - startX, y - startY) > 10) cancelHold();
  };

  card.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startHold(e.touches[0].clientX, e.touches[0].clientY, e.target);
  }, { passive: true });
  card.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) checkMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  card.addEventListener('touchend', cancelHold);
  card.addEventListener('touchcancel', cancelHold);

  // Desktop mouse support for testing press-and-hold in browser DevTools
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    startHold(e.clientX, e.clientY, e.target);
  });
  card.addEventListener('mousemove', (e) => checkMove(e.clientX, e.clientY));
  card.addEventListener('mouseup', cancelHold);
  card.addEventListener('mouseleave', cancelHold);
  card.addEventListener('contextmenu', (e) => e.preventDefault());

  card.addEventListener('click', (e) => {
    if (held) { held = false; return; }
    if (e.target.closest('.gcard-move-btn')) {
      e.stopPropagation();
      openMoveOverlay(g.id, 'tap', false);
      return;
    }
    openGameSheet(g.id);
  });
}

// ------------------------------------------------------------------ BOARD VIEW
function renderStagePills() {
  const activeCount = state.games.filter((g) => ACTIVE_STAGES.includes(g.stage)).length;
  const pills = [{ id: 'ACTIVE', label: 'Active', color: 'var(--accent)', count: activeCount }].concat(
    STAGES.map((s) => ({ id: s.id, label: s.id, color: s.color, count: state.games.filter((g) => g.stage === s.id).length }))
  );
  $('stagePills').innerHTML = pills.map((p) =>
    `<button type="button" class="spill ${selectedStage === p.id ? 'active' : ''}" data-stage="${esc(p.id)}" style="--sc:${p.color}">
      <span class="sdot"></span><span>${esc(p.label)}</span><span class="scnt">${p.count}</span>
    </button>`
  ).join('');
}
$('stagePills').addEventListener('click', (e) => {
  const b = e.target.closest('[data-stage]'); if (!b) return;
  selectedStage = b.dataset.stage;
  renderBoard();
});

function renderFormatPills() {
  const fmts = formatsOf();
  $('formatPills').innerHTML = `<button type="button" class="fpill ${selectedFormat === '' ? 'active' : ''}" data-fmt="">ALL</button>` +
    fmts.map((f) => `<button type="button" class="fpill ${selectedFormat === f.id ? 'active' : ''}" data-fmt="${esc(f.id)}" style="--fc:${f.color}">${esc(f.short)}</button>`).join('');
}
$('formatPills').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fmt]'); if (!b) return;
  selectedFormat = b.dataset.fmt;
  renderBoard();
});
$('mSearch').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); renderBoard(); });

function matchesFilters(g) {
  if (selectedFormat && g.format !== selectedFormat) return false;
  if (searchQuery) {
    const hay = [g.name, studioOf(g), g.series, (g.genres || []).join(' ')].join(' ').toLowerCase();
    if (!hay.includes(searchQuery)) return false;
  }
  return true;
}

function makeGameCard(g) {
  const st = stageObj(g.stage);
  const el = document.createElement('div');
  el.className = 'gcard';
  el.style.setProperty('--stage', st.color);

  const chips = [];
  const fm = formatById(g.format);
  if (fm) chips.push(`<span class="mchip fmt" style="--fc:${fm.color}">${esc(fm.short)}</span>`);
  const due = dueChipHtml(g);
  if (due) chips.push(due);
  const pr = checkProgress(g, g.stage);
  if (pr.total) chips.push(`<span class="mchip tasks ${pr.done === pr.total ? 'full' : ''}">${pr.done}/${pr.total}</span>`);
  const stuck = PL.stuck(g);
  if (stuck && (stuck.level !== 'ok' || ['Writing', 'Editing'].includes(g.stage))) {
    chips.push(`<span class="mchip stuck-${stuck.level}">${stuck.days}d</span>`);
  }
  if (g.video && g.video.views != null) chips.push(`<span class="mchip video">▶ ${compact(g.video.views)}</span>`);

  el.innerHTML = `
    <div class="gcard-cover"></div>
    <div class="gcard-body">
      <div class="gcard-title">${esc(g.name || 'Untitled')}</div>
      <div class="gcard-sub">${esc(studioOf(g) || g.stage)}</div>
      ${chips.length ? `<div class="gcard-chips">${chips.join('')}</div>` : ''}
    </div>
    <button type="button" class="gcard-move-btn" aria-label="Move stage" title="Move stage">⇄</button>
  `;
  setCoverEl(el.querySelector('.gcard-cover'), g);
  bindCardInteractions(el, g);
  return el;
}

function renderBoard() {
  renderStagePills();
  renderFormatPills();
  const list = $('gameList');
  list.innerHTML = '';

  const stagesToShow = selectedStage === 'ACTIVE' ? ACTIVE_STAGES : [selectedStage];
  let totalShown = 0;

  stagesToShow.forEach((stId) => {
    const games = state.games.filter((g) => g.stage === stId && matchesFilters(g));
    if (!games.length) return;
    if (selectedStage === 'ACTIVE') {
      const s = stageObj(stId);
      const div = document.createElement('div');
      div.className = 'stage-divider';
      div.style.setProperty('--sc', s.color);
      div.innerHTML = `<span class="sdot"></span><span>${esc(s.id)} (${games.length})</span>`;
      list.appendChild(div);
    }
    games.forEach((g) => { list.appendChild(makeGameCard(g)); totalShown++; });
  });

  if (!totalShown) {
    list.innerHTML = `<div class="empty-state">${selectedStage === 'ACTIVE' ? 'No active games right now. Tap + to add one!' : `No games in ${esc(selectedStage)}.`}</div>`;
  }
}

// ------------------------------------------------------------------ GAME EDITOR SHEET
function fillSelect(sel, options, value, emptyLabel) {
  sel.innerHTML = (emptyLabel ? `<option value="">${esc(emptyLabel)}</option>` : '') +
    options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  sel.value = value || '';
}

function populateGameSheet(g) {
  const st = stageObj(g.stage);
  $('gsHeaderTitle').textContent = g.name || 'Untitled';
  const mv = $('gsMoveBtn');
  mv.textContent = g.stage + ' ⇄';
  mv.style.setProperty('--sc', st.color);

  setCoverEl($('gsCover'), g);

  $('gsName').value = g.name || '';
  fillSelect($('gsFormat'), formatsOf().map((f) => ({ value: f.id, label: f.label })), g.format || '', '— None —');
  $('gsDue').value = g.dueDate || '';
  $('gsTimely').value = g.timely ? '1' : '0';
  $('gsHours').value = g.hoursPlayed != null && g.hoursPlayed !== '' ? g.hoursPlayed : '';

  // Links (PC local paths noted cleanly without breaking them)
  const localScript = isLocalPath(g.scriptUrl);
  $('gsScript').value = localScript ? '' : (g.scriptUrl || '');
  $('gsScriptNote').classList.toggle('hidden', !localScript);
  if (localScript) $('gsScriptNote').textContent = 'Local PC script linked on desktop: ' + g.scriptUrl;
  updateLinkBtns(g);

  $('gsVideo').value = g.videoUrl || '';
  updateLinkBtns(g);

  // Stage checklist
  ensureChecks(g, g.stage);
  renderSheetChecks(g);

  // Scratchpad & Packaging
  const p = PL.normalize(g.plan);
  $('gsNotes').value = p.notes;
  $('gsAngle').value = p.angle;
  $('gsHook').value = p.hook;
  [0, 1, 2].forEach((i) => { $('gsTitle' + i).value = p.titles[i] || ''; });
  document.querySelectorAll('input[name="gsChosen"]').forEach((r) => { r.checked = Number(r.value) === p.chosen; });
  $('gsThumb').value = p.thumb || '';

  // Game Details
  $('gsStudio').value = studioOf(g);
  $('gsRelease').value = g.releaseDate || '';
  fillSelect($('gsPlayedOn'), P.LIST.map((pl) => ({ value: pl.id, label: pl.label })), g.playedOn || '', '— Not set —');
  $('gsSeries').value = g.series || '';
  fillSelect($('gsOwnership'), ownershipsOf().map((o) => ({ value: o.id, label: o.label })), g.ownership || '', '— None —');
  $('gsHype').value = g.hype != null ? g.hype : '';
  $('gsScoreWrap').classList.toggle('hidden', !appSettings.useScores);
  $('gsScore').value = g.myScore != null ? g.myScore : '';
  $('gsGenres').value = (g.genres || []).join(', ');
}

function updateLinkBtns(g) {
  const sUrl = googleUrl(g.scriptUrl);
  const sBtn = $('gsScriptOpen');
  if (sUrl) { sBtn.href = sUrl; sBtn.classList.remove('disabled'); } else { sBtn.removeAttribute('href'); sBtn.classList.add('disabled'); }
  const vUrl = ytUrl(g.videoUrl);
  const vBtn = $('gsVideoOpen');
  if (vUrl) { vBtn.href = vUrl; vBtn.classList.remove('disabled'); } else { vBtn.removeAttribute('href'); vBtn.classList.add('disabled'); }
}

function renderSheetChecks(g) {
  const items = (g.checks && g.checks[g.stage]) || [];
  const done = items.filter((x) => x.done).length;
  $('gsCheckTitle').textContent = `${g.stage} Checklist`;
  $('gsCheckProg').textContent = items.length ? `${done}/${items.length}` : 'Empty';
  $('gsChecks').innerHTML = items.map((it, idx) =>
    `<div class="check-item ${it.done ? 'done' : ''}">
      <input type="checkbox" data-chk="${idx}" ${it.done ? 'checked' : ''}>
      <span>${esc(it.t)}</span>
      <button type="button" class="check-del" data-chk-del="${idx}" aria-label="Remove">×</button>
    </div>`
  ).join('');
}

function openGameSheet(id) {
  const g = findGame(id); if (!g) return;
  openGameId = id;
  populateGameSheet(g);
  $('gameSheet').classList.remove('hidden');
}

function closeSheet(id) {
  $(id).classList.add('hidden');
  if (id === 'gameSheet') { openGameId = null; renderAll(); }
  if (id === 'journalSheet') { openNoteId = null; renderJournal(); }
}
document.querySelectorAll('[data-close-sheet]').forEach((b) => {
  b.addEventListener('click', () => closeSheet(b.dataset.closeSheet));
});

$('gsMoveBtn').addEventListener('click', () => {
  if (openGameId) openMoveOverlay(openGameId, 'tap', true);
});

$('gsJournalBtn').addEventListener('click', () => {
  const g = findGame(openGameId); if (!g) return;
  const note = PL.normJournal({ title: g.name, date: todayIso(), games: [g.id], text: '' });
  state.journal = Array.isArray(state.journal) ? state.journal : [];
  state.journal.unshift(note);
  save();
  closeSheet('gameSheet');
  switchTab('journal');
  openJournalSheet(note.id);
});

// Wire Game Sheet field saves
function editGame(fn) {
  const g = findGame(openGameId); if (!g) return;
  fn(g);
  g.updatedAt = Date.now();
  save();
}
$('gsName').addEventListener('input', (e) => editGame((g) => { g.name = e.target.value; $('gsHeaderTitle').textContent = g.name || 'Untitled'; }));
$('gsFormat').addEventListener('change', (e) => editGame((g) => { g.format = e.target.value; }));
$('gsDue').addEventListener('change', (e) => editGame((g) => { g.dueDate = e.target.value; }));
$('gsTimely').addEventListener('change', (e) => editGame((g) => { g.timely = e.target.value === '1'; }));
$('gsHours').addEventListener('input', (e) => editGame((g) => { g.hoursPlayed = e.target.value === '' ? null : Number(e.target.value); }));
$('gsScript').addEventListener('input', (e) => editGame((g) => {
  const v = e.target.value.trim();
  if (v || !isLocalPath(g.scriptUrl)) { g.scriptUrl = v; $('gsScriptNote').classList.add('hidden'); }
  updateLinkBtns(g);
}));
$('gsVideo').addEventListener('input', (e) => editGame((g) => { g.videoUrl = e.target.value.trim(); updateLinkBtns(g); }));

const editPlan = (fn) => editGame((g) => { g.plan = PL.normalize(g.plan); fn(g.plan); });
$('gsNotes').addEventListener('input', (e) => editPlan((p) => { p.notes = e.target.value; }));
$('gsAngle').addEventListener('input', (e) => editPlan((p) => { p.angle = e.target.value; }));
$('gsHook').addEventListener('input', (e) => editPlan((p) => { p.hook = e.target.value; }));
[0, 1, 2].forEach((i) => {
  $('gsTitle' + i).addEventListener('input', (e) => editPlan((p) => { p.titles[i] = e.target.value; }));
});
document.querySelectorAll('input[name="gsChosen"]').forEach((r) => {
  r.addEventListener('change', () => editPlan((p) => { p.chosen = Number(r.value); }));
});
$('gsThumb').addEventListener('input', (e) => editPlan((p) => { p.thumb = e.target.value; }));

$('gsStudio').addEventListener('input', (e) => editGame((g) => { g.developers = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); }));
$('gsRelease').addEventListener('change', (e) => editGame((g) => { g.releaseDate = e.target.value; }));
$('gsPlayedOn').addEventListener('change', (e) => editGame((g) => { g.playedOn = e.target.value; }));
$('gsSeries').addEventListener('input', (e) => editGame((g) => { g.series = e.target.value.trim(); }));
$('gsOwnership').addEventListener('change', (e) => editGame((g) => { g.ownership = e.target.value; }));
$('gsHype').addEventListener('input', (e) => editGame((g) => { g.hype = e.target.value === '' ? null : Math.max(0, Math.min(5, Number(e.target.value))); }));
$('gsScore').addEventListener('input', (e) => editGame((g) => { g.myScore = e.target.value === '' ? null : Math.max(0, Math.min(10, Number(e.target.value))); }));
$('gsGenres').addEventListener('input', (e) => editGame((g) => { g.genres = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); }));

$('gsChecks').addEventListener('change', (e) => {
  const idx = e.target.dataset.chk; if (idx === undefined) return;
  editGame((g) => { g.checks[g.stage][+idx].done = e.target.checked; renderSheetChecks(g); });
});
$('gsChecks').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chk-del]'); if (!b) return;
  editGame((g) => { g.checks[g.stage].splice(+b.dataset.chkDel, 1); renderSheetChecks(g); });
});
$('gsCheckAddBtn').addEventListener('click', () => {
  const text = $('gsCheckNew').value.trim(); if (!text) return;
  editGame((g) => { ensureChecks(g, g.stage); g.checks[g.stage].push({ t: text, done: false }); $('gsCheckNew').value = ''; renderSheetChecks(g); });
});

$('gsDeleteBtn').addEventListener('click', () => {
  const g = findGame(openGameId); if (!g) return;
  const idx = state.games.indexOf(g);
  const removed = state.games.splice(idx, 1)[0];
  save();
  closeSheet('gameSheet');
  toast(`Deleted "${removed.name}"`, {
    label: 'UNDO',
    fn: () => { state.games.splice(idx, 0, removed); save(); renderAll(); }
  }, 10000);
});

// ------------------------------------------------------------------ ADD GAME SHEET
let igdbTimer = null;
function openAddSheet() {
  $('igdbSearchBlock').classList.toggle('hidden', !appSettings.igdbConfigured);
  $('addIgdbInput').value = '';
  $('addIgdbResults').innerHTML = '';
  $('addIgdbStatus').textContent = '';
  $('addManualName').value = '';
  fillSelect($('addManualStage'), STAGES.map((s) => ({ value: s.id, label: s.id })), selectedStage === 'ACTIVE' ? 'Planned' : selectedStage);
  fillSelect($('addManualFormat'), formatsOf().map((f) => ({ value: f.id, label: f.label })), '', '— None —');
  $('addManualDue').value = '';
  $('addSheet').classList.remove('hidden');
}

$('addIgdbInput').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(igdbTimer);
  if (q.length < 2) { $('addIgdbResults').innerHTML = ''; $('addIgdbStatus').textContent = ''; return; }
  $('addIgdbStatus').textContent = 'Searching IGDB…';
  igdbTimer = setTimeout(async () => {
    try {
      const r = await api('/api/igdb/search?q=' + encodeURIComponent(q));
      const items = r.results || [];
      $('addIgdbStatus').textContent = items.length ? '' : 'No games found.';
      $('addIgdbResults').innerHTML = items.slice(0, 8).map((it) =>
        `<button type="button" class="igdb-row" data-igdb-id="${it.igdbId}">
          ${it.coverUrl ? `<img src="${esc(it.coverUrl)}" alt="">` : '<div class="gcard-cover">?</div>'}
          <div class="igdb-row-meta">
            <div class="igdb-row-title">${esc(it.name)}</div>
            <div class="igdb-row-sub">${esc((it.developers || []).join(', ') || 'Unknown')} ${it.releaseDate ? '· ' + it.releaseDate.slice(0, 4) : ''}</div>
          </div>
        </button>`
      ).join('');
    } catch (err) {
      $('addIgdbStatus').textContent = err.message;
    }
  }, 300);
});

$('addIgdbResults').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-igdb-id]'); if (!b) return;
  const igdbId = b.dataset.igdbId;
  $('addIgdbStatus').textContent = 'Importing game details…';
  try {
    const d = await api('/api/igdb/game/' + igdbId);
    const g = Object.assign({
      id: uid(),
      stage: $('addManualStage').value || 'Planned',
      format: $('addManualFormat').value || '',
      dueDate: $('addManualDue').value || '',
      createdAt: Date.now(),
      plan: PL.normalize({})
    }, d.game, { ttb: d.ttb || null });
    ensureHistory(g); ensureChecks(g, g.stage);
    state.games.unshift(g);
    save();
    closeSheet('addSheet');
    renderAll();
    toast(`Added "${g.name}"`);
  } catch (err) {
    $('addIgdbStatus').textContent = err.message;
  }
});

$('addManualBtn').addEventListener('click', () => {
  const name = $('addManualName').value.trim(); if (!name) { $('addManualName').focus(); return; }
  const stage = $('addManualStage').value || 'Planned';
  const g = {
    id: uid(), name, stage,
    format: $('addManualFormat').value || '',
    dueDate: $('addManualDue').value || '',
    developers: [], genres: [], platforms: [],
    createdAt: Date.now(), plan: PL.normalize({})
  };
  ensureHistory(g); ensureChecks(g, stage);
  state.games.unshift(g);
  save();
  closeSheet('addSheet');
  renderAll();
  toast(`Added "${g.name}"`);
});

// ------------------------------------------------------------------ CALENDAR VIEW
function renderCalendar() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  $('calMonthLabel').textContent = `${PL.MONTHS[m]} ${y}`;
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayIso();
  const slotDays = (state.cadence && state.cadence.days) || [];
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;

  const byDay = {};
  state.games.forEach((g) => {
    const d = g.dueDate || (g.stage === 'Published' ? g.publishedAt : '');
    if (d && d.startsWith(prefix)) (byDay[d] = byDay[d] || []).push(g);
  });

  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell out"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${prefix}-${String(d).padStart(2, '0')}`;
    const games = byDay[iso] || [];
    const cls = ['cal-cell'];
    if (PL.isSlot(iso, slotDays)) cls.push('slot');
    if (iso === today) cls.push('today');
    if (iso === calSelectedDay) cls.push('selected');
    const dots = games.slice(0, 4).map((g) => `<span class="cal-dot" style="background:${stageObj(g.stage).color}"></span>`).join('');
    cells += `<button type="button" class="${cls.join(' ')}" data-day="${iso}"><span>${d}</span>${dots ? `<div class="cal-dots">${dots}</div>` : ''}</button>`;
  }
  $('calGrid').innerHTML = cells;

  const agenda = $('calAgenda');
  agenda.innerHTML = '';
  let list = [];
  if (calSelectedDay && calSelectedDay.startsWith(prefix)) {
    $('calAgendaTitle').textContent = `Games on ${calSelectedDay}`;
    $('calClearDay').classList.remove('hidden');
    list = byDay[calSelectedDay] || [];
  } else {
    $('calAgendaTitle').textContent = `Scheduled in ${PL.MONTHS[m]}`;
    $('calClearDay').classList.add('hidden');
    Object.keys(byDay).sort().forEach((k) => { list = list.concat(byDay[k]); });
  }
  if (!list.length) agenda.innerHTML = '<div class="empty-state">Nothing scheduled here yet.</div>';
  else list.forEach((g) => agenda.appendChild(makeGameCard(g)));
}

$('calPrev').addEventListener('click', () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); calSelectedDay = ''; renderCalendar(); });
$('calNext').addEventListener('click', () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); calSelectedDay = ''; renderCalendar(); });
$('calClearDay').addEventListener('click', () => { calSelectedDay = ''; renderCalendar(); });
$('calGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]'); if (!b) return;
  calSelectedDay = calSelectedDay === b.dataset.day ? '' : b.dataset.day;
  renderCalendar();
});

// ------------------------------------------------------------------ JOURNAL VIEW
function renderJournal() {
  const q = $('jSearch').value.trim().toLowerCase();
  const list = PL.sortJournal((state.journal || []).map(PL.normJournal)).filter((n) => {
    if (!q) return true;
    return (n.title + ' ' + n.text + ' ' + n.date).toLowerCase().includes(q);
  });
  const el = $('journalList');
  if (!list.length) { el.innerHTML = '<div class="empty-state">No studio notes yet. Tap + to jot one down!</div>'; return; }
  el.innerHTML = list.map((n) => {
    const linked = (n.games || []).map((id) => findGame(id)).filter(Boolean);
    return `<div class="jcard" data-note-id="${esc(n.id)}">
      <div class="jcard-head">
        <div class="jcard-title">${esc(n.title || 'Untitled Note')}</div>
        <div class="jcard-date">${esc(n.date || '')}</div>
      </div>
      ${linked.length ? `<div class="gcard-chips">${linked.map((g) => `<span class="mchip">${esc(g.name)}</span>`).join('')}</div>` : ''}
      ${n.text ? `<div class="jcard-preview">${esc(n.text)}</div>` : ''}
    </div>`;
  }).join('');
}
$('jSearch').addEventListener('input', renderJournal);
$('journalList').addEventListener('click', (e) => {
  const c = e.target.closest('[data-note-id]'); if (!c) return;
  openJournalSheet(c.dataset.noteId);
});

function openJournalSheet(id) {
  state.journal = Array.isArray(state.journal) ? state.journal : [];
  let note = state.journal.find((n) => n.id === id);
  if (!note) {
    note = PL.normJournal({ date: todayIso() });
    state.journal.unshift(note);
    save();
  }
  openNoteId = note.id;
  $('jsTitle').value = note.title || '';
  $('jsDate').value = note.date || todayIso();
  fillSelect($('jsGame'), state.games.map((g) => ({ value: g.id, label: g.name })), (note.games && note.games[0]) || '', '— No linked game —');
  $('jsText').value = note.text || '';
  $('journalSheet').classList.remove('hidden');
}

function editNote(fn) {
  const n = (state.journal || []).find((x) => x.id === openNoteId); if (!n) return;
  fn(n);
  n.updatedAt = Date.now();
  save();
}
$('jsTitle').addEventListener('input', (e) => editNote((n) => { n.title = e.target.value; }));
$('jsDate').addEventListener('change', (e) => editNote((n) => { n.date = e.target.value; }));
$('jsGame').addEventListener('change', (e) => editNote((n) => { n.games = e.target.value ? [e.target.value] : []; }));
$('jsText').addEventListener('input', (e) => editNote((n) => { n.text = e.target.value; }));
$('jsDeleteBtn').addEventListener('click', () => {
  const idx = (state.journal || []).findIndex((x) => x.id === openNoteId); if (idx < 0) return;
  const removed = state.journal.splice(idx, 1)[0];
  save();
  closeSheet('journalSheet');
  toast('Note deleted', { label: 'UNDO', fn: () => { state.journal.splice(idx, 0, removed); save(); renderJournal(); } }, 8000);
});

// ------------------------------------------------------------------ STATS VIEW
function renderStats() {
  const rec = PL.recap(state.games, recapMode, recapYear, recapMonth, formatsOf());
  const years = [...new Set([String(new Date().getFullYear()), ...state.games.map((g) => PL.pubDateOf(g).slice(0, 4)).filter(Boolean)])].sort().reverse();
  const maxStage = Math.max(1, ...STAGES.map((s) => state.games.filter((g) => g.stage === s.id).length));
  const ch = appSettings.youtubeChannel;

  $('statsContent').innerHTML = `
    ${ch ? `<div class="mcard">
      <div class="mcard-title">YouTube Channel · ${esc(ch.handle || ch.title || '')}</div>
      <div class="stat-tiles">
        <div class="stile"><div class="stile-val">${compact(ch.subscribers) || '—'}</div><div class="stile-lbl">Subscribers</div></div>
        <div class="stile"><div class="stile-val">${compact(ch.views) || '—'}</div><div class="stile-lbl">Total Views</div></div>
      </div>
    </div>` : ''}

    <div class="mcard">
      <div class="mcard-head">
        <div class="mcard-title">Recap · ${esc(rec.periodLabel)}</div>
        <button type="button" id="copyRecapBtn" class="chip-btn">Copy</button>
      </div>
      <div class="recap-controls">
        <button type="button" data-rmode="month" class="${recapMode === 'month' ? 'active' : ''}">Monthly</button>
        <button type="button" data-rmode="year" class="${recapMode === 'year' ? 'active' : ''}">Yearly</button>
        <select id="recapYearSel">${years.map((y) => `<option value="${y}" ${y === recapYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
        ${recapMode === 'month' ? `<select id="recapMonthSel">${PL.MONTHS.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${v === recapMonth ? 'selected' : ''}>${m}</option>`; }).join('')}</select>` : ''}
      </div>
      <div class="stat-tiles">
        <div class="stile"><div class="stile-val">${rec.count}</div><div class="stile-lbl">Published</div></div>
        <div class="stile"><div class="stile-val">${rec.hours}h</div><div class="stile-lbl">Hours Played</div></div>
        <div class="stile"><div class="stile-val">${compact(rec.views) || '0'}</div><div class="stile-lbl">Video Views</div></div>
        <div class="stile"><div class="stile-val">${rec.awards.length}</div><div class="stile-lbl">Awards</div></div>
      </div>
    </div>

    <div class="mcard">
      <div class="mcard-title">Pipeline (${state.games.length} Games)</div>
      ${STAGES.map((s) => {
        const c = state.games.filter((g) => g.stage === s.id).length;
        return `<div class="pipe-row">
          <span class="pipe-lbl">${esc(s.id)}</span>
          <div class="pipe-bar"><div class="pipe-fill" style="width:${(c / maxStage) * 100}%;background:${s.color}"></div></div>
          <span class="pipe-val">${c}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  $('statsContent').querySelectorAll('[data-rmode]').forEach((b) => {
    b.onclick = () => { recapMode = b.dataset.rmode; renderStats(); };
  });
  $('recapYearSel').onchange = (e) => { recapYear = e.target.value; renderStats(); };
  const ms = $('recapMonthSel');
  if (ms) ms.onchange = (e) => { recapMonth = e.target.value; renderStats(); };
  $('copyRecapBtn').onclick = () => {
    const lines = [`Critical Hit Studio — ${rec.periodLabel} Recap`, `Published: ${rec.count} | Hours: ${rec.hours}h | Views: ${rec.views.toLocaleString()} | Awards: ${rec.awards.length}`];
    rec.games.forEach((g) => lines.push(`- ${g.name}`));
    navigator.clipboard && navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Recap copied!'));
  };
}

// ------------------------------------------------------------------ TAB NAVIGATION & FAB
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.bnav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('viewBoard').classList.toggle('hidden', tab !== 'board');
  $('viewCalendar').classList.toggle('hidden', tab !== 'calendar');
  $('viewJournal').classList.toggle('hidden', tab !== 'journal');
  $('viewStats').classList.toggle('hidden', tab !== 'stats');
  $('fabAdd').setAttribute('aria-label', tab === 'journal' ? 'New studio note' : 'Add game');
  renderAll();
}
document.querySelectorAll('.bnav-btn').forEach((b) => {
  b.addEventListener('click', () => switchTab(b.dataset.tab));
});
$('fabAdd').addEventListener('click', () => {
  if (activeTab === 'journal') openJournalSheet(null);
  else openAddSheet();
});

function renderAll() {
  if (activeTab === 'board') renderBoard();
  else if (activeTab === 'calendar') renderCalendar();
  else if (activeTab === 'journal') renderJournal();
  else if (activeTab === 'stats') renderStats();
}

// ------------------------------------------------------------------ CLOUD SYNC (FIREBASE)
function initMobileCloud() {
  if (!window.CHL_CLOUD) return;
  const setMsg = (t) => { $('mCloudMsg').textContent = t || ''; };
  let syncedUid = null;

  $('mCloudBtn').onclick = () => $('cloudSheet').classList.remove('hidden');

  function posterStats() {
    const total = (state.games || []).length;
    const withArt = (state.games || []).filter((g) => !!safeUrl(coverUrlOf(g))).length;
    return `${total} games · ${withArt} posters`;
  }

  function applyRemote(remoteDoc, fromLive) {
    if (!remoteDoc) return;
    state = CHL_CLOUD.mergeStates(state, remoteDoc);
    state.games = (state.games || []).map((g) => { ensureHistory(g); ensureChecks(g, g.stage); return g; });
    state.journal = (state.journal || []).map(PL.normJournal);
    cacheLocal();
    if (hasLocalApi) { skipCloudPush = true; save(true); }
    renderAll();
    if (openGameId) { const g = findGame(openGameId); if (g) populateGameSheet(g); }
    setMsg(`Synced at ${new Date().toLocaleTimeString()} · ${posterStats()}`);
    if (fromLive) toast('Synced from PC', null, 2200);
  }

  async function syncNow(showToast) {
    if (!CHL_CLOUD.getUser()) return;
    setMsg('Syncing…');
    try {
      const rem = await CHL_CLOUD.pullOnce();
      if (rem) applyRemote(rem, false);
      await CHL_CLOUD.pushState(state);
      setMsg(`Synced at ${new Date().toLocaleTimeString()} · ${posterStats()}`);
      if (showToast) toast('Cloud sync complete');
    } catch (e) { setMsg('Sync failed: ' + e.message); }
  }

  CHL_CLOUD.init({
    onAuth: async (user) => {
      $('mCloudSignedOut').classList.toggle('hidden', !!user);
      $('mCloudSignedIn').classList.toggle('hidden', !user);
      $('mCloudBtn').classList.toggle('online', !!user);
      $('mCloudBtn').textContent = user ? '☁ Synced' : '☁ Sign in';
      if (user) {
        $('mCloudEmailLbl').textContent = user.email || 'Signed in';
        if (syncedUid !== user.uid) { syncedUid = user.uid; await syncNow(false); }
      } else {
        syncedUid = null;
        setMsg('');
        if (!hasLocalApi && (!state.games || !state.games.length)) {
          $('cloudSheet').classList.remove('hidden');
        }
      }
    },
    onRemoteState: (remoteDoc) => applyRemote(remoteDoc, true),
    onStatus: (kind, msg) => { if (kind === 'error') setMsg(msg); }
  });

  $('mCloudSignIn').onclick = async () => {
    setMsg('Signing in…');
    try { await CHL_CLOUD.signIn($('mCloudEmail').value, $('mCloudPass').value); $('mCloudPass').value = ''; closeSheet('cloudSheet'); toast('Signed in & syncing!'); }
    catch (e) { setMsg(e.message); }
  };
  $('mCloudSignUp').onclick = async () => {
    setMsg('Creating account…');
    try { await CHL_CLOUD.signUp($('mCloudEmail').value, $('mCloudPass').value); $('mCloudPass').value = ''; closeSheet('cloudSheet'); toast('Account created & syncing!'); }
    catch (e) { setMsg(e.message); }
  };
  $('mCloudReset').onclick = async () => {
    const email = $('mCloudEmail').value.trim();
    if (!email) { setMsg('Enter your email above first.'); return; }
    try { await CHL_CLOUD.resetPassword(email); setMsg('Reset email sent to ' + email); }
    catch (e) { setMsg(e.message); }
  };
  $('mCloudSyncNow').onclick = () => syncNow(true);
  $('mCloudSignOut').onclick = async () => {
    await CHL_CLOUD.signOut();
    toast('Signed out');
  };
}

// ------------------------------------------------------------------ BOOT
(async function boot() {
  // Replace unrendered template tokens when running standalone inside Capacitor APK
  const sub = document.querySelector('.mbar-sub');
  if (sub && sub.textContent.includes('{{VERSION}}')) sub.innerHTML = 'Mobile<span id="mChannel" class="mbar-ch"></span>';
  if (document.documentElement.style.getPropertyValue('--accent').includes('{{')) {
    document.documentElement.style.setProperty('--accent', '#e60000');
  }

  try {
    const [doc, st] = await Promise.all([api('/api/planner'), api('/api/settings')]);
    hasLocalApi = true;
    if (doc && Array.isArray(doc.games)) state = Object.assign(state, doc);
    if (st) {
      appSettings = Object.assign(appSettings, st);
      if (st.accentColor) document.documentElement.style.setProperty('--accent', st.accentColor);
      if (st.youtubeChannel && (st.youtubeChannel.handle || st.youtubeChannel.title)) {
        $('mChannel').textContent = ' · ' + (st.youtubeChannel.handle || st.youtubeChannel.title);
      }
    }
    cacheLocal();
  } catch (e) {
    // Standalone mobile APK / static web mode (no local PC server)
    hasLocalApi = false;
    const cached = loadLocalCache();
    if (cached && Array.isArray(cached.games)) state = Object.assign(state, cached);
  }
  loaded = true;
  renderAll();
  initMobileCloud();
})();
