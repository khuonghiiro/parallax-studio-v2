import type { ImageProps, Layer, Project, WorkflowNode, WorkflowNodeParams } from '@shared/types'
import {
  LOOP_COMBO_FX_OPTIONS,
  LOOP_COMBO_PREFIX,
  clearLoopLifecycle,
  loopComboFxId,
  normalizeLoopComboFx,
  readLoopComboFx
} from './workflowV2LoopCombo'
import { deleteLayerEffect, toggleLayerEffect } from '../ui/timeline/timelineEffects'
import { applyAnimFxPresetToLayer } from './workflowV2AnimFxApply'
import { WORKFLOW_V2_ANIM_FX_OPTIONS } from './workflowV2Options'
import { LOOP_MAX_PLAY_COUNT } from './loopLifecycle'

/**
 * Node Animation chế độ `🔁 Loop & Nhịp` (`animMode: 'loop_sprite'`):
 * - Chu kỳ / tốc độ / Nhịp & Nháy (như trước).
 * - Vòng đời: số lần chạy (`once`), hiện dần lúc xuất hiện, hành vi khi kết thúc (giữ / ẩn / mờ dần).
 *   Mốc bắt đầu & kết thúc lấy từ thời gian Node (đã tính Node Time chung) nên nối Node Time là cả nhóm ăn theo.
 * - Kết hợp hiệu ứng Keyframe / Neon FX chạy song song (mỗi nhóm thuộc tính tối đa 1 hiệu ứng).
 */

const clampNum = (v: number | undefined, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined

function writeLoopLifecycle(props: ImageProps, params: WorkflowNodeParams): void {
  const playCount = clampNum(params.loopPlayCount, 1, LOOP_MAX_PLAY_COUNT)
  if (playCount !== undefined) props.loopPlayCount = Math.round(playCount)
  if (params.loopEndAction) props.loopEndAction = params.loopEndAction
  const fadeIn = clampNum(params.loopFadeInSec, 0, 10)
  if (fadeIn !== undefined) props.loopFadeInSec = fadeIn
  const fadeOut = clampNum(params.loopFadeOutSec, 0, 10)
  if (fadeOut !== undefined) props.loopFadeOutSec = fadeOut
  // Thời gian Node (đã gồm Node Time chung) là mốc vòng đời Loop
  if (typeof params.timeStart === 'number' && Number.isFinite(params.timeStart)) props.loopStartTime = Math.max(0, params.timeStart)
  if (typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd)) props.loopEndTime = Math.max(0, params.timeEnd)
}

function writeLoopRhythm(props: ImageProps, params: WorkflowNodeParams, presetId: string): void {
  if (params.loopSpeed !== undefined) props.speed = params.loopSpeed
  if (params.loopMode !== undefined) props.loopMode = params.loopMode
  if (params.loopTimeOffset !== undefined) props.timeOffset = params.loopTimeOffset
  if (params.loopAutoPlayPaused !== undefined) props.autoPlayPaused = params.loopAutoPlayPaused
  props.loopRhythmMode = params.loopRhythmMode ?? (presetId === 'loop_flicker' ? 'flicker_opacity' : 'sync_both')
  props.loopRhythmRateHz = params.loopRhythmRateHz ?? params.animFxSpeed ?? 2.5
  props.loopRhythmIntensity = params.loopRhythmIntensity ?? params.intensity ?? 0.45
  props.loopMinOpacity = params.loopMinOpacity ?? params.animFxMinIntensity ?? 0.55
  props.loopScaleBeatPct = params.loopScaleBeatPct ?? 12
}

/** Dựng lại các hiệu ứng kết hợp theo khoảng thời gian Loop hiện tại (id cố định nên idempotent) */
function syncLoopComboFx(project: Project, node: WorkflowNode, l: Layer, params: WorkflowNodeParams): void {
  clearLoopComboFx(l, node.id)
  const wanted = normalizeLoopComboFx(params.loopComboFx)
  if (!wanted.length) return
  const start = Math.max(0, params.timeStart ?? l.inPoint ?? 0)
  const end = Math.max(start + 0.1, params.timeEnd ?? l.outPoint ?? project.comp.duration)
  const tol = 1 / Math.max(1, (project.comp.fps || 30) * 2)
  for (const id of wanted) {
    const opt = WORKFLOW_V2_ANIM_FX_OPTIONS.find((o) => o.id === id)
    const combo = LOOP_COMBO_FX_OPTIONS.find((o) => o.id === id)
    if (!opt || !combo) continue
    const duration = combo.placement === 'enter' ? Math.min(end - start, opt.defaultDuration) : end - start
    const count = opt.defaultCount ?? 2
    applyAnimFxPresetToLayer(l, opt, {
      fxId: loopComboFxId(node.id, id),
      start,
      duration: Math.max(0.1, Number(duration.toFixed(2))),
      count: combo.placement === 'sustain' ? Math.max(count, Math.round((end - start) / Math.max(0.2, opt.defaultDuration)) * count) : count,
      intensity: opt.defaultIntensity,
      color: opt.defaultColor ?? '#3dd6f5',
      side: 'outer',
      thickness: 10,
      speed: Math.max(0.5, count / Math.max(0.1, opt.defaultDuration)),
      minIntensity: 0.15,
      tol
    })
  }
}

