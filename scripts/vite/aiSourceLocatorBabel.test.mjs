import { describe, it, expect } from 'vitest'
import { transformSync } from '@babel/core'
import aiSourceLocatorBabelPlugin, { aiSourceBabelOptions, toProjectRelativeSource } from './aiSourceLocatorBabel.mjs'

const FILE = 'D:/proj/src/renderer/src/ui/Demo.tsx'

function run(code, filename = FILE) {
  return transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [aiSourceLocatorBabelPlugin]
  }).code
}

describe('aiSourceLocatorBabel', () => {
  it('skips data modules while retaining JSX source locations', () => {
    expect(aiSourceBabelOptions('src/renderer/src/project/largeData.ts').plugins).toEqual([])
    for (const file of ['Demo.tsx', 'Demo.jsx', 'Demo.tsx?import']) {
      expect(aiSourceBabelOptions(file).plugins).toEqual([aiSourceLocatorBabelPlugin])
    }
  })
  it('chuẩn hoá đường dẫn về src/renderer/src và bỏ qua node_modules / file ngoài renderer', () => {
    expect(toProjectRelativeSource('D:\\a\\b\\src\\renderer\\src\\ui\\X.tsx')).toBe('src/renderer/src/ui/X.tsx')
    expect(toProjectRelativeSource('D:/a/node_modules/lib/src/renderer/src/x.tsx')).toBeNull()
    expect(toProjectRelativeSource('D:/a/src/main/index.ts')).toBeNull()
    expect(toProjectRelativeSource(null)).toBeNull()
  })

  it('gắn data-ai-src file:dòng:cột cho thẻ HTML và call-site component', () => {
    const out = run('const A = () => (\n  <div className="x">\n    <Switch on />\n  </div>\n)')
    expect(out).toContain('data-ai-src="src/renderer/src/ui/Demo.tsx:2:3"')
    expect(out).toContain('data-ai-src="src/renderer/src/ui/Demo.tsx:3:5"')
  })

  it('bỏ qua Fragment, Provider (member expr), thẻ SVG con và không ghi đè data-ai-src có sẵn', () => {
    const out = run(
      'const A = () => (<Fragment><Ctx.Provider value={1}><svg><path d="M0" /></svg><b data-ai-src="keep" /></Ctx.Provider></Fragment>)'
    )
    expect(out).not.toMatch(/Fragment data-ai-src/)
    expect(out).not.toMatch(/Provider[^>]*data-ai-src/)
    expect(out).not.toMatch(/<path[^>]*data-ai-src/)
    expect(out).toMatch(/<svg data-ai-src=/)
    expect(out).toContain('data-ai-src="keep"')
    expect(out.match(/data-ai-src/g)?.length).toBe(2)
  })

  it('không đụng file nằm ngoài src/renderer/src', () => {
    const out = run('const A = () => <div />', 'D:/proj/src/main/x.tsx')
    expect(out).not.toContain('data-ai-src')
  })
})
