'use strict';

const fs = require('fs');
const path = require('path');

/** File types Writer will list, open and save. */
const DOC_EXT = /\.(md|markdown|txt|html?)$/i;

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_NAME_LENGTH = 100;

/** Resolve symlinks where possible so a link cannot escape an allowed folder. */
function canonical(target) {
  const resolved = path.resolve(target);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    // Path does not exist yet (e.g. a new file): canonicalise the parent instead.
    const parent = path.dirname(resolved);
    if (parent === resolved) return resolved;
    return path.join(canonical(parent), path.basename(resolved));
  }
}

function normalizeForCompare(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

/** True when `target` is `root` itself or lives somewhere underneath it. */
function isInside(root, target) {
  const rel = path.relative(
    normalizeForCompare(canonical(root)),
    normalizeForCompare(canonical(target)),
  );
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

/** Turn user input into a safe, single-segment Markdown filename (without extension). */
function sanitizeNoteName(input) {
  let name = String(input ?? '')
    .replace(/\.md$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  if (!name) name = 'Untitled';
  if (RESERVED_NAMES.test(name)) name = `${name}-note`;
  return name;
}

/** First free `Name.md`, `Name (2).md`, ... inside `dir`. */
function uniqueNotePath(dir, name) {
  let candidate = path.join(dir, `${name}.md`);
  for (let i = 2; fs.existsSync(candidate); i += 1) {
    candidate = path.join(dir, `${name} (${i}).md`);
  }
  return candidate;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

const EXPORT_STYLE =
  'body{font:16px system-ui;max-width:860px;margin:48px auto;padding:0 24px;line-height:1.7}' +
  'pre{padding:16px;background:#f3f4f6;border-radius:10px;overflow:auto}img{max-width:100%}';

/** Standalone HTML page for export. The title is escaped; the body is already sanitised. */
function buildExportHtml(title, bodyHtml) {
  return (
    `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    `<style>${EXPORT_STYLE}</style>${bodyHtml}`
  );
}

module.exports = {
  DOC_EXT,
  canonical,
  isInside,
  sanitizeNoteName,
  uniqueNotePath,
  escapeHtml,
  buildExportHtml,
};
