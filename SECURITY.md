# Security Policy

## Supported versions

Security fixes go into the latest release and the `master` branch.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/boss477/writer-windows/security/advisories/new).
Include steps to reproduce, the affected version, and the impact.

You will get an acknowledgment within a week. Once a fix ships, you will be credited in the
changelog unless you prefer to stay anonymous.

## Threat model

Writer opens files that may come from untrusted sources (downloaded notes, shared folders). The
design goal is that **opening or previewing a malicious document must not run code or reach files
the user did not grant.**

| Layer       | Control                                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer    | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP                                                                                                                       |
| Preview     | Markdown output sanitized with DOMPurify; Mermaid runs with `securityLevel: 'strict'`                                                                                                                 |
| Navigation  | `will-navigate` and `window.open` blocked; webviews and permission prompts denied                                                                                                                     |
| File access | Main-process allow-list: only folders chosen in the folder picker, and files opened or dropped by the user, with symlinks resolved. Only document extensions (`md`, `markdown`, `txt`, `html`, `htm`) |
| IPC         | Every handler checks the sender is Writer's own page and validates its arguments                                                                                                                      |
| Writes      | Atomic (temp file then rename); new notes get sanitized names and never overwrite                                                                                                                     |

Workspace commands in `.writer/plugins/*.json` are declarative and limited to an allow-list of
built-in actions. Writer never executes code from a workspace.

### Known limitations

- The Windows installer is **not code-signed**; verify downloads against the published
  `SHA256SUMS.txt`.
- The folder allow-list is stored in the app's user-data folder; anyone who can write there can
  already act as the user.
