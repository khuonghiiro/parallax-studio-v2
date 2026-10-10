const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateSitemap } = require('./generate-sitemap.cjs');

test('escapes loc values and omits missing lastmod', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-'));
  const out = path.join(dir, 'sitemap.xml');
  const log = console.log;
  console.log = () => {};
  try {
    generateSitemap('https://example.com', [
      { url: '/search?q=a&b=<c>', lastmod: '2026-01-01' },
      { url: '/undated' },
    ], out);
    const xml = fs.readFileSync(out, 'utf8');
    assert.match(xml, /<loc>https:\/\/example\.com\/search\?q=a&amp;b=&lt;c&gt;<\/loc>/);
    assert.equal(xml.match(/<lastmod>/g).length, 1, 'undated pages omit lastmod');
    assert.match(xml, /<lastmod>2026-01-01<\/lastmod>/);
  } finally {
    console.log = log;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
