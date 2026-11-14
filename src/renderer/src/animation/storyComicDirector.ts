import type { Layer, Project, SolidLayer, SolidPattern, TextLayer, Vec3 } from '@shared/types'
import * as factory from '../project/factory'
import {
  choreographCinematicCameraRoute,
  type CinematicCameraBeat,
  type ShotTransitionStyle
} from './cinematicCameraRoute'
import { generatePresetSpatialTracks } from './motionPresets'

export type StoryMoodBackdrop =
  | 'world'
  | 'question_sky'
  | 'speedlines_radial'
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
  spotlight_stage: { color: '#3b3e45', color2: '#1d2026', label: 'Nền Tâm Lý · Đèn Spotlight Bi Kịch' },
  anger_veins: { color: '#be123c', color2: '#fb7185', label: 'Nền Tâm Lý · Nổi Điên (💢)' },
  comic_burst: { color: '#fde047', color2: '#ef4444', label: 'Nền Tâm Lý · Bùng Nổ Cao Trào' }
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

function insertBeatBackdrop(project: Project, shotId: string, mood: Exclude<StoryMoodBackdrop, 'world'>, start: number, end: number): SolidLayer {
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
    width: Math.round(project.comp.width * 1.28),
    height: Math.round(project.comp.height * 1.28)
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
    question_giant: { symbol: '?', size: 280, color: '#facc15', stroke: '#78350f', glow: '#fde047', defaultPos: [95, 50, 260] },
    anger_cross: { symbol: '💢', size: 130, color: '#ef4444', stroke: '#450a0a', glow: '#fb7185', defaultPos: [185, 165, 60] },
    sweat_drop: { symbol: '💧', size: 88, color: '#7dd3fc', stroke: '#0c4a6e', glow: '#38bdf8', defaultPos: [110, 140, 40] },
    red_eye_flare: { symbol: '✦━━', size: 78, color: '#ff1e42', stroke: '#ff0033', glow: '#ff1e42', defaultPos: [-125, 138, 35] }
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
    layer.transform.rotation.value = [0, 0, -24]
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
    strokeWidth: 7,
    glowColor: c.glow
  }
  const pop = generatePresetSpatialTracks(
    'system_pop_bounce',
    { position: targetPos, rotation: layer.transform.rotation.value, scale: [1, 1, 1], opacity: 1 },
    { time: start, duration: Math.max(0.35, end - start) }
  )
  layer.transform.scale.keyframes = pop.scale
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
      return { ...base, kind: 'punch_zoom', startScale: 1.02, impactScale: 0.78, endScale: 0.94, impactRatio: 0.28, hitstopSec: 0.1, impactShakePx: 14, rollImpact: -2.2 } as CinematicCameraBeat
    case 'over_shoulder_system':
      return { ...base, kind: 'establish_corridor', startScale: 1.0, endScale: 0.92, yawStart: -3, yawEnd: 2 } as CinematicCameraBeat
    case 'snap_reaction_zoom':
      return { ...base, kind: 'punch_zoom', startScale: 0.98, impactScale: 0.74, endScale: 0.76, impactRatio: 0.2, hitstopSec: 0.14, impactShakePx: 9, rollImpact: 1.5 } as CinematicCameraBeat
    case 'low_angle_menace':
      return { ...base, kind: 'hero_low_ascent', startScale: 0.96, endScale: 0.84, pitchStart: -12, pitchEnd: -6, yawStart: -2, yawEnd: 2 } as CinematicCameraBeat
    case 'spotlight_pity_pull':
      return { ...base, kind: 'crane_rise', startScale: 0.82, endScale: 0.98, pitchStart: 4, pitchEnd: 10, yawStart: 0, yawEnd: 0 } as CinematicCameraBeat
    case 'rage_punch_shake':
      return { ...base, kind: 'punch_zoom', startScale: 0.94, impactScale: 0.68, endScale: 0.74, impactRatio: 0.24, hitstopSec: 0.16, impactShakePx: 18, rollImpact: -3.2 } as CinematicCameraBeat
    case 'confrontation_push':
      return { ...base, kind: 'establish_corridor', startScale: 0.98, endScale: 0.78, yawStart: -2, yawEnd: 3, pitchStart: -2, pitchEnd: 0 } as CinematicCameraBeat
    case 'three_plane_escape':
      return { ...base, kind: 'orbit_parallax', startScale: 0.96, endScale: 1.02, yawStart: -6, yawEnd: 7, pitchStart: 3, pitchEnd: -2 } as CinematicCameraBeat
    case 'foreground_weapon_slam':
      return { ...base, kind: 'punch_zoom', startScale: 0.96, impactScale: 0.72, endScale: 0.88, impactRatio: 0.25, hitstopSec: 0.18, impactShakePx: 22, rollImpact: -4 } as CinematicCameraBeat
    case 'confused_push':
    default:
      return { ...base, kind: 'establish_corridor', startScale: 0.98, endScale: 0.88, yawStart: 2, yawEnd: -2, pitchStart: 0, pitchEnd: 0 } as CinematicCameraBeat
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
    const minScale = Math.min(cameraBeat.startScale ?? 1, cameraBeat.endScale ?? 1, cameraBeat.impactScale ?? 1)
    const safeScale = Math.max(0.64, Math.min(0.95, minScale * 0.94))
    const subText = wrapStorySubtitle(spec.narration.toUpperCase(), 40)
    const sub = factory.createTextLayer(project.comp, subText)
    sub.name = `Phụ đề: ${spec.narration.slice(0, 26)}`
    sub.inPoint = Number((spec.start + 0.03).toFixed(3))
    sub.outPoint = Number(Math.max(sub.inPoint + 0.2, spec.end - 0.03).toFixed(3))
    sub.fadeIn = 0.06
    sub.fadeOut = 0.06
    sub.autoScale = false
    const fx = spec.focusOffset?.[0] ?? 0
    const fy = spec.focusOffset?.[1] ?? 0
    sub.transform.position.value = [fx, Math.round(fy - 390 * safeScale), -35]
    sub.transform.scale.value = [safeScale, safeScale, 1]
    sub.props = {
      text: subText,
      fontFamily: 'Montserrat',
      fontSize: 34,
      fontWeight: 900,
      color: '#ffffff',
      letterSpacing: 1,
      shadow: true,
      strokeColor: '#0a3d6e',
      strokeWidth: 6,
      glowColor: '#38bdf8'
    }
    insertBeatLayerTop(project, spec.shotId, sub)
    createdLayerIds.push(sub.id)
  }

  return { shotId: spec.shotId, createdLayerIds, cameraBeat }
}

export function applyStoryComicCamera(project: Project, specs: StoryComicBeatSpec[]) {
  const beats = specs.map((s) => toCinematicBeatFromStoryGrammar(s))
  return choreographCinematicCameraRoute(project, beats, { clearExisting: true })
}
