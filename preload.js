const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('win', {
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  togglePin: () => ipcRenderer.invoke('win:pin'),
  progress: (v) => ipcRenderer.send('win:progress', v),
  compact: (on) => ipcRenderer.invoke('win:compact', on),
});
