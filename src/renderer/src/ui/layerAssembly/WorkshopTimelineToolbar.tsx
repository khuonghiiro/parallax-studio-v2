import type { ReactNode } from 'react'
import type { BoneEasing } from '@shared/layerRig'
import {
  IconPause,
  IconPlay,
  IconSkipEnd,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
  IconLoop,
  IconEaseSmooth,
  IconEaseLinear,
  IconEaseOut,
  IconEaseIn,
  IconEaseHold,
  IconFilterAll,
  IconFilterKeyed,
  IconFilterSelected
} from '../icons'
import type { DopeSheetTrackFilter } from './animAssistStore'
import {
  IconAutoKeyRec,
  IconFrameHold,
  IconKeyNext,
  IconKeyPrev,
  IconKeyframeAdd,
  IconKeyframeDelete
} from './LayerWorkshopStudioIcons'

const QUICK_EASINGS = [
  { id: 'smooth' as const, label: 'Mượt', title: 'Motion Tween mượt tự nhiên (Smooth Spline)', Icon: IconEaseSmooth },
  { id: 'linear' as const, label: 'Đều', title: 'Chuyển động tốc độ đều (Linear Tween)', Icon: IconEaseLinear },
  { id: 'ease-out' as const, label: 'Giảm tốc', title: 'Nhanh đầu, chậm dần cuối (Ease Out)', Icon: IconEaseOut },
  { id: 'ease-in' as const, label: 'Tăng tốc', title: 'Chậm đầu, nhanh dần cuối (Ease In)', Icon: IconEaseIn },
  { id: 'hold' as const, label: 'Giữ bậc', title: 'Giữ nguyên tư thế đến mốc kế tiếp (Step / Hold Frame)', Icon: IconEaseHold }
]

const FILTER_OPTIONS = [
  { id: 'all' as const, label: 'Tất cả', title: 'Hiện toàn bộ xương trên Dope Sheet', Icon: IconFilterAll },
  { id: 'keyed' as const, label: 'Có Key', title: 'Chỉ hiện các xương đã có Keyframe', Icon: IconFilterKeyed },
  { id: 'selected' as const, label: 'Đang chọn', title: 'Chỉ hiện xương đang chọn', Icon: IconFilterSelected }
]

export interface TimelineKeyTimeEditor {
  draft: string
  setDraft: (v: string) => void
  commit: () => void
  max: number
}

export interface WorkshopTimelineToolbarProps {
  isPlaying: boolean
  loop: boolean
  frame: number
  totalFrames: number
  time: number
  fps: number
  dragLabel?: string
  deleteCount: number
  keyTime: TimelineKeyTimeEditor | null
  autoKey: boolean
  activeEasing?: BoneEasing
  easingDisabled: boolean
  filter: DopeSheetTrackFilter
  zoom: number
  collapsed: boolean
  onTogglePlay: () => void
  onToggleLoop: () => void
  onSeekFrame: (frame: number) => void
  onStep: (delta: -1 | 1) => void
  onJump: (direction: -1 | 1) => void
  onAddKey: () => void
  onHold: () => void
  onRemove: () => void
  onToggleAutoKey: () => void
  onEasing: (easing: BoneEasing) => void
  onFilter: (filter: DopeSheetTrackFilter) => void
  onZoom: (zoom: number) => void
  onToggleCollapsed: () => void
}

function ToolIcon({ title, onClick, disabled, className = '', children }: { title: string; onClick: () => void; disabled?: boolean; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={`lw-tl-icon-btn ${className}`} onClick={onClick} disabled={disabled} title={title} aria-label={title}>
      {children}
    </button>
  )
}

/** Cụm điều khiển phát kiểu Adobe Animate: ⏮ ◁ ▶ ▷ ⏭ · ◀◆ ◆▶ · Lặp + ô nhập số Frame. */
function TransportCluster(p: WorkshopTimelineToolbarProps) {
  return (
    <div className="lw-tl-group lw-tl-transport" role="group" aria-label="Điều khiển phát">
      <ToolIcon title="Về Frame đầu (Home)" onClick={() => p.onSeekFrame(0)}><IconSkipStart width={13} height={13} /></ToolIcon>
      <ToolIcon title="Lùi 1 Frame (,)" onClick={() => p.onStep(-1)}><IconStepBack width={13} height={13} /></ToolIcon>
      <ToolIcon title={p.isPlaying ? 'Tạm dừng hành động' : 'Phát hành động'} onClick={p.onTogglePlay} className={`is-play${p.isPlaying ? ' is-playing' : ''}`}>
        {p.isPlaying ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
      </ToolIcon>
      <ToolIcon title="Tiến 1 Frame (.)" onClick={() => p.onStep(1)}><IconStepFwd width={13} height={13} /></ToolIcon>
      <ToolIcon title="Tới Frame cuối (End)" onClick={() => p.onSeekFrame(p.totalFrames)}><IconSkipEnd width={13} height={13} /></ToolIcon>
      <span className="lw-tl-sep" aria-hidden />
      <ToolIcon title="Nhảy tới Keyframe trước" onClick={() => p.onJump(-1)}><IconKeyPrev width={13} height={13} /></ToolIcon>
      <ToolIcon title="Nhảy tới Keyframe sau" onClick={() => p.onJump(1)}><IconKeyNext width={13} height={13} /></ToolIcon>
      <ToolIcon title={p.loop ? 'Đang phát lặp vòng · bấm để phát 1 lần' : 'Phát 1 lần · bấm để lặp vòng'} onClick={p.onToggleLoop} className={p.loop ? 'is-on' : ''}>
        <IconLoop width={13} height={13} />
      </ToolIcon>
      <label className="lw-tl-readout" title="Frame hiện tại · nhập số để nhảy tới Frame">
        <input
          type="number"
          min={0}
          max={p.totalFrames}
          value={p.frame}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) p.onSeekFrame(Math.max(0, Math.min(p.totalFrames, Math.round(v))))
          }}
          aria-label="Frame hiện tại"
        />
        <span className="lw-tl-readout-meta">
          / {p.totalFrames} <em>{p.dragLabel ?? `${p.time.toFixed(2)}s · ${p.fps}fps`}</em>
        </span>
      </label>
    </div>
  )
}

