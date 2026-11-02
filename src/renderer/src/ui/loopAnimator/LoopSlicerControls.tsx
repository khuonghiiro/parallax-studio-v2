import React from 'react'
import { toast } from '../../actions'
import { IconAim, IconAnchor, IconBoundingBox, IconLightning } from '../icons'
import { useLoopAnimator } from './loopAnimatorState'
import type { ContourSlicerConfig, GridSlicerConfig } from './types'

interface Props {
  sourceCanvasRef: React.RefObject<HTMLCanvasElement | null>
  onRunContour: () => void
}

/** Ô nhập số có nhãn nằm trong khung — dễ nhận biết, chiều cao 30px thống nhất */
export function LoopNumField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  title,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  title?: string
  onChange: (v: number) => void
}): React.ReactElement {
  return (
    <label className="la-num" title={title ?? label}>
      <span className="la-num-label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
      />
      {unit && <span className="la-num-unit">{unit}</span>}
    </label>
  )
}

function GridControls({ grid, set }: { grid: GridSlicerConfig; set: (p: Partial<GridSlicerConfig>) => void }): React.ReactElement {
  return (
    <div className="loop-ctrl-row">
      <div className="loop-ctrl-group">
        <span className="la-label">Lưới</span>
        <LoopNumField label="Cột" value={grid.cols} min={1} max={32} onChange={(v) => set({ cols: v })} />
        <LoopNumField label="Hàng" value={grid.rows} min={1} max={32} onChange={(v) => set({ rows: v })} />
      </div>
      <div className="loop-ctrl-group">
        <span className="la-label">Lề ngoài</span>
        <LoopNumField label="X" unit="px" value={grid.marginX} min={0} max={400} onChange={(v) => set({ marginX: v })} title="Lề trái/phải của sprite sheet" />
        <LoopNumField label="Y" unit="px" value={grid.marginY} min={0} max={400} onChange={(v) => set({ marginY: v })} title="Lề trên/dưới của sprite sheet" />
      </div>
      <div className="loop-ctrl-group">
        <span className="la-label">Khe giữa ô</span>
        <LoopNumField label="X" unit="px" value={grid.paddingX} min={0} max={200} onChange={(v) => set({ paddingX: v })} title="Khoảng trống ngang giữa các ô" />
        <LoopNumField label="Y" unit="px" value={grid.paddingY} min={0} max={200} onChange={(v) => set({ paddingY: v })} title="Khoảng trống dọc giữa các ô" />
      </div>
    </div>
  )
}

function Seg<T extends string>({
  value,
  items,
  onChange
}: {
  value: T
  items: { id: T; label: string; title: string }[]
  onChange: (v: T) => void
}): React.ReactElement {
  return (
    <div className="la-seg">
      {items.map((it) => (
        <button key={it.id} type="button" className={`la-seg-btn${value === it.id ? ' active' : ''}`} onClick={() => onChange(it.id)} title={it.title}>
          {it.label}
        </button>
      ))}
    </div>
  )
}

