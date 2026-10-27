import { describe, expect, it } from 'vitest'
import { WORKFLOW_V2_LOGIC_CATEGORIES, WORKFLOW_V2_LOGIC_PRESETS, defaultLogicPreset } from './workflowV2LogicPresets'

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
})
