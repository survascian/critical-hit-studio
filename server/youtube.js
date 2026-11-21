'use strict';
// Reads public statistics for one YouTube video or channel using the free YouTube Data API v3 (an API key is enough; no Google sign-in).
// The base URL can be overridden by an env var so it can be tested against a fake server.
const YT_BASE = process.env.CHL_YT_URL || 'https://www.googleapis.com/youtube/v3';

class YoutubeError extends Error { constructor(message, status) { super(message); this.status = status || 502; } }

// Accepts watch?v=, youtu.be/, /shorts/, /live/, /embed/ links or a bare 11-character id. Returns '' for anything else.
function videoIdFrom(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else { const m = /^\/(shorts|live|embed|v)\/([\w-]{11})/.exec(u.pathname); if (m) id = m[2]; }
  }
  return /^[\w-]{11}$/.test(id) ? id : '';
}

// Accepts @handle, bare handle, youtube.com/@handle, youtube.com/channel/UC..., studio.youtube.com/channel/UC..., or bare UC... id.
function parseChannelInput(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^UC[\w-]{22}$/.test(s)) return { id: s, handle: '' };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(s)) return { id: '', handle: s };
  if (/^[A-Za-z0-9._-]{3,30}$/.test(s) && !s.includes('/')) return { id: '', handle: '@' + s };
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host !== 'youtube.com' && host !== 'studio.youtube.com') return null;
  let m = /^\/(@[A-Za-z0-9._-]{3,30})(?:\/|$)/.exec(u.pathname);
  if (m) return { id: '', handle: m[1] };
  m = /^\/channel\/(UC[\w-]{22})(?:\/|$)/.exec(u.pathname);
  if (m) return { id: m[1], handle: '' };
  return null;
}

async function ytGet(pathAndQuery, key) {
  if (!key) throw new YoutubeError('No YouTube API key yet. Add one in Settings.', 400);
  let r;
  try { r = await fetch(`${YT_BASE}${pathAndQuery}&key=${encodeURIComponent(key)}`, { headers: { Accept: 'application/json' } }); }
  catch (e) { throw new YoutubeError('Could not reach YouTube (' + e.message + ').', 502); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
    throw new YoutubeError('YouTube said: ' + String(msg).replace(/key=[\w-]+/gi, 'key=…').slice(0, 200), r.status === 403 || r.status === 400 ? 400 : 502);
  }
  return j;
}

async function fetchVideo(id, key) {
  if (!/^[\w-]{11}$/.test(id)) throw new YoutubeError('That does not look like a YouTube video link.', 400);
  const j = await ytGet(`/videos?part=statistics,snippet&id=${encodeURIComponent(id)}`, key);
  const it = (j.items || [])[0];
  if (!it) throw new YoutubeError('YouTube has no public video with that id (private, deleted or mistyped).', 404);
  const st = it.statistics || {}, sn = it.snippet || {};
  const n = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  return { id, title: sn.title || '', channel: sn.channelTitle || '', publishedAt: sn.publishedAt || '', views: n(st.viewCount), likes: n(st.likeCount), comments: n(st.commentCount), fetchedAt: Date.now() };
}

async function fetchChannel(input, key) {
  const parsed = parseChannelInput(input);
  if (!parsed) throw new YoutubeError('Enter a YouTube @handle or channel link (e.g. @Survascian).', 400);
  const param = parsed.id ? 'id=' + encodeURIComponent(parsed.id) : 'forHandle=' + encodeURIComponent(parsed.handle.replace(/^@/, ''));
  const j = await ytGet(`/channels?part=statistics,snippet,contentDetails&${param}`, key);
  const it = (j.items || [])[0];
  if (!it) throw new YoutubeError('YouTube has no public channel matching that handle or ID.', 404);
  const st = it.statistics || {}, sn = it.snippet || {}, cd = it.contentDetails || {};
  const n = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const rawHandle = sn.customUrl || parsed.handle || '';
  const handle = rawHandle ? (rawHandle.startsWith('@') ? rawHandle : '@' + rawHandle) : '';
  const thumbs = sn.thumbnails || {};
  const avatarUrl = (thumbs.medium && thumbs.medium.url) || (thumbs.default && thumbs.default.url) || (thumbs.high && thumbs.high.url) || '';
  const uploadsId = (cd.relatedPlaylists && cd.relatedPlaylists.uploads) || '';
  return { id: it.id || parsed.id || '', handle, title: sn.title || '', avatarUrl, uploadsId, subscribers: n(st.subscriberCount), views: n(st.viewCount), videos: n(st.videoCount), fetchedAt: Date.now() };
}

async function fetchChannelVideos(uploadsId, key, limit) {
  if (!uploadsId) throw new YoutubeError('No uploads playlist found for this channel.', 400);
  const max = Math.min(50, Math.max(1, parseInt(limit, 10) || 50));
  const j = await ytGet(`/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsId)}&maxResults=${max}`, key);
  return (j.items || []).map((it) => {
    const sn = it.snippet || {};
    const id = (sn.resourceId && sn.resourceId.videoId) || '';
    return id ? { id, title: sn.title || '', publishedAt: sn.publishedAt || '', url: 'https://www.youtube.com/watch?v=' + id } : null;
  }).filter(Boolean);
}

module.exports = { fetchVideo, fetchChannel, fetchChannelVideos, videoIdFrom, parseChannelInput, YoutubeError };
