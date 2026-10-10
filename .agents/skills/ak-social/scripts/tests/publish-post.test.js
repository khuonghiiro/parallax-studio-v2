'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, buildPlan, renderDryRun, listProviders, ADAPTERS } = require('../publish-post');

test('parseArgs handles values and boolean flags', () => {
  const args = parseArgs(['--content', 'Hello', '--channels', 'x,linkedin', '--dry-run']);
  assert.equal(args.content, 'Hello');
  assert.equal(args.channels, 'x,linkedin');
  assert.equal(args['dry-run'], true);
});

test('buildPlan with --provider forces adapter for all channels', () => {
  const plan = buildPlan(
    { channels: 'x,linkedin', content: 'Hi', provider: 'buffer' },
    { config: {}, envResolved: {}, style: null },
  );
  assert.deepEqual(plan.groups, { buffer: ['x', 'linkedin'] });
});

test('buildPlan without --provider uses router / config', () => {
  const plan = buildPlan(
    { channels: 'x,threads', content: 'Hi' },
    { config: { social: { default_provider: 'postiz' } }, envResolved: {}, style: null },
  );
  assert.equal(plan.routing.x, 'postiz');
  assert.equal(plan.routing.threads, 'postiz');
});

test('buildPlan throws on missing --channels', () => {
  assert.throws(
    () => buildPlan({ content: 'Hi' }, { config: {}, envResolved: {}, style: null }),
    /Missing --channels/,
  );
});

test('renderDryRun shows experimental tag on Publer / Zernio', () => {
  const plan = buildPlan(
    { channels: 'x', content: 'Hi', provider: 'publer' },
    { config: {}, envResolved: {}, style: null },
  );
  const out = renderDryRun(plan);
  assert.match(out, /publer \(experimental\)/);
});

test('listProviders enumerates all six adapters', () => {
  const out = listProviders();
  for (const id of ['postiz', 'buffer', 'postbridge', 'typefully', 'zernio', 'publer']) {
    assert.match(out, new RegExp(`- ${id}`));
  }
});

test('ADAPTERS registry covers all providers exactly once', () => {
  assert.deepEqual(Object.keys(ADAPTERS).sort(), ['buffer', 'postbridge', 'postiz', 'publer', 'typefully', 'zernio']);
});
