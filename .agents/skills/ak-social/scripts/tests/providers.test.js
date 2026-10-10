'use strict';

// Consolidated adapter test: every provider follows the same shared
// interface, so one file drives all six through injected fetch stubs
// instead of duplicating boilerplate per adapter.

const test = require('node:test');
const assert = require('node:assert/strict');

const postiz = require('../providers/postiz');
const buffer = require('../providers/buffer');
const postbridge = require('../providers/postbridge');
const typefully = require('../providers/typefully');
const zernio = require('../providers/zernio');
const publer = require('../providers/publer');
const { AuthError, RateLimitError, ProviderError } = require('../lib/errors');

function fakeResponse({ status = 200, headers = {}, json = null, text = '' } = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => h.get(String(k).toLowerCase()) },
    async json() { return json; },
    async text() { return text; },
  };
}

function recordingFetch(response = { status: 200, json: { id: 'stub-id' }, headers: { 'content-type': 'application/json' } }) {
  const calls = [];
  return {
    calls,
    fn: async (url, opts) => {
      calls.push({ url, opts });
      return fakeResponse(response);
    },
  };
}

function makeEnv(vars = {}) {
  return { merged: vars, loadedFrom: ['/home/u/.agentkit/.env'] };
}

const REQ_ENV = {
  postiz: { POSTIZ_API_KEY: 'sk-postiz-fake' },
  buffer: { BUFFER_API_KEY: 'buf-fake' },
  postbridge: { POSTBRIDGE_API_KEY: 'pb_live_fake' },
  typefully: { TYPEFULLY_API_KEY: 'tf-fake' },
  zernio: { ZERNIO_API_KEY: 'sk-fake' },
  publer: { PUBLER_API_KEY: 'pu-fake', PUBLER_WORKSPACE_ID: 'ws-1' },
};

const PROVIDERS = { postiz, buffer, postbridge, typefully, zernio, publer };

// ----- Shared interface + auth refusal -----
for (const [id, provider] of Object.entries(PROVIDERS)) {
  test(`${id}: exposes shared interface`, () => {
    assert.equal(typeof provider.id, 'string');
    assert.equal(typeof provider.supports, 'function');
    assert.equal(typeof provider.publish, 'function');
    assert.equal(typeof provider.schedule, 'function');
    assert.equal(typeof provider.listAccounts, 'function');
  });

  test(`${id}: refuses when its required key is missing`, async () => {
    const rec = recordingFetch();
    await assert.rejects(
      () => provider.publish({ channels: ['x'], content: 'x' }, {
        env: makeEnv({}),
        fetch: rec.fn,
      }),
      (err) => {
        // Publer throws its own error about workspace_id first if PUBLER_API_KEY
        // is present but workspace missing; Typefully throws its social_set_id
        // check before hitting the auth path. Either way the adapter must
        // refuse without any network I/O.
        assert.ok(
          err instanceof AuthError
            || /workspace_id required/.test(err.message)
            || /social_set_id/.test(err.message),
          `unexpected error: ${err.message}`,
        );
        return true;
      },
    );
    assert.equal(rec.calls.length, 0, 'must not hit the network without a key');
  });
}

// ----- Postiz -----
test('postiz.publish composes /posts payload with type=now', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { id: 'post-1' } });
  const result = await postiz.publish({ channels: ['x'], content: 'Hello', integrations: { x: 'int-1' } }, {
    env: makeEnv(REQ_ENV.postiz),
    fetch: rec.fn,
  });
  assert.equal(result.status, 'published');
  assert.equal(result.providerRef, 'post-1');
  assert.match(rec.calls[0].url, /\/public\/v1\/posts$/);
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.equal(body.type, 'now');
  assert.equal(body.integrations[0].id, 'int-1');
  assert.equal(body.integrations[0].content, 'Hello');
  // Auth header must be present but never surface in text output; here we
  // only assert it's set — redaction is tested via http-client.
  assert.ok(rec.calls[0].opts.headers.Authorization);
});

test('postiz.schedule requires scheduleAt', async () => {
  await assert.rejects(
    () => postiz.schedule({ channels: ['x'], content: 'Hi' }, { env: makeEnv(REQ_ENV.postiz), fetch: recordingFetch().fn }),
    /scheduleAt/,
  );
});

// ----- Buffer -----
test('buffer.publish sends GraphQL mutation', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { data: { createPost: { id: 'b-1', status: 'queued' } } } });
  const result = await buffer.publish({ channels: ['linkedin'], content: 'Post', channelMap: { linkedin: 'ch-1' } }, {
    env: makeEnv(REQ_ENV.buffer),
    fetch: rec.fn,
  });
  assert.equal(result.status, 'published');
  assert.equal(result.providerRef, 'b-1');
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.match(body.query, /mutation CreatePost/);
  assert.deepEqual(body.variables.input.channelIds, ['ch-1']);
});

