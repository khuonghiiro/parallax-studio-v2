#!/usr/bin/env node

'use strict';

// Publish or schedule a social post through a configured provider adapter.
// Reads config from ~/.agentkit/config.yaml + <cwd>/.agentkit/config.yaml,
// credentials from ~/.agentkit/.env + <cwd>/.agentkit/.env, and optional
// writing-style descriptors from assets/writing-styles/ + ~/.agentkit/writing-styles/.
//
// Usage:
//   node publish-post.js --content "..." --channels x,linkedin [--provider postiz]
//     [--schedule 2026-08-15T14:00:00Z] [--media file1,file2]
//     [--style indie-hacker] [--dry-run]

const fs = require('node:fs');
const path = require('node:path');

const { resolveConfig } = require('./lib/resolve-config');
const { resolveEnv } = require('./lib/resolve-env');
const { resolveWritingStyle } = require('./lib/resolve-writing-style');
const { routeChannels, groupByProvider, isExperimental } = require('./lib/router');
const { buildScrubber } = require('./lib/scrub-secrets');

const ADAPTERS = {
  postiz: require('./providers/postiz'),
  buffer: require('./providers/buffer'),
  postbridge: require('./providers/postbridge'),
  typefully: require('./providers/typefully'),
  zernio: require('./providers/zernio'),
  publer: require('./providers/publer'),
};

function parseArgs(argv) {
  const flags = { boolean: new Set(['dry-run', 'help', 'list-providers']) };
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { out._.push(arg); continue; }
    const key = arg.slice(2);
    if (flags.boolean.has(key)) { out[key] = true; continue; }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}

function usage() {
  return [
    'Usage: publish-post.js [options]',
    '',
    '  --content <text>          Post body (or use --file)',
    '  --file <path>             Read content from a file',
    '  --channels <a,b,c>        Comma-separated channels (x, linkedin, threads, ...)',
    '  --provider <id>           Force one provider (overrides config routing)',
    '  --schedule <ISO8601>      Schedule for a specific UTC time; omit to publish now',
    '  --media <a,b>             Comma-separated media file paths or URLs',
    '  --style <name>            Writing-style name; overrides default_style in config',
    '  --dry-run                 Print the resolved plan without hitting the network',
    '  --list-providers          Print built-in adapters and exit',
    '  --help                    Show this help',
    '',
    'Config: .agentkit/config.yaml (project) or ~/.agentkit/config.yaml (global).',
    'Env:    .agentkit/.env       (project) or ~/.agentkit/.env       (global).',
  ].join('\n');
}

function listProviders() {
  const rows = Object.entries(ADAPTERS).map(([id, adapter]) => {
    const flag = isExperimental(id) ? ' (experimental)' : '';
    return `- ${id}${flag}: ${adapter.CHANNELS.join(', ')}`;
  });
  return ['Built-in providers:', ...rows].join('\n');
}

function loadContent(args) {
  if (args.content) return args.content;
  if (args.file) return fs.readFileSync(args.file, 'utf8').trim();
  throw new Error('Missing --content or --file');
}

function splitList(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function buildPlan(args, { config, envResolved, style }) {
  const channels = splitList(args.channels);
  if (channels.length === 0) throw new Error('Missing --channels');

  let routing;
  if (args.provider) {
    routing = Object.fromEntries(channels.map((c) => [c.toLowerCase(), args.provider]));
  } else {
    routing = routeChannels(channels, config);
  }
  const groups = groupByProvider(routing);
  return {
    scheduleAt: args.schedule || null,
    content: loadContent(args),
    mediaUrls: splitList(args.media),
    channels,
    routing,
    groups,
    style: style || null,
  };
}

async function run(argv) {
  const args = parseArgs(argv);
  if (args.help) { process.stdout.write(`${usage()}\n`); return 0; }
  if (args['list-providers']) { process.stdout.write(`${listProviders()}\n`); return 0; }

  const { merged: config } = resolveConfig();
  const envResolved = resolveEnv();
  const scrub = buildScrubber(envResolved.merged);
  const styleName = args.style || (config.social && config.social.default_style) || null;
  const { style } = styleName ? resolveWritingStyle(styleName) : { style: null };

  const plan = buildPlan(args, { config, envResolved, style });

  if (args['dry-run']) {
    process.stdout.write(`${renderDryRun(plan)}\n`);
    return 0;
  }

  const results = [];
  for (const [providerId, chs] of Object.entries(plan.groups)) {
    const adapter = ADAPTERS[providerId];
    if (!adapter) throw new Error(`Unknown provider "${providerId}". Configure one of: ${Object.keys(ADAPTERS).join(', ')}`);
    const payload = { channels: chs, content: plan.content, mediaUrls: plan.mediaUrls, scheduleAt: plan.scheduleAt };
    const opts = { env: envResolved, config: { social: config.social || {} } };
    const method = plan.scheduleAt ? 'schedule' : 'publish';
    try {
      const result = await adapter[method](payload, opts);
      results.push({ providerId, channels: chs, ...result });
    } catch (err) {
      results.push({ providerId, channels: chs, error: err.message, code: err.code || 'ERROR' });
    }
  }

  const summary = { ok: results.every((r) => !r.error), results };
  process.stdout.write(`${JSON.stringify(scrub(summary), null, 2)}\n`);
  return results.every((r) => !r.error) ? 0 : 1;
}

function renderDryRun(plan) {
  const lines = ['=== ak:social dry-run ==='];
  lines.push(`When:     ${plan.scheduleAt || 'now'}`);
  lines.push(`Channels: ${plan.channels.join(', ')}`);
  for (const [provider, chs] of Object.entries(plan.groups)) {
    const flag = isExperimental(provider) ? ' (experimental)' : '';
    lines.push(`  → ${provider}${flag}: ${chs.join(', ')}`);
  }
  lines.push(`Style:    ${plan.style ? plan.style.name : '(none)'}`);
  lines.push(`Media:    ${plan.mediaUrls.length ? plan.mediaUrls.join(', ') : '(none)'}`);
  lines.push('Content:');
  lines.push(plan.content.split('\n').map((l) => `  ${l}`).join('\n'));
  return lines.join('\n');
}

// Build a scrubber that sees both shell env and any secrets defined only in
// .env files, so an uncaught error thrown before or after the CLI's main
// scrubber is built still redacts file-only credentials in the fatal message.
function buildFatalScrubber() {
  try {
    const { merged } = resolveEnv();
    return buildScrubber(merged);
  } catch (_err) {
    return buildScrubber(process.env);
  }
}

if (require.main === module) {
  const scrubFatal = buildFatalScrubber();
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`Error: ${scrubFatal(err.message || String(err))}\n`);
      process.exit(1);
    },
  );
}

module.exports = { run, parseArgs, buildPlan, renderDryRun, listProviders, ADAPTERS };
