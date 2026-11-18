import React, { useEffect, useMemo, useState } from 'react'
import {
  WORKFLOW_V2_RIG_PRESET_OPTIONS,
  type ClusterRigPresetOption
} from '../../project/workflowV2ClusterRigAndSwap'
import type { MotionPresetArchetype, ProceduralMotionPreset } from '../layerAssembly/workshopRigPresets'

const ARCHETYPE_TABS: { id: MotionPresetArchetype; label: string }[] = [
  { id: 'humanoid', label: '🧍 Nhân vật' },
  { id: 'combat', label: '⚔️ Chiến đấu' },
  { id: 'animal', label: '🐺 Con vật' },
  { id: 'monster', label: '👹 Quái vật' }
]

interface Props {
  value?: string
  variant?: 'amber' | 'compact'
  cols?: number
  showDisableButton?: boolean
  onPick: (option: ClusterRigPresetOption) => void
  onDisable?: () => void
}

/** Bộ chọn hành động khung xương 2.5D chia 4 nhóm tab gọn gàng (Nhân vật / Chiến đấu / Con vật / Quái vật). */
export function WorkflowV2RigPresetPicker({
  value,
  variant = 'amber',
  cols = 2,
  showDisableButton = false,
  onPick,
  onDisable
}: Props): React.ReactElement {
  const matchedArchetype = useMemo(() => {
    const found = WORKFLOW_V2_RIG_PRESET_OPTIONS.find((o) => o.id === value)
    return found?.archetype ?? 'humanoid'
  }, [value])

  const [activeTab, setActiveTab] = useState<MotionPresetArchetype>(matchedArchetype)

  useEffect(() => {
    if (value && value !== 'none') {
      setActiveTab(matchedArchetype)
    }
  }, [value, matchedArchetype])

  const visibleOptions = useMemo(
    () => WORKFLOW_V2_RIG_PRESET_OPTIONS.filter((o) => o.archetype === activeTab),
    [activeTab]
  )

  const gridClass = variant === 'amber' ? 'vl-pill-grid' : 'wf-v2-pill-grid'
  const gridCols = variant === 'compact' ? 3 : cols

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="wf-v2-seg-tabs" role="tablist" aria-label="Nhóm động tác khung xương 2.5D">
        {ARCHETYPE_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`wf-v2-seg-tab${isActive ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className={gridClass}
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {visibleOptions.map((ro) => {
          const active = (value as ProceduralMotionPreset | undefined) === ro.id
          if (variant === 'compact') {
            return (
              <button
                key={ro.id}
                type="button"
                className={`wf-v2-opt-pill${active ? ' active' : ''}`}
                title={`${ro.description} (${ro.duration}s)`}
                onClick={() => onPick(ro)}
              >
                {ro.shortLabel}
              </button>
            )
          }
          return (
            <button
              key={ro.id}
              type="button"
              className={`vl-pill-btn ${active ? 'active-amber' : ''}`}
              title={`${ro.description} (${ro.duration}s)`}
              onClick={() => onPick(ro)}
            >
              <span>{ro.shortLabel}</span>
              <small className="wf-v2-pill-dur">{ro.duration}s</small>
            </button>
          )
        })}

        {showDisableButton && onDisable && (
          <button
            type="button"
            className={`wf-v2-opt-pill${!value || value === 'none' ? ' active' : ''}`}
            title="Gỡ keyframe hành động xương và trả cụm về tư thế đứng chuẩn"
            onClick={onDisable}
          >
            ⏹ Tắt Rig xương
          </button>
        )}
      </div>
    </div>
  )
}
