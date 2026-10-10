'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');

const ID = 'zernio';
const EXPERIMENTAL = true;
const DEFAULT_BASE = 'https://zernio.com/api/v1';
const CHANNELS = ['x', 'twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'reddit', 'bluesky', 'threads', 'google_business', 'telegram', 'snapchat', 'whatsapp', 'discord'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts) {
  return (opts.config && opts.config.social && opts.config.social.zernio && opts.config.social.zernio.base_url) || DEFAULT_BASE;
}

async function apiCall(pathname, opts = {}, deps = {}) {
  const env = deps.envMap;
  requireEnv(ID, 'ZERNIO_API_KEY', { env: deps.envResolved });
  return requestJson(ID, `${baseUrl(deps)}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${env.ZERNIO_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  return apiCall('/accounts', { method: 'GET' }, deps);
}

function composePayload({ channels, content, mediaUrls = [], scheduleAt = null, profileId = null }) {
  return {
    ...(profileId ? { profileId } : {}),
    platforms: channels.map((c) => String(c).toLowerCase() === 'x' ? 'twitter' : String(c).toLowerCase()),
    content,
    ...(mediaUrls.length ? { mediaUrls } : {}),
    ...(scheduleAt ? { scheduledAt: scheduleAt } : {}),
  };
}

async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const body = composePayload({ ...payload, scheduleAt: null });
  const raw = await apiCall('/posts', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('published', raw && raw.id, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const body = composePayload(payload);
  const raw = await apiCall('/posts', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('scheduled', raw && raw.id, raw);
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

module.exports = { id: ID, supports, publish, schedule, listAccounts, composePayload, CHANNELS, EXPERIMENTAL };
