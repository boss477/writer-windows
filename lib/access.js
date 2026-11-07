'use strict';

const { DOC_EXT, canonical, isInside } = require('./paths');

/**
 * Tracks which folders and files the user has explicitly granted to the app.
 * Every filesystem IPC handler checks here first, so a compromised renderer
 * can only reach what the user picked through a dialog or drop.
 */
class AccessList {
  constructor(roots = []) {
    this.roots = new Set();
    this.files = new Set();
    roots.forEach((root) => this.addRoot(root));
  }

  addRoot(root) {
    this.roots.add(canonical(root));
  }

  addFile(file) {
    if (DOC_EXT.test(file)) this.files.add(canonical(file));
  }

  hasRoot(root) {
    return typeof root === 'string' && this.roots.has(canonical(root));
  }

  /** A document may be touched if it has a document extension and was granted. */
  allowsFile(file) {
    if (typeof file !== 'string' || !DOC_EXT.test(file)) return false;
    if (this.files.has(canonical(file))) return true;
    return [...this.roots].some((root) => isInside(root, file));
  }

  /** Any path inside a granted folder (used for the plugin directory). */
  allowsDirectory(dir) {
    return typeof dir === 'string' && [...this.roots].some((root) => isInside(root, dir));
  }

  toJSON() {
    return [...this.roots];
  }
}

module.exports = { AccessList };
