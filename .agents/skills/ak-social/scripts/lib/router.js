'use strict';

const { ChannelUnsupportedError } = require('./errors');

// Advertised channels per provider — used for `suggest` output when the
// configured routing doesn't cover a requested channel. Kept in a single
// place so provider-support lists don't drift between adapters and router.
const ADVERTISED = {
  postiz: ['x', 'twitter', 'bluesky', 'mastodon', 'discord', 'instagram', 'youtube', 'linkedin', 'tiktok', 'reddit', 'facebook', 'pinterest', 'threads', 'slack'],
  buffer: ['instagram', 'facebook', 'linkedin', 'pinterest', 'x', 'twitter'],
  postbridge: ['instagram', 'tiktok', 'youtube', 'x', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'bluesky'],
  typefully: ['x', 'twitter', 'linkedin', 'threads', 'bluesky', 'mastodon'],
  zernio: ['x', 'twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'reddit', 'bluesky', 'threads', 'google_business', 'telegram', 'snapchat', 'whatsapp', 'discord'],
  publer: ['facebook', 'instagram', 'x', 'twitter', 'linkedin', 'pinterest', 'youtube', 'tiktok', 'google_business', 'wordpress', 'telegram', 'mastodon', 'threads', 'bluesky'],
};

// Post Bridge is marked experimental because its REST payload shapes were
// derived from CLI signatures — the Scalar-rendered API reference did not
// yield to plain WebFetch during research, so first-run canary is required
// before treating it as stable. Zernio/Publer are experimental for vendor-
// evidence reasons documented in their references.
const EXPERIMENTAL = new Set(['zernio', 'publer', 'postbridge']);

function normalizeChannel(ch) {
  const lower = String(ch || '').toLowerCase().trim();
  if (lower === 'twitter') return 'x';
  return lower;
}

// Given the resolved social config and a requested channel list, return a
// route plan: { channel → providerId }. Explicit config.channels map wins;
// otherwise fall back to default_provider when it advertises the channel.
function routeChannels(channels, config = {}) {
  const social = (config && config.social) || {};
  const explicit = social.channels || {};
  const defaultProvider = social.default_provider || null;
  const configured = Object.keys(explicit)
    .concat(Object.keys(social).filter((k) => ADVERTISED[k]))
    .filter((v, i, a) => a.indexOf(v) === i);

  const plan = {};
  const missing = [];

  for (const raw of channels) {
    const ch = normalizeChannel(raw);
    if (!ch) continue;

    if (Object.prototype.hasOwnProperty.call(explicit, ch)) {
      plan[ch] = explicit[ch];
      continue;
    }
    if (defaultProvider && (ADVERTISED[defaultProvider] || []).includes(ch)) {
      plan[ch] = defaultProvider;
      continue;
    }
    missing.push(ch);
  }

  if (missing.length > 0) {
    const suggestions = missing.map((ch) => ({
      channel: ch,
      candidates: providersForChannel(ch),
    }));
    const err = new ChannelUnsupportedError(missing[0], configured);
    err.missing = missing;
    err.suggestions = suggestions;
    throw err;
  }

  return plan;
}

function providersForChannel(channel) {
  const ch = normalizeChannel(channel);
  return Object.entries(ADVERTISED)
    .filter(([_id, list]) => list.includes(ch))
    .map(([id]) => id);
}

function isExperimental(providerId) {
  return EXPERIMENTAL.has(providerId);
}

function advertisedChannels(providerId) {
  return ADVERTISED[providerId] || [];
}

// Group a resolved plan by provider so callers can batch per-provider
// publish calls when a provider supports multiple channels in one request.
function groupByProvider(plan) {
  const groups = {};
  for (const [ch, provider] of Object.entries(plan)) {
    if (!groups[provider]) groups[provider] = [];
    groups[provider].push(ch);
  }
  return groups;
}

module.exports = {
  routeChannels,
  providersForChannel,
  isExperimental,
  advertisedChannels,
  groupByProvider,
  normalizeChannel,
  ADVERTISED,
  EXPERIMENTAL,
};
