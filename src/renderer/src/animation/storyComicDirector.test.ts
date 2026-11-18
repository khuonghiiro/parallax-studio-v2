import { describe, expect, it } from 'vitest'
import * as factory from '../project/factory'
import { generatePresetSpatialTracks } from './motionPresets'
import {
  applyStoryComicCamera,
  stageStoryComicBeat,
  wrapStorySubtitle,
  type StoryComicBeatSpec
} from './storyComicDirector'
import { useEditor } from '../store/editor'
import { runCommand } from '../mcp/commands'

describe('storyComicDirector & comic motion presets', () => {
  it('wraps long story subtitles cleanly along word boundaries', () => {
    const wrapped = wrapStorySubtitle(
      'XUYÊN KHÔNG VÀO THẾ GIỚI TÂY DU TRỞ THÀNH MỘT TIỂU KHÔ LÂU MỚI RA LÒ.',
      38
    )
    const lines = wrapped.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(40)
    }
  })

  it('generates valid spatial tracks for all 5 comic motion presets', () => {
    const base = {
      position: [0, -40, 120] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      opacity: 1
    }
    const presets = [
      'comic_shiver',
      'system_pop_bounce',
      'comedic_tumble_out',
      'soul_escape_ascend',
      'foreground_weapon_slam'
    ] as const

    for (const preset of presets) {
      const tracks = generatePresetSpatialTracks(preset, base, { time: 1.0, duration: 2.4 })
      const totalKeys =
        tracks.position.length + tracks.rotation.length + tracks.scale.length + tracks.opacity.length
      expect(totalKeys).toBeGreaterThanOrEqual(3)
    }
  })

  it('stages emotion mood backdrops, system quest hologram, emote badges, and outlined subtitles', () => {
    const project = factory.createProject({ name: 'Story Beat Test', duration: 15 })
    const s1 = factory.createShot('Cảnh 1', [0, 0, 0], 0)
    const s2 = factory.createShot('Cảnh 2', [10560, 0, 0], 1)
    project.shots.push(s1, s2)

    const b1: StoryComicBeatSpec = {
      shotId: s1.id,
      start: 0,
      end: 3.2,
      narration: 'Hệ thống đã bắt bạn đi chặn đường Đường Tăng thỉnh kinh.',
      mood: 'world',
      cameraGrammar: 'over_shoulder_system',
      systemQuest: {
        title: '[NHIỆM VỤ HỆ THỐNG]',
        body: 'Chặn đường đoàn đội Đường Tăng!'
      },
      emoteBadge: 'question_giant'
    }

    const b2: StoryComicBeatSpec = {
      shotId: s2.id,
      start: 3.2,
      end: 6.4,
      narration: 'Đi chặn đường đoàn đội Đường Tăng?',
      mood: 'speedlines_radial',
      cameraGrammar: 'low_angle_menace',
      emoteBadge: 'red_eye_flare'
    }

    const r1 = stageStoryComicBeat(project, b1)
    const r2 = stageStoryComicBeat(project, b2)
    expect(r1.createdLayerIds.length).toBe(4) // emote + system panel + system text + subtitle
    expect(r2.createdLayerIds.length).toBe(3) // speedlines backdrop + red_eye_flare + subtitle

    const camRes = applyStoryComicCamera(project, [b1, b2])
    expect(camRes.beatsApplied).toBe(2)
    expect(project.camera.position.keyframes.length).toBeGreaterThanOrEqual(4)

    const holo = project.layers.find((l) => l.type === 'solid' && l.props.pattern === 'hologram_panel')
    expect(holo).toBeDefined()

    const sub = project.layers.find((l) => l.type === 'text' && l.name.startsWith('Phụ đề:'))
    expect(sub).toBeDefined()
    if (sub && sub.type === 'text') {
      expect(sub.props.strokeWidth).toBeGreaterThanOrEqual(5)
      expect(sub.props.glowColor).toBe('#38bdf8')
    }
  })

  it('executes stage_story_beat through the MCP command registry with undo support', async () => {
    const project = factory.createProject({ name: 'MCP Beat Test', duration: 6 })
    const s1 = factory.createShot('Spotlight Beat', [0, 0, 0], 0)
    project.shots.push(s1)
    useEditor.setState({ project })

    const res = (await runCommand('stage_story_beat', {
      shot_id: s1.id,
      start_time: 0,
      end_time: 3.0,
      narration: 'Bắt một bộ xương nhỏ yếu ớt đi làm chuyện đó sao?',
      mood: 'spotlight_stage',
      camera_grammar: 'spotlight_pity_pull',
      clear_existing_camera: true
    })) as { ok: boolean; created_layers: string[]; camera_keyframes: number }

    expect(res.ok).toBe(true)
    expect(res.created_layers.length).toBe(2)
    expect(res.camera_keyframes).toBeGreaterThanOrEqual(2)
  })
})
