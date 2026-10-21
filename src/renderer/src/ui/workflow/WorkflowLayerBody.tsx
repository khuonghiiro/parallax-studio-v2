import React, { useCallback, useMemo, useState } from 'react'
import type { Layer, Project, WorkflowGraph, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import { importBuiltInAsset, replaceLayerAsset, toast } from '../../actions'
import { assetStore } from '../../project/assets'
import { WORKFLOW_LOGIC_NODE_CATALOG } from '../../project/workflowLogicCatalog'
import { resolveLayerAssetThumbUrl } from './WorkflowNodePreview'

export interface WorkflowLayerBodyProps {
  node: WorkflowNode
  project?: Project
  workflow: WorkflowGraph
  boundLayer: Layer
  onSelectNode: (nodeId: string) => void
  onUpdateNodeParams?: (nodeId: string, patch: Partial<WorkflowNodeParams>) => void
}

/**
 * Thân thẻ Node Layer 2.5D trong Workflow.
 * Hiển thị huy hiệu độ sâu Z-index trực quan theo tầng bậc thang,
 * Khung thả tài nguyên ảnh (Drag-and-Drop) từ Kho tài nguyên để đổi asset ngay lập tức,
 * và hiển thị huy hiệu các hiệu ứng Logic đang được kết nối vào Layer này.
 */
export const WorkflowLayerBody: React.FC<WorkflowLayerBodyProps> = React.memo(({
  node,
  project,
  workflow,
  boundLayer,
  onSelectNode
}) => {
  const [isDragOver, setIsDragOver] = useState(false)

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

  const assetId = boundLayer.type === 'image' ? boundLayer.props.assetId : undefined
  const thumbUrl = useMemo(() => {
    if (!project || !assetId) return undefined
    return resolveLayerAssetThumbUrl(assetId, project)
  }, [project, assetId])

  // Quét các Node Hiệu ứng đang kết nối vào Layer này qua các cổng bên phải (vfx_stage, motion_stream, actors_rig, v.v.)
  const connectedEffects = useMemo(() => {
    const list: { id: string; icon: string; title: string; color: string }[] = []
    const edges = workflow.edges.filter(
      (e) =>
        (e.fromNode === node.id || e.toNode === node.id) &&
        e.fromPort !== 'layers_tree' &&
        e.toPort !== 'layers_tree' &&
        e.fromPort !== 'transform_link' &&
        e.toPort !== 'transform_link'
    )

    for (const e of edges) {
      const otherId = e.fromNode === node.id ? e.toNode : e.fromNode
      const otherNode = workflow.nodes.find((n) => n.id === otherId)
      if (!otherNode || otherNode.type === 'scene_shot' || otherNode.type === 'layer_transform') {
        continue
      }
      const logic = WORKFLOW_LOGIC_NODE_CATALOG.find((x) => x.id === otherNode.params?.logicId)
      list.push({
        id: otherNode.id,
        icon: logic?.icon ?? (otherNode.type === 'physics_cloth' ? '🪂' : otherNode.type === 'light_fx' ? '💡' : '🍃'),
        title: logic?.shortLabel ?? otherNode.title,
        color: logic ? '#38bdf8' : '#8b5cf6'
      })
    }
    return list
  }, [workflow.edges, workflow.nodes, node.id])

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
      {/* 1. Dải ruy băng Chiều sâu Z (2.5D Depth Ribbon) */}
      <div
        className="wf-layer-z-ribbon"
        style={{ ['--depth-c' as string]: zInfo.color }}
        title={`${zInfo.label}\nĐộ sâu: Z = ${zVal}px (Giá trị càng lớn thì layer càng nằm xa camera)`}
      >
        <span className="wf-layer-z-tag">{zInfo.label}</span>
        <span className="wf-layer-z-val">Z: {zVal > 0 ? `+${zVal}` : zVal}</span>
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

      {/* 3. Dải Huy hiệu Hiệu ứng Kết nối (Active Effect Badges) */}
      <div className="wf-layer-effects-row">
        <span className="wf-layer-effects-label">Hiệu ứng:</span>
        {connectedEffects.length > 0 ? (
          connectedEffects.map((eff) => (
            <span
              key={eff.id}
              className="wf-layer-effect-pill"
              style={{ ['--eff-c' as string]: eff.color }}
              title={`Đang kích hoạt: ${eff.title} trên Layer này`}
              onClick={() => onSelectNode(eff.id)}
            >
              <span className="wf-eff-dot" />
              <span>{eff.icon}</span>
              <span>{eff.title}</span>
            </span>
          ))
        ) : (
          <span className="wf-layer-effects-none">Nối thêm node hiệu ứng từ cổng bên phải</span>
        )}
      </div>
    </div>
  )
})
