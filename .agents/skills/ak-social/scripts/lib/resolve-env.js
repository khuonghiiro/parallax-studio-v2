'use strict';

const fs = require('fs');
const path = require('path');
const { agentkitHome } = require('./resolve-config');

const PROJECT_REL = path.join('.agentkit', '.env');

function candidateEnvPaths({ cwd = process.cwd(), home = null, env = process.env } = {}) {
  return {
    project: path.join(cwd, PROJECT_REL),
    global: path.join(agentkitHome({ home, env }), '.env'),
  };
}

function parseDotenv(source) {
  const out = {};
  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readDotenvIfExists(filePath, { fsImpl = fs } = {}) {
  try {
    return parseDotenv(fsImpl.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw err;
  }
}

// Precedence, lowest to highest: global .env < project .env < shell env.
// A value already set in the incoming shell env always wins so operators can
// override on a single invocation without editing files.
function resolveEnv({
  cwd = process.cwd(),
  home = null,
  env = process.env,
  fsImpl = fs,
  apply = false,
} = {}) {
  const paths = candidateEnvPaths({ cwd, home, env });
  const global = readDotenvIfExists(paths.global, { fsImpl });
  const project = readDotenvIfExists(paths.project, { fsImpl });

  const merged = { ...global, ...project };
  for (const key of Object.keys(env)) {
    if (env[key] !== undefined && env[key] !== '') merged[key] = env[key];
  }

  const loadedFrom = [];
  if (Object.keys(global).length) loadedFrom.push(paths.global);
  if (Object.keys(project).length) loadedFrom.push(paths.project);

  if (apply) {
    for (const [key, value] of Object.entries(merged)) {
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }

  return { merged, sources: paths, global, project, loadedFrom };
}

module.exports = { resolveEnv, candidateEnvPaths, parseDotenv };
