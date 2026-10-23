import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { Animatable, Layer, Project } from '@shared/types'
import { snapToFrame } from '../../animation/math'
import { frameTolerance, getAnimatable, getDraftAnimatable, useEditor, type PropRef } from '../../store/editor'
import { useView } from '../../store/view'
import { getProjectAudioTracks } from '../../project/audioTracks'
import {
  addAudioTrackFromAsset,
  addLayerFromAsset,
  duplicateAudioTrack,
  duplicateSelectedLayer,
  importBuiltInAsset,
  setAudioFromBytes,
  toast
} from '../../actions'
import {
  addKeyframeForSelectedLayer,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from './timelineActions'
import { openFxPresetMenu } from './FxPresetMenu'
import { PAD } from './timelineTypes'
import { focusTimelineProperty, handleTimelineKeyShortcut } from './timelineKeyEditing'

interface UseTimelineInteractionsParams {
  project: Project
  contentW: number
  tAt: (px: number) => number
  trackRef: React.RefObject<HTMLDivElement | null>
  setZoom: React.Dispatch<React.SetStateAction<number>>
  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  selectLayer: (id: string | null) => void
}

export function useTimelineInteractions({
  project,
  contentW,
  tAt,
  trackRef,
  setZoom,
  setTime,
  setPlaying,
  selectLayer
}: UseTimelineInteractionsParams) {
  const { comp } = project
  const lastLPressRef = useRef<number>(0)

  // Alt + MouseWheel zoom on timeline
  const handleTimelineWheel = useCallback(
    (e: React.WheelEvent): void => {
      if (e.altKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.25 : 0.25
        setZoom((z) => Math.max(1, Math.min(6, Math.round((z + delta) * 100) / 100)))
      }
    },
    [setZoom]
  )

  // Global Timeline Keyboard Shortcuts: [ (In), ] (Out), Ctrl+Shift+D or S (Split), K (Keyframe), +/- (Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || useView.getState().dialog || useView.getState().assemblyModalModel ||
        document.querySelector('.modal-backdrop, .la-dialog-backdrop, .a3d-backdrop, [data-mcp-dialog]')) return
      if (handleTimelineKeyShortcut(e)) return
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (e.key === '[') {
        e.preventDefault()
        setSelectedLayerInPoint()
      } else if (e.key === ']') {
        e.preventDefault()
        setSelectedLayerOutPoint()
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        splitSelectedLayer()
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          splitSelectedLayer()
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          addKeyframeForSelectedLayer()
        }
      } else if (e.key === '=' || e.key === '+') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          setZoom((z) => Math.min(6, Math.round((z + 0.25) * 100) / 100))
        }
      } else if (e.key === '-' || e.key === '_') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))
        }
      } else if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const st = useEditor.getState()
        if (st.selectedLayerId) {
          duplicateSelectedLayer()
        } else {
          const tracks = getProjectAudioTracks(st.project)
          if (tracks.length > 0) {
            duplicateAudioTrack(tracks[tracks.length - 1].id)
          }
        }
      } else if (e.key === 'l' || e.key === 'L') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          const now = performance.now()
          const isDoubleL = now - lastLPressRef.current < 450
          lastLPressRef.current = now

          const st = useEditor.getState()
          st.setInspectorTab('scene')
          useView.getState().openAudioDialog(isDoubleL ? 'waveform' : 'levels')
          if (isDoubleL) {
            toast('Phím tắt LL (After Effects): Đã mở bảng sóng âm Waveform & Audio Levels')
          } else {
            toast('Phím tắt L (After Effects): Đã mở bảng cấu hình Audio Levels (âm lượng)')
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setZoom])

  // Scrubbing on the Time Ruler
  const scrub = useCallback(
    (e: React.PointerEvent): void => {
      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      const apply = (cx: number): void =>
        setTime(Math.max(0, Math.min(comp.duration, snapToFrame(tAt(cx - rect.left), comp.fps))))
      setPlaying(false)
      apply(e.clientX)
      el.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent): void => apply(ev.clientX)
      const up = (): void => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
    },
    [comp.duration, comp.fps, setPlaying, setTime, tAt]
  )

  const handleTimelineDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleTimelineDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault()
      const rulerEl = trackRef.current
      let dropTime = useEditor.getState().time
      if (rulerEl) {
        const rect = rulerEl.getBoundingClientRect()
        dropTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(e.clientX - rect.left), comp.fps)))
      }

      const builtInRaw = e.dataTransfer.getData('application/x-pxs-builtin-asset')
      if (builtInRaw) {
        try {
          const item = JSON.parse(builtInRaw)
          if (item.kind === 'audio') {
            await importBuiltInAsset(item, true, dropTime)
            setTime(dropTime)
          } else if (item.kind === 'image') {
            await importBuiltInAsset(item, true, dropTime)
          }
        } catch (err) {
          console.error('Error dropping built-in asset on timeline:', err)
        }
        return
      }

      const assetId = e.dataTransfer.getData('application/x-pxs-asset')
      if (assetId) {
        const a = project.assets.find((ast) => ast.id === assetId)
        if (a?.kind === 'audio') {
          addAudioTrackFromAsset(assetId, dropTime)
          setTime(dropTime)
        } else {
          addLayerFromAsset(assetId)
        }
        return
      }

      if (e.dataTransfer.files.length) {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (file.type.startsWith('audio/')) {
            const data = new Uint8Array(await file.arrayBuffer())
            await setAudioFromBytes(file.name, file.type, data, dropTime)
            setTime(dropTime)
          }
        }
      }
    },
    [comp.duration, comp.fps, project.assets, setTime, tAt, trackRef]
  )

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent): void => {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(clickX), comp.fps)))
      setTime(clickedTime)
    },
    [comp.duration, comp.fps, setTime, tAt]
  )

  const handleLayerContextMenu = useCallback(
    (e: React.MouseEvent, layer: Layer): void => {
      e.preventDefault()
      e.stopPropagation()
      selectLayer(layer.id)

      const trackCol = (e.currentTarget as HTMLElement).closest('.tl-row-track-col')
      const currentTime = useEditor.getState().time
      let clickedTime = currentTime
      if (trackCol) {
        const rect = trackCol.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(clickX), comp.fps)))
      } else {
        clickedTime = Math.max(layer.inPoint, Math.min(layer.outPoint, currentTime))
      }

      setTime(clickedTime)
      openFxPresetMenu({
        x: e.clientX,
        y: e.clientY,
        targetTime: clickedTime,
        from: 'context',
        layerName: layer.name
      })
    },
    [comp.duration, comp.fps, selectLayer, setTime, tAt]
  )

  // Drag individual keyframe diamond
  const startKeyDrag = useCallback(
    (e: React.PointerEvent, ref: PropRef, keyId: string): void => {
      e.stopPropagation()
      const st = useEditor.getState()
      if (ref.kind === 'layer' && st.project.layers.find(l => l.id === ref.layerId)?.locked) return
      focusTimelineProperty(ref)
      st.selectKey({ ref, keyId })
      if (ref.kind === 'layer') st.selectLayer(ref.layerId)
      if (ref.kind === 'shot') st.selectShot(ref.shotId)
      st.selectKey({ ref, keyId })
      st.setInspectorTab(ref.kind === 'camera' ? 'camera' : 'layer')
      const a = getAnimatable(st.project, ref)
      const k = a?.keyframes.find((kk) => kk.id === keyId)
      if (!k) return
      st.setPlaying(false)
      st.setTime(k.t)
      const startT = k.t
      const startX = e.clientX
      const key = `keydrag-${nanoid(6)}`
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      const move = (ev: PointerEvent): void => {
        const dt = ((ev.clientX - startX) / (contentW - PAD * 2)) * comp.duration
        const nt = Math.max(0, Math.min(comp.duration, snapToFrame(startT + dt, comp.fps)))
        useEditor.getState().update((d) => {
          const da = getDraftAnimatable(d, ref)
          const kk = da?.keyframes.find((q) => q.id === keyId)
          if (da && kk) {
            kk.t = nt
            da.keyframes.sort((p, q) => p.t - q.t)
          }
        }, key)
        useEditor.getState().setTime(nt)
      }
      const up = (): void => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
    },
    [contentW, comp.duration, comp.fps]
  )

  // Drag a Camera Waypoint node (#1..#N) on the Camera Track — moves all camera keyframes at that time together
  const startCameraWaypointDrag = useCallback(
    (e: React.PointerEvent, waypointTime: number, shotId: string | null): void => {
      e.stopPropagation()
      const st = useEditor.getState()
      st.setPlaying(false)
      st.setTime(waypointTime)
      if (shotId) st.selectShot(shotId)
      st.setInspectorTab('route')

      const tol = Math.max(frameTolerance(st.project), 0.04)
      const startX = e.clientX
      const mergeKey = `camwp-drag-${nanoid(6)}`
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      let currentT = waypointTime
      let moved = false

      const move = (ev: PointerEvent): void => {
        if (Math.abs(ev.clientX - startX) > 3) moved = true
        if (!moved) return
        const dt = ((ev.clientX - startX) / (contentW - PAD * 2)) * comp.duration
        const nextT = Math.max(0, Math.min(comp.duration, snapToFrame(waypointTime + dt, comp.fps)))
        if (Math.abs(nextT - currentT) < 1e-4) return
        const prevT = currentT
        currentT = nextT

        useEditor.getState().update((d) => {
          const shiftAnim = (a?: Animatable<unknown>) => {
            if (!a) return
            const kf = a.keyframes.find((k) => Math.abs(k.t - prevT) <= tol)
            if (kf) {
              kf.t = nextT
              a.keyframes.sort((p, q) => p.t - q.t)
            }
          }
          shiftAnim(d.camera.position)
          shiftAnim(d.camera.target)
          shiftAnim(d.camera.focusDistance)
          shiftAnim(d.camera.roll)
          shiftAnim(d.camera.fov)
        }, mergeKey)
        useEditor.getState().setTime(nextT)
      }

      const up = (): void => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
    },
    [contentW, comp.duration, comp.fps]
  )

  // Drag layer duration bar (move / trim in / trim out)
  const startBarDrag = useCallback(
    (e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out'): void => {
      e.stopPropagation()
      selectLayer(layer.id)
      if (layer.locked) return
      const startX = e.clientX
      const instanceId = layer.model3d?.instanceId
      const related = instanceId
        ? useEditor.getState().project.layers.filter((l) => l.model3d?.instanceId === instanceId)
        : [layer]
      const initialTimes = related.map((l) => ({ id: l.id, inPoint: l.inPoint, outPoint: l.outPoint }))

      const key = `bar-${nanoid(6)}`
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      let moved = false
      const move = (ev: PointerEvent): void => {
        if (Math.abs(ev.clientX - startX) > 3) {
          moved = true
        }
        if (!moved) return
        const dt = snapToFrame(((ev.clientX - startX) / (contentW - PAD * 2)) * comp.duration, comp.fps)
        useEditor.getState().update((d) => {
          for (const init of initialTimes) {
            const l = d.layers.find((q) => q.id === init.id)
            if (!l || l.locked) continue
            if (mode === 'in') l.inPoint = Math.max(0, Math.min(init.outPoint - 1 / comp.fps, init.inPoint + dt))
            else if (mode === 'out') l.outPoint = Math.min(comp.duration, Math.max(init.inPoint + 1 / comp.fps, init.outPoint + dt))
            else {
              const shift = Math.max(-init.inPoint, Math.min(comp.duration - init.outPoint, dt))
              l.inPoint = init.inPoint + shift
              l.outPoint = init.outPoint + shift
            }
          }
        }, key)
      }
      const up = (ev: PointerEvent): void => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        if (!moved && mode === 'move') {
          const rulerEl = trackRef.current
          if (rulerEl) {
            const rect = rulerEl.getBoundingClientRect()
            const clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(ev.clientX - rect.left), comp.fps)))
            setTime(clickedTime)
          }
        }
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
    },
    [selectLayer, contentW, comp.duration, comp.fps, tAt, setTime, trackRef]
  )

  return {
    handleTimelineWheel,
    scrub,
    handleTimelineDragOver,
    handleTimelineDrop,
    handleTrackPointerDown,
    handleLayerContextMenu,
    startKeyDrag,
    startCameraWaypointDrag,
    startBarDrag
  }
}