/** Cụm thao tác Keyframe: F6 chèn key · F5 giữ dáng · F7 xoá · ô Mốc giây · Auto-Key. */
function KeyCluster(p: WorkshopTimelineToolbarProps) {
  return (
    <div className="lw-tl-group lw-tl-keys" role="group" aria-label="Thao tác Keyframe">
      <button type="button" className="lw-tl-text-btn is-primary" onClick={p.onAddKey} title="Chèn Keyframe tại đầu phát (F6)">
        <IconKeyframeAdd width={12} height={12} /><span>Key</span><kbd>F6</kbd>
      </button>
      <button type="button" className="lw-tl-text-btn" onClick={p.onHold} title="Giữ dáng thêm 3 Frame, đẩy các key sau lùi lại (F5)">
        <IconFrameHold width={12} height={12} /><span>+3F</span><kbd>F5</kbd>
      </button>
      <button type="button" className={`lw-tl-text-btn${p.deleteCount > 0 ? ' is-danger' : ''}`} disabled={p.deleteCount === 0} onClick={p.onRemove} title="Xoá Keyframe đang chọn (Delete / F7)">
        <IconKeyframeDelete width={12} height={12} /><span>{p.deleteCount > 1 ? `Xoá ${p.deleteCount}` : 'Xoá'}</span><kbd>F7</kbd>
      </button>
      {p.keyTime && (
        <label className="lw-dope-keytime-box" title="Nhập mốc giây mới cho Key / Tư thế đang chọn">
          <span>Mốc</span>
          <input
            type="number"
            min={0}
            max={p.keyTime.max}
            step={0.05}
            value={p.keyTime.draft}
            onChange={(e) => p.keyTime?.setDraft(e.target.value)}
            onBlur={p.keyTime.commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                p.keyTime?.commit()
              }
            }}
          />
          <small>s</small>
        </label>
      )}
      <button type="button" className={`lw-autokey-pill compact${p.autoKey ? ' active' : ''}`} onClick={p.onToggleAutoKey} title="Bật/tắt Auto-Key khi kéo xương" aria-pressed={p.autoKey}>
        <IconAutoKeyRec width={10} height={10} />
        <span>Auto</span>
      </button>
    </div>
  )
}

/** Cụm phụ: kiểu nội suy Tween, lọc hàng xương, zoom và thu gọn. */
function ViewCluster(p: WorkshopTimelineToolbarProps) {
  return (
    <div className="lw-tl-group lw-tl-view">
      <div className="lw-dope-seg" role="group" aria-label="Kiểu nội suy Tween">
        {QUICK_EASINGS.map((item) => (
          <button key={item.id} type="button" disabled={p.easingDisabled} className={`lw-dope-seg-btn${p.activeEasing === item.id ? ' active' : ''}`} onClick={() => p.onEasing(item.id)} title={item.title} aria-label={item.label}>
            <span className="lw-seg-icon"><item.Icon width={12} height={12} /></span>
            <span className="lw-seg-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="lw-dope-seg" role="group" aria-label="Lọc hàng xương">
        {FILTER_OPTIONS.map((f) => (
          <button key={f.id} type="button" className={`lw-dope-seg-btn${p.filter === f.id ? ' active' : ''}`} onClick={() => p.onFilter(f.id)} title={f.title} aria-label={f.label}>
            <span className="lw-seg-icon"><f.Icon width={11} height={11} /></span>
            <span className="lw-seg-label">{f.label}</span>
          </button>
        ))}
      </div>
      <div className="lw-dope-zoom" role="group" aria-label="Thu phóng timeline">
        <ToolIcon title="Thu nhỏ timeline" disabled={p.zoom <= 1} onClick={() => p.onZoom(Math.max(1, p.zoom / 2))}>−</ToolIcon>
        <span>{p.zoom}×</span>
        <ToolIcon title="Phóng to timeline" disabled={p.zoom >= 8} onClick={() => p.onZoom(Math.min(8, p.zoom * 2))}>+</ToolIcon>
      </div>
      <button type="button" className="lw-tl-text-btn" onClick={p.onToggleCollapsed} title={p.collapsed ? 'Mở rộng bảng rãnh Dope Sheet' : 'Thu gọn bảng rãnh Dope Sheet'} aria-expanded={!p.collapsed}>
        <span>{p.collapsed ? '▴ Mở rãnh' : '▾ Gọn'}</span>
      </button>
    </div>
  )
}

/** Thanh công cụ Dope Sheet kiểu Adobe Animate: tự xuống dòng theo bề rộng (container query) thay vì cắt chữ. */
export function WorkshopTimelineToolbar(props: WorkshopTimelineToolbarProps) {
  return (
    <div className="lw-animation-timeline-toolbar lw-tl-toolbar">
      <TransportCluster {...props} />
      <KeyCluster {...props} />
      <ViewCluster {...props} />
    </div>
  )
}
