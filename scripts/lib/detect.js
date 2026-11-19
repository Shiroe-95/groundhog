'use strict';

const crypto = require('node:crypto');
const { signature, redactSecrets } = require('./signature');

const MAX_ATTEMPTS = 5;
const MAX_SUMMARY = 100;
// shortcut: per-session caps keep the state file small; a session that exceeds
// them simply stops tracking new keys, which only loses late signals.
const MAX_WALLS = 300;
const MAX_EDITS_PER_FILE = 50;

const newState = () => ({ v: 1, walls: {}, edits: {} });

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

function summarizeInput(tool, input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command ?? input.file_path ?? input.pattern ?? input.url ?? input.query ?? '';
  return redactSecrets(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY);
}

// Returns { tool, sig, count, attempts } or null when the error has no usable signature.
function recordFailure(state, { tool, input, error }) {
  const sig = signature(error);
  if (!sig) return null;
  const key = `${tool}\u0000${sig}`;
  let wall = state.walls[key];
  if (!wall) {
    if (Object.keys(state.walls).length >= MAX_WALLS) return null;
    wall = state.walls[key] = { count: 0, attempts: [] };
  }
  wall.count += 1;
  wall.attempts.push(summarizeInput(tool, input));
  wall.attempts = wall.attempts.slice(-MAX_ATTEMPTS);
  return { tool, sig, count: wall.count, attempts: [...wall.attempts] };
}

// Returns { reverts } when this edit undoes an earlier edit on the same file, else null.
// Only hashes are stored, never file contents.
function recordEdit(state, { file, oldStr, newStr }) {
  if (!file) return null;
  const key = hash(String(file).toLowerCase());
  const o = hash(oldStr);
  const n = hash(newStr);
  const entry = (state.edits[key] ??= { pairs: [], reverts: 0 });
  const isRevert = entry.pairs.some(([po, pn]) => po === n && pn === o);
  entry.pairs.push([o, n]);
  entry.pairs = entry.pairs.slice(-MAX_EDITS_PER_FILE);
  if (!isRevert) return null;
  entry.reverts += 1;
  return { reverts: entry.reverts };
}

module.exports = { newState, recordFailure, recordEdit, summarizeInput };
