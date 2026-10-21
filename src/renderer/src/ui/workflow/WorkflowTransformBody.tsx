import React, { useCallback, useMemo } from 'react'
import type { Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { useEditor } from '../../store/editor'

export interface WorkflowTransformBodyProps {
  node: WorkflowNode
  project?: Project
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
}

/**
 * Component thân thẻ Node Tọa độ Transform 2.5D (Companion Transform Node).
 * Cho phép người dùng trực tiếp kéo trượt 4 trục: X (ngang), Y (dọc), Z (chiều sâu lớp)
 * và Góc xoay (Rotation) đồng bộ trực tiếp 60fps lên Three.js Viewport và 2D Canvas.
 */
export const WorkflowTransformBody: React.FC<WorkflowTransformBodyProps> = React.memo(({
  node,
  project,
  onUpdateNodeParams
}) => {
  const targetLayerId = useMemo(
    () => node.params?.targetLayerIds?.[0],
    [node.params?.targetLayerIds]
  )

  const boundLayer = useMemo(() => {
    if (!project || !targetLayerId) return null
    return project.layers.find((l) => l.id === targetLayerId) ?? null
  }, [project, targetLayerId])

  const posX = boundLayer
    ? Math.round(boundLayer.transform.position.value[0] ?? 0)
    : Math.round(node.params?.transformX ?? 0)
  const posY = boundLayer
    ? Math.round(boundLayer.transform.position.value[1] ?? 0)
    : Math.round(node.params?.transformY ?? 0)
  const posZ = boundLayer
    ? Math.round(boundLayer.transform.position.value[2] ?? 0)
    : Math.round(node.params?.transformZ ?? 0)
  const rotZ = boundLayer
    ? Math.round(boundLayer.transform.rotation.value[2] ?? 0)
    : Math.round(node.params?.transformRotation ?? 0)

  const handleSliderChange = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rot', value: number) => {
      if (targetLayerId) {
        useEditor.getState().update((draft) => {
          const l = draft.layers.find((item) => item.id === targetLayerId)
          if (!l) return
          if (axis === 'x') l.transform.position.value[0] = value
          else if (axis === 'y') l.transform.position.value[1] = value
          else if (axis === 'z') l.transform.position.value[2] = value
          else if (axis === 'rot') l.transform.rotation.value[2] = value
        })
      }

      const patch: Partial<WorkflowNodeParams> = {}
      if (axis === 'x') patch.transformX = value
      else if (axis === 'y') patch.transformY = value
      else if (axis === 'z') patch.transformZ = value
      else if (axis === 'rot') patch.transformRotation = value
      onUpdateNodeParams?.(node.id, patch)
    },
    [targetLayerId, node.id, onUpdateNodeParams]
  )

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (targetLayerId) {
        useEditor.getState().update((draft) => {
          const l = draft.layers.find((item) => item.id === targetLayerId)
          if (!l) return
          l.transform.position.value[0] = 0
          l.transform.position.value[1] = 0
          l.transform.rotation.value[2] = 0
        })
      }
      onUpdateNodeParams?.(node.id, {
        transformX: 0,
        transformY: 0,
        transformRotation: 0
      })
    },
    [targetLayerId, node.id, onUpdateNodeParams]
  )

  return (
    <div className="wf-transform-body" onClick={(e) => e.stopPropagation()}>
      {/* 1. Trục X (Ngang) */}
      <div className="wf-transform-slider-row">
        <div className="wf-transform-slider-header">
          <span className="wf-transform-axis-tag axis-x">↔ Trục X</span>
          <span className="wf-transform-val-display">{posX}px</span>
        </div>
        <input
          type="range"
          className="wf-transform-slider-input axis-x"
          min={-1920}
          max={1920}
          step={1}
          value={posX}
          onChange={(e) => handleSliderChange('x', parseFloat(e.target.value))}
          title="Kéo trượt để dịch chuyển Layer theo trục ngang X"
        />
      </div>

      {/* 2. Trục Y (Dọc) */}
      <div className="wf-transform-slider-row">
        <div className="wf-transform-slider-header">
          <span className="wf-transform-axis-tag axis-y">↕ Trục Y</span>
          <span className="wf-transform-val-display">{posY}px</span>
        </div>
        <input
          type="range"
          className="wf-transform-slider-input axis-y"
          min={-1080}
          max={1080}
          step={1}
          value={posY}
          onChange={(e) => handleSliderChange('y', parseFloat(e.target.value))}
          title="Kéo trượt để dịch chuyển Layer theo trục dọc Y"
        />
      </div>

      {/* 3. Trục Z (Chiều sâu không gian 2.5D) */}
      <div className="wf-transform-slider-row">
        <div className="wf-transform-slider-header">
          <span className="wf-transform-axis-tag axis-z">⤢ Chiều sâu Z</span>
          <span className="wf-transform-val-display">Z:{posZ}</span>
        </div>
        <input
          type="range"
          className="wf-transform-slider-input axis-z"
          min={-300}
          max={3600}
          step={5}
          value={posZ}
          onChange={(e) => handleSliderChange('z', parseFloat(e.target.value))}
          title="Kéo trượt để thay đổi tầng chiều sâu Z của Layer trong không gian 2.5D"
        />
      </div>

      {/* 4. Góc xoay (Rotation) */}
      <div className="wf-transform-slider-row">
        <div className="wf-transform-slider-header">
          <span className="wf-transform-axis-tag axis-rot">🔄 Góc xoay</span>
          <span className="wf-transform-val-display">{rotZ}°</span>
        </div>
        <input
          type="range"
          className="wf-transform-slider-input axis-rot"
          min={-180}
          max={180}
          step={1}
          value={rotZ}
          onChange={(e) => handleSliderChange('rot', parseFloat(e.target.value))}
          title="Kéo trượt để xoay góc theo hướng 2.5D"
        />
      </div>

      {/* Quick Action Bar */}
      <div className="wf-transform-quick-actions">
        <button
          type="button"
          className="wf-transform-reset-btn"
          onClick={handleReset}
          title="Đặt lại tọa độ X, Y và Góc xoay về 0"
        >
          ↺ Đặt lại tâm
        </button>
        <span className="wf-transform-sync-hint">● 60fps Realtime</span>
      </div>
    </div>
  )
})
