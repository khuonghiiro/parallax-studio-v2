import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@shared/types'
import { useEditor } from '../../store/editor'
import { getStoredComposites, saveComposite } from '../layerAssembly/layerAssemblyStorage'
import type { LayerComposite } from '../layerAssembly/types'
import { deleteLoopTemplate, getAllLoopTemplates, getBuiltinLoopTemplates, saveLoopTemplate } from './loopAnimatorStorage'
import { useLoopAnimator } from './loopAnimatorState'
import {
  deleteLoopTemplateSafely,
  detachLoopTemplateUsage,
  findLoopTemplateUsages,
  removeLoopSceneLayer
} from './loopTemplateUsage'

function mockStorage(): void {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    }
  })
}

const TPL = 'loop_test_tpl'

function addSceneLayer(id: string, templateId: string): void {
  const shotId = useEditor.getState().project.shots[0]?.id ?? ''
  useEditor.getState().update((d) => {
    d.layers.push({ id, type: 'image', name: `Layer ${id}`, shotId, props: { loopTemplateId: templateId } } as unknown as (typeof d.layers)[number])
  })
}

function compositeWithLoop(id: string, templateId: string): LayerComposite {
  return {
    id,
    name: `Cụm ${id}`,
    category: 'custom',
    layers: [
      { id: `${id}_p1`, name: 'Mảnh lửa', imageUrl: '', x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, loopConfig: { enabled: true, templateId, fps: 12, speed: 1, loopMode: 'loop', timeOffset: 0 } }
    ]
  } as unknown as LayerComposite
}

describe('Loop template usages & safe delete', () => {
  beforeEach(() => {
    mockStorage()
    useEditor.getState().update((d) => {
      d.layers = d.layers.filter((l) => !l.id.startsWith('lt_'))
    })
  })

  it('finds scene and composite usages from custom sources', () => {
    const project = {
      shots: [{ id: 's1', name: 'Cảnh rừng' }],
      layers: [
        { id: 'a', type: 'image', name: 'Lửa trại', shotId: 's1', props: { loopTemplateId: TPL } },
        { id: 'b', type: 'image', name: 'Cây', shotId: 's1', props: {} }
      ]
    } as unknown as Project
    const usages = findLoopTemplateUsages(TPL, project, [compositeWithLoop('c1', TPL), compositeWithLoop('c2', 'other')])
    expect(usages).toHaveLength(2)
    expect(usages[0]).toMatchObject({ kind: 'scene', layerId: 'a', shotName: 'Cảnh rừng' })
    expect(usages[1]).toMatchObject({ kind: 'composite', compositeId: 'c1', layerName: 'Mảnh lửa' })
  })

  it('detaches a scene layer link and supports removing the layer', () => {
    addSceneLayer('lt_1', TPL)
    addSceneLayer('lt_2', TPL)
    const usages = findLoopTemplateUsages(TPL, undefined, [])
    expect(usages.map((u) => u.layerId)).toEqual(['lt_1', 'lt_2'])

    expect(detachLoopTemplateUsage(usages[0])).toBe(true)
    const layer = useEditor.getState().project.layers.find((l) => l.id === 'lt_1')
    expect(layer?.type === 'image' && layer.props.loopTemplateId).toBeFalsy()

    const second = usages[1]
    expect(second.kind === 'scene' && removeLoopSceneLayer(second)).toBe(true)
    expect(useEditor.getState().project.layers.some((l) => l.id === 'lt_2')).toBe(false)
    expect(findLoopTemplateUsages(TPL, undefined, [])).toHaveLength(0)
  })

  it('detaches stored 2.5D workshop pieces', () => {
    saveComposite(compositeWithLoop('lt_comp', TPL))
    const usage = findLoopTemplateUsages(TPL).find((u) => u.kind === 'composite')
    expect(usage).toBeDefined()
    expect(detachLoopTemplateUsage(usage!)).toBe(true)
    const piece = getStoredComposites().find((c) => c.id === 'lt_comp')?.layers[0]
    expect(piece?.loopConfig?.templateId).toBeUndefined()
    expect(piece?.loopConfig?.enabled).toBe(true)
  })

  it('deleteLoopTemplateSafely unlinks every remaining usage then deletes', () => {
    const saved = saveLoopTemplate({ ...getBuiltinLoopTemplates()[0], id: TPL, name: 'Mẫu thử', isBuiltin: false })
    addSceneLayer('lt_3', saved.id)
    saveComposite(compositeWithLoop('lt_comp2', saved.id))
    const res = deleteLoopTemplateSafely(saved.id)
    expect(res).toEqual({ deleted: true, detached: 2 })
    expect(getAllLoopTemplates().some((t) => t.id === saved.id)).toBe(false)
    expect(findLoopTemplateUsages(saved.id)).toHaveLength(0)
  })

  it('hides deleted built-in templates and shows them again when re-saved', () => {
    const builtin = getBuiltinLoopTemplates()[0]
    expect(deleteLoopTemplate(builtin.id)).toBe(true)
    expect(getAllLoopTemplates().some((t) => t.id === builtin.id)).toBe(false)
    saveLoopTemplate({ ...builtin })
    expect(getAllLoopTemplates().some((t) => t.id === builtin.id)).toBe(true)
  })

  it('startBlank opens an empty session without any previous asset', () => {
    useLoopAnimator.getState().open(getBuiltinLoopTemplates()[0].id)
    expect(useLoopAnimator.getState().sourceImageUrl).toBeTruthy()
    useLoopAnimator.getState().startBlank()
    const s = useLoopAnimator.getState()
    expect(s.sourceImageUrl).toBeNull()
    expect(s.frames).toHaveLength(0)
    expect(s.activePresetId).toBeNull()
    expect(s.chromaKey.enabled).toBe(false)
    useLoopAnimator.getState().open()
    expect(useLoopAnimator.getState().sourceImageUrl).toBeNull()
  })
})
