import React, { useCallback, useMemo, useState } from 'react'
import type { Layer, Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { importBuiltInAsset, replaceLayerAsset, toast } from '../../actions'
import { assetStore } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { getStoredModels3D } from '../assets/models3d/models3dStorage'
import { requestOpenLayerAssembly } from '../layerAssembly/layerAssemblyBridge'
import { resolveLayerAssetThumbUrl } from './WorkflowNodePreview'
import { WorkflowMainNodeEnrichedBar } from './WorkflowAtomicCardBody'

export interface WorkflowLayerBodyProps {
  node: WorkflowNode
  project?: Project
  workflow: WorkflowGraph
  boundLayer: Layer
  onSelectNode: (nodeId: string) => void
  onToggleNode: (nodeId: string) => void
  onDisconnectEdge?: (edgeId: string) => void
  onOpenQuickAttach?: (e: React.MouseEvent, mainNode: WorkflowNode) => void
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
}

/**
 * Thân thẻ Node Layer 2.5D trong Workflow.
 * Hiển thị huy hiệu độ sâu Z-index trực quan theo tầng bậc thang,
 * Khung thả tài nguyên ảnh (Drag-and-Drop) từ Kho tài nguyên để đổi asset ngay lập tức,
 * và hiển thị khay các Node Chức Năng Đơn Lẻ đang kết nối làm giàu cho Layer này.
 */
export const WorkflowLayerBody: React.FC<WorkflowLayerBodyProps> = React.memo(({
  node,
  project,
  workflow,
  boundLayer,
  onSelectNode,
  onToggleNode,
  onDisconnectEdge,
  onOpenQuickAttach,
  onUpdateNodeParams
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [showTransformAxes, setShowTransformAxes] = useState(false)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)

  const targetLayerIds = useMemo(
    () => (node.params?.targetLayerIds?.length ? node.params.targetLayerIds : [boundLayer.id]),
    [node.params?.targetLayerIds, boundLayer.id]
  )

  const isAssembly = useMemo(() => {
    return Boolean(
      node.params?.isAssemblyRoot ||
      boundLayer.composite ||
      boundLayer.model3d ||
      (node.params?.targetLayerIds && node.params.targetLayerIds.length > 1)
    )
  }, [node.params?.isAssemblyRoot, node.params?.targetLayerIds, boundLayer.composite, boundLayer.model3d])

  const assemblyKind = useMemo(() => {
    if (boundLayer.model3d || node.params?.assemblyKind === 'model3d') return 'model3d'
    if (boundLayer.composite || node.params?.assemblyKind === 'composite') return 'composite'
    return null
  }, [boundLayer.model3d, boundLayer.composite, node.params?.assemblyKind])

  const assemblyLayers = useMemo(() => {
    if (!isAssembly || !project) return []
    const ids = node.params?.targetLayerIds ?? [boundLayer.id]
    return project.layers.filter((l) => ids.includes(l.id))
  }, [isAssembly, project, node.params?.targetLayerIds, boundLayer.id])

  const handleOpenWorkshop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (assemblyKind === 'model3d') {
        const stored = getStoredModels3D()
        const modelId = boundLayer.model3d?.modelId
        const model = stored.find((m) => m.id === modelId) ?? stored[0]
        if (model) {
          useView.getState().openAssemblyWorkshop(model)
        } else {
          toast('Không tìm thấy dữ liệu mô hình 3D tương ứng')
        }
      } else {
        const compId = boundLayer.composite?.compositeId || boundLayer.composite?.compositeName
        requestOpenLayerAssembly(compId)
      }
    },
    [assemblyKind, boundLayer.model3d, boundLayer.composite]
  )

  const posX = Math.round(boundLayer.transform.position.value[0] ?? 0)
  const posY = Math.round(boundLayer.transform.position.value[1] ?? 0)
  const zVal = Math.round(boundLayer.transform.position.value[2] ?? 0)
  const rotZ = Math.round(boundLayer.transform.rotation.value[2] ?? 0)

  const handleAxisScrub = useCallback(
    (axis: 'x' | 'y' | 'z' | 'rot', value: number) => {
      const baseOldVal = axis === 'x' ? posX : axis === 'y' ? posY : axis === 'z' ? zVal : rotZ
      const delta = value - baseOldVal
      useEditor.getState().update((draft) => {
        for (const tid of targetLayerIds) {
          const l = draft.layers.find((item) => item.id === tid)
          if (!l || l.locked || (l.parentId && targetLayerIds.includes(l.parentId))) continue
          if (targetLayerIds.length === 1) {
            if (axis === 'x') l.transform.position.value[0] = value
            else if (axis === 'y') l.transform.position.value[1] = value
            else if (axis === 'z') l.transform.position.value[2] = value
            else if (axis === 'rot') l.transform.rotation.value[2] = value
          } else {
            if (axis === 'x') l.transform.position.value[0] = Math.round((l.transform.position.value[0] ?? 0) + delta)
            else if (axis === 'y') l.transform.position.value[1] = Math.round((l.transform.position.value[1] ?? 0) + delta)
            else if (axis === 'z') l.transform.position.value[2] = Math.round((l.transform.position.value[2] ?? 0) + delta)
            else if (axis === 'rot') l.transform.rotation.value[2] = Math.round((l.transform.rotation.value[2] ?? 0) + delta)
          }
        }
      }, `wf-inline-axis-${boundLayer.id}-${axis}`)

      const patch: Partial<WorkflowNodeParams> = {}
      if (axis === 'x') patch.transformX = value
      else if (axis === 'y') patch.transformY = value
      else if (axis === 'z') patch.transformZ = value
      else if (axis === 'rot') patch.transformRotation = value
      onUpdateNodeParams?.(node.id, patch)
    },
    [posX, posY, zVal, rotZ, targetLayerIds, boundLayer.id, node.id, onUpdateNodeParams]
  )

  // Phân tầng độ sâu 2.5D với màu sắc tương phản cao theo chuẩn Dual-Theme
  const zInfo = useMemo(() => {
    if (zVal > 2000) {
      return { label: 'Bầu trời', color: '#c084fc', icon: '🌌' }
    }
    if (zVal > 1000) {
      return { label: 'Núi xa', color: '#60a5fa', icon: '🏔️' }
    }
    if (zVal > 200) {
      return { label: 'Trung cảnh', color: '#2dd4bf', icon: '🌲' }
    }
    if (zVal >= 0) {
      return { label: 'Tiêu điểm', color: '#34d399', icon: '🎯' }
    }
    return { label: 'Tiền cảnh', color: '#fbbf24', icon: '🔍' }
  }, [zVal])

  // Xếp hạng thứ tự Z-index của layer này trong cảnh (từ xa tới gần)
  const { rankIndex, totalLayers } = useMemo(() => {
    if (!project || project.layers.length === 0) {
      return { rankIndex: 0, totalLayers: 1 }
    }
    const allZ = project.layers
      .map((l) => Math.round(l.transform.position.value[2] ?? 0))
      .sort((a, b) => b - a)
    const rank = Math.max(0, allZ.indexOf(zVal))
    return { rankIndex: rank, totalLayers: allZ.length }
  }, [project, zVal])

  const assetId = boundLayer.type === 'image' ? boundLayer.props.assetId : undefined
  const thumbUrl = useMemo(() => {
    if (!project || !assetId) return undefined
    return resolveLayerAssetThumbUrl(assetId, project)
  }, [project, assetId])

  // Xử lý kéo thả tài nguyên vào trực tiếp thẻ Layer Node
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      // 1. Thả Built-in asset từ Kho tài nguyên hệ thống
      const builtinData = e.dataTransfer.getData('application/x-pxs-builtin-asset')
      if (builtinData) {
        try {
          const item = JSON.parse(builtinData)
          const newAssetId = await importBuiltInAsset(item, false)
          if (newAssetId) {
            replaceLayerAsset(boundLayer.id, newAssetId)
            toast(`Đã đổi ảnh layer sang "${item.name}"`)
          }
        } catch (err) {
          console.error('[WorkflowLayerBody] Error dropping builtin asset:', err)
        }
        return
      }

      // 2. Thả Project asset từ danh sách tài nguyên dự án
      const projectAssetId = e.dataTransfer.getData('application/x-pxs-asset')
      if (projectAssetId) {
        replaceLayerAsset(boundLayer.id, projectAssetId)
        toast('Đã đổi ảnh layer thành công!')
        return
      }

      // 3. Thả tệp ảnh trực tiếp từ máy tính
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (files.length > 0) {
        const file = files[0]
        const data = new Uint8Array(await file.arrayBuffer())
        const asset = await assetStore.add(file.name, file.type, data, 'image')
        if (asset?.meta?.id) {
          replaceLayerAsset(boundLayer.id, asset.meta.id)
          toast(`Đã nạp và đổi ảnh sang "${file.name}"`)
        }
      }
    },
    [boundLayer.id]
  )

  const handlePickFile = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const files = await window.api.openFiles('image')
        if (!files || files.length === 0) return
        const f = files[0]
        const asset = await assetStore.add(f.name, f.mime, f.data, 'image')
        if (asset?.meta?.id) {
          replaceLayerAsset(boundLayer.id, asset.meta.id)
          toast(`Đã đổi ảnh layer sang "${f.name}"`)
        }
      } catch (err) {
        console.error('[WorkflowLayerBody] Error picking image file:', err)
      }
    },
    [boundLayer.id]
  )

  return (
    <div className="wf-layer-card-body" onClick={(e) => e.stopPropagation()}>
      {/* 1. Hàng Nhận Diện Layer Gọn Chuẩn ComfyUI (Thumbnail + Tầng Z + Nút Đổi Ảnh / Mở Tọa Độ) */}
      <div
        className={`wf-layer-drop-zone compact${isDragOver ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => onSelectNode(node.id)}
        title="Kéo thả ảnh từ Kho tài nguyên hoặc máy tính vào đây để thay đổi hình ảnh layer"
      >
        <div className="wf-layer-thumb-wrap">
          {thumbUrl ? (
            <img src={thumbUrl} alt={boundLayer.name} className="wf-layer-thumb-img" />
          ) : (
            <span className="wf-layer-thumb-fallback">
              {boundLayer.type === 'text'
                ? '🔤'
                : boundLayer.type === 'particles'
                  ? '✨'
                  : boundLayer.composite
                    ? '🎭'
                    : '🖼️'}
            </span>
          )}
        </div>

        <div className="wf-layer-info-col">
          <div className="wf-layer-z-top-row">
            <span className="wf-layer-z-tag" style={{ ['--depth-c' as string]: zInfo.color }}>
              <span>{zInfo.icon}</span>
              <span>{zInfo.label}</span>
            </span>
            <span
              className="wf-layer-z-rank-pill"
              style={{ ['--depth-c' as string]: zInfo.color }}
              title={`Tầng chiều sâu #${rankIndex + 1} trên ${totalLayers} layer trong cảnh`}
            >
              #{rankIndex + 1}/{totalLayers}
            </span>
          </div>
          <span className="wf-layer-drop-hint">
            {isDragOver ? '📥 Thả ảnh để đổi ngay!' : 'Kéo thả ảnh vào đây để thay thế'}
          </span>
        </div>

        <div className="wf-layer-quick-btns">
          <button
            type="button"
            className="wf-layer-replace-btn"
            onClick={handlePickFile}
            title="Chọn tệp ảnh từ máy tính để đổi layer này"
          >
            📂 Đổi
          </button>
          <button
            type="button"
            className={`wf-layer-replace-btn${showTransformAxes ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setShowTransformAxes((v) => !v)
            }}
            title="Mở nhanh thanh trượt chỉnh tọa độ Ngang X / Dọc Y / Xoay ngay trên thẻ Layer"
          >
            📐 X/Y {showTransformAxes ? '▴' : '▾'}
          </button>
        </div>
      </div>

      {/* 2. Thanh trượt Chiều sâu Z trực tiếp kiểu ComfyUI (+ Mở rộng X / Y / Xoay 60fps) */}
      <div className="wf-comfy-scrubber-box" style={{ ['--depth-c' as string]: zInfo.color }}>
        <div className="wf-comfy-scrubber-row">
          <span className="wf-comfy-scrubber-lbl" title="Kéo để đẩy Layer ra xa hoặc kéo lại gần Camera 3D (60fps)">
            Độ sâu Z
          </span>
          <input
            type="range"
            className="wf-transform-slider-input axis-z"
            min={-600}
            max={3600}
            step={10}
            value={zVal}
            onChange={(e) => handleAxisScrub('z', parseFloat(e.target.value))}
            title={`Độ sâu Z = ${zVal}px (Càng lớn càng xa Camera)`}
          />
          <span className="wf-comfy-scrubber-val">
            {zVal > 0 ? `+${zVal}` : zVal}
          </span>
        </div>

        {showTransformAxes && (
          <div className="wf-comfy-extra-axes">
            <div className="wf-comfy-scrubber-row">
              <span className="wf-comfy-scrubber-lbl axis-x">↔ Ngang X</span>
              <input
                type="range"
                className="wf-transform-slider-input axis-x"
                min={-1920}
                max={1920}
                step={2}
                value={posX}
                onChange={(e) => handleAxisScrub('x', parseFloat(e.target.value))}
              />
              <span className="wf-comfy-scrubber-val">{posX}</span>
            </div>
            <div className="wf-comfy-scrubber-row">
              <span className="wf-comfy-scrubber-lbl axis-y">↕ Dọc Y</span>
              <input
                type="range"
                className="wf-transform-slider-input axis-y"
                min={-1080}
                max={1080}
                step={2}
                value={posY}
                onChange={(e) => handleAxisScrub('y', parseFloat(e.target.value))}
              />
              <span className="wf-comfy-scrubber-val">{posY}</span>
            </div>
            <div className="wf-comfy-scrubber-row">
              <span className="wf-comfy-scrubber-lbl axis-rot">↻ Xoay °</span>
              <input
                type="range"
                className="wf-transform-slider-input axis-rot"
                min={-180}
                max={180}
                step={1}
                value={rotZ}
                onChange={(e) => handleAxisScrub('rot', parseFloat(e.target.value))}
              />
              <span className="wf-comfy-scrubber-val">{rotZ}°</span>
            </div>
          </div>
        )}
      </div>

      {/* 2b. Cụm Lắp Ráp 3D hoặc Layer 2.5D (Assembly Sub-Parts Chips & Workshop Launcher) */}
      {isAssembly && (
        <div className="wf-layer-assembly-section">
          <div className="wf-layer-assembly-header">
            <span className="wf-layer-assembly-badge">
              {assemblyKind === 'model3d' ? '🏛️ Cụm 3D' : '🧩 Cụm 2.5D'} ({assemblyLayers.length} con)
            </span>
            <button
              type="button"
              className="wf-assembly-open-workshop-btn"
              onClick={handleOpenWorkshop}
              title={
                assemblyKind === 'model3d'
                  ? 'Mở Xưởng Lắp Ráp Mô Hình 3D'
                  : 'Mở Xưởng Lắp Ráp Layer 2.5D'
              }
            >
              {assemblyKind === 'model3d' ? '🛠️ Xưởng 3D' : '🎭 Xưởng Layer'}
            </button>
          </div>

          {assemblyLayers.length > 0 && (
            <div className="wf-assembly-parts-list">
              {assemblyLayers.slice(0, 6).map((partLayer) => {
                const cleanPartName = partLayer.name
                  .replace(/^\[.*?\]\s*/, '')
                  .replace(/^.*[\\/]/, '')
                const isSelected = selectedLayerId === partLayer.id
                return (
                  <button
                    key={partLayer.id}
                    type="button"
                    className={`wf-assembly-part-chip${isSelected ? ' active' : ''}`}
                    onClick={() => useEditor.getState().selectLayer(partLayer.id)}
                    title={`Chọn mảnh: ${partLayer.name} trong cảnh`}
                  >
                    <span className="wf-assembly-part-dot" />
                    <span className="wf-assembly-part-name">{cleanPartName || partLayer.name}</span>
                  </button>
                )
              })}
              {assemblyLayers.length > 6 && (
                <span className="wf-assembly-part-chip">+{assemblyLayers.length - 6}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Khay Các Node Chức Năng Đơn Lẻ Đang Kết Hợp Làm Giàu Cho Layer Này */}
      <WorkflowMainNodeEnrichedBar
        mainNode={node}
        workflow={workflow}
        onSelectNode={onSelectNode}
        onToggleNode={onToggleNode}
        onDisconnectEdge={onDisconnectEdge}
        onOpenQuickAttach={onOpenQuickAttach}
      />
    </div>
  )
})
