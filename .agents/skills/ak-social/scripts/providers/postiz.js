'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');

const ID = 'postiz';
const DEFAULT_BASE = 'https://api.postiz.com/public/v1';
const CHANNELS = ['x', 'twitter', 'bluesky', 'mastodon', 'discord', 'instagram', 'youtube', 'linkedin', 'tiktok', 'reddit', 'facebook', 'pinterest', 'threads', 'slack'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts = {}) {
  return (opts.config && opts.config.social && opts.config.social.postiz && opts.config.social.postiz.base_url) || DEFAULT_BASE;
}

// Postiz docs are ambiguous on the exact Authorization format for the public
// API key. The docs page shows the key as a raw header value; some community
// snippets prepend "Bearer ". We default to the docs-form (raw value) and
// let callers override via POSTIZ_AUTH_STYLE=bearer if their instance rejects
// the raw form. The exact request/response ends up in the ProviderError body
// on 401/403 so a mismatch surfaces cleanly.
function authHeader(env) {
  const key = env.POSTIZ_API_KEY;
  const style = (env.POSTIZ_AUTH_STYLE || 'raw').toLowerCase();
  return style === 'bearer' ? `Bearer ${key}` : key;
}

async function apiCall(pathname, opts = {}, deps = {}) {
  const env = deps.envMap;
  requireEnv(ID, 'POSTIZ_API_KEY', { env: deps.envResolved });
  const url = `${baseUrl(deps)}${pathname}`;
  const headers = {
    'Authorization': authHeader(env),
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  return requestJson(ID, url, { ...opts, headers }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  return apiCall('/integrations', { method: 'GET' }, deps);
}

// Compose the /posts payload. Postiz uses `integrations[]` with per-account
// `id` + settings. Payload here is minimal — real drafting/media wiring
// happens in publish-post.js.
function composePayload({ channels, content, mediaUrls = [], scheduleAt = null, integrations = {} }) {
  const body = {
    type: scheduleAt ? 'schedule' : 'now',
    ...(scheduleAt ? { date: scheduleAt } : {}),
    integrations: channels.map((channel) => ({
      id: integrations[channel] || channel,
      content,
      ...(mediaUrls.length ? { media: mediaUrls } : {}),
    })),
  };
  return body;
}

async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const body = composePayload({ ...payload, scheduleAt: null });
  const raw = await apiCall('/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  }, deps);
  return ok('published', raw && (raw.id || raw.postId) || null, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const body = composePayload(payload);
  const raw = await apiCall('/posts', {
    method: 'POST',
    body: JSON.stringify(body),
  }, deps);
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
