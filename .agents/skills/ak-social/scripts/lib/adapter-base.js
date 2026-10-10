'use strict';

const { AuthError } = require('./errors');

// Shared adapter helpers. Each provider file exports:
//   { id, supports(channel), publish(payload, opts), schedule(payload, opts), listAccounts(opts) }
// Returned envelope on success:
//   { status: 'published' | 'scheduled' | 'pending', providerRef, raw }

function requireEnv(providerId, envVar, opts = {}) {
  const env = (opts.env && opts.env.merged) || opts.env || process.env;
  const value = env[envVar];
  if (!value) {
    const paths = (opts.env && opts.env.loadedFrom) || [];
    throw new AuthError(providerId, envVar, paths);
  }
  return value;
}

function ok(status, providerRef, raw) {
  return { status, providerRef: providerRef || null, raw: raw || null };
}

function buildScheduleType(scheduleAt) {
  if (!scheduleAt) return { type: 'now' };
  return { type: 'schedule', scheduleAt };
}

module.exports = { requireEnv, ok, buildScheduleType };
