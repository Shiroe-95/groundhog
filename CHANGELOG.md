# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-18

### Added

- `PostToolUseFailure` hook that groups failures by normalized error signature and adds a note on the 2nd and 3rd hit of the same wall.
- `PostToolUse` hook on `Edit` that notices when an edit reverses an earlier one.
- `/groundhog-report` skill and `scripts/report.js` to measure walls and reverts in local session history (English and Spanish).
- `unstick` skill with the recovery protocol.
- `GROUNDHOG_WARN_AT`, `GROUNDHOG_STOP_AT` and `GROUNDHOG_DISABLE` settings.

[Unreleased]: https://github.com/Shiroe-95/groundhog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Shiroe-95/groundhog/releases/tag/v0.1.0
