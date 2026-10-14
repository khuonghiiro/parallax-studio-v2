import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import type { Animatable, AnimValue, AudioTrackItem, Layer, Shot } from '@shared/types'
import { snapToFrame } from '../animation/math'
import { getAnimatable, getDraftAnimatable, useEditor, type PropRef } from '../store/editor'
import { IconCamera, IconCaret, IconFilm } from './icons'
import { CAMERA_PROPS, PAD, SHOT_PROPS, NAME_W, shotSegments } from './timeline/timelineTypes'
import { TimelineRow } from './timeline/TimelineRow'
import { AudioRow } from './timeline/AudioRow'
import { addAudioTrackToProject, getProjectAudioTracks } from '../project/audioTracks'
import { isMouthLayer } from '../project/lipSync'
import { AudioTargetModal } from './timeline/AudioTargetModal'
import { TimelineToolbar } from './timeline/TimelineToolbar'
import { TimelineLayerRow } from './timeline/TimelineLayerRow'
import { TimelineClusterRow } from './timeline/TimelineClusterRow'
import { buildTimelineClusters, type TimelineClusterGroup } from './timeline/timelineClusters'
import { openFxPresetMenu } from './timeline/FxPresetMenu'
import {
  addAudioTrackFromAsset,
  addLayerFromAsset,
  duplicateAudioTrack,
  duplicateSelectedLayer,
  importBuiltInAsset,
  setAudioFromBytes,
  toast
} from '../actions'
import { useView } from '../store/view'
import {
  addKeyframeForSelectedLayer,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from './timeline/timelineActions'

const TimelineRulerPlayhead = memo(function TimelineRulerPlayhead({ x }: { x: (t: number) => number }) {
  const time = useEditor((s) => s.time)
  return <div className="tl-ruler-playhead" style={{ left: x(time) }} />
})

const TimelinePlayhead = memo(function TimelinePlayhead({ x }: { x: (t: number) => number }) {
  const time = useEditor((s) => s.time)
  return <div className="playhead" style={{ left: x(time) }} />
})

export function Timeline() {
  const project = useEditor((s) => s.project)
  const playing = useEditor((s) => s.playing)
  const loop = useEditor((s) => s.loop)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const { setTime, setPlaying, setLoop, selectLayer, selectShot } = useEditor.getState()
  const { comp } = project

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [modalTrack, setModalTrack] = useState<AudioTrackItem | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const rulerScrollRef = useRef<HTMLDivElement>(null)
  const rowsScrollRef = useRef<HTMLDivElement>(null)
  const lastLPressRef = useRef<number>(0)
  const isSyncingScrollRef = useRef(false)
  const [trackW, setTrackW] = useState(800)
  const [nameW, setNameW] = useState(NAME_W)
  const [scrollbarW, setScrollbarW] = useState(0)

  // Measure visible track area from rows container to account for vertical scrollbar
  useEffect(() => {
    const el = rowsScrollRef.current
    if (!el) return
    const update = () => {
      const sw = el.offsetWidth - el.clientWidth
      const nw = el.clientWidth < 560 ? 156 : el.clientWidth < 860 ? 204 : NAME_W
      setScrollbarW(sw)
      setNameW(nw)
      setTrackW(Math.max(100, el.clientWidth - nw))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const contentW = Math.max(trackW, Math.round((trackW - PAD * 2) * zoom + PAD * 2))
  const x = useCallback(
    (t: number): number => PAD + (t / comp.duration) * (contentW - PAD * 2),
    [comp.duration, contentW]
  )
  const tAt = useCallback(
    (px: number): number => ((px - PAD) / (contentW - PAD * 2)) * comp.duration,
    [contentW, comp.duration]
  )

  const toggle = useCallback((id: string): void =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    }), [])

  // Synchronize horizontal scrolling between Ruler and Rows Track Viewport
  const onRowsScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    if (isSyncingScrollRef.current) return
    if (rulerScrollRef.current) {
      isSyncingScrollRef.current = true
      rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
      isSyncingScrollRef.current = false
    }
  }

  const onRulerScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    if (isSyncingScrollRef.current) return
    if (rowsScrollRef.current) {
      isSyncingScrollRef.current = true
      rowsScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
      isSyncingScrollRef.current = false
    }
  }

  // Alt + MouseWheel zoom on timeline
  const handleTimelineWheel = (e: React.WheelEvent): void => {
    if (e.altKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.25 : 0.25
      setZoom((z) => Math.max(1, Math.min(6, Math.round((z + delta) * 100) / 100)))
    }
  }

  // Global Timeline Keyboard Shortcuts: [ (In), ] (Out), Ctrl+Shift+D or S (Split), K (Keyframe), +/- (Zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
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
  }, [])

  // ---------------------------------------------------------------- scrubbing

  const scrub = (e: React.PointerEvent): void => {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const apply = (cx: number): void => setTime(snapToFrame(tAt(cx - rect.left), comp.fps))
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
  }

  const handleTimelineDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleTimelineDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    const rulerEl = trackRef.current
    let dropTime = useEditor.getState().time
    if (rulerEl) {
      const rect = rulerEl.getBoundingClientRect()
      dropTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(e.clientX - rect.left), comp.fps)))
    }

    // 1. Built-in asset
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

    // 2. Project asset
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

    // 3. Dropped OS files
    if (e.dataTransfer.files.length) {
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.type.startsWith('audio/')) {
          const data = new Uint8Array(await file.arrayBuffer())
          await setAudioFromBytes(file.name, file.type, data, dropTime)
          setTime(dropTime)
        }
      }
    }
  }

  // Click on any track empty background to jump playhead
  const handleTrackPointerDown = (e: React.PointerEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickedTime = Math.max(0, Math.min(comp.duration, snapToFrame(tAt(clickX), comp.fps)))
    setTime(clickedTime)
  }

  // Right-click on layer bar or track to open FX preset popup at that exact time
  const handleLayerContextMenu = (e: React.MouseEvent, layer: Layer): void => {
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
  }

  // ---------------------------------------------------------------- ticks

  const ticks = useMemo(() => {
    const pxPerSec = (contentW - PAD * 2) / comp.duration
    const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60]
    const major = steps.find((s) => s * pxPerSec >= 70) ?? 60
    const out: { t: number; major: boolean }[] = []
    const minor = major >= 0.5 ? major / 5 : major / 2
    for (let t = 0; t <= comp.duration + 1e-6; t += minor) {
      out.push({ t, major: Math.abs(t / major - Math.round(t / major)) < 1e-4 })
    }
    return out
  }, [contentW, comp.duration])

  // ---------------------------------------------------------------- keyframe drag

  const startKeyDrag = useCallback((e: React.PointerEvent, ref: PropRef, keyId: string): void => {
    e.stopPropagation()
    const st = useEditor.getState()
    st.selectKey({ ref, keyId })
    if (ref.kind === 'layer') st.selectLayer(ref.layerId)
    if (ref.kind === 'shot') st.selectShot(ref.shotId)
    st.selectKey({ ref, keyId })
    st.setInspectorTab(ref.kind === 'camera' ? 'camera' : 'layer')
    const a = getAnimatable(st.project, ref)
    const k = a?.keyframes.find((kk) => kk.id === keyId)
    if (!k) return
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
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }, [contentW, comp.duration, comp.fps])

  // ---------------------------------------------------------------- layer bar drag with click-to-playhead

  const startBarDrag = useCallback((e: React.PointerEvent, layer: Layer, mode: 'move' | 'in' | 'out'): void => {
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
  }, [selectLayer, contentW, comp.duration, comp.fps, tAt, setTime])

  // ---------------------------------------------------------------- render helpers


  const selectedKey = useEditor((s) => s.selectedKey)
  const renderKeys = useCallback(
    (a: Animatable<AnimValue>, ref: PropRef) => {
      const ks = a.keyframes
      if (ks.length === 0) return null
      let lastPx = -9999
      const visibleKeys = ks.filter((k) => {
        if (selectedKey?.keyId === k.id) return true
        const px = x(k.t)
        if (px - lastPx >= 5) {
          lastPx = px
          return true
        }
        return false
      })
      return visibleKeys.map((k) => (
        <div
          key={k.id}
          className={`tl-key${k.ease === 'hold' ? ' hold' : ''}${selectedKey?.keyId === k.id ? ' selected' : ''}`}
          style={{ left: x(k.t) }}
          title={`${k.t.toFixed(2)}s`}
          onPointerDown={(e) => startKeyDrag(e, ref, k.id)}
          onDoubleClick={() => setTime(k.t)}
        />
      ))
    },
    [selectedKey, x, setTime, startKeyDrag]
  )

  const summaryKeys = useCallback(
    (anims: Animatable<AnimValue>[]) => {
      if (anims.length === 0) return null
      const timeSet = new Set<number>()
      for (let i = 0; i < anims.length; i++) {
        const kfs = anims[i].keyframes
        for (let j = 0; j < kfs.length; j++) {
          timeSet.add(Math.round(kfs[j].t * 100) / 100)
        }
      }
      if (timeSet.size === 0) return null
      const times = Array.from(timeSet).sort((a, b) => a - b)
      let lastPx = -9999
      const decimated: number[] = []
      for (let i = 0; i < times.length; i++) {
        const t = times[i]
        const px = x(t)
        if (px - lastPx >= 7) {
          decimated.push(t)
          lastPx = px
        }
      }
      return decimated.map((t) => (
        <div
          key={t}
          className="tl-key summary"
          style={{ left: x(t) }}
          onPointerDown={(e) => {
            e.stopPropagation()
            setTime(t)
          }}
        />
      ))
    },
    [x, setTime]
  )

  const cameraAnims = useMemo(
    () => CAMERA_PROPS.map((p) => project.camera[p.prop] as Animatable<AnimValue>),
    [project.camera]
  )
  const camOpen = expanded.has('camera')
  const segments = useMemo(() => (project.shots.length ? shotSegments(project) : []), [project])
  const shotById = useMemo(() => new Map(project.shots.map((s) => [s.id, s])), [project.shots])

  // Group layers: global first, then each shot in order (stack order kept inside a group).
  const groups = useMemo(() => {
    const out: { shot: Shot | null; layers: Layer[] }[] = []
    const globals = project.layers.filter((l) => !l.shotId || !shotById.has(l.shotId))
    if (globals.length || project.shots.length === 0) out.push({ shot: null, layers: globals })
    for (const s of project.shots) out.push({ shot: s, layers: project.layers.filter((l) => l.shotId === s.id) })
    return out
  }, [project.layers, project.shots, shotById])

  // Lấy toàn bộ danh sách track âm thanh của dự án
  const allAudioTracks = useMemo(
    () => getProjectAudioTracks(project),
    [project.audioTracks, project.audio]
  )

  // Tập hợp các ID cụm nhân vật composite và mô hình 3D trong scene
  const targetedInstanceIds = useMemo(() => {
    const set = new Set<string>()
    for (const l of project.layers) {
      const inst = l.composite?.instanceId || l.model3d?.instanceId
      if (inst) set.add(inst)
    }
    return set
  }, [project.layers])

  // Audio toàn cục / nền (không gắn vào cụm nhân vật, mô hình 3D hay layer cụ thể nào trong scene)
  const globalAudioTracks = useMemo(() => {
    return allAudioTracks.filter((t) => {
      if (!t.targetId || t.targetType === 'ambient') return true
      if (t.targetType === 'character' || t.targetType === 'model3d') {
        const hasTarget = project.layers.some(
          (l) => l.composite?.instanceId === t.targetId || l.model3d?.instanceId === t.targetId || l.id === t.targetId
        )
        return !hasTarget
      }
      if (t.targetType === 'layer') {
        const layerExists = project.layers.some((l) => l.id === t.targetId)
        return !layerExists
      }
      return true
    })
  }, [allAudioTracks, project.layers])

  // Gom cụm các layer và gắn liền track âm thanh của nhân vật vào cụm đó (memoized 60fps)
  const clusteredGroups = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      items: buildTimelineClusters(g.layers, allAudioTracks)
    }))
  }, [groups, allAudioTracks])

  const handleOpenAttachAudioForCluster = (cluster: TimelineClusterGroup) => {
    if (cluster.audioTracks && cluster.audioTracks.length > 0) {
      setModalTrack(cluster.audioTracks[0])
      return
    }
    // Tìm layer miệng nếu có
    const mouthLayer = cluster.layers.find((l) => {
      const n = (l.name || '').toLowerCase()
      return n.includes('mouth') || n.includes('mieng') || n.includes('miệng') || n.includes('lips')
    })
    const audioAssets = project.assets.filter((a) => a.kind === 'audio')
    const firstAudio = audioAssets[0]

    let createdId: string | null = null
    useEditor.getState().update((d) => {
      const tr = addAudioTrackToProject(
        d,
        firstAudio?.id || '',
        `Thoại - ${cluster.name}`,
        cluster.inPoint,
        {
          targetType: cluster.clusterType === 'composite' ? 'character' : 'model3d',
          targetId: cluster.instanceId,
          targetName: cluster.name,
          targetShotId: cluster.layers[0]?.shotId || undefined,
          characterRole: 'voice',
          lipSyncEnabled: true,
          lipSyncLayerId: mouthLayer?.id
        }
      )
      createdId = tr.id
    }, `Gắn audio cho nhân vật: ${cluster.name}`)

    if (createdId) {
      const found = getProjectAudioTracks(useEditor.getState().project).find((t) => t.id === createdId)
      if (found) setModalTrack(found)
    }
  }

  const handleOpenAttachAudioForLayer = (layer: Layer) => {
    const existing = allAudioTracks.find((t) => t.targetType === 'layer' && t.targetId === layer.id)
    if (existing) {
      setModalTrack(existing)
      return
    }
    const audioAssets = project.assets.filter((a) => a.kind === 'audio')
    const firstAudio = audioAssets[0]

    let createdId: string | null = null
    useEditor.getState().update((d) => {
      const tr = addAudioTrackToProject(
        d,
        firstAudio?.id || '',
        `Thoại - ${layer.name}`,
        layer.inPoint,
        {
          targetType: 'layer',
          targetId: layer.id,
          targetName: layer.name,
          targetShotId: layer.shotId || undefined,
          characterRole: isMouthLayer(layer) ? 'voice' : 'sfx',
          lipSyncEnabled: isMouthLayer(layer)
        }
      )
      createdId = tr.id
    }, `Gắn audio cho layer: ${layer.name}`)

    if (createdId) {
      const found = getProjectAudioTracks(useEditor.getState().project).find((t) => t.id === createdId)
      if (found) setModalTrack(found)
    }
  }

  const toggleGroup = (id: string): void =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleCluster = (id: string): void =>
    setCollapsedClusters((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <section className="panel timeline" style={{ ['--tl-name-w' as string]: `${nameW}px` }}>
      <TimelineToolbar
        fps={comp.fps}
        duration={comp.duration}
        playing={playing}
        loop={loop}
        zoom={zoom}
        hasSelectedLayer={!!selectedLayerId}
        setTime={setTime}
        setPlaying={setPlaying}
        setLoop={setLoop}
        setZoom={setZoom}
      />

      <div className="tl-body" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header: Layer names column & Time Ruler Viewport */}
        <div className="tl-header-row">
          <div
            className="tl-names-head"
            style={{ width: nameW }}
          >
            <span>Layer</span>
            <span className="tl-names-head-meta" style={{ display: 'inline-flex', gap: 7, color: 'var(--text-faint)', fontSize: 9.5, fontWeight: 700 }}>
              <span title="Độ sâu 3D (Z depth)">Z-Depth</span>
              <span title="Ẩn / Hiện (Visibility)">👁</span>
              <span title="Khóa layer (Lock)">🔒</span>
            </span>
          </div>

          <div
            className="tl-ruler-viewport"
            ref={rulerScrollRef}
            onScroll={onRulerScroll}
            onWheel={handleTimelineWheel}
          >
            <div
              className="tl-ruler"
              ref={trackRef}
              style={{ width: contentW }}
              onPointerDown={scrub}
              onDragOver={handleTimelineDragOver}
              onDrop={handleTimelineDrop}
            >
              {ticks.map((tk, i) => (
                <div key={i} className={`tick ${tk.major ? 'major' : ''}`} style={{ left: x(tk.t), height: tk.major ? 9 : 5 }}>
                  {tk.major && <span className="tick-label">{tk.t % 1 === 0 ? `${tk.t}s` : `${tk.t.toFixed(1)}s`}</span>}
                </div>
              ))}
              <TimelineRulerPlayhead x={x} />
            </div>
          </div>

          {scrollbarW > 0 && (
            <div
              style={{
                width: scrollbarW,
                flex: 'none',
                background: 'var(--bg-1)',
                borderLeft: '1px solid var(--line-soft)'
              }}
            />
          )}
        </div>

        {/* Rows Scroll Area */}
        <div
          className="tl-scroll"
          ref={rowsScrollRef}
          onScroll={onRowsScroll}
          onWheel={handleTimelineWheel}
          onDragOver={handleTimelineDragOver}
          onDrop={handleTimelineDrop}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}
        >
          <div style={{ width: nameW + contentW, minWidth: '100%', position: 'relative' }}>
            {/* camera */}
            <TimelineRow
              selected={false}
              trackWidth={contentW}
              onTrackPointerDown={handleTrackPointerDown}
              name={
                <div className="tl-name" onClick={() => useEditor.getState().setInspectorTab('camera')}>
                  <button className="mini" onClick={(e) => (e.stopPropagation(), toggle('camera'))}>
                    <IconCaret className={`caret${camOpen ? ' open' : ''}`} />
                  </button>
                  <span className="ico" style={{ background: '#2563eb' }} title="Camera 3D">
                    <IconCamera width={11} height={11} strokeWidth={2.2} />
                  </span>
                  <span className="label">Camera</span>
                </div>
              }
              track={summaryKeys(cameraAnims)}
            />
            {camOpen &&
              CAMERA_PROPS.map((p) => (
                <TimelineRow
                  key={p.prop}
                  sub
                  trackWidth={contentW}
                  onTrackPointerDown={handleTrackPointerDown}
                  name={<div className="tl-name sub">{p.label}</div>}
                  track={renderKeys(project.camera[p.prop] as Animatable<AnimValue>, { kind: 'camera', prop: p.prop })}
                />
              ))}

            {segments.length > 0 && (
              <TimelineRow
                trackWidth={contentW}
                onTrackPointerDown={handleTrackPointerDown}
                name={
                  <div className="tl-name">
                    <span style={{ width: 20 }} />
                    <span className="ico" style={{ background: '#a78bfa' }}>
                      <IconFilm width={11} height={11} />
                    </span>
                    <span className="label">Camera đang quay</span>
                  </div>
                }
                track={
                  <div className="tl-shot-strip">
                    {segments.map((seg, i) => {
                      const s = seg.id ? shotById.get(seg.id) : undefined
                      return (
                        <div
                          key={i}
                          className={`tl-shot-seg${s ? '' : ' dark'}`}
                          style={{
                            left: x(seg.t0),
                            width: Math.max(2, x(seg.t1) - x(seg.t0)),
                            ...(s ? { ['--c' as string]: s.color } : {})
                          }}
                          title={`${s ? s.name : 'Không cảnh nào'} · ${seg.t0.toFixed(2)}s → ${seg.t1.toFixed(2)}s`}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            setTime(snapToFrame(seg.t0, comp.fps))
                            if (s) selectShot(s.id)
                          }}
                        >
                          {s ? s.name : '—'}
                        </div>
                      )
                    })}
                  </div>
                }
              />
            )}

            {globalAudioTracks.map((track, idx) => (
              <AudioRow
                key={track.id}
                track={track}
                trackIndex={idx}
                totalTracks={globalAudioTracks.length}
                x={x}
                trackW={contentW}
              />
            ))}

            {clusteredGroups.map((g) => {
              const shot = g.shot
              const gid = shot?.id ?? '__global'
              const isCollapsed = collapsed.has(gid)
              const shotOpen = shot ? expanded.has('shotkeys:' + shot.id) : false
              const shotAnims = shot ? SHOT_PROPS.map((p) => shot[p.prop] as Animatable<AnimValue>) : []
              return (
                <div key={gid} className="tl-group" style={shot ? ({ ['--c' as string]: shot.color } as React.CSSProperties) : undefined}>
                  {project.shots.length > 0 && (
                    <TimelineRow
                      className="group"
                      trackWidth={contentW}
                      onTrackPointerDown={handleTrackPointerDown}
                      selected={!!shot && shot.id === selectedShotId}
                      onClick={() => selectShot(shot ? shot.id : null)}
                      name={
                        <div className="tl-name group" id={`tl-group-${gid}`}>
                          <button className="mini" onClick={(e) => (e.stopPropagation(), toggleGroup(gid))}>
                            <IconCaret className={`caret${isCollapsed ? '' : ' open'}`} />
                          </button>
                          <span className="ico" style={{ background: shot?.color ?? '#64748b' }}>
                            <IconFilm width={11} height={11} />
                          </span>
                          <span className="label">{shot ? shot.name : 'Layer chung'}</span>
                          {shot && (
                            <button
                              className={`mini${shotOpen ? ' active' : ''}`}
                              title="Keyframe vị trí / xoay của cảnh"
                              onClick={(e) => (e.stopPropagation(), toggle('shotkeys:' + shot.id))}
                            >
                              ◆
                            </button>
                          )}
                          <span className="depth" title="Số layer">
                            {g.layers.length}
                          </span>
                        </div>
                      }
                      track={shot ? summaryKeys(shotAnims) : null}
                    />
                  )}
                  {shot &&
                    shotOpen &&
                    SHOT_PROPS.map((p) => (
                      <TimelineRow
                        key={p.prop}
                        sub
                        trackWidth={contentW}
                        onTrackPointerDown={handleTrackPointerDown}
                        name={<div className="tl-name sub">{p.label}</div>}
                        track={renderKeys(shot[p.prop] as Animatable<AnimValue>, { kind: 'shot', shotId: shot.id, prop: p.prop })}
                      />
                    ))}
                  {!isCollapsed &&
                    g.items.map((item) => {
                      if (item.kind === 'cluster') {
                        const isClusterCollapsed = collapsedClusters.has(item.instanceId)
                        return (
                          <div key={`cluster-${item.instanceId}`} className="tl-cluster-group">
                            <TimelineClusterRow
                              cluster={item}
                              isCollapsed={isClusterCollapsed}
                              isSelected={item.layers.some((l) => l.id === selectedLayerId)}
                              trackWidth={contentW}
                              x={x}
                              onToggleCollapse={() => toggleCluster(item.instanceId)}
                              onSelect={() => {
                                if (item.rootLayerId) selectLayer(item.rootLayerId)
                                else if (item.layers[0]) selectLayer(item.layers[0].id)
                              }}
                              onManageAudio={(tr) => setModalTrack(tr)}
                              onOpenAttachAudio={() => handleOpenAttachAudioForCluster(item)}
                              onTrackPointerDown={handleTrackPointerDown}
                              summaryKeys={summaryKeys}
                            />
                            {!isClusterCollapsed && (
                              <>
                                {/* Audio tracks thuộc riêng về cụm nhân vật / 3D */}
                                {item.audioTracks?.map((aTrack) => (
                                  <AudioRow
                                    key={aTrack.id}
                                    track={aTrack}
                                    nested={true}
                                    clusterRole="child"
                                    x={x}
                                    trackW={contentW}
                                  />
                                ))}

                                {/* Các layer thành phần của cụm nhân vật */}
                                {item.layers.map((layer) => (
                                  <TimelineLayerRow
                                    key={layer.id}
                                    layer={layer}
                                    nested={project.shots.length > 0 && !!shot}
                                    clusterRole="child"
                                    clusterType={item.clusterType}
                                    clusterName={item.name}
                                    isOpen={expanded.has(layer.id)}
                                    isSelected={layer.id === selectedLayerId}
                                    isRenaming={renaming === layer.id}
                                    x={x}
                                    trackWidth={contentW}
                                    onTrackPointerDown={handleTrackPointerDown}
                                    onBarContextMenu={handleLayerContextMenu}
                                    onToggleOpen={() => toggle(layer.id)}
                                    onSelect={() => selectLayer(layer.id)}
                                    setRenaming={setRenaming}
                                    startBarDrag={startBarDrag}
                                    startKeyDrag={startKeyDrag}
                                    renderKeys={renderKeys}
                                    summaryKeys={summaryKeys}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        )
                      }

                      const layer = item.layer
                      return (
                        <div key={layer.id} className="tl-single-layer-group">
                          <TimelineLayerRow
                            layer={layer}
                            nested={project.shots.length > 0 && !!shot}
                            isOpen={expanded.has(layer.id)}
                            isSelected={layer.id === selectedLayerId}
                            isRenaming={renaming === layer.id}
                            hasAudio={Boolean(item.audioTracks && item.audioTracks.length > 0)}
                            audioCount={item.audioTracks?.length || 0}
                            audioTracks={item.audioTracks}
                            onManageAudio={(tr) => setModalTrack(tr || (item.audioTracks?.[0] ?? null))}
                            onOpenAttachAudio={() => handleOpenAttachAudioForLayer(layer)}
                            x={x}
                            trackWidth={contentW}
                            onTrackPointerDown={handleTrackPointerDown}
                            onBarContextMenu={handleLayerContextMenu}
                            onToggleOpen={() => toggle(layer.id)}
                            onSelect={() => selectLayer(layer.id)}
                            setRenaming={setRenaming}
                            startBarDrag={startBarDrag}
                            startKeyDrag={startKeyDrag}
                            renderKeys={renderKeys}
                            summaryKeys={summaryKeys}
                          />
                          {/* Audio tracks thuộc riêng về layer đơn lẻ này */}
                          {item.audioTracks?.map((aTrack) => (
                            <AudioRow
                              key={aTrack.id}
                              track={aTrack}
                              nested={true}
                              clusterRole="child"
                              x={x}
                              trackW={contentW}
                            />
                          ))}
                        </div>
                      )
                    })}
                </div>
              )
            })}
            {project.layers.length === 0 && (
              <div className="empty">Chưa có layer. Thêm ảnh, text, solid hoặc particles từ thanh công cụ.</div>
            )}

            {/* Playhead vertical line passing through all tracks */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: nameW, width: contentW, pointerEvents: 'none' }}>
              <TimelinePlayhead x={x} />
            </div>
          </div>
        </div>
      </div>

      {modalTrack && (
        <AudioTargetModal track={modalTrack} onClose={() => setModalTrack(null)} />
      )}
    </section>
  )
}

