import type {
  Composition,
  EaseName,
  ImageLayer,
  Layer,
  Project,
  SolidLayer,
  SolidPattern,
  SubtitleEnterEffect,
  SubtitleExitEffect,
  SubtitlePositionPreset,
  SubtitleStylePresetId,
  TextLayer,
  Vec3
} from '@shared/types'
import { nanoid } from 'nanoid'
import * as factory from '../project/factory'
import {
  SUBTITLE_STYLE_PRESETS,
  applySubtitleEnterExitKeyframes,
  computeSubtitlePlacement,
  enforceSpeakerAndSceneContinuity,
  getProjectSubtitleDefaults
} from '../project/subtitleAndDialogueSync'
import {
  type CinematicCameraBeat,
  type ShotTransitionStyle
} from './cinematicCameraRoute'
import { evaluate } from './keyframes'
import { autoScaleFactor, referenceDistance } from './math'
import { generatePresetSpatialTracks } from './motionPresets'

export type StoryMoodBackdrop =
  | 'world'
  | 'question_sky'
  | 'speedlines_radial'
  | 'horror_bw_speedlines'
  | 'spotlight_stage'
  | 'anger_veins'
  | 'comic_burst'

export type StoryCameraGrammar =
  | 'cold_open_shock'
  | 'confused_push'
  | 'over_shoulder_system'
  | 'snap_reaction_zoom'
  | 'low_angle_menace'
  | 'spotlight_pity_pull'
  | 'rage_punch_shake'
  | 'confrontation_push'
  | 'three_plane_escape'
  | 'foreground_weapon_slam'
  | 'thought_contemplation'
  | 'oppressive_low_push'

export type StoryEmoteBadge = 'none' | 'question_giant' | 'anger_cross' | 'sweat_drop' | 'red_eye_flare'

export interface SystemQuestSpec {
  title: string
  body: string
  position?: Vec3
}

export interface StoryComicBeatSpec {
  shotId: string
  start: number
  end: number
  narration?: string
  speakerName?: string
  subtitleStylePreset?: SubtitleStylePresetId
  subtitlePositionPreset?: SubtitlePositionPreset
  subtitleOffsetY?: number
  subtitleEnterEffect?: SubtitleEnterEffect
  subtitleExitEffect?: SubtitleExitEffect
  preserveSubtitleSettings?: boolean
  mood?: StoryMoodBackdrop
  cameraGrammar?: StoryCameraGrammar
  subjectId?: string
  secondarySubjectId?: string
  systemQuest?: SystemQuestSpec
  emoteBadge?: StoryEmoteBadge
  emotePosition?: Vec3
  transitionAtEnd?: ShotTransitionStyle
  focusOffset?: [number, number]
}

export interface StagedStoryBeatResult {
  shotId: string
  createdLayerIds: string[]
  cameraBeat: CinematicCameraBeat
}

const MOOD_PALETTES: Record<Exclude<StoryMoodBackdrop, 'world'>, { color: string; color2: string; label: string }> = {
  question_sky: { color: '#5ca4ff', color2: '#cbe6ff', label: 'Nền Tâm Lý · Ngơ Ngác (?)' },
  speedlines_radial: { color: '#2b0938', color2: '#7a0e52', label: 'Nền Tâm Lý · Sát Khí Áp Bức' },
  horror_bw_speedlines: { color: '#eef6f0', color2: '#090d0b', label: 'Nền Tâm Lý · Kinh Hoàng Đen Trắng' },
  spotlight_stage: { color: '#3b3e45', color2: '#1d2026', label: 'Nền Tâm Lý · Đèn Spotlight Bi Kịch' },
  anger_veins: { color: '#be123c', color2: '#fb7185', label: 'Nền Tâm Lý · Nổi Điên (💢)' },
  comic_burst: { color: '#fde047', color2: '#ef4444', label: 'Nền Tâm Lý · Bùng Nổ Cao Trào' }
}

/**
 * Neo bán thân (bust/waist-up cutout) xuống dưới đáy khung hình 16:9 để TUYỆT ĐỐI KHÔNG BAO GIỜ
 * lộ đường cắt ngang bụng/hông khi camera zoom, pan hoặc nhân vật nhún nhảy,
 * đồng thời GIỮ NGUYÊN tỷ lệ kích thước chuẩn (`scale`) của nhân vật (không tự ý phóng to làm lệch tỷ lệ).
 */
