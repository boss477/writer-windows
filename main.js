'use strict';

const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { AccessList } = require('./lib/access');
const { DOC_EXT, sanitizeNoteName, uniqueNotePath, buildExportHtml } = require('./lib/paths');

const INDEX_PATH = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_PATH).href;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DOC_FILTER = {
  name: 'Writer documents',
  extensions: ['md', 'markdown', 'txt', 'html', 'htm'],
};

/** Folders the user has chosen; persisted so workspaces survive restarts. */
let access;
const watchers = new Map(); // webContents id -> fs.FSWatcher

function workspaceStorePath() {
  return path.join(app.getPath('userData'), 'workspaces.json');
}

function loadAccess() {
  try {
    const saved = JSON.parse(fs.readFileSync(workspaceStorePath(), 'utf8'));
    return new AccessList(Array.isArray(saved) ? saved.filter((p) => typeof p === 'string') : []);
  } catch {
    return new AccessList();
  }
}

function persistAccess() {
  try {
    fs.writeFileSync(workspaceStorePath(), JSON.stringify(access), 'utf8');
  } catch (error) {
    console.error('Could not persist workspaces:', error.message);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e1116',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e1116', symbolColor: '#87909e', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // The UI is a single local page: never navigate away, never open child windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.loadFile(INDEX_PATH);
  return win;
}

/** Register an IPC handler that only answers the app's own page. */
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.senderFrame?.url !== INDEX_URL) {
      throw new Error(`Blocked IPC call to "${channel}" from an untrusted frame.`);
    }
    return fn(event, ...args);
  });
}

function requireFile(file) {
  if (!access.allowsFile(file)) throw new Error('Writer can only access documents you opened.');
  return file;
}

function requireRoot(root) {
  if (!access.hasRoot(root)) throw new Error('That folder is not an open workspace.');
  return root;
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && DOC_EXT.test(entry.name))
    .map((entry) => {
      const file = path.join(root, entry.name);
      return { name: entry.name, path: file, size: fs.statSync(file).size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listPlugins(root) {
  const dir = path.join(root, '.writer', 'plugins');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .flatMap((entry) => {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
        return item.id && item.name && item.action ? [item] : [];
      } catch {
        return [];
      }
    });
}

/** Write via a temp file so a crash mid-save cannot truncate the document. */
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function closeWatcher(id) {
  watchers.get(id)?.close();
  watchers.delete(id);
}

function registerIpc() {
  handle('pick-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return null;
    access.addRoot(result.filePaths[0]);
    persistAccess();
    return result.filePaths[0];
  });

  handle('open-files', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [DOC_FILTER],
    });
    if (result.canceled) return [];
    result.filePaths.forEach((file) => access.addFile(file));
    return result.filePaths;
  });

  // Paths come from webUtils.getPathForFile() on a real drop, never from page script.
  handle('allow-dropped', (_event, paths) =>
    (Array.isArray(paths) ? paths : []).filter((file) => {
      if (typeof file !== 'string' || !DOC_EXT.test(file) || !fs.existsSync(file)) return false;
      access.addFile(file);
      return true;
    }),
  );

  handle('new-window', () => {
    createWindow();
    return true;
  });

  handle('list-files', (_event, root) => listFiles(requireRoot(root)));
  handle('list-plugins', (_event, root) => (root ? listPlugins(requireRoot(root)) : []));

  handle('read-file', (_event, file) => {
    requireFile(file);
    if (fs.statSync(file).size > MAX_FILE_BYTES) throw new Error('File is larger than 20 MB.');
    return fs.readFileSync(file, 'utf8');
  });

  handle('write-file', (_event, file, text) => {
    requireFile(file);
    if (typeof text !== 'string') throw new Error('Document text must be a string.');
    writeAtomic(file, text);
    return true;
  });

  handle('new-file', (_event, root, name) => {
    requireRoot(root);
    const file = uniqueNotePath(root, sanitizeNoteName(name));
    fs.writeFileSync(file, `# ${path.basename(file, '.md')}\n\n`, { encoding: 'utf8', flag: 'wx' });
    return file;
  });

  handle('watch-folder', (event, root) => {
    const id = event.sender.id;
    closeWatcher(id);
    if (!root || !access.hasRoot(root) || !fs.existsSync(root)) return false;
    const watcher = fs.watch(root, { persistent: false }, () => {
      if (!event.sender.isDestroyed()) event.sender.send('folder-changed');
    });
    watcher.on('error', () => closeWatcher(id));
    watchers.set(id, watcher);
    event.sender.once('destroyed', () => closeWatcher(id));
    return true;
  });

  handle('export-html', async (event, title, html) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const name = String(title || 'document').replace(/[<>:"/\\|?*]/g, '-');
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `${name}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, buildExportHtml(title || 'document', String(html)), 'utf8');
    return result.filePath;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => createWindow());

  app.whenReady().then(() => {
    access = loadAccess();
    // Writer never needs camera, location, notifications, etc.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
      callback(false),
    );
    registerIpc();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
