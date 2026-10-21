import type React from 'react'
import { useCallback, useState } from 'react'
import type { Project, WorkflowEdge, WorkflowGraph, WorkflowNode } from '@shared/types'
import { addLayerFromAsset, importBuiltInAsset } from '../../actions'
import { assetStore } from '../../project/assets'
import { formatLayerNodeLabel } from '../../project/workflowSceneHierarchy'
import { useEditor } from '../../store/editor'

export interface UseWorkflowAssetDropParams {
  project: Project
  workflow: WorkflowGraph
  currentShotScope?: string
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number }
  commitWorkflow: (wf: WorkflowGraph, mergeKey?: string, syncScene?: boolean, selectIds?: Set<string>) => void
  onDropLogicNode?: (logicId: string, worldPos: { x: number; y: number }) => void
  showToast: (msg: string) => void
}

/**
 * Hook chuyên biệt quản lý Kéo Thả Tài Nguyên Trực Tiếp lên Workflow Canvas (Drag-and-Drop Spawning).
 * Cho phép kéo ảnh, nhân vật 2.5D, mô hình 3D từ Kho tài nguyên hoặc máy tính thả thẳng vào sơ đồ,
 * tự động sinh Node Layer tại vị trí chuột và tự động nối dây phân cấp từ Scene.
 */
