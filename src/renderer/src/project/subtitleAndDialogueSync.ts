import type {
  AudioTrackItem,
  Layer,
  Project,
  SubtitleDefaultsConfig,
  SubtitleEnterEffect,
  SubtitleExitEffect,
  SubtitlePositionPreset,
  SubtitleProtectField,
  SubtitleStylePresetId,
  TextLayer,
  Vec3,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { nanoid } from 'nanoid'
import { evaluate } from '../animation/keyframes'
import { autoScaleFactor } from '../animation/math'
import { wrapStorySubtitle } from '../animation/storyComicDirector'
import { getProjectAudioTracks } from './audioTracks'
import * as factory from './factory'

export interface SubtitlePresetOption {
  id: SubtitleStylePresetId
  label: string
  shortLabel: string
  badge: string
  preserveByDefault?: boolean
  config: Omit<SubtitleDefaultsConfig, 'presetId' | 'syncHoldTargetLayer'>
}

export const SUBTITLE_STYLE_PRESETS: SubtitlePresetOption[] = [
  {
    id: 'lugia_cyan',
    label: 'Trắng Viền Xanh Ngọc (Hoạt Ảnh 2.5D)',
    shortLabel: '💎 Trắng Viền Xanh',
    badge: '💎',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 36,
      fontWeight: 900,
      color: '#ffffff',
      strokeColor: '#0a3d6e',
      strokeWidth: 6,
      glowColor: '#38bdf8',
      boxColor: '',
      boxOpacity: 0,
      boxBorderColor: '',
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -390,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.14,
      fadeOutDuration: 0.14
    }
  },
  {
    id: 'cinema_gold',
    label: 'Vàng Kim Điện Ảnh (Viền Đen Đậm)',
    shortLabel: '🌟 Vàng Điện Ảnh',
    badge: '🌟',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 38,
      fontWeight: 900,
      color: '#fde047',
      strokeColor: '#1c1917',
      strokeWidth: 7,
      glowColor: '#f59e0b',
      boxColor: '',
      boxOpacity: 0,
      boxBorderColor: '',
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -390,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.15,
      fadeOutDuration: 0.15
    }
  },
  {
    id: 'netflix_box',
    label: 'Hộp Nền Đen Mờ (Chuẩn Phim Phụ Đề)',
    shortLabel: '🎬 Hộp Đen Mờ',
    badge: '🎬',
    config: {
      fontFamily: 'Montserrat',
      fontSize: 35,
      fontWeight: 800,
      color: '#f8fafc',
      strokeColor: '#020617',
      strokeWidth: 3,
      glowColor: '',
      boxColor: '#090d16',
      boxOpacity: 0.78,
      boxBorderColor: '#334155',
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -395,
      enterEffect: 'slide_up',
      exitEffect: 'fade',
      fadeInDuration: 0.16,
      fadeOutDuration: 0.14
    }
  },
  {
    id: 'comic_shout',
    label: 'Quát Lớn Nổi Giận (Đặc Biệt · Khoá 🔒)',
    shortLabel: '💢 Quát Lớn 🔒',
    badge: '💢',
    preserveByDefault: true,
    config: {
      fontFamily: 'Montserrat',
      fontSize: 42,
      fontWeight: 900,
      color: '#fef08a',
      strokeColor: '#7f1d1d',
      strokeWidth: 8,
      glowColor: '#ef4444',
      boxColor: '#450a0a',
      boxOpacity: 0.76,
      boxBorderColor: '#f87171',
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -385,
      enterEffect: 'pop_bounce',
      exitEffect: 'scale_out',
      fadeInDuration: 0.18,
      fadeOutDuration: 0.16
    }
  },
  {
    id: 'inner_thought',
    label: 'Độc Thoại Nội Tâm (Đặc Biệt · Khoá 🔒)',
    shortLabel: '💭 Nội Tâm 🔒',
    badge: '💭',
    preserveByDefault: true,
    config: {
      fontFamily: 'Montserrat',
      fontSize: 34,
      fontWeight: 700,
      color: '#e9d5ff',
      strokeColor: '#2e1065',
      strokeWidth: 5,
      glowColor: '#a855f7',
      boxColor: '#1e1b4b',
      boxOpacity: 0.74,
      boxBorderColor: '#c084fc',
      align: 'center',
      positionPreset: 'top_center',
      offsetX: 0,
      offsetY: 360,
      enterEffect: 'fade',
      exitEffect: 'fade',
      fadeInDuration: 0.25,
      fadeOutDuration: 0.25
    }
  },
  {
    id: 'system_hologram',
    label: 'Thông Báo Hệ Thống (Đặc Biệt · Khoá 🔒)',
    shortLabel: '🤖 Hệ Thống 🔒',
    badge: '🤖',
    preserveByDefault: true,
    config: {
      fontFamily: 'Montserrat',
      fontSize: 35,
      fontWeight: 900,
      color: '#7dd3fc',
      strokeColor: '#082f49',
      strokeWidth: 6,
      glowColor: '#38bdf8',
      boxColor: '#082f49',
      boxOpacity: 0.85,
      boxBorderColor: '#38bdf8',
      align: 'center',
      positionPreset: 'bottom_center',
      offsetX: 0,
      offsetY: -385,
      enterEffect: 'pop_bounce',
      exitEffect: 'fade',
      fadeInDuration: 0.16,
      fadeOutDuration: 0.14
    }
  }
]

