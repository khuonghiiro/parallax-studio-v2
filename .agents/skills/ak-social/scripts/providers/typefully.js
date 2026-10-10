'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');

const ID = 'typefully';
const DEFAULT_BASE = 'https://api.typefully.com';
const CHANNELS = ['x', 'twitter', 'linkedin', 'threads', 'bluesky', 'mastodon'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts) {
  return (opts.config && opts.config.social && opts.config.social.typefully && opts.config.social.typefully.base_url) || DEFAULT_BASE;
}

function socialSetId(opts) {
  const cfg = (opts.config && opts.config.social && opts.config.social.typefully) || {};
  return opts.socialSetId || cfg.default_social_set_id || '';
}

async function apiCall(pathname, opts = {}, deps = {}) {
  const env = deps.envMap;
  requireEnv(ID, 'TYPEFULLY_API_KEY', { env: deps.envResolved });
  return requestJson(ID, `${baseUrl(deps)}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${env.TYPEFULLY_API_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  return apiCall('/v2/social-sets', { method: 'GET' }, deps);
}

// Typefully v2 draft body: platforms map + optional publish_at ("now" or
// ISO8601). See references/providers/typefully.md.
function composeDraft({ channels, content, scheduleAt = null }) {
  const platforms = {};
  for (const c of channels) {
    const key = String(c).toLowerCase() === 'twitter' ? 'x' : String(c).toLowerCase();
    platforms[key] = { text: content };
  }
  const body = { platforms };
  if (scheduleAt) body.publish_at = scheduleAt;
  else body.publish_at = 'now';
  return body;
}

async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const setId = socialSetId(deps);
  if (!setId) throw new Error(`${ID}: publish requires social_set_id — set social.typefully.default_social_set_id or pass --typefully-social-set`);
  const body = composeDraft({ ...payload, scheduleAt: null });
  body.publish_at = 'now';
  const raw = await apiCall(`/v2/social-sets/${encodeURIComponent(setId)}/drafts`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, deps);
  return ok('published', raw && raw.id, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const setId = socialSetId(deps);
  if (!setId) throw new Error(`${ID}: schedule requires social_set_id — set social.typefully.default_social_set_id or pass --typefully-social-set`);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const body = composeDraft(payload);
  const raw = await apiCall(`/v2/social-sets/${encodeURIComponent(setId)}/drafts`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, deps);
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
    socialSetId: opts.socialSetId,
  };
}

module.exports = { id: ID, supports, publish, schedule, listAccounts, composeDraft, CHANNELS };
