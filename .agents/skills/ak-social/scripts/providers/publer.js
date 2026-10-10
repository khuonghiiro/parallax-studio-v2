'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');
const { ProviderError } = require('../lib/errors');

const ID = 'publer';
const EXPERIMENTAL = true;
const DEFAULT_BASE = 'https://app.publer.com/api/v1';
const CHANNELS = ['facebook', 'instagram', 'x', 'twitter', 'linkedin', 'pinterest', 'youtube', 'tiktok', 'google_business', 'wordpress', 'telegram', 'mastodon', 'threads', 'bluesky'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts) {
  return (opts.config && opts.config.social && opts.config.social.publer && opts.config.social.publer.base_url) || DEFAULT_BASE;
}

function workspaceId(deps) {
  const env = deps.envMap;
  const cfg = (deps.config && deps.config.social && deps.config.social.publer) || {};
  const id = env.PUBLER_WORKSPACE_ID || cfg.workspace_id || '';
  if (!id) throw new Error(`${ID}: workspace_id required — set env PUBLER_WORKSPACE_ID or social.publer.workspace_id in config.yaml`);
  return id;
}

async function apiCall(pathname, opts = {}, deps = {}) {
  const env = deps.envMap;
  requireEnv(ID, 'PUBLER_API_KEY', { env: deps.envResolved });
  const wsId = workspaceId(deps);
  return requestJson(ID, `${baseUrl(deps)}${pathname}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer-API ${env.PUBLER_API_KEY}`,
      'Publer-Workspace-Id': wsId,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  // The public docs I reviewed didn't document a top-level accounts endpoint;
  // /posts?state=scheduled is a workable fallback for existence checks. Users
  // typically know their account IDs from the Publer dashboard.
  return apiCall('/posts?state=scheduled&page=1', { method: 'GET' }, deps);
}

function composePayload({ channels, content, mediaUrls = [], scheduleAt = null, accountIds = [] }) {
  const post = {
    networks: {},
    accounts: (accountIds.length ? accountIds : channels.map((c) => ({ id: c })))
      .map((a) => typeof a === 'string' ? { id: a } : a)
      .map((a) => ({ ...a, ...(scheduleAt ? { scheduled_at: scheduleAt } : {}) })),
  };
  for (const c of channels) {
    const key = String(c).toLowerCase() === 'x' ? 'twitter' : String(c).toLowerCase();
    post.networks[key] = { type: 'status', text: content, ...(mediaUrls.length ? { media: mediaUrls } : {}) };
  }
  return { bulk: { state: scheduleAt ? 'scheduled' : 'published', posts: [post] } };
}

// Publer scheduling is async; the initial POST returns a job id. Callers may
// poll `/job_status/{id}` via pollJobStatus below.
async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const body = composePayload({ ...payload, scheduleAt: null });
  const raw = await apiCall('/posts/schedule/publish', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('pending', raw && (raw.job_id || raw.id) || null, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const body = composePayload(payload);
  const raw = await apiCall('/posts/schedule', { method: 'POST', body: JSON.stringify(body) }, deps);
  return ok('pending', raw && (raw.job_id || raw.id) || null, raw);
}

async function pollJobStatus(jobId, opts = {}) {
  const deps = normalizeDeps(opts);
  const maxTries = opts.maxTries || 10;
  const delayMs = opts.delayMs || 1500;
  for (let i = 0; i < maxTries; i += 1) {
    const raw = await apiCall(`/job_status/${encodeURIComponent(jobId)}`, { method: 'GET' }, deps);
    if (raw && (raw.status === 'completed' || raw.status === 'success')) return ok('scheduled', jobId, raw);
    if (raw && raw.status === 'failed') throw new ProviderError(ID, `/job_status/${jobId}`, 200, raw);
    if (i < maxTries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return ok('pending', jobId, { hint: 'poll timeout — check dashboard' });
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

module.exports = { id: ID, supports, publish, schedule, listAccounts, pollJobStatus, composePayload, CHANNELS, EXPERIMENTAL };
