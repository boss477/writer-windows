'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('writer', {
  pickFolder: invoke('pick-folder'),
  openFiles: invoke('open-files'),
  listFiles: invoke('list-files'),
  readFile: invoke('read-file'),
  writeFile: invoke('write-file'),
  newFile: invoke('new-file'),
  listPlugins: invoke('list-plugins'),
  watchFolder: invoke('watch-folder'),
  exportHtml: invoke('export-html'),
  newWindow: invoke('new-window'),
  /** Resolve real paths for dropped File objects and ask main to allow them. */
  allowDropped: (files) =>
    ipcRenderer.invoke(
      'allow-dropped',
      [...files].map((file) => webUtils.getPathForFile(file)).filter(Boolean),
    ),
  onFolderChanged: (callback) => ipcRenderer.on('folder-changed', () => callback()),
});
