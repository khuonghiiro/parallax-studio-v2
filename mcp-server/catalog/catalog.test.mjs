/**
 * Guards the bilingual MCP docs: English and Vietnamese must describe exactly the same tools,
 * parameters, types and guide structure — only the wording may differ.
 */
import { describe, expect, it } from 'vitest'
import { GUIDE, TOOLS, paramsJsonSchema, renderGuide, resolveDocsLang, serverInstructions, toolDescription } from './index.mjs'

/** Removes every `description` so EN/VI schemas can be compared structurally. */
function stripDescriptions(node) {
  if (Array.isArray(node)) return node.map(stripDescriptions)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) if (k !== 'description') out[k] = stripDescriptions(v)
    return out
  }
  return node
}

/** Paths of every node carrying a description. */
function describedPaths(node, path = '', acc = []) {
  if (Array.isArray(node)) node.forEach((v, i) => describedPaths(v, `${path}[${i}]`, acc))
  else if (node && typeof node === 'object') {
    if (typeof node.description === 'string') acc.push(path)
    for (const [k, v] of Object.entries(node)) if (k !== 'description') describedPaths(v, `${path}.${k}`, acc)
  }
  return acc
}

describe('bilingual MCP catalogue', () => {
  it('has unique tool names and a matching tool count in guide.json', () => {
    const names = TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(GUIDE.toolCount).toBe(TOOLS.length)
  })

  it('every tool has non-empty, different EN and VI descriptions and a known category', () => {
    for (const tool of TOOLS) {
      const en = toolDescription(tool, 'en')
      const vi = toolDescription(tool, 'vi')
      expect(en.trim(), tool.name).not.toBe('')
      expect(vi.trim(), tool.name).not.toBe('')
      expect(vi, `${tool.name} VI doc is a copy of EN`).not.toBe(en)
      expect(GUIDE.categories[tool.cat], `${tool.name} category ${tool.cat}`).toBeDefined()
    }
  })

  it('EN and VI parameter schemas are structurally identical', () => {
    for (const tool of TOOLS) {
      const en = paramsJsonSchema(tool, 'en')
      const vi = paramsJsonSchema(tool, 'vi')
      expect(stripDescriptions(vi), tool.name).toEqual(stripDescriptions(en))
      expect(describedPaths(vi), tool.name).toEqual(describedPaths(en))
      for (const path of describedPaths(en)) {
        const pick = (root) => path.split(/\.|\[|\]/).filter(Boolean).reduce((n, k) => n[k], root)
        expect(pick(vi).description.trim(), `${tool.name}${path}`).not.toBe('')
      }
    }
  })

  it('examples are valid JSON', () => {
    for (const tool of TOOLS.filter((t) => t.example)) expect(() => JSON.parse(tool.example), tool.name).not.toThrow()
  })

  it('guide sections have the same number of EN and VI lines', () => {
    for (const s of GUIDE.sections) {
      expect(s.title.en && s.title.vi, s.id).toBeTruthy()
      expect(s.lines.vi.length, s.id).toBe(s.lines.en.length)
      expect(s.lines.en.every((l) => l.trim()), s.id).toBe(true)
      expect(s.lines.vi.every((l) => l.trim()), s.id).toBe(true)
    }
    for (const lang of ['en', 'vi']) for (const c of Object.values(GUIDE.categories)) expect(c[lang]).toBeTruthy()
  })

  it('every tool named in the guide exists', () => {
    const names = new Set(TOOLS.map((t) => t.name))
    for (const lang of ['en', 'vi']) {
      const mentioned = renderGuide(lang).match(/\b[a-z]+(?:_[a-z0-9]+)+\b/g) ?? []
      const toolish = mentioned.filter((m) => /^(get|set|add|list|apply|save|append|insert|auto|build|export|camera|update|delete)_/.test(m))
      for (const m of toolish) expect(names.has(m), `${lang}: ${m}`).toBe(true)
    }
  })

  it('renders the guide per language and topic; docs language defaults to English', () => {
    expect(renderGuide('en', 'assembly')).toMatch(/^## Modular 3D assembly/)
    expect(renderGuide('vi', 'assembly')).toMatch(/^## Lắp ráp 3D dạng mô-đun/)
    expect(() => renderGuide('en', 'nope')).toThrow(/Unknown guide topic/)
    expect(serverInstructions('vi')).toContain('tiếng Việt')
    const prev = process.env.PARALLAX_MCP_LANG
    delete process.env.PARALLAX_MCP_LANG
    try {
      expect(resolveDocsLang(null)).toBe('en')
      expect(resolveDocsLang({ docsLang: 'vi' })).toBe('vi')
      process.env.PARALLAX_MCP_LANG = 'en'
      expect(resolveDocsLang({ docsLang: 'vi' })).toBe('en')
    } finally {
      if (prev === undefined) delete process.env.PARALLAX_MCP_LANG
      else process.env.PARALLAX_MCP_LANG = prev
    }
  })
})