export function getDefaultSubtitleConfig(presetId: SubtitleStylePresetId = 'lugia_cyan'): SubtitleDefaultsConfig {
  const found = SUBTITLE_STYLE_PRESETS.find((p) => p.id === presetId) ?? SUBTITLE_STYLE_PRESETS[0]
  return {
    presetId: found.id,
    ...found.config,
    syncHoldTargetLayer: true
  }
}

export function getProjectSubtitleDefaults(project: Project): SubtitleDefaultsConfig {
  if (!project.subtitleDefaults) {
    project.subtitleDefaults = getDefaultSubtitleConfig('lugia_cyan')
  }
  return project.subtitleDefaults
}

/** Tính tọa độ không gian (X, Y, Z) của phụ đề theo vị trí màn hình hoặc bám theo nhân vật nói */
export function computeSubtitlePlacement(
  project: Project,
  speakerLayer: Layer | undefined,
  positionPreset: SubtitlePositionPreset,
  offsetX: number,
  offsetY: number,
  atTime: number
): { position: Vec3; scale: number } {
  const subZ = -320
  const perspK = autoScaleFactor(subZ, project.comp)
  const safeScale = 0.88
  const spPos: Vec3 = speakerLayer ? evaluate(speakerLayer.transform.position, atTime) : [0, 0, 100]

  switch (positionPreset) {
    case 'top_center':
      return {
        position: [Math.round(offsetX), Math.round((offsetY || 365) * safeScale * perspK), subZ],
        scale: safeScale
      }
    case 'above_speaker':
      return {
        position: [
          Math.round(spPos[0] * 0.55 + offsetX),
          Math.round(Math.min(395, Math.max(120, spPos[1] + (offsetY || 210))) * safeScale * perspK),
          subZ
        ],
        scale: safeScale
      }
    case 'below_speaker':
      return {
        position: [
          Math.round(spPos[0] * 0.55 + offsetX),
          Math.round(Math.max(-425, Math.min(-180, spPos[1] + (offsetY || -240))) * safeScale * perspK),
          subZ
        ],
        scale: safeScale
      }
    case 'speech_left':
      return {
        position: [
          Math.round(Math.max(-560, spPos[0] - 280 + offsetX) * safeScale * perspK),
          Math.round((spPos[1] * 0.4 + (offsetY || 90)) * safeScale * perspK),
          subZ
        ],
        scale: safeScale
      }
    case 'speech_right':
      return {
        position: [
          Math.round(Math.min(560, spPos[0] + 280 + offsetX) * safeScale * perspK),
          Math.round((spPos[1] * 0.4 + (offsetY || 90)) * safeScale * perspK),
          subZ
        ],
        scale: safeScale
      }
    case 'custom':
      return {
        position: [Math.round(offsetX * perspK), Math.round(offsetY * perspK), subZ],
        scale: safeScale
      }
    case 'bottom_center':
    default:
      return {
        position: [Math.round(offsetX), Math.round((offsetY || -390) * safeScale * perspK), subZ],
        scale: safeScale
      }
  }
}

