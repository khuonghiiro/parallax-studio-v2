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
  onOpenQuickAttach
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)

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

  const zVal = Math.round(boundLayer.transform.position.value[2] ?? 0)

  // Phân tầng độ sâu 2.5D với màu sắc tương phản cao theo chuẩn Dual-Theme
  const zInfo = useMemo(() => {
    if (zVal > 2000) {
      return { label: '🌌 Bầu trời (Hậu cảnh xa)', color: '#c084fc', icon: '🌌' }
    }
    if (zVal > 1000) {
      return { label: '🏔️ Núi xa (Hậu cảnh)', color: '#60a5fa', icon: '🏔️' }
    }
    if (zVal > 200) {
      return { label: '🌲 Trung cảnh (Môi trường)', color: '#2dd4bf', icon: '🌲' }
    }
    if (zVal >= 0) {
      return { label: '🎯 Tiêu điểm (Chủ thể)', color: '#34d399', icon: '🎯' }
    }
    return { label: '🔍 Tiền cảnh (Cận máy)', color: '#fbbf24', icon: '🔍' }
  }, [zVal])

  // Xếp hạng thứ tự Z-index của layer này trong cảnh (từ xa tới gần)
  const { rankIndex, totalLayers, zPercent } = useMemo(() => {
    if (!project || project.layers.length === 0) {
      return { rankIndex: 0, totalLayers: 1, zPercent: 50 }
    }
    const allZ = project.layers
      .map((l) => Math.round(l.transform.position.value[2] ?? 0))
      .sort((a, b) => b - a)
    const rank = Math.max(0, allZ.indexOf(zVal))
    const max = allZ[0]
    const min = allZ[allZ.length - 1]
    const span = Math.max(1, max - min)
    const pct = Math.max(0, Math.min(100, Math.round(((zVal - min) / span) * 100)))
    return { rankIndex: rank, totalLayers: allZ.length, zPercent: pct }
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
      {/* 1. Dải ruy băng Chiều sâu Z & Thước đo Tầng bậc thang (2.5D Depth Ribbon & Ladder) */}
      <div
        className="wf-layer-z-ribbon"
        style={{ ['--depth-c' as string]: zInfo.color }}
        title={`${zInfo.label}\nTầng #${rankIndex + 1}/${totalLayers} · Độ sâu: Z = ${zVal}px (Giá trị càng lớn thì layer càng nằm xa camera)`}
      >
        <div className="wf-layer-z-top-row">
          <span className="wf-layer-z-tag">
            <span>{zInfo.icon}</span>
            <span>{zInfo.label}</span>
          </span>
          <span className="wf-layer-z-rank-pill" title={`Tầng chiều sâu #${rankIndex + 1} trên ${totalLayers} layer trong cảnh`}>
            #{rankIndex + 1}/{totalLayers}
          </span>
          <span className="wf-layer-z-val">Z:{zVal > 0 ? `+${zVal}` : zVal}</span>
        </div>
        <div className="wf-layer-z-meter-bar" title={`Vị trí trong không gian 2.5D: ${zPercent}% (Xa: 100%, Gần: 0%)`}>
          <div className="wf-layer-z-meter-track">
            <div
              className="wf-layer-z-meter-pin"
              style={{ left: `${zPercent}%`, background: zInfo.color }}
            />
          </div>
          <div className="wf-layer-z-meter-labels">
            <span>Gần (-300)</span>
            <span>Xa (+3600)</span>
          </div>
        </div>
      </div>

      {/* 2. Khung Thả Tài Nguyên (Asset Drop Target & Preview) */}
      <div
        className={`wf-layer-drop-zone${isDragOver ? ' drag-over' : ''}`}
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
          <span className="wf-layer-name-line">{boundLayer.name}</span>
          <span className="wf-layer-drop-hint">
            {isDragOver ? '📥 Thả ảnh vào đây để đổi!' : 'Thả ảnh từ Kho tài nguyên vào đây'}
          </span>
          <button
            type="button"
            className="wf-layer-replace-btn"
            onClick={handlePickFile}
            title="Mở hộp thoại chọn tệp ảnh từ máy tính để đổi layer này"
          >
            📂 Đổi ảnh…
          </button>
        </div>
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

          {/* Danh sách các mảnh / layer con trong cụm */}
          {assemblyLayers.length > 0 && (
            <div className="wf-assembly-parts-list">
              {assemblyLayers.map((partLayer) => {
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
