'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const freshDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'groundhog-test-'));

function run(script, payload, dataDir, extraEnv = {}) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', script)], {
    input,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: dataDir, ...extraEnv },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
}

const failure = (command, extra = {}) => ({
  session_id: 'sess-1',
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command },
  error: "Exit code 1\nError: Cannot find module '/tmp/x/db.js'",
  ...extra,
});

test('PostToolUseFailure: silent on 1st hit, evidence on 2nd, stop on 3rd', () => {
  const dir = freshDir();
  assert.equal(run('on-failure.js', failure('npm test'), dir), null);
  const second = run('on-failure.js', failure('npx jest'), dir);
  assert.equal(second.hookSpecificOutput.hookEventName, 'PostToolUseFailure');
  const ctx2 = second.hookSpecificOutput.additionalContext;
  assert.match(ctx2, /2nd time/);
  assert.match(ctx2, /npm test/);
  assert.match(ctx2, /npx jest/);
  assert.match(ctx2, /hypothesis/);
  const ctx3 = run('on-failure.js', failure('node db.js'), dir).hookSpecificOutput.additionalContext;
  assert.match(ctx3, /Stop/);
  assert.match(ctx3, /subagent/);
});

test('sessions are isolated', () => {
  const dir = freshDir();
  run('on-failure.js', failure('a'), dir);
  assert.equal(run('on-failure.js', failure('b', { session_id: 'sess-2' }), dir), null);
});

test('interrupts are ignored', () => {
  const dir = freshDir();
  run('on-failure.js', failure('a'), dir);
  assert.equal(run('on-failure.js', failure('b', { is_interrupt: true }), dir), null);
});

test('malformed stdin exits 0 with no output', () => {
  assert.equal(run('on-failure.js', 'not json{', freshDir()), null);
  assert.equal(run('on-edit.js', '', freshDir()), null);
});

test('path traversal in session_id stays inside the data dir', () => {
  const dir = freshDir();
  run('on-failure.js', failure('a', { session_id: '../../evil' }), dir);
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^[A-Za-z0-9_-]+\.json$/);
});

test('corrupt state file is replaced, not fatal', () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, 'sess-1.json'), '{broken');
  assert.equal(run('on-failure.js', failure('a'), dir), null);
  assert.ok(run('on-failure.js', failure('b'), dir));
});

test('GROUNDHOG_DISABLE=1 turns hooks off', () => {
  const dir = freshDir();
  run('on-failure.js', failure('a'), dir, { GROUNDHOG_DISABLE: '1' });
  assert.equal(run('on-failure.js', failure('b'), dir, { GROUNDHOG_DISABLE: '1' }), null);
});

test('thresholds are configurable', () => {
  const dir = freshDir();
  const env = { GROUNDHOG_WARN_AT: '3', GROUNDHOG_STOP_AT: '4' };
  run('on-failure.js', failure('a'), dir, env);
  assert.equal(run('on-failure.js', failure('b'), dir, env), null);
  assert.match(run('on-failure.js', failure('c'), dir, env).hookSpecificOutput.additionalContext, /3rd time/);
});

test('PostToolUse Edit: flags an edit that undoes an earlier one', () => {
  const dir = freshDir();
  const edit = (o, n) => ({
    session_id: 's', hook_event_name: 'PostToolUse', tool_name: 'Edit',
    tool_input: { file_path: '/p/src/app.js', old_string: o, new_string: n },
  });
  assert.equal(run('on-edit.js', edit('a < b', 'a <= b'), dir), null);
  const out = run('on-edit.js', edit('a <= b', 'a < b'), dir);
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(out.hookSpecificOutput.additionalContext, /app\.js/);
  assert.match(out.hookSpecificOutput.additionalContext, /undoes/);
});
