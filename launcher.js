'use strict';
// Decides whether a "launch this game" target, local script file, or project folder is safe to open.
// Used by the Electron shell (main.js) and unit-tested on its own.
const SCHEMES = ['steam', 'com.epicgames.launcher', 'goggalaxy', 'battlenet', 'uplay', 'origin2', 'eadesktop', 'xbox', 'ms-windows-store'];
const FILE_EXT = ['.lnk', '.url', '.exe'];
const SCRIPT_EXT = ['.txt', '.md', '.docx', '.doc', '.odt', '.rtf', '.pdf', '.fountain', '.fdx'];

function classify(input) {
  const t = String(input == null ? '' : input).trim();
  if (!t || t.length > 1000 || /[\u0000-\u001f]/.test(t)) return { kind: 'bad', reason: 'Nothing to launch.' };
  const m = /^([a-z][a-z0-9+.-]*):\/\//i.exec(t);
  if (m) {
    const scheme = m[1].toLowerCase();
    if (!SCHEMES.includes(scheme)) return { kind: 'bad', reason: `Links of type "${scheme}://" are not allowed. Use a Steam/Epic/GOG... link or a shortcut file.` };
    return { kind: 'url', target: t };
  }
  const isWin = /^[a-z]:[\\/]/i.test(t) || /^\\\\[^\\]/.test(t);
  const isPosix = t.startsWith('/');
  if (!isWin && !isPosix) return { kind: 'bad', reason: 'Use the full path to a shortcut (e.g. C:\\Users\\you\\Desktop\\Game.lnk) or a steam:// link.' };
  const lower = t.toLowerCase();
  if (!FILE_EXT.some((e) => lower.endsWith(e))) return { kind: 'bad', reason: 'Only shortcuts and programs (.lnk, .url, .exe) can be launched.' };
  if (t.split(/[\\/]/).includes('..')) return { kind: 'bad', reason: 'The path must not contain "..".' };
  return { kind: 'file', target: t };
}

function classifyScript(input) {
  const t = String(input == null ? '' : input).trim();
  if (!t || t.length > 1000 || /[\u0000-\u001f]/.test(t)) return { kind: 'bad', reason: 'No script file set.' };
  const isWin = /^[a-z]:[\\/]/i.test(t) || /^\\\\[^\\]/.test(t);
  const isPosix = t.startsWith('/');
  if (!isWin && !isPosix) return { kind: 'bad', reason: 'Use the full path to a document file, or a Google Docs link.' };
  const lower = t.toLowerCase();
  if (!SCRIPT_EXT.some((e) => lower.endsWith(e))) return { kind: 'bad', reason: 'Only document files (.docx, .doc, .txt, .md, .pdf, .rtf, .odt, .fountain, .fdx) can be opened.' };
  if (t.split(/[\\/]/).includes('..')) return { kind: 'bad', reason: 'The path must not contain "..".' };
  return { kind: 'file', target: t };
}

function classifyFolder(input) {
  const t = String(input == null ? '' : input).trim();
  if (!t || t.length > 1000 || /[\u0000-\u001f]/.test(t)) return { kind: 'bad', reason: 'No folder set.' };
  const isWin = /^[a-z]:[\\/]/i.test(t) || /^\\\\[^\\]/.test(t);
  const isPosix = t.startsWith('/');
  if (!isWin && !isPosix) return { kind: 'bad', reason: 'Use a full folder path (e.g. D:\\Videos\\Elden Ring).' };
  if (t.split(/[\\/]/).includes('..')) return { kind: 'bad', reason: 'The path must not contain "..".' };
  return { kind: 'dir', target: t };
}

module.exports = { classify, classifyScript, classifyFolder, SCHEMES, FILE_EXT, SCRIPT_EXT };
