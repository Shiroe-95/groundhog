#!/usr/bin/env node
'use strict';

// PostToolUse hook for Edit: flags an edit that undoes an earlier edit (A -> B -> A),
// and repeated rewrites of lines written earlier in the session.

const { readPayload, emit, config } = require('./lib/hookio');
const { stateDir, sessionFile, load, save } = require('./lib/state');
const { recordEdit } = require('./lib/detect');
const { revertMessage, reworkMessage } = require('./lib/messages');

try {
  const cfg = config();
  const p = readPayload();
  const input = p && p.tool_input;
  if (!cfg.disabled && input && typeof input.file_path === 'string' &&
      typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    const file = sessionFile(stateDir(), p.session_id);
    const state = load(file);
    const r = recordEdit(state, { file: input.file_path, oldStr: input.old_string, newStr: input.new_string });
    save(file, state);
    if (r && r.reverts) emit('PostToolUse', revertMessage(input.file_path, r.reverts));
    else if (r && r.rework) emit('PostToolUse', reworkMessage(input.file_path, r.rework));
  }
} catch {
  // Never break the user's session because of this hook.
}
process.exitCode = 0;
