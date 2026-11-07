# Writer extensions

Writer's command palette is the extension seam for future integrations. Commands should be small, local, reversible, and explicit about any file they change.

## Planned extension contract

```js
export default {
  id: 'word-count-report',
  name: 'Word count report',
  commands: [
    {
      id: 'report',
      title: 'Create word-count report',
      run: ({ document, workspace }) => ({ document, workspace }),
    },
  ],
};
```

The first-party command set already follows the same shape conceptually: open workspace, create note, search, export HTML, toggle theme, open settings, and open a new window.

## Extension rules

- Extensions must be local and opt-in.
- No extension receives network access by default.
- File writes must be visible to the user and scoped to the active workspace.
- Commands should expose keyboard shortcuts only when conflicts are checked.
- Extensions must document supported Windows versions and failure behavior.

## Current status

The built-in command registry is stable. Writer now supports declarative, local workspace commands: place JSON manifests in `.writer/plugins/*.json`. Only allowlisted actions are accepted; arbitrary JavaScript is never executed.

Example:

```json
{
  "id": "focus-theme",
  "name": "Toggle focus theme",
  "action": "theme"
}
```

Supported actions are `open`, `new`, `search`, `export`, `theme`, `settings`, and `window`.