// ----- Post Bridge -----
test('postbridge.schedule posts to /schedule with caption + accounts', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { id: 'pb-1' } });
  const result = await postbridge.schedule({
    channels: ['tiktok'],
    content: 'video caption',
    scheduleAt: '2026-08-15T14:00:00Z',
    accountMap: { tiktok: 42 },
  }, {
    env: makeEnv(REQ_ENV.postbridge),
    fetch: rec.fn,
  });
  assert.equal(result.status, 'scheduled');
  assert.match(rec.calls[0].url, /\/schedule$/);
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.equal(body.caption, 'video caption');
  assert.deepEqual(body.accounts, [42]);
  assert.equal(body.schedule, '2026-08-15T14:00:00Z');
});

// ----- Typefully -----
test('typefully.publish requires social_set_id', async () => {
  await assert.rejects(
    () => typefully.publish({ channels: ['x'], content: 'Hi' }, {
      env: makeEnv(REQ_ENV.typefully),
      config: { social: { typefully: {} } },
      fetch: recordingFetch().fn,
    }),
    /social_set_id/,
  );
});

test('typefully.schedule hits /v2/social-sets/{id}/drafts', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { id: 'draft-1' } });
  await typefully.schedule({ channels: ['x', 'threads'], content: 'multi', scheduleAt: '2026-08-15T09:00:00Z' }, {
    env: makeEnv(REQ_ENV.typefully),
    config: { social: { typefully: { default_social_set_id: 'set-abc' } } },
    fetch: rec.fn,
  });
  assert.match(rec.calls[0].url, /\/v2\/social-sets\/set-abc\/drafts$/);
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.ok(body.platforms.x);
  assert.ok(body.platforms.threads);
  assert.equal(body.publish_at, '2026-08-15T09:00:00Z');
});

// ----- Zernio -----
test('zernio.publish maps x → twitter in platforms[]', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { id: 'z-1' } });
  await zernio.publish({ channels: ['x', 'linkedin'], content: 'text' }, {
    env: makeEnv(REQ_ENV.zernio),
    fetch: rec.fn,
  });
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.deepEqual(body.platforms, ['twitter', 'linkedin']);
  assert.equal(zernio.EXPERIMENTAL, true);
});

// ----- Publer -----
test('publer.schedule uses two headers and bulk envelope', async () => {
  const rec = recordingFetch({ status: 200, headers: { 'content-type': 'application/json' }, json: { job_id: 'job-1' } });
  const result = await publer.schedule({
    channels: ['twitter'],
    content: 'Hi',
    scheduleAt: '2026-08-15T09:00:00Z',
    accountIds: ['acct-1'],
  }, {
    env: makeEnv(REQ_ENV.publer),
    fetch: rec.fn,
  });
  assert.equal(result.status, 'pending');
  assert.equal(result.providerRef, 'job-1');
  const headers = rec.calls[0].opts.headers;
  assert.match(headers.Authorization, /^Bearer-API /);
  assert.equal(headers['Publer-Workspace-Id'], 'ws-1');
  const body = JSON.parse(rec.calls[0].opts.body);
  assert.equal(body.bulk.state, 'scheduled');
  assert.ok(body.bulk.posts[0].networks.twitter);
  assert.equal(publer.EXPERIMENTAL, true);
});

test('publer refuses when workspace_id missing', async () => {
  await assert.rejects(
    () => publer.publish({ channels: ['x'], content: 'Hi' }, {
      env: makeEnv({ PUBLER_API_KEY: 'pu-fake' }),
      fetch: recordingFetch().fn,
    }),
    /workspace_id required/,
  );
});

// ----- http-client 429 → RateLimitError after retries -----
test('http-client surfaces RateLimitError after exhausting retries', async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls += 1;
    return fakeResponse({ status: 429, headers: { 'retry-after': '0' } });
  };
  await assert.rejects(
    () => postiz.publish({ channels: ['x'], content: 'x' }, {
      env: makeEnv(REQ_ENV.postiz),
      fetch: fetchFn,
      sleep: async () => {},
      maxRetries: 2,
    }),
    (err) => err instanceof RateLimitError,
  );
  assert.equal(calls, 3, 'initial + 2 retries');
});

// ----- 4xx surfaces ProviderError -----
test('4xx returns ProviderError with endpoint + status', async () => {
  const fetchFn = async () => fakeResponse({ status: 400, headers: { 'content-type': 'application/json' }, json: { error: 'bad' } });
  await assert.rejects(
    () => postiz.publish({ channels: ['x'], content: 'x' }, {
      env: makeEnv(REQ_ENV.postiz),
      fetch: fetchFn,
    }),
    (err) => err instanceof ProviderError && err.status === 400,
  );
});
