import type { EaseName, ImageLayer, Keyframe, Layer, Project, Vec3 } from '@shared/types'
import { nanoid } from 'nanoid'
import {
  generatePresetSpatialTracks,
  MOTION_PRESETS_CATALOG,
  type GeneratedTransformTracks,
  type MotionPresetId,
  type SpatialMotionOptions
} from './motionPresets'
import { createClipFromPreset, type ProceduralMotionPreset } from '../ui/layerAssembly/workshopRigPresets'
import { evaluateRig, transformRigLayer } from '../engine/layerRig'
import { getStoredComposites } from '../ui/layerAssembly/layerAssemblyStorage'

export interface ChoreographyStepSpec {
  name?: string
  time?: number
  duration?: number
  motionPreset?: MotionPresetId
  actionClip?: ProceduralMotionPreset | string
  toPosition?: Vec3
  toScale?: number | Vec3
  toOpacity?: number
  toRotation?: Vec3
  depthZ?: number
  deltaX?: number
  deltaY?: number
  jumpHeight?: number
  fadeOpacity?: boolean
  ease?: EaseName
}

export interface ChoreographySequenceSpec {
  targetLayerId?: string
  compositeInstanceId?: string
  modelInstanceId?: string
  startTime?: number
  steps: ChoreographyStepSpec[]
}

export interface TargetGroupInfo {
  layers: Layer[]
  type: 'single' | 'composite' | 'model3d'
  instanceId?: string
  compositeId?: string
  modelId?: string
  name: string
  centerPosition: Vec3
}

/**
 * Tìm các layer mục tiêu (đơn lẻ hoặc cả cụm 3D/Composite).
 */
export function findMotionTargetGroup(project: Project, targetId: string): TargetGroupInfo | null {
  if (!targetId || !project.layers.length) return null

  // 1. Tìm theo composite instance ID
  const compLayers = project.layers.filter((l) => l.composite?.instanceId === targetId)
  if (compLayers.length > 0) {
    const root = compLayers.find((l) => l.composite?.isRoot) || compLayers[0]
    return {
      layers: compLayers,
      type: 'composite',
      instanceId: targetId,
      compositeId: root.composite?.compositeId,
      name: root.composite?.compositeName || 'Composite Group',
      centerPosition: root.composite?.centerPosition ? [...root.composite.centerPosition] : [...root.transform.position.value]
    }
  }

  // 2. Tìm theo model3d instance ID
  const modelLayers = project.layers.filter((l) => l.model3d?.instanceId === targetId)
  if (modelLayers.length > 0) {
    const first = modelLayers[0]
    return {
      layers: modelLayers,
      type: 'model3d',
      instanceId: targetId,
      modelId: first.model3d?.modelId,
      name: first.model3d?.modelName || '3D Model Group',
      centerPosition: first.model3d?.centerPosition ? [...first.model3d.centerPosition] : [...first.transform.position.value]
    }
  }

  // 3. Tìm theo layer ID
  const single = project.layers.find((l) => l.id === targetId)
  if (!single) return null

  // Nếu layer này thuộc composite hoặc model3d -> tự động nhóm cả cụm
  if (single.composite?.instanceId) {
    return findMotionTargetGroup(project, single.composite.instanceId)
  }
  if (single.model3d?.instanceId) {
    return findMotionTargetGroup(project, single.model3d.instanceId)
  }

  return {
    layers: [single],
    type: 'single',
    name: single.name,
    centerPosition: [...single.transform.position.value]
  }
}

/**
 * Hợp nhất các keyframe mới vào animatable property, ghi đè hoặc chèn mới tại các mốc thời gian.
 */
function mergeKeyframes<T>(existingKeys: Keyframe<T>[], newKeys: Keyframe<T>[]): Keyframe<T>[] {
  const map = new Map<number, Keyframe<T>>()
  for (const k of existingKeys) {
    map.set(Number(k.t.toFixed(4)), k)
  }
  for (const k of newKeys) {
    map.set(Number(k.t.toFixed(4)), k)
  }
  const merged = Array.from(map.values())
  merged.sort((a, b) => a.t - b.t)
  return merged
}

/**
 * Áp dụng một motion preset After Effects lên nhóm layers.
 */