/** Đồng bộ Node Loop xuống các Layer ảnh đích (props loop + vòng đời + hiệu ứng kết hợp) */
export function syncLoopSpriteNodeToLayers(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const presetId = params.animFxPreset ?? 'loop_rhythm'
  const comboTouched = !patch || 'loopComboFx' in patch || 'timeStart' in patch || 'timeEnd' in patch || 'enabled' in patch
  for (const l of project.layers) {
    if (!targetIds.has(l.id) || l.type !== 'image') continue
    if (!node.enabled) {
      l.props.loopRhythmMode = 'none'
      clearLoopLifecycle(l.props)
      for (const fx of l.appliedEffects ?? []) {
        if (fx.id.startsWith(`${LOOP_COMBO_PREFIX}${node.id}-`) && fx.enabled) toggleLayerEffect(l, fx.id, false)
      }
      continue
    }
    writeLoopRhythm(l.props, params, presetId)
    writeLoopLifecycle(l.props, params)
    if (comboTouched || readLoopComboFx(l).join() !== normalizeLoopComboFx(params.loopComboFx).join()) {
      syncLoopComboFx(project, node, l, params)
    }
  }
}

/** Gỡ toàn bộ hiệu ứng kết hợp của một Node Loop khỏi Layer */
export function clearLoopComboFx(l: Layer, nodeId: string): void {
  const prefix = `${LOOP_COMBO_PREFIX}${nodeId}-`
  for (const fx of [...(l.appliedEffects ?? [])]) {
    if (fx.id.startsWith(prefix)) deleteLayerEffect(l, fx.id)
  }
}

/**
 * Đồng bộ thuần tuý Node Animation Loop (`logicCategory: 'loop_anim'`) xuống Layer ảnh Loop / GIF:
 * Điều khiển chu kỳ phát frame lặp (kiểu lặp, tốc độ, số lần lặp, giữ cuối / ẩn ngay, lệch pha)
 * và cấu hình chuỗi Nhóm hiệu ứng (thời gian chờ `loopDelaySec`, kích hoạt tại frame `loopTriggerFrameIndex`,
 * thời lượng giữ `loopHoldDurationSec`, vị trí lệch `loopGroupOffsetX` / `loopGroupOffsetY` / `loopGroupScale`).
 */
