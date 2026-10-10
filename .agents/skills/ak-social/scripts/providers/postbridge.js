'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');

const ID = 'postbridge';
const DEFAULT_BASE = 'https://api.post-bridge.com';
const CHANNELS = ['instagram', 'tiktok', 'youtube', 'x', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'bluesky'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts) {
  return (opts.config && opts.config.social && opts.config.social.postbridge && opts.config.social.postbridge.base_url) || DEFAULT_BASE;
}

async function apiCall(pathname, opts = {}, deps = {}) {
  const env = deps.envMap;
  requireEnv(ID, 'POSTBRIDGE_API_KEY', { env: deps.envResolved });
  return requestJson(ID, `${baseUrl(deps)}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${env.POSTBRIDGE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  // The Post Bridge CLI's `accounts` subcommand suggests a `/accounts` REST
  // path; exact shape is unverified (Scalar-rendered docs). Adjust once the
  // post-bridge-api SDK confirms.
  return apiCall('/accounts', { method: 'GET' }, deps);
}

// Payload shape follows the CLI signatures documented at
// support.post-bridge.com — caption + accounts + optional schedule/media.
function composePayload({ channels, content, mediaUrls = [], scheduleAt = null, accountMap = {} }) {
  return {
    caption: content,
    accounts: channels.map((c) => accountMap[c]).filter(Boolean),
    ...(mediaUrls.length ? { media: mediaUrls } : {}),
    ...(scheduleAt ? { schedule: scheduleAt } : {}),
  };
}

async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const body = composePayload({ ...payload, scheduleAt: null });
  const raw = await apiCall('/post', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('published', raw && (raw.id || raw.postId) || null, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const body = composePayload(payload);
  const raw = await apiCall('/schedule', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('scheduled', raw && (raw.id || raw.postId) || null, raw);
}

function normalizeDeps(opts) {
  const envResolved = opts.env || {};
  const envMap = envResolved.merged || opts.envMap || process.env;
  return {
    fetch: opts.fetch,
    sleep: opts.sleep,
    maxRetries: opts.maxRetries,
    config: opts.config || {},
    env: opts.env,
    envResolved,
    envMap,
  };
}

module.exports = { id: ID, supports, publish, schedule, listAccounts, composePayload, CHANNELS };