export function applyMotionTracksToGroup(
  group: TargetGroupInfo,
  tracks: GeneratedTransformTracks
): void {
  const isMulti = group.layers.length > 1
  const center0: Vec3 = [...group.centerPosition]

  for (const layer of group.layers) {
    const rootOffset: Vec3 = isMulti
      ? layer.composite?.rootOffset || layer.model3d?.basePosition || [0, 0, 0]
      : [0, 0, 0]

    // 1. Position keyframes
    const layerPosKeys: Keyframe<Vec3>[] = tracks.position.map((k, idx) => {
      const groupPos = k.value
      // Scale ảnh hưởng đến khoảng cách relative offset giữa các layer con
      const scaleRef = tracks.scale[idx]?.value || [1, 1, 1]
      const scaledOffset: Vec3 = [
        rootOffset[0] * scaleRef[0],
        rootOffset[1] * scaleRef[1],
        rootOffset[2] * scaleRef[2]
      ]
      return {
        id: nanoid(8),
        t: k.t,
        value: [groupPos[0] + scaledOffset[0], groupPos[1] + scaledOffset[1], groupPos[2] + scaledOffset[2]],
        ease: k.ease
      }
    })

    layer.transform.position.keyframes = mergeKeyframes(layer.transform.position.keyframes, layerPosKeys)
    if (layer.transform.position.keyframes.length > 0) {
      layer.transform.position.value = layer.transform.position.keyframes[0].value
    }

    // 2. Scale keyframes
    if (tracks.scale.length > 0) {
      const baseScale = isMulti ? [...layer.transform.scale.value] : [1, 1, 1]
      const layerScaleKeys: Keyframe<Vec3>[] = tracks.scale.map((k) => ({
        id: nanoid(8),
        t: k.t,
        value: [baseScale[0] * k.value[0], baseScale[1] * k.value[1], baseScale[2] * k.value[2]],
        ease: k.ease
      }))
      layer.transform.scale.keyframes = mergeKeyframes(layer.transform.scale.keyframes, layerScaleKeys)
      layer.transform.scale.value = layer.transform.scale.keyframes[0].value
    }

    // 3. Rotation keyframes
    if (tracks.rotation.length > 0) {
      layer.transform.rotation.keyframes = mergeKeyframes(layer.transform.rotation.keyframes, tracks.rotation)
      layer.transform.rotation.value = layer.transform.rotation.keyframes[0].value
    }

    // 4. Opacity keyframes
    if (tracks.opacity.length > 0) {
      layer.transform.opacity.keyframes = mergeKeyframes(layer.transform.opacity.keyframes, tracks.opacity)
      layer.transform.opacity.value = layer.transform.opacity.keyframes[0].value
    }
  }

  // Cập nhật lại centerPosition của nhóm
  if (tracks.position.length > 0) {
    const finalPos = tracks.position[tracks.position.length - 1].value
    group.centerPosition = [...finalPos]
  }
}

/**
 * Lên kịch bản chuỗi hành động phối hợp theo thời gian (Choreography Sequence).
 */
export async function choreographSequence(
  project: Project,
  spec: ChoreographySequenceSpec
): Promise<{ ok: boolean; appliedLayers: number; totalSteps: number; message: string }> {
  const targetId = spec.compositeInstanceId || spec.modelInstanceId || spec.targetLayerId
  if (!targetId) {
    throw new Error('Cần cung cấp "target_layer_id", "composite_instance_id" hoặc "model_instance_id"')
  }

  const group = findMotionTargetGroup(project, targetId)
  if (!group || !group.layers.length) {
    throw new Error(`Không tìm thấy layer hoặc cụm đối tượng với ID "${targetId}"`)
  }

  let currentTime = spec.startTime ?? 0
  let currentPos: Vec3 = [...group.centerPosition]
  let currentRot: Vec3 = [...group.layers[0].transform.rotation.value]
  let currentScale: Vec3 = [1, 1, 1]
  let currentOpacity = group.layers[0].transform.opacity.value

  // Nạp composite preset gốc nếu có để lấy khung xương rig
  let sourceCompositeRig: any = null
  if (group.type === 'composite' && group.compositeId) {
    const composites = getStoredComposites()
    const comp = composites.find((c) => c.id === group.compositeId)
    if (comp?.rig) {
      sourceCompositeRig = comp.rig
    }
  }

  let stepIndex = 0
  for (const step of spec.steps) {
    const meta = step.motionPreset ? MOTION_PRESETS_CATALOG.find((p) => p.id === step.motionPreset) : null
    const duration = step.duration ?? meta?.defaultDuration ?? 2.0
    const stepStartTime = step.time !== undefined ? step.time : currentTime

    // 1. Tạo spatial tracks
    const presetId: MotionPresetId = step.motionPreset || 'cross_screen'
    const toPos: Vec3 | undefined = step.toPosition
      ? [...step.toPosition]
      : step.depthZ !== undefined || step.deltaX !== undefined || step.deltaY !== undefined
        ? [
            currentPos[0] + (step.deltaX ?? 0),
            currentPos[1] + (step.deltaY ?? 0),
            currentPos[2] + (step.depthZ ?? 0)
          ]
        : undefined

    const toSc: Vec3 | undefined = typeof step.toScale === 'number'
      ? [step.toScale, step.toScale, step.toScale]
      : step.toScale

    const spatialOptions: SpatialMotionOptions = {
      time: stepStartTime,
      duration,
      fromPosition: currentPos,
      toPosition: toPos,
      fromScale: currentScale,
      toScale: toSc,
      jumpHeight: step.jumpHeight,
      fadeOpacity: step.fadeOpacity,
      toOpacity: step.toOpacity,
      ease: step.ease
    }

    const tracks = generatePresetSpatialTracks(
      presetId,
      { position: currentPos, rotation: currentRot, scale: currentScale, opacity: currentOpacity },
      spatialOptions
    )

    // Áp dụng keyframes cho nhóm
    applyMotionTracksToGroup(group, tracks)

    // Cập nhật trạng thái cho step tiếp theo
    if (tracks.position.length > 0) {
      currentPos = [...tracks.position[tracks.position.length - 1].value]
    }
    if (tracks.scale.length > 0) {
      currentScale = [...tracks.scale[tracks.scale.length - 1].value]
    }
    if (tracks.rotation.length > 0) {
      currentRot = [...tracks.rotation[tracks.rotation.length - 1].value]
    }
    if (tracks.opacity.length > 0) {
      currentOpacity = tracks.opacity[tracks.opacity.length - 1].value
    }
    currentTime = stepStartTime + duration
    stepIndex++
  }

  return {
    ok: true,
    appliedLayers: group.layers.length,
    totalSteps: spec.steps.length,
    message: `Đã gắn kịch bản ${spec.steps.length} hành động cho "${group.name}" (${group.layers.length} layers)`
  }
}

