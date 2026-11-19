<div align="center">

**English** · [Español](README.es.md)

# groundhog

**Your coding agent keeps waking up in the same error. groundhog notices.**

A Claude Code plugin that spots when the agent hits the same wall through *different* commands, or keeps undoing its own edits, and tells it to stop and think before the next try.

[![CI](https://github.com/Shiroe-95/groundhog/actions/workflows/ci.yml/badge.svg)](https://github.com/Shiroe-95/groundhog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node >= 20.1](https://img.shields.io/badge/node-%3E%3D20.1-339933)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen)

</div>

---

## The problem

You have seen it. The agent runs a command, gets an error, tweaks the command, gets the same error, tries a different flag, then a different file, then a different tool. Six attempts later nothing has moved, and the context window is full of near-identical failures.

Most loop guards look for **identical** calls: same tool, same arguments, over and over. That catches the dumbest loop, but it is not the common one. The agent rarely repeats itself exactly. It changes the input every time, and the error stays the same.

I measured this on my own Claude Code history before writing any code:

| What | Count |
| --- | --- |
| Sessions scanned | 616 |
| Sessions that hit at least one wall | 113 (18%) |
| Walls (same tool, same error, 3+ times in one session) | 141 |
| Failed calls spent inside those walls | 639 |
| Walls where **every retry changed the input** | 83 (59%) |
| Walls made of identical retries | 58 (41%) |
| Edits that undid an earlier edit (A to B, back to A) | 23 |

Six out of ten walls would slip right past an identical-call detector. That gap is what groundhog fills.

You can get the same table for your own sessions with `/groundhog-report`.

## How it works

groundhog is two small hooks and two skills. No network, no dependencies, no background process.

```
tool fails ──> PostToolUseFailure hook
                 │
                 ├─ normalize the error into a signature
                 │    paths  -> <path>
                 │    hashes -> <hex>
                 │    numbers -> <n>
                 │
                 ├─ count (tool + signature) for this session
                 │
                 ├─ 2nd hit: "new hypothesis before you retry"
                 └─ 3rd hit: "stop. read the error, hand off, or ask"

Edit succeeds ──> PostToolUse hook
                 └─ this edit reverses an earlier one? say so
```

**The signature is the key idea.** `Cannot find module '/home/a/src/db.js'` and `Cannot find module 'C:\work\src\db.js'` are the same wall. Line numbers, temp paths, commit hashes and ports change on every attempt. The cause does not. groundhog strips the noise and keeps the shape of the error.

When the count crosses a threshold, the hook adds a short note next to the tool result. The agent sees it on its next turn. groundhog never blocks a call and never rewrites output. It only adds evidence.

### What the agent sees

On the second hit:

```
groundhog: this is the 2nd time this session that Bash failed with the same error signature:
  "Error: Cannot find module '<path>'"
Recent attempts:
  1. node scripts/migrate.js
  2. node ./scripts/migrate.js --env dev
The input changed but the error did not, so the cause is probably not what the last
attempt changed. Before the next retry, write one sentence with a new hypothesis that
explains every failure above, and the cheapest check that would prove it wrong.
Then run that check.
```

On the third, it is told to stop and pick one of three moves: read the full error and the code it points to, hand the problem to a fresh subagent with only the facts, or ask you.

When an edit reverses an earlier edit to the same file:

```
groundhog: this edit undoes an earlier edit to config.ts in this session
(back-and-forth #1). You are oscillating between two versions. Before touching
this file again, decide which version is correct and cite the evidence.
```

## Install

Inside Claude Code:

```
/plugin marketplace add Shiroe-95/groundhog
/plugin install groundhog@groundhog
```

Or from a terminal:

```bash
claude plugin marketplace add Shiroe-95/groundhog
claude plugin install groundhog@groundhog
```

You need Node.js 20.1 or newer on your `PATH`. Claude Code users almost always have it already.

## Usage

Once installed, there is nothing to run. The hooks work on their own.

| Command | What it does |
| --- | --- |
| `/groundhog-report` | Scans your local session history and shows your top walls, how many had changing inputs, and how many edits were reverted. |
| `groundhog:unstick` skill | The playbook the agent follows when a notice appears. The agent loads it on its own. You can also call it by name. |

You can run the report outside Claude Code too:

```bash
node scripts/report.js            # English
node scripts/report.js --lang es  # Spanish
node scripts/report.js --json     # raw numbers
node scripts/report.js --dir /path/to/transcripts
```

## Configuration

All settings are environment variables. Set them in your shell or in the `env` block of your Claude Code settings.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GROUNDHOG_WARN_AT` | `2` | Hit number that triggers the first note (2 to 20). |
| `GROUNDHOG_STOP_AT` | `3` | Hit number that triggers the "stop" note (never lower than `WARN_AT`). |
| `GROUNDHOG_DISABLE` | unset | Set to `1` to turn groundhog off without uninstalling it. |

## Privacy and security

groundhog was built to be safe to install on a work machine.

- **No network calls.** Nothing is sent anywhere. Check with `grep -r "http" scripts/`.
- **No dependencies.** Only the Node.js standard library. There is no supply chain to compromise.
- **Minimal state.** Per-session counters live in the plugin data folder Claude Code provides (or your OS temp folder), readable only by you. To show the agent what it already tried, each wall also keeps its last 5 commands, cut to 100 characters, with URLs, emails, tokens and `key=value` secrets masked. Files older than 7 days are deleted automatically.
- **No code is stored.** For the revert detector, groundhog keeps only truncated SHA-256 hashes of edit text, never the text itself.
- **Scrubbed output.** Signatures replace paths, URLs, emails, tokens, hashes and numbers with placeholders. The report goes further: it never prints commands, and it masks quoted names, CamelCase identifiers and MCP server names. Masking is pattern-based, so take a quick look before you post a report publicly.
- **Fails closed to silence.** Malformed input, a corrupt state file or an oversized payload makes the hook exit quietly. It never breaks your session.
- **Read-only report.** `/groundhog-report` only reads transcripts. It writes nothing.

Found a security issue? See [SECURITY.md](SECURITY.md).

## Why not just...

**...use an identical-call loop detector?** Tools like LoopGuard, loop-circuit-breaker and agent-loop-detector are good at what they do. But they fingerprint the *call*, and in my data most walls change the call every time. groundhog fingerprints the *error*. The two approaches work fine together.

**...block the tool after N failures?** Blocking gets in the way when the retry is deliberate, like polling a server that is still starting. A note leaves the decision to the agent and keeps you in control.

**...use a Stop hook?** Stop hooks from plugins have rough edges ([anthropics/claude-code#10412](https://github.com/anthropics/claude-code/issues/10412)). Commenting on the failure right where it happens is simpler and works today.

Related discussions: [#4317](https://github.com/anthropics/claude-code/issues/4317) (loop detection), [#12768](https://github.com/anthropics/claude-code/issues/12768) (thrashing detection), [#47033](https://github.com/anthropics/claude-code/issues/47033) (session-level failure tracking), [#42796](https://github.com/anthropics/claude-code/issues/42796) (loop rate).

## Limitations

- The signature is a heuristic. Two different bugs can share an error line ("Segmentation fault"), and one bug can print two different lines. The thresholds are low on purpose so a false alarm costs one sentence.
- Only `Edit` calls are checked for reverts. A revert done with `Write` or a shell command is not seen.
- Counters are per session. A wall that spans several sessions is visible in the report, not live.
- The report reads the transcript format Claude Code uses today. If that format changes, the report may undercount until it is updated. The hooks do not depend on it.

## FAQ

**Does it cost tokens?** A few hundred, only when a wall is hit. In my history, walls were a small share of total tokens. What groundhog saves is turns, time and patience.

**Will it nag me during normal work?** Only if the same tool fails with the same normalized error at least twice in one session. A clean session never hears from it.

**Does it work with subagents?** Yes. The hooks fire for subagent tool calls too, and they are counted under the session that reports them.

**Windows?** Yes. CI runs on Linux, macOS and Windows.

## Development

```bash
git clone https://github.com/Shiroe-95/groundhog
cd groundhog
node --test
claude plugin validate . --strict
```

To try your local copy in Claude Code: `claude --plugin-dir .`

See [CONTRIBUTING.md](CONTRIBUTING.md) for the details.

## Author

Built by **Wilson Vargas Martinez**, engineer. [LinkedIn](https://www.linkedin.com/in/wilsonvm09) · [GitHub](https://github.com/Shiroe-95)

## License

[MIT](LICENSE). Use it, fork it, ship it.
