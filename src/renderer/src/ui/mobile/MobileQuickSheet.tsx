import React from 'react'
import type { EaseName, Vec3 } from '@shared/types'
import {
  addParticleLayer,
  addTextLayer,
  flyToShot,
  importAudio,
  importImages,
  toast
} from '../../actions'
import { addKeyframe, evaluate, keyAt } from '../../animation/keyframes'
import { timelineSegmentAt } from '../../animation/timelineRange'
import { frameTolerance, getAnimatable, useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  IconCamera,
  IconCube,
  IconFolder,
  IconImage,
  IconKeyframeDiamond,
  IconLayerAssembly,
  IconMusic,
  IconScissors,
  IconSparkles,
  IconSquare,
  IconStepBack,
  IconStepFwd,
  IconText,
  IconTrimLeft,
  IconTrimRight,
  IconX
} from '../icons'
import { requestOpenLayerAssembly } from '../layerAssembly/layerAssemblyBridge'
import {
  resetSelectedLayerTiming,
  setSelectedLayerInPoint,
  setSelectedLayerOutPoint,
  splitSelectedLayer
} from '../timeline/timelineActions'
import {
  activeTimelineRef,
  navigateTimelineKey,
  setTimelineEase,
  toggleTimelineKey
} from '../timeline/timelineKeyEditing'
import type { MobileQuickSheetMode } from './MobileActionStrip'

export interface MobileQuickSheetProps {
  mode: Exclude<MobileQuickSheetMode, null>
  onClose: () => void
}

const EASE_OPTIONS: { id: EaseName; label: string }[] = [
  { id: 'easeInOut', label: 'Mượt' },
  { id: 'linear', label: 'Đều' },
  { id: 'easeOut', label: 'Giảm tốc' },
  { id: 'hold', label: 'Giữ tĩnh' }
]

