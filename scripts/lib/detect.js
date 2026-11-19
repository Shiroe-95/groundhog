'use strict';

const crypto = require('node:crypto');
const { signature, redactSecrets } = require('./signature');

const MAX_ATTEMPTS = 5;
const MAX_SUMMARY = 100;
// shortcut: per-session caps keep the state file small; a session that exceeds
// them simply stops tracking new keys, which only loses late signals.
const MAX_WALLS = 300;
const MAX_EDITS_PER_FILE = 50;
const MAX_FILES = 100;
const MAX_LINES_PER_FILE = 200;
// Two signatures from the same tool count as one wall when their word sets
// overlap this much (Jaccard). 0.8 merges long messages that differ in one
// identifier and keeps short, distinct errors apart.
const NEAR_DUP = 0.8;
const MIN_TOKENS = 4;
const REWORK_EVERY = 3;

const newState = () => ({ v: 1, walls: {}, edits: {} });

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

function summarizeInput(tool, input) {
  if (!input || typeof input !== 'object') return '';
  // MCP tools have no standard field: fall back to the first string argument.
  const raw = input.command ?? input.file_path ?? input.pattern ?? input.url ?? input.query ??
    Object.values(input).find((v) => typeof v === 'string') ?? '';
  return redactSecrets(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY);
}

const tokens = (sig) => new Set(sig.toLowerCase().split(/\s+/).filter(Boolean));

function jaccard(a, b) {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

// Finds an existing wall of the same tool whose signature is a near duplicate.
function nearWall(state, tool, sig) {
  const mine = tokens(sig);
  if (mine.size < MIN_TOKENS) return null;
  const prefix = `${tool}\u0000`;
  let best = null;
  let bestScore = NEAR_DUP;
  for (const key of Object.keys(state.walls)) {
    if (!key.startsWith(prefix)) continue;
    const theirs = tokens(key.slice(prefix.length));
    if (theirs.size < MIN_TOKENS) continue;
    const score = jaccard(mine, theirs);
    if (score >= bestScore) { best = key; bestScore = score; }
  }
  return best;
}

// Test runners print "N passed". More passing tests than last time means the
// agent is making progress, so the wall starts over. Only summary lines count
// (they also say failed, total or tests), and the largest number wins, so a
// "Test Suites: 3 passed" line does not hide "Tests: 40 passed".
function passedCount(error) {
  let best = null;
  for (const line of String(error).slice(0, 20000).split('\n')) {
    if (!/\b(?:failed|failing|total|tests?)\b/i.test(line)) continue;
    for (const m of line.matchAll(/(\d+)\s+(?:tests?\s+)?passed/gi)) best = Math.max(best ?? 0, Number(m[1]));
  }
  return best;
}

// Returns { tool, sig, count, attempts, changed } or null when the error has no usable signature.
function recordFailure(state, { tool, input, error }) {
  const sig = signature(error);
  if (!sig) return null;
  let key = `${tool}\u0000${sig}`;
  if (!state.walls[key]) key = nearWall(state, tool, sig) ?? key;
  let wall = state.walls[key];
  if (!wall) {
    if (Object.keys(state.walls).length >= MAX_WALLS) return null;
    wall = state.walls[key] = { count: 0, attempts: [] };
  }
  const passed = passedCount(error);
  if (passed !== null) {
    const best = Number.isInteger(wall.passed) ? wall.passed : null;
    if (best !== null && passed > best) {
      wall.count = 0;
      wall.attempts = [];
      wall.inputs = [];
    }
    wall.passed = Math.max(passed, best ?? 0);
  }
  state.fails = (Number.isInteger(state.fails) ? state.fails : 0) + 1;
  wall.count += 1;
  wall.attempts.push(summarizeInput(tool, input));
  wall.attempts = wall.attempts.slice(-MAX_ATTEMPTS);
  // The summary drops most of an MCP or Edit input, so compare hashes of the full input.
  wall.inputs = [...(wall.inputs ?? []), hash(JSON.stringify(input ?? null))].slice(-2);
  const changed = wall.inputs.length === 2 && wall.inputs[0] !== wall.inputs[1];
  return { tool, sig: key.slice(tool.length + 1), count: wall.count, attempts: [...wall.attempts], changed };
}

// Hashes of the non-trivial lines in a block of text. Braces, blank lines and
// other short punctuation lines say nothing about where the agent is working.
const lineHashes = (text) => String(text).split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length >= 6 && /[A-Za-z0-9]/.test(l))
  .map(hash);

// Returns { reverts } when this edit undoes an earlier edit on the same file,
// { rework } every 3rd time it rewrites lines written earlier in the session
// after a failure,
// else null. Only hashes are stored, never file contents.
function recordEdit(state, { file, oldStr, newStr }) {
  if (!file) return null;
  const key = hash(String(file).toLowerCase());
  const o = hash(oldStr);
  const n = hash(newStr);
  if (!state.edits[key]) {
    const keys = Object.keys(state.edits);
    // shortcut: drops the file tracked first, not the least recently edited one.
    if (keys.length >= MAX_FILES) delete state.edits[keys[0]];
    state.edits[key] = { pairs: [], reverts: 0 };
  }
  const entry = state.edits[key];
  const isRevert = entry.pairs.some(([po, pn]) => po === n && pn === o);
  entry.pairs.push([o, n]);
  entry.pairs = entry.pairs.slice(-MAX_EDITS_PER_FILE);
  // Rewriting your own lines is normal while coding. It only counts as rework
  // when some tool failed since the last edit to this file: edit, fail, re-edit.
  const fails = Number.isInteger(state.fails) ? state.fails : 0;
  const failedSince = fails > (entry.fails ?? 0);
  entry.fails = fails;
  const written = new Set(entry.lines ?? []);
  const isRework = failedSince && lineHashes(oldStr).some((h) => written.has(h));
  entry.lines = [...(entry.lines ?? []), ...lineHashes(newStr)].slice(-MAX_LINES_PER_FILE);
  if (isRevert) {
    entry.reverts += 1;
    return { reverts: entry.reverts };
  }
  if (!isRework) return null;
  entry.rework = (entry.rework ?? 0) + 1;
  return entry.rework % REWORK_EVERY === 0 ? { rework: entry.rework } : null;
}

module.exports = { newState, recordFailure, recordEdit, summarizeInput };
