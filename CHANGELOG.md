# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Progress reset now recognizes Node.js TAP `# pass N` and Mocha `N passing` summaries without counting unrelated error text (#2, #3).

## [0.2.0] - 2026-11-18

### Added

- Near-duplicate errors from the same tool (their sets of distinct words overlap 80% or more, with at least 4 words) now count as the same wall.
- Progress reset: when a test runner reports more passing tests than last time, the wall starts over.
- Rework detector: an `Edit` that rewrites lines the agent wrote earlier in the session, after a failure in between, is counted; every 3rd time the agent gets a note.
- `bench/replay.js` replays saved sessions through the detector and reports how many failed calls came after each note (aggregates only).
- Tests for MCP tool failures, message wording and the bench.

### Changed

- The 2nd-hit note now asks for a hypothesis, a predicted output for the cheapest check, and the quoted line that settles it. It says whether the input changed or the same call failed again.
- The 3rd-hit note asks for a brief, not logs, when handing off to a subagent or the user.
- Both notes defer to the user's own debugging skill or process when there is one.
- Failures of the `Edit` tool add a hint to re-read the file first.
- `unstick` skill updated to match, with a section on rewriting the same lines.
- README: problem-first layout, banner, evidence, research table, and how it fits with other skills, MCP servers and hooks.

- The 2nd-hit note decides "input changed" from a hash of the full tool input, so MCP and Edit calls are judged correctly. MCP attempts now show their first text argument instead of "(no input)".
- The session state now also keeps hashes of edited lines (up to 100 files), the last two input hashes per wall and a failure counter.
- Without `CLAUDE_PLUGIN_DATA`, state goes to a per-user temp folder (`groundhog-<uid>` on Linux and macOS), created private and refused if another user owns it.
- The report labels walls as "input changed at least once", which is what it measures.

### Fixed

- The report and bench counted failed `Edit` calls as edits, which overcounted reverts. They now count only edits that succeeded, like the live hook.
- A state file with malformed edit entries no longer disables edit tracking for the rest of the session.

## [0.1.0] - 2026-11-18

### Added

- `PostToolUseFailure` hook that groups failures by normalized error signature and adds a note on the 2nd and 3rd hit of the same wall.
- `PostToolUse` hook on `Edit` that notices when an edit reverses an earlier one.
- `/groundhog-report` skill and `scripts/report.js` to measure walls and reverts in local session history (English and Spanish).
- `unstick` skill with the recovery protocol.
- `GROUNDHOG_WARN_AT`, `GROUNDHOG_STOP_AT` and `GROUNDHOG_DISABLE` settings.

[Unreleased]: https://github.com/Shiroe-95/groundhog/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Shiroe-95/groundhog/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Shiroe-95/groundhog/releases/tag/v0.1.0