/** Áp dụng hiệu ứng xuất hiện (từ mờ sang đậm / bật nảy / trượt lên) & biến mất (từ đậm sang nhạt) cho layer Vietsub */
export function applySubtitleEnterExitKeyframes(
  sub: TextLayer,
  basePos: Vec3,
  baseScale: number,
  enterEffect: SubtitleEnterEffect,
  exitEffect: SubtitleExitEffect,
  fadeInSec: number,
  fadeOutSec: number
): void {
  const t0 = sub.inPoint
  const t1 = Math.max(t0 + 0.2, sub.outPoint)
  const dur = t1 - t0
  const fIn = Math.max(0.04, Math.min(dur * 0.4, fadeInSec))
  const fOut = Math.max(0.04, Math.min(dur * 0.4, fadeOutSec))
  sub.fadeIn = fIn
  sub.fadeOut = fOut

  sub.transform.position.value = [...basePos]
  sub.transform.scale.value = [baseScale, baseScale, 1]
  sub.transform.opacity.value = 1
  sub.transform.position.keyframes = []
  sub.transform.scale.keyframes = []
  sub.transform.opacity.keyframes = []

  // Opacity curve: từ mờ sang đậm (0 -> 1) và từ đậm sang nhạt (1 -> 0)
  sub.transform.opacity.keyframes.push(
    { id: nanoid(8), t: Number(t0.toFixed(3)), value: enterEffect === 'none' ? 1 : 0, ease: 'easeOut' },
    { id: nanoid(8), t: Number((t0 + fIn).toFixed(3)), value: 1, ease: 'linear' },
    { id: nanoid(8), t: Number((t1 - fOut).toFixed(3)), value: 1, ease: 'easeIn' },
    { id: nanoid(8), t: Number(t1.toFixed(3)), value: exitEffect === 'none' ? 1 : 0, ease: 'linear' }
  )

  if (enterEffect === 'pop_bounce' || exitEffect === 'scale_out' || enterEffect === 'typewriter_scale') {
    const startSc = enterEffect === 'pop_bounce' ? baseScale * 0.25 : enterEffect === 'typewriter_scale' ? baseScale * 0.86 : baseScale
    const overSc = enterEffect === 'pop_bounce' ? baseScale * 1.08 : baseScale
    const endSc = exitEffect === 'scale_out' ? baseScale * 0.65 : baseScale
    sub.transform.scale.keyframes.push(
      { id: nanoid(8), t: Number(t0.toFixed(3)), value: [startSc, startSc, 1], ease: 'easeOut' },
      { id: nanoid(8), t: Number((t0 + fIn * 0.75).toFixed(3)), value: [overSc, overSc, 1], ease: 'easeInOut' },
      { id: nanoid(8), t: Number((t0 + fIn * 1.15).toFixed(3)), value: [baseScale, baseScale, 1], ease: 'linear' },
      { id: nanoid(8), t: Number((t1 - fOut).toFixed(3)), value: [baseScale, baseScale, 1], ease: 'easeIn' },
      { id: nanoid(8), t: Number(t1.toFixed(3)), value: [endSc, endSc, 1], ease: 'linear' }
    )
  }

  if (enterEffect === 'slide_up' || exitEffect === 'slide_down') {
    const startY = enterEffect === 'slide_up' ? basePos[1] - 32 : basePos[1]
    const endY = exitEffect === 'slide_down' ? basePos[1] - 28 : basePos[1]
    sub.transform.position.keyframes.push(
      { id: nanoid(8), t: Number(t0.toFixed(3)), value: [basePos[0], startY, basePos[2]], ease: 'easeOut' },
      { id: nanoid(8), t: Number((t0 + fIn).toFixed(3)), value: [...basePos], ease: 'linear' },
      { id: nanoid(8), t: Number((t1 - fOut).toFixed(3)), value: [...basePos], ease: 'easeIn' },
      { id: nanoid(8), t: Number(t1.toFixed(3)), value: [basePos[0], endY, basePos[2]], ease: 'linear' }
    )
  }
}

/**
 * ĐỒNG BỘ THỜI LƯỢNG THOẠI (VIETSUB & AUDIO) VỚI HÌNH ẢNH NHÂN VẬT & CHUYỂN CẢNH:
 * - Khi nhân vật đang nói (Vietsub hoặc Audio thoại kéo dài tới `dialogueEnd`), đảm bảo nhân vật đó
 *   cùng các mảnh composite con và lớp nền cùng nhịp KHÔNG biến mất sớm trước `dialogueEnd`.
 * - Nếu nhân vật có keyframe mờ dần (fade out) ở cuối nhịp cũ, tự động dời mốc fade out sang `dialogueEnd`.
 * - Đồng bộ độ dài AudioTrack gắn cùng nhân vật trong nhịp đó để âm thanh và phụ đề không lệch nhau.
 */
