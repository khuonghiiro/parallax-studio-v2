import { useEffect, useRef, useState } from 'react'
import type { Vec3 } from '@shared/types'
import { evaluate, setValueAt } from '../animation/keyframes'
import { SceneRenderer } from '../engine/SceneRenderer'
import { assetStore } from '../project/assets'
import { frameTolerance, useEditor } from '../store/editor'
import { nanoid } from 'nanoid'

type Quality = 1 | 0.5

export function Viewer() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<SceneRenderer | null>(null)
  const rafRef = useRef(0)
  const [quality, setQuality] = useState<Quality>(1)
  const [fps, setFps] = useState(0)
  const comp = useEditor((s) => s.project.comp)
  const cameraFov = useEditor((s) => s.project.camera.fov)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)

  // Create renderer once.
  useEffect(() => {
    const r = new SceneRenderer(canvasRef.current!)
    rendererRef.current = r
    r.onInvalidate = () => requestRender()
    const unsubStore = useEditor.subscribe((s, prev) => {
      if (s.project !== prev.project || s.time !== prev.time || s.selectedLayerId !== prev.selectedLayerId) requestRender()
    })
    const unsubAssets = assetStore.subscribe(() => requestRender())
    requestRender()
    return () => {
      unsubStore()
      unsubAssets()
      cancelAnimationFrame(rafRef.current)
      r.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const frameTimes = useRef<number[]>([])
  function requestRender(): void {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const r = rendererRef.current
      if (!r) return
      const s = useEditor.getState()
      r.render(s.project, s.time, { selectedId: s.playing ? null : s.selectedLayerId })
      const now = performance.now()
      const ft = frameTimes.current
      ft.push(now)
      while (ft.length && now - ft[0] > 1000) ft.shift()
    })
  }

  useEffect(() => {
    const id = window.setInterval(() => setFps(frameTimes.current.length), 500)
    return () => window.clearInterval(id)
  }, [])

  // Fit canvas into the viewer keeping comp aspect.
  useEffect(() => {
    const wrap = wrapRef.current!
    const fit = (): void => {
      const pad = 28
      const W = wrap.clientWidth - pad * 2
      const H = wrap.clientHeight - pad * 2
      const aspect = comp.width / comp.height
      let w = W
      let h = W / aspect
      if (h > H) {
        h = H
        w = H * aspect
      }
      w = Math.max(16, Math.floor(w))
      h = Math.max(9, Math.floor(h))
      const c = canvasRef.current!
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality
      rendererRef.current?.setSize(Math.min(comp.width, w * dpr), Math.min(comp.height, h * dpr))
      requestRender()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    fit()
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.width, comp.height, quality])

  // ---------------------------------------------------------------- interaction

  const toNdc = (e: React.PointerEvent | PointerEvent): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1]
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    const r = rendererRef.current
    if (!r || e.button !== 0) return
    const st = useEditor.getState()
    if (st.playing) st.setPlaying(false)
    const [nx, ny] = toNdc(e)
    // Make sure camera matrices match the current state before picking.
    r.render(st.project, st.time, { selectedId: st.selectedLayerId })
    const id = r.pick(nx, ny, st.project)
    st.selectLayer(id)
    if (!id) return

    const layer = st.project.layers.find((l) => l.id === id)!
    const startPos = evaluate(layer.transform.position, st.time) as Vec3
    const startHit = r.screenToDepthPlane(nx, ny, startPos[2])
    if (!startHit) return
    const startY = e.clientY
    const key = `drag-${nanoid(6)}`
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent): void => {
      const s = useEditor.getState()
      let next: Vec3
      if (ev.altKey) {
        // Alt + vertical drag → push/pull in depth.
        const dz = (ev.clientY - startY) * 4
        next = [startPos[0], startPos[1], Math.round(startPos[2] - dz)]
      } else {
        const [mx, my] = toNdc(ev)
        const hit = r.screenToDepthPlane(mx, my, startPos[2])
        if (!hit) return
        next = [Math.round(startPos[0] + hit.x - startHit.x), Math.round(startPos[1] + hit.y - startHit.y), startPos[2]]
        if (ev.shiftKey) {
          // Constrain to dominant axis.
          if (Math.abs(next[0] - startPos[0]) > Math.abs(next[1] - startPos[1])) next[1] = startPos[1]
          else next[0] = startPos[0]
        }
      }
      s.update((d) => {
        const l = d.layers.find((x) => x.id === id)
        if (l) setValueAt(l.transform.position, s.time, next, frameTolerance(s.project))
      }, key)
    }
    const up = (): void => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const fov = evaluate(cameraFov, time)

  return (
    <div className="viewer" ref={wrapRef}>
      <canvas id="viewer-canvas" ref={canvasRef} onPointerDown={onPointerDown} />
      <div className="viewer-hud">
        <span className="chip">
          <span className="dot" /> {playing ? `${fps} fps` : 'Sẵn sàng'}
        </span>
        <span className="chip">
          {comp.width}×{comp.height} · {comp.fps}p
        </span>
        <span className="chip">FOV {fov.toFixed(1)}°</span>
      </div>
      <div className="viewer-tools">
        <button
          id="quality-toggle"
          className="btn sm"
          title="Chất lượng preview"
          onClick={() => setQuality((q) => (q === 1 ? 0.5 : 1))}
        >
          {quality === 1 ? 'Full' : 'Half'}
        </button>
      </div>
    </div>
  )
}
