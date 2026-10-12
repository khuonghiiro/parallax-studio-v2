import { describe, expect, it } from 'vitest'
import {
  AssetTable,
  resolveAssetAlias,
  setAssetAliasInTable,
  removeAssetAliasFromTable,
  replaceAssetPathInTable,
  buildAssetTableFromItems,
  isAssetTable
} from './assetTable'

describe('assetTable utils', () => {
  it('correctly resolves aliases with or without @ prefix', () => {
    const table = {
      hero_head: 'character_cutout_demo/head.png',
      hero_torso: { path: 'character_cutout_demo/torso.png', quality: '4k' },
      sky: 'demo_transparent/layer1_sky.png'
    }

    // Resolves simple string alias
    expect(resolveAssetAlias('@hero_head', table)).toBe('character_cutout_demo/head.png')
    expect(resolveAssetAlias('hero_head', table)).toBe('character_cutout_demo/head.png')

    // Resolves object alias
    expect(resolveAssetAlias('@hero_torso', table)).toBe('character_cutout_demo/torso.png')
    expect(resolveAssetAlias('hero_torso', table)).toBe('character_cutout_demo/torso.png')

    // Fallback directly to path if not in table
    expect(resolveAssetAlias('assembly_3d/house/wall.png', table)).toBe('assembly_3d/house/wall.png')
    expect(resolveAssetAlias('@unknown_alias', table)).toBe('unknown_alias')
    expect(resolveAssetAlias('', table)).toBe('')
    expect(resolveAssetAlias(undefined, table)).toBe('')
  })

  it('sets and removes aliases properly', () => {
    let table: AssetTable = {
      bg: 'old_bg.png'
    }

    table = setAssetAliasInTable(table, 'hero', 'new_hero.png')
    expect(table.hero).toBe('new_hero.png')

    table = setAssetAliasInTable(table, '@hero_4k', { path: 'hero_4k.png', quality: '4k' })
    expect(table.hero_4k).toEqual({ path: 'hero_4k.png', quality: '4k' })

    table = removeAssetAliasFromTable(table, 'bg')
    expect(table.bg).toBeUndefined()
  })

  it('replaces asset paths globally in table', () => {
    const table = {
      layer1: 'assets/demo_transparent/layer1_sky.png',
      layer2: { path: 'demo_transparent/layer1_sky.png', quality: 'standard' },
      layer3: 'demo_transparent/layer2_mountain.png'
    }

    const { table: updated, replacedCount } = replaceAssetPathInTable(
      table,
      'demo_transparent/layer1_sky.png',
      'demo_transparent/layer1_sky_4k.png'
    )

    expect(replacedCount).toBe(2)
    expect(updated.layer1).toBe('demo_transparent/layer1_sky_4k.png')
    expect((updated.layer2 as any).path).toBe('demo_transparent/layer1_sky_4k.png')
    expect(updated.layer3).toBe('demo_transparent/layer2_mountain.png')
  })

  it('detects valid asset tables and builds from items', () => {
    expect(isAssetTable({ a: 'path/a.png', b: { path: 'path/b.png' } })).toBe(true)
    expect(isAssetTable(['not', 'an', 'object'])).toBe(false)
    expect(isAssetTable(null)).toBe(false)

    const items = [
      { name: 'Head Layer', assetPath: 'character_cutout_demo/head.png' },
      { name: 'Torso Layer', src: 'character_cutout_demo/torso.png' }
    ]
    const table = buildAssetTableFromItems(items)
    expect(table.head_layer).toBe('character_cutout_demo/head.png')
    expect(table.torso_layer).toBe('character_cutout_demo/torso.png')
  })
})
