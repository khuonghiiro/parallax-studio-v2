import type {
  Layer,
  Project,
  SubtitleBubbleTail,
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
import { getProjectAudioTracks } from './audioTracks'
import * as factory from './factory'
import {
  SUBTITLE_STYLE_PRESETS,
  computeSubtitlePlacement,
  defaultOffsetYForPreset,
  projectSpeakerScreenCenter,
  resolveBubbleTailForPreset,
  wrapBalancedSubtitle,
  type SubtitlePresetOption
} from './subtitlePlacementAndPresets'

export {
  SUBTITLE_STYLE_PRESETS,
  computeSubtitlePlacement,
  defaultOffsetYForPreset,
  projectSpeakerScreenCenter,
  resolveBubbleTailForPreset,
  wrapBalancedSubtitle,
  type SubtitlePresetOption
}

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
    const startSc = enterEffect === 'pop_bounce' ? baseScale * 0.28 : enterEffect === 'typewriter_scale' ? baseScale * 0.86 : baseScale
    const overSc = enterEffect === 'pop_bounce' ? baseScale * 1.07 : baseScale
    const endSc = exitEffect === 'scale_out' ? baseScale * 0.68 : baseScale
    sub.transform.scale.keyframes.push(
      { id: nanoid(8), t: Number(t0.toFixed(3)), value: [startSc, startSc, 1], ease: 'easeOut' },
      { id: nanoid(8), t: Number((t0 + fIn * 0.75).toFixed(3)), value: [overSc, overSc, 1], ease: 'easeInOut' },
      { id: nanoid(8), t: Number((t0 + fIn * 1.15).toFixed(3)), value: [baseScale, baseScale, 1], ease: 'linear' },
      { id: nanoid(8), t: Number((t1 - fOut).toFixed(3)), value: [baseScale, baseScale, 1], ease: 'easeIn' },
      { id: nanoid(8), t: Number(t1.toFixed(3)), value: [endSc, endSc, 1], ease: 'linear' }
    )
  }

  if (enterEffect === 'slide_up' || exitEffect === 'slide_down') {
    const startY = enterEffect === 'slide_up' ? basePos[1] - 30 : basePos[1]
    const endY = exitEffect === 'slide_down' ? basePos[1] - 26 : basePos[1]
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

  const styleCfg = chosenPreset?.config
  const activePresetId = ((patch?.subtitleStylePreset ??
    params.subtitleStylePreset ??
    subLayer?.props.subtitleStylePreset ??
    defaults.presetId) as SubtitleStylePresetId)
  const maxChars = patch?.subtitleMaxChars ?? styleCfg?.maxCharsPerLine ?? params.subtitleMaxChars ?? subLayer?.props.maxCharsPerLine ?? defaults.maxCharsPerLine ?? 42
  const rawText =
    params.subtitleText ??
    subLayer?.props.text ??
    `Lời thoại của ${params.subtitleSpeakerName || speakerLayer?.name || 'Nhân vật'}`
  const wrappedText = wrapBalancedSubtitle(rawText, maxChars)

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

  const fontFamily = patch?.subtitleFontFamily ?? styleCfg?.fontFamily ?? params.subtitleFontFamily ?? subLayer.props.fontFamily ?? defaults.fontFamily
  const fontSize = patch?.subtitleFontSize ?? styleCfg?.fontSize ?? params.subtitleFontSize ?? subLayer.props.fontSize ?? defaults.fontSize
  const fontWeight = patch?.subtitleFontWeight ?? styleCfg?.fontWeight ?? params.subtitleFontWeight ?? subLayer.props.fontWeight ?? defaults.fontWeight
  const italic = patch?.subtitleItalic ?? styleCfg?.italic ?? params.subtitleItalic ?? subLayer.props.italic ?? defaults.italic ?? false
  const color = patch?.subtitleColor ?? styleCfg?.color ?? params.subtitleColor ?? subLayer.props.color ?? defaults.color
  const strokeColor = patch?.subtitleStrokeColor ?? styleCfg?.strokeColor ?? params.subtitleStrokeColor ?? subLayer.props.strokeColor ?? defaults.strokeColor
  const strokeWidth = patch?.subtitleStrokeWidth ?? styleCfg?.strokeWidth ?? params.subtitleStrokeWidth ?? subLayer.props.strokeWidth ?? defaults.strokeWidth
  const glowColor = patch?.subtitleGlowColor ?? styleCfg?.glowColor ?? params.subtitleGlowColor ?? subLayer.props.glowColor ?? defaults.glowColor
  const boxColor = patch?.subtitleBoxColor ?? styleCfg?.boxColor ?? params.subtitleBoxColor ?? subLayer.props.boxColor ?? defaults.boxColor
  const boxOpacity = patch?.subtitleBoxOpacity ?? styleCfg?.boxOpacity ?? params.subtitleBoxOpacity ?? subLayer.props.boxOpacity ?? defaults.boxOpacity
  const boxBorderColor = patch?.subtitleBoxBorderColor ?? styleCfg?.boxBorderColor ?? params.subtitleBoxBorderColor ?? subLayer.props.boxBorderColor ?? defaults.boxBorderColor
  const align = patch?.subtitleAlign ?? styleCfg?.align ?? params.subtitleAlign ?? subLayer.props.align ?? defaults.align
  const posPreset = (patch?.subtitlePositionPreset ??
    styleCfg?.positionPreset ??
    params.subtitlePositionPreset ??
    subLayer.props.subtitlePositionPreset ??
    defaults.positionPreset) as SubtitlePositionPreset
  const offsetX = patch?.subtitleOffsetX ?? styleCfg?.offsetX ?? params.subtitleOffsetX ?? subLayer.props.subtitleOffsetX ?? defaults.offsetX
  const offsetY = patch?.subtitleOffsetY ?? styleCfg?.offsetY ?? params.subtitleOffsetY ?? subLayer.props.subtitleOffsetY ?? defaultOffsetYForPreset(posPreset)
  const rawTail = (patch?.subtitleBubbleTail ?? styleCfg?.bubbleTail ?? params.subtitleBubbleTail ?? subLayer.props.bubbleTail ?? defaults.bubbleTail ?? 'none') as SubtitleBubbleTail
  const bubbleTail = activePresetId === 'comic_bubble' ? resolveBubbleTailForPreset(posPreset, rawTail === 'none' ? undefined : rawTail) : rawTail
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
    italic,
    color,
    letterSpacing: 0.8,
    shadow: true,
    strokeColor,
    strokeWidth,
    glowColor,
    boxColor,
    boxOpacity,
    boxBorderColor,
    bubbleTail,
    maxCharsPerLine: maxChars,
    align,
    isSubtitleCue: true,
    speakerLayerId: speakerId,
    speakerName,
    subtitleStylePreset: activePresetId,
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
          subtitleStylePreset: activePresetId,
          subtitleFontFamily: fontFamily,
          subtitleFontSize: fontSize,
          subtitleFontWeight: fontWeight,
          subtitleItalic: italic,
          subtitleColor: color,
          subtitleStrokeColor: strokeColor,
          subtitleStrokeWidth: strokeWidth,
          subtitleGlowColor: glowColor,
          subtitleBoxColor: boxColor,
          subtitleBoxOpacity: boxOpacity,
          subtitleBoxBorderColor: boxBorderColor,
          subtitleBubbleTail: bubbleTail,
          subtitleMaxChars: maxChars,
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
 * - Những Node / Layer có `preserveCustomSettings === true` sẽ ĐƯỢC BẢO VỆ (không bị ghi đè).
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
      sub.props.italic = nextDefaults.italic ?? false
      sub.props.align = nextDefaults.align
      if (nextDefaults.maxCharsPerLine) {
        sub.props.maxCharsPerLine = nextDefaults.maxCharsPerLine
        sub.props.text = wrapBalancedSubtitle(sub.props.text.replace(/\n/g, ' '), nextDefaults.maxCharsPerLine)
      }
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
      sub.props.bubbleTail = nextDefaults.bubbleTail ?? 'none'
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
                subtitleItalic: nextDefaults.italic ?? false,
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
                subtitleBoxOpacity: nextDefaults.boxOpacity,
                subtitleBoxBorderColor: nextDefaults.boxBorderColor,
                subtitleBubbleTail: nextDefaults.bubbleTail ?? 'none'
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
    subtitleItalic: defaults.italic ?? false,
    subtitleColor: defaults.color,
    subtitleStrokeColor: defaults.strokeColor,
    subtitleStrokeWidth: defaults.strokeWidth,
    subtitleGlowColor: defaults.glowColor,
    subtitleBoxColor: defaults.boxColor,
    subtitleBoxOpacity: defaults.boxOpacity,
    subtitleBoxBorderColor: defaults.boxBorderColor,
    subtitleBubbleTail: defaults.bubbleTail ?? 'none',
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
