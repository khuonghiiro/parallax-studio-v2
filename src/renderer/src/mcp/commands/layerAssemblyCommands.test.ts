import { beforeEach, describe, expect, it } from 'vitest'
import { createProject, createShot } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runCommand } from '../commands'
import { registerLayerAssemblySession } from '../../ui/layerAssembly/layerAssemblyBridge'
import type { LayerComposite } from '../../ui/layerAssembly/types'

describe('MCP layerAssemblyCommands', () => {
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
        getBuiltInCatalog: async () => ({ items: [], categories: [], manifestPath: '', rawJson: '' })
      },
      dispatchEvent: () => true
    }

    const proj = createProject()
    const shot = createShot('Cảnh Test 1')
    proj.shots = [shot]
    useEditor.getState().loadProject(proj, null)
    useEditor.setState({ selectedShotId: shot.id })
  })

  it('runs list_layer_composites and returns preset composites including bonsai', async () => {
    const res = (await runCommand('list_layer_composites')) as any
    expect(res.count).toBeGreaterThan(0)
    expect(Array.isArray(res.composites)).toBe(true)

    const bonsai = res.composites.find((c: any) => c.id === 'comp-bonsai-zen')
    expect(bonsai).toBeDefined()
    expect(bonsai.name).toContain('Bonsai')
    expect(bonsai.layerCount).toBe(5)
  })

  it('runs get_layer_composite for bonsai preset and validates layers & coordinates', async () => {
    const res = (await runCommand('get_layer_composite', { id: 'comp-bonsai-zen' })) as any
    expect(res.id).toBe('comp-bonsai-zen')
    expect(res.layers.length).toBe(5)

    const pot = res.layers.find((l: any) => l.id === 'bonsai-pot')
    expect(pot).toBeDefined()
    expect(pot.y).toBe(155)
    expect(pot.z).toBe(-5)

    const trunk = res.layers.find((l: any) => l.id === 'bonsai-trunk')
    expect(trunk).toBeDefined()
    expect(trunk.y).toBe(10)
    expect(trunk.z).toBe(0)
    expect(trunk.motion.amplitude).toBeCloseTo(2.2)
  })

  it('saves and deletes a new custom layer composite', async () => {
    const saveRes = (await runCommand('save_layer_composite', {
      id: 'comp-test-custom',
      name: 'Test Custom Bush',
      category: 'nature',
      width: 400,
      height: 400,
      layers: [
        {
          id: 'l1',
          name: 'Layer 1',
          x: 0,
          y: 0,
          z: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          motion: { type: 'sway', speed: 1, amplitude: 5, anchor: 'bottom' }
        }
      ]
    })) as any

    expect(saveRes.ok).toBe(true)
    expect(saveRes.id).toBe('comp-test-custom')

    const getRes = (await runCommand('get_layer_composite', { id: 'comp-test-custom' })) as any
    expect(getRes.name).toBe('Test Custom Bush')

    const delRes = (await runCommand('delete_layer_composite', { id: 'comp-test-custom' })) as any
    expect(delRes.ok).toBe(true)
    expect(delRes.deletedId).toBe('comp-test-custom')
  })

  it('inserts layer composite into active scene shot', async () => {
    const res = (await runCommand('insert_layer_composite', {
      id: 'comp-bonsai-zen',
      scale: 1.2
    })) as any

    expect(res.ok).toBe(true)
    expect(res.compositeId).toBe('comp-bonsai-zen')
    expect(res.createdLayerIds.length).toBe(5)

    const editor = useEditor.getState()
    const shotLayers = editor.project.layers.filter((l) => l.shotId === editor.selectedShotId)
    expect(shotLayers.length).toBe(5)
  })

  it('controls and reads active workshop session via layerAssemblyBridge', async () => {
    let mockComp: LayerComposite = {
      id: 'session-test-comp',
      name: 'Session Tree',
      category: 'nature',
      width: 500,
      height: 500,
      layers: []
    }

    const unregister = registerLayerAssemblySession({
      getComposite: () => mockComp,
      setComposite: (c) => {
        mockComp = typeof c === 'function' ? c(mockComp) : c
      },
      getSelectedLayerId: () => 'l-selected',
      setSelectedLayerId: () => {},
      getIsPlaying: () => true,
      setIsPlaying: () => {},
      getTime: () => 1.45,
      setTime: () => {},
      save: async () => {},
      insertToScene: async () => {},
      close: () => {}
    })

    const state = (await runCommand('get_layer_assembly_state')) as any
    expect(state.isOpen).toBe(true)
    expect(state.activeSessionId).toBe('session-test-comp')
    expect(state.selectedLayerId).toBe('l-selected')
    expect(state.isPlaying).toBe(true)
    expect(state.time).toBeCloseTo(1.45)

    unregister()

    const closedState = (await runCommand('get_layer_assembly_state')) as any
    expect(closedState.isOpen).toBe(false)
  })

  it('performs batch layer_assembly_action, multi-selection and history undo/redo via MCP', async () => {
    let mockComp: LayerComposite = {
      id: 'batch-test-comp',
      name: 'Batch Test',
      category: 'nature',
      width: 600,
      height: 600,
      layers: [
        {
          id: 'l-a',
          name: 'Layer A',
          x: -40,
          y: -10,
          z: 80,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'bottom' }
        },
        {
          id: 'l-b',
          name: 'Layer B',
          x: 20,
          y: 30,
          z: 20,
          scale: 1,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          motion: { type: 'none', speed: 1, amplitude: 10, anchor: 'bottom' }
        }
      ]
    }

    let selectedIds: string[] = ['l-a']
    let historyStack: LayerComposite[] = [mockComp]
    let redoStack: LayerComposite[] = []

    const unregister = registerLayerAssemblySession({
      getComposite: () => mockComp,
      setComposite: (c) => {
        const next = typeof c === 'function' ? c(mockComp) : c
        historyStack.push(mockComp)
        redoStack = []
        mockComp = next
      },
      getSelectedLayerId: () => selectedIds.at(-1) ?? null,
      setSelectedLayerId: (id) => {
        selectedIds = id ? [id] : []
      },
      getSelectedLayerIds: () => selectedIds,
      setSelectedLayerIds: (ids) => {
        selectedIds = ids
      },
      undo: () => {
        if (historyStack.length > 0) {
          redoStack.push(mockComp)
          mockComp = historyStack.pop()!
        }
      },
      redo: () => {
        if (redoStack.length > 0) {
          historyStack.push(mockComp)
          mockComp = redoStack.pop()!
        }
      },
      canUndo: () => historyStack.length > 0,
      canRedo: () => redoStack.length > 0,
      getIsPlaying: () => false,
      setIsPlaying: () => {},
      getTime: () => 0,
      setTime: () => {},
      save: async () => {},
      insertToScene: async () => {},
      close: () => {}
    })

    // 1. select_layer_assembly_layers
    const selRes = (await runCommand('select_layer_assembly_layers', {
      layer_ids: ['l-a', 'l-b']
    })) as any
    expect(selRes.ok).toBe(true)
    expect(selRes.selectedLayerIds).toEqual(['l-a', 'l-b'])

    // 2. layer_assembly_action (depth-forward)
    const actRes = (await runCommand('layer_assembly_action', {
      action: 'depth-forward',
      layer_ids: ['l-a', 'l-b'],
      spacing: 120
    })) as any
    expect(actRes.ok).toBe(true)
    expect(mockComp.layers[0].z).toBe(60)
    expect(mockComp.layers[1].z).toBe(-60)

    // 3. layer_assembly_action (center-x)
    const actCenter = (await runCommand('layer_assembly_action', {
      action: 'center-x',
      layer_ids: ['l-a', 'l-b']
    })) as any
    expect(actCenter.ok).toBe(true)
    expect(mockComp.layers[0].x).toBe(0)
    expect(mockComp.layers[1].x).toBe(0)

    // 4. layer_assembly_history (undo)
    const undoRes = (await runCommand('layer_assembly_history', {
      action: 'undo'
    })) as any
    expect(undoRes.ok).toBe(true)
    expect(mockComp.layers[0].x).toBe(-40) // Undone center-x

    // 5. layer_assembly_history (redo)
    const redoRes = (await runCommand('layer_assembly_history', {
      action: 'redo'
    })) as any
    expect(redoRes.ok).toBe(true)
    expect(mockComp.layers[0].x).toBe(0) // Redone center-x

    unregister()
  })
})
