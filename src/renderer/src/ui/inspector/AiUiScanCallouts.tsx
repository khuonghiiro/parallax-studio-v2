import { useEffect, useMemo, useState } from 'react'
import type { AiInspectorSnapshot, ScannedElementContext } from './aiUiInspectorScanner'
import { layoutScanCallouts, type CalloutBox, type CalloutPlacement } from './aiUiCalloutLayout'
import '../../styles/aiUiInspectorScanFx.css'

/**
 * Hiệu ứng HUD sau khi quét: khung vùng quét có góc ngắm + tia quét, khung góc trên từng phần tử,
 * nhãn thông tin xếp cột bên ngoài vùng quét nối bằng đường nét đứt vuông góc (không đè nhau).
 */

interface Props {
  mode?: 'context' | 'code'
  snapshot: AiInspectorSnapshot
  waveId: number
  /** Vùng cấm đặt nhãn (toast) */
  reserved: CalloutBox[]
  /** Giữ hiệu ứng (người dùng đang rê chuột vào toast) */
  held?: boolean
}

type Viewport = { width: number; height: number }

function fileRef(item: ScannedElementContext): string | null {
  const raw = item.sourceLocation || item.primaryFile
  if (!raw) return null
  const parts = raw.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || raw
}

function labelTitle(item: ScannedElementContext): string {
  const raw =
    item.text ||
    item.controlDetails?.fieldLabel ||
    item.part25D?.name ||
    item.bone25D?.name ||
    item.title ||
    `<${item.tagName}>`
  return raw.length > 38 ? `${raw.slice(0, 36)}…` : raw
}

function readViewport(): Viewport {
  return {
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080
  }
}

function useViewportSize(): Viewport {
  const [size, setSize] = useState(readViewport)
  useEffect(() => {
    const onResize = () => setSize(readViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

const indexVar = (i: number) => ({ ['--i' as string]: i })

function Corners() {
  return (
    <>
      <i className="ai-ui-scan-corner tl" />
      <i className="ai-ui-scan-corner tr" />
      <i className="ai-ui-scan-corner bl" />
      <i className="ai-ui-scan-corner br" />
    </>
  )
}

function ScanRegion({ rect, count }: { rect: CalloutBox; count: number }) {
  if (rect.width < 10 || rect.height < 10) return null
  return (
    <div className="ai-ui-scan-region" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      <Corners />
      <div className="ai-ui-scan-beam" />
      <div className="ai-ui-scan-region-chip">
        SCAN · {rect.width}×{rect.height} · {count} MỤC TIÊU
      </div>
    </div>
  )
}

function ScanTargets({ items }: { items: ScannedElementContext[] }) {
  return (
    <>
      {items.map((item, idx) => {
        const b = item.bounds
        if (b.width <= 0 || b.height <= 0) return null
        const isPrimary = item.isPrimaryFocus
        const isFocused = item.isFocused
        const isActive = item.isActive
        const targetCls = `ai-ui-scan-target${isPrimary ? ' is-primary' : ''}${isFocused ? ' is-focused' : ''}${isActive ? ' is-active' : ''}`
        return (
          <div
            key={`scan-target-${idx}`}
            className={targetCls}
            style={{ left: b.left, top: b.top, width: Math.max(14, b.width), height: Math.max(14, b.height), ...indexVar(idx) }}
          >
            <Corners />
          </div>
        )
      })}
    </>
  )
}

function ScanLeaders({ placements, items, viewport }: { placements: CalloutPlacement[]; items: ScannedElementContext[]; viewport: Viewport }) {
  return (
    <svg className="ai-ui-scan-leaders" width={viewport.width} height={viewport.height}>
      {placements.map((p) => {
        const item = items[p.idx]
        const isPrimary = item?.isPrimaryFocus
        const isFocused = item?.isFocused
        const isActive = item?.isActive
        const leaderCls = `ai-ui-scan-leader-group${isPrimary ? ' is-primary' : ''}${isFocused ? ' is-focused' : ''}${isActive ? ' is-active' : ''}`
        const pts = p.points.map(([x, y]) => `${x},${y}`).join(' ')
        const end = p.points[p.points.length - 1]
        return (
          <g
            key={`leader-${p.idx}`}
            className={leaderCls}
            style={indexVar(p.idx)}
          >
            <polyline className="ai-ui-scan-leader-trace" points={pts} pathLength={1} />
            <polyline className="ai-ui-scan-leader" points={pts} />
            <circle className="ai-ui-scan-leader-anchor" cx={p.anchor.x} cy={p.anchor.y} r={3.2} />
            <rect className="ai-ui-scan-leader-end" x={end[0] - 2.5} y={end[1] - 2.5} width={5} height={5} />
          </g>
        )
      })}
    </svg>
  )
}

function ScanLabel({ placement: p, item }: { placement: CalloutPlacement; item: ScannedElementContext }) {
  const ref = fileRef(item)
  const isPrimary = item.isPrimaryFocus
  const cls = `ai-ui-scan-label side-${p.side}${isPrimary ? ' is-primary' : ''}${item.isFocused ? ' is-focused' : ''}${item.isActive ? ' is-active' : ''}${p.compact ? ' is-compact' : ''}`
  return (
    <div
      className={cls}
      style={{ left: p.label.left, top: p.label.top, width: p.label.width, height: p.label.height, ...indexVar(p.idx) }}
    >
      <span className="ai-ui-scan-label-idx">{String(p.idx + 1).padStart(2, '0')}</span>
      <span className="ai-ui-scan-label-body">
        <span className="ai-ui-scan-label-title">
          {item.isFocused && <b className="ai-ui-scan-label-focus" title="Phần tử đang Focus">FOCUS</b>}
          {item.isActive && <b className="ai-ui-scan-label-active" title="Phần tử đang Active">ACTIVE</b>}
          {!item.isFocused && !item.isActive && isPrimary && (
            <b className="ai-ui-scan-label-focus" title="Tâm điểm chọn">TARGET</b>
          )}
          {labelTitle(item)}
        </span>
        {!p.compact && (
          <span className="ai-ui-scan-label-sub">
            {item.kindLabel}
            {item.activeStateLabel ? <em> · {item.activeStateLabel}</em> : ref ? <em> · {ref}</em> : null}
          </span>
        )}
      </span>
    </div>
  )
}

export function AiUiScanCallouts({ snapshot, waveId, reserved, held = false, mode = 'context' }: Props) {
  const viewport = useViewportSize()
  const items = snapshot.elements
  const placements = useMemo(
    () =>
      layoutScanCallouts(
        items.map((item, idx) => ({ idx, bounds: item.bounds })),
        snapshot.rect,
        viewport,
        { reserved }
      ),
    [items, snapshot.rect, viewport, reserved]
  )

  return (
    <div
      key={`scan-fx-${waveId}`}
      className={`ai-ui-scan-fx-layer${held ? ' is-held' : ''}`}
      data-mcp-region="ai_inspector_scan_fx"
      data-ai-scan-mode={mode}
      aria-hidden="true"
    >
      <ScanRegion rect={snapshot.rect} count={items.length} />
      <ScanTargets items={items} />
      <ScanLeaders placements={placements} items={items} viewport={viewport} />
      {placements.map((p) =>
        items[p.idx] ? <ScanLabel key={`label-${p.idx}`} placement={p} item={items[p.idx]} /> : null
      )}
    </div>
  )
}
