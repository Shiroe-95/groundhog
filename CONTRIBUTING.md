# Contributing

Thanks for wanting to help. [Español](CONTRIBUTING.es.md)

## Ground rules

- **Zero dependencies.** groundhog runs inside people's editors, so it uses only the Node.js standard library. A pull request that adds a package will not be merged.
- **No network.** The hooks and the report never talk to the internet.
- **Never print user data.** Paths, file contents and project names must not reach hook messages or the report. If you touch `scripts/lib/signature.js`, add a test that proves nothing leaks.
- **Hooks must never break a session.** Every hook exits 0, even on bad input.

## Setup

```bash
git clone https://github.com/Shiroe-95/groundhog
cd groundhog
node --test                       # all tests must pass
claude plugin validate . --strict # if you have Claude Code installed
claude --plugin-dir .             # try your copy live
```

Node.js 20.1 or newer.

## Good first contributions

- **A wall signature that groups badly.** Two errors that should match but don't, or the other way around. Open an issue with both error texts, with any personal paths removed.
- **Better notes.** If a note did not help the agent get unstuck, show what it said and what the agent did next.
- **Revert detection for `Write`.** Today only `Edit` is checked.

## Pull requests

1. Open an issue first for anything bigger than a small fix.
2. One change per pull request, with a test.
3. Update `CHANGELOG.md` under `Unreleased`.
4. Update both `README.md` and `README.es.md` if behavior changes.

By contributing you agree that your work is released under the MIT license and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
