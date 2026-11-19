'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { wallMessage, reworkMessage } = require('../scripts/lib/messages');

const cfg = { warnAt: 2, stopAt: 3 };
const hit = (count, extra = {}) => ({ tool: 'Bash', sig: 'Error: boom', count, attempts: ['a', 'b', 'c'].slice(0, count), changed: true, ...extra });

test('2nd hit asks for a hypothesis, a prediction and an executed check', () => {
  const m = wallMessage(hit(2), cfg);
  assert.match(m, /hypothesis/);
  assert.match(m, /predict/i);
  assert.match(m, /quote/i);
  assert.match(m, /your own debugging skill/);
  assert.match(m, /input changed/);
});

test('identical retries are described as identical', () => {
  const m = wallMessage(hit(2, { attempts: ['npm test', 'npm test'], changed: false }), cfg);
  assert.match(m, /same call/);
  assert.doesNotMatch(m, /input changed/);
});

test('3rd hit stops and asks for a brief, not logs', () => {
  const m = wallMessage(hit(3), cfg);
  assert.match(m, /Stop/);
  assert.match(m, /subagent/);
  assert.match(m, /goal/);
  assert.match(m, /ruled out/);
  assert.match(m, /not logs/);
  assert.match(m, /your own debugging skill/);
  assert.match(m, /groundhog:unstick/);
});

test('Edit failures get a re-read hint', () => {
  assert.match(wallMessage(hit(2, { tool: 'Edit' }), cfg), /[Rr]e-read the file/);
  assert.doesNotMatch(wallMessage(hit(2), cfg), /[Rr]e-read the file/);
});

test('rework note names the file and asks for evidence first', () => {
  const m = reworkMessage('/p/src/parser.js', 3);
  assert.match(m, /parser\.js/);
  assert.doesNotMatch(m, /\/p\/src/);
  assert.match(m, /3 times/);
});
