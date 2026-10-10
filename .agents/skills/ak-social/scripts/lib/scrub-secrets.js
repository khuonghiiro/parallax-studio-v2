'use strict';

// Redact known secret values from text before it flows into stdout, stderr,
// logs, or serialized error results. The env resolver is the authority on
// which values are sensitive — we pass its resolved key/value map in.
//
// Intent: even if a provider echoes the Authorization header back in an error
// body, or a stack trace picks up an env value, the raw secret must not
// appear in any surface the CLI writes out.

const PLACEHOLDER = '[redacted]';

// Any resolved env value shorter than this is skipped — otherwise short/common
// values (e.g. "true", numeric ports) match aggressively and mangle output.
const MIN_SECRET_LEN = 6;

function buildScrubber(envMap = {}) {
  const secrets = new Set();
  for (const value of Object.values(envMap || {})) {
    if (typeof value !== 'string') continue;
    if (value.length < MIN_SECRET_LEN) continue;
    secrets.add(value);
  }
  // Longest first so overlapping values don't leave prefixes behind.
  const ordered = [...secrets].sort((a, b) => b.length - a.length);

  return function scrub(input) {
    if (input == null) return input;
    if (typeof input === 'string') return replaceAll(input, ordered);
    if (Array.isArray(input)) return input.map(scrub);
    if (typeof input === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(input)) out[k] = scrub(v);
      return out;
    }
    return input;
  };
}

function replaceAll(text, secrets) {
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join(PLACEHOLDER);
  }
  return out;
}

module.exports = { buildScrubber, PLACEHOLDER };