/**
 * Đọc catalog danh sách hành động của nhân vật/cụm composite để AI hiểu rõ kịch bản.
 */
export function getCharacterActionCatalog(project: Project, targetId: string): {
  targetName: string
  targetType: string
  availableRigClips: { id: string; name: string; duration: number; description?: string }[]
  availableMotionPresets: { id: string; name: string; category: string; description: string; recommendedClips: string[] }[]
  suggestedChoreographies: { title: string; scenario: string; steps: any[] }[]
} {
  const group = findMotionTargetGroup(project, targetId)
  const composites = getStoredComposites()
  const comp = group?.compositeId ? composites.find((c) => c.id === group.compositeId) : null

  const rigClips = comp?.rig?.clips || [
    { id: 'walk', name: 'Bước đi (Walk)', duration: 1.6, description: 'Chân bước đi tự nhiên' },
    { id: 'jump', name: 'Nhảy (Jump)', duration: 1.4, description: 'Bật nhảy lên cao' },
    { id: 'fall', name: 'Vấp ngã (Fall)', duration: 1.8, description: 'Vấp ngã sấp xuống sàn' },
    { id: 'idle', name: 'Đứng thở (Idle)', duration: 2.4, description: 'Đứng yên thở nhẹ nhàng' },
    { id: 'wave', name: 'Vẫy tay (Wave)', duration: 1.8, description: 'Vẫy tay chào' }
  ]

  const motionPresets = MOTION_PRESETS_CATALOG.map((m) => ({
    id: m.id,
    name: m.name.vi,
    category: m.category,
    description: m.description.vi,
    recommendedClips: m.recommendedClips
  }))

  const suggestedChoreographies = [
    {
      title: 'Đi vào rừng sâu rồi biến mất',
      scenario: 'Nhân vật đi bộ sâu vào phối cảnh 3D, thu nhỏ dần theo chiều sâu và mờ dần biến mất vào tán cây sương mù.',
      steps: [
        { motionPreset: 'walk_into_depth', actionClip: 'walk', duration: 3.5, depthZ: 2500, fadeOpacity: true }
      ]
    },
    {
      title: 'Đi bộ, nhảy qua chướng ngại vật rồi vấp ngã',
      scenario: 'Nhân vật đi bộ 2.5s, bật nhảy 1.4s qua tảng đá, tiếp đất rồi vấp phải rễ cây ngã nhào xuống đất.',
      steps: [
        { motionPreset: 'cross_screen', actionClip: 'walk', duration: 2.5, deltaX: 200 },
        { motionPreset: 'jump_arc', actionClip: 'jump', duration: 1.4, deltaX: 260, jumpHeight: 180 },
        { motionPreset: 'trip_and_fall', actionClip: 'fall', duration: 1.8, deltaX: 60 }
      ]
    },
    {
      title: 'Từ trong rừng bước ra, vẫy tay chào khán giả',
      scenario: 'Nhân vật bước ra từ sâu trong hậu cảnh, hiện rõ dần, dừng lại và vẫy tay chào thân thiện.',
      steps: [
        { motionPreset: 'emerge_from_depth', actionClip: 'walk', duration: 3.0 },
        { motionPreset: 'floating_hover', actionClip: 'wave', duration: 2.0, deltaY: 10 }
      ]
    }
  ]

  return {
    targetName: group?.name || targetId,
    targetType: group?.type || 'unknown',
    availableRigClips: rigClips.map((c) => ({
      id: c.id,
      name: c.name,
      duration: c.duration,
      description: c.description
    })),
    availableMotionPresets: motionPresets,
    suggestedChoreographies
  }
}
