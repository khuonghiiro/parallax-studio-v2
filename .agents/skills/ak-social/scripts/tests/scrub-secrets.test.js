'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildScrubber, PLACEHOLDER } = require('../lib/scrub-secrets');

test('replaces the raw secret in a string', () => {
  const scrub = buildScrubber({ POSTIZ_API_KEY: 'sk_live_abcdef1234' });
  const out = scrub('failed with token sk_live_abcdef1234 in the URL');
  assert.equal(out.includes('sk_live_abcdef1234'), false);
  assert.equal(out.includes(PLACEHOLDER), true);
});

test('walks nested objects and arrays', () => {
  const scrub = buildScrubber({ K: 'topsecret-value' });
  const out = scrub({
    error: 'oops topsecret-value',
    results: [{ raw: { body: 'echoed topsecret-value again' } }],
  });
  const serialized = JSON.stringify(out);
  assert.equal(serialized.includes('topsecret-value'), false);
});

test('skips values shorter than MIN_SECRET_LEN', () => {
  const scrub = buildScrubber({ SHORT: 'abc', LONG: 'longsecret' });
  const out = scrub('abc appears here and longsecret too');
  // "abc" is under the minimum length, so it's left alone.
  assert.equal(out.includes('abc'), true);
  // "longsecret" is redacted.
  assert.equal(out.includes('longsecret'), false);
});

test('longest secret wins when values overlap', () => {
  const scrub = buildScrubber({ A: 'aaaaaa', B: 'aaaaaaaaaa' });
  // If A were applied first the tail "aaaa" would remain; we replace B first.
  const out = scrub('token aaaaaaaaaa');
  assert.equal(out.includes('aaaa'), false);
});

test('leaves non-string primitives untouched', () => {
  const scrub = buildScrubber({ K: 'longsecret' });
  assert.equal(scrub(42), 42);
  assert.equal(scrub(true), true);
  assert.equal(scrub(null), null);
  assert.equal(scrub(undefined), undefined);
});

test('empty env map is a no-op', () => {
  const scrub = buildScrubber({});
  assert.equal(scrub('anything with sk_live_abcdef1234 in it'), 'anything with sk_live_abcdef1234 in it');
});

test('fatal-path scrubber redacts secrets defined only in a .env file', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  const fileOnlySecret = 'file_only_topsecret_abcdefg';

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ak-social-fatal-'));
  const fakeHome = path.join(tmpRoot, 'home', '.agentkit');
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.writeFileSync(path.join(fakeHome, '.env'), `POSTIZ_API_KEY=${fileOnlySecret}\n`);

  const originalHome = process.env.AGENTKIT_HOME;
  const originalShellKey = process.env.POSTIZ_API_KEY;
  process.env.AGENTKIT_HOME = fakeHome;
  delete process.env.POSTIZ_API_KEY;

  try {
    const { resolveEnv } = require('../lib/resolve-env');
    const { merged } = resolveEnv();
    const scrub = buildScrubber(merged);
    const out = scrub(`crashed while reading ${fileOnlySecret}`);
    assert.equal(out.includes(fileOnlySecret), false, 'file-only secret must be redacted');
  } finally {
    if (originalHome === undefined) delete process.env.AGENTKIT_HOME;
    else process.env.AGENTKIT_HOME = originalHome;
    if (originalShellKey !== undefined) process.env.POSTIZ_API_KEY = originalShellKey;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('publish-post JSON output scrubs a ProviderError echoing the API key', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  const secret = 'sk_live_supersecret_9999';
  const { ProviderError } = require('../lib/errors');
  const fakeAdapter = {
    id: 'postiz',
    CHANNELS: ['x'],
    supports: () => true,
    publish: async () => { throw new ProviderError('postiz', '/posts', 400, `bad token ${secret}`); },
  };

  // Isolate: point AGENTKIT_HOME + cwd at empty tmp dirs so the resolver
  // doesn't touch the user's real global config.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ak-social-scrub-'));
  const fakeHome = path.join(tmpRoot, 'home');
  const fakeCwd = path.join(tmpRoot, 'cwd');
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.mkdirSync(fakeCwd, { recursive: true });

  const { run, ADAPTERS } = require('../publish-post');
  const originalAdapter = ADAPTERS.postiz;
  ADAPTERS.postiz = fakeAdapter;
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalKey = process.env.POSTIZ_API_KEY;
  const originalHome = process.env.AGENTKIT_HOME;
  const originalCwd = process.cwd();
  process.env.POSTIZ_API_KEY = secret;
  process.env.AGENTKIT_HOME = fakeHome;
  process.chdir(fakeCwd);

  let captured = '';
  process.stdout.write = (chunk) => { captured += chunk; return true; };

  try {
    await run([
      '--content', 'hi',
      '--channels', 'x',
      '--provider', 'postiz',
    ]);
  } finally {
    process.stdout.write = originalWrite;
    ADAPTERS.postiz = originalAdapter;
    process.chdir(originalCwd);
    if (originalKey === undefined) delete process.env.POSTIZ_API_KEY;
    else process.env.POSTIZ_API_KEY = originalKey;
    if (originalHome === undefined) delete process.env.AGENTKIT_HOME;
    else process.env.AGENTKIT_HOME = originalHome;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  assert.equal(captured.includes(secret), false, 'raw secret must not appear in stdout');
  assert.equal(captured.includes(PLACEHOLDER), true, 'redaction placeholder should appear');
});
