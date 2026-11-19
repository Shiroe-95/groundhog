'use strict';

const fs = require('node:fs');

const MAX_STDIN = 5 * 1024 * 1024;

// Reads the hook payload from stdin. Returns null on anything unexpected.
function readPayload() {
  try {
    const buf = fs.readFileSync(0);
    if (buf.length > MAX_STDIN) return null;
    const data = JSON.parse(buf.toString('utf8'));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function emit(eventName, text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: eventName, additionalContext: text },
  }));
}

function intEnv(env, name, fallback, min, max) {
  const n = Number.parseInt(env[name], 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function config(env = process.env) {
  const warnAt = intEnv(env, 'GROUNDHOG_WARN_AT', 2, 2, 20);
  const stopAt = Math.max(intEnv(env, 'GROUNDHOG_STOP_AT', 3, 2, 50), warnAt);
  return { disabled: env.GROUNDHOG_DISABLE === '1', warnAt, stopAt };
}

module.exports = { readPayload, emit, config };
