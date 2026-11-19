'use strict';

const path = require('node:path');

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const tried = (attempts) => attempts.map((a, i) => `  ${i + 1}. ${a || '(no input)'}`).join('\n');

const OWN_PROCESS = 'If you have your own debugging skill or process, use it';

function wallMessage(hit, cfg) {
  const head =
    `groundhog: this is the ${ordinal(hit.count)} time this session that ${hit.tool} failed ` +
    `with the same error signature:\n  "${hit.sig}"\nRecent attempts:\n${tried(hit.attempts)}\n`;
  const editHint = hit.tool === 'Edit'
    ? 'Edit failures usually mean the file no longer matches what you remember: re-read the file before the next Edit.\n'
    : '';
  if (hit.count < cfg.stopAt) {
    return head + editHint +
      (hit.changed
        ? 'The input changed but the error did not, so the cause is probably not what the last attempt changed. '
        : 'The same call failed the same way again, so repeating it will not help. ') +
      'Before the next retry:\n' +
      '  1. Write one sentence with a new hypothesis that explains every failure above.\n' +
      '  2. Pick the cheapest check that could prove it wrong, and predict what it will print.\n' +
      '  3. Run it and quote the line of output that confirms or kills the hypothesis.\n' +
      `${OWN_PROCESS} for these steps.`;
  }
  return head + editHint +
    'Stop retrying variations: this is a wall, not bad luck. Pick one:\n' +
    '  a) Read the full error and the exact code or config it points at, then state the root cause.\n' +
    '  b) Hand the problem to a fresh-context subagent.\n' +
    '  c) Ask the user.\n' +
    'For b) and c), send a brief, not logs: the goal, the facts you verified (with the command that ' +
    'verified each), the hypotheses you ruled out, and the signature above.\n' +
    `${OWN_PROCESS} now; otherwise the groundhog:unstick skill has the full protocol.`;
}

function revertMessage(file, reverts) {
  const name = path.basename(String(file));
  return `groundhog: this edit undoes an earlier edit to ${name} in this session ` +
    `(back-and-forth #${reverts}). You are oscillating between two versions. ` +
    'Before touching this file again, decide which version is correct and cite the evidence ' +
    '(test output, docs, the caller that needs it).';
}

function reworkMessage(file, times) {
  const name = path.basename(String(file));
  return `groundhog: you have rewritten lines you wrote earlier in ${name} ${times} times this session. ` +
    'Editing the same spot again and again usually means each change is a guess. ' +
    'Before the next edit to this file, run the check that shows whether the last change worked, ' +
    'and say what it printed.';
}

module.exports = { wallMessage, revertMessage, reworkMessage, ordinal };
