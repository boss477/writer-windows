'use strict';

// Launches the real Electron app against a throwaway profile and workspace.
// Run with: npm run test:e2e

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const HOSTILE_NOTE = [
  '# Hostile note',
  '',
  '<img src="x" onerror="window.__pwned = true">',
  '<script>window.__pwned = true</script>',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Write] --> B[Preview]',
  '```',
  '',
].join('\n');

let app;
let page;
let workspace;
let outsideFile;

test.before(async () => {
  const userData = tmp('writer-e2e-profile-');
  workspace = tmp('writer-e2e-workspace-');
  outsideFile = path.join(tmp('writer-e2e-outside-'), 'secret.txt');
  fs.writeFileSync(path.join(workspace, 'hostile.md'), HOSTILE_NOTE);
  fs.writeFileSync(outsideFile, 'top secret');
  // Grant the workspace the same way the folder picker would have.
  fs.writeFileSync(path.join(userData, 'workspaces.json'), JSON.stringify([workspace]));

  // Some hosts (VS Code, Claude Code) export this, which turns Electron into plain Node.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  app = await electron.launch({ args: [ROOT, `--user-data-dir=${userData}`], env });
  page = await app.firstWindow();
  await page.evaluate((root) => {
    localStorage.setItem('writer-workspaces', JSON.stringify([root]));
  }, workspace);
  await page.reload();
  await page.waitForSelector('#fileList .file');
});

test.after(async () => {
  await app?.close();
});

test('lists the workspace files', async () => {
  const names = await page.locator('#fileList .file').allTextContents();
  assert.ok(names.some((n) => n.includes('hostile.md')));
});

test('preview sanitises hostile HTML and renders Mermaid', async () => {
  await page.locator('#fileList .file', { hasText: 'hostile.md' }).click();
  await page.locator('[data-view="preview"]').click();
  await page.waitForSelector('#preview .mermaid svg');
  assert.equal(await page.locator('#preview script').count(), 0);
  assert.equal(await page.locator('#preview [onerror]').count(), 0);
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
});

test('the file bridge refuses paths outside granted folders', async () => {
  await assert.rejects(page.evaluate((file) => window.writer.readFile(file), outsideFile));
  await assert.rejects(page.evaluate((file) => window.writer.writeFile(file, 'x'), outsideFile));
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'top secret');
});

test('New note uses the in-app dialog and creates a safe file name', async () => {
  await page.locator('#newBtn').click();
  await page.locator('#nameInput').fill('..\\..\\evil');
  await page.locator('#nameOk').click();
  await page.waitForSelector('#nameDialog', { state: 'hidden' });
  const created = fs.readdirSync(workspace).filter((f) => f !== 'hostile.md');
  assert.equal(created.length, 1);
  assert.ok(created[0].endsWith('.md'));
  assert.ok(!created[0].includes('..\\'));
});

test('optionally captures a README screenshot', async (t) => {
  if (!process.env.WRITER_SCREENSHOT) return t.skip('set WRITER_SCREENSHOT=<file.png>');
  await page.setViewportSize({ width: 1360, height: 860 });
  await page.screenshot({ path: process.env.WRITER_SCREENSHOT });
});