export function enforceSpeakerAndSceneContinuity(
  project: Project,
  speakerLayer: Layer | undefined,
  dialogueStart: number,
  dialogueEnd: number
): { extendedLayerIds: string[]; syncedAudioIds: string[] } {
  const extendedLayerIds: string[] = []
  const syncedAudioIds: string[] = []
  if (!speakerLayer) return { extendedLayerIds, syncedAudioIds }

  const safeStart = Math.max(0, Number(dialogueStart.toFixed(2)))
  const safeEnd = Math.max(safeStart + 0.2, Number(dialogueEnd.toFixed(2)))
  const oldIn = speakerLayer.inPoint
  const oldOut = speakerLayer.outPoint
  const instId = speakerLayer.composite?.instanceId ?? speakerLayer.model3d?.instanceId

  // Tìm toàn bộ các layer thuộc cùng nhân vật / cùng nhịp trong cảnh đang hiển thị với nhân vật
  for (const l of project.layers) {
    if (l.shotId !== speakerLayer.shotId) continue
    const isSameEntity = l.id === speakerLayer.id || (instId && (l.composite?.instanceId === instId || l.model3d?.instanceId === instId))
    const isBeatCompanion =
      !l.props || !(l.props as { isSubtitleCue?: boolean }).isSubtitleCue
        ? Math.abs(l.inPoint - oldIn) < 0.12 && Math.abs(l.outPoint - oldOut) < 0.12
        : false

    if (!isSameEntity && !isBeatCompanion) continue

    let changed = false
    if (safeStart < l.inPoint) {
      l.inPoint = safeStart
      changed = true
    }
    if (safeEnd > l.outPoint) {
      const prevOut = l.outPoint
      l.outPoint = safeEnd
      // Dời các keyframe nằm ở sát cuối nhịp cũ (`prevOut`) về `safeEnd` để nhân vật không bị đứng đơ hoặc tắt sớm
      for (const track of [l.transform.position, l.transform.scale, l.transform.rotation, l.transform.opacity]) {
        for (const kf of track.keyframes) {
          if (Math.abs(kf.t - prevOut) <= 0.15) {
            kf.t = Number((safeEnd - Math.max(0, prevOut - kf.t)).toFixed(3))
          }
        }
      }
      changed = true
    }
    if (changed) extendedLayerIds.push(l.id)
  }

  // Đồng bộ với AudioTrack giọng nói gắn vào nhân vật trong cùng nhịp
  for (const tr of getProjectAudioTracks(project)) {
    const matchesTarget =
      tr.targetId === speakerLayer.id || (instId && tr.targetId === instId)
    if (!matchesTarget) continue
    const trStart = tr.offset ?? 0
    const trEnd = trStart + (tr.duration ?? 2.5)
    const overlaps = trStart <= safeEnd + 0.3 && trEnd >= safeStart - 0.3
    if (!overlaps) continue
    tr.offset = safeStart
    tr.duration = Number((safeEnd - safeStart).toFixed(2))
    syncedAudioIds.push(tr.id)
  }

  if (safeEnd > project.comp.duration) {
    project.comp.duration = Math.ceil(safeEnd)
  }
  return { extendedLayerIds, syncedAudioIds }
}

/** Tìm tất cả TextLayer là phụ đề Vietsub đang gắn với một Layer nhân vật / Cụm */
export function findTargetSubtitleLayers(
  project: Project,
  targetLayerId: string,
  memberIds: string[] = [targetLayerId]
): TextLayer[] {
  const set = new Set([targetLayerId, ...memberIds])
  return project.layers.filter(
    (l): l is TextLayer =>
      l.type === 'text' &&
      Boolean(
        (l.props.speakerLayerId && set.has(l.props.speakerLayerId)) ||
          (l.props.isSubtitleCue && l.parentId && set.has(l.parentId))
      )
  )
}