export function anchorBustLayerToFrameBottom(
  layer: ImageLayer,
  comp: Pick<Composition, 'width' | 'height'>,
  maxCamScale = 1.02
): void {
  const pos = layer.transform.position.value
  const perspK = layer.autoScale ? 1 : autoScaleFactor(pos[2], comp)
  const finalScY = layer.transform.scale.value[1]
  const halfHWorld = layer.props.height * finalScY * 0.5
  const safeBottomWorld = -(comp.height * 0.5 * maxCamScale + 48) * perspK
  const currentBottomWorld = pos[1] - halfHWorld
  if (currentBottomWorld > safeBottomWorld) {
    const dy = Math.round(safeBottomWorld - currentBottomWorld)
    layer.transform.position.value = [pos[0], pos[1] + dy, pos[2]]
    for (const kf of layer.transform.position.keyframes) {
      kf.value = [kf.value[0], kf.value[1] + dy, kf.value[2]]
    }
  }
}

export function wrapStorySubtitle(raw: string, maxCharsPerLine = 42): string {
  const clean = raw.trim().replace(/\s+/g, ' ')
  if (clean.length <= maxCharsPerLine || clean.includes('\n')) return clean
  const words = clean.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxCharsPerLine && cur.length > 0) {
      lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines.join('\n')
}

function insertBeatLayerTop(project: Project, shotId: string, layer: Layer): void {
  layer.shotId = shotId
  const idx = project.layers.findIndex((l) => l.shotId === shotId)
  if (idx < 0) project.layers.unshift(layer)
  else project.layers.splice(idx, 0, layer)
}

function insertBeatBackdrop(
  project: Project,
  shotId: string,
  mood: Exclude<StoryMoodBackdrop, 'world'>,
  start: number,
  end: number
): SolidLayer {
  const pal = MOOD_PALETTES[mood]
  const solid = factory.createSolidLayer(project.comp)
  solid.shotId = shotId
  solid.name = pal.label
  solid.inPoint = start
  solid.outPoint = end
  solid.autoScale = true
  solid.transform.position.value = [0, 0, 1450]
  solid.props = {
    color: pal.color,
    color2: pal.color2,
    gradient: true,
    pattern: mood as SolidPattern,
    width: Math.round(project.comp.width * 1.32),
    height: Math.round(project.comp.height * 1.32)
  }
  let lastIdx = -1
  project.layers.forEach((l, i) => {
    if (l.shotId === shotId) lastIdx = i
  })
  if (lastIdx < 0) project.layers.push(solid)
  else project.layers.splice(lastIdx + 1, 0, solid)
  return solid
}

function createSystemQuestLayers(
  project: Project,
  shotId: string,
  quest: SystemQuestSpec,
  start: number,
  end: number
): Layer[] {
  const pos: Vec3 = quest.position ?? [40, 65, 190]
  const dur = Math.max(0.4, end - start)
  const panel = factory.createSolidLayer(project.comp)
  panel.name = 'Bảng Hệ Thống (Hologram)'
  panel.inPoint = start
  panel.outPoint = end
  panel.autoScale = false
  panel.transform.position.value = [...pos]
  panel.props = {
    color: 'rgba(14, 128, 206, 0.88)',
    color2: 'rgba(7, 52, 98, 0.92)',
    gradient: true,
    pattern: 'hologram_panel',
    width: 820,
    height: 360
  }
  const popPanel = generatePresetSpatialTracks(
    'system_pop_bounce',
    { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1 },
    { time: start, duration: dur }
  )
  panel.transform.scale.keyframes = popPanel.scale
  panel.transform.opacity.keyframes = popPanel.opacity

  const txt = factory.createTextLayer(project.comp, `${quest.title}\n${wrapStorySubtitle(quest.body, 34)}`)
  txt.name = `Nhiệm Vụ: ${quest.title}`
  txt.inPoint = start
  txt.outPoint = end
  txt.autoScale = false
  txt.transform.position.value = [pos[0], pos[1], pos[2] - 8]
  txt.props = {
    text: `${quest.title}\n${wrapStorySubtitle(quest.body, 34)}`,
    fontFamily: 'Montserrat',
    fontSize: 34,
    fontWeight: 800,
    color: '#fef08a',
    letterSpacing: 1,
    shadow: true,
    strokeColor: '#082f49',
    strokeWidth: 5,
    glowColor: '#38bdf8'
  }
  const popTxt = generatePresetSpatialTracks(
    'system_pop_bounce',
    { position: [pos[0], pos[1], pos[2] - 8], rotation: [0, 0, 0], scale: [1, 1, 1], opacity: 1 },
    { time: start, duration: dur }
  )
  txt.transform.scale.keyframes = popTxt.scale
  txt.transform.opacity.keyframes = popTxt.opacity

  insertBeatLayerTop(project, shotId, panel)
  insertBeatLayerTop(project, shotId, txt)
  return [panel, txt]
}

