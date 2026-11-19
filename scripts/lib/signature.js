'use strict';

// Turns raw error output into a stable "wall" signature: the same underlying
// failure reached through different commands, files or line numbers maps to
// the same string.

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const EXIT_LINE = /^exit code -?\d+$/i;
const ERRORISH = /error|fail|not found|denied|cannot|invalid|exception/i;
// Normalizers are not linear on long tokens, so the line is cut first.
const MAX_SCAN = 1000;
const MAX_LEN = 120;

// Secrets and identities: never meaningful for grouping, never safe to print or store.
const SECRETS = [
  [/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>'],
  [/\b(\w*(?:password|passwd|pass|pwd|secret|token|key|auth))\s*[=:]\s*\S+/gi, '$1=<secret>'],
  [/\b(?:sk|ghp|gho|ghs|ghu|xox[abp]|AKIA|eyJ)[A-Za-z0-9._-]{8,}/g, '<token>'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<hex>'],
  [/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{20,}\b/g, '<token>'],
];

const NORMALIZERS = [
  ...SECRETS,
  [/[A-Za-z]:[\\/][^\s"'`]+|(?<![\w.-])\/[\w./-]{3,}|(?<!\S)~[\w.-]*/g, '<path>'],
  // Paths with spaces split into pieces: any leftover token with a slash is a path piece,
  // and short runs of words between two path pieces, or capitalized words right after one,
  // are folder names. Neither may leak.
  [/[^\s"'`]*[\\/][^\s"'`]*/g, '<path>'],
  [/<path>(?: \S+){0,2} <path>/g, '<path>'],
  [/<path>(?: [A-Z][\w-]*)+/g, '<path>'],
  [/\b[a-z0-9-]+(?:\.[a-z0-9-]+){2,}\b/gi, '<host>'],
  [/0x[0-9a-f]+|\b[0-9a-f]{7,}\b/gi, '<hex>'],
  [/\d+/g, '<n>'],
  [/\s+/g, ' '],
];

const apply = (rules, s) => rules.reduce((acc, [re, rep]) => acc.replace(re, rep), s);

function redactSecrets(text) {
  return apply(SECRETS, String(text).slice(0, MAX_SCAN));
}

function signature(text) {
  if (typeof text !== 'string' || !text) return '';
  const lines = text
    .slice(0, 64 * 1024)
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !EXIT_LINE.test(l));
  const line = (lines.find((l) => ERRORISH.test(l)) || lines[0] || '').slice(0, MAX_SCAN);
  return apply(NORMALIZERS, line).trim().slice(0, MAX_LEN);
}

module.exports = { signature, redactSecrets };
