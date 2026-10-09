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
    expect(pot.y).toBe(110)
    expect(pot.z).toBe(-5)

    const trunk = res.layers.find((l: any) => l.id === 'bonsai-trunk')
    expect(trunk).toBeDefined()
    expect(trunk.y).toBe(-35)
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
})