/** Đồng bộ một Node Vietsub (`logicCategory === 'subtitle'`) xuống `TextLayer` thực tế và giữ nhịp nhân vật nói */
export function syncSubtitleNodeToProject(
  project: Project,
  node: WorkflowNode,
  params: WorkflowNodeParams,
  patch?: Partial<WorkflowNodeParams>
): TextLayer | null {
  const defaults = getProjectSubtitleDefaults(project)
  const speakerId = params.targetLayerIds?.[0]
  const speakerLayer = project.layers.find((l) => l.id === speakerId)
  const shotId = params.shotId ?? speakerLayer?.shotId ?? project.shots[0]?.id ?? null
  const tStart = Math.max(0, Number((params.timeStart ?? speakerLayer?.inPoint ?? 0).toFixed(2)))
  const tEnd = Math.max(tStart + 0.25, Number((params.timeEnd ?? speakerLayer?.outPoint ?? (tStart + 2.8)).toFixed(2)))

  // Nếu người dùng vừa chọn 1 mẫu Preset trên Node (mà không truyền màu lẻ), nạp thông số preset đó
  const chosenPreset =
    patch && 'subtitleStylePreset' in patch && patch.subtitleStylePreset
      ? SUBTITLE_STYLE_PRESETS.find((p) => p.id === patch.subtitleStylePreset)
      : undefined

  let subLayer = project.layers.find(
    (l): l is TextLayer =>
      l.type === 'text' &&
      Boolean(
        l.id === params.subtitleLayerId ||
          l.id === `sub-${node.id}` ||
          (speakerId && l.props.speakerLayerId === speakerId && Math.abs(l.inPoint - tStart) < 0.25)
      )
  )

  const rawText =
    params.subtitleText ??
    subLayer?.props.text ??
    `Lời thoại của ${params.subtitleSpeakerName || speakerLayer?.name || 'Nhân vật'}`
  const wrappedText = wrapStorySubtitle(rawText, 42)

  if (!subLayer) {
    subLayer = factory.createTextLayer(project.comp, wrappedText)
    subLayer.id = params.subtitleLayerId || `sub-${node.id}`
    subLayer.shotId = shotId
    const shotIndex = project.layers.findIndex((l) => l.shotId === shotId)
    if (shotIndex < 0) project.layers.unshift(subLayer)
    else project.layers.splice(shotIndex, 0, subLayer)
  }

  subLayer.visible = node.enabled
  subLayer.shotId = shotId
  subLayer.inPoint = tStart
  subLayer.outPoint = tEnd
  subLayer.autoScale = true

  const styleCfg = chosenPreset?.config
  const fontFamily = patch?.subtitleFontFamily ?? styleCfg?.fontFamily ?? params.subtitleFontFamily ?? subLayer.props.fontFamily ?? defaults.fontFamily
  const fontSize = patch?.subtitleFontSize ?? styleCfg?.fontSize ?? params.subtitleFontSize ?? subLayer.props.fontSize ?? defaults.fontSize
  const fontWeight = patch?.subtitleFontWeight ?? styleCfg?.fontWeight ?? params.subtitleFontWeight ?? subLayer.props.fontWeight ?? defaults.fontWeight
  const color = patch?.subtitleColor ?? styleCfg?.color ?? params.subtitleColor ?? subLayer.props.color ?? defaults.color
  const strokeColor = patch?.subtitleStrokeColor ?? styleCfg?.strokeColor ?? params.subtitleStrokeColor ?? subLayer.props.strokeColor ?? defaults.strokeColor
  const strokeWidth = patch?.subtitleStrokeWidth ?? styleCfg?.strokeWidth ?? params.subtitleStrokeWidth ?? subLayer.props.strokeWidth ?? defaults.strokeWidth
  const glowColor = patch?.subtitleGlowColor ?? styleCfg?.glowColor ?? params.subtitleGlowColor ?? subLayer.props.glowColor ?? defaults.glowColor
  const boxColor = patch?.subtitleBoxColor ?? styleCfg?.boxColor ?? params.subtitleBoxColor ?? subLayer.props.boxColor ?? defaults.boxColor
  const boxOpacity = patch?.subtitleBoxOpacity ?? styleCfg?.boxOpacity ?? params.subtitleBoxOpacity ?? subLayer.props.boxOpacity ?? defaults.boxOpacity
  const align = patch?.subtitleAlign ?? styleCfg?.align ?? params.subtitleAlign ?? subLayer.props.align ?? defaults.align
  const posPreset = (patch?.subtitlePositionPreset ??
    styleCfg?.positionPreset ??
    params.subtitlePositionPreset ??
    subLayer.props.subtitlePositionPreset ??
    defaults.positionPreset) as SubtitlePositionPreset
  const offsetX = patch?.subtitleOffsetX ?? styleCfg?.offsetX ?? params.subtitleOffsetX ?? subLayer.props.subtitleOffsetX ?? defaults.offsetX
  const offsetY = patch?.subtitleOffsetY ?? styleCfg?.offsetY ?? params.subtitleOffsetY ?? subLayer.props.subtitleOffsetY ?? defaults.offsetY
  const enterEffect = (patch?.subtitleEnterEffect ??
    styleCfg?.enterEffect ??
    params.subtitleEnterEffect ??
    subLayer.props.subtitleEnterEffect ??
    defaults.enterEffect) as SubtitleEnterEffect
  const exitEffect = (patch?.subtitleExitEffect ??
    styleCfg?.exitEffect ??
    params.subtitleExitEffect ??
    subLayer.props.subtitleExitEffect ??
    defaults.exitEffect) as SubtitleExitEffect
  const fadeInSec = patch?.subtitleFadeIn ?? styleCfg?.fadeInDuration ?? params.subtitleFadeIn ?? subLayer.fadeIn ?? defaults.fadeInDuration
  const fadeOutSec = patch?.subtitleFadeOut ?? styleCfg?.fadeOutDuration ?? params.subtitleFadeOut ?? subLayer.fadeOut ?? defaults.fadeOutDuration
  const preserve =
    patch && 'preserveCustomSettings' in patch
      ? Boolean(patch.preserveCustomSettings)
      : chosenPreset?.preserveByDefault !== undefined && patch && 'subtitleStylePreset' in patch
        ? Boolean(chosenPreset.preserveByDefault)
        : Boolean(params.preserveCustomSettings ?? subLayer.props.preserveCustomSettings)
  const holdTiming = params.syncHoldTargetLayer ?? subLayer.props.holdSpeakerTiming ?? true
  const speakerName = params.subtitleSpeakerName ?? subLayer.props.speakerName ?? ''

  subLayer.name = `Vietsub: ${rawText.replace(/\n/g, ' ').slice(0, 28)}`
  subLayer.props = {
    ...subLayer.props,
    text: wrappedText,
    fontFamily,
    fontSize,
    fontWeight,
    color,
    letterSpacing: 1,
    shadow: true,
    strokeColor,
    strokeWidth,
    glowColor,
    boxColor,
    boxOpacity,
    align,
    isSubtitleCue: true,
    speakerLayerId: speakerId,
    speakerName,
    subtitleStylePreset: (params.subtitleStylePreset as SubtitleStylePresetId | undefined) ?? defaults.presetId,
    subtitlePositionPreset: posPreset,
    subtitleOffsetX: offsetX,
    subtitleOffsetY: offsetY,
    subtitleEnterEffect: enterEffect,
    subtitleExitEffect: exitEffect,
    preserveCustomSettings: preserve,
    lockedSubtitleFields: params.lockedSubtitleFields ?? subLayer.props.lockedSubtitleFields,
    holdSpeakerTiming: holdTiming
  }

  const placement = computeSubtitlePlacement(project, speakerLayer, posPreset, offsetX, offsetY, tStart)
  applySubtitleEnterExitKeyframes(subLayer, placement.position, placement.scale, enterEffect, exitEffect, fadeInSec, fadeOutSec)

  // Ghi ngược thông số chuẩn hoá lên Node Workflow để UI Inspector đồng bộ tức thì
  if (project.workflow) {
    const idx = project.workflow.nodes.findIndex((n) => n.id === node.id)
    if (idx >= 0) {
      const cur = project.workflow.nodes[idx]
      project.workflow.nodes[idx] = {
        ...cur,
        title: `Vietsub: ${rawText.replace(/\n/g, ' ').slice(0, 24)}`,
        params: {
          ...cur.params,
          subtitleLayerId: subLayer.id,
          subtitleText: rawText,
          subtitleSpeakerName: speakerName,
          subtitleFontFamily: fontFamily,
          subtitleFontSize: fontSize,
          subtitleFontWeight: fontWeight,
          subtitleColor: color,
          subtitleStrokeColor: strokeColor,
          subtitleStrokeWidth: strokeWidth,
          subtitleGlowColor: glowColor,
          subtitleBoxColor: boxColor,
          subtitleBoxOpacity: boxOpacity,
          subtitleAlign: align,
          subtitlePositionPreset: posPreset,
          subtitleOffsetX: offsetX,
          subtitleOffsetY: offsetY,
          subtitleEnterEffect: enterEffect,
          subtitleExitEffect: exitEffect,
          subtitleFadeIn: fadeInSec,
          subtitleFadeOut: fadeOutSec,
          preserveCustomSettings: preserve,
          syncHoldTargetLayer: holdTiming,
          timeStart: tStart,
          timeEnd: tEnd
        }
      }
    }
  }

  if (holdTiming && speakerLayer) {
    enforceSpeakerAndSceneContinuity(project, speakerLayer, tStart, tEnd)
  }

  return subLayer
}