export const MobileQuickSheet: React.FC<MobileQuickSheetProps> = ({ mode, onClose }) => {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedShotId = useEditor((s) => s.selectedShotId)
  const layer = selectedLayerId ? project.layers.find((l) => l.id === selectedLayerId) ?? null : null
  const tol = frameTolerance(project)

  const setLayerVecAxis = (
    prop: 'position' | 'rotation' | 'scale',
    axis: 0 | 1 | 2,
    nextVal: number,
    uniformScale = false
  ): void => {
    if (!layer) return
    useEditor.getState().update((draft) => {
      const target = draft.layers.find((l) => l.id === layer.id)
      if (!target) return
      const anim = target.transform[prop]
      const cur = [...evaluate(anim, time)] as Vec3
      if (uniformScale) {
        cur[0] = nextVal
        cur[1] = nextVal
      } else {
        cur[axis] = nextVal
      }
      if (anim.keyframes.length > 0) {
        addKeyframe(anim, time, cur, 'easeInOut', tol)
      } else {
        anim.value = cur
      }
    })
  }

  const setLayerOpacity = (nextPct: number): void => {
    if (!layer) return
    const val = Math.max(0, Math.min(1, nextPct / 100))
    useEditor.getState().update((draft) => {
      const target = draft.layers.find((l) => l.id === layer.id)
      if (!target) return
      const anim = target.transform.opacity
      if (anim.keyframes.length > 0) {
        addKeyframe(anim, time, val, 'easeInOut', tol)
      } else {
        anim.value = val
      }
    })
  }

  const setCameraZOrFov = (field: 'z' | 'fov', val: number): void => {
    useEditor.getState().update((draft) => {
      if (field === 'fov') {
        if (draft.camera.fov.keyframes.length > 0) {
          addKeyframe(draft.camera.fov, time, val, 'easeInOut', tol)
        } else {
          draft.camera.fov.value = val
        }
      } else {
        const cur = [...evaluate(draft.camera.position, time)] as Vec3
        cur[2] = val
        if (draft.camera.position.keyframes.length > 0) {
          addKeyframe(draft.camera.position, time, cur, 'easeInOut', tol)
        } else {
          draft.camera.position.value = cur
        }
      }
    })
  }

  const recordCameraWaypointNow = (): void => {
    useEditor.getState().update((draft) => {
      const pos = evaluate(draft.camera.position, time)
      const tgt = evaluate(draft.camera.target, time)
      const fov = evaluate(draft.camera.fov, time)
      addKeyframe(draft.camera.position, time, [...pos] as Vec3, 'easeInOut', tol)
      addKeyframe(draft.camera.target, time, [...tgt] as Vec3, 'easeInOut', tol)
      addKeyframe(draft.camera.fov, time, fov, 'easeInOut', tol)
    })
    toast(`🎥 Đã ghi Mốc Camera 3D tại ${time.toFixed(2)}s`)
  }

  const openAssetTab = (sub: 'builtin' | 'assembly' | '3d' | 'music' | 'project'): void => {
    const v = useView.getState()
    v.setLeftCollapsed(false)
    v.setLeftTab('assets')
    v.setAssetSubTab(sub)
    v.setMobileTab('left')
    onClose()
  }

  const title =
    mode === 'transform'
      ? `✥ Vị trí & Chiều sâu 2.5D · ${layer?.name ?? 'Layer'}`
      : mode === 'timing'
        ? `⏱ Cắt đoạn & Nhịp Keyframe · ${layer?.name ?? 'Layer'}`
        : mode === 'camera'
          ? '🎬 Phân cảnh & Ống kính Camera 3D'
          : '➕ Thêm nhanh Layer vào Cảnh'

  const pos = layer ? evaluate(layer.transform.position, time) : ([0, 0, 0] as Vec3)
  const rot = layer ? evaluate(layer.transform.rotation, time) : ([0, 0, 0] as Vec3)
  const scl = layer ? evaluate(layer.transform.scale, time) : ([1, 1, 1] as Vec3)
  const opa = layer ? Math.round(evaluate(layer.transform.opacity, time) * 100) : 100
  const camPos = evaluate(project.camera.position, time)
  const camFov = Math.round(evaluate(project.camera.fov, time))

  const ref = activeTimelineRef()
  const anim = ref ? getAnimatable(project, ref) : undefined
  const hasKeyHere = Boolean(anim && keyAt(anim, time, tol))
  const curEase: EaseName = anim ? timelineSegmentAt(anim, time).start?.ease ?? 'easeInOut' : 'easeInOut'

  return (
    <section
      className="cc-quick-sheet"
      data-mcp-region="mobile_quick_sheet"
      data-mcp-dialog
      data-ai-surface="dialog"
      data-ai-surface-label={title}
      role="dialog"
      aria-label={title}
    >
      <header className="cc-qsheet-head">
        <strong className="cc-qsheet-title">{title}</strong>
        <button type="button" className="cc-qsheet-close" onClick={onClose} aria-label="Đóng bảng chỉnh nhanh">
          <IconX width={14} height={14} />
          <span>Xong</span>
        </button>
      </header>

      <div className="cc-qsheet-body">
        {mode === 'transform' && layer && (
          <div className="cc-slider-list">
            <label className="cc-slider-row highlight-z">
              <span className="cc-sl-label">Độ sâu Z</span>
              <input
                type="range"
                min={-1200}
                max={2200}
                step={5}
                value={Math.round(pos[2])}
                onChange={(e) => setLayerVecAxis('position', 2, Number(e.target.value))}
              />
              <span className="cc-sl-val">{Math.round(pos[2])}</span>
            </label>

            <label className="cc-slider-row">
              <span className="cc-sl-label">Ngang X</span>
              <input
                type="range"
                min={-1600}
                max={1600}
                step={4}
                value={Math.round(pos[0])}
                onChange={(e) => setLayerVecAxis('position', 0, Number(e.target.value))}
              />
              <span className="cc-sl-val">{Math.round(pos[0])}</span>
            </label>

            <label className="cc-slider-row">
              <span className="cc-sl-label">Cao Y</span>
              <input
                type="range"
                min={-1000}
                max={1000}
                step={4}
                value={Math.round(pos[1])}
                onChange={(e) => setLayerVecAxis('position', 1, Number(e.target.value))}
              />
              <span className="cc-sl-val">{Math.round(pos[1])}</span>
            </label>

            <label className="cc-slider-row">
              <span className="cc-sl-label">Tỉ lệ %</span>
              <input
                type="range"
                min={10}
                max={350}
                step={2}
                value={Math.round(scl[0] * 100)}
                onChange={(e) => setLayerVecAxis('scale', 0, Number(e.target.value) / 100, true)}
              />
              <span className="cc-sl-val">{Math.round(scl[0] * 100)}%</span>
            </label>

            <label className="cc-slider-row">
              <span className="cc-sl-label">Xoay °</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={Math.round(rot[2])}
                onChange={(e) => setLayerVecAxis('rotation', 2, Number(e.target.value))}
              />
              <span className="cc-sl-val">{Math.round(rot[2])}°</span>
            </label>

            <label className="cc-slider-row">
              <span className="cc-sl-label">Độ rõ</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={opa}
                onChange={(e) => setLayerOpacity(Number(e.target.value))}
              />
              <span className="cc-sl-val">{opa}%</span>
            </label>
          </div>
        )}

        {mode === 'timing' && layer && (
          <div className="cc-timing-grid-wrap">
            <div className="cc-timing-span-info">
              <span>Hiển thị: <b>{layer.inPoint.toFixed(2)}s</b> → <b>{layer.outPoint.toFixed(2)}s</b></span>
              <span>Kim phát: <b>{time.toFixed(2)}s</b></span>
            </div>

            <div className="cc-btn-grid-4">
              <button type="button" className="cc-grid-btn" onClick={() => setSelectedLayerInPoint()}>
                <IconTrimLeft width={15} height={15} />
                <span>Đặt đầu In</span>
              </button>
              <button type="button" className="cc-grid-btn" onClick={() => splitSelectedLayer()}>
                <IconScissors width={15} height={15} />
                <span>Tách đôi</span>
              </button>
              <button type="button" className="cc-grid-btn" onClick={() => setSelectedLayerOutPoint()}>
                <IconTrimRight width={15} height={15} />
                <span>Đặt đuôi Out</span>
              </button>
              <button type="button" className="cc-grid-btn" onClick={() => resetSelectedLayerTiming()}>
                <IconSquare width={15} height={15} />
                <span>Toàn cảnh</span>
              </button>
            </div>

            <div className="cc-key-nav-row">
              <button
                type="button"
                className="cc-pill-btn"
                onClick={() => ref && navigateTimelineKey(ref, -1)}
              >
                <IconStepBack width={13} height={13} />
                <span>Mốc trước</span>
              </button>
              <button
                type="button"
                className={`cc-pill-btn key-toggle${hasKeyHere ? ' active' : ''}`}
                onClick={() => ref && toggleTimelineKey(ref)}
              >
                <IconKeyframeDiamond width={13} height={13} />
                <span>{hasKeyHere ? 'Xoá Mốc này' : '+ Đặt Mốc'}</span>
              </button>
              <button
                type="button"
                className="cc-pill-btn"
                onClick={() => ref && navigateTimelineKey(ref, 1)}
              >
                <span>Mốc sau</span>
                <IconStepFwd width={13} height={13} />
              </button>
            </div>

            <div className="cc-ease-pills" role="group" aria-label=" Gia tốc chuyển động Keyframe">
              {EASE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`cc-ease-pill${curEase === opt.id ? ' active' : ''}`}
                  onClick={() => ref && setTimelineEase(ref, opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'camera' && (
          <div className="cc-camera-sheet">
            <div className="cc-shot-pills">
              {project.shots.map((sh, idx) => {
                const active = sh.id === selectedShotId
                return (
                  <button
                    key={sh.id}
                    type="button"
                    className={`cc-shot-pill${active ? ' active' : ''}`}
                    onClick={() => {
                      useEditor.getState().selectShot(sh.id)
                      flyToShot(sh.id)
                    }}
                  >
                    <span className="cc-shot-dot" style={{ background: sh.color }} />
                    <span>#{idx + 1} {sh.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="cc-slider-list">
              <label className="cc-slider-row highlight-z">
                <span className="cc-sl-label">Đẩy sâu Cam</span>
                <input
                  type="range"
                  min={-3600}
                  max={1200}
                  step={10}
                  value={Math.round(camPos[2])}
                  onChange={(e) => setCameraZOrFov('z', Number(e.target.value))}
                />
                <span className="cc-sl-val">{Math.round(camPos[2])}</span>
              </label>

              <label className="cc-slider-row">
                <span className="cc-sl-label">Ống kính FOV</span>
                <input
                  type="range"
                  min={18}
                  max={95}
                  step={1}
                  value={camFov}
                  onChange={(e) => setCameraZOrFov('fov', Number(e.target.value))}
                />
                <span className="cc-sl-val">{camFov}°</span>
              </label>
            </div>

            <div className="cc-cam-cta-row">
              <button type="button" className="cc-pill-btn primary" onClick={recordCameraWaypointNow}>
                <IconCamera width={14} height={14} />
                <span>+ Ghi Mốc Camera ({time.toFixed(1)}s)</span>
              </button>
              <button
                type="button"
                className="cc-pill-btn"
                onClick={() => {
                  useView.getState().openDialog('path')
                  onClose()
                }}
              >
                <span>Lộ trình tự động…</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'add' && (
          <div className="cc-add-grid">
            <button type="button" className="cc-add-card" onClick={() => openAssetTab('builtin')}>
              <IconFolder width={18} height={18} />
              <span>Kho mẫu 2.5D</span>
            </button>
            <button
              type="button"
              className="cc-add-card"
              onClick={() => {
                onClose()
                requestOpenLayerAssembly()
              }}
            >
              <IconLayerAssembly width={18} height={18} />
              <span>Nhân vật Rig</span>
            </button>
            <button type="button" className="cc-add-card" onClick={() => openAssetTab('3d')}>
              <IconCube width={18} height={18} />
              <span>Mô hình 3D</span>
            </button>
            <button
              type="button"
              className="cc-add-card"
              onClick={() => {
                addTextLayer()
                onClose()
              }}
            >
              <IconText width={18} height={18} />
              <span>Chữ (Text)</span>
            </button>
            <button
              type="button"
              className="cc-add-card"
              onClick={() => {
                importImages(true)
                onClose()
              }}
            >
              <IconImage width={18} height={18} />
              <span>Ảnh PNG/JPG</span>
            </button>
            <button
              type="button"
              className="cc-add-card"
              onClick={() => {
                addParticleLayer()
                onClose()
              }}
            >
              <IconSparkles width={18} height={18} />
              <span>Hạt / Đom đóm</span>
            </button>

            <button
              type="button"
              className="cc-add-card"
              onClick={() => {
                importAudio()
                onClose()
              }}
            >
              <IconMusic width={18} height={18} />
              <span>Nhạc & Thoại</span>
            </button>


          </div>
        )}
      </div>
    </section>
  )
}
