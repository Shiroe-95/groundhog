#!/usr/bin/env node
'use strict';

// Scans local Claude Code transcripts and reports the walls groundhog would have caught.
// Reads only; prints normalized error signatures, never file contents or project names.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { newState, recordFailure, recordEdit } = require('./lib/detect');

const WALL_AT = 3;
const TOP = 10;

const TEXT = {
  en: {
    title: 'groundhog report',
    sessions: 'Sessions scanned',
    withWalls: 'Sessions that hit a wall',
    walls: 'Walls (same error 3+ times in a session)',
    calls: 'Failed calls spent inside walls',
    varied: 'Walls where the input kept changing',
    identical: 'Walls with identical retries',
    reverts: 'Edits that undid an earlier edit',
    top: 'Most common walls',
    none: 'No walls found. Nice.',
    sessionsCol: 'sessions',
  },
  es: {
    title: 'informe de groundhog',
    sessions: 'Sesiones revisadas',
    withWalls: 'Sesiones que chocaron con un muro',
    walls: 'Muros (mismo error 3+ veces en una sesión)',
    calls: 'Llamadas fallidas gastadas en muros',
    varied: 'Muros donde la entrada iba cambiando',
    identical: 'Muros con reintentos idénticos',
    reverts: 'Ediciones que deshicieron una edición anterior',
    top: 'Muros más frecuentes',
    none: 'No hay muros. Bien.',
    sessionsCol: 'sesiones',
  },
};

function parseArgs(argv) {
  const opts = { dir: path.join(os.homedir(), '.claude', 'projects'), json: false, lang: 'en' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '--lang') opts.lang = argv[++i] === 'es' ? 'es' : 'en';
  }
  return opts;
}

const resultText = (content) =>
  typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).join('\n')
      : '';

async function scanFile(file) {
  const state = newState();
  const pending = new Map();
  let reverts = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const content = o && o.message && o.message.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (!c || typeof c !== 'object') continue;
      if (c.type === 'tool_use') {
        const input = c.input && typeof c.input === 'object' ? c.input : {};
        pending.set(c.id, { tool: String(c.name || ''), input });
        if (c.name === 'Edit' && typeof input.file_path === 'string' &&
            typeof input.old_string === 'string' && typeof input.new_string === 'string') {
          if (recordEdit(state, { file: input.file_path, oldStr: input.old_string, newStr: input.new_string })) reverts++;
        }
      } else if (c.type === 'tool_result') {
        const call = pending.get(c.tool_use_id);
        pending.delete(c.tool_use_id);
        if (call && c.is_error) recordFailure(state, { tool: call.tool, input: call.input, error: resultText(c.content) });
      }
    }
  }
  return { state, reverts };
}

// Throws when dir is missing so a typo never reads as "no walls".
function listTranscripts(dir) {
  return fs.readdirSync(dir, { recursive: true })
    .filter((f) => String(f).endsWith('.jsonl'))
    .map((f) => path.join(dir, String(f)));
}

// Extra redaction for output people share: quoted names, CamelCase identifiers
// (error class names stay), and MCP server names.
const shareable = (sig) => sig
  .replace(/(['"`])(?!<)[^'"`]{1,80}\1/g, '$1<name>$1')
  .replace(/\b(?![A-Z]\w*(?:Error|Exception|Warning)\b)[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+\b/g, '<name>');
const shareableTool = (tool) => (tool.startsWith('mcp__') ? 'mcp' : tool);

async function report(dir) {
  const out = { sessions: 0, sessionsWithWalls: 0, walls: 0, callsInWalls: 0, varied: 0, identical: 0, reverts: 0, top: [] };
  const bySig = new Map();
  for (const file of listTranscripts(dir)) {
    let r;
    try { r = await scanFile(file); } catch { continue; }
    out.sessions++;
    out.reverts += r.reverts;
    let hit = false;
    for (const [key, wall] of Object.entries(r.state.walls)) {
      if (wall.count < WALL_AT) continue;
      hit = true;
      out.walls++;
      out.callsInWalls += wall.count;
      if (new Set(wall.attempts).size > 1) out.varied++; else out.identical++;
      const [tool, sig] = key.split('\u0000');
      const shown = `${shareableTool(tool)}\u0000${shareable(sig)}`;
      const agg = bySig.get(shown) || { tool: shareableTool(tool), sig: shareable(sig), sessions: 0, calls: 0 };
      agg.sessions++;
      agg.calls += wall.count;
      bySig.set(shown, agg);
    }
    if (hit) out.sessionsWithWalls++;
  }
  out.top = [...bySig.values()].sort((a, b) => b.sessions - a.sessions || b.calls - a.calls).slice(0, TOP);
  return out;
}

function format(r, lang) {
  const t = TEXT[lang];
  const pct = r.sessions ? ` (${Math.round((100 * r.sessionsWithWalls) / r.sessions)}%)` : '';
  const lines = [
    t.title, '',
    `${t.sessions}: ${r.sessions}`,
    `${t.withWalls}: ${r.sessionsWithWalls}${pct}`,
    `${t.walls}: ${r.walls}`,
    `${t.calls}: ${r.callsInWalls}`,
    `${t.varied}: ${r.varied}`,
    `${t.identical}: ${r.identical}`,
    `${t.reverts}: ${r.reverts}`, '',
  ];
  if (!r.walls) lines.push(t.none);
  else {
    lines.push(`${t.top}:`);
    r.top.forEach((w, i) => lines.push(`  ${i + 1}. [${w.tool}] ${w.sig}  (${w.sessions} ${t.sessionsCol})`));
  }
  return lines.join('\n');
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  report(opts.dir).then((r) => {
    process.stdout.write((opts.json ? JSON.stringify(r, null, 2) : format(r, opts.lang)) + '\n');
  }, (err) => {
    process.stderr.write(`groundhog: cannot read transcripts folder ${JSON.stringify(opts.dir ?? '')}: ${err.code || err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { report, format, parseArgs };
