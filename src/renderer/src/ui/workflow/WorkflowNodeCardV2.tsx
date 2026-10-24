import React from 'react'
import type { ImageProps, Project, WorkflowNode, WorkflowNodeParams, WorkflowPortKind } from '@shared/types'
import {
  WORKFLOW_V2_ACTION_OPTIONS,
  WORKFLOW_V2_CAMERA_OPTIONS,
  WORKFLOW_V2_CAVE_OPTIONS,
  WORKFLOW_V2_FX_OPTIONS,
  WORKFLOW_V2_LIGHT_OPTIONS,
  getLayerZ
} from '../../project/workflowV2Engine'
import { WorkflowTimeRangeBar } from './WorkflowTimeRangeBar'

const LIGHT_SWATCHES = ['#38bdf8', '#fbbf24', '#f97316', '#a855f7', '#34d399', '#f43f5e', '#ffffff']

export interface WorkflowNodeCardV2Props {
  node: WorkflowNode
  project?: Project
  selected: boolean
  isConnectedToSelected?: boolean
  isDimmed?: boolean
  isActiveAtCurrentTime: boolean
  currentTime: number
  maxDuration: number
  childCount: number
  onSelect: (nodeId: string) => void
  onStartDragNode: (e: React.PointerEvent, node: WorkflowNode) => void
  onToggleEnable: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  onUpdateParams: (nodeId: string, patch: Partial<WorkflowNodeParams>, nextTitle?: string) => void
  onAttachLogicToLayer: (layerNodeId: string, category: 'action' | 'light' | 'cave' | 'fx' | 'audio') => void
  onStartWireDrag: (e: React.PointerEvent, nodeId: string, port: WorkflowPortKind, isOutput: boolean) => void
  onCompleteWireDrop: (nodeId: string, port: WorkflowPortKind, isInput: boolean) => void
  onScrubTime: (t: number) => void
  onRebuildSceneTree?: () => void
}

