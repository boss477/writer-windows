let root = null,
  current = null,
  files = [],
  docs = new Map(),
  tabs = [],
  view = 'edit',
  workspaceRoots = [];
let pluginCommands = [];
const $ = (id) => document.getElementById(id),
  editor = $('editor'),
  preview = $('preview');
const settings = JSON.parse(localStorage.getItem('writer-settings') || '{}');
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function titleOf(file) {
  return file?.split(/[\\/]/).pop() || 'Untitled';
}
function renderWorkspaces() {
  const select = $('workspaceSelect');
  select.innerHTML = workspaceRoots.length
    ? workspaceRoots
        .map(
          (x) =>
            `<option value="${encodeURIComponent(x)}" ${x === root ? 'selected' : ''}>${escapeHtml(titleOf(x))}</option>`,
        )
        .join('')
    : '<option>No workspace</option>';
}
async function loadPlugins() {
  pluginCommands = await writer.listPlugins(root);
  document.querySelectorAll('.plugin-command').forEach((x) => x.remove());
  const dialog = document.querySelector('#palette .dialog');
  pluginCommands.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'plugin-command';
    b.dataset.pluginAction = p.action;
    b.textContent = p.name;
    dialog.appendChild(b);
    b.onclick = () => runPlugin(p);
  });
}
async function runPlugin(plugin) {
  $('palette').hidden = true;
  const actions = {
    theme: toggleTheme,
    settings: openSettings,
    search: () => {
      $('searchPanel').hidden = false;
      $('searchInput').focus();
    },
    new: newNote,
    open: openWorkspace,
    export: exportHtml,
    window: () => writer.newWindow(),
  };
  if (actions[plugin.action]) await actions[plugin.action]();
}
async function switchWorkspace(next) {
  if (!next) return;
  root = next;
  current = null;
  tabs = [];
  docs.clear();
  renderWorkspaces();
  await writer.watchFolder(root);
  await refresh();
  await loadPlugins();
  $('welcome').hidden = false;
  editor.hidden = true;
  preview.hidden = true;
  renderTabs();
}
async function openWorkspace() {
  const picked = await writer.pickFolder();
  if (!picked) return;
  if (!workspaceRoots.includes(picked)) workspaceRoots.push(picked);
  localStorage.setItem('writer-workspaces', JSON.stringify(workspaceRoots));
  await switchWorkspace(picked);
}
async function refresh() {
  if (!root) return;
  files = await writer.listFiles(root);
  $('count').textContent = `${files.length} files`;
  const list = $('fileList');
  list.innerHTML = files.length
    ? files
        .map(
          (f) =>
            `<button class="file ${current === f.path ? 'active' : ''}" data-path="${encodeURIComponent(f.path)}"><span>◌</span>${escapeHtml(f.name)}</button>`,
        )
        .join('')
    : '<div class="empty">No Markdown files yet<br><small>Use ＋ to create one.</small></div>';
  list
    .querySelectorAll('.file')
    .forEach((x) => (x.onclick = () => select(decodeURIComponent(x.dataset.path))));
}
async function select(file) {
  if (!file) return;
  if (!docs.has(file)) docs.set(file, await writer.readFile(file));
  if (!tabs.includes(file)) tabs.push(file);
  current = file;
  $('welcome').hidden = true;
  editor.hidden = view !== 'edit';
  preview.hidden = view !== 'preview';
  editor.value = docs.get(file);
  renderTabs();
  update();
  await refresh();
  if (view === 'preview') renderPreview();
}
function renderTabs() {
  document.querySelectorAll('.doc-tab').forEach((x) => x.remove());
  const toggle = $('tabs').querySelector('.view-toggle');
  tabs.forEach((file) => {
    const b = document.createElement('button');
    b.className = 'tab doc-tab ' + (file === current ? 'active' : '');
    b.innerHTML = `<span>${escapeHtml(titleOf(file))}</span><i aria-label="Close">×</i>`;
    b.onclick = (e) => (e.target.tagName === 'I' ? closeTab(file) : select(file));
    toggle.before(b);
  });
}
function closeTab(file) {
  tabs = tabs.filter((x) => x !== file);
  docs.delete(file);
  if (current === file) {
    current = tabs.at(-1) || null;
    if (current) select(current);
    else {
      editor.hidden = true;
      preview.hidden = true;
      $('welcome').hidden = false;
    }
  }
  renderTabs();
}
function renderMarkdown(text) {
  // Sanitise before it reaches innerHTML: Markdown may embed raw HTML from untrusted files.
  return DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }));
}
async function renderPreview() {
  preview.innerHTML = renderMarkdown(editor.value);
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.body.classList.contains('light') ? 'default' : 'dark',
      securityLevel: 'strict',
    });
    const nodes = preview.querySelectorAll('pre code.language-mermaid');
    nodes.forEach((code) => {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
    });
    try {
      await mermaid.run({ nodes: preview.querySelectorAll('.mermaid') });
    } catch (e) {
      preview.insertAdjacentHTML(
        'afterbegin',
        `<div class="render-error">Mermaid diagram error: ${escapeHtml(e.message)}</div>`,
      );
    }
  }
}
function update() {
  const b = editor.value.slice(0, editor.selectionStart).split('\n');
  $('cursor').textContent = `Ln ${b.length}, Col ${b.at(-1).length + 1}`;
  $('wordCount').textContent = `${(editor.value.trim().match(/\S+/g) || []).length} words`;
}
async function save() {
  if (!current) return;
  docs.set(current, editor.value);
  try {
    await writer.writeFile(current, editor.value);
    $('saveState').textContent = 'Saved';
    $('saveState').className = 'saved';
  } catch (error) {
    console.error(error);
    $('saveState').textContent = 'Save failed';
    $('saveState').className = 'unsaved';
  }
}
// Electron does not implement window.prompt(), so ask for names in an in-app dialog.
function askName(title, initial) {
  return new Promise((resolve) => {
    const overlay = $('nameDialog');
    const input = $('nameInput');
    $('nameTitle').textContent = title;
    input.value = initial;
    overlay.hidden = false;
    input.focus();
    input.select();
    const finish = (value) => {
      overlay.hidden = true;
      $('nameOk').onclick = $('nameCancel').onclick = input.onkeydown = overlay.onclick = null;
      resolve(value);
    };
    $('nameOk').onclick = () => finish(input.value.trim());
    $('nameCancel').onclick = () => finish(null);
    overlay.onclick = (e) => {
      if (e.target === overlay) finish(null);
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(input.value.trim());
      if (e.key === 'Escape') finish(null);
    };
  });
}
async function newNote() {
  if (!root) {
    await openWorkspace();
    if (!root) return;
  }
  const name = await askName('New note', 'Untitled');
  if (name) {
    const f = await writer.newFile(root, name);
    await refresh();
    await select(f);
  }
}
async function search() {
  if (!root) return alert('Open a workspace first');
  const q = $('searchInput').value.trim().toLowerCase();
  if (!q) {
    $('searchPanel').hidden = true;
    return;
  }
  const hits = [];
  for (const f of files) {
    const text = docs.get(f.path) || (await writer.readFile(f.path));
    const line = text.split('\n').findIndex((x) => x.toLowerCase().includes(q));
    if (line >= 0) hits.push({ f, line });
  }
  $('searchResults').innerHTML = hits.length
    ? hits
        .map(
          (x) =>
            `<button class="result" data-file="${encodeURIComponent(x.f.path)}">${escapeHtml(x.f.name)} <small>line ${x.line + 1}</small></button>`,
        )
        .join('')
    : '<div class="empty small">No matches</div>';
  document
    .querySelectorAll('.result')
    .forEach((x) => (x.onclick = () => select(decodeURIComponent(x.dataset.file))));
}
function setView(next) {
  view = next;
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => b.classList.toggle('selected', b.dataset.view === view));
  editor.hidden = view !== 'edit';
  preview.hidden = view !== 'preview';
  if (view === 'preview') renderPreview();
}
function commandPalette() {
  const overlay = $('palette');
  overlay.hidden = false;
  $('paletteInput').value = '';
  $('paletteInput').focus();
}
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem(
    'writer-theme',
    document.body.classList.contains('light') ? 'light' : 'dark',
  );
  if (view === 'preview') renderPreview();
}
function applySettings() {
  const fs = Number(settings.fontSize || 16),
    pw = Number(settings.previewWidth || 900);
  editor.style.fontSize = fs + 'px';
  preview.style.maxWidth = pw + 'px';
  $('fontSize').value = fs;
  $('previewWidth').value = pw;
  $('fontSizeValue').textContent = fs + 'px';
  $('previewWidthValue').textContent = pw + 'px';
}
function openSettings() {
  applySettings();
  $('settings').hidden = false;
}
function closeSettings() {
  localStorage.setItem('writer-settings', JSON.stringify(settings));
  $('settings').hidden = true;
}
function exportHtml() {
  if (!current) return;
  renderPreview().then(() =>
    writer.exportHtml(titleOf(current).replace(/\.[^.]+$/, ''), preview.innerHTML),
  );
}
editor.addEventListener('input', () => {
  if (!current) return;
  docs.set(current, editor.value);
  $('saveState').textContent = 'Unsaved';
  $('saveState').className = 'unsaved';
  update();
  clearTimeout(window.saveTimer);
  window.saveTimer = setTimeout(save, 700);
});
editor.addEventListener('keyup', update);
editor.addEventListener('click', update);
$('openBtn').onclick = $('welcomeOpen').onclick = openWorkspace;
$('workspaceSelect').onchange = (e) => switchWorkspace(decodeURIComponent(e.target.value));
$('refreshBtn').onclick = refresh;
$('newBtn').onclick = newNote;
$('themeBtn').onclick = toggleTheme;
$('paletteBtn').onclick = commandPalette;
$('searchBtn').onclick = () => {
  $('searchPanel').hidden = !$('searchPanel').hidden;
  $('searchInput').focus();
};
$('exportBtn').onclick = exportHtml;
$('settingsBtn').onclick = openSettings;
$('closeSettings').onclick = closeSettings;
$('newWindowBtn').onclick = () => writer.newWindow();
$('settings').onclick = (e) => {
  if (e.target.id === 'settings') closeSettings();
};
$('fontSize').oninput = (e) => {
  settings.fontSize = e.target.value;
  applySettings();
};
$('previewWidth').oninput = (e) => {
  settings.previewWidth = e.target.value;
  applySettings();
};
$('searchInput').oninput = search;
document
  .querySelectorAll('[data-view]')
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
document.querySelectorAll('[data-command]').forEach(
  (b) =>
    (b.onclick = () => {
      $('palette').hidden = true;
      ({
        open: openWorkspace,
        new: newNote,
        search: () => {
          $('searchPanel').hidden = false;
          $('searchInput').focus();
        },
        theme: toggleTheme,
        export: exportHtml,
      })[b.dataset.command]?.();
    }),
);
$('palette').onclick = (e) => {
  if (e.target.id === 'palette') e.currentTarget.hidden = true;
};
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    writer.openFiles().then((x) => x.forEach(select));
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    commandPalette();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    $('searchPanel').hidden = false;
    $('searchInput').focus();
  }
  if (e.key === 'Escape') {
    $('palette').hidden = true;
    $('searchPanel').hidden = true;
  }
});
document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
document.body.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const dropped = [...e.dataTransfer.files].filter((f) =>
    /\.(md|markdown|txt|html?)$/i.test(f.name),
  );
  writer.allowDropped(dropped).then((paths) => paths.forEach(select));
});
writer.onFolderChanged(() => refresh());
if (localStorage.getItem('writer-theme') === 'light') document.body.classList.add('light');
try {
  workspaceRoots = JSON.parse(localStorage.getItem('writer-workspaces') || '[]');
} catch {}
renderWorkspaces();
applySettings();
if (workspaceRoots[0]) switchWorkspace(workspaceRoots[0]);
document.querySelectorAll('[data-command="settings"]').forEach(
  (b) =>
    (b.onclick = () => {
      $('palette').hidden = true;
      openSettings();
    }),
);
document.querySelectorAll('[data-command="window"]').forEach(
  (b) =>
    (b.onclick = () => {
      $('palette').hidden = true;
      writer.newWindow();
    }),
);
