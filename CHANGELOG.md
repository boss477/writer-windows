# Changelog

All notable changes to Writer are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- File access is now scoped: the main process only reads and writes documents inside folders the
  user picked, or files they opened or dropped. Previously any path sent over IPC was honored.
- IPC handlers verify the sender and validate arguments.
- Preview HTML is sanitized with DOMPurify.
- HTML export escapes the document title.
- Note names are sanitized (path separators, reserved Windows names) and never overwrite an
  existing note.
- Navigation, pop-ups, webviews and permission requests are blocked; CSP tightened.
- Documents are saved atomically.

### Fixed

- Drag and drop did nothing on current Electron because `File.path` was removed; now uses
  `webUtils.getPathForFile`.
- "New note" relied on `window.prompt()`, which Electron does not implement; replaced by an in-app
  dialog.
- A failed save now shows "Save failed" instead of silently reporting success.
- Folder watchers are tracked per window and closed with it.

### Added

- Single-instance lock; a second launch opens a new window.
- Unit tests, an end-to-end smoke test, ESLint and Prettier.
- CI on Windows and Linux, a tag-driven release workflow with checksums, and Dependabot.
- README, security policy, contributing guide, code of conduct, issue and PR templates.
- App icon.

### Changed

- Source reformatted and split: pure helpers moved to `lib/`.
- Installer now lets the user pick the install directory and bundles only runtime files.

## [0.1.0] - 2026-11-08

### Added

- First release: Markdown editor and preview with Mermaid, tabs, workspaces, search, themes,
  settings, command palette, file watching, drag and drop, HTML export, declarative workspace
  commands, and a Windows NSIS installer.

[Unreleased]: https://github.com/boss477/writer-windows/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/boss477/writer-windows/releases/tag/v0.1.0
