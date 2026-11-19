'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newState, recordFailure, recordEdit, summarizeInput } = require('../scripts/lib/detect');

const fail = (state, command, error = "Exit code 1\nError: Cannot find module './db'") =>
  recordFailure(state, { tool: 'Bash', input: { command }, error });

test('counts the same wall across different commands', () => {
  const s = newState();
  assert.equal(fail(s, 'npm test').count, 1);
  assert.equal(fail(s, 'npx jest').count, 2);
  const hit = fail(s, 'node test/run.js');
  assert.equal(hit.count, 3);
  assert.deepEqual(hit.attempts, ['npm test', 'npx jest', 'node test/run.js']);
});

test('different tools hitting the same text are different walls', () => {
  const s = newState();
  fail(s, 'npm test');
  const r = recordFailure(s, { tool: 'Read', input: { file_path: 'x' }, error: "Error: Cannot find module './db'" });
  assert.equal(r.count, 1);
});

test('keeps only the last 5 attempts', () => {
  const s = newState();
  let hit;
  for (let i = 0; i < 8; i++) hit = fail(s, `cmd ${i}`);
  assert.equal(hit.count, 8);
  assert.deepEqual(hit.attempts, ['cmd 3', 'cmd 4', 'cmd 5', 'cmd 6', 'cmd 7']);
});

test('ignores failures with no usable signature', () => {
  assert.equal(recordFailure(newState(), { tool: 'Bash', input: {}, error: '' }), null);
});

test('detects an edit that reverts an earlier edit on the same file', () => {
  const s = newState();
  assert.equal(recordEdit(s, { file: '/p/a.js', oldStr: 'A', newStr: 'B' }), null);
  assert.equal(recordEdit(s, { file: '/p/b.js', oldStr: 'B', newStr: 'A' }), null);
  assert.deepEqual(recordEdit(s, { file: '/p/A.js', oldStr: 'B', newStr: 'A' }), { reverts: 1 });
  // re-applying A -> B undoes the revert, so it counts too
  assert.deepEqual(recordEdit(s, { file: '/p/a.js', oldStr: 'A', newStr: 'B' }), { reverts: 2 });
  assert.deepEqual(recordEdit(s, { file: '/p/a.js', oldStr: 'B', newStr: 'A' }), { reverts: 3 });
});

test('state stores hashes, not edit contents', () => {
  const s = newState();
  recordEdit(s, { file: '/p/a.js', oldStr: 'SECRET_OLD', newStr: 'SECRET_NEW' });
  assert.doesNotMatch(JSON.stringify(s), /SECRET/);
});

test('summarizeInput keeps one short line per tool', () => {
  assert.equal(summarizeInput('Bash', { command: 'a\nb' }), 'a b');
  assert.equal(summarizeInput('Read', { file_path: '/x/y.txt' }), '/x/y.txt');
  assert.equal(summarizeInput('Bash', { command: 'z'.repeat(300) }).length, 100);
  assert.equal(summarizeInput('Other', null), '');
});

test('near-duplicate errors from the same tool join one wall', () => {
  const s = newState();
  const err = (ws) => `Error: Command failed with exit code 2: npm run build --workspace ${ws}`;
  fail(s, 'npm run build -w web', err('web'));
  const hit = fail(s, 'npm run build -w api', err('api'));
  assert.equal(hit.count, 2);
  assert.match(hit.sig, /--workspace web$/);
});

test('errors that only share a few words stay separate', () => {
  const s = newState();
  fail(s, 'a', "Error: Cannot find module 'lodash'");
  assert.equal(fail(s, 'b', "Error: Cannot find module 'express'").count, 1);
  fail(s, 'e', 'TypeError: x.map is not a function');
  assert.equal(fail(s, 'f', 'TypeError: y.filter is not a function').count, 1);
  assert.equal(fail(s, 'c', 'Error: boom').count, 1);
  assert.equal(fail(s, 'd', 'Error: bang').count, 1);
});