/**
 * ÁP DỤNG CẤU HÌNH VIETSUB CHUNG CHO TOÀN BỘ NODE / LAYER TRONG DỰ ÁN (APPLY TO ALL):
 * - Những Node / Layer có `preserveCustomSettings === true` sẽ ĐƯỢC BẢO VỆ (không bị ghi đè),
 *   tránh làm hỏng các câu thoại đặc biệt (quát mắng, hệ thống, nội tâm).
 * - Nếu Node có `lockedSubtitleFields` (khoá riêng màu hoặc vị trí), chỉ kế thừa những thuộc tính không bị khoá.
 */
export function applySubtitleDefaultsToAllNodes(
  project: Project,
  defaultsPatch: Partial<SubtitleDefaultsConfig>,
  options?: { forceOverrideLocked?: boolean }
): {
  defaults: SubtitleDefaultsConfig
  updatedCount: number
  skippedProtectedCount: number
  updatedLayerIds: string[]
  skippedLayerIds: string[]
} {
  const curDefaults = getProjectSubtitleDefaults(project)
  const presetObj =
    defaultsPatch.presetId && defaultsPatch.presetId !== curDefaults.presetId
      ? SUBTITLE_STYLE_PRESETS.find((p) => p.id === defaultsPatch.presetId)
      : undefined

  const nextDefaults: SubtitleDefaultsConfig = {
    ...curDefaults,
    ...(presetObj ? presetObj.config : {}),
    ...defaultsPatch
  }
  project.subtitleDefaults = nextDefaults

  const updatedLayerIds: string[] = []
  const skippedLayerIds: string[] = []

  const subtitleLayers = project.layers.filter(
    (l): l is TextLayer =>
      l.type === 'text' &&
      (Boolean(l.props.isSubtitleCue) ||
        Boolean(l.props.speakerLayerId) ||
        l.name.startsWith('Phụ đề:') ||
        l.name.startsWith('Vietsub:'))
  )

  for (const sub of subtitleLayers) {
    const isProtected = Boolean(sub.props.preserveCustomSettings) && !options?.forceOverrideLocked
    if (isProtected) {
      skippedLayerIds.push(sub.id)
      continue
    }
    const locked = new Set<SubtitleProtectField>(options?.forceOverrideLocked ? [] : (sub.props.lockedSubtitleFields ?? []))
    if (!locked.has('font')) {
      sub.props.fontFamily = nextDefaults.fontFamily
      sub.props.fontSize = nextDefaults.fontSize
      sub.props.fontWeight = nextDefaults.fontWeight
      sub.props.align = nextDefaults.align
    }
    if (!locked.has('color')) {
      sub.props.color = nextDefaults.color
      sub.props.strokeColor = nextDefaults.strokeColor
      sub.props.strokeWidth = nextDefaults.strokeWidth
      sub.props.glowColor = nextDefaults.glowColor
    }
    if (!locked.has('background')) {
      sub.props.boxColor = nextDefaults.boxColor
      sub.props.boxOpacity = nextDefaults.boxOpacity
      sub.props.boxBorderColor = nextDefaults.boxBorderColor
    }
    const speaker = sub.props.speakerLayerId ? project.layers.find((l) => l.id === sub.props.speakerLayerId) : undefined
    const posPreset = locked.has('position')
      ? (sub.props.subtitlePositionPreset ?? nextDefaults.positionPreset)
      : nextDefaults.positionPreset
    const offX = locked.has('position') ? (sub.props.subtitleOffsetX ?? nextDefaults.offsetX) : nextDefaults.offsetX
    const offY = locked.has('position') ? (sub.props.subtitleOffsetY ?? nextDefaults.offsetY) : nextDefaults.offsetY
    if (!locked.has('position')) {
      sub.props.subtitlePositionPreset = posPreset
      sub.props.subtitleOffsetX = offX
      sub.props.subtitleOffsetY = offY
    }
    const enterEff = locked.has('animation')
      ? (sub.props.subtitleEnterEffect ?? nextDefaults.enterEffect)
      : nextDefaults.enterEffect
    const exitEff = locked.has('animation')
      ? (sub.props.subtitleExitEffect ?? nextDefaults.exitEffect)
      : nextDefaults.exitEffect
    const fIn = locked.has('animation') ? (sub.fadeIn ?? nextDefaults.fadeInDuration) : nextDefaults.fadeInDuration
    const fOut = locked.has('animation') ? (sub.fadeOut ?? nextDefaults.fadeOutDuration) : nextDefaults.fadeOutDuration
    if (!locked.has('animation')) {
      sub.props.subtitleEnterEffect = enterEff
      sub.props.subtitleExitEffect = exitEff
    }
    sub.props.subtitleStylePreset = nextDefaults.presetId

    const placement = computeSubtitlePlacement(project, speaker, posPreset, offX, offY, sub.inPoint)
    applySubtitleEnterExitKeyframes(sub, placement.position, placement.scale, enterEff, exitEff, fIn, fOut)
    updatedLayerIds.push(sub.id)
  }

  // Đồng bộ các Node Vietsub trên đồ thị Workflow
  if (project.workflow) {
    project.workflow.nodes = project.workflow.nodes.map((n) => {
      if (n.params?.logicCategory !== 'subtitle') return n
      const isProtected = Boolean(n.params.preserveCustomSettings) && !options?.forceOverrideLocked
      if (isProtected) return n
      const locked = new Set<SubtitleProtectField>(options?.forceOverrideLocked ? [] : (n.params.lockedSubtitleFields ?? []))
      return {
        ...n,
        params: {
          ...n.params,
          subtitleStylePreset: nextDefaults.presetId,
          ...(!locked.has('font')
            ? {
                subtitleFontFamily: nextDefaults.fontFamily,
                subtitleFontSize: nextDefaults.fontSize,
                subtitleFontWeight: nextDefaults.fontWeight,
                subtitleAlign: nextDefaults.align
              }
            : {}),
          ...(!locked.has('color')
            ? {
                subtitleColor: nextDefaults.color,
                subtitleStrokeColor: nextDefaults.strokeColor,
                subtitleStrokeWidth: nextDefaults.strokeWidth,
                subtitleGlowColor: nextDefaults.glowColor
              }
            : {}),
          ...(!locked.has('background')
            ? {
                subtitleBoxColor: nextDefaults.boxColor,
                subtitleBoxOpacity: nextDefaults.boxOpacity
              }
            : {}),
          ...(!locked.has('position')
            ? {
                subtitlePositionPreset: nextDefaults.positionPreset,
                subtitleOffsetX: nextDefaults.offsetX,
                subtitleOffsetY: nextDefaults.offsetY
              }
            : {}),
          ...(!locked.has('animation')
            ? {
                subtitleEnterEffect: nextDefaults.enterEffect,
                subtitleExitEffect: nextDefaults.exitEffect,
                subtitleFadeIn: nextDefaults.fadeInDuration,
                subtitleFadeOut: nextDefaults.fadeOutDuration
              }
            : {})
        }
      }
    })
  }

  return {
    defaults: nextDefaults,
    updatedCount: updatedLayerIds.length,
    skippedProtectedCount: skippedLayerIds.length,
    updatedLayerIds,
    skippedLayerIds
  }
}

