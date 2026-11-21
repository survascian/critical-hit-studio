'use strict';
// Electron shell: starts the local server inside the app and shows the UI in a window.
const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { classify, classifyScript, classifyFolder } = require('./launcher');
const { startServer } = require('./server/server');

const PORT = parseInt(process.env.CHL_PORT, 10) || 8787;
let win = null, srv = null;

function inApp(url, port) {
  try {
    const o = new URL(url).origin;
    return o === `http://127.0.0.1:${port}` || o === `http://localhost:${port}`;
  } catch (e) { return false; }
}
function openSafeExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.href);
  } catch (e) { /* ignore invalid or disallowed schemes */ }
}

function createWindow(port) {
  app.setAppUserModelId('com.criticalhit.studio');   // Windows: taskbar shows Critical Hit Studio with its icon
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1000, minHeight: 640,
    backgroundColor: '#0b0c10', title: 'Critical Hit Studio', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' }
  });
  win.loadURL(`http://127.0.0.1:${port}/`);
  // Our own pages open in-app (e.g. the Hit List preview window); http(s) links open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (inApp(url, port)) return { action: 'allow' };
    openSafeExternal(url); return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!inApp(url, port)) { e.preventDefault(); openSafeExternal(url); } });
  win.on('closed', () => { win = null; });
}

// Launch buttons on the Planner cards. Only our own pages may ask, and only for allowed targets (see launcher.js).
function fromOurPage(e) { try { return inApp(e.senderFrame.url, PORT); } catch (err) { return false; } }
ipcMain.handle('chl:launch', async (e, target) => {
  if (!fromOurPage(e)) return { ok: false, error: 'Not allowed.' };
  const c = classify(target);
  if (c.kind === 'bad') return { ok: false, error: c.reason };
  try {
    if (c.kind === 'url') { await shell.openExternal(c.target); return { ok: true }; }
    if (!fs.existsSync(c.target)) return { ok: false, error: 'That file was not found: ' + c.target };
    const err = await shell.openPath(c.target);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('chl:pick-launcher', async (e) => {
  if (!fromOurPage(e)) return null;
  const r = await dialog.showOpenDialog(win, { title: 'Choose the game\'s shortcut or program', properties: ['openFile', 'dontAddToRecent'],
    filters: [{ name: 'Shortcuts and programs', extensions: ['lnk', 'url', 'exe'] }, { name: 'All files', extensions: ['*'] }] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});
ipcMain.handle('chl:open-script', async (e, target) => {
  if (!fromOurPage(e)) return { ok: false, error: 'Not allowed.' };
  const c = classifyScript(target);
  if (c.kind === 'bad') return { ok: false, error: c.reason };
  try {
    if (!fs.existsSync(c.target)) return { ok: false, error: 'That script file was not found: ' + c.target };
    const err = await shell.openPath(c.target);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('chl:pick-script', async (e) => {
  if (!fromOurPage(e)) return null;
  const r = await dialog.showOpenDialog(win, { title: 'Choose a script document', properties: ['openFile', 'dontAddToRecent'],
    filters: [{ name: 'Documents & scripts', extensions: ['docx', 'doc', 'txt', 'md', 'pdf', 'rtf', 'odt', 'fountain', 'fdx'] }, { name: 'All files', extensions: ['*'] }] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});
ipcMain.handle('chl:open-folder', async (e, target) => {
  if (!fromOurPage(e)) return { ok: false, error: 'Not allowed.' };
  const c = classifyFolder(target);
  if (c.kind === 'bad') return { ok: false, error: c.reason };
  try {
    if (!fs.existsSync(c.target) || !fs.statSync(c.target).isDirectory()) return { ok: false, error: 'That folder was not found: ' + c.target };
    const err = await shell.openPath(c.target);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('chl:pick-folder', async (e) => {
  if (!fromOurPage(e)) return null;
  const r = await dialog.showOpenDialog(win, { title: 'Choose the project / footage folder', properties: ['openDirectory', 'dontAddToRecent'] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    try { srv = await startServer({ dataDir: app.getPath('userData'), port: PORT }); }
    catch (e) { dialog.showErrorBox('Critical Hit Studio', e.message); app.quit(); return; }
    createWindow(srv.port);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (srv) srv.close(); });
}