function createEmoteBadgeLayer(
  project: Project,
  shotId: string,
  badge: Exclude<StoryEmoteBadge, 'none'>,
  pos: Vec3 | undefined,
  start: number,
  end: number
): TextLayer {
  const cfg: Record<Exclude<StoryEmoteBadge, 'none'>, { symbol: string; size: number; color: string; stroke: string; glow: string; defaultPos: Vec3 }> = {
    question_giant: { symbol: '?', size: 360, color: '#facc15', stroke: '#451a03', glow: '#fde047', defaultPos: [95, 75, 165] },
    anger_cross: { symbol: '💢', size: 135, color: '#ef4444', stroke: '#450a0a', glow: '#fb7185', defaultPos: [185, 175, 55] },
    sweat_drop: { symbol: '💧', size: 92, color: '#7dd3fc', stroke: '#0c4a6e', glow: '#38bdf8', defaultPos: [120, 155, 45] },
    red_eye_flare: { symbol: '✦━━━✦', size: 84, color: '#ff1e42', stroke: '#ff0033', glow: '#ff1e42', defaultPos: [-155, 165, 45] }
  }
  const c = cfg[badge]
  const targetPos = pos ?? c.defaultPos
  const layer = factory.createTextLayer(project.comp, c.symbol)
  layer.name = `Biểu Cảm Comic (${badge})`
  layer.inPoint = start
  layer.outPoint = end
  layer.autoScale = false
  layer.transform.position.value = [...targetPos]
  if (badge === 'red_eye_flare') {
    layer.blendMode = 'add'
    layer.transform.rotation.value = [0, 0, -18]
  }
  layer.props = {
    text: c.symbol,
    fontFamily: 'Montserrat',
    fontSize: c.size,
    fontWeight: 900,
    color: c.color,
    letterSpacing: 0,
    shadow: true,
    strokeColor: c.stroke,
    strokeWidth: badge === 'question_giant' ? 11 : 7,
    glowColor: c.glow
  }
  const preset = badge === 'question_giant' ? 'pendulum_question' : 'system_pop_bounce'
  const pop = generatePresetSpatialTracks(
    preset,
    { position: targetPos, rotation: layer.transform.rotation.value, scale: [1, 1, 1], opacity: 1 },
    { time: start, duration: Math.max(0.35, end - start) }
  )
  layer.transform.scale.keyframes = pop.scale
  if (pop.rotation.length > 0) layer.transform.rotation.keyframes = pop.rotation
  insertBeatLayerTop(project, shotId, layer)
  return layer
}

