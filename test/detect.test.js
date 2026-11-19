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
