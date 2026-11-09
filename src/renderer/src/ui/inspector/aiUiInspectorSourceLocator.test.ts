import { describe, it, expect, afterEach } from 'vitest'
import {
  buildShortDomPath,
  findCssSourcesForClasses,
  parseAiSourceRef,
  pickIdentityClasses,
  readDomSourceLocation,
  readFiberPropsSource
} from './aiUiInspectorSourceLocator'

function fakeEl(attrs: Record<string, string>, extra: Partial<Record<string, unknown>> = {}): Element {
  return {
    tagName: (extra.tagName as string) || 'DIV',
    id: (extra.id as string) || '',
    classList: (extra.classList as string[]) || [],
    parentElement: (extra.parentElement as Element) || null,
    getAttribute: (k: string) => attrs[k] ?? null,
    closest: (extra.closest as (s: string) => Element | null) || (() => null)
  } as unknown as Element
}

describe('aiUiInspectorSourceLocator', () => {
  const originalDocument = (globalThis as { document?: unknown }).document
  afterEach(() => {
    ;(globalThis as { document?: unknown }).document = originalDocument
  })

  it('parseAiSourceRef tách file:dòng:cột và bỏ qua giá trị sai', () => {
    expect(parseAiSourceRef('src/renderer/src/ui/A.tsx:12:5')).toEqual({
      file: 'src/renderer/src/ui/A.tsx',
      line: 12,
      column: 5,
      ref: 'src/renderer/src/ui/A.tsx:12'
    })
    expect(parseAiSourceRef('nope')).toBeNull()
    expect(parseAiSourceRef(null)).toBeNull()
  })

  it('đọc data-ai-src từ chính phần tử hoặc tổ tiên gần nhất, và từ props fiber', () => {
    const own = fakeEl({ 'data-ai-src': 'src/renderer/src/ui/B.tsx:40:3' })
    expect(readDomSourceLocation(own)?.ref).toBe('src/renderer/src/ui/B.tsx:40')
    const host = fakeEl({ 'data-ai-src': 'src/renderer/src/ui/C.tsx:7:1' })
    const child = fakeEl({}, { closest: () => host })
    expect(readDomSourceLocation(child)?.ref).toBe('src/renderer/src/ui/C.tsx:7')
    expect(readFiberPropsSource({ 'data-ai-src': 'src/renderer/src/ui/D.tsx:9:2' })).toBe('src/renderer/src/ui/D.tsx:9')
    expect(readFiberPropsSource({})).toBeNull()
  })

  it('pickIdentityClasses bỏ class trạng thái & nội bộ inspector', () => {
    expect(pickIdentityClasses(['active', 'tb-btn', 'is-on', 'ai-ui-x', 'lw-row'])).toEqual(['tb-btn', 'lw-row'])
  })

  it('findCssSourcesForClasses tìm file CSS + dòng từ <style data-vite-dev-id> khi dev', () => {
    const css = '/* head */\n.foo { color: red; }\n\n.tb-btn:hover,\n.tb-btn.active { color: blue; }\n'
    ;(globalThis as { document?: unknown }).document = {
      querySelectorAll: () => [
        {
          getAttribute: () => 'D:/proj/src/renderer/src/styles/toolbar.css',
          textContent: css
        }
      ]
    }
    expect(findCssSourcesForClasses(['tb-btn'])).toEqual(['src/renderer/src/styles/toolbar.css:4 (.tb-btn)'])
    expect(findCssSourcesForClasses(['tb'])).toEqual([])
  })

  it('buildShortDomPath dừng tại vùng data-mcp-region gần nhất', () => {
    const region = fakeEl({ 'data-mcp-region': 'toolbar' }, { tagName: 'HEADER' })
    const group = fakeEl({}, { tagName: 'DIV', classList: ['tb-group'], parentElement: region })
    const btn = fakeEl({}, { tagName: 'BUTTON', classList: ['active', 'tb-btn'], parentElement: group })
    expect(buildShortDomPath(btn)).toBe('[data-mcp-region="toolbar"] > div.tb-group > button.tb-btn')
  })
})