export function syncPureLoopAnimNodeToLayers(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  for (const l of project.layers) {
    if (!targetIds.has(l.id) || l.type !== 'image') continue
    if (!node.enabled) {
      l.props.speed = 0
      continue
    }
    if (params.loopSpeed !== undefined) l.props.speed = Math.max(0.05, params.loopSpeed)
    else if (l.props.speed === 0) l.props.speed = 1
    if (params.loopMode !== undefined) l.props.loopMode = params.loopMode
    if (params.loopTimeOffset !== undefined) l.props.timeOffset = params.loopTimeOffset
    if (params.loopAutoPlayPaused !== undefined) l.props.autoPlayPaused = params.loopAutoPlayPaused
    const playCount = clampNum(params.loopPlayCount, 1, LOOP_MAX_PLAY_COUNT)
    if (playCount !== undefined) l.props.loopPlayCount = Math.round(playCount)
    if (params.loopEndAction === 'hold' || params.loopEndAction === 'hide') {
      l.props.loopEndAction = params.loopEndAction
    }
    if (typeof params.timeStart === 'number' && Number.isFinite(params.timeStart)) {
      l.props.loopStartTime = Math.max(0, params.timeStart)
    }
    if (typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd)) {
      l.props.loopEndTime = Math.max(0, params.timeEnd)
    }
    if (params.loopTintColor !== undefined || params.loopBrightness !== undefined || params.loopHueRotate !== undefined) {
      l.props.loopColor = {
        ...l.props.loopColor,
        ...(params.loopTintColor !== undefined ? { tintColor: params.loopTintColor, tintIntensity: params.loopTintColor ? 0.75 : 0 } : {}),
        ...(params.loopBrightness !== undefined ? { brightness: params.loopBrightness } : {}),
        ...(params.loopHueRotate !== undefined ? { hueRotate: params.loopHueRotate } : {})
      }
      l.props.loopOverrides = {
        ...l.props.loopOverrides,
        color: l.props.loopColor
      }
    }

    // Đồng bộ cấu hình Nhóm hiệu ứng (Group Sequence Timing, Frame Trigger, Hold Duration & Spatial Offset)
    const hasGroupTimingOrOffset =
      params.loopGroupId !== undefined ||
      params.loopGroupIndex !== undefined ||
      params.loopGroupName !== undefined ||
      params.loopTotalGroups !== undefined ||
      params.loopTriggerMode !== undefined ||
      params.loopTriggerFrameIndex !== undefined ||
      params.loopDelaySec !== undefined ||
      params.loopHoldDurationSec !== undefined ||
      params.loopGroupOffsetX !== undefined ||
      params.loopGroupOffsetY !== undefined ||
      params.loopGroupScale !== undefined

    if (hasGroupTimingOrOffset) {
      const prevOvr = l.props.loopOverrides || {}
      const prevOffX = prevOvr.offsetX ?? 0
      const prevOffY = prevOvr.offsetY ?? 0
      const nextOffX = params.loopGroupOffsetX ?? prevOffX
      const nextOffY = params.loopGroupOffsetY ?? prevOffY
      const dx = nextOffX - prevOffX
      const dy = nextOffY - prevOffY
      if (dx !== 0 || dy !== 0) {
        const curPos = l.transform.position.value
        l.transform.position.value = [curPos[0] + dx, curPos[1] - dy, curPos[2]]
      }
      if (
        params.loopGroupScale !== undefined &&
        Math.abs(params.loopGroupScale - (prevOvr.scale ?? 1)) > 0.005
      ) {
        const s = Math.max(0.1, Math.min(5, params.loopGroupScale))
        l.transform.scale.value = [s, s, 1]
      }

      l.props.loopOverrides = {
        ...prevOvr,
        ...(params.loopGroupId !== undefined ? { groupId: params.loopGroupId } : {}),
        ...(params.loopGroupIndex !== undefined ? { groupIndex: params.loopGroupIndex } : {}),
        ...(params.loopGroupName !== undefined ? { groupName: params.loopGroupName } : {}),
        ...(params.loopTotalGroups !== undefined ? { totalGroups: params.loopTotalGroups } : {}),
        ...(params.loopTriggerMode !== undefined ? { triggerMode: params.loopTriggerMode } : {}),
        ...(params.loopTriggerFrameIndex !== undefined
          ? { triggerFrameIndex: Math.max(1, Math.round(params.loopTriggerFrameIndex)) }
          : {}),
        ...(params.loopDelaySec !== undefined ? { delaySec: Math.max(0, params.loopDelaySec) } : {}),
        ...(params.loopHoldDurationSec !== undefined
          ? { holdDurationSec: Math.max(0, params.loopHoldDurationSec) }
          : {}),
        offsetX: nextOffX,
        offsetY: nextOffY,
        ...(params.loopGroupScale !== undefined ? { scale: params.loopGroupScale } : {})
      }

      const ovr = l.props.loopOverrides
      const timingTouched =
        params.loopTriggerMode !== undefined ||
        params.loopTriggerFrameIndex !== undefined ||
        params.loopDelaySec !== undefined ||
        params.loopHoldDurationSec !== undefined

      if (timingTouched) {
        const gIdx = ovr.groupIndex ?? 0
        const prevLayer =
          ovr.comboLinkId && gIdx > 0
            ? project.layers.find(
                (other) =>
                  other.type === 'image' &&
                  other.props.loopOverrides?.comboLinkId === ovr.comboLinkId &&
                  other.props.loopOverrides?.groupIndex === gIdx - 1
              )
            : undefined

        const delay = Math.max(0, ovr.delaySec ?? 0)
        let nextIn = l.inPoint ?? 0
        if (prevLayer) {
          if (ovr.triggerMode === 'parallel') {
            nextIn = (prevLayer.inPoint ?? 0) + delay
          } else if (ovr.triggerMode === 'on_frame') {
            const prevAsset =
              prevLayer.type === 'image'
                ? project.assets.find((a) => a.id === prevLayer.props.assetId)
                : undefined
            const prevFrameCount = Math.max(1, prevAsset?.frameCount ?? 8)
            const prevSpeed = prevLayer.type === 'image' ? Math.max(0.1, prevLayer.props.speed || 1) : 1
            const prevCycleDur = Math.max(
              0.1,
              (prevAsset?.duration ?? Math.max(0.2, (prevLayer.outPoint ?? 1) - (prevLayer.inPoint ?? 0))) /
                prevSpeed
            )
            const frameDur = prevCycleDur / prevFrameCount
            const fIdx = Math.max(0, Math.min(prevFrameCount - 1, (ovr.triggerFrameIndex ?? 1) - 1))
            nextIn = (prevLayer.inPoint ?? 0) + fIdx * frameDur + delay
          } else {
            nextIn = (prevLayer.outPoint ?? 0.5) + delay
          }
        } else if (params.loopDelaySec !== undefined) {
          nextIn = delay
        }

        const prevDur = Math.max(0.2, (l.outPoint ?? project.comp.duration) - (l.inPoint ?? 0))
        const hold = ovr.holdDurationSec ?? 0
        const nextOut = hold > 0 ? nextIn + hold : nextIn + prevDur

        l.inPoint = Number(nextIn.toFixed(2))
        l.outPoint = Number(Math.max(l.inPoint + 0.1, nextOut).toFixed(2))
        l.props.loopStartTime = l.inPoint
        l.props.loopEndTime = l.outPoint
        params.timeStart = l.inPoint
        params.timeEnd = l.outPoint
      }
    }
  }
}

