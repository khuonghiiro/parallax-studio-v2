'use strict';

const { requestJson } = require('../lib/http-client');
const { requireEnv, ok } = require('../lib/adapter-base');

const ID = 'buffer';
const DEFAULT_BASE = 'https://api.buffer.com';
const CHANNELS = ['instagram', 'facebook', 'linkedin', 'pinterest', 'x', 'twitter'];

function supports(channel) {
  return CHANNELS.includes(String(channel || '').toLowerCase());
}

function baseUrl(opts) {
  return (opts.config && opts.config.social && opts.config.social.buffer && opts.config.social.buffer.base_url) || DEFAULT_BASE;
}

async function graphql(query, variables, deps) {
  const env = deps.envMap;
  requireEnv(ID, 'BUFFER_API_KEY', { env: deps.envResolved });
  return requestJson(ID, baseUrl(deps), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.BUFFER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  }, deps);
}

async function listAccounts(opts = {}) {
  const deps = normalizeDeps(opts);
  const query = 'query { account { organizations { id name channels { id name service } } } }';
  return graphql(query, {}, deps);
}

// Buffer's schema names shifted with the beta: profiles→channels, updates→
// posts. `createPost` accepts a per-post schedule; if omitted, the post is
// added to the queue for the target channel.
function composeMutation({ channels, content, mediaUrls = [], scheduleAt = null, channelMap = {} }) {
  const query = `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { id status } }`;
  const input = {
    text: content,
    channelIds: channels.map((c) => channelMap[c]).filter(Boolean),
    ...(mediaUrls.length ? { media: mediaUrls.map((url) => ({ url })) } : {}),
    ...(scheduleAt ? { scheduledAt: scheduleAt } : {}),
  };
  return { query, variables: { input } };
}

async function publish(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  const { query, variables } = composeMutation({ ...payload, scheduleAt: null });
  const raw = await graphql(query, variables, deps);
  return ok('published', raw && raw.data && raw.data.createPost && raw.data.createPost.id, raw);
}

async function schedule(payload, opts = {}) {
  const deps = normalizeDeps(opts);
  if (!payload.scheduleAt) throw new Error(`${ID}: schedule() requires payload.scheduleAt (ISO8601)`);
  const { query, variables } = composeMutation(payload);
  const raw = await graphql(query, variables, deps);
  return ok('scheduled', raw && raw.data && raw.data.createPost && raw.data.createPost.id, raw);
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

module.exports = { id: ID, supports, publish, schedule, listAccounts, composeMutation, CHANNELS };
