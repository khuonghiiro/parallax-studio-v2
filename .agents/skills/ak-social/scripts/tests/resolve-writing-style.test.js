'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { resolveWritingStyle, listStyles, candidateStyleDirs } = require('../lib/resolve-writing-style');

function fakeFs({ dirs = {}, files = {} }) {
  return {
    readdirSync(dir) {
      if (Object.prototype.hasOwnProperty.call(dirs, dir)) return [...dirs[dir]];
      const err = new Error(`ENOENT: ${dir}`);
      err.code = 'ENOENT';
      throw err;
    },
    readFileSync(p) {
      if (Object.prototype.hasOwnProperty.call(files, p)) return files[p];
      const err = new Error(`ENOENT: ${p}`);
      err.code = 'ENOENT';
      throw err;
    },
  };
}

test('missing dirs → empty result, no throw', () => {
  const fsImpl = fakeFs({});
  const res = listStyles({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.deepEqual(res.styles, []);
});

test('yaml style file parses into structured descriptor', () => {
  const projectDir = path.join('/proj', 'assets', 'writing-styles');
  const filePath = path.join(projectDir, 'indie-hacker.yaml');
  const fsImpl = fakeFs({
    dirs: { [projectDir]: ['indie-hacker.yaml'] },
    files: {
      [filePath]: [
        'name: Indie Hacker',
        'description: Scrappy honesty',
        'dimensions:',
        '  tone: casual',
        'patterns:',
        '  - Short sentences',
        '  - Fragments',
        'avoid:',
        '  - Corporate speak',
      ].join('\n'),
    },
  });
  const res = resolveWritingStyle('Indie Hacker', { cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.equal(res.style.name, 'Indie Hacker');
  assert.equal(res.style.dimensions.tone, 'casual');
  assert.deepEqual(res.style.patterns, ['Short sentences', 'Fragments']);
});

test('markdown file with frontmatter is parsed', () => {
  const globalDir = path.join('/home/u', '.agentkit', 'writing-styles');
  const filePath = path.join(globalDir, 'kongming.md');
  const fsImpl = fakeFs({
    dirs: { [globalDir]: ['kongming.md'] },
    files: {
      [filePath]: [
        '---',
        'name: Kongming',
        'description: Calm, evidence-first',
        '---',
        '',
        'Body prose here.',
      ].join('\n'),
    },
  });
  const res = resolveWritingStyle('Kongming', { cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.equal(res.style.name, 'Kongming');
  assert.match(res.style.body, /Body prose here/);
});

test('project dir wins on name collision with global', () => {
  const projectDir = path.join('/proj', 'assets', 'writing-styles');
  const globalDir = path.join('/home/u', '.agentkit', 'writing-styles');
  const fsImpl = fakeFs({
    dirs: {
      [projectDir]: ['duy.yaml'],
      [globalDir]: ['duy.yaml'],
    },
    files: {
      [path.join(projectDir, 'duy.yaml')]: 'name: duy\ndescription: project version\n',
      [path.join(globalDir, 'duy.yaml')]: 'name: duy\ndescription: global version\n',
    },
  });
  const res = resolveWritingStyle('duy', { cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.equal(res.style.description, 'project version');
});

test('name miss returns null with available list', () => {
  const projectDir = path.join('/proj', 'assets', 'writing-styles');
  const fsImpl = fakeFs({
    dirs: { [projectDir]: ['a.yaml'] },
    files: { [path.join(projectDir, 'a.yaml')]: 'name: a\n' },
  });
  const res = resolveWritingStyle('missing', { cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.equal(res.style, null);
  assert.deepEqual(res.available, ['a']);
});

test('candidateStyleDirs respects AGENTKIT_HOME override', () => {
  const dirs = candidateStyleDirs({
    cwd: '/proj',
    home: '/home/u',
    env: { AGENTKIT_HOME: '/custom' },
  });
  assert.equal(dirs.global, path.join('/custom', 'writing-styles'));
});

test('unknown file extensions are ignored', () => {
  const projectDir = path.join('/proj', 'assets', 'writing-styles');
  const fsImpl = fakeFs({
    dirs: { [projectDir]: ['note.txt', 'valid.yaml'] },
    files: {
      [path.join(projectDir, 'valid.yaml')]: 'name: valid\n',
    },
  });
  const res = listStyles({ cwd: '/proj', home: '/home/u', env: {}, fsImpl });
  assert.deepEqual(res.styles.map((s) => s.name), ['valid']);
});