/** Khôi phục cấu hình của 1 Node Vietsub về đúng bộ Mặc định chung (và bỏ khoá đặc biệt) */
export function resetSubtitleNodeToDefaults(project: Project, nodeId: string): void {
  const defaults = getProjectSubtitleDefaults(project)
  const node = project.workflow?.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const patch: Partial<WorkflowNodeParams> = {
    preserveCustomSettings: false,
    lockedSubtitleFields: [],
    subtitleStylePreset: defaults.presetId,
    subtitleFontFamily: defaults.fontFamily,
    subtitleFontSize: defaults.fontSize,
    subtitleFontWeight: defaults.fontWeight,
    subtitleColor: defaults.color,
    subtitleStrokeColor: defaults.strokeColor,
    subtitleStrokeWidth: defaults.strokeWidth,
    subtitleGlowColor: defaults.glowColor,
    subtitleBoxColor: defaults.boxColor,
    subtitleBoxOpacity: defaults.boxOpacity,
    subtitleAlign: defaults.align,
    subtitlePositionPreset: defaults.positionPreset,
    subtitleOffsetX: defaults.offsetX,
    subtitleOffsetY: defaults.offsetY,
    subtitleEnterEffect: defaults.enterEffect,
    subtitleExitEffect: defaults.exitEffect,
    subtitleFadeIn: defaults.fadeInDuration,
    subtitleFadeOut: defaults.fadeOutDuration
  }
  syncSubtitleNodeToProject(project, node, { ...(node.params ?? {}), ...patch }, patch)
}

