#!/usr/bin/env node
'use strict';

// PostToolUseFailure hook: counts how often the same error signature comes back
// in a session, and nudges Claude with evidence when it does.

const { readPayload, emit, config } = require('./lib/hookio');
const { stateDir, sessionFile, load, save } = require('./lib/state');
const { recordFailure } = require('./lib/detect');
const { wallMessage } = require('./lib/messages');

try {
  const cfg = config();
  const p = readPayload();
  if (!cfg.disabled && p && !p.is_interrupt && typeof p.error === 'string' && p.tool_name) {
    const file = sessionFile(stateDir(), p.session_id);
    const state = load(file);
    const hit = recordFailure(state, { tool: String(p.tool_name), input: p.tool_input, error: p.error });
    save(file, state);
    if (hit && hit.count >= cfg.warnAt) emit('PostToolUseFailure', wallMessage(hit, cfg));
  }
} catch {
  // Never break the user's session because of this hook.
}
process.exitCode = 0;
