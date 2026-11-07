'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AccessList } = require('../lib/access');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'writer-access-'));

test('files inside a granted workspace are allowed', () => {
  const root = tmp();
  const list = new AccessList([root]);
  assert.ok(list.allowsFile(path.join(root, 'note.md')));
  assert.ok(list.hasRoot(root));
});

test('files outside every granted workspace are denied', () => {
  const list = new AccessList([tmp()]);
  assert.ok(!list.allowsFile(path.join(tmp(), 'note.md')));
  assert.ok(!list.allowsFile(path.join(os.homedir(), '.ssh', 'id_rsa')));
});

test('non-document extensions are denied even inside a workspace', () => {
  const root = tmp();
  const list = new AccessList([root]);
  assert.ok(!list.allowsFile(path.join(root, 'script.js')));
  assert.ok(!list.allowsFile(path.join(root, 'secret.env')));
});

test('traversal out of a workspace is denied', () => {
  const root = tmp();
  const list = new AccessList([root]);
  assert.ok(!list.allowsFile(path.join(root, '..', 'escape.md')));
});

test('an individually opened file is allowed without its folder', () => {
  const dir = tmp();
  const list = new AccessList();
  const file = path.join(dir, 'single.md');
  assert.ok(!list.allowsFile(file));
  list.addFile(file);
  assert.ok(list.allowsFile(file));
  assert.ok(!list.allowsFile(path.join(dir, 'sibling.md')));
});

test('invalid input types are denied', () => {
  const list = new AccessList([tmp()]);
  assert.ok(!list.allowsFile(undefined));
  assert.ok(!list.allowsFile({ path: 'x.md' }));
  assert.ok(!list.hasRoot(null));
});
