import { describe, expect, it } from 'vitest'
import type { LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction } from './workshopBoneDrag'
import { createWorkshopHistory } from './workshopHistory'

const rig: LayerRig = {
  duration: 2,
  loop: true,
  bones: [
    { id: 'root', name: 'Root', x: 0, y: 0, length: 50, angle: 0 },
    { id: 'child', name: 'Child', parentId: 'root', x: 50, y: 0, length: 40, angle: 0 }
  ],
  tracks: {
    root: [{ time: 0, x: 0, y: 0, rotation: 90, easing: 'linear' }],
    child: [{ time: 0, x: 10, y: 20, rotation: 5, easing: 'hold' }]
  }
}

describe('bone pose gestures', () => {
  it('adds displacement in parent coordinates without resetting existing translation', () => {
    const drag = startBoneDrag(rig, 'child', 0, false, 'head', { x: -18, y: 62 })
    const action = boneDragAction(drag, { x: -8, y: 82 }, false)
    expect(action.action).toBe('set-key')
    if (action.action === 'set-key') {
      expect(action.key.x).toBeCloseTo(30)
      expect(action.key.y).toBeCloseTo(10)
      expect(action.key.rotation).toBeUndefined()
    }
  })

  it('restores pose and redo history on Escape cancellation', () => {
    const initial: LayerComposite = {
      id: 'test',
      name: 'Initial',
      category: 'character',
      width: 500,
      height: 600,
      layers: [],
      rig
    }
    const history = createWorkshopHistory(initial)
    history.update({ ...initial, name: 'Next' })
    history.undo()
    history.begin()
    history.update({ ...initial, name: 'Dragging' })
    history.cancel()
    expect(history.current).toEqual(initial)
    expect(history.canUndo).toBe(false)
    history.redo()
    expect(history.current.name).toBe('Next')
  })

  it('keeps connected parent tail and child head welded during Frame-0 bone editing unless Alt is pressed', () => {
    // Kéo ngọn xương cha tới (60, 20): tự động dời khớp gốc xương con tới (60, 20) và hướng lại xương con về mũi cũ (90, 0)
    const dragTail = startBoneDrag(rig, 'root', 0, true, 'tail', { x: 50, y: 0 })
    const weldedTailAction = boneDragAction(dragTail, { x: 60, y: 20 }, false, false)
    expect(weldedTailAction.action).toBe('update-bones')
    if (weldedTailAction.action === 'update-bones') {
      const childPatch = weldedTailAction.patches.find((p) => p.boneId === 'child')?.patch
      expect(childPatch?.x).toBeCloseTo(60, 1)
      expect(childPatch?.y).toBeCloseTo(20, 1)
    }

    // Giữ Alt khi kéo ngọn sẽ tách rời khớp (chỉ sửa xương cha)
    const detachedTailAction = boneDragAction(dragTail, { x: 60, y: 20 }, false, true)
    expect(detachedTailAction.action).toBe('update-bone')

    // Kéo khớp gốc xương con tới (50, 30): xương cha tự động xoay và co giãn để hàn khít tới (50, 30)
    const dragChildHead = startBoneDrag(rig, 'child', 0, true, 'head', { x: 50, y: 0 })
    const weldedHeadAction = boneDragAction(dragChildHead, { x: 50, y: 30 }, false, false)
    expect(weldedHeadAction.action).toBe('update-bones')
    if (weldedHeadAction.action === 'update-bones') {
      const parentPatch = weldedHeadAction.patches.find((p) => p.boneId === 'root')?.patch
      expect(parentPatch?.length).toBeCloseTo(Math.hypot(50, 30), 1)
    }
  })

  it('cho phép kéo xương Đầu / Thân theo cả 4 hướng: sang Trái/Phải để xoay nghiêng và Lên/Xuống để gật/nhún', () => {
    const charRig: LayerRig = {
      duration: 2,
      loop: true,
      bones: [
        { id: 'torso', name: 'Thân', x: 0, y: -120, length: 240, angle: 90 },
        { id: 'head', name: 'Đầu', parentId: 'torso', x: 0, y: -160, length: 110, angle: -90 }
      ],
      tracks: {}
    }
    // Kéo xương Đầu thẳng xuống dưới (+24px Y) dọc theo trục xương
    const dragDown = startBoneDrag(charRig, 'head', 0, false, 'rotate', { x: 0, y: -230 })
    const actDown = boneDragAction(dragDown, { x: 0, y: -206 }, false)
    expect(actDown.action).toBe('set-key')
    if (actDown.action === 'set-key') {
      expect(actDown.key.y).toBeCloseTo(24, 1)
    }

    // Kéo xương Đầu thẳng lên trên (-20px Y) dọc theo trục xương
    const actUp = boneDragAction(dragDown, { x: 0, y: -250 }, false)
    expect(actUp.action).toBe('set-key')
    if (actUp.action === 'set-key') {
      expect(actUp.key.y).toBeCloseTo(-20, 1)
    }
  })
})
