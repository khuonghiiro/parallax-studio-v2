import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runCommand } from '../commands'
import { registerAssemblySession } from '../../ui/assets/models3d/assemblyBridge'
import { modelFromTemplate } from '../../ui/assets/models3d/templateCatalogue'
import { IMAGE_MESH_TEMPLATES } from '../../ui/assets/models3d/imageMeshTemplates'

describe('MCP image mesh templates', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('exposes render prompts, repeat mappings and geometry variants', async () => {
    const guide = await runCommand('get_assembly_template', { template_id: 'mesh-flower', variant_id: 'wide' }) as any
    expect(guide.slots.find((s: any) => s.id === 'petal').faceIndices).toHaveLength(6)
    expect(guide.slots[0].renderPrompt).toContain('2:3')
    expect(guide.faces.find((f: any) => f.imageSlot === 'petal').width).toBe(208)
    await expect(runCommand('get_assembly_template', { template_id: 'missing' })).rejects.toThrow()
  })

  it('binds slots atomically in the active session, preserves existing faces on append and refines mesh', async () => {
    let model = modelFromTemplate(IMAGE_MESH_TEMPLATES[0])
    const original = model.faces[0]
    original.assetPath = 'original.png'
    const off = registerAssemblySession({ getModel: () => model, setModel: (next) => { model = next },
      getSelectedFaceId: () => model.faces[0].id, setSelectedFaceId: () => {}, save: () => {}, insert: async () => [], close: () => {} })
    try {
      await runCommand('apply_assembly_template', { template_id: 'mesh-leaf', mode: 'append', images: { leaf: 'new.png' } })
      expect(model.faces).toHaveLength(2)
      expect(model.faces[0]).toEqual(original)
      expect(model.faces[1].assetPath).toBe('new.png')
      const before = model
      await expect(runCommand('apply_assembly_template', { template_id: 'mesh-flower', images: { wrong: 'x.png' } })).rejects.toThrow()
      expect(model).toBe(before)
      const id = model.faces[1].id
      model.faces[1].gridCols = 8
      model.faces[1].gridRows = 12
      await runCommand('update_assembly_face', { face_id: id, grid_res: 64, bend_x: 15, depth_profile: 'ridge', depth_intensity: 20 })
      expect(model.faces[1]).toMatchObject({ gridRes: 64, bendX: 15, depthProfile: 'ridge', depthIntensity: 20 })
      expect(model.faces[1].gridCols).toBeUndefined()
      expect(model.faces[1].gridRows).toBeUndefined()
      await expect(runCommand('update_assembly_face', { face_id: id, grid_res: 999 })).rejects.toThrow()
      await expect(runCommand('update_assembly_face', { face_id: 'missing', bend_x: 10 })).rejects.toThrow()
    } finally { off() }
  })
})
