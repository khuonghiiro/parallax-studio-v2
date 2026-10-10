'use strict';

const fs = require('fs');
const path = require('path');
const { agentkitHome, parseYaml } = require('./resolve-config');

const PROJECT_DIR_REL = path.join('assets', 'writing-styles');
const HOME_DIR_REL = 'writing-styles';

const SUPPORTED = new Set(['.yaml', '.yml', '.md']);

function candidateStyleDirs({ cwd = process.cwd(), home = null, env = process.env } = {}) {
  return {
    project: path.join(cwd, PROJECT_DIR_REL),
    global: path.join(agentkitHome({ home, env }), HOME_DIR_REL),
  };
}

function safeReaddir(dir, { fsImpl = fs } = {}) {
  try {
    return fsImpl.readdirSync(dir);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return [];
    throw err;
  }
}

function extractFrontmatter(source) {
  if (!source.startsWith('---')) return null;
  const end = source.indexOf('\n---', 3);
  if (end < 0) return null;
  const body = source.slice(3, end).replace(/^\r?\n/, '');
  try {
    return parseYaml(body, null);
  } catch (_err) {
    return null;
  }
}

function parseStyleFile(filePath, source) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    const doc = parseYaml(source, filePath);
    return normalizeStyle(doc, filePath);
  }
  if (ext === '.md') {
    const fm = extractFrontmatter(source) || {};
    fm.body = source.replace(/^---[\s\S]*?\n---\r?\n?/, '').trim();
    return normalizeStyle(fm, filePath);
  }
  return null;
}

function normalizeStyle(doc, filePath) {
  if (!doc || typeof doc !== 'object') return null;
  const name = doc.name || (filePath ? path.basename(filePath, path.extname(filePath)) : null);
  return {
    name,
    description: doc.description || '',
    dimensions: doc.dimensions || {},
    patterns: doc.patterns || [],
    avoid: doc.avoid || [],
    examples: doc.examples || [],
    body: doc.body || '',
    source: filePath,
    raw: doc,
  };
}

function listStyles({ cwd = process.cwd(), home = null, env = process.env, fsImpl = fs } = {}) {
  const dirs = candidateStyleDirs({ cwd, home, env });
  const out = new Map(); // name → descriptor (project wins on collision)
  const order = [dirs.global, dirs.project];
  for (const dir of order) {
    for (const entry of safeReaddir(dir, { fsImpl })) {
      const ext = path.extname(entry).toLowerCase();
      if (!SUPPORTED.has(ext)) continue;
      const filePath = path.join(dir, entry);
      let source;
      try {
        source = fsImpl.readFileSync(filePath, 'utf8');
      } catch (_err) {
        continue;
      }
      const style = parseStyleFile(filePath, source);
      if (style && style.name) out.set(style.name, style);
    }
  }
  return { styles: [...out.values()], sources: dirs };
}

function resolveWritingStyle(name, opts = {}) {
  const { styles, sources } = listStyles(opts);
  if (!name) return { style: null, sources, available: styles.map((s) => s.name) };
  const match = styles.find((s) => s.name === name);
  return { style: match || null, sources, available: styles.map((s) => s.name) };
}

module.exports = { resolveWritingStyle, listStyles, candidateStyleDirs };