export function toCinematicBeatFromStoryGrammar(spec: StoryComicBeatSpec): CinematicCameraBeat {
  const g = spec.cameraGrammar ?? 'confused_push'
  const base: Partial<CinematicCameraBeat> = {
    shotId: spec.shotId,
    start: spec.start,
    end: spec.end,
    subjectId: spec.subjectId,
    secondarySubjectId: spec.secondarySubjectId,
    transitionAtEnd: spec.transitionAtEnd ?? 'cut',
    offsetStart: spec.focusOffset ?? [0, 0],
    offsetEnd: spec.focusOffset ?? [0, 0]
  }
  switch (g) {
    case 'cold_open_shock':
      return { ...base, kind: 'punch_zoom', startScale: 1.0, impactScale: 0.88, endScale: 0.85 } as CinematicCameraBeat
    case 'over_shoulder_system':
      return { ...base, kind: 'establish_corridor', startScale: 0.98, endScale: 0.90 } as CinematicCameraBeat
    case 'snap_reaction_zoom':
      return { ...base, kind: 'punch_zoom', startScale: 1.0, impactScale: 0.86, endScale: 0.82 } as CinematicCameraBeat
    case 'low_angle_menace':
      return { ...base, kind: 'hero_low_ascent', startScale: 0.96, endScale: 0.87 } as CinematicCameraBeat
    case 'spotlight_pity_pull':
      return { ...base, kind: 'crane_rise', startScale: 0.84, endScale: 0.98 } as CinematicCameraBeat
    case 'rage_punch_shake':
      return { ...base, kind: 'punch_zoom', startScale: 0.98, impactScale: 0.86, endScale: 0.83 } as CinematicCameraBeat
    case 'confrontation_push':
      return { ...base, kind: 'establish_corridor', startScale: 1.0, endScale: 0.84 } as CinematicCameraBeat
    case 'three_plane_escape':
      return { ...base, kind: 'orbit_parallax', startScale: 0.98, endScale: 0.91 } as CinematicCameraBeat
    case 'foreground_weapon_slam':
      return { ...base, kind: 'punch_zoom', startScale: 0.98, impactScale: 0.86, endScale: 0.84 } as CinematicCameraBeat
    case 'confused_push':
    default:
      return { ...base, kind: 'establish_corridor', startScale: 1.0, endScale: 0.88 } as CinematicCameraBeat
  }
}

export function stageStoryComicBeat(project: Project, spec: StoryComicBeatSpec): StagedStoryBeatResult {
  const createdLayerIds: string[] = []
  const cameraBeat = toCinematicBeatFromStoryGrammar(spec)

  if (spec.mood && spec.mood !== 'world') {
    const bg = insertBeatBackdrop(project, spec.shotId, spec.mood, spec.start, spec.end)
    createdLayerIds.push(bg.id)
  }

  if (spec.emoteBadge && spec.emoteBadge !== 'none') {
    const em = createEmoteBadgeLayer(project, spec.shotId, spec.emoteBadge, spec.emotePosition, spec.start, spec.end)
    createdLayerIds.push(em.id)
  }

  if (spec.systemQuest) {
    const qLayers = createSystemQuestLayers(project, spec.shotId, spec.systemQuest, spec.start, spec.end)
    createdLayerIds.push(...qLayers.map((l) => l.id))
  }

  if (spec.narration && spec.narration.trim()) {
    const defaults = getProjectSubtitleDefaults(project)
    const presetId = spec.subtitleStylePreset ?? defaults.presetId
    const presetObj = SUBTITLE_STYLE_PRESETS.find((p) => p.id === presetId)
    const st = presetObj?.config ?? defaults
    const posPreset = spec.subtitlePositionPreset ?? st.positionPreset ?? 'bottom_center'
    const offX = spec.focusOffset?.[0] ?? st.offsetX ?? 0
    const offY = spec.subtitleOffsetY ?? st.offsetY ?? -390
    const enterEff = spec.subtitleEnterEffect ?? st.enterEffect ?? 'fade'
    const exitEff = spec.subtitleExitEffect ?? st.exitEffect ?? 'fade'
    const preserve = spec.preserveSubtitleSettings ?? Boolean(presetObj?.preserveByDefault)

    const speakerLayer = spec.subjectId ? project.layers.find((l) => l.id === spec.subjectId) : undefined
    const subText = wrapStorySubtitle(spec.narration.toUpperCase(), 42)
    const sub = factory.createTextLayer(project.comp, subText)
    sub.name = `Phụ đề: ${spec.narration.slice(0, 26)}`
    sub.inPoint = spec.start
    sub.outPoint = spec.end
    sub.autoScale = true
    const placement = computeSubtitlePlacement(project, speakerLayer, posPreset, offX, offY, spec.start)
    sub.props = {
      text: subText,
      fontFamily: st.fontFamily,
      fontSize: st.fontSize,
      fontWeight: st.fontWeight,
      color: st.color,
      letterSpacing: 1,
      shadow: true,
      strokeColor: st.strokeColor,
      strokeWidth: st.strokeWidth,
      glowColor: st.glowColor,
      boxColor: st.boxColor,
      boxOpacity: st.boxOpacity,
      align: st.align,
      isSubtitleCue: true,
      speakerLayerId: spec.subjectId,
      speakerName: spec.speakerName,
      subtitleStylePreset: presetId,
      subtitlePositionPreset: posPreset,
      subtitleOffsetX: offX,
      subtitleOffsetY: offY,
      subtitleEnterEffect: enterEff,
      subtitleExitEffect: exitEff,
      preserveCustomSettings: preserve,
      holdSpeakerTiming: true
    }
    applySubtitleEnterExitKeyframes(sub, placement.position, placement.scale, enterEff, exitEff, st.fadeInDuration, st.fadeOutDuration)
    if (speakerLayer) {
      enforceSpeakerAndSceneContinuity(project, speakerLayer, spec.start, spec.end)
    }
    insertBeatLayerTop(project, spec.shotId, sub)
    createdLayerIds.push(sub.id)
  }

  return { shotId: spec.shotId, createdLayerIds, cameraBeat }
}

