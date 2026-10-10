'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { routeChannels, providersForChannel, groupByProvider, isExperimental, normalizeChannel } = require('../lib/router');
const { ChannelUnsupportedError } = require('../lib/errors');

test('explicit channel map wins', () => {
  const config = { social: { default_provider: 'postiz', channels: { x: 'buffer', linkedin: 'typefully' } } };
  const plan = routeChannels(['x', 'linkedin'], config);
  assert.deepEqual(plan, { x: 'buffer', linkedin: 'typefully' });
});

test('falls back to default_provider when advertising', () => {
  const config = { social: { default_provider: 'postiz', channels: {} } };
  const plan = routeChannels(['bluesky', 'linkedin'], config);
  assert.deepEqual(plan, { bluesky: 'postiz', linkedin: 'postiz' });
});

test('twitter normalizes to x', () => {
  assert.equal(normalizeChannel('Twitter'), 'x');
  assert.equal(normalizeChannel('X'), 'x');
});

test('unsupported channel throws with suggestions', () => {
  const config = { social: { default_provider: 'typefully' } };
  try {
    routeChannels(['tiktok'], config);
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err instanceof ChannelUnsupportedError);
    assert.deepEqual(err.missing, ['tiktok']);
    assert.ok(err.suggestions[0].candidates.includes('postiz'));
  }
});

test('providersForChannel returns advertisers', () => {
  const list = providersForChannel('bluesky');
  assert.ok(list.includes('postiz'));
  assert.ok(list.includes('typefully'));
});

test('groupByProvider batches per-provider', () => {
  const plan = { x: 'postiz', bluesky: 'postiz', linkedin: 'buffer' };
  const groups = groupByProvider(plan);
  assert.deepEqual(groups, { postiz: ['x', 'bluesky'], buffer: ['linkedin'] });
});

test('experimental flag surfaces Zernio, Publer, Post Bridge', () => {
  assert.equal(isExperimental('zernio'), true);
  assert.equal(isExperimental('publer'), true);
  assert.equal(isExperimental('postbridge'), true);
  assert.equal(isExperimental('postiz'), false);
  assert.equal(isExperimental('buffer'), false);
  assert.equal(isExperimental('typefully'), false);
});
