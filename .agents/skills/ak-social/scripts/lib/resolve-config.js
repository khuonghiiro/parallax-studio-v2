'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ConfigError } = require('./errors');

const PROJECT_REL = path.join('.agentkit', 'config.yaml');
const HOME_REL = path.join('.agentkit', 'config.yaml');

function agentkitHome({ home = null, env = process.env } = {}) {
  const override = env.AGENTKIT_HOME && env.AGENTKIT_HOME.trim();
  if (override) return override;
  return path.join(home || os.homedir(), '.agentkit');
}

function candidateConfigPaths({ cwd = process.cwd(), home = null, env = process.env } = {}) {
  return {
    project: path.join(cwd, PROJECT_REL),
    global: path.join(agentkitHome({ home, env }), 'config.yaml'),
  };
}

// Minimal YAML subset: top-level keys (`key:` or `key: value`), nested maps by
// indentation (2 spaces), list items as `- value`, plus strings, numbers,
// booleans, and null. Sufficient for the AgentKit config surface documented in
// references/config-schema.md; anything richer belongs in a full YAML lib we do
// not want as a dependency.
function parseYaml(source, filePath) {
  const lines = source.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, container: root, key: null }];

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const stripped = rawLine.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!stripped.trim()) continue;

    const indent = stripped.match(/^ */)[0].length;
    if (indent % 2 !== 0) {
      throw new ConfigError(`odd indentation on line ${idx + 1}`, filePath);
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    const trimmed = stripped.trim();

    // List item under a key that expects an array.
    if (trimmed.startsWith('- ') || trimmed === '-') {
      const value = trimmed === '-' ? null : coerceScalar(trimmed.slice(2));
      if (!Array.isArray(parent.container)) {
        throw new ConfigError(`unexpected list item on line ${idx + 1}`, filePath);
      }
      parent.container.push(value);
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!match) {
      throw new ConfigError(`cannot parse line ${idx + 1}: ${trimmed}`, filePath);
    }
    const key = match[1];
    const rest = match[2];

    if (!rest) {
      // Look ahead to decide list vs map.
      const nextLine = findNextContent(lines, idx + 1);
      let nested;
      if (nextLine && nextLine.indent > indent && nextLine.trimmed.startsWith('- ')) {
        nested = [];
      } else {
        nested = {};
      }
      addChild(parent.container, key, nested, filePath, idx);
      stack.push({ indent, container: nested, key });
      continue;
    }

    addChild(parent.container, key, coerceScalar(rest), filePath, idx);
  }

  return root;
}

function findNextContent(lines, startIdx) {
  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i].replace(/#.*$/, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    return { indent: line.match(/^ */)[0].length, trimmed: line.trim() };
  }
  return null;
}

function addChild(container, key, value, filePath, idx) {
  if (Array.isArray(container)) {
    throw new ConfigError(`cannot add key "${key}" to a list (line ${idx + 1})`, filePath);
  }
  container[key] = value;
}

function coerceScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '~' || trimmed.toLowerCase() === 'null') return null;
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d*\.\d+$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readYamlIfExists(filePath, { fsImpl = fs, onWarn = null } = {}) {
  let src;
  try {
    src = fsImpl.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw err;
  }
  try {
    return parseYaml(src, filePath);
  } catch (err) {
    // The global config is often shared with unrelated kits; a parse error
    // from a YAML feature this minimal parser does not handle must not
    // crash a specific skill. Warn once and behave as if no config was set.
    const msg = `[ak:social] warning: skipping config "${filePath}" (${err.message}). ak:social keys ignored; other kits unaffected.`;
    if (typeof onWarn === 'function') onWarn(msg);
    else process.stderr.write(`${msg}\n`);
    return {};
  }
}

function mergeShallow(global, project) {
  const merged = { ...global };
  for (const [key, value] of Object.entries(project || {})) {
    if (value === undefined) continue;
    merged[key] = value;
  }
  return merged;
}

function resolveConfig({ cwd = process.cwd(), home = null, env = process.env, fsImpl = fs, onWarn = null } = {}) {
  const paths = candidateConfigPaths({ cwd, home, env });
  const global = readYamlIfExists(paths.global, { fsImpl, onWarn });
  const project = readYamlIfExists(paths.project, { fsImpl, onWarn });
  const merged = mergeShallow(global, project);
  return { merged, sources: paths, global, project };
}

module.exports = {
  resolveConfig,
  candidateConfigPaths,
  agentkitHome,
  parseYaml,
  mergeShallow,
};
