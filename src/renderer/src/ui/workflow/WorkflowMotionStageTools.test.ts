import { describe, expect, it, vi } from 'vitest'
import { buildMotionStageToolButtons } from './WorkflowMotionStageTools'

describe('buildMotionStageToolButtons (workflow_motion_tools)', () => {
  it('exposes the free-draw icon button directly inside bbox mode and triggers switch to freehand path', () => {
    const onSwitchToFreeDraw = vi.fn()
    const buttons = buildMotionStageToolButtons({
      mode: 'bbox',
      tool: 'select',
      hasCustomCurve: true,
      bboxRotateGimbal: false,
      hasToolbarHost: true,
      playing: false,
      onPickTool: vi.fn(),
      onSwitchToFreeDraw,
      onSwitchToBboxMode: vi.fn(),
      onClearCurve: vi.fn(),
      onToggleGimbal: vi.fn(),
      onTogglePlay: vi.fn()
    })

    const ids = buttons.map((b) => b.id)
    expect(ids).toEqual([
      'motion-tool-select',
      'motion-tool-bbox-curve',
      'motion-tool-free-draw',
      'motion-tool-clear',
      'motion-tool-gimbal'
    ])

    const uniqueIcons = new Set(buttons.map((b) => b.icon))
    expect(uniqueIcons.size).toBe(buttons.length)

    const freeDrawBtn = buttons.find((b) => b.id === 'motion-tool-free-draw')!
    expect(freeDrawBtn.icon).toBe('free_draw')
    freeDrawBtn.click()
    expect(onSwitchToFreeDraw).toHaveBeenCalledTimes(1)
  })

  it('enables Gimbal 3D and Clear tools in path mode once a freehand path is drawn', () => {
    const onSwitchToBboxMode = vi.fn()
    const onToggleGimbal = vi.fn()
    const buttons = buildMotionStageToolButtons({
      mode: 'path',
      tool: 'select',
      hasCustomCurve: true,
      bboxRotateGimbal: true,
      hasToolbarHost: true,
      playing: false,
      onPickTool: vi.fn(),
      onSwitchToFreeDraw: vi.fn(),
      onSwitchToBboxMode,
      onClearCurve: vi.fn(),
      onToggleGimbal,
      onTogglePlay: vi.fn()
    })

    expect(buttons.map((b) => b.id)).toEqual([
      'motion-tool-select',
      'motion-tool-free-draw',
      'motion-tool-straight-line',
      'motion-tool-bbox-mode',
      'motion-tool-clear',
      'motion-tool-gimbal'
    ])

    const gimbalBtn = buttons.find((b) => b.id === 'motion-tool-gimbal')!
    expect(gimbalBtn.active).toBe(true)
    gimbalBtn.click()
    expect(onToggleGimbal).toHaveBeenCalledTimes(1)
  })
})
