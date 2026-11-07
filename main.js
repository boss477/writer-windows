const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs'); const path = require('path');
let win;
function createWindow() { win = new BrowserWindow({ width: 1360, height: 860, minWidth: 900, minHeight: 600, backgroundColor: '#0e1116', titleBarStyle: 'hidden', titleBarOverlay: { color: '#0e1116', symbolColor: '#87909e', height: 36 }, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } }); win.loadFile('index.html'); }
app.whenReady().then(createWindow); app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
ipcMain.handle('pick-folder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('new-window', () => { const child = new BrowserWindow({ width: 1360, height: 860, minWidth: 900, minHeight: 600, backgroundColor: '#0e1116', titleBarStyle: 'hidden', titleBarOverlay: { color: '#0e1116', symbolColor: '#87909e', height: 36 }, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } }); child.loadFile('index.html'); return true; });
ipcMain.handle('list-files', (_, root) => walk(root));
ipcMain.handle('read-file', (_, file) => fs.readFileSync(file, 'utf8'));
ipcMain.handle('write-file', (_, file, text) => { fs.writeFileSync(file, text, 'utf8'); return true; });
ipcMain.handle('new-file', (_, root, name) => { const safe = name.replace(/[<>:"/\\|?*]/g, '-').replace(/\.md$/i, '') + '.md'; const file = path.join(root, safe); fs.writeFileSync(file, '# ' + safe.replace('.md','') + '\n\n', 'utf8'); return file; });
ipcMain.handle('open-files', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Writer documents', extensions: ['md','markdown','txt','html','htm'] }] }); return r.canceled ? [] : r.filePaths; });
ipcMain.handle('watch-folder', (event, root) => {
  if (global.folderWatcher) global.folderWatcher.close();
  if (!root || !fs.existsSync(root)) return false;
  global.folderWatcher = fs.watch(root, { persistent: false }, () => {
    if (!win.isDestroyed()) win.webContents.send('folder-changed');
  });
  return true;
});
ipcMain.handle('export-html', async (_, title, html) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: `${title || 'document'}.html`, filters: [{ name: 'HTML', extensions: ['html'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui;max-width:860px;margin:48px auto;padding:0 24px;line-height:1.7}pre{padding:16px;background:#f3f4f6;border-radius:10px;overflow:auto}img{max-width:100%}</style>${html}`, 'utf8');
  return r.filePath;
});
function walk(root) { if (!root || !fs.existsSync(root)) return []; return fs.readdirSync(root, { withFileTypes: true }).filter(x => x.isFile() && /\.(md|markdown|txt|html|htm)$/i.test(x.name)).map(x => ({ name: x.name, path: path.join(root, x.name), size: fs.statSync(path.join(root,x.name)).size })).sort((a,b) => a.name.localeCompare(b.name)); }