export function resolveV2NodeTheme(node: WorkflowNode): {
  badge: string
  icon: string
  accent: string
  portIn: WorkflowPortKind
  portOut: WorkflowPortKind
  levelClass: string
} {
  if (node.type === 'scene_shot') {
    return {
      badge: 'ROOT CẢNH',
      icon: '🎬',
      accent: '#38bdf8',
      portIn: 'scene_ctx',
      portOut: 'scene_ctx',
      levelClass: 'level-root'
    }
  }
  if (node.params?.groupKind === 'group_3d') {
    return {
      badge: 'GROUP 3D',
      icon: '🧊',
      accent: '#06b6d4',
      portIn: 'scene_ctx',
      portOut: 'layers_tree',
      levelClass: 'level-group'
    }
  }
  if (node.params?.groupKind === 'group_25d') {
    return {
      badge: 'GROUP 2.5D',
      icon: '🗂️',
      accent: '#3b82f6',
      portIn: 'scene_ctx',
      portOut: 'layers_tree',
      levelClass: 'level-group'
    }
  }
  if (node.params?.groupKind === 'group_env') {
    return {
      badge: 'MÔI TRƯỜNG',
      icon: '🌍',
      accent: '#10b981',
      portIn: 'scene_ctx',
      portOut: 'layers_tree',
      levelClass: 'level-group'
    }
  }
  if (node.type === 'layer_assembly') {
    const is3d = node.params?.assemblyKind === 'model3d'
    const isComp = node.params?.assemblyKind === 'composite'
    return {
      badge: is3d ? 'LAYER 3D' : isComp ? 'CỤM 2.5D' : 'LAYER 2.5D',
      icon: is3d ? '🧊' : isComp ? '🧩' : '🖼️',
      accent: '#60a5fa',
      portIn: 'layers_tree',
      portOut: 'layers_tree',
      levelClass: 'level-layer'
    }
  }
  const cat = node.params?.logicCategory
  if (cat === 'light') {
    return {
      badge: 'ÁNH SÁNG',
      icon: '💡',
      accent: '#f59e0b',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'cave') {
    return {
      badge: 'HANG ĐỘNG',
      icon: '🕳️',
      accent: '#14b8a6',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'fx' || node.type === 'physics_fx') {
    return {
      badge: 'HIỆU ỨNG',
      icon: '✨',
      accent: '#a855f7',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'audio' || node.type === 'audio_lipsync') {
    return {
      badge: 'ÂM THANH',
      icon: '🔊',
      accent: '#ec4899',
      portIn: 'layers_tree',
      portOut: 'audio_mix',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'camera' || node.type === 'camera_director') {
    return {
      badge: 'CAMERA 3D',
      icon: '🎥',
      accent: '#22d3ee',
      portIn: 'scene_ctx',
      portOut: 'camera_cut',
      levelClass: 'level-logic'
    }
  }
  return {
    badge: 'HÀNH ĐỘNG',
    icon: '🏃',
    accent: '#10b981',
    portIn: 'layers_tree',
    portOut: 'motion_stream',
    levelClass: 'level-logic'
  }
}

export const WorkflowNodeCardV2: React.FC<WorkflowNodeCardV2Props> = ({
  node,
  project,
  selected,
  isConnectedToSelected,
  isDimmed,
  isActiveAtCurrentTime,
  currentTime,
  maxDuration,
  childCount,
  onSelect,
  onStartDragNode,
  onToggleEnable,
  onDeleteNode,
  onUpdateParams,
  onAttachLogicToLayer,
  onStartWireDrag,
  onCompleteWireDrop,
  onScrubTime,
  onRebuildSceneTree
}) => {
  const theme = resolveV2NodeTheme(node)
  const isRoot = node.type === 'scene_shot'
  const isGroup = Boolean(node.params?.groupKind)
  const isLayer = node.type === 'layer_assembly' && !isGroup
  const isLogic = !isRoot && !isGroup && !isLayer
  const logicCat =
    node.params?.logicCategory ??
    (node.type === 'camera_director'
      ? 'camera'
      : node.type === 'audio_lipsync'
        ? 'audio'
        : node.type === 'physics_fx'
          ? 'fx'
          : 'action')

  const timeStart = node.params?.timeStart ?? 0
  const timeEnd = node.params?.timeEnd ?? maxDuration
  const collapsed = Boolean(node.params?.collapsedGroup)

  const primaryLayerId = node.params?.targetLayerIds?.[0]
  const boundLayer =
    isLayer && primaryLayerId ? project?.layers.find((l) => l.id === primaryLayerId) : undefined
  const imgAssetId =
    boundLayer && boundLayer.type === 'image' ? (boundLayer.props as ImageProps).assetId : undefined
  const boundAsset =
    imgAssetId ? project?.assets.find((a) => a.id === imgAssetId) : undefined
  const thumbSrc = boundAsset?.dataUrl || boundAsset?.path
  const zVal = Math.round(node.params?.transformZ ?? (boundLayer ? getLayerZ(boundLayer) : 0))

  // Tóm tắt ngắn gọn 1 dòng cho từng loại thẻ (chuẩn n8n / React Flow)
  const summaryLabel = (() => {
    if (isRoot) return `${childCount} nhánh · Parallax 2.5D`
    if (isGroup) return `${node.params?.childLayerCount ?? childCount} Layer trong nhóm`
    if (isLayer) return `Z: ${zVal >= 0 ? `+${zVal}` : zVal}`
    if (logicCat === 'action') {
      const opt = WORKFLOW_V2_ACTION_OPTIONS.find((o) => o.id === (node.params?.actionPreset ?? 'float'))
      return `${opt?.label ?? 'Bay lơ lửng'} · ${Math.round((node.params?.intensity ?? 0.65) * 100)}%`
    }
    if (logicCat === 'cave') {
      const opt = WORKFLOW_V2_CAVE_OPTIONS.find((o) => o.id === (node.params?.caveArchShape ?? 'arch'))
      return `${opt?.label ?? 'Vòm hang'} · ${Math.round((node.params?.caveDarkness ?? 0.82) * 100)}%`
    }
    if (logicCat === 'light') {
      const opt = WORKFLOW_V2_LIGHT_OPTIONS.find((o) => o.id === (node.params?.lightMode ?? 'rim'))
      return `${opt?.label.replace(/\s*\(.*\)/, '') ?? 'Đèn viền'} · ${Math.round((node.params?.intensity ?? 1.3) * 100)}%`
    }
    if (logicCat === 'fx') {
      const opt = WORKFLOW_V2_FX_OPTIONS.find((o) => o.id === (node.params?.fxKind ?? 'wind_physics'))
      return `${opt?.label.replace(/\s*\(.*\)/, '') ?? 'Hiệu ứng'} · ${Math.round((node.params?.intensity ?? 1.0) * 100)}%`
    }
    if (logicCat === 'camera') {
      const opt = WORKFLOW_V2_CAMERA_OPTIONS.find((o) => o.id === (node.params?.camPreset ?? 'dollyIn'))
      return opt?.label ?? 'Đẩy cận 3D'
    }
    return `Âm lượng ${Math.round((node.params?.intensity ?? 1.0) * 100)}%`
  })()

  return (
    <div
      className={[
        'wf-v2-card',
        theme.levelClass,
        selected ? 'selected' : '',
        isConnectedToSelected ? 'connected-highlight' : '',
        isDimmed ? 'dimmed' : '',
        !node.enabled ? 'disabled' : '',
        isActiveAtCurrentTime && node.enabled ? 'active-at-time' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: node.position.x,
        top: node.position.y,
        ['--wf-v2-accent' as string]: theme.accent
      }}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      onPointerDown={(e) => {
        onSelect(node.id)
        onStartDragNode(e, node)
      }}
    >
      {/* Dải màu định danh bên trái chuẩn n8n / XYFlow */}
      <div className="wf-v2-card-accent-bar" />

      {/* CỔNG ĐẦU VÀO BÊN TRÁI (Trừ Root Cảnh) */}
      {!isRoot && (
        <div
          className="wf-v2-socket in"
          title="Cổng nhận kết nối từ nhánh cha"
          onPointerDown={(e) => {
            e.stopPropagation()
            onStartWireDrag(e, node.id, theme.portIn, false)
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            onCompleteWireDrop(node.id, theme.portIn, true)
          }}
        >
          <span className="wf-v2-socket-dot" />
        </div>
      )}

      {/* CỔNG ĐẦU RA BÊN PHẢI */}
      <div
        className="wf-v2-socket out"
        title="Kéo dây từ cổng này sang phải để kết nối hoặc tạo Node Logic mới"
        onPointerDown={(e) => {
          e.stopPropagation()
          onStartWireDrag(e, node.id, theme.portOut, true)
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          onCompleteWireDrop(node.id, theme.portOut, false)
        }}
      >
        <span className="wf-v2-socket-dot" />
      </div>

      {/* DÒNG 1: HEADER GỌN SẮC NÉT */}
      <div className="wf-v2-card-header">
        {isLayer && thumbSrc ? (
          <div className="wf-v2-mini-thumb">
            <img src={thumbSrc} alt={node.title} draggable={false} />
          </div>
        ) : (
          <span className="wf-v2-card-icon">{theme.icon}</span>
        )}
        <div className="wf-v2-card-titles">
          <div className="wf-v2-card-meta-row">
            <span className="wf-v2-card-badge">{theme.badge}</span>
            <span className="wf-v2-card-sub">{summaryLabel}</span>
          </div>
          <span className="wf-v2-card-title" title={node.title}>
            {node.title.replace(/^(Hành động|Ánh sáng|Hang động|Hiệu ứng|Âm thanh|Cảnh):\s*/i, '')}
          </span>
        </div>
        <div className="wf-v2-card-actions" onPointerDown={(e) => e.stopPropagation()}>
          {isRoot && onRebuildSceneTree && (
            <button
              type="button"
              className="wf-v2-collapse-pill"
              title="Đồng bộ và bung lại toàn bộ Cây Cảnh từ dữ liệu thật"
              onClick={onRebuildSceneTree}
            >
              🔄 Đồng bộ
            </button>
          )}
          {isGroup && (
            <button
              type="button"
              className={`wf-v2-collapse-pill ${collapsed ? 'collapsed' : ''}`}
              title={collapsed ? 'Mở rộng các Layer trong nhóm' : 'Thu gọn nhóm này'}
              onClick={() => onUpdateParams(node.id, { collapsedGroup: !collapsed })}
            >
              {collapsed ? `▸ Mở (${node.params?.childLayerCount ?? childCount})` : '▾ Gọn'}
            </button>
          )}
          {isLayer && (
            <button
              type="button"
              className="wf-v2-add-logic-btn"
              title="Gắn nhanh Node Logic cho Layer này (hoặc chọn thẻ để mở bảng gắn)"
              onClick={() => onSelect(node.id)}
            >
              ＋
            </button>
          )}
          <button
            type="button"
            className={`wf-v2-icon-btn ${node.enabled ? 'on' : 'off'}`}
            title={node.enabled ? 'Đang bật (Nhấn để tắt)' : 'Đang tắt (Nhấn để bật)'}
            onClick={() => onToggleEnable(node.id)}
          >
            {node.enabled ? '✓' : '○'}
          </button>
          {!isRoot && !isGroup && onDeleteNode && (
            <button
              type="button"
              className="wf-v2-icon-btn danger"
              title="Xoá Node này"
              onClick={() => onDeleteNode(node.id)}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* DÒNG 2: THANH KHOẢNG MỐC THỜI GIAN TRỰC QUAN [tStart — tEnd] */}
      <div className="wf-v2-card-footer" onPointerDown={(e) => e.stopPropagation()}>
        <WorkflowTimeRangeBar
          timeStart={timeStart}
          timeEnd={timeEnd}
          minTime={0}
          maxTime={maxDuration}
          currentTime={currentTime}
          accentColor={theme.accent}
          onChangeRange={(nextStart, nextEnd) =>
            onUpdateParams(node.id, { timeStart: nextStart, timeEnd: nextEnd })
          }
          onScrubTime={onScrubTime}
        />
      </div>

      {/* KHAY TINH CHỈNH NHANH NỔI LÊN KHI CHỌN THẺ (FLOATING POPOVER — KHÔNG LÀM ĐẨY LỆCH CÂY) */}
      {selected && !isGroup && !isRoot && (
        <div
          className="wf-v2-card-popover"
          onPointerDown={(e) => e.stopPropagation()}
        >

          {isLayer && (
            <>
              <div className="wf-v2-param-row">
                <span>Độ sâu Z</span>
                <input
                  type="range"
                  className="wf-v2-slider"
                  min={-600}
                  max={3600}
                  step={10}
                  value={Math.max(-600, Math.min(3600, zVal))}
                  onChange={(e) =>
                    onUpdateParams(node.id, { transformZ: Number(e.target.value) })
                  }
                />
                <strong>{zVal >= 0 ? `+${zVal}` : zVal}</strong>
              </div>
              <div className="wf-v2-layer-spawn-row">
                <button
                  type="button"
                  className="wf-v2-spawn-chip action"
                  onClick={() => onAttachLogicToLayer(node.id, 'action')}
                >
                  +🏃 Hành động
                </button>
                <button
                  type="button"
                  className="wf-v2-spawn-chip light"
                  onClick={() => onAttachLogicToLayer(node.id, 'light')}
                >
                  +💡 Ánh sáng
                </button>
                <button
                  type="button"
                  className="wf-v2-spawn-chip cave"
                  onClick={() => onAttachLogicToLayer(node.id, 'cave')}
                >
                  +🕳️ Hang động
                </button>
                <button
                  type="button"
                  className="wf-v2-spawn-chip fx"
                  onClick={() => onAttachLogicToLayer(node.id, 'fx')}
                >
                  +✨ Hiệu ứng
                </button>
              </div>
            </>
          )}

          {isLogic && logicCat === 'action' && (
            <>
              <div className="wf-v2-pill-grid single-row">
                {WORKFLOW_V2_ACTION_OPTIONS.slice(0, 4).map((opt) => {
                  const active = (node.params?.actionPreset ?? 'float') === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`wf-v2-opt-pill ${active ? 'active' : ''}`}
                      onClick={() =>
                        onUpdateParams(
                          node.id,
                          { actionPreset: opt.id },
                          `Hành động: ${opt.label}`
                        )
                      }
                    >
                      {opt.label.replace(/\s*\/.*$/, '')}
                    </button>
                  )
                })}
              </div>
              <div className="wf-v2-param-row">
                <span>Biên độ</span>
                <input
                  type="range"
                  className="wf-v2-slider"
                  min={0.1}
                  max={1.8}
                  step={0.05}
                  value={node.params?.intensity ?? 0.65}
                  onChange={(e) =>
                    onUpdateParams(node.id, { intensity: Number(e.target.value) })
                  }
                />
                <strong>{Math.round((node.params?.intensity ?? 0.65) * 100)}%</strong>
              </div>
            </>
          )}

          {isLogic && logicCat === 'cave' && (
            <>
              <div className="wf-v2-pill-grid single-row">
                {WORKFLOW_V2_CAVE_OPTIONS.map((opt) => {
                  const active = (node.params?.caveArchShape ?? 'arch') === opt.id
                  const shortLabel =
                    opt.id === 'arch' ? 'Vòm hang' : opt.id === 'ellipse' ? 'Hầm Elip' : 'Cổng xoáy'
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`wf-v2-opt-pill ${active ? 'active' : ''}`}
                      onClick={() =>
                        onUpdateParams(
                          node.id,
                          { caveArchShape: opt.id },
                          `Hang động: ${opt.label}`
                        )
                      }
                    >
                      {shortLabel}
                    </button>
                  )
                })}
              </div>
              <div className="wf-v2-param-row">
                <span>Độ tối</span>
                <input
                  type="range"
                  className="wf-v2-slider"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={node.params?.caveDarkness ?? node.params?.intensity ?? 0.82}
                  onChange={(e) =>
                    onUpdateParams(node.id, {
                      caveDarkness: Number(e.target.value),
                      intensity: Number(e.target.value)
                    })
                  }
                />
                <strong>{Math.round((node.params?.caveDarkness ?? 0.82) * 100)}%</strong>
              </div>
            </>
          )}

          {isLogic && logicCat === 'light' && (
            <>
              <div className="wf-v2-pill-grid single-row">
                {WORKFLOW_V2_LIGHT_OPTIONS.slice(0, 4).map((opt) => {
                  const active = (node.params?.lightMode ?? 'rim') === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`wf-v2-opt-pill ${active ? 'active' : ''}`}
                      onClick={() =>
                        onUpdateParams(
                          node.id,
                          { lightMode: opt.id },
                          `Ánh sáng: ${opt.label}`
                        )
                      }
                    >
                      {opt.label.replace(/\s*\(.*\)/, '')}
                    </button>
                  )
                })}
              </div>
              <div className="wf-v2-swatch-row">
                {LIGHT_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`wf-v2-swatch ${
                      (node.params?.lightColor ?? '#38bdf8') === hex ? 'active' : ''
                    }`}
                    style={{ background: hex }}
                    onClick={() => onUpdateParams(node.id, { lightColor: hex })}
                  />
                ))}
                <input
                  type="range"
                  className="wf-v2-slider"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={node.params?.intensity ?? 1.3}
                  onChange={(e) =>
                    onUpdateParams(node.id, { intensity: Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}

          {isLogic && logicCat === 'fx' && (
            <>
              <div className="wf-v2-pill-grid single-row">
                {WORKFLOW_V2_FX_OPTIONS.slice(0, 4).map((opt) => {
                  const active = (node.params?.fxKind ?? 'wind_physics') === opt.id
                  const shortFx =
                    opt.id === 'wind_physics'
                      ? 'Đàn hồi'
                      : opt.id === 'bloom'
                        ? 'Bloom'
                        : opt.id === 'blur'
                          ? 'Làm mờ'
                          : 'RGB'
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`wf-v2-opt-pill ${active ? 'active' : ''}`}
                      onClick={() =>
                        onUpdateParams(
                          node.id,
                          { fxKind: opt.id },
                          `Hiệu ứng: ${opt.label}`
                        )
                      }
                    >
                      {shortFx}
                    </button>
                  )
                })}
              </div>
              <div className="wf-v2-param-row">
                <span>Cường độ</span>
                <input
                  type="range"
                  className="wf-v2-slider"
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  value={node.params?.intensity ?? 1.0}
                  onChange={(e) =>
                    onUpdateParams(node.id, { intensity: Number(e.target.value) })
                  }
                />
                <strong>{Math.round((node.params?.intensity ?? 1) * 100)}%</strong>
              </div>
            </>
          )}

          {isLogic && logicCat === 'audio' && (
            <div className="wf-v2-param-row">
              <span>Âm lượng</span>
              <input
                type="range"
                className="wf-v2-slider"
                min={0}
                max={1.5}
                step={0.05}
                value={node.params?.intensity ?? 1.0}
                onChange={(e) =>
                  onUpdateParams(node.id, { intensity: Number(e.target.value) })
                }
              />
              <button
                type="button"
                className={`wf-v2-opt-pill ${node.params?.autoLipSync ? 'active' : ''}`}
                onClick={() =>
                  onUpdateParams(node.id, { autoLipSync: !node.params?.autoLipSync })
                }
              >
                👄 Lip-Sync
              </button>
            </div>
          )}

          {isLogic && logicCat === 'camera' && (
            <div className="wf-v2-pill-grid single-row">
              {WORKFLOW_V2_CAMERA_OPTIONS.map((opt) => {
                const active = (node.params?.camPreset ?? 'dollyIn') === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`wf-v2-opt-pill ${active ? 'active' : ''}`}
                    onClick={() =>
                      onUpdateParams(
                        node.id,
                        { camPreset: opt.id },
                        `Camera: ${opt.label}`
                      )
                    }
                  >
                    {opt.label.replace(/\s*\(.*\)/, '')}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