export interface DialogueContinuityIssue {
  kind: 'speaker_cut_early' | 'audio_exceeds_speaker' | 'subtitle_audio_mismatch'
  speakerLayerId: string
  speakerName: string
  subtitleLayerId?: string
  audioTrackId?: string
  dialogueRange: [number, number]
  speakerRange: [number, number]
  fixed: boolean
  description: string
}

/**
 * KIỂM TRA & ĐỒNG BỘ TOÀN DIỆN HỘI THOẠI (VIETSUB + AUDIO + HÌNH ẢNH NHÂN VẬT) TRƯỚC KHI RENDER:
 * Phát hiện và tự động sửa mọi trường hợp nhân vật đang nói mà bị nhảy hình sớm hoặc Audio lệch Vietsub.
 */
export function validateAndRepairDialogueContinuity(
  project: Project,
  autoRepair = true
): {
  ok: boolean
  issues: DialogueContinuityIssue[]
  repairedCount: number
} {
  const issues: DialogueContinuityIssue[] = []
  let repairedCount = 0

  for (const sub of project.layers) {
    if (sub.type !== 'text' || !sub.props.speakerLayerId) continue
    const speaker = project.layers.find((l) => l.id === sub.props.speakerLayerId)
    if (!speaker) continue
    if (sub.outPoint > speaker.outPoint + 0.04 || sub.inPoint < speaker.inPoint - 0.04) {
      const shouldFix = autoRepair && sub.props.holdSpeakerTiming !== false
      if (shouldFix) {
        enforceSpeakerAndSceneContinuity(project, speaker, sub.inPoint, sub.outPoint)
        repairedCount++
      }
      issues.push({
        kind: 'speaker_cut_early',
        speakerLayerId: speaker.id,
        speakerName: speaker.name,
        subtitleLayerId: sub.id,
        dialogueRange: [sub.inPoint, sub.outPoint],
        speakerRange: [speaker.inPoint, speaker.outPoint],
        fixed: shouldFix,
        description: `Nhân vật "${speaker.name}" kết thúc hiển thị tại ${speaker.outPoint}s trước khi nói xong Vietsub (${sub.outPoint}s).`
      })
    }
  }

  for (const tr of getProjectAudioTracks(project)) {
    if (!tr.targetId || tr.characterRole === 'bgm') continue
    const speaker = project.layers.find(
      (l) => l.id === tr.targetId || l.composite?.instanceId === tr.targetId || l.model3d?.instanceId === tr.targetId
    )
    if (!speaker) continue
    const trStart = tr.offset ?? 0
    const trEnd = Number((trStart + (tr.duration ?? 2.5)).toFixed(2))
    if (trEnd > speaker.outPoint + 0.05) {
      if (autoRepair) {
        enforceSpeakerAndSceneContinuity(project, speaker, trStart, trEnd)
        repairedCount++
      }
      issues.push({
        kind: 'audio_exceeds_speaker',
        speakerLayerId: speaker.id,
        speakerName: speaker.name,
        audioTrackId: tr.id,
        dialogueRange: [trStart, trEnd],
        speakerRange: [speaker.inPoint, speaker.outPoint],
        fixed: autoRepair,
        description: `Audio thoại "${tr.name || speaker.name}" kéo dài tới ${trEnd}s nhưng hình nhân vật tắt sớm tại ${speaker.outPoint}s.`
      })
    }
  }

  return {
    ok: issues.every((i) => i.fixed),
    issues,
    repairedCount
  }
}