export function useWorkflowAssetDrop({
  project,
  workflow,
  currentShotScope,
  clientToWorld,
  commitWorkflow,
  onDropLogicNode,
  showToast
}: UseWorkflowAssetDropParams) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types)
    const isSupported =
      types.includes('application/x-pxs-logic-id') ||
      types.includes('application/x-pxs-node-type') ||
      types.includes('application/x-pxs-builtin-asset') ||
      types.includes('application/x-pxs-asset') ||
      types.includes('Files')

    if (isSupported) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      setIsDragOver(false)
      const w = clientToWorld(e.clientX, e.clientY)
      const dropWorldPos = {
        x: Math.round(w.x - 124),
        y: Math.round(w.y - 40)
      }

      // 1. Thả Khối Logic từ Thư viện Node bên trái
      const logicId = e.dataTransfer.getData('application/x-pxs-logic-id')
      if (logicId && onDropLogicNode) {
        e.preventDefault()
        onDropLogicNode(logicId, dropWorldPos)
        return
      }

      // 2. Thả Built-in Asset từ Kho Tài Nguyên Hệ Thống
      const builtinRaw = e.dataTransfer.getData('application/x-pxs-builtin-asset')
      if (builtinRaw) {
        e.preventDefault()
        try {
          const item = JSON.parse(builtinRaw)
          const assetId = await importBuiltInAsset(item, false)
          if (assetId) {
            addLayerFromAsset(assetId)
            const st = useEditor.getState()
            const newLayer = st.project.layers[st.project.layers.length - 1]
            if (newLayer) {
              spawnLayerToWorkflow(newLayer.id, newLayer.name, dropWorldPos)
              showToast(`✓ Đã thêm và liên kết Layer "${newLayer.name}" vào sơ đồ!`)
            }
          }
        } catch (err) {
          console.error('[useWorkflowAssetDrop] Built-in asset drop error:', err)
        }
        return
      }

      // 3. Thả Project Asset từ Danh sách Tài nguyên Dự án
      const projectAssetId = e.dataTransfer.getData('application/x-pxs-asset')
      if (projectAssetId) {
        e.preventDefault()
        addLayerFromAsset(projectAssetId)
        const st = useEditor.getState()
        const newLayer = st.project.layers[st.project.layers.length - 1]
        if (newLayer) {
          spawnLayerToWorkflow(newLayer.id, newLayer.name, dropWorldPos)
          showToast(`✓ Đã thêm và liên kết Layer "${newLayer.name}" vào sơ đồ!`)
        }
        return
      }

      // 4. Thả tệp ảnh trực tiếp từ máy tính (OS File Explorer)
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (files.length > 0) {
        e.preventDefault()
        const file = files[0]
        const data = new Uint8Array(await file.arrayBuffer())
        const asset = await assetStore.add(file.name, file.type, data, 'image')
        if (asset?.meta?.id) {
          addLayerFromAsset(asset.meta.id)
          const st = useEditor.getState()
          const newLayer = st.project.layers[st.project.layers.length - 1]
          if (newLayer) {
            spawnLayerToWorkflow(newLayer.id, newLayer.name, dropWorldPos)
            showToast(`✓ Đã nạp và liên kết Layer "${file.name}" vào sơ đồ!`)
          }
        }
      }
    },
    [clientToWorld, onDropLogicNode, showToast]
  )

  /**
   * Tạo Node Layer và Companion Transform Plate ngay tại vị trí thả chuột,
   * đồng thời nối tự động với Node Phân cảnh (Scene Node) nếu có trên bản vẽ.
   */
  const spawnLayerToWorkflow = useCallback(
    (layerId: string, layerName: string, pos: { x: number; y: number }) => {
      const st = useEditor.getState()
      const targetLayer = st.project.layers.find((l) => l.id === layerId)
      if (!targetLayer) return

      const cleanId = layerId.replace(/[^a-zA-Z0-9_-]/g, '_')
      const shotPrefix = targetLayer.shotId || currentShotScope || 'shot'
      const layerNodeId = `wf-layer-${shotPrefix}-${cleanId}`
      const transNodeId = `wf-trans-${shotPrefix}-${cleanId}`

      // Bỏ qua nếu node đã tồn tại
      if (workflow.nodes.some((n) => n.id === layerNodeId)) return

      const meta = formatLayerNodeLabel(targetLayer, st.project)
      const isComp = Boolean(targetLayer.composite?.instanceId)
      const isModel3d = Boolean(targetLayer.model3d?.instanceId || targetLayer.model3d?.modelId)
      const allGroupIds = isComp
        ? st.project.layers.filter((l) => l.composite?.instanceId === targetLayer.composite?.instanceId).map((l) => l.id)
        : isModel3d
          ? st.project.layers.filter((l) => {
              const inst = targetLayer.model3d?.instanceId || targetLayer.model3d?.modelId
              return l.model3d?.instanceId === inst || l.model3d?.modelId === inst
            }).map((l) => l.id)
          : [targetLayer.id]

      const isAssemblyRoot = isComp || isModel3d || allGroupIds.length > 1
      const assemblyKind = isModel3d ? 'model3d' : isComp ? 'composite' : undefined

      const childEstimatedHeight = 24 + 6 + 18 + 205 + (isAssemblyRoot ? 80 : 0)

      const layerNode: WorkflowNode = {
        id: layerNodeId,
        type: 'layer_assembly',
        title: meta.title,
        enabled: true,
        position: { x: pos.x, y: pos.y },
        preset: isAssemblyRoot ? 'character_and_foliage_rig' : 'character_puppet_25d',
        aiAgentRole: 'AssemblyRigAgent',
        aiDirective: `Quản lý hiển thị và lắp ráp layer "${layerName}".`,
        params: {
          shotId: targetLayer.shotId || currentShotScope,
          targetMode: 'custom',
          targetLayerIds: allGroupIds,
          isAssemblyRoot,
          assemblyKind,
          childLayerCount: allGroupIds.length,
          targetParts: meta.partNames
        }
      }

      const transTitle = isComp
        ? `🎯 Tọa độ: ${meta.title.replace('🧩 Cụm Lắp Ráp 2.5D: ', '').replace('🧩 Layer 2.5D: ', '')}`
        : isModel3d
          ? `🎯 Tọa độ: ${meta.title.replace('🏛️ Cụm Lắp Ráp 3D: ', '').replace('🏛️ Mô hình 3D: ', '')}`
          : `🎯 Tọa độ: ${layerName}`

      const transformNode: WorkflowNode = {
        id: transNodeId,
        type: 'layer_transform',
        title: transTitle,
        enabled: true,
        position: { x: pos.x, y: pos.y + childEstimatedHeight + 54 },
        preset: 'layer_transform_controller',
        aiAgentRole: 'LayerTransformAgent',
        aiDirective: `Điều khiển trực tiếp trục X, Y, Z và góc xoay hướng cho layer "${layerName}".`,
        params: {
          shotId: targetLayer.shotId || currentShotScope,
          targetMode: 'custom',
          targetLayerIds: allGroupIds,
          isAssemblyRoot,
          assemblyKind,
          childLayerCount: allGroupIds.length,
          transformX: Math.round(targetLayer.transform?.position?.value[0] ?? 0),
          transformY: Math.round(targetLayer.transform?.position?.value[1] ?? 0),
          transformZ: Math.round(targetLayer.transform?.position?.value[2] ?? 0),
          transformRotation: Math.round(targetLayer.transform?.rotation?.value[2] ?? 0)
        }
      }

      const newEdges: WorkflowEdge[] = [
        {
          id: `edge-${layerNodeId}-transform_link-${transNodeId}-transform_link`,
          fromNode: layerNodeId,
          fromPort: 'transform_link',
          toNode: transNodeId,
          toPort: 'transform_link'
        }
      ]

      // Tự động nối dây từ Scene Shot Node (nếu có trên canvas) tới Layer Node mới
      const sceneNode = workflow.nodes.find((n) => n.type === 'scene_shot')
      if (sceneNode) {
        newEdges.push({
          id: `edge-${sceneNode.id}-layers_tree-${layerNodeId}-layers_tree`,
          fromNode: sceneNode.id,
          fromPort: 'layers_tree',
          toNode: layerNodeId,
          toPort: 'layers_tree'
        })
      }

      const nextWf: WorkflowGraph = {
        ...workflow,
        nodes: [...workflow.nodes, layerNode, transformNode],
        edges: [...workflow.edges, ...newEdges]
      }

      commitWorkflow(nextWf, undefined, true, new Set([layerNodeId]))
    },
    [workflow, currentShotScope, commitWorkflow]
  )

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}
