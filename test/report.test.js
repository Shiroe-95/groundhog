'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { report, format } = require('../scripts/report');

// Synthetic transcripts only: same shape as Claude Code's .jsonl, invented content.
const use = (id, name, input) => JSON.stringify({ message: { content: [{ type: 'tool_use', id, name, input }] } });
const res = (id, content, isError = true) =>
  JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content }] } });

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groundhog-report-'));
  fs.mkdirSync(path.join(dir, 'proj-a'));
  fs.mkdirSync(path.join(dir, 'proj-b'));
  const err = (n) => `Exit code 1\nError: Cannot find module './db' at /home/u/app/src/x${n}.js:${n}`;
  fs.writeFileSync(path.join(dir, 'proj-a', 's1.jsonl'), [
    use('t1', 'Bash', { command: 'npm test' }), res('t1', err(1)),
    'this line is not json {',
    use('t2', 'Bash', { command: 'npx jest' }), res('t2', [{ type: 'text', text: err(2) }]),
    use('t3', 'Bash', { command: 'node run.js' }), res('t3', err(3)),
    use('t4', 'Bash', { command: 'ls' }), res('t4', 'ok', false),
    use('e1', 'Edit', { file_path: '/p/a.js', old_string: 'A', new_string: 'B' }),
    use('e2', 'Edit', { file_path: '/p/a.js', old_string: 'B', new_string: 'A' }),
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'proj-b', 's2.jsonl'), [
    use('u1', 'Read', { file_path: '/x' }), res('u1', 'File does not exist.'),
    use('u2', 'Read', { file_path: '/x' }), res('u2', 'File does not exist.'),
    use('u3', 'Read', { file_path: '/x' }), res('u3', 'File does not exist.'),
  ].join('\n'));
  return dir;
}

test('report counts walls, varied vs identical inputs and reverts', async () => {
  const r = await report(fixture());
  assert.equal(r.sessions, 2);
  assert.equal(r.sessionsWithWalls, 2);
  assert.equal(r.walls, 2);
  assert.equal(r.callsInWalls, 6);
  assert.equal(r.varied, 1);
  assert.equal(r.identical, 1);
  assert.equal(r.reverts, 1);
  assert.equal(r.top[0].tool, 'Bash');
  assert.match(r.top[0].sig, /Cannot find module/);
});

test('report never leaks paths or project names', async () => {
  const r = await report(fixture());
  const text = format(r, 'en') + JSON.stringify(r);
  assert.doesNotMatch(text, /proj-a|proj-b|\/home\/u/);
});

test('report rejects a missing directory instead of reporting zero', async () => {
  await assert.rejects(report(path.join(os.tmpdir(), 'groundhog-does-not-exist-xyz')), { code: 'ENOENT' });
});

test('report in Spanish says no walls on an empty folder', async () => {
  const r = await report(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-empty-')));
  assert.equal(r.sessions, 0);
  assert.match(format(r, 'es'), /No hay muros/);
});

test('CLI prints Spanish text and JSON', () => {
  const dir = fixture();
  const cli = path.join(__dirname, '..', 'scripts', 'report.js');
  const es = spawnSync(process.execPath, [cli, '--dir', dir, '--lang', 'es'], { encoding: 'utf8' });
  assert.equal(es.status, 0);
  assert.match(es.stdout, /Sesiones revisadas: 2/);
  const js = spawnSync(process.execPath, [cli, '--dir', dir, '--json'], { encoding: 'utf8' });
  assert.equal(JSON.parse(js.stdout).walls, 2);
});
