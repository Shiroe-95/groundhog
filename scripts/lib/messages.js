'use strict';

const path = require('node:path');

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const tried = (attempts) => attempts.map((a, i) => `  ${i + 1}. ${a || '(no input)'}`).join('\n');

function wallMessage(hit, cfg) {
  const head =
    `groundhog: this is the ${ordinal(hit.count)} time this session that ${hit.tool} failed ` +
    `with the same error signature:\n  "${hit.sig}"\nRecent attempts:\n${tried(hit.attempts)}\n`;
  if (hit.count < cfg.stopAt) {
    return head +
      'The input changed but the error did not, so the cause is probably not what the last attempt changed. ' +
      'Before the next retry, write one sentence with a new hypothesis that explains every failure above, ' +
      'and the cheapest check that would prove it wrong. Then run that check.';
  }
  return head +
    'Stop retrying variations: this is a wall, not bad luck. Pick one:\n' +
    '  a) Read the full error and the exact code or config it points at, then state the root cause.\n' +
    '  b) Hand the problem to a fresh-context subagent with only the goal, the error and the attempts above.\n' +
    '  c) Ask the user. Show them the signature and what you tried.\n' +
    'The groundhog:unstick skill has the full protocol.';
}

function revertMessage(file, reverts) {
  const name = path.basename(String(file));
  return `groundhog: this edit undoes an earlier edit to ${name} in this session ` +
    `(back-and-forth #${reverts}). You are oscillating between two versions. ` +
    'Before touching this file again, decide which version is correct and cite the evidence ' +
    '(test output, docs, the caller that needs it).';
}

module.exports = { wallMessage, revertMessage, ordinal };
