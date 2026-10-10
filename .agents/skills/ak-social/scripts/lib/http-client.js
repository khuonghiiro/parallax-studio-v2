'use strict';

const { RateLimitError, ProviderError } = require('./errors');

// Header names that are safe to log; anything else is redacted.
const LOGGABLE_HEADERS = new Set([
  'content-type',
  'accept',
  'user-agent',
  'x-request-id',
]);

function redactHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    out[key] = LOGGABLE_HEADERS.has(lower) ? value : '[redacted]';
  }
  return out;
}

function computeBackoffMs(attempt, baseMs = 500, capMs = 8000) {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  const jitter = Math.floor(Math.random() * (exp / 4));
  return exp + jitter;
}

async function request(provider, url, opts = {}, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxRetries = typeof deps.maxRetries === 'number' ? deps.maxRetries : 3;

  if (!fetchImpl) {
    throw new Error(`${provider}: no fetch implementation available (Node 18+ required, or inject deps.fetch)`);
  }

  let attempt = 0;
  while (true) {
    let response;
    try {
      response = await fetchImpl(url, opts);
    } catch (err) {
      // Network-level failure — surface as ProviderError without body.
      throw new ProviderError(provider, opts.method || 'GET', 0, err.message || String(err));
    }

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get?.('retry-after')) * 1000;
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter
        : computeBackoffMs(attempt);
      await sleep(delay);
      attempt += 1;
      continue;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get?.('retry-after')) * 1000 || computeBackoffMs(attempt);
      throw new RateLimitError(provider, url, retryAfter);
    }

    if (!response.ok) {
      const body = await safeReadBody(response);
      throw new ProviderError(provider, url, response.status, body);
    }

    return response;
  }
}

async function safeReadBody(response) {
  try {
    const contentType = response.headers.get?.('content-type') || '';
    if (contentType.includes('application/json')) return await response.json();
    return await response.text();
  } catch (_err) {
    return null;
  }
}

async function requestJson(provider, url, opts = {}, deps = {}) {
  const response = await request(provider, url, opts, deps);
  return safeReadBody(response);
}

module.exports = { request, requestJson, redactHeaders, computeBackoffMs };
