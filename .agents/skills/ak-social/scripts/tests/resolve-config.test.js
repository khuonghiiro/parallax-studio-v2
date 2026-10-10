'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveConfig, parseYaml, candidateConfigPaths } = require('../lib/resolve-config');
const { ConfigError } = require('../lib/errors');

function fakeFs(files) {
  return {
    readFileSync(p, _enc) {
      if (Object.prototype.hasOwnProperty.call(files, p)) return files[p];
      const err = new Error(`ENOENT: no such file ${p}`);
      err.code = 'ENOENT';
      throw err;
    },
  };
}

test('parseYaml handles top-level scalars', () => {
  const doc = parseYaml('foo: bar\nbaz: 1\nqux: true\n');
  assert.deepEqual(doc, { foo: 'bar', baz: 1, qux: true });
});

test('parseYaml handles nested maps and lists', () => {
  const src = [
    'social:',
    '  default_provider: postiz',
    '  channels:',
    '    - x',
    '    - linkedin',
    '  postiz:',
    '    workspace: default',
  ].join('\n');
  const doc = parseYaml(src);
  assert.deepEqual(doc, {
    social: {
      default_provider: 'postiz',
      channels: ['x', 'linkedin'],
      postiz: { workspace: 'default' },
    },
  });
});

test('parseYaml quotes and null coercion', () => {
  const doc = parseYaml('a: "hello"\nb: null\nc: ~\nd: 1.5\n');
  assert.deepEqual(doc, { a: 'hello', b: null, c: null, d: 1.5 });
});

test('parseYaml throws ConfigError with file path on malformed input', () => {
  assert.throws(() => parseYaml('   bad-indent: 1', '/x/config.yaml'), (err) => {
    assert.equal(err instanceof ConfigError, true);
    assert.match(err.message, /file: \/x\/config\.yaml/);
    return true;
  });
});

test('resolveConfig returns empty when neither file exists', () => {
  const fsImpl = fakeFs({});
  const res = resolveConfig({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.deepEqual(res.merged, {});
});

test('resolveConfig merges global then project, project wins at top level', () => {
  const globalPath = path.join('/home/u', '.agentkit', 'config.yaml');
  const projectPath = path.join('/proj', '.agentkit', 'config.yaml');
  const fsImpl = fakeFs({
    [globalPath]: 'social:\n  default_provider: buffer\nother: keep\n',
    [projectPath]: 'social:\n  default_provider: postiz\n',
  });
  const res = resolveConfig({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.equal(res.merged.social.default_provider, 'postiz');
  assert.equal(res.merged.other, 'keep');
});

test('AGENTKIT_HOME env override wins for global path', () => {
  const paths = candidateConfigPaths({
    cwd: '/proj',
    home: '/home/u',
    env: { AGENTKIT_HOME: '/custom/ak' },
  });
  assert.equal(paths.global, path.join('/custom/ak', 'config.yaml'));
});

test('resolveConfig preserves unknown top-level keys (round-trip proof)', () => {
  const projectPath = path.join('/proj', '.agentkit', 'config.yaml');
  const fsImpl = fakeFs({
    [projectPath]: [
      'social:',
      '  default_provider: postiz',
      'ai:',
      '  model: opus',
      'custom_unknown_key:',
      '  future: field',
    ].join('\n'),
  });
  const res = resolveConfig({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.ok(res.merged.custom_unknown_key, 'unknown key survived');
  assert.equal(res.merged.custom_unknown_key.future, 'field');
});