/**
 * Đồng bộ phần Hiện/Ẩn mờ dần (Fade In / Fade Out / Ẩn khi hết giờ) và Nhịp đập liên tục (Rhythm Beat)
 * của Node Hiệu ứng (`logicCategory: 'fx'`) xuống các Layer đích.
 */
export function syncFxAppearAndRhythmToLayers(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): void {
  const targetIds = new Set(params.targetLayerIds ?? [])
  const fadeTouched =
    !patch ||
    'loopFadeInSec' in patch ||
    'loopFadeOutSec' in patch ||
    'loopEndAction' in patch ||
    'timeStart' in patch ||
    'timeEnd' in patch ||
    'enabled' in patch
  const rhythmTouched =
    !patch ||
    'loopRhythmMode' in patch ||
    'loopRhythmRateHz' in patch ||
    'loopRhythmIntensity' in patch ||
    'loopMinOpacity' in patch ||
    'loopScaleBeatPct' in patch ||
    'enabled' in patch

  for (const l of project.layers) {
    if (!targetIds.has(l.id)) continue
    if (!node.enabled) {
      l.fadeIn = 0
      l.fadeOut = 0
      if (l.type === 'image') {
        l.props.loopFadeInSec = 0
        l.props.loopFadeOutSec = 0
        l.props.loopRhythmMode = 'none'
      }
      continue
    }
    if (fadeTouched) {
      const fadeIn = clampNum(params.loopFadeInSec, 0, 10)
      const fadeOut = clampNum(params.loopFadeOutSec, 0, 10)
      if (fadeIn !== undefined) {
        l.fadeIn = fadeIn
        if (l.type === 'image') l.props.loopFadeInSec = fadeIn
      }
      if (fadeOut !== undefined) {
        l.fadeOut = fadeOut
        if (l.type === 'image') l.props.loopFadeOutSec = fadeOut
      }
      if (l.type === 'image') {
        if (params.loopEndAction) l.props.loopEndAction = params.loopEndAction
        if (typeof params.timeStart === 'number' && Number.isFinite(params.timeStart)) {
          l.props.loopStartTime = Math.max(0, params.timeStart)
        }
        if (typeof params.timeEnd === 'number' && Number.isFinite(params.timeEnd)) {
          l.props.loopEndTime = Math.max(0, params.timeEnd)
        }
      }
    }
    if (rhythmTouched && l.type === 'image') {
      if (params.loopRhythmMode !== undefined) l.props.loopRhythmMode = params.loopRhythmMode
      if (params.loopRhythmRateHz !== undefined) l.props.loopRhythmRateHz = params.loopRhythmRateHz
      if (params.loopRhythmIntensity !== undefined) l.props.loopRhythmIntensity = params.loopRhythmIntensity
      if (params.loopMinOpacity !== undefined) l.props.loopMinOpacity = params.loopMinOpacity
      if (params.loopScaleBeatPct !== undefined) l.props.loopScaleBeatPct = params.loopScaleBeatPct
    }
  }
}

export {
  clearLoopLifecycle,
  deriveLoopLifecycleParams,
  isLoopComboFxId,
  LOOP_COMBO_FX_OPTIONS,
  normalizeLoopComboFx,
  readLoopComboFx,
  toggleLoopComboFx
} from './workflowV2LoopCombo'
