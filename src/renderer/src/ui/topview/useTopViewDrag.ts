import { useState } from 'react'
import { nanoid } from 'nanoid'
import * as THREE from 'three'
import type { Vec3 } from '@shared/types'
import { evaluate, setValueAt } from '../../animation/keyframes'
import { evaluateScene } from '../../engine/evaluateScene'
import { depthToThree, threeToDepth } from '../../engine/spatial'
import { frameTolerance, useEditor } from '../../store/editor'
import {
  computeRotatedTarget,
  computeRotatedTargetSide,
  computeTranslatedCamera,
  computeTranslatedCameraSide,
  computeTranslatedLayer,
  computeTranslatedLayerSide
} from '../topViewCameraMath'

export type CamDragMode = 'none' | 'pos' | 'aim' | 'target' | 'layer'

interface UseTopViewDragOptions {
  shotId: string | null
  viewMode?: 'top' | 'side'
  unx: (px: number) => number
  unz: (py: number) => number
  unSideZ?: (px: number) => number
  unSideY?: (py: number) => number
}

export function useTopViewDrag({
  shotId,
  viewMode = 'top',
  unx,
  unz,
  unSideZ,
  unSideY
}: UseTopViewDragOptions) {
  const [dragMode, setDragMode] = useState<CamDragMode>('none')
  const [hudText, setHudText] = useState<string | null>(null)
  const isSide = viewMode === 'side' && Boolean(unSideZ && unSideY)

  const startLayerDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const st = useEditor.getState()
    st.selectLayer(id)
    const layer = st.project.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return

    const startPos = evaluate(layer.transform.position, st.time) as Vec3
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `layerdrag-${nanoid(6)}`
    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top

    const startMouse1 = isSide ? unSideZ!(startX) : unx(startX)
    const startMouse2 = isSide ? unSideY!(startY) : unz(startY)

    setDragMode('layer')

    const move = (ev2: PointerEvent) => {
      const s = useEditor.getState()
      const curX = ev2.clientX - rect.left
      const curY = ev2.clientY - rect.top
      const curMouse1 = isSide ? unSideZ!(curX) : unx(curX)
      const curMouse2 = isSide ? unSideY!(curY) : unz(curY)
      const delta1 = curMouse1 - startMouse1
      const delta2 = curMouse2 - startMouse2

      if (isSide) {
        const newPos = computeTranslatedLayerSide(startPos, delta1, delta2, ev2.shiftKey, ev2.altKey ? 50 : 0)
        setHudText(`Y: ${Math.round(newPos[1])} · Z: ${Math.round(newPos[2])}`)
        s.update((d) => {
          const l = d.layers.find((x) => x.id === id)
          if (l) setValueAt(l.transform.position, s.time, [startPos[0], newPos[1], newPos[2]], frameTolerance(s.project))
        }, key)
      } else {
        const newPos = computeTranslatedLayer(startPos, delta1, delta2, ev2.shiftKey, ev2.altKey ? 50 : 0)
        setHudText(`X: ${Math.round(newPos[0])} · Z: ${Math.round(newPos[2])}`)
        s.update((d) => {
          const l = d.layers.find((x) => x.id === id)
          if (l) setValueAt(l.transform.position, s.time, [newPos[0], startPos[1], newPos[2]], frameTolerance(s.project))
        }, key)
      }
    }

    const up = () => {
      setDragMode('none')
      setHudText(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startCamPosDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    const st = useEditor.getState()
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `campos-${nanoid(6)}`

    const curEv = evaluateScene(st.project, st.time)
    const curShot = shotId ? curEv.shots.find((s) => s.shot.id === shotId) : undefined
    const curInv = curShot ? curShot.matrix.clone().invert() : new THREE.Matrix4()
    const curMat = curShot ? curShot.matrix : new THREE.Matrix4()
    const localP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curInv))
    const worldP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curMat))

    const initLocalCam = localP(curEv.camera.position)
    const initLocalTarget = localP(curEv.camera.target)
    const startMouse1 = isSide ? unSideZ!(e.clientX - rect.left) : unx(e.clientX - rect.left)
    const startMouse2 = isSide ? unSideY!(e.clientY - rect.top) : unz(e.clientY - rect.top)

    setDragMode(e.altKey ? 'aim' : 'pos')

    const move = (pev: PointerEvent) => {
      const s = useEditor.getState()
      const tol = frameTolerance(s.project)
      const curMouse1 = isSide ? unSideZ!(pev.clientX - rect.left) : unx(pev.clientX - rect.left)
      const curMouse2 = isSide ? unSideY!(pev.clientY - rect.top) : unz(pev.clientY - rect.top)

      if (pev.altKey) {
        const newLocalTarget = isSide
          ? computeRotatedTargetSide(initLocalCam, initLocalTarget, [curMouse1, curMouse2])
          : computeRotatedTarget(initLocalCam, initLocalTarget, [curMouse1, curMouse2])
        const newWorldTarget = worldP(newLocalTarget)
        s.update((d) => {
          setValueAt(d.camera.target, s.time, newWorldTarget, tol)
        }, key)
      } else {
        const delta1 = curMouse1 - startMouse1
        const delta2 = curMouse2 - startMouse2
        if (isSide) {
          const { camPos: nextCam, target: nextTarget } = computeTranslatedCameraSide(
            initLocalCam,
            initLocalTarget,
            delta1,
            delta2,
            pev.shiftKey
          )
          setHudText(`Cam: [Y: ${Math.round(nextCam[1])}, Z: ${Math.round(nextCam[2])}]`)
          s.update((d) => {
            setValueAt(d.camera.position, s.time, worldP(nextCam), tol)
            setValueAt(d.camera.target, s.time, worldP(nextTarget), tol)
          }, key)
        } else {
          const { camPos: nextCam, target: nextTarget } = computeTranslatedCamera(
            initLocalCam,
            initLocalTarget,
            delta1,
            delta2,
            pev.shiftKey
          )
          setHudText(`Cam: [${Math.round(nextCam[0])}, ${Math.round(nextCam[2])}]`)
          s.update((d) => {
            setValueAt(d.camera.position, s.time, worldP(nextCam), tol)
            setValueAt(d.camera.target, s.time, worldP(nextTarget), tol)
          }, key)
        }
      }
    }

    const up = () => {
      setDragMode('none')
      setHudText(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startCamAngleDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    const st = useEditor.getState()
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `camangle-${nanoid(6)}`

    const curEv = evaluateScene(st.project, st.time)
    const curShot = shotId ? curEv.shots.find((s) => s.shot.id === shotId) : undefined
    const curInv = curShot ? curShot.matrix.clone().invert() : new THREE.Matrix4()
    const curMat = curShot ? curShot.matrix : new THREE.Matrix4()
    const localP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curInv))
    const worldP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curMat))

    const initLocalCam = localP(curEv.camera.position)
    const initLocalTarget = localP(curEv.camera.target)

    setDragMode('aim')

    const move = (pev: PointerEvent) => {
      const s = useEditor.getState()
      const tol = frameTolerance(s.project)
      const curMouse1 = isSide ? unSideZ!(pev.clientX - rect.left) : unx(pev.clientX - rect.left)
      const curMouse2 = isSide ? unSideY!(pev.clientY - rect.top) : unz(pev.clientY - rect.top)

      const newLocalTarget = isSide
        ? computeRotatedTargetSide(initLocalCam, initLocalTarget, [curMouse1, curMouse2])
        : computeRotatedTarget(initLocalCam, initLocalTarget, [curMouse1, curMouse2])
      s.update((d) => {
        setValueAt(d.camera.target, s.time, worldP(newLocalTarget), tol)
      }, key)
    }

    const up = () => {
      setDragMode('none')
      setHudText(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startCamTargetDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    const st = useEditor.getState()
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `camtarget-${nanoid(6)}`

    const curEv = evaluateScene(st.project, st.time)
    const curShot = shotId ? curEv.shots.find((s) => s.shot.id === shotId) : undefined
    const curInv = curShot ? curShot.matrix.clone().invert() : new THREE.Matrix4()
    const curMat = curShot ? curShot.matrix : new THREE.Matrix4()
    const localP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curInv))
    const worldP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curMat))

    const initLocalTarget = localP(curEv.camera.target)
    setDragMode('target')

    const move = (pev: PointerEvent) => {
      const s = useEditor.getState()
      const tol = frameTolerance(s.project)
      const curMouse1 = isSide ? unSideZ!(pev.clientX - rect.left) : unx(pev.clientX - rect.left)
      const curMouse2 = isSide ? unSideY!(pev.clientY - rect.top) : unz(pev.clientY - rect.top)

      const newLocalTarget: Vec3 = isSide
        ? [initLocalTarget[0], Math.round(curMouse2), Math.round(curMouse1)]
        : [Math.round(curMouse1), initLocalTarget[1], Math.round(curMouse2)]
      s.update((d) => {
        setValueAt(d.camera.target, s.time, worldP(newLocalTarget), tol)
      }, key)
    }

    const up = () => {
      setDragMode('none')
      setHudText(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return {
    dragMode,
    hudText,
    startLayerDrag,
    startCamPosDrag,
    startCamAngleDrag,
    startCamTargetDrag
  }
}

