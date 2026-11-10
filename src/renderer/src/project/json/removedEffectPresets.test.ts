import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import { buildSingleLayer } from './layerBuilder'

describe('removed embedded effect presets', () => {
  it.each(['mist', 'rain', 'twilight_mist', 'magic_portal'])('rejects effect:%s before changing assets', async (effect) => {
    const project = createProject()
    const assets = [...project.assets]
    await expect(buildSingleLayer({ name: 'Effect', src: `effect:${effect}` }, project.comp, project))
      .rejects.toThrow('Preset ảnh hiệu ứng nhúng đã được loại bỏ')
    expect(project.assets).toEqual(assets)
  })

  it('rejects legacy effect properties and aliases with a migration message', async () => {
    const project = createProject()
    const legacy = { name: 'Fog', effect: 'mist' }
    await expect(buildSingleLayer(legacy, project.comp, project)).rejects.toThrow('asset/src')
    await expect(buildSingleLayer({ name: 'Fog', asset: '@fog' }, project.comp, project, { fog: 'effect:mist' }))
      .rejects.toThrow('asset/src')
  })
})
