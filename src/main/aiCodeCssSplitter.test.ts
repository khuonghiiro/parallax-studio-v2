import { describe, expect, it } from 'vitest'
import { splitOversizedCss } from './aiCodeCssSplitter'

describe('splitOversizedCss', () => {
  it('returns null when file <= 1000 lines', () => {
    const css = Array.from({ length: 500 }, (_, i) => `.rule-${i} { color: red; }`).join('\n')
    expect(splitOversizedCss('src/renderer/src/styles/small.css', css)).toBeNull()
  })

  it('returns null for exactly 1000 lines', () => {
    const css = Array.from({ length: 1000 }, (_, i) => `.rule-${i} { color: red; }`).join('\n')
    expect(splitOversizedCss('src/renderer/src/styles/exact.css', css)).toBeNull()
  })

  it('splits a 1500-line CSS into main + part file(s)', () => {
    const lines: string[] = []
    for (let i = 0; i < 1500; i++) {
      lines.push(`.rule-${i} {`)
      lines.push(`  color: red;`)
      lines.push(`}`)
      lines.push('')
    }
    const css = lines.join('\n')
    const result = splitOversizedCss('src/renderer/src/styles/big.css', css)
    expect(result).not.toBeNull()
    expect(result!.parts.length).toBeGreaterThanOrEqual(1)
    // File gốc phải <= 1000 dòng
    expect(result!.main.split('\n').length).toBeLessThanOrEqual(1000)
    // File gốc phải có @import
    expect(result!.main).toContain("@import './big-part")
    // Mỗi file phụ phải có đường dẫn đúng
    for (const part of result!.parts) {
      expect(part.path).toMatch(/^src\/renderer\/src\/styles\/big-part\d+\.css$/)
      expect(part.content.length).toBeGreaterThan(0)
    }
    // Ghép lại phải chứa toàn bộ rule gốc
    const allContent = result!.main + '\n' + result!.parts.map((p) => p.content).join('\n')
    expect(allContent).toContain('.rule-0')
    expect(allContent).toContain('.rule-1499')
  })

  it('preserves @import header in main file', () => {
    const lines = [
      "@import './variables.css';",
      "@import './mixins.css';",
      '',
      ...Array.from({ length: 1200 }, (_, i) => `.header-rule-${i} { display: block; }\n`)
    ]
    const css = lines.join('\n')
    const result = splitOversizedCss('src/renderer/src/styles/withImport.css', css)
    expect(result).not.toBeNull()
    // File gốc phải giữ @import gốc
    expect(result!.main).toContain("@import './variables.css';")
    expect(result!.main).toContain("@import './mixins.css';")
    // Và có @import mới cho file phụ
    expect(result!.main).toContain("@import './withImport-part")
  })

  it('handles deeply nested CSS without infinite loop', () => {
    const lines: string[] = []
    // Tạo CSS có nested @media/@keyframes khiến depth > 0
    for (let i = 0; i < 400; i++) {
      lines.push(`@media (min-width: ${i}px) {`)
      lines.push(`  .nested-${i} { color: blue; }`)
      lines.push('}')
      lines.push('')
    }
    const css = lines.join('\n')
    // 400 * 4 = 1600 dòng → sẽ bị tách
    const result = splitOversizedCss('src/renderer/src/styles/nested.css', css)
    expect(result).not.toBeNull()
    expect(result!.main.split('\n').length).toBeLessThanOrEqual(1000)
  })

  it('part paths use forward slashes', () => {
    const lines = Array.from({ length: 1200 }, (_, i) => `.x-${i} { margin: 0; }`).join('\n')
    const result = splitOversizedCss('src/renderer/src/styles/sub/deep.css', lines)
    expect(result).not.toBeNull()
    for (const part of result!.parts) {
      expect(part.path).not.toContain('\\')
      expect(part.path).toMatch(/^src\/renderer\/src\/styles\/sub\/deep-part\d+\.css$/)
    }
  })
})