/**
 * Dựng lộ trình Camera 2D/2.5D chuẩn Hoạt Ảnh Kể Chuyện (Lugia Media / Bilibili Manhua):
 * - Tuyệt đối giữ `yaw = 0, pitch = 0, roll = 0` để các lớp vẽ 2D không bị méo phối cảnh.
 * - Mỗi nhịp chỉ di chuyển 1 chiều mượt mà (Push-In, Pull-Out, Pan hoặc Snap Zoom + giữ tĩnh), KHÔNG zoom vào rồi lại zoom ngược ra giữa câu.
 * - Giữa các nhịp cắt phẳng tức thì (`0.001s` `hold`) không bị giật whip hay hở nền đen.
 */
export function applyStoryComicCamera(project: Project, specs: StoryComicBeatSpec[]) {
  const cam = project.camera
  cam.position.keyframes = []
  cam.target.keyframes = []
  cam.focusDistance.keyframes = []
  cam.fov.keyframes = []
  cam.roll ??= { value: 0, keyframes: [] }
  cam.roll.keyframes = []
  cam.roll.value = 0
  cam.fade ??= { value: 0, keyframes: [] }
  cam.fade.keyframes = []
  cam.fade.value = 0

  const refDist = referenceDistance(project.comp)
  const baseHalfTan = Math.tan((20 * Math.PI) / 180)

  const pushPose = (t: number, shotPos: Vec3, dx: number, dy: number, scale: number, ease: EaseName) => {
    const tt = Number(t.toFixed(3))
    const tx = Math.round(shotPos[0] + dx)
    const ty = Math.round(shotPos[1] + dy)
    const tz = Math.round(shotPos[2])
    // Giữ khoảng cách chuẩn refDist để autoScaleFactor khớp 100% không làm lệch viền cắt nhân vật,
    // đồng thời tạo thị sai 2.5D tự nhiên khi dịch máy ngang/dọc và zoom mượt bằng FOV quang học.
    const px = Math.round(tx + dx * 0.35)
    const py = Math.round(ty + dy * 0.25)
    const pz = Math.round(tz - refDist)
    const fov = Number(((2 * Math.atan(baseHalfTan * scale) * 180) / Math.PI).toFixed(2))

    cam.target.keyframes.push({ id: nanoid(8), t: tt, value: [tx, ty, tz], ease })
    cam.position.keyframes.push({ id: nanoid(8), t: tt, value: [px, py, pz], ease })
    cam.focusDistance.keyframes.push({ id: nanoid(8), t: tt, value: Math.round(refDist), ease })
    cam.fov.keyframes.push({ id: nanoid(8), t: tt, value: fov, ease })
    cam.roll!.keyframes.push({ id: nanoid(8), t: tt, value: 0, ease })
  }

  const sorted = [...specs].sort((a, b) => a.start - b.start)
  for (let i = 0; i < sorted.length; i++) {
    const spec = sorted[i]
    const shot = project.shots.find((s) => s.id === spec.shotId) ?? project.shots[0]
    const t0 = spec.start
    const sp: Vec3 = shot ? evaluate(shot.position, t0) : [0, 0, 0]
    const isLast = i === sorted.length - 1
    const t1 = isLast ? spec.end : Math.max(t0 + 0.1, spec.end - 0.001)
    const endEase: EaseName = isLast ? 'easeOut' : 'hold'
    const fx = spec.focusOffset?.[0] ?? 0
    const fy = spec.focusOffset?.[1] ?? 0
    const g = spec.cameraGrammar ?? 'confused_push'

    switch (g) {
      case 'cold_open_shock': {
        const tSnap = Math.min(t1 - 0.05, t0 + 0.24)
        pushPose(t0, sp, fx + 20, fy + 4, 0.98, 'easeOut')
        pushPose(tSnap, sp, fx - 6, fy, 0.94, 'easeInOut')
        pushPose(t1, sp, fx - 14, fy - 4, 0.91, endEase)
        break
      }
      case 'confused_push': {
        pushPose(t0, sp, fx, fy - 4, 0.97, 'easeInOut')
        pushPose(t1, sp, fx + 6, fy + 6, 0.91, endEase)
        break
      }
      case 'over_shoulder_system': {
        pushPose(t0, sp, fx - 10, fy, 0.98, 'easeInOut')
        pushPose(t1, sp, fx + 12, fy + 6, 0.92, endEase)
        break
      }
      case 'snap_reaction_zoom': {
        const tSnap = Math.min(t1 - 0.06, t0 + 0.16)
        pushPose(t0, sp, fx, fy - 4, 0.98, 'easeOut')
        pushPose(tSnap, sp, fx, fy + 2, 0.92, 'linear')
        pushPose(t1, sp, fx, fy + 6, 0.90, endEase)
        break
      }
      case 'thought_contemplation': {
        pushPose(t0, sp, fx, fy - 10, 0.97, 'easeInOut')
        pushPose(t1, sp, fx, fy + 16, 0.92, endEase)
        break
      }
      case 'low_angle_menace':
      case 'oppressive_low_push': {
        pushPose(t0, sp, fx, fy - 18, 0.97, 'easeInOut')
        pushPose(t1, sp, fx, fy + 16, 0.90, endEase)
        break
      }
      case 'spotlight_pity_pull': {
        pushPose(t0, sp, fx, fy - 8, 0.91, 'easeInOut')
        pushPose(t1, sp, fx, fy, 0.98, endEase)
        break
      }
      case 'rage_punch_shake': {
        const tHit = Math.min(t1 - 0.25, t0 + 0.14)
        pushPose(t0, sp, fx, fy, 0.97, 'easeOut')
        pushPose(tHit, sp, fx + 10, fy - 6, 0.91, 'linear')
        pushPose(tHit + 0.05, sp, fx - 8, fy + 5, 0.91, 'linear')
        pushPose(tHit + 0.10, sp, fx + 6, fy - 4, 0.91, 'linear')
        pushPose(tHit + 0.16, sp, fx - 3, fy + 2, 0.91, 'easeOut')
        pushPose(tHit + 0.22, sp, fx, fy, 0.91, 'linear')
        pushPose(t1, sp, fx, fy + 4, 0.89, endEase)
        break
      }
      case 'confrontation_push': {
        pushPose(t0, sp, fx + 8, fy - 4, 0.97, 'easeInOut')
        pushPose(t1, sp, fx - 28, fy + 8, 0.90, endEase)
        break
      }
      case 'three_plane_escape': {
        pushPose(t0, sp, fx - 14, fy - 10, 0.98, 'easeInOut')
        pushPose(t1, sp, fx + 18, fy + 16, 0.92, endEase)
        break
      }
      case 'foreground_weapon_slam': {
        const tHit = Math.min(t1 - 0.28, t0 + 0.15)
        pushPose(t0, sp, fx - 10, fy + 6, 0.97, 'easeOut')
        pushPose(tHit, sp, fx + 14, fy - 10, 0.91, 'linear')
        pushPose(tHit + 0.05, sp, fx - 11, fy + 8, 0.91, 'linear')
        pushPose(tHit + 0.10, sp, fx + 8, fy - 5, 0.91, 'linear')
        pushPose(tHit + 0.16, sp, fx - 4, fy + 3, 0.91, 'easeOut')
        pushPose(tHit + 0.22, sp, fx, fy, 0.91, 'linear')
        pushPose(t1, sp, fx + 4, fy - 4, 0.90, endEase)
        break
      }
    }
  }

  if (cam.position.keyframes.length > 0) {
    cam.position.value = [...cam.position.keyframes[0].value]
    cam.target.value = [...cam.target.keyframes[0].value]
    cam.focusDistance.value = cam.focusDistance.keyframes[0].value
    cam.fov.value = cam.fov.keyframes[0].value
  }

  return {
    beatsApplied: sorted.length,
    keyframesGenerated: cam.position.keyframes.length
  }
}
