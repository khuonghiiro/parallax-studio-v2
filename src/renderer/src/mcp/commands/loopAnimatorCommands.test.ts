import { describe, it, expect, beforeEach } from 'vitest'
import { loopAnimatorCommands } from './loopAnimatorCommands'
import { useLoopAnimator } from '../../ui/loopAnimator/loopAnimatorState'
import {
  applyChromaKeyToImageData,
  buildGridFrames,
  clearGridBorderPadding
} from '../../ui/loopAnimator/loopFrameExtractor'
import { useView } from '../../store/view'

const runCmd = async (name: keyof typeof loopAnimatorCommands, params: Record<string, unknown> = {}) => {
  return (await loopAnimatorCommands[name](params, { reqId: 't', method: name, params })) as Record<string, any>
}

describe('loopAnimatorCommands', () => {
  beforeEach(() => {
    useView.setState({ dialog: null })
    useLoopAnimator.getState().close()
  })

  it('opens and closes loop animator', async () => {
    const openRes = await runCmd('open_loop_animator', { preset_id: 'campfire_transparent' })
    expect(openRes.ok).toBe(true)
    expect(openRes.is_open).toBe(true)
    expect(openRes.frames_count).toBe(16)
    expect(useView.getState().dialog).toBe('loop_animator')

    const closeRes = await runCmd('close_loop_animator')
    expect(closeRes.ok).toBe(true)
    expect(closeRes.is_open).toBe(false)
    expect(useView.getState().dialog).toBeNull()
  })

  it('inspects state via get_loop_animator_state', async () => {
    await runCmd('open_loop_animator', { preset_id: 'campfire_chroma' })
    const state = await runCmd('get_loop_animator_state')
    expect(state.ok).toBe(true)
    expect(state.is_open).toBe(true)
    expect(state.chroma_config.enabled).toBe(true)
    expect(state.frames).toHaveLength(16)
  })

  it('configures chroma key parameters', async () => {
    await runCmd('open_loop_animator', { preset_id: 'campfire_transparent' })
    const res = await runCmd('configure_loop_chroma', {
      enabled: true,
      key_color: '#00ff00',
      tolerance: 0.45
    })
    expect(res.ok).toBe(true)
    expect(res.chroma_config.enabled).toBe(true)
    expect(res.chroma_config.keyColor).toBe('#00ff00')
    expect(res.chroma_config.similarity).toBe(0.45)
  })

  it('splits frames and updates playback', async () => {
    await runCmd('open_loop_animator')
    const splitRes = await runCmd('split_loop_frames', {
      rows: 2,
      cols: 3,
      order: 'row_first'
    })
    expect(splitRes.ok).toBe(true)
    expect(splitRes.frames_count).toBe(6)

    const playRes = await runCmd('set_loop_playback', {
      fps: 24,
      loop_mode: 'ping-pong',
      is_playing: true
    })
    expect(playRes.ok).toBe(true)
    expect(playRes.playback.fps).toBe(24)
    expect(playRes.playback.loopMode).toBe('ping-pong')
    expect(playRes.playback.isPlaying).toBe(true)
  })

  it('reorders and updates individual frames', async () => {
    await runCmd('open_loop_animator', { preset_id: 'campfire_transparent' })
    const frameRes = await runCmd('update_loop_frame', {
      frame_index: 0,
      enabled: false,
      duration_multiplier: 2
    })
    expect(frameRes.ok).toBe(true)
    expect(frameRes.frame.enabled).toBe(false)
    expect(frameRes.frame.durationRatio).toBe(2)

    const reorderRes = await runCmd('reorder_loop_frames', {
      action: 'reverse'
    })
    expect(reorderRes.ok).toBe(true)
    expect(reorderRes.frames_count).toBe(16)
  })

  it('strips grid border padding and configures shadow extraction mode', async () => {
    await runCmd('open_loop_animator')
    const splitRes = await runCmd('split_loop_frames', {
      mode: 'grid',
      rows: 4,
      cols: 4,
      border_padding: 6
    })
    expect(splitRes.ok).toBe(true)
    expect(splitRes.grid_config.borderPadding).toBe(6)

    const frames = buildGridFrames(1024, 1024, splitRes.grid_config)
    expect(frames).toHaveLength(16)
    expect(frames[0].x).toBe(6)
    expect(frames[0].y).toBe(6)
    expect(frames[0].width).toBe(244)
    expect(frames[0].height).toBe(244)

    // Verify clearGridBorderPadding zeroes out pixels on outer and internal grid lines
    const w = 64
    const h = 64
    const buf = new Uint8ClampedArray(w * h * 4)
    buf.fill(255)
    const imgData = { data: buf, width: w, height: h } as unknown as ImageData
    clearGridBorderPadding(imgData, {
      cols: 2,
      rows: 2,
      marginX: 0,
      marginY: 0,
      paddingX: 0,
      paddingY: 0,
      borderPadding: 4
    })
    // Outer border pixel (1, 1) -> transparent
    expect(buf[(1 * w + 1) * 4 + 3]).toBe(0)
    // Internal grid divider pixel (32, 16) -> transparent
    expect(buf[(16 * w + 32) * 4 + 3]).toBe(0)
    // Interior cell pixel (16, 16) -> opaque
    expect(buf[(16 * w + 16) * 4 + 3]).toBe(255)

    const chromaRes = await runCmd('configure_loop_chroma', {
      enabled: true,
      key_color_type: 'chroma_green',
      tolerance: 36,
      shadow_mode: 'include',
      shadow_type: 'auto',
      shadow_retention: 72,
      shadow_solid_threshold: 62,
      shadow_unmix_color: true
    })
    expect(chromaRes.ok).toBe(true)
    expect(chromaRes.chroma_config.shadowMode).toBe('include')
    expect(chromaRes.chroma_config.shadowRetention).toBe(72)

    // Verify semi-transparent glow extraction via applyChromaKeyToImageData
    const gw = 16
    const gh = 16
    const gBuf = new Uint8ClampedArray(gw * gh * 4)
    for (let p = 0; p < gw * gh; p++) {
      gBuf[p * 4] = 10
      gBuf[p * 4 + 1] = 248
      gBuf[p * 4 + 2] = 4
      gBuf[p * 4 + 3] = 255
    }
    // Center pixel: 50% white glow over green (#0AF804)
    const cp = 8 * gw + 8
    gBuf[cp * 4] = 133
    gBuf[cp * 4 + 1] = 252
    gBuf[cp * 4 + 2] = 130
    applyChromaKeyToImageData(
      { data: gBuf, width: gw, height: gh } as unknown as ImageData,
      chromaRes.chroma_config
    )
    expect(gBuf[3]).toBe(0)
    expect(gBuf[cp * 4 + 3]).toBeGreaterThan(60)
    expect(gBuf[cp * 4 + 3]).toBeLessThan(220)
  })
})
