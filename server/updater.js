'use strict';
// Checks GitHub Releases for a newer version of Critical Hit Studio and validates release download URLs.
const DEFAULT_API = 'https://api.github.com/repos/survascian/critical-hit-studio/releases/latest';
const ALLOWED_HOSTS = ['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com'];

function parseVer(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/i.exec(String(v || '').trim());
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

function compareSemver(a, b) {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

function isAllowedDownloadUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (process.env.CHL_UPDATE_URL) {
      try { if (new URL(process.env.CHL_UPDATE_URL).host === u.host) return true; } catch (e) {}
    }
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && ALLOWED_HOSTS.some((ok) => h === ok || h.endsWith('.' + ok));
  } catch (e) { return false; }
}

function safeInstallerName(name) {
  const s = String(name || '').trim();
  return /^Critical-Hit-Studio-[A-Za-z0-9._-]+-win-setup\.exe$/.test(s) ? s : '';
}

async function checkLatest(currentVersion) {
  const url = process.env.CHL_UPDATE_URL || DEFAULT_API;
  let r;
  try {
    r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Critical-Hit-Studio/' + currentVersion } });
  } catch (e) {
    throw new Error('Could not reach GitHub (' + e.message + ').');
  }
  if (!r.ok) throw new Error('GitHub returned HTTP ' + r.status);
  const j = await r.json();
  const latest = String(j.tag_name || '').replace(/^v/i, '').trim();
  const assets = Array.isArray(j.assets) ? j.assets : [];
  const pick = (re) => {
    const a = assets.find((x) => x && re.test(x.name || '') && isAllowedDownloadUrl(x.browser_download_url));
    return a ? { name: a.name, url: a.browser_download_url, size: Number(a.size) || 0 } : null;
  };
  return {
    current: String(currentVersion || '0.0.0').replace(/^v/i, ''),
    latest,
    hasUpdate: !!latest && compareSemver(latest, currentVersion) > 0,
    releaseUrl: typeof j.html_url === 'string' && /^https:\/\/github\.com\//.test(j.html_url) ? j.html_url : 'https://github.com/survascian/critical-hit-studio/releases',
    notes: String(j.body || '').slice(0, 4000),
    winAsset: pick(/-win-setup\.exe$/i),
    apkAsset: pick(/-android\.apk$/i)
  };
}

module.exports = { compareSemver, isAllowedDownloadUrl, safeInstallerName, checkLatest };
