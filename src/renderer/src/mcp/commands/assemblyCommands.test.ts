import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'
import { registerAssemblySession } from '../../ui/assets/models3d/assemblyBridge'
import type { Model3D } from '../../ui/assets/models3d/types'

describe('MCP assemblyCommands', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      }
    }
    ;(globalThis as any).localStorage = mockLocalStorage
    ;(globalThis as any).window = {
      api: {
        getBuiltInCatalog: async () => ({ items: [], categories: [], manifestPath: '', rawJson: '' }),
        asset3ds: { list: async () => [] }
      }
    }
    const proj = createProject()
    useEditor.getState().loadProject(proj, null)
  })

  it('runs list_models3d and returns default preset models', async () => {
    const res = (await runCommand('list_models3d')) as any
    expect(res.count).toBeGreaterThan(0)
    expect(Array.isArray(res.models)).toBe(true)
    const cottage = res.models.find((m: any) => m.id === 'model-tudor-cottage')
    expect(cottage).toBeDefined()
    expect(cottage.name).toContain('Tudor')
  })

  it('runs get_model3d for specific model', async () => {
    const res = (await runCommand('get_model3d', { id: 'model-tudor-cottage' })) as any
    expect(res.model).toBeDefined()
    expect(res.model.id).toBe('model-tudor-cottage')
    expect(res.model.faces.length).toBeGreaterThan(0)
  })

  it('interacts with active assembly session via assemblyBridge', async () => {
    let mockModel: Model3D = {
      id: 'test-session-model',
      name: 'Session Model',
      category: 'architecture',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scale: 1.0,
      faces: [
        {
          id: 'face-a',
          name: 'Mặt A',
          width: 500,
          height: 500,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        },
        {
          id: 'face-b',
          name: 'Mặt B',
          width: 500,
          height: 500,
          position: [500, 0, 0],
          rotation: [0, 90, 0]
        }
      ]
    }
    let selectedId: string | null = 'face-a'

    // Register active mock session
    const unregister = registerAssemblySession({
      getModel: () => mockModel,
      setModel: (next) => {
        mockModel = next
      },
      getSelectedFaceId: () => selectedId,
      setSelectedFaceId: (id) => {
        selectedId = id
      },
      save: () => {},
      insert: async () => ['mock-layer-1'],
      close: () => {},
      captureScreenshot: () => 'data:image/png;base64,mock-base64-png'
    })

    try {
      // 1. Check get_assembly_state
      const state = (await runCommand('get_assembly_state')) as any
      expect(state.isOpen).toBe(true)
      expect(state.selectedFaceId).toBe('face-a')
      expect(state.faceCount).toBe(2)

      // 2. Add face to active session
      const addRes = (await runCommand('add_assembly_face', {
        name: 'Mặt C',
        width: 300,
        height: 400
      })) as any
      expect(addRes.ok).toBe(true)
      expect(mockModel.faces.length).toBe(3)
      expect(mockModel.faces[2].name).toBe('Mặt C')

      // 3. Update face
      const updateRes = (await runCommand('update_assembly_face', {
        face_id: mockModel.faces[2].id,
        name: 'Mặt C Cập Nhật',
        hidden: true
      })) as any
      expect(updateRes.ok).toBe(true)
      expect(mockModel.faces[2].name).toBe('Mặt C Cập Nhật')
      expect(mockModel.faces[2].hidden).toBe(true)

      // 4. Set lighting
      const lightRes = (await runCommand('set_assembly_lighting', {
        preset: 'sunset',
        shadows: true
      })) as any
      expect(lightRes.ok).toBe(true)
      expect(mockModel.lighting?.preset).toBe('sunset')
      expect(mockModel.lighting?.shadows).toBe(true)

      // 5. Join faces
      const joinRes = (await runCommand('join_assembly_faces', {
        target_id: 'face-a',
        source_id: 'face-b',
        target_edge: 'right',
        source_edge: 'left',
        angle: 90
      })) as any
      expect(joinRes.ok).toBe(true)

      // 6. Apply assembly template
      const tplRes = (await runCommand('apply_assembly_template', {
        template_id: 'box',
        mode: 'replace'
      })) as any
      expect(tplRes.ok).toBe(true)
      expect(mockModel.faces.length).toBe(6)

      // 7. Auto clip
      const clipRes = (await runCommand('auto_assembly_clip')) as any
      expect(clipRes.ok).toBe(true)

      // 8. Delete face
      const delRes = (await runCommand('delete_assembly_face', {
        face_id: mockModel.faces[0].id
      })) as any
      expect(delRes.ok).toBe(true)
      expect(mockModel.faces.length).toBe(5)

      // 9. Screenshot active workshop
      const snapRes = (await runCommand('get_assembly_screenshot')) as any
      expect(snapRes.mime).toBe('image/png')
      expect(snapRes.data).toBe('mock-base64-png')
    } finally {
      unregister()
    }
  })

  it('inserts assembly model into project layers via insert_assembly_model', async () => {
    const res = (await runCommand('insert_assembly_model', {
      model_id: 'model-cubic-box',
      global_scale: 0.8
    })) as any

    expect(res.ok).toBe(true)
    expect(res.count).toBeGreaterThan(0)
    expect(res.insertedLayerIds.length).toBe(res.count)

    const layers = useEditor.getState().project.layers
    expect(layers.length).toBe(res.count)
    expect(layers[0].name).toContain('Khối Hộp Diêm')
  })

  it('lists templates with bilingual labels and filters by category', async () => {
    const all = (await runCommand('list_assembly_templates')) as any
    expect(all.count).toBe(all.templates.length)
    expect(all.categories.map((c: any) => c.id)).toContain('decor')
    const decor = (await runCommand('list_assembly_templates', { category: 'decor' })) as any
    expect(decor.count).toBeGreaterThanOrEqual(12)
    for (const t of decor.templates) {
      expect(t.category).toBe('decor')
      expect(t.label_en).toBeTruthy()
      expect(t.anchor).toBeTruthy()
      expect(t.faceCount).toBeGreaterThan(0)
    }
    await expect(runCommand('list_assembly_templates', { category: 'nope' })).rejects.toThrow(/Unknown category/)
  })

  it('appends a saved model onto a face of the open session, or at a point', async () => {
    let mockModel: Model3D = {
      id: 'shell',
      name: 'Shell',
      category: 'architecture',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scale: 1,
      faces: [{ id: 'front', name: 'Front', width: 400, height: 300, position: [0, 0, 0], rotation: [0, 0, 0] }]
    }
    let selectedId: string | null = null
    const unregister = registerAssemblySession({
      getModel: () => mockModel,
      setModel: (next) => {
        mockModel = next
      },
      getSelectedFaceId: () => selectedId,
      setSelectedFaceId: (id) => {
        selectedId = id
      },
      save: () => {},
      insert: async () => [],
      close: () => {},
      captureScreenshot: () => null
    })
    try {
      const onFace = (await runCommand('append_assembly_model', {
        source_model_id: 'model-cubic-box',
        face_id: 'front',
        uv: [0.25, 0.5]
      })) as any
      expect(onFace.ok).toBe(true)
      expect(onFace.mode).toBe('on_face')
      expect(onFace.addedFaceIds.length).toBeGreaterThan(0)
      expect(mockModel.faces.length).toBe(1 + onFace.addedFaceIds.length)
      expect(selectedId).toBe(onFace.addedFaceIds[0])

      const atPoint = (await runCommand('append_assembly_model', {
        source_model_id: 'model-cubic-box',
        at: [500, 0, 0],
        prefix_names: false
      })) as any
      expect(atPoint.mode).toBe('at')
      expect(new Set(mockModel.faces.map((f) => f.id)).size).toBe(mockModel.faces.length)

      await expect(
        runCommand('append_assembly_model', { source_model_id: 'model-cubic-box', face_id: 'missing' })
      ).rejects.toThrow(/not found/)
      await expect(runCommand('append_assembly_model', { source_model_id: 'no-such-model' })).rejects.toThrow()
    } finally {
      unregister()
    }
  })
})