test('test progress resets the wall', () => {
  const s = newState();
  const err = (n) => `Exit code 1\nTests: 2 failed, ${n} passed, 12 total`;
  fail(s, 'npm test', err(8));
  assert.equal(fail(s, 'npm test', err(8)).count, 2);
  const hit = fail(s, 'npm test', err(9));
  assert.equal(hit.count, 1);
  assert.deepEqual(hit.attempts, ['npm test']);
  assert.equal(fail(s, 'npm test', err(9)).count, 2);
});

const v = (n) => `  const limit = computeLimit(${n});\n  return limit;`;

test('flags edit, fail, re-edit of the same lines', () => {
  const s = newState();
  const file = '/p/parser.js';
  assert.equal(recordEdit(s, { file, oldStr: 'const x = 1;', newStr: v(1) }), null);
  for (let i = 1; i <= 2; i++) {
    fail(s, 'npm test', `Error: case ${i} broke`);
    assert.equal(recordEdit(s, { file, oldStr: v(i), newStr: v(i + 1) }), null);
  }
  fail(s, 'npm test', 'Error: case 3 broke');
  assert.deepEqual(recordEdit(s, { file, oldStr: v(3), newStr: v(4) }), { rework: 3 });
  fail(s, 'npm test', 'Error: case 4 broke');
  assert.equal(recordEdit(s, { file, oldStr: v(4), newStr: v(5) }), null);
  assert.doesNotMatch(JSON.stringify(s), /computeLimit/);
});

test('rewriting your own lines with no failure in between is normal work', () => {
  const s = newState();
  for (let i = 1; i <= 6; i++) assert.equal(recordEdit(s, { file: '/p/a.js', oldStr: v(i), newStr: v(i + 1) }), null);
});

test('editing lines nobody wrote this session is not rework', () => {
  const s = newState();
  for (let i = 0; i < 6; i++) {
    fail(s, 'npm test');
    assert.equal(recordEdit(s, { file: '/p/a.js', oldStr: `original line number ${i}`, newStr: `changed line number ${i}` }), null);
  }
});

test('trivial lines like closing braces do not count as rework', () => {
  const s = newState();
  for (let i = 0; i < 6; i++) {
    fail(s, 'npm test');
    assert.equal(recordEdit(s, { file: '/p/a.js', oldStr: `}\n);\nfoo${i}`, newStr: `}\n);\nbar${i}` }), null);
  }
});

test('input change is judged on the full input, not the summary', () => {
  const s = newState();
  const q = (sql) => recordFailure(s, { tool: 'mcp__db__query', input: { sql }, error: 'Error: relation "users" does not exist' });
  q('select * from users');
  const hit = q('select * from public.users');
  assert.equal(hit.changed, true);
  assert.equal(hit.attempts[1], 'select * from public.users');
  assert.equal(q('select * from public.users').changed, false);
});

test('progress reset reads the tests line, not the suites line', () => {
  const s = newState();
  const jest = (n) => `Exit code 1\nTest Suites: 1 failed, 3 passed, 4 total\nTests:       2 failed, ${n} passed, ${n + 2} total`;
  fail(s, 'npm test', jest(40));
  assert.equal(fail(s, 'npm test', jest(40)).count, 2);
  assert.equal(fail(s, 'npm test', jest(41)).count, 1);
});

test('"passed" outside a test summary is not progress', () => {
  const s = newState();
  const php = (n) => `PHP Fatal error: Argument ${n} passed to foo() must be of type int`;
  fail(s, 'php a.php', php(1));
  assert.equal(fail(s, 'php a.php', php(2)).count, 2);
  assert.equal(fail(s, 'php a.php', php(3)).count, 3);
});

test('edit tracking keeps at most 100 files', () => {
  const s = newState();
  for (let i = 0; i < 150; i++) recordEdit(s, { file: `/p/f${i}.js`, oldStr: 'a', newStr: 'b' });
  assert.equal(Object.keys(s.edits).length, 100);
});
