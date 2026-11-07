'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isInside,
  sanitizeNoteName,
  uniqueNotePath,
  escapeHtml,
  buildExportHtml,
} = require('../lib/paths');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'writer-test-'));

test('isInside accepts the root and its descendants', () => {
  const root = tmp();
  assert.ok(isInside(root, root));
  assert.ok(isInside(root, path.join(root, 'a', 'b.md')));
});

test('isInside rejects siblings, parents and traversal', () => {
  const root = tmp();
  assert.ok(!isInside(root, path.dirname(root)));
  assert.ok(!isInside(root, path.join(root, '..', 'other.md')));
  assert.ok(!isInside(root, root + '-evil/file.md'));
});

test('isInside rejects a symlink that points outside the root', (t) => {
  const root = tmp();
  const outside = tmp();
  const link = path.join(root, 'link');
  try {
    fs.symlinkSync(outside, link, 'junction');
  } catch {
    return t.skip('cannot create symlinks here');
  }
  assert.ok(!isInside(root, path.join(link, 'secret.md')));
});

test('sanitizeNoteName strips path separators and traversal', () => {
  for (const hostile of ['../../etc/passwd', '..\\..\\Windows\\System32', 'C:\\x']) {
    const name = sanitizeNoteName(hostile);
    assert.ok(!/[\\/:]/.test(name), `${hostile} -> ${name}`);
    assert.equal(path.basename(name), name);
  }
  assert.equal(sanitizeNoteName('a\\b:c*d'), 'a-b-c-d');
  assert.equal(sanitizeNoteName('notes.md'), 'notes');
});

test('sanitizeNoteName handles empty, dotted and reserved names', () => {
  assert.equal(sanitizeNoteName(''), 'Untitled');
  assert.equal(sanitizeNoteName('...'), 'Untitled');
  assert.equal(sanitizeNoteName(undefined), 'Untitled');
  assert.equal(sanitizeNoteName('CON'), 'CON-note');
  assert.equal(sanitizeNoteName('x'.repeat(500)).length, 100);
});

test('uniqueNotePath never overwrites an existing note', () => {
  const dir = tmp();
  assert.equal(uniqueNotePath(dir, 'Idea'), path.join(dir, 'Idea.md'));
  fs.writeFileSync(path.join(dir, 'Idea.md'), '');
  assert.equal(uniqueNotePath(dir, 'Idea'), path.join(dir, 'Idea (2).md'));
});

test('escapeHtml escapes markup characters', () => {
  assert.equal(
    escapeHtml(`<a href="x">'&'</a>`),
    '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
  );
});

test('buildExportHtml escapes the title so it cannot inject markup', () => {
  const html = buildExportHtml('</title><script>alert(1)</script>', '<p>hi</p>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<p>hi</p>'));
});
