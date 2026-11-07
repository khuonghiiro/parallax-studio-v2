import React, { useMemo, useState, useEffect, useRef } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import type { WorkshopTab } from './WorkshopRightPanel'
import { useLayerAssetImage } from './useLayerAssetImage'
import type { LayerBone } from '@shared/layerRig'
import {
  analyzeCutoutParts,
  createBoneForSingleLayer,
  type CutoutPartInfo
} from './workshopCutoutRig'
import type { RigAction } from './workshopRig'
import { useRigToolStore, setRigToolState, toggleBoneLabels } from './rigToolStore'
import {
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconLayers,
  IconPlus,
  IconSparkles,
  IconText,
  IconX
} from '../icons'
import {
  IconBoneAdd,
  IconBoneHierarchy,
  IconFlexiMeshBind
} from './LayerWorkshopStudioIcons'

const IconChevronLeft = (p: { width?: number; height?: number }) => (
  <svg width={p.width ?? 12} height={p.height ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
)

const IconChevronRight = (p: { width?: number; height?: number }) => (
  <svg width={p.width ?? 12} height={p.height ?? 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
)
import '../../styles/workshopCutoutPartRig.css'

export interface WorkshopCutoutPartRigOverlayProps {
  tab?: WorkshopTab
  composite: LayerComposite
  canvasWidth: number
  canvasHeight: number
  zoom: number
  panX: number
  panY: number
  containerRef: React.RefObject<HTMLDivElement | null>
  selectedLayerId: string | null
  onSelectLayer: (layerId: string | null) => void
  run: (action: RigAction) => void
  onClose: () => void
}

interface PositionedRailItem {
  part: CutoutPartInfo
  side: 'left' | 'right'
  index: number
  railX: number
  railY: number
  targetX: number
  targetY: number
}

const TILE_SIZE = 56
const TILE_GAP = 8
const TOP_OFFSET = 54

interface CutoutRailTileProps {
  item: PositionedRailItem
  isSelected: boolean
  isHovered: boolean
  hasBone: boolean
  assets?: LayerComposite['assets']
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

function CutoutRailTile({
  item,
  isSelected,
  isHovered,
  hasBone,
  assets,
  onSelect,
  onHover
}: CutoutRailTileProps) {
  const layer = item.part.layer
  const resolvedUrl = useLayerAssetImage(layer.asset || layer.assetPath, layer.imageUrl, assets)

  return (
    <div
      className={`lw-cutout-preview-tile ${item.side}${isSelected ? ' is-active' : ''}${isHovered ? ' is-hovered' : ''}`}
      style={{
        left: `${item.railX}px`,
        top: `${item.railY}px`,
        width: `${TILE_SIZE}px`,
        height: `${TILE_SIZE}px`
      }}
      onClick={() => onSelect(layer.id)}
      onPointerEnter={() => onHover(layer.id)}
      onPointerLeave={() => onHover(null)}
      title={`#${item.index + 1}: ${layer.name} (${item.part.roleLabel})\nZ: ${layer.z ?? 0} · ${hasBone ? 'Đã có xương' : 'Chưa có xương'}\n• Click: Focus để ${hasBone ? 'chọn' : 'vẽ xương cho'} bộ phận này`}
    >
      {/* Ảnh thumbnail của bộ phận */}
      <div className="lw-cutout-tile-imgbox">
        {resolvedUrl ? (
          <img
            src={resolvedUrl}
            alt={layer.name}
            className="lw-cutout-tile-img"
            draggable={false}
          />
        ) : (
          <IconLayers width={22} height={22} style={{ opacity: 0.4 }} />
        )}
      </div>

      {/* Badge role góc trên trái */}
      <span className="lw-cutout-tile-role-badge" title={item.part.roleLabel}>
        {item.part.roleIcon}
      </span>

      {/* Badge trạng thái xương góc dưới phải */}
      <span className={`lw-cutout-tile-bone-status${hasBone ? ' has-bone' : ''}`}>
        {hasBone ? '🦴' : '+'}
      </span>

      {/* Khung tên thu nhỏ khi hover */}
      {isHovered && (
        <span className={`lw-cutout-tile-name-tooltip ${item.side}`}>
          {layer.name}
        </span>
      )}
    </div>
  )
}

export function WorkshopCutoutPartRigOverlay({
  tab,
  composite,
  canvasWidth,
  canvasHeight,
  zoom,
  panX,
  panY,
  containerRef,
  selectedLayerId,
  onSelectLayer,
  run,
  onClose
}: WorkshopCutoutPartRigOverlayProps) {
  const rigTool = useRigToolStore()
  const isAnimTab = tab === 'animation' || tab === 'plant'
  const bones = composite.rig?.bones || []
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 })
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null)
  const [isDimmed, setIsDimmed] = useState<boolean>(() => rigTool.dimOtherLayers ?? true)

  // Cập nhật kích thước container để tính toán toạ độ chính xác 100%
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  // Phân tích hình học các bộ phận
  const parts = useMemo(() => analyzeCutoutParts(composite.layers), [composite.layers])

  // Layer đang focus
  const activeLayerId = rigTool.focusedCutoutLayerId || selectedLayerId || parts[0]?.layer.id || null
  const activePart = useMemo(() => parts.find((p) => p.layer.id === activeLayerId) || parts[0], [parts, activeLayerId])

  const activeBone = useMemo(() => {
    if (!activePart?.layer.boneId) return null
    return bones.find((b) => b.id === activePart.layer.boneId) || null
  }, [activePart, bones])

  // Phân bổ các bộ phận thành 2 cột: Cột Trái và Cột Phải
  const positionedItems = useMemo<PositionedRailItem[]>(() => {
    if (parts.length === 0 || viewportSize.w <= 0) return []

    const centerX = viewportSize.w / 2 + panX
    const centerY = viewportSize.h / 2 + panY

    // Phân loại thô theo toạ độ cx
    const leftList: CutoutPartInfo[] = []
    const rightList: CutoutPartInfo[] = []

    parts.forEach((p) => {
      if (p.cx < -12) {
        leftList.push(p)
      } else if (p.cx > 12) {
        rightList.push(p)
      } else {
        // Bộ phận ở trục giữa: phân bổ xen kẽ để 2 bên đều nhau
        if (leftList.length <= rightList.length) {
          leftList.push(p)
        } else {
          rightList.push(p)
        }
      }
    })

    // Sắp xếp mỗi bên từ trên xuống dưới theo cy
    leftList.sort((a, b) => a.cy - b.cy)
    rightList.sort((a, b) => a.cy - b.cy)

    const result: PositionedRailItem[] = []

    // Cột bên trái: cách thanh công cụ dock bên trái (khoảng 64px) để không bị che khuất
    const leftRailX = 64
    leftList.forEach((p, idx) => {
      const railY = TOP_OFFSET + idx * (TILE_SIZE + TILE_GAP)
      const halfW = Math.max(14, (p.w / 2) * zoom)
      // Mũi tên từ trái sang phải trỏ vào cạnh trái bbox của bộ phận (không che tâm hay xương)
      const targetX = centerX + p.cx * zoom - halfW - 6
      const targetY = centerY + p.cy * zoom
      result.push({
        part: p,
        side: 'left',
        index: idx,
        railX: leftRailX,
        railY,
        targetX,
        targetY
      })
    })

    // Cột bên phải: cách mép phải 16 + TILE_SIZE px
    const rightRailX = Math.max(120, viewportSize.w - 16 - TILE_SIZE)
    rightList.forEach((p, idx) => {
      const railY = TOP_OFFSET + idx * (TILE_SIZE + TILE_GAP)
      const halfW = Math.max(14, (p.w / 2) * zoom)
      // Mũi tên từ phải sang trái trỏ vào cạnh phải bbox của bộ phận
      const targetX = centerX + p.cx * zoom + halfW + 6
      const targetY = centerY + p.cy * zoom
      result.push({
        part: p,
        side: 'right',
        index: idx,
        railX: rightRailX,
        railY,
        targetX,
        targetY
      })
    })

    return result
  }, [parts, viewportSize, panX, panY, zoom])

  // Chọn layer để focus
  const handleSelectPart = (id: string) => {
    setRigToolState({
      focusedCutoutLayerId: id,
      targetBindingLayerId: id,
      statusHint: `Đang focus bộ phận "${parts.find((p) => p.layer.id === id)?.layer.name}".`
    })
    onSelectLayer(id)
  }

  // Điều hướng trước / sau
  const handleStepPart = (delta: -1 | 1) => {
    if (parts.length <= 1) return
    const curIdx = parts.findIndex((p) => p.layer.id === activeLayerId)
    const nextIdx = (curIdx + delta + parts.length) % parts.length
    const nextPart = parts[nextIdx]
    if (nextPart) handleSelectPart(nextPart.layer.id)
  }

  // Tạo xương tự động cho bộ phận đang focus
  const handleAutoCreateBone = () => {
    if (!activePart) return
    run({
      action: 'create-bone-for-layer',
      layerId: activePart.layer.id,
      parentId: undefined,
      mode: activePart.suggestedBindingMode
    })
    setRigToolState({
      statusHint: `✓ Đã tạo xương và gắn khớp cho "${activePart.layer.name}".`
    })
  }

  // Kích hoạt vẽ chuột cho bộ phận đang focus
  const handleStartDrawBone = () => {
    if (!activePart) return
    setRigToolState({
      tool: 'add',
      targetBindingLayerId: activePart.layer.id,
      targetBindingMode: activePart.suggestedBindingMode,
      statusHint: `✏️ Kéo vẽ chuột trên Sân khấu 2D để tạo xương gắn thẳng cho "${activePart.layer.name}".`
    })
  }

  // Đổi xương cha
  const handleReparent = (newParentId: string) => {
    if (!activeBone) return
    run({
      action: 'reparent-bone',
      boneId: activeBone.id,
      newParentId: newParentId || undefined
    })
  }

  // Đổi chế độ cứng/mềm
  const handleToggleMode = (mode: 'rigid' | 'soft') => {
    if (!activePart?.layer.boneId) return
    run({
      action: 'bind',
      boneId: activePart.layer.boneId,
      layerIds: [activePart.layer.id],
      mode
    })
  }

  // Toggle làm mờ các lớp khác
  const toggleDim = () => {
    const next = !isDimmed
    setIsDimmed(next)
    setRigToolState({ dimOtherLayers: next })
  }

  return (
    <div className="lw-cutout-part-rig-overlay" data-mcp-region="layer_assembly_cutout_stage">
      {/* 1. SVG Dây nét đứt & Mũi tên trỏ từ ô Preview vào đúng vị trí bộ phận trên nhân vật */}
      <svg
        className="lw-cutout-svg-canvas"
        width={viewportSize.w}
        height={viewportSize.h}
        viewBox={`0 0 ${viewportSize.w} ${viewportSize.h}`}
      >
        <defs>
          <marker
            id="cutout-arrow-active"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-cyan, #38bdf8)" />
          </marker>
          <marker
            id="cutout-arrow-idle"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 2 L 7 5 L 0 8 z" fill="var(--line-focus, rgba(56,189,248,0.5))" />
          </marker>
        </defs>

        {positionedItems.map((item) => {
          const isSelected = item.part.layer.id === activeLayerId
          const isHovered = item.part.layer.id === hoveredLayerId
          const highlight = isSelected || isHovered

          // Điểm xuất phát từ cổng của ô preview (mép trong hướng vào nhân vật)
          const startX = item.side === 'left' ? item.railX + TILE_SIZE : item.railX
          const startY = item.railY + TILE_SIZE / 2

          const targetX = item.targetX
          const targetY = item.targetY

          // Đường cong Bezier mượt mà
          const dx = Math.abs(targetX - startX)
          const ctrlX1 = item.side === 'left' ? startX + dx * 0.45 : startX - dx * 0.45
          const ctrlY1 = startY
          const ctrlX2 = item.side === 'left' ? targetX - dx * 0.25 : targetX + dx * 0.25
          const ctrlY2 = targetY

          const pathD = `M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${targetX} ${targetY}`

          return (
            <g key={`cutout-path-${item.part.layer.id}`}>
              {/* Vầng sáng halo khi highlight */}
              {highlight && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? 'var(--accent-cyan, #38bdf8)' : 'var(--key, #f59e0b)'}
                  strokeWidth={6}
                  strokeOpacity={0.22}
                  strokeLinecap="round"
                />
              )}

              {/* Đường nét đứt chính */}
              <path
                d={pathD}
                fill="none"
                stroke={
                  isSelected
                    ? 'var(--accent-cyan, #38bdf8)'
                    : isHovered
                      ? 'var(--key, #f59e0b)'
                      : 'var(--line-focus, rgba(56, 189, 248, 0.4))'
                }
                strokeWidth={highlight ? 2.2 : 1.25}
                strokeDasharray={isSelected ? '6 4' : '4 3'}
                strokeOpacity={highlight ? 1 : 0.42}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={isSelected ? 'url(#cutout-arrow-active)' : 'url(#cutout-arrow-idle)'}
                className={isSelected ? 'lw-cutout-dash-running' : undefined}
              />

              {/* Cổng xuất phát trên ô vuông */}
              <circle
                cx={startX}
                cy={startY}
                r={highlight ? 3.5 : 2.5}
                fill={isSelected ? '#ffffff' : 'var(--accent-cyan)'}
                stroke="var(--bg-2)"
                strokeWidth={1.2}
              />

              {/* Điểm ngắm tâm Target Crosshair trên bộ phận */}
              {highlight && (
                <g>
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r={isSelected ? 6 : 4}
                    fill="none"
                    stroke={isSelected ? 'var(--accent-cyan, #38bdf8)' : 'var(--key, #f59e0b)'}
                    strokeWidth={1.8}
                    className="lw-cutout-target-pulse"
                  />
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r={2.2}
                    fill={isSelected ? '#ffffff' : 'var(--accent-cyan)'}
                  />
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* 2. Thanh Công cụ HUD nổi trên đỉnh Sân khấu 2D */}
      <div className={`lw-cutout-floating-hud${isAnimTab ? ' is-anim-tab' : ''}`}>
        <div className="lw-cutout-hud-part-info">
          <span className="lw-cutout-hud-icon">{activePart?.roleIcon || '🧩'}</span>
          <div className="lw-cutout-hud-titles">
            <strong title={activePart?.layer.name || 'Chọn bộ phận'}>
              {activePart?.layer.name || 'Chọn bộ phận'}
            </strong>
            <small>
              <span className="lw-cutout-role-text" title={`${activePart?.roleLabel || ''} · Z: ${activePart?.layer.z ?? 0}`}>
                {activePart?.roleLabel} · Z: {activePart?.layer.z ?? 0}
              </span>
              {activeBone ? (
                <span className="lw-cutout-bone-badge bound" title={`Gắn với xương ${activeBone.name}`}>
                  🦴 {activeBone.name}
                </span>
              ) : (
                <span className="lw-cutout-bone-badge unbound">Chưa có xương</span>
              )}
            </small>
          </div>
        </div>

        <div className="lw-cutout-hud-sep" />

        <div className="lw-cutout-hud-actions">
          {!isAnimTab && (
            <>
<button
            type="button"
            className="btn xs primary lw-cutout-hud-btn"
            onClick={handleAutoCreateBone}
            title="Tự động tính góc & độ dài khớp với bộ phận này rồi tạo xương gắn ngay"
          >
            <IconSparkles width={11} height={11} />
            <span>Tạo xương</span>
          </button>

          <button
            type="button"
            className={`btn xs lw-cutout-hud-btn${rigTool.tool === 'add' ? ' active' : ''}`}
            onClick={handleStartDrawBone}
            title="Kéo rê chuột trên Sân khấu 2D để vẽ xương tự gắn vào bộ phận này"
          >
            <IconBoneAdd width={11} height={11} />
            <span>Vẽ chuột</span>
          </button>

          {activeBone && (
            <>
              <div className="lw-cutout-hud-dropdown">
                <span style={{ fontSize: '10px', color: 'var(--text-dim)', marginRight: 4 }}>Cha:</span>
                <select
                  value={activeBone.parentId || ''}
                  onChange={(e) => handleReparent(e.target.value)}
                  className="lw-cutout-mini-select"
                  title="Chọn xương cha để kết nối phân cấp chuyển động"
                >
                  <option value="">-- Gốc --</option>
                  {bones
                    .filter((b) => b.id !== activeBone.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="lw-cutout-hud-pills">
                <button
                  type="button"
                  className={`lw-cutout-hud-pill${activePart?.layer.bindingMode !== 'soft' ? ' active' : ''}`}
                  onClick={() => handleToggleMode('rigid')}
                  title="Cứng (Layer): giữ nguyên hình dạng không bị méo"
                >
                  Cứng
                </button>
                <button
                  type="button"
                  className={`lw-cutout-hud-pill${activePart?.layer.bindingMode === 'soft' ? ' active' : ''}`}
                  onClick={() => handleToggleMode('soft')}
                  title="Uốn mềm (Mesh): uốn lượn theo xương"
                >
                  Uốn
                </button>
              </div>
            </>
          )}

                      </>
          )}

          <button
            type="button"
            className={`btn xs icon ghost lw-cutout-hud-btn${isDimmed ? ' active' : ''}`}
            onClick={toggleDim}
            title={isDimmed ? 'Đang làm mờ các lớp khác (Bấm để hiện rõ tất cả)' : 'Làm mờ các lớp khác để tập trung'}
          >
            {isDimmed ? <IconEyeOff width={12} height={12} /> : <IconEye width={12} height={12} />}
          </button>

          <button
            type="button"
            className={`btn xs icon ghost lw-cutout-hud-btn${(rigTool.showBoneLabels ?? true) ? ' active' : ''}`}
            onClick={toggleBoneLabels}
            title={(rigTool.showBoneLabels ?? true) ? 'Nhãn tên xương (Đang hiện) · Bấm để ẩn bớt rối' : 'Nhãn tên xương (Đang ẩn) · Bấm để hiện'}
          >
            <IconText width={12} height={12} />
          </button>

          <div className="lw-cutout-hud-nav">
            <button
              type="button"
              className="btn xs icon ghost"
              onClick={() => handleStepPart(-1)}
              title="Bộ phận trước"
            >
              <IconChevronLeft width={12} height={12} />
            </button>
            <button
              type="button"
              className="btn xs icon ghost"
              onClick={() => handleStepPart(1)}
              title="Bộ phận kế tiếp"
            >
              <IconChevronRight width={12} height={12} />
            </button>
          </div>

          <button
            type="button"
            className="btn xs icon ghost lw-cutout-close-btn"
            onClick={onClose}
            title="Thoát chế độ vẽ theo bộ phận"
          >
            <IconX width={12} height={12} />
          </button>
        </div>
      </div>

      {/* 3. Các Ô Vuông Preview Bộ Phận ở 2 Bên Sân Khấu (Trái & Phải) */}
      {positionedItems.map((item) => (
        <CutoutRailTile
          key={`rail-tile-${item.part.layer.id}`}
          item={item}
          isSelected={item.part.layer.id === activeLayerId}
          isHovered={item.part.layer.id === hoveredLayerId}
          hasBone={Boolean(item.part.layer.boneId)}
          assets={composite.assets}
          onSelect={handleSelectPart}
          onHover={setHoveredLayerId}
        />
      ))}
    </div>
  )
}
