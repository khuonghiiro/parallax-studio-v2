import React, { useMemo, useState } from 'react'
import type { Layer, Project, WorkflowGraph, WorkflowNode } from '@shared/types'
import { useLayerUpdater } from '../inspector/useLayerUpdater'
import { GlowSection } from '../inspector/sections/GlowSection'
import { LayerEffectsSection } from '../inspector/sections/LayerEffectsSection'
import { LayerPhysicsSection } from '../inspector/sections/LayerPhysicsSection'
import { LayerVirtualLightSection } from '../inspector/sections/LayerVirtualLightSection'
import {
  WORKFLOW_V2_SPAWN_CATALOG,
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'

export type DeepLogicFilter = 'all' | 'fx' | 'glow' | 'light' | 'physics'

const DEEP_FILTER_TABS: { id: DeepLogicFilter; label: string; title: string }[] = [
  { id: 'all', label: 'Tất cả', title: 'Hiển thị đầy đủ các nhóm cấu hình logic chuyên sâu của Layer' },
  { id: 'fx', label: '✨ Chuyển động', title: 'Hiệu ứng chuyển động, rung lắc, nhịp thở, preset động tác' },
  { id: 'glow', label: '🌟 Neon', title: 'Viền sáng Neon (Outer Glow / Rim Light)' },
  { id: 'light', label: '💡 Ánh sáng', title: 'Đèn 2.5D phát sáng và khung cửa sổ hắt nắng' },
  { id: 'physics', label: '🧱 Vật lý', title: 'Chất liệu vật lý, trọng lực, va chạm và cửa hang 2.5D' }
]

export function resolveActiveLayerForInspector(
  project: Project,
  node: WorkflowNode | null,
  selectedLayerId: string | null
): Layer | undefined {
  const fromNodeLayerId = node?.params?.targetLayerIds?.[0] ?? null
  if (fromNodeLayerId) {
    const found = project.layers.find((l) => l.id === fromNodeLayerId)
    if (found) return found
  }
  if (selectedLayerId) {
    return project.layers.find((l) => l.id === selectedLayerId)
  }
  return undefined
}

/**
 * Dải chuyển nhanh giữa Node Layer gốc và các Node Logic đang gắn trên cùng Layer.
 * Giúp người dùng thao tác mượt mà ở cả chế độ Timeline lẫn Workflow mà không cần mở sơ đồ dây.
 */
export const WorkflowV2NodeSwitcherBar: React.FC<{
  workflow: WorkflowGraph
  layer: Layer
  activeNode: WorkflowNode | null
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (layerNodeId: string, category: WorkflowV2SpawnCategory) => void
}> = ({ workflow, layer, activeNode, onSelectNode, onAttachLogic }) => {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const layerNode = useMemo(
    () =>
      workflow.nodes.find(
        (n) => resolveV2NodeLevel(n) === 'layer' && n.params?.targetLayerIds?.includes(layer.id)
      ) ?? null,
    [workflow.nodes, layer.id]
  )

  const logicNodes = useMemo(
    () =>
      workflow.nodes.filter(
        (n) =>
          resolveV2NodeLevel(n) === 'logic' &&
          n.type !== 'camera_director' &&
          n.params?.targetLayerIds?.includes(layer.id)
      ),
    [workflow.nodes, layer.id]
  )

  if (!layerNode) return null

  const isLayerSelected = activeNode?.id === layerNode.id

  return (
    <div className="wf-v2-node-switcher" aria-label="Chuyển nhanh Node của Layer">
      <div className="wf-v2-node-switcher-row">
        <button
          type="button"
          className={`wf-v2-node-switch-pill is-layer${isLayerSelected ? ' active' : ''}`}
          title={`Node Layer gốc: ${layer.name} (Chỉnh BBox 2D, X/Y/Z, thời lượng)`}
          onClick={() => onSelectNode(layerNode.id)}
        >
          <span className="pill-ico">🖼</span>
          <span className="pill-txt">{layer.name}</span>
        </button>

        {logicNodes.map((ln) => {
          const theme = resolveV2NodeTheme(ln)
          const isSelected = activeNode?.id === ln.id
          return (
            <button
              key={ln.id}
              type="button"
              className={`wf-v2-node-switch-pill${isSelected ? ' active' : ''}${!ln.enabled ? ' is-off' : ''}`}
              style={{ ['--wf-v2-accent' as string]: theme.accent }}
              title={`${ln.title} (${theme.badge}) — Click để chỉnh thông số Node này`}
              onClick={() => onSelectNode(ln.id)}
            >
              <span className={`pill-dot${ln.enabled ? ' on' : ''}`} />
              <span className="pill-ico">{theme.icon}</span>
              <span className="pill-txt">{cleanV2NodeTitle(ln.title)}</span>
            </button>
          )
        })}

        <button
          type="button"
          className={`wf-v2-node-switch-add${quickAddOpen ? ' active' : ''}`}
          title="Gắn thêm Node Logic mới vào Layer này"
          onClick={() => setQuickAddOpen((v) => !v)}
        >
          + Logic
        </button>
      </div>

      {quickAddOpen && (
        <div className="wf-v2-node-switch-spawn">
          {WORKFLOW_V2_SPAWN_CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              className="wf-v2-spawn-chip"
              style={{ ['--wf-v2-accent' as string]: item.accent }}
              onClick={() => {
                onAttachLogic(layerNode.id, item.id)
                setQuickAddOpen(false)
              }}
            >
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Các bảng cấu hình Logic chuyên sâu của Layer (Chuyển động & FX, Viền sáng Neon, Ánh sáng 2.5D, Vật lý & Cửa hang)
 * được chuyển từ tab Layer sang tab Thuộc tính Node để mỗi tab giữ đúng 1 trách nhiệm rõ ràng.
 */
export const WorkflowV2DeepLayerLogic: React.FC<{
  layer: Layer
  activeNode: WorkflowNode | null
}> = ({ layer, activeNode }) => {
  const set = useLayerUpdater(layer.id)
  const [filter, setFilter] = useState<DeepLogicFilter>('all')

  const cat = activeNode?.params?.logicCategory
  const effectiveFilter = filter

  return (
    <section className="wf-v2-insp-sec wf-v2-deep-logic-sec">
      <div className="wf-v2-insp-sec-title">
        <span>Cấu hình Logic &amp; Hiệu ứng Layer</span>
        <span className="wf-v2-insp-note">{layer.name}</span>
      </div>

      <div className="wf-v2-deep-filter-bar" role="tablist" aria-label="Nhóm cấu hình logic chuyên sâu">
        {DEEP_FILTER_TABS.map((t) => {
          const isSuggested =
            (t.id === 'fx' && cat === 'motion') ||
            (t.id === 'light' && cat === 'light') ||
            (t.id === 'physics' && (cat === 'portal' || cat === 'material' || cat === 'collision'))
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={effectiveFilter === t.id}
              className={`wf-v2-deep-filter-pill${effectiveFilter === t.id ? ' active' : ''}${isSuggested ? ' suggested' : ''}`}
              title={t.title}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="wf-v2-deep-logic-body">
        {(effectiveFilter === 'all' || effectiveFilter === 'fx') && (
          <LayerEffectsSection layer={layer} set={set} />
        )}
        {(effectiveFilter === 'all' || effectiveFilter === 'glow') && layer.type !== 'particles' && (
          <GlowSection layer={layer} set={set} />
        )}
        {(effectiveFilter === 'all' || effectiveFilter === 'light') && layer.type !== 'particles' && (
          <LayerVirtualLightSection layer={layer} set={set} />
        )}
        {(effectiveFilter === 'all' || effectiveFilter === 'physics') && layer.type !== 'particles' && (
          <LayerPhysicsSection layer={layer} set={set} />
        )}
      </div>
    </section>
  )
}
