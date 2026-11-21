'use strict';
// Exposes game launch, local script file, and project folder picking/opening to the page. Nothing else from Electron or Node.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chlDesktop', {
  launch: (target) => ipcRenderer.invoke('chl:launch', String(target == null ? '' : target)),
  pickLauncher: () => ipcRenderer.invoke('chl:pick-launcher'),
  openScript: (target) => ipcRenderer.invoke('chl:open-script', String(target == null ? '' : target)),
  pickScript: () => ipcRenderer.invoke('chl:pick-script'),
  openFolder: (target) => ipcRenderer.invoke('chl:open-folder', String(target == null ? '' : target)),
  pickFolder: () => ipcRenderer.invoke('chl:pick-folder')
});
