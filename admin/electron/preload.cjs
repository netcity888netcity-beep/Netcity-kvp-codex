const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('kvpDesktop', Object.freeze({
  shell: 'electron',
  version: process.versions.electron,
}));
