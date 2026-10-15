import type React from 'react'
import { nanoid } from 'nanoid'
import type { Project } from '@shared/types'
import {
  applyStageFrameToDraft,
  clampCameraAngle,
  clampFrameScale,
  findNearestShotByStage2D,
  type CameraFrame2D,
  type ShotStageBox
} from './animateCameraMath'
import { updateCameraWaypoint } from './animateCameraRouteLogic'
import { useEditor } from '../../../store/editor'

interface UseCameraStageDragParams {
  compWidth: number
  compHeight: number
  zoom: number
  stageLayout: ShotStageBox[]
  stageRef: React.RefObject<HTMLDivElement | null>
  stageToScreen: (sx: number, sy: number) => { x: number; y: number }
  setPlaying: (playing: boolean) => void
  setTime: (time: number) => void
  setSnapGuide: (guide: { x: number | null; y: number | null }) => void
  update: (fn: (draft: Project) => void, mergeKey?: string) => void
}

export function useCameraStageDrag({
  compWidth,
  compHeight,
  zoom,
  stageLayout,
  stageRef,
  stageToScreen,
  setPlaying,
  setTime,
  setSnapGuide,
  update
}: UseCameraStageDragParams) {
  // 1. Kéo di chuyển vị trí Khung Camera (có bắt dính từ tính vào tâm Cảnh)
  const startFrameMoveDrag = (e: React.PointerEvent, frame: CameraFrame2D): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)
    const initShot =
      frame.shotId ?? findNearestShotByStage2D(stageLayout, frame.stageX, frame.stageY)?.shotId ?? null
    if (initShot) {
      useEditor.getState().selectShot(initShot)
    }

    const startClientX = e.clientX
    const startClientY = e.clientY
    const origStageX = frame.stageX
    const origStageY = frame.stageY
    const frameTime = frame.time
    const mergeKey = `anim2d-move-${nanoid(6)}`
    let lastX = origStageX
    let lastY = origStageY

    const onMove = (pev: PointerEvent): void => {
      const dxScreen = pev.clientX - startClientX
      const dyScreen = pev.clientY - startClientY
      let nextX = Math.round(origStageX + dxScreen / zoom)
      let nextY = Math.round(origStageY + dyScreen / zoom)

      let snappedX: number | null = null
      let snappedY: number | null = null

      if (pev.shiftKey) {
        if (Math.abs(dxScreen) >= Math.abs(dyScreen)) nextY = origStageY
        else nextX = origStageX
      } else {
        const nearestShot = findNearestShotByStage2D(stageLayout, nextX, nextY)
        const snapThreshStage = Math.max(12, 10 / zoom)
        if (Math.abs(nextX - nearestShot.stageX) <= snapThreshStage) {
          nextX = nearestShot.stageX
          snappedX = nearestShot.stageX
        }
        if (Math.abs(nextY - nearestShot.stageY) <= snapThreshStage) {
          nextY = nearestShot.stageY
          snappedY = nearestShot.stageY
        }
      }

      lastX = nextX
      lastY = nextY
      setSnapGuide({ x: snappedX, y: snappedY })
      update((d) => {
        applyStageFrameToDraft(d, stageLayout, frameTime, nextX, nextY, frame.scale, frame.isKeyframed, {
          yaw: frame.yaw,
          pitch: frame.pitch,
          roll: frame.roll,
          ease: frame.ease
        })
      }, mergeKey)
    }

    const onUp = (): void => {
      setSnapGuide({ x: null, y: null })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const finalShot = findNearestShotByStage2D(stageLayout, lastX, lastY)?.shotId ?? null
      if (finalShot) {
        useEditor.getState().selectShot(finalShot)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 2. Kéo 8 điểm mút co dãn Khung Camera (bám sát con trỏ 1:1)
  const startFrameResizeDrag = (
    e: React.PointerEvent,
    frame: CameraFrame2D,
    sxSign: number,
    sySign: number
  ): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)

    const startClientX = e.clientX
    const startClientY = e.clientY
    const origScale = frame.scale
    const frameTime = frame.time
    const mergeKey = `anim2d-scale-${nanoid(6)}`

    const onMove = (pev: PointerEvent): void => {
      const dxStage = (pev.clientX - startClientX) / zoom
      const dyStage = (pev.clientY - startClientY) / zoom
      let deltaScale = 0
      if (sxSign !== 0 && sySign !== 0) {
        const dw = dxStage * sxSign * 2
        const dh = dyStage * sySign * 2
        deltaScale = (dw / compWidth + dh / compHeight) / 2
      } else if (sxSign !== 0) {
        deltaScale = (dxStage * sxSign * 2) / compWidth
      } else {
        deltaScale = (dyStage * sySign * 2) / compHeight
      }
      const nextScale = clampFrameScale(Math.round((origScale + deltaScale) * 100) / 100)
      update((d) => {
        applyStageFrameToDraft(d, stageLayout, frameTime, frame.stageX, frame.stageY, nextScale, frame.isKeyframed, {
          yaw: frame.yaw,
          pitch: frame.pitch,
          roll: frame.roll,
          ease: frame.ease
        })
      }, mergeKey)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 3. Kéo tay nắm Xoay nghiêng máy (Camera Roll / Dutch Angle)
  const startFrameRotateDrag = (e: React.PointerEvent, frame: CameraFrame2D): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)

    const el = stageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const centerScreen = stageToScreen(frame.stageX, frame.stageY)
    const cx = rect.left + centerScreen.x
    const cy = rect.top + centerScreen.y
    const frameTime = frame.time
    const mergeKey = `anim2d-roll-${nanoid(6)}`

    const onMove = (pev: PointerEvent): void => {
      const rad = Math.atan2(pev.clientY - cy, pev.clientX - cx)
      let deg = Math.round(((rad * 180) / Math.PI + 90) * 10) / 10
      if (deg > 180) deg -= 360
      if (deg < -180) deg += 360
      if (pev.shiftKey) {
        deg = Math.round(deg / 15) * 15
      } else if (Math.abs(deg) <= 2.5) {
        deg = 0
      }
      update((d) => {
        updateCameraWaypoint(d, stageLayout, frameTime, { roll: deg })
      }, mergeKey)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // 4. Kéo xoay góc 3D (Orbit Yaw & Pitch) trực tiếp trên Khung Camera
  const startFrameOrbit3DDrag = (e: React.PointerEvent, frame: CameraFrame2D): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setPlaying(false)
    setTime(frame.time)

    const startX = e.clientX
    const startY = e.clientY
    const origYaw = frame.yaw
    const origPitch = frame.pitch
    const frameTime = frame.time
    const mergeKey = `anim2d-orbit-${nanoid(6)}`

    const onMove = (pev: PointerEvent): void => {
      const dx = pev.clientX - startX
      const dy = pev.clientY - startY
      const nextYaw = clampCameraAngle(Math.round((origYaw + dx * 0.25) * 2) / 2, -75, 75)
      const nextPitch = clampCameraAngle(Math.round((origPitch - dy * 0.22) * 2) / 2, -65, 65)
      update((d) => {
        updateCameraWaypoint(d, stageLayout, frameTime, { yaw: nextYaw, pitch: nextPitch })
      }, mergeKey)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    startFrameMoveDrag,
    startFrameResizeDrag,
    startFrameRotateDrag,
    startFrameOrbit3DDrag
  }
}
