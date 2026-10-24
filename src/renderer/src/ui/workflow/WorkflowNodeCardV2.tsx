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
      badge: 'GROUP 3D & LẮP RÁP',
      icon: '🧊',
      accent: '#06b6d4',
      portIn: 'scene_ctx',
      portOut: 'layers_tree',
      levelClass: 'level-group'
    }
  }
  if (node.params?.groupKind === 'group_25d') {
    return {
      badge: 'GROUP LAYER 2.5D',
      icon: '🗂️',
      accent: '#3b82f6',
      portIn: 'scene_ctx',
      portOut: 'layers_tree',
      levelClass: 'level-group'
    }
  }
  if (node.params?.groupKind === 'group_env') {
    return {
      badge: 'GROUP MÔI TRƯỜNG',
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
      badge: 'NODE ÁNH SÁNG',
      icon: '💡',
      accent: '#f59e0b',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'cave') {
    return {
      badge: 'NODE HANG ĐỘNG',
      icon: '🕳️',
      accent: '#14b8a6',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'fx' || node.type === 'physics_fx') {
    return {
      badge: 'NODE HIỆU ỨNG',
      icon: '✨',
      accent: '#a855f7',
      portIn: 'layers_tree',
      portOut: 'vfx_stage',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'audio' || node.type === 'audio_lipsync') {
    return {
      badge: 'NODE ÂM THANH',
      icon: '🔊',
      accent: '#ec4899',
      portIn: 'layers_tree',
      portOut: 'audio_mix',
      levelClass: 'level-logic'
    }
  }
  if (cat === 'camera' || node.type === 'camera_director') {
    return {
      badge: 'NODE CAMERA 3D',
      icon: '🎥',
      accent: '#22d3ee',
      portIn: 'scene_ctx',
      portOut: 'camera_cut',
      levelClass: 'level-logic'
    }
  }
  return {
    badge: 'NODE HÀNH ĐỘNG',
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
  return (
    <div
      className={[
        'wf-v2-card',
        theme.levelClass,
        selected ? 'selected' : '',
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
      onPointerDown={(e) => {
        onSelect(node.id)
        onStartDragNode(e, node)
      }}
    >
      {/* CỔNG ĐẦU VÀO BÊN TRÁI (Trừ Root Cảnh) */}
      {!isRoot && (
        <div
          className="wf-v2-socket in"
          title="Cổng nhận kết nối từ nhánh cha (Kéo dây vào đây)"
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
        title="Kéo dây từ cổng này sang phải để kết nối hoặc tạo Node mới"
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
      {/* HEADER THẺ NODE */}
      <div className="wf-v2-card-header">
        <span className="wf-v2-card-icon">{theme.icon}</span>
        <div className="wf-v2-card-titles">
          <span className="wf-v2-card-badge">{theme.badge}</span>
          <span className="wf-v2-card-title" title={node.title}>
            {node.title}
          </span>
        </div>
        <div className="wf-v2-card-actions" onPointerDown={(e) => e.stopPropagation()}>
          {(isGroup || isLayer) && childCount > 0 && (
            <button
              type="button"
              className={`wf-v2-icon-btn ${collapsed ? 'is-collapsed' : ''}`}
              title={collapsed ? `Mở rộng ${childCount} nhánh con` : `Thu gọn ${childCount} nhánh con`}
              onClick={() => onUpdateParams(node.id, { collapsedGroup: !collapsed })}
            >
              {collapsed ? `▸+${childCount}` : '▾'}
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
          {!isRoot && onDeleteNode && (
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
      {/* BODY THẺ NODE THEO TỪNG CẤP */}
      <div className="wf-v2-card-body" onPointerDown={(e) => e.stopPropagation()}>
        {/* 1. NỘI DUNG ROOT CẢNH */}
        {isRoot && (
          <div className="wf-v2-root-summary">
            <div className="wf-v2-summary-chips">
              <span className="wf-v2-chip">🗂️ {childCount} nhánh kết nối</span>
              <span className="wf-v2-chip">📐 Parallax 2.5D/3D</span>
            </div>
            {onRebuildSceneTree && (
              <button
                type="button"
                className="wf-v2-rebuild-btn"
                onClick={onRebuildSceneTree}
                title="Đồng bộ và bung lại toàn bộ Group Layer + Layer từ Cảnh hiện tại"
              >
                🔄 Đồng bộ
              </button>
            )}
          </div>
        )}
        {/* 2. NỘI DUNG GROUP LAYER */}
        {isGroup && (
          <div className="wf-v2-group-summary">
            <span className="wf-v2-group-count">
              Đang gom <strong>{node.params?.childLayerCount ?? childCount}</strong> Layer cùng phân nhóm
            </span>
          </div>
        )}
        {/* 3. NỘI DUNG NODE LAYER (Thumbnail + Thanh trượt Z + Dải nút gắn Logic 1-Click) */}
        {isLayer && (
          <div className="wf-v2-layer-content">
            <div className="wf-v2-layer-top">
              <div className="wf-v2-layer-thumb">
                {thumbSrc ? (
                  <img src={thumbSrc} alt={node.title} draggable={false} />
                ) : (
                  <span>{theme.icon}</span>
                )}
              </div>
              <div className="wf-v2-layer-z-box">
                <div className="wf-v2-layer-z-head">
                  <span>Độ sâu Z</span>
                  <strong>{zVal >= 0 ? `+${zVal}` : zVal}</strong>
                </div>
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
              </div>
            </div>
            {/* Dải nút gắn nhanh Node Logic cho Layer này */}
            <div className="wf-v2-layer-spawn-row">
              <button
                type="button"
                className="wf-v2-spawn-chip action"
                title="Gắn thêm Node Hành động (Chuyển động) cho Layer này"
                onClick={() => onAttachLogicToLayer(node.id, 'action')}
              >
                +🏃 Hành động
              </button>
              <button
                type="button"
                className="wf-v2-spawn-chip light"
                title="Gắn thêm Node Ánh sáng cho Layer này"
                onClick={() => onAttachLogicToLayer(node.id, 'light')}
              >
                +💡 Ánh sáng
              </button>
              <button
                type="button"
                className="wf-v2-spawn-chip cave"
                title="Gắn thêm Node Hang động / Vùng độ sâu cho Layer này"
                onClick={() => onAttachLogicToLayer(node.id, 'cave')}
              >
                +🕳️ Hang động
              </button>
              <button
                type="button"
                className="wf-v2-spawn-chip fx"
                title="Gắn thêm Node Hiệu ứng / Vật lý cho Layer này"
                onClick={() => onAttachLogicToLayer(node.id, 'fx')}
              >
                +✨ Hiệu ứng
              </button>
            </div>
          </div>
        )}
        {/* 4. NỘI DUNG CÁC NODE LOGIC CỦA LAYER (HÀNH ĐỘNG / ÁNH SÁNG / HANG ĐỘNG / HIỆU ỨNG / ÂM THANH / CAMERA) */}
        {isLogic && logicCat === 'action' && (
          <div className="wf-v2-logic-box">
            <div className="wf-v2-pill-grid">
              {WORKFLOW_V2_ACTION_OPTIONS.slice(0, 6).map((opt) => {
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
                    {opt.label}
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
          </div>
        )}
        {isLogic && logicCat === 'cave' && (
          <div className="wf-v2-logic-box">
            <div className="wf-v2-pill-grid">
              {WORKFLOW_V2_CAVE_OPTIONS.map((opt) => {
                const active = (node.params?.caveArchShape ?? 'arch') === opt.id
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
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <div className="wf-v2-param-row">
              <span>Độ tối hang</span>
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
          </div>
        )}
        {isLogic && logicCat === 'light' && (
          <div className="wf-v2-logic-box">
            <div className="wf-v2-pill-grid">
              {WORKFLOW_V2_LIGHT_OPTIONS.map((opt) => {
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
                  title={`Màu ánh sáng ${hex}`}
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
          </div>
        )}
        {isLogic && logicCat === 'fx' && (
          <div className="wf-v2-logic-box">
            <div className="wf-v2-pill-grid">
              {WORKFLOW_V2_FX_OPTIONS.map((opt) => {
                const active = (node.params?.fxKind ?? 'wind_physics') === opt.id
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
                    {opt.label.replace(/\s*\(.*\)/, '')}
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
          </div>
        )}
        {isLogic && logicCat === 'audio' && (
          <div className="wf-v2-logic-box">
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
          </div>
        )}
        {isLogic && logicCat === 'camera' && (
          <div className="wf-v2-logic-box">
            <div className="wf-v2-pill-grid">
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
          </div>
        )}
        {/* THANH CHỈNH KHOẢNG MỐC THỜI GIAN [tStart — tEnd] TRỰC TIẾP TRÊN MỌI NODE */}
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
    </div>
  )
}
