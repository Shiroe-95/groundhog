'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { newState } = require('./detect');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// State lives in the plugin data dir Claude Code provides (removed on uninstall),
// or in the OS temp dir. Nothing is ever written inside the plugin itself.
// The temp fallback is per user, so a shared /tmp never mixes sessions of different users.
function stateDir(env = process.env) {
  const uid = process.getuid ? process.getuid() : null;
  return env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), uid === null ? 'groundhog' : `groundhog-${uid}`);
}

function sessionFile(dir, sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'unknown';
  return path.join(dir, `${safe}.json`);
}

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const validWall = (w) => isObj(w) && Number.isInteger(w.count) && Array.isArray(w.attempts) &&
  (w.inputs === undefined || Array.isArray(w.inputs));
const validEdit = (e) => isObj(e) && Number.isInteger(e.reverts) && Array.isArray(e.pairs) &&
  e.pairs.every(Array.isArray) &&
  (e.lines === undefined || Array.isArray(e.lines)) && (e.rework === undefined || Number.isInteger(e.rework));

function load(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isObj(s) && s.v === 1 && isObj(s.walls) && isObj(s.edits) &&
        Object.values(s.walls).every(validWall) && Object.values(s.edits).every(validEdit)) return s;
  } catch {
    // missing or corrupt: start fresh
  }
  return newState();
}

function save(file, state) {
  const dir = path.dirname(file);
  const isNew = !fs.existsSync(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Refuse a folder another user created first (shared /tmp on Linux and macOS).
  if (process.getuid && fs.statSync(dir).uid !== process.getuid()) throw new Error('state dir not owned by user');
  // shortcut: parallel tool failures in one session can race and drop a count;
  // atomic rename keeps the file valid. Add a lock if counts must be exact.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(tmp, file);
  if (isNew) pruneOld(dir);
}

// Delete our own session files (and leftover temp files) older than 7 days.
// Only touches *.json and *.tmp in our dir.
function pruneOld(dir, now = Date.now()) {
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') && !name.endsWith('.tmp')) continue;
    const p = path.join(dir, name);
    try {
      if (now - fs.statSync(p).mtimeMs > MAX_AGE_MS) fs.unlinkSync(p);
    } catch {
      // another process may have removed it
    }
  }
}

module.exports = { stateDir, sessionFile, load, save, pruneOld };
