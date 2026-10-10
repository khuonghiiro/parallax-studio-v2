'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveEnv, parseDotenv, candidateEnvPaths } = require('../lib/resolve-env');

function fakeFs(files) {
  return {
    readFileSync(p) {
      if (Object.prototype.hasOwnProperty.call(files, p)) return files[p];
      const err = new Error(`ENOENT: ${p}`);
      err.code = 'ENOENT';
      throw err;
    },
  };
}

test('parseDotenv reads KEY=value pairs, skips comments and reserved-invalid keys', () => {
  const parsed = parseDotenv([
    '# comment',
    'FOO=bar',
    'BAR="quoted value"',
    "BAZ='single'",
    'lowercase_ok=yes',
    '9BAD=nope',
    'has-dash=nope',
    'EMPTY=',
  ].join('\n'));
  assert.deepEqual(parsed, {
    FOO: 'bar',
    BAR: 'quoted value',
    BAZ: 'single',
    lowercase_ok: 'yes',
    EMPTY: '',
  });
});

test('resolveEnv missing files → empty merged', () => {
  const fsImpl = fakeFs({});
  const res = resolveEnv({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.deepEqual(res.merged, {});
  assert.deepEqual(res.loadedFrom, []);
});

test('resolveEnv project overrides global, shell overrides both', () => {
  const globalPath = path.join('/home/u', '.agentkit', '.env');
  const projectPath = path.join('/proj', '.agentkit', '.env');
  const fsImpl = fakeFs({
    [globalPath]: 'POSTIZ_API_KEY=global_key\nBUFFER_API_KEY=global_buf\n',
    [projectPath]: 'POSTIZ_API_KEY=project_key\n',
  });
  const env = { BUFFER_API_KEY: 'shell_buf' };
  const res = resolveEnv({ cwd: '/proj', home: '/home/u', env, fsImpl });
  assert.equal(res.merged.POSTIZ_API_KEY, 'project_key', 'project beats global');
  assert.equal(res.merged.BUFFER_API_KEY, 'shell_buf', 'shell beats project + global');
});

test('empty shell values do not override project/global', () => {
  const globalPath = path.join('/home/u', '.agentkit', '.env');
  const fsImpl = fakeFs({
    [globalPath]: 'POSTIZ_API_KEY=from_file\n',
  });
  const env = { POSTIZ_API_KEY: '' };
  const res = resolveEnv({ cwd: '/proj', home: '/home/u', env, fsImpl });
  assert.equal(res.merged.POSTIZ_API_KEY, 'from_file');
});

test('AGENTKIT_HOME override drives global .env path', () => {
  const paths = candidateEnvPaths({
    cwd: '/proj',
    home: '/home/u',
    env: { AGENTKIT_HOME: '/custom/ak' },
  });
  assert.equal(paths.global, path.join('/custom/ak', '.env'));
});

test('resolveEnv reports loadedFrom paths in order (global, project)', () => {
  const globalPath = path.join('/home/u', '.agentkit', '.env');
  const projectPath = path.join('/proj', '.agentkit', '.env');
  const fsImpl = fakeFs({
    [globalPath]: 'A=1\n',
    [projectPath]: 'B=2\n',
  });
  const res = resolveEnv({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.deepEqual(res.loadedFrom, [globalPath, projectPath]);
});
