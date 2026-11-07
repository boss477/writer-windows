# Contributing to Writer

Thanks for helping. Writer is a small app and we want to keep it that way: local-first, private,
and easy to understand.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Open an issue before a large change so we can agree on the approach.
- Keep pull requests focused: one change, one reason.
- Writer stays offline and account-free. Features that need a network or send document content
  anywhere will not be accepted.

## Setup

Requires Node.js 20+ on Windows 10 or 11.

```powershell
git clone https://github.com/boss477/writer-windows.git
cd writer-windows
npm ci
npm start
```

## Before you open a pull request

```powershell
npm run check      # lint, format check, unit tests
npm run test:e2e   # launches the real app
```

- Add or update a test for every behavior change. Anything touching file access, IPC or the
  preview must have a test.
- Format with `npm run format`.
- Add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
- Update the README or docs if the change is user-facing.

## Security-sensitive changes

The main process in `main.js` and `lib/` enforces what the page may do. When you add an IPC
handler:

1. Register it with `handle(...)` so the sender is verified.
2. Validate every argument and check the path against the `AccessList`.
3. Add a negative test showing that an outside path is refused.

Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md).

## Commit messages

Use short, imperative messages with a type prefix: `feat:`, `fix:`, `docs:`, `test:`, `chore:`,
`ci:`, `refactor:`, `style:`.

## Releases

Maintainers bump `version` in `package.json`, move the changelog's Unreleased entries under the new
version, then push a `v*` tag. The release workflow does the rest.
