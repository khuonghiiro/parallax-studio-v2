import { describe, expect, it, vi } from 'vitest'
import {
  createDefaultMeshEditorState,
  setEditorTool,
  updateBrush,
  updateCurve,
  updateLattice,
  startMeshGestureSession,
  applyMeshGestureDelta,
  commitMeshGestureSession,
  cancelMeshGestureSession
} from './meshEditorState'
import type { Face3D } from '../types'

describe('Phase 4: Workshop Mesh Editor & Soft Deformation Tools', () => {
  describe('MeshEditorState pure logic', () => {
    it('manages active tools and settings with valid defaults', () => {
      let state = createDefaultMeshEditorState()

      expect(state.activeTool).toBe('bend')
      expect(state.brushSettings.radius).toBe(50)
      expect(state.brushSettings.falloff).toBe('smooth')
      expect(state.brushSettings.pinRoot).toBe(true)

      state = setEditorTool(state, 'grab')
      state = updateBrush(state, { radius: 80, strength: 75, falloff: 'sharp' })

      expect(state.activeTool).toBe('grab')
      expect(state.brushSettings.radius).toBe(80)
      expect(state.brushSettings.strength).toBe(75)
      expect(state.brushSettings.falloff).toBe('sharp')

      state = setEditorTool(state, 'curve')
      state = updateCurve(state, { preset: 's-curve', numPoints: 5, tension: 0.8 })

      expect(state.activeTool).toBe('curve')
      expect(state.curveSettings.preset).toBe('s-curve')
      expect(state.curveSettings.numPoints).toBe(5)
      expect(state.curveSettings.tension).toBe(0.8)

      state = setEditorTool(state, 'lattice')
      state = updateLattice(state, { pinnedBottomRow: false, activePointIndex: 5 })

      expect(state.activeTool).toBe('lattice')
      expect(state.latticeSettings.pinnedBottomRow).toBe(false)
      expect(state.latticeSettings.activePointIndex).toBe(5)
    })
  })

  describe('MeshGestureSession logic', () => {
    it('commits single gesture history and safely cancels on Escape', () => {
      const initialFace: Face3D = {
        id: 'face-1',
        name: 'Test Face',
        width: 100,
        height: 200,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        bendY: 10
      }

      // 1. Khởi động gesture session
      let session = startMeshGestureSession(initialFace)
      expect(session.isDragging).toBe(true)
      expect(session.currentPatch).toEqual({})

      // 2. Kéo chuột liên tục (Delta updates trong quá trình kéo)
      const r1 = applyMeshGestureDelta(session, { bendY: 25 })
      session = r1.session
      expect(r1.updatedFace.bendY).toBe(25)

      const r2 = applyMeshGestureDelta(session, { bendLateral: 15 })
      session = r2.session
      expect(r2.updatedFace.bendY).toBe(25)
      expect(r2.updatedFace.bendLateral).toBe(15)

      // 3. Kết thúc gesture (Pointer Up) -> Chỉ sinh 1 commit duy nhất
      const { finalFace, hasChanges } = commitMeshGestureSession(session)
      expect(hasChanges).toBe(true)
      expect(finalFace.bendY).toBe(25)
      expect(finalFace.bendLateral).toBe(15)
      expect(finalFace.id).toBe('face-1')

      // 4. Kiểm tra Hủy gesture (Cancel / Escape) -> Khôi phục snapshot ban đầu
      let session2 = startMeshGestureSession(initialFace)
      const r3 = applyMeshGestureDelta(session2, { bendY: 80, bendLateral: 50 })
      session2 = r3.session
      expect(r3.updatedFace.bendY).toBe(80)

      const restoredFace = cancelMeshGestureSession(session2)
      expect(restoredFace.bendY).toBe(10)
      expect(restoredFace.bendLateral).toBeUndefined()
    })
  })
})
