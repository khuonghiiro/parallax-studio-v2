import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_V2_LOGIC_CATEGORIES,
  WORKFLOW_V2_LOGIC_PRESETS,
  defaultLogicPreset,
  findLogicPreset,
  getCompatibleLogicCatalogForNode
} from './workflowV2LogicPresets'

describe('shared Timeline / Workflow logic catalog', () => {
  it('provides display metadata for every selectable preset', () => {
    for (const preset of WORKFLOW_V2_LOGIC_PRESETS) {
      const category = WORKFLOW_V2_LOGIC_CATEGORIES.find((entry) => entry.id === preset.category)
      expect(category, preset.id).toBeDefined()
      expect(category?.accent, preset.id).toBeTruthy()
    }
  })

  it('has unique categories and a usable default in every category', () => {
    expect(new Set(WORKFLOW_V2_LOGIC_CATEGORIES.map((c) => c.id)).size).toBe(WORKFLOW_V2_LOGIC_CATEGORIES.length)
    for (const category of WORKFLOW_V2_LOGIC_CATEGORIES) {
      expect(defaultLogicPreset(category.id).category).toBe(category.id)
    }
  })

  it('maps every atomic catalog item presetId to an existing single-responsibility preset', () => {
    const single = getCompatibleLogicCatalogForNode({ id: 'n1', type: 'layer_assembly', title: 'NV', enabled: true, position: { x: 0, y: 0 }, preset: '', aiAgentRole: 'SceneLayoutAgent', aiDirective: '', params: { targetLayerIds: ['l1'] } })
    const composite = getCompatibleLogicCatalogForNode({ id: 'n2', type: 'layer_assembly', title: 'Cụm', enabled: true, position: { x: 0, y: 0 }, preset: '', aiAgentRole: 'SceneLayoutAgent', aiDirective: '', params: { logicCategory: 'cluster_lock', instanceId: 'inst-1', targetLayerIds: ['l1', 'l2'] } })
    for (const item of [...single.categories, ...composite.categories]) {
      if (item.presetId) {
        const resolved = findLogicPreset(item.presetId)
        expect(resolved, `missing presetId ${item.presetId}`).toBeDefined()
      }
    }
  })
})
