import { useState, useRef, useEffect } from 'react'
import type { BonePose } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { type Bbox2DHandle, calculateAnchorPinnedResize } from './layerAssembly2DBbox'
import { expandLinkedSelection, getBonesForLayers } from './workshopParts'
import { applyRigAction, ensureRigClips } from './workshopRig'
import { buildZeroAnchorOps, markBoneAdjusted } from './workshopStepRecord'

export interface UseLayerAssembly2DDragProps {
  zoom: number
  pan: { x: number; y: number }
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  isPanning: boolean
  setIsPanning: React.Dispatch<React.SetStateAction<boolean>>
  composite: LayerComposite
  selectedIds?: string[]
  selectedLayerId: string | null
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onChangeComposite?: (update: LayerComposite | ((prev: LayerComposite) => LayerComposite)) => void
  brushActiveTool: string
  tab?: string
  time?: number
}

export function useLayerAssembly2DDrag({
  zoom,
  pan,
  setPan,
  isPanning,
  setIsPanning,
  composite,
  selectedIds,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onChangeComposite,
  brushActiveTool,
  tab,
  time = 0
}: UseLayerAssembly2DDragProps) {
  const [isDraggingLayer, setIsDraggingLayer] = useState(false)
  const [isDraggingHandle, setIsDraggingHandle] = useState(false)

  const handleDragRef = useRef<{
    handle: Bbox2DHandle
    layerId: string
    startX: number
    startY: number
    startScale: number
    startMouseX: number
    startMouseY: number
    baseWidth: number
    baseHeight: number
    initBoneGeometry: Map<string, { x: number; y: number; length: number }>
    animBoneId?: string
    animBoneName?: string
    initBonePose?: BonePose
    dragTime: number
  } | null>(null)

  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    initPositions: Map<string, { x: number; y: number }>
    initBonePositions: Map<string, { x: number; y: number }>
    initPanX: number
    initPanY: number
    animBonePoses: Map<string, { pose: BonePose; parentRot: number; parentScaleX: number; parentScaleY: number; name: string }>
    dragTime: number
  }>({
    mouseX: 0,
    mouseY: 0,
    initPositions: new Map(),
    initBonePositions: new Map(),
    initPanX: 0,
    initPanY: 0,
    animBonePoses: new Map(),
    dragTime: 0
  })

  // Phím Escape: huỷ thao tác kéo
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (!isDraggingLayer && !isPanning && !isDraggingHandle)) return
      if (handleDragRef.current) {
        const d = handleDragRef.current
        if (d.animBoneId && d.initBonePose && onChangeComposite) {
          onChangeComposite((prev) =>
            applyRigAction(prev, {
              action: 'set-key',
              boneId: d.animBoneId!,
              key: {
                time: d.dragTime,
                x: d.initBonePose!.x,
                y: d.initBonePose!.y,
                rotation: d.initBonePose!.rotation,
                scaleX: d.initBonePose!.scaleX ?? 1,
                scaleY: d.initBonePose!.scaleY ?? 1
              }
            })
          )
        } else if (d.initBoneGeometry.size > 0 && onChangeComposite) {
          onChangeComposite((prev) => ({
            ...prev,
            layers: prev.layers.map((l) =>
              l.id === d.layerId ? { ...l, x: d.startX, y: d.startY, scale: d.startScale } : l
            ),
            rig: prev.rig
              ? {
                  ...prev.rig,
                  bones: prev.rig.bones.map((b) => {
                    const init = d.initBoneGeometry.get(b.id)
                    return init ? { ...b, x: init.x, y: init.y, length: init.length } : b
                  })
                }
              : prev.rig
          }))
        } else {
          onUpdateLayer(d.layerId, { x: d.startX, y: d.startY, scale: d.startScale })
        }
        handleDragRef.current = null
        setIsDraggingHandle(false)
      }
      if (isDraggingLayer) {
        if (dragStartRef.current.animBonePoses.size > 0 && onChangeComposite) {
          const initPoses = dragStartRef.current.animBonePoses
          const t = dragStartRef.current.dragTime
          onChangeComposite((prev) => {
            let next = prev
            initPoses.forEach(({ pose }, bid) => {
              next = applyRigAction(next, {
                action: 'set-key',
                boneId: bid,
                key: {
                  time: t,
                  x: pose.x,
                  y: pose.y,
                  rotation: pose.rotation,
                  scaleX: pose.scaleX ?? 1,
                  scaleY: pose.scaleY ?? 1
                }
              })
            })
            return next
          })
        } else {
          dragStartRef.current.initPositions.forEach((position, id) => onUpdateLayer(id, position))
          if (dragStartRef.current.initBonePositions.size > 0 && onChangeComposite) {
            const initBones = dragStartRef.current.initBonePositions
            onChangeComposite((prev) => {
              if (!prev.rig) return prev
              const nextBones = prev.rig.bones.map((b) => {
                const init = initBones.get(b.id)
                if (!init) return b
                return { ...b, x: init.x, y: init.y }
              })
              return { ...prev, rig: { ...prev.rig, bones: nextBones } }
            })
          }
        }
      }
      if (isPanning) setPan({ x: dragStartRef.current.initPanX, y: dragStartRef.current.initPanY })
      setIsDraggingLayer(false)
      setIsPanning(false)
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [isDraggingLayer, isPanning, isDraggingHandle, onUpdateLayer, onChangeComposite, setPan])

  const handleStartDragHandle = (
    e: React.PointerEvent,
    handle: Bbox2DHandle,
    layer: AssembledLayerItem,
    baseW: number,
    baseH: number
  ) => {
    e.stopPropagation()
    if (layer.locked) return
    setIsDraggingHandle(true)

    const initBoneGeometry = new Map<string, { x: number; y: number; length: number }>()
    let animBoneId: string | undefined
    let animBoneName: string | undefined
    let initBonePose: BonePose | undefined

    if (composite.rig && composite.rig.bones.length > 0) {
      const boundIds = getBonesForLayers(composite, [layer.id])
      for (const b of composite.rig.bones) {
        if (boundIds.includes(b.id)) {
          initBoneGeometry.set(b.id, { x: b.x, y: b.y, length: b.length })
        }
      }
      if (tab === 'animation' && layer.boneId && onChangeComposite) {
        const normRig = ensureRigClips(composite.rig).rig
        const targetBone = normRig.bones.find((b) => b.id === layer.boneId)
        if (targetBone) {
          animBoneId = targetBone.id
          animBoneName = targetBone.name
          initBonePose = sampleBonePose({ ...normRig, loop: false }, targetBone.id, time)
        }
      }
    }

    handleDragRef.current = {
      handle,
      layerId: layer.id,
      startX: layer.x,
      startY: layer.y,
      startScale: layer.scale,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      baseWidth: baseW,
      baseHeight: baseH,
      initBoneGeometry,
      animBoneId,
      animBoneName,
      initBonePose,
      dragTime: time
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleStartDragLayer = (e: React.PointerEvent, layer: AssembledLayerItem) => {
    e.stopPropagation()

    // Nếu đang ở công cụ Cọ Tẩy (Eraser):
    if (brushActiveTool === 'eraser') {
      if (layer.id !== selectedLayerId) {
        onSelectLayer(layer.id, false)
        return
      }
      return
    }

    const isAdditive = e.ctrlKey || e.metaKey || e.shiftKey
    if (isAdditive) {
      onSelectLayer(layer.id, true)
      return
    } else if (!selectedIds?.includes(layer.id)) {
      onSelectLayer(layer.id, false)
    }
    if (layer.locked) return

    setIsDraggingLayer(true)
    const activeSelection = expandLinkedSelection(
      composite,
      selectedIds && selectedIds.includes(layer.id) ? selectedIds : [layer.id]
    )
    const initPositions = new Map<string, { x: number; y: number }>()
    composite.layers.forEach((l) => {
      if (activeSelection.includes(l.id) && !l.locked) {
        initPositions.set(l.id, { x: l.x, y: l.y })
      }
    })
    const initBonePositions = new Map<string, { x: number; y: number }>()
    const animBonePoses = new Map<
      string,
      { pose: BonePose; parentRot: number; parentScaleX: number; parentScaleY: number; name: string }
    >()

    if (composite.rig && composite.rig.bones.length > 0) {
      const isAllSelected =
        activeSelection.length === composite.layers.length || composite.layers.length === 1
      const bonesToMove = isAllSelected
        ? composite.rig.bones.map((b) => b.id)
        : getBonesForLayers(composite, activeSelection)

      if (bonesToMove.length > 0) {
        composite.rig.bones.forEach((b) => {
          if (bonesToMove.includes(b.id)) {
            initBonePositions.set(b.id, { x: b.x, y: b.y })
          }
        })
      }

      if (tab === 'animation' && onChangeComposite) {
        const normRig = ensureRigClips(composite.rig).rig
        const tfs = evaluateRig({ ...normRig, loop: false }, time)
        for (const lid of activeSelection) {
          const l = composite.layers.find((item) => item.id === lid)
          if (!l?.boneId) continue
          const b = normRig.bones.find((item) => item.id === l.boneId)
          if (!b || animBonePoses.has(b.id)) continue
          const parentTf = b.parentId ? tfs.get(b.parentId) : undefined
          animBonePoses.set(b.id, {
            pose: sampleBonePose({ ...normRig, loop: false }, b.id, time),
            parentRot: parentTf?.rotation ?? 0,
            parentScaleX: parentTf?.scaleX ?? 1,
            parentScaleY: parentTf?.scaleY ?? 1,
            name: b.name
          })
        }
      }
    }
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initPositions,
      initBonePositions,
      initPanX: pan.x,
      initPanY: pan.y,
      animBonePoses,
      dragTime: time
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragPointerMove = (e: React.PointerEvent): boolean => {
    if (handleDragRef.current) {
      const d = handleDragRef.current
      const dx = (e.clientX - d.startMouseX) / zoom
      const dy = (e.clientY - d.startMouseY) / zoom
      const res = calculateAnchorPinnedResize({
        handle: d.handle,
        dx,
        dy,
        startX: d.startX,
        startY: d.startY,
        startScale: d.startScale,
        baseWidth: d.baseWidth,
        baseHeight: d.baseHeight
      })
      const scaleRatio = res.scale / Math.max(0.05, d.startScale)

      // 1. Chế độ Hoạt ảnh (tab === 'animation'): Ghi keyframe scaleX, scaleY vào xương gắn với bộ phận để phát động tác to/nhỏ dần mượt mà!
      if (d.animBoneId && d.initBonePose && onChangeComposite) {
        const nextScaleX = Number(Math.max(0.1, Math.min(5, (d.initBonePose.scaleX ?? 1) * scaleRatio)).toFixed(3))
        const nextScaleY = Number(Math.max(0.1, Math.min(5, (d.initBonePose.scaleY ?? 1) * scaleRatio)).toFixed(3))
        onChangeComposite((prev) => {
          const rig = prev.rig ? ensureRigClips(prev.rig).rig : undefined
          if (!rig) return prev
          const zeroOps = buildZeroAnchorOps(rig, [d.animBoneId!], d.dragTime)
          const keyOp = {
            action: 'set-key' as const,
            boneId: d.animBoneId!,
            key: {
              time: d.dragTime,
              scaleX: nextScaleX,
              scaleY: nextScaleY
            }
          }
          return applyRigAction(
            prev,
            zeroOps.length ? { action: 'batch', operations: [...zeroOps, keyOp] } : keyOp
          )
        })
        markBoneAdjusted(d.animBoneName, d.dragTime)
        return true
      }

      // 2. Chế độ Lắp ráp / Tạo xương: Phóng to / thu nhỏ đồng thời cả mảnh Layer LẪN chuỗi xương đã gắn vào bộ phận đó!
      if (d.initBoneGeometry.size > 0 && onChangeComposite) {
        onChangeComposite((prev) => ({
          ...prev,
          layers: prev.layers.map((l) =>
            l.id === d.layerId ? { ...l, x: res.x, y: res.y, scale: res.scale } : l
          ),
          rig: prev.rig
            ? {
                ...prev.rig,
                bones: prev.rig.bones.map((b) => {
                  const init = d.initBoneGeometry.get(b.id)
                  if (!init) return b
                  return {
                    ...b,
                    x: Number((res.x + (init.x - d.startX) * scaleRatio).toFixed(2)),
                    y: Number((res.y + (init.y - d.startY) * scaleRatio).toFixed(2)),
                    length: Math.max(8, Number((init.length * scaleRatio).toFixed(2)))
                  }
                })
              }
            : prev.rig
        }))
        return true
      }

      onUpdateLayer(d.layerId, {
        x: res.x,
        y: res.y,
        scale: res.scale
      })
      return true
    }

    if (!isDraggingLayer) return false
    const dx = (e.clientX - dragStartRef.current.mouseX) / zoom
    const dy = (e.clientY - dragStartRef.current.mouseY) / zoom
    const roundDx = Math.round(dx)
    const roundDy = Math.round(dy)

    // Chế độ Hoạt ảnh: Kéo bộ phận có gắn xương trên sân khấu 2D sẽ ghi keyframe dịch chuyển (x, y) cho xương tại thời điểm hiện tại
    if (dragStartRef.current.animBonePoses.size > 0 && onChangeComposite) {
      const animPoses = dragStartRef.current.animBonePoses
      const t = dragStartRef.current.dragTime
      onChangeComposite((prev) => {
        const rig = prev.rig ? ensureRigClips(prev.rig).rig : undefined
        if (!rig) return prev
        const boneIds = [...animPoses.keys()]
        const zeroOps = buildZeroAnchorOps(rig, boneIds, t)
        const keyOps = boneIds.map((bid) => {
          const info = animPoses.get(bid)!
          const local = rotatePoint(roundDx, roundDy, -info.parentRot)
          const lx = Math.abs(info.parentScaleX) > 1e-6 ? local.x / info.parentScaleX : local.x
          const ly = Math.abs(info.parentScaleY) > 1e-6 ? local.y / info.parentScaleY : local.y
          return {
            action: 'set-key' as const,
            boneId: bid,
            key: {
              time: t,
              x: Number((info.pose.x + lx).toFixed(2)),
              y: Number((info.pose.y + ly).toFixed(2))
            }
          }
        })
        return applyRigAction(prev, {
          action: 'batch',
          operations: [...zeroOps, ...keyOps]
        })
      })
      const firstInfo = animPoses.values().next().value
      if (firstInfo) markBoneAdjusted(firstInfo.name, t)
      return true
    }

    dragStartRef.current.initPositions.forEach((pos, id) => {
      onUpdateLayer(id, {
        x: pos.x + roundDx,
        y: pos.y + roundDy
      })
    })
    if (dragStartRef.current.initBonePositions.size > 0 && onChangeComposite) {
      const initBones = dragStartRef.current.initBonePositions
      onChangeComposite((prev) => {
        if (!prev.rig || !prev.rig.bones) return prev
        const nextBones = prev.rig.bones.map((b) => {
          const init = initBones.get(b.id)
          if (!init) return b
          return { ...b, x: init.x + roundDx, y: init.y + roundDy }
        })
        return { ...prev, rig: { ...prev.rig, bones: nextBones } }
      })
    }
    return true
  }

  const handleDragPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (handleDragRef.current) {
      handleDragRef.current = null
      setIsDraggingHandle(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (isDraggingLayer) {
      setIsDraggingLayer(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  return {
    isDraggingLayer,
    isDraggingHandle,
    handleStartDragHandle,
    handleStartDragLayer,
    handleDragPointerMove,
    handleDragPointerUp
  }
}
