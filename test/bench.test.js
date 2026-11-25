'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { replay, format } = require('../bench/replay');

// Synthetic transcript: one wall hit 4 times with different commands, one success.
const use = (id, input) => JSON.stringify({ message: { content: [{ type: 'tool_use', id, name: 'Bash', input }] } });
const res = (id, content, isError = true) =>
  JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content }] } });

test('replay counts failed calls made after each note would fire', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundhog-bench-'));
  const err = 'Exit code 1\nError: Cannot find module ./db'; // 42 chars -> 11 tokens
  const lines = [];
  for (let i = 1; i <= 4; i++) lines.push(use(`t${i}`, { command: `try ${i}` }), res(`t${i}`, err));
  lines.push(use('ok', { command: 'ls' }), res('ok', 'fine', false));
  fs.writeFileSync(path.join(dir, 's.jsonl'), lines.join('\n'));

  const r = await replay(dir);
  assert.equal(r.sessions, 1);
  assert.equal(r.toolResults, 5);
  assert.equal(r.failedResults, 4);
  assert.deepEqual(r.notes, { warn: 1, stop: 2, revert: 0, rework: 0 });
  assert.equal(r.sessionsWithNotes, 1);
  assert.deepEqual(r.afterWarn, { calls: 2, tokens: 22 });
  assert.deepEqual(r.afterStop, { calls: 1, tokens: 11 });
  assert.match(format(r), /not an A\/B test/);
  assert.doesNotMatch(format(r), /Cannot find|try \d/);
});

test('replay does not escalate when the TAP passing count improves', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundhog-progress-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const lines = [];
  for (const [i, n] of [10, 10, 11].entries()) {
    const id = `t${i}`;
    lines.push(use(id, { command: 'node --test' }), res(id, `# tests 12\n# pass ${n}\n# fail ${12 - n}`));
  }
  fs.writeFileSync(path.join(dir, 's.jsonl'), lines.join('\n'));
  const r = await replay(dir);
  assert.deepEqual(r.notes, { warn: 1, stop: 0, revert: 0, rework: 0 });
  assert.equal(r.afterWarn.calls, 0);
});
