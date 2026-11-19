'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { signature } = require('../scripts/lib/signature');

test('same error through different paths and line numbers gives one signature', () => {
  const a = signature("Exit code 1\nError: Cannot find module '/home/a/proj/src/db.js'\n    at line 12");
  const b = signature("Exit code 1\nError: Cannot find module 'C:\\work\\other\\src\\db.js'\n    at line 98");
  assert.equal(a, b);
  assert.match(a, /Cannot find module/);
  assert.match(a, /<path>/);
});

test('paths with spaces leave no fragments behind', () => {
  const s = signature('Error: isolated in C:\\Users\\me\\My Projects\\ClientCo\\.wt\\agent-1, cannot run');
  assert.doesNotMatch(s, /ClientCo|Projects|\\/);
  assert.match(s, /cannot run/);
  assert.doesNotMatch(signature('Error: open /home/me/My Docs/secret-client/a.txt failed'), /secret-client/);
});

test('different errors give different signatures', () => {
  assert.notEqual(
    signature("Error: Cannot find module 'express'"),
    signature("Error: Cannot find module 'lodash'"),
  );
});

test('skips the "Exit code N" line and picks the first error-like line', () => {
  assert.equal(signature('Exit code 2\nsome noise\nTypeError: x is not a function'), 'TypeError: x is not a function');
});

test('falls back to first meaningful line when nothing looks like an error', () => {
  assert.equal(signature('Exit code 3\nsegmentation dump 42'), 'segmentation dump <n>');
});

test('normalizes hex, numbers, whitespace and ANSI colors', () => {
  assert.equal(
    signature('\u001b[31mError\u001b[0m at 0x7ffe12 commit a1b2c3d4e5   port 8080'),
    'Error at <hex> commit <hex> port <n>',
  );
});

test('caps length at 120 chars and handles empty or non-string input', () => {
  assert.equal(signature('error ' + 'x'.repeat(500)).length, 120);
  assert.equal(signature(''), '');
  assert.equal(signature(undefined), '');
});
