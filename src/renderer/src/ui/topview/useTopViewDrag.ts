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
  computeTranslatedCamera,
  computeTranslatedLayer
} from '../topViewCameraMath'

export type CamDragMode = 'none' | 'pos' | 'aim' | 'target' | 'layer'

interface UseTopViewDragOptions {
  shotId: string | null
  unx: (px: number) => number
  unz: (py: number) => number
}

export function useTopViewDrag({ shotId, unx, unz }: UseTopViewDragOptions) {
  const [dragMode, setDragMode] = useState<CamDragMode>('none')
  const [hudText, setHudText] = useState<string | null>(null)

  const startLayerDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const st = useEditor.getState()
    st.selectLayer(id)
    const layer = st.project.layers.find((l) => l.id === id)
    if (!layer || layer.locked) return

    const startPos = evaluate(layer.transform.position, st.time) as Vec3
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `topdrag-${nanoid(6)}`
    const startMouseX = unx(e.clientX - rect.left)
    const startMouseZ = unz(e.clientY - rect.top)

    setDragMode('layer')

    const move = (ev2: PointerEvent) => {
      const s = useEditor.getState()
      const curMouseX = unx(ev2.clientX - rect.left)
      const curMouseZ = unz(ev2.clientY - rect.top)
      const deltaX = curMouseX - startMouseX
      const deltaZ = curMouseZ - startMouseZ

      const newPos = computeTranslatedLayer(startPos, deltaX, deltaZ, ev2.shiftKey, ev2.altKey ? 50 : 0)
      setHudText(`X: ${Math.round(newPos[0])} · Z: ${Math.round(newPos[2])}`)

      s.update((d) => {
        const l = d.layers.find((x) => x.id === id)
        if (l) setValueAt(l.transform.position, s.time, [newPos[0], startPos[1], newPos[2]], frameTolerance(s.project))
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

  const startCamPosDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    const st = useEditor.getState()
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `topcampos-${nanoid(6)}`

    const curEv = evaluateScene(st.project, st.time)
    const curShot = shotId ? curEv.shots.find((s) => s.shot.id === shotId) : undefined
    const curInv = curShot ? curShot.matrix.clone().invert() : new THREE.Matrix4()
    const curMat = curShot ? curShot.matrix : new THREE.Matrix4()
    const localP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curInv))
    const worldP = (p: Vec3): Vec3 => threeToDepth(depthToThree(p).applyMatrix4(curMat))

    const initLocalCam = localP(curEv.camera.position)
    const initLocalTarget = localP(curEv.camera.target)
    const startMouseLocalX = unx(e.clientX - rect.left)
    const startMouseLocalZ = unz(e.clientY - rect.top)

    setDragMode(e.altKey ? 'aim' : 'pos')

    const move = (pev: PointerEvent) => {
      const s = useEditor.getState()
      const tol = frameTolerance(s.project)
      const curLocalX = unx(pev.clientX - rect.left)
      const curLocalZ = unz(pev.clientY - rect.top)

      if (pev.altKey) {
        const newLocalTarget = computeRotatedTarget(initLocalCam, initLocalTarget, [curLocalX, curLocalZ])
        const newWorldTarget = worldP(newLocalTarget)
        s.update((d) => {
          setValueAt(d.camera.target, s.time, newWorldTarget, tol)
        }, key)
      } else {
        const deltaX = curLocalX - startMouseLocalX
        const deltaZ = curLocalZ - startMouseLocalZ
        const { camPos: nextCam, target: nextTarget } = computeTranslatedCamera(
          initLocalCam,
          initLocalTarget,
          deltaX,
          deltaZ,
          pev.shiftKey
        )
        setHudText(`Cam: [${Math.round(nextCam[0])}, ${Math.round(nextCam[2])}]`)
        s.update((d) => {
          setValueAt(d.camera.position, s.time, worldP(nextCam), tol)
          setValueAt(d.camera.target, s.time, worldP(nextTarget), tol)
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

  const startCamAngleDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    const st = useEditor.getState()
    const rect = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect()
    const key = `topcamangle-${nanoid(6)}`

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
      const curLocalX = unx(pev.clientX - rect.left)
      const curLocalZ = unz(pev.clientY - rect.top)

      const newLocalTarget = computeRotatedTarget(initLocalCam, initLocalTarget, [curLocalX, curLocalZ])
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
    const key = `topcamtarget-${nanoid(6)}`

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
      const curLocalX = unx(pev.clientX - rect.left)
      const curLocalZ = unz(pev.clientY - rect.top)

      const newLocalTarget: Vec3 = [Math.round(curLocalX), initLocalTarget[1], Math.round(curLocalZ)]
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
