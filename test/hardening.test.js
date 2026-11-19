'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { signature } = require('../scripts/lib/signature');
const { summarizeInput } = require('../scripts/lib/detect');
const { load, save, pruneOld } = require('../scripts/lib/state');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gh-hard-'));

test('signature stays fast on a huge line with no spaces', () => {
  const t0 = Date.now();
  signature('Error: bundle failed ' + 'x'.repeat(200000));
  assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0} ms`);
});

test('signature masks secrets and identities', () => {
  const cases = [
    'Error: invalid api key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWx',
    'Error: bad token ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'Error: login failed for jane.doe@acme-corp.com',
    'Error: request to https://user:pw@internal.acme.io/v1?token=abc failed',
    'Error: auth failed password=Hunter2xyz',
    'Error: connect ECONNREFUSED db.acme-internal.local',
    "Error: EACCES C:\\Users\\Jane Doe\\Merger Plan\\x.txt",
    'Error: EACCES C:/Users/jane doe/merger plan/x.txt',
    'Error: EACCES /home/jane doe/merger plan/x.txt',
    'Error: cannot read ~jane config',
  ];
  for (const c of cases) {
    const s = signature(c);
    assert.doesNotMatch(s, /AbCdEf|ghp_|jane|acme|Hunter|Merger|Doe|user:pw/i, `${c} -> ${s}`);
  }
});

test('signature keeps error class names that look like key=value', () => {
  assert.match(signature("KeyError: 'name'"), /^KeyError: /);
});

test('command summaries stored in state are masked', () => {
  const s = summarizeInput('Bash', { command: 'curl -H "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123" https://x.io' });
  assert.doesNotMatch(s, /ghp_|x\.io/);
});

test('state with valid shape but bad contents starts fresh', () => {
  const dir = tmp();
  const f = path.join(dir, 's.json');
  for (const bad of [
    { v: 1, walls: 'x', edits: 'y' },
    { v: 1, walls: [], edits: [] },
    { v: 1, walls: { k: { count: '7', attempts: 'zz' } }, edits: {} },
  ]) {
    fs.writeFileSync(f, JSON.stringify(bad));
    assert.deepStrictEqual(load(f), { v: 1, walls: {}, edits: {} });
  }
});

test('prune removes stale temp files too', () => {
  const dir = tmp();
  const old = path.join(dir, 'old.json.999.tmp');
  fs.writeFileSync(old, '{}');
  const past = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  fs.utimesSync(old, past, past);
  save(path.join(dir, 'new.json'), { v: 1, walls: {}, edits: {} });
  pruneOld(dir);
  assert.ok(!fs.existsSync(old));
});

test('report fails loudly on a missing folder', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'report.js'), '--dir', path.join(tmp(), 'nope')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /cannot read transcripts folder/);
  assert.strictEqual(r.stdout, '');
});

test('report masks MCP server names and quoted or CamelCase names', () => {
  const dir = tmp();
  const lines = [];
  for (let i = 0; i < 3; i++) {
    lines.push(JSON.stringify({ message: { content: [{ type: 'tool_use', id: `a${i}`, name: 'mcp__acme-crm__query', input: { query: `q${i}` } }] } }));
    lines.push(JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: `a${i}`, is_error: true, content: "Error: Project AcmeSecretApp not found in 'Merger Plan'" }] } }));
  }
  fs.writeFileSync(path.join(dir, 's.jsonl'), lines.join('\n'));
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'report.js'), '--dir', dir], { encoding: 'utf8' });
  assert.match(out, /\[mcp\]/);
  assert.doesNotMatch(out, /acme|Merger/i);
});
