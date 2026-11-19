#!/usr/bin/env node
'use strict';

// Replays local Claude Code transcripts through groundhog's detector and counts
// what happened AFTER a note would have fired. Those failed calls are the ones
// groundhog tries to save. This is a retrospective upper bound, not an A/B test:
// the transcripts were recorded without groundhog, so we cannot know how many of
// those calls a note would really have prevented.
//
// Prints aggregates only. No signatures, commands, paths or file names.
//
//   node bench/replay.js [--dir <transcripts>] [--json]

const os = require('node:os');
const path = require('node:path');
const { scanFile, listTranscripts } = require('../scripts/report');

const WARN_AT = 2;
const STOP_AT = 3;
const tokens = (chars) => Math.round(chars / 4); // rough: ~4 characters per token

async function replay(dir, { warnAt = WARN_AT, stopAt = STOP_AT } = {}) {
  const out = {
    sessions: 0, toolResults: 0, failedResults: 0, failedTokens: 0,
    notes: { warn: 0, stop: 0, revert: 0, rework: 0 }, sessionsWithNotes: 0,
    afterWarn: { calls: 0, tokens: 0 }, afterStop: { calls: 0, tokens: 0 },
  };
  for (const file of listTranscripts(dir)) {
    let noted = false;
    const onEvent = ({ result, edit }) => {
      if (edit) {
        noted = true;
        if (edit.reverts) out.notes.revert++; else out.notes.rework++;
        return;
      }
      out.toolResults++;
      if (!result.isError) return;
      out.failedResults++;
      out.failedTokens += tokens(result.chars);
      const n = result.hit ? result.hit.count : 0;
      if (n >= stopAt) out.notes.stop++;
      else if (n >= warnAt) out.notes.warn++;
      if (n >= warnAt) noted = true;
      if (n > warnAt) { out.afterWarn.calls++; out.afterWarn.tokens += tokens(result.chars); }
      if (n > stopAt) { out.afterStop.calls++; out.afterStop.tokens += tokens(result.chars); }
    };
    try { await scanFile(file, onEvent); } catch { continue; }
    out.sessions++;
    if (noted) out.sessionsWithNotes++;
  }
  return out;
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');

function format(r) {
  const notes = r.notes.warn + r.notes.stop + r.notes.revert + r.notes.rework;
  return [
    'groundhog replay (retrospective upper bound, not an A/B test)', '',
    `Sessions replayed:              ${r.sessions}`,
    `Tool results:                   ${r.toolResults}`,
    `Failed tool results:            ${r.failedResults} (${pct(r.failedResults, r.toolResults)})`,
    `Sessions that would get a note: ${r.sessionsWithNotes} (${pct(r.sessionsWithNotes, r.sessions)})`,
    `Notes that would fire:          ${notes} (warn ${r.notes.warn}, stop ${r.notes.stop}, revert ${r.notes.revert}, rework ${r.notes.rework})`,
    `Notes per 100 tool calls:       ${r.toolResults ? ((100 * notes) / r.toolResults).toFixed(2) : '-'}`,
    '',
    `Failed calls after the 1st note: ${r.afterWarn.calls} (${pct(r.afterWarn.calls, r.failedResults)} of all failures), ~${r.afterWarn.tokens} tokens of error output`,
    `Failed calls after the stop note: ${r.afterStop.calls} (${pct(r.afterStop.calls, r.failedResults)} of all failures), ~${r.afterStop.tokens} tokens of error output`,
  ].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--dir');
  const dir = i >= 0 ? argv[i + 1] : path.join(os.homedir(), '.claude', 'projects');
  replay(dir).then((r) => {
    process.stdout.write((argv.includes('--json') ? JSON.stringify(r, null, 2) : format(r)) + '\n');
  }, (err) => {
    process.stderr.write(`groundhog: cannot read transcripts folder ${JSON.stringify(dir ?? '')}: ${err.code || err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { replay, format };