function ContourControls({
  cfg,
  set,
  onRun,
  onEqualize,
  onCenter
}: {
  cfg: ContourSlicerConfig
  set: (p: Partial<ContourSlicerConfig>) => void
  onRun: () => void
  onEqualize: () => void
  onCenter: () => void
}): React.ReactElement {
  return (
    <div className="loop-ctrl-row">
      <div className="loop-ctrl-group">
        <LoopNumField label="Alpha" value={cfg.alphaThreshold} min={1} max={250} onChange={(v) => set({ alphaThreshold: v })} title="Ngưỡng alpha coi là có nội dung" />
        <LoopNumField label="Gộp" unit="px" value={cfg.mergeGap} min={0} max={64} onChange={(v) => set({ mergeGap: v })} title="Gộp các mảnh gần nhau trong khoảng cách này" />
        <LoopNumField label="Tối thiểu" unit="px²" value={cfg.minArea} min={16} max={5000} step={50} onChange={(v) => set({ minArea: v })} title="Bỏ qua vùng nhỏ hơn diện tích này (bụi, tàn lửa)" />
      </div>
      <div className="loop-ctrl-group">
        <span className="la-label">Neo</span>
        <Seg
          value={cfg.alignAnchor ?? 'bottom'}
          onChange={(v) => set({ alignAnchor: v })}
          items={[
            { id: 'bottom', label: 'Đáy', title: 'Căn đáy sàn — giữ chân đế cố định' },
            { id: 'center', label: 'Tâm', title: 'Căn tâm — hợp với phép thuật, vật bay' }
          ]}
        />
        <span className="la-label">Thứ tự</span>
        <Seg
          value={cfg.readingOrder ?? 'row_first'}
          onChange={(v) => set({ readingOrder: v })}
          items={[
            { id: 'row_first', label: 'Hàng', title: 'Trái → phải, trên → dưới' },
            { id: 'snake', label: 'Zic-zắc', title: 'Hàng lẻ trái → phải, hàng chẵn phải → trái' },
            { id: 'col_first', label: 'Cột', title: 'Trên → dưới, trái → phải' }
          ]}
        />
        <label className="la-check" title="Đồng bộ kích thước mọi khung để triệt tiêu nhịp đập co giãn">
          <input type="checkbox" checked={cfg.uniformSize ?? true} onChange={(e) => set({ uniformSize: e.target.checked })} />
          <span>Đồng cỡ</span>
        </label>
      </div>
      <div className="loop-ctrl-group loop-ctrl-group--end">
        <button type="button" className="la-btn la-btn--primary la-btn--sm" onClick={onRun} title="Quét các vùng ảnh tách biệt để đóng khung từng frame">
          <IconLightning width={12} height={12} />
          <span>Quét tách</span>
        </button>
        <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={onEqualize} title="Đặt mọi khung về cùng kích thước lớn nhất">
          <IconBoundingBox width={12} height={12} />
          <span>Đồng cỡ</span>
        </button>
        <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={onCenter} title="Căn tâm & đáy sàn để hoạt ảnh không bị nảy">
          <IconAnchor width={12} height={12} />
          <span>Căn chân</span>
        </button>
      </div>
    </div>
  )
}

export function LoopSlicerControls({ sourceCanvasRef, onRunContour }: Props): React.ReactElement | null {
  const slicerMode = useLoopAnimator((s) => s.slicerMode)
  const gridConfig = useLoopAnimator((s) => s.gridConfig)
  const contourConfig = useLoopAnimator((s) => s.contourConfig)
  const setGridConfig = useLoopAnimator((s) => s.setGridConfig)
  const setContourConfig = useLoopAnimator((s) => s.setContourConfig)
  const equalizeFrameSizes = useLoopAnimator((s) => s.equalizeFrameSizes)
  const autoCenterFrames = useLoopAnimator((s) => s.autoCenterFrames)

  const center = (): void => {
    autoCenterFrames(sourceCanvasRef.current)
    toast('🎯 Đã căn tâm và đáy sàn chống nảy cho tất cả frame')
  }

  if (slicerMode === 'grid') return <GridControls grid={gridConfig} set={setGridConfig} />
  if (slicerMode === 'contour') {
    return (
      <ContourControls
        cfg={contourConfig}
        set={setContourConfig}
        onRun={onRunContour}
        onEqualize={() => {
          equalizeFrameSizes()
          toast('📏 Đã đồng bộ kích thước khung hình')
        }}
        onCenter={center}
      />
    )
  }
  return (
    <div className="loop-ctrl-row loop-ctrl-row--hint">
      <span className="loop-hint-text">Kéo trực tiếp từng khung trên ảnh để dời vùng cắt, hoặc nhập X / Y / W / H ở dải frame bên dưới.</span>
      <button type="button" className="la-btn la-btn--outline la-btn--sm" onClick={center}>
        <IconAim width={12} height={12} />
        <span>Căn tâm tự động</span>
      </button>
    </div>
  )
}
