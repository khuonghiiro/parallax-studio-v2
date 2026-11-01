import { describe, it, expect, beforeEach } from 'vitest'
import { loopAnimatorCommands } from './loopAnimatorCommands'
import { useLoopAnimator } from '../../ui/loopAnimator/loopAnimatorState'
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
      key_color_type: 'chroma_green',
      tolerance: 45
    })
    expect(res.ok).toBe(true)
    expect(res.chroma_config.enabled).toBe(true)
    expect(res.chroma_config.keyColorType).toBe('chroma_green')
    expect(res.chroma_config.tolerance).toBe(45)
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
    expect(frameRes.frame.durationMultiplier).toBe(2)

    const reorderRes = await runCmd('reorder_loop_frames', {
      action: 'reverse'
    })
    expect(reorderRes.ok).toBe(true)
    expect(reorderRes.frames_count).toBe(16)
  })
})
