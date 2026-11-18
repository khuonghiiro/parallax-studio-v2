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

    // Đảm bảo mọi icon trong thanh công cụ đều duy nhất, không trùng lặp
    const uniqueIcons = new Set(buttons.map((b) => b.icon))
    expect(uniqueIcons.size).toBe(buttons.length)

    const freeDrawBtn = buttons.find((b) => b.id === 'motion-tool-free-draw')!
    expect(freeDrawBtn.icon).toBe('free_draw')
    freeDrawBtn.click()
    expect(onSwitchToFreeDraw).toHaveBeenCalledTimes(1)
  })

  it('highlights free-draw tool in path mode and provides 1-click button back to BBox #1->#2', () => {
    const onSwitchToBboxMode = vi.fn()
    const buttons = buildMotionStageToolButtons({
      mode: 'path',
      tool: 'draw',
      hasCustomCurve: false,
      bboxRotateGimbal: false,
      hasToolbarHost: true,
      playing: false,
      onPickTool: vi.fn(),
      onSwitchToFreeDraw: vi.fn(),
      onSwitchToBboxMode,
      onClearCurve: vi.fn(),
      onToggleGimbal: vi.fn(),
      onTogglePlay: vi.fn()
    })

    const freeDrawBtn = buttons.find((b) => b.id === 'motion-tool-free-draw')!
    expect(freeDrawBtn.active).toBe(true)

    const backToBboxBtn = buttons.find((b) => b.id === 'motion-tool-bbox-mode')!
    expect(backToBboxBtn.icon).toBe('target')
    backToBboxBtn.click()
    expect(onSwitchToBboxMode).toHaveBeenCalledTimes(1)
  })
})
