import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_REGION, UI_REGION_SELECTORS, findActiveDialog, resolveTargetElement } from './uiRegions'

const RENDERER_ROOT = resolve(__dirname, '..')
const CATALOG_INDEX = resolve(__dirname, '../../../../mcp-server/catalog/index.mjs')

function listTsx(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') listTsx(full, acc)
    } else if (name.endsWith('.tsx')) acc.push(full)
  }
  return acc
}

/** Toàn bộ `data-mcp-region="..."` được khai báo trong mã giao diện. */
function declaredRegions(): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of listTsx(RENDERER_ROOT)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/data-mcp-region="([a-z0-9_]+)"/g)) found.set(m[1], file)
  }
  return found
}

async function catalogRegionEnum(): Promise<string[]> {
  const catalog = (await import(/* @vite-ignore */ pathToFileURL(CATALOG_INDEX).href)) as {
    findTool: (name: string) => unknown
    paramsJsonSchema: (tool: unknown, lang: string) => { properties: Record<string, { enum?: string[] }> }
  }
  const schema = catalog.paramsJsonSchema(catalog.findTool('get_app_screenshot'), 'en')
  return schema.properties.region.enum ?? []
}

describe('MCP UI region parity (bắt buộc khi tạo/sửa UI)', () => {
  it('every data-mcp-region used in TSX is registered in UI_REGION_SELECTORS', () => {
    const missing = [...declaredRegions()].filter(([name]) => !UI_REGION_SELECTORS[name])
    expect(missing.map(([name, file]) => `${name} (${file})`)).toEqual([])
  }, 30000)

  it('UI_REGION_SELECTORS and the get_app_screenshot catalog enum list exactly the same regions', async () => {
    const enumValues = new Set((await catalogRegionEnum()).filter((r) => r !== 'window'))
    const registry = new Set(Object.keys(UI_REGION_SELECTORS))
    expect([...registry].filter((r) => !enumValues.has(r))).toEqual([])
    expect([...enumValues].filter((r) => !registry.has(r))).toEqual([])
  }, 30000)

  it('registers the nested workshop dialogs so AI can crop them directly', () => {
    for (const name of [ACTIVE_REGION, 'layer_assembly_mixamo_studio', 'layer_assembly_parts', 'layer_assembly_swap', 'composite_swap']) {
      expect(UI_REGION_SELECTORS[name], name).toBeTruthy()
    }
  })
})

type FakeEl = HTMLElement & { _z: string }

function fakeEl(rect: { w: number; h: number }, z: string, cls: string, parent: FakeEl | null = null): FakeEl {
  return {
    className: cls,
    parentElement: parent,
    _z: z,
    getAttribute: () => null,
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, right: rect.w, bottom: rect.h, width: rect.w, height: rect.h })
  } as unknown as FakeEl
}

describe('findActiveDialog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('prefers the nested dialog that sits on top of the workshop dialog', () => {
    const workshop = fakeEl({ w: 1900, h: 1000 }, '10000', 'layer-workshop-dialog')
    const mixamo = fakeEl({ w: 1260, h: 860 }, '20000', 'lw-mixamo-motion-modal')
    vi.stubGlobal('getComputedStyle', (el: FakeEl) => ({ visibility: 'visible', zIndex: el._z }))
    const doc = { querySelectorAll: () => [workshop, mixamo] } as unknown as Document
    expect(findActiveDialog(doc)).toBe(mixamo)
  })

  it('uses DOM order for equal z-index and ignores tiny or hidden elements', () => {
    const a = fakeEl({ w: 800, h: 600 }, 'auto', 'modal')
    const b = fakeEl({ w: 600, h: 400 }, 'auto', 'modal', a)
    const tiny = fakeEl({ w: 20, h: 20 }, '99999', 'modal')
    vi.stubGlobal('getComputedStyle', (el: FakeEl) => ({ visibility: 'visible', zIndex: el._z }))
    const doc = { querySelectorAll: () => [a, b, tiny] } as unknown as Document
    expect(findActiveDialog(doc)).toBe(b)
  })

  it('falls back to data-mcp-region for unknown region names', () => {
    const el = fakeEl({ w: 300, h: 200 }, 'auto', 'x')
    vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', zIndex: 'auto' }))
    vi.stubGlobal('document', {
      querySelector: (sel: string) => (sel === '[data-mcp-region="brand_new_panel"]' ? el : null)
    })
    expect(resolveTargetElement('brand_new_panel')).toBe(el)
  })
})
