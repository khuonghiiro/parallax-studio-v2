import { useState, useRef, useEffect, type PointerEvent } from 'react'
import type { LayerComposite } from './types'
import {
  type Point2D,
  type MotionSketchState,
  simplifyStrokePoints,
  findClosestRigBone,
  computeTargetGrayBone,
  normalizeAngle
} from './workshopMotionSketch'
import { useMotionSketch, setMotionSketchState, resetMotionSketchState } from './motionSketchStore'
import '../../styles/layerWorkshopMotionSketch.css'

export interface MotionSketchOverlayProps {
  composite: LayerComposite
  time: number
  active: boolean // true khi ở tab 'animation'
  onApplySketch: (sketch: MotionSketchState) => void
  isPlaying: boolean
  onTogglePlay: () => void
  selectBone: (id: string | null) => void
}

const toPathData = (pts: Point2D[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

export function MotionSketchOverlay({
  composite,
  time,
  active,
  onApplySketch,
  isPlaying,
  onTogglePlay,
  selectBone
}: MotionSketchOverlayProps) {
  const sketch = useMotionSketch()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragMode, setDragMode] = useState<'redBone' | 'blueStroke' | null>(null)
  const [isAltHeld, setIsAltHeld] = useState(false)
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const liveStrokeRef = useRef<Point2D[]>([])
  const [liveStroke, setLiveStroke] = useState<Point2D[] | null>(null)

  // Lắng nghe phím Alt / Shift để cập nhật con trỏ chuột và kích hoạt lớp vẽ
  useEffect(() => {
    if (!active) return
    const handleKeys = (e: KeyboardEvent) => {
      setIsAltHeld(e.altKey)
      setIsShiftHeld(e.shiftKey)
      if (e.key === 'Escape' && (sketch.redBone || sketch.blueStroke)) {
        resetMotionSketchState()
      }
    }
    window.addEventListener('keydown', handleKeys)
    window.addEventListener('keyup', handleKeys)
    return () => {
      window.removeEventListener('keydown', handleKeys)
      window.removeEventListener('keyup', handleKeys)
    }
  }, [active, sketch.redBone, sketch.blueStroke])

  if (!active) return null

  const toLocalPoint = (e: PointerEvent): Point2D | null => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    return { x: pt.x, y: pt.y }
  }

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const pt = toLocalPoint(e)
    if (!pt) return

    // 1. Giữ phím Alt: Vẽ xương màu đỏ (Root → Tip)
    if (e.altKey) {
      e.stopPropagation()
      setDragMode('redBone')
      liveStrokeRef.current = [pt, pt]
      setLiveStroke([pt, pt])
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* bỏ qua nếu capture không khả dụng */
      }
      return
    }

    // 2. Giữ phím Shift: Vẽ nét chuyển động Blue (Quỹ đạo uốn cong)
    if (e.shiftKey) {
      e.stopPropagation()
      setDragMode('blueStroke')
      const startPt = sketch.redBone ? sketch.redBone.tip : pt
      liveStrokeRef.current = [startPt, pt]
      setLiveStroke([startPt, pt])
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {
        /* bỏ qua */
      }
    }
  }

  const handlePointerMove = (e: PointerEvent) => {
    const pt = toLocalPoint(e)
    if (!pt || !dragMode) return

    if (dragMode === 'redBone') {
      const root = liveStrokeRef.current[0]
      liveStrokeRef.current = [root, pt]
      setLiveStroke([root, pt])
    } else if (dragMode === 'blueStroke') {
      const pts = liveStrokeRef.current
      const last = pts[pts.length - 1]
      if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 2) {
        pts.push(pt)
        setLiveStroke([...pts])
      }
    }
  }

  const handlePointerUp = () => {
    if (!dragMode) return
    const pts = liveStrokeRef.current
    setDragMode(null)
    setLiveStroke(null)

    if (dragMode === 'redBone' && pts.length >= 2) {
      const root = pts[0]
      const tip = pts[pts.length - 1]
      const len = Math.hypot(tip.x - root.x, tip.y - root.y)
      if (len > 12) {
        const angle = Math.atan2(tip.y - root.y, tip.x - root.x) * (180 / Math.PI)
        const match = findClosestRigBone(composite.rig, root, tip, time)
        if (match) {
          selectBone(match.bone.id)
        }
        setMotionSketchState((prev) => ({
          ...prev,
          redBone: {
            root,
            tip,
            length: len,
            angle,
            matchedBoneId: match?.bone.id,
            matchedBoneName: match?.bone.name
          },
          statusMessage: match
            ? `Khớp nhận diện: ${match.bone.name} · Giữ Shift và kéo chuột để vẽ quỹ đạo Blue`
            : `Đã xác định xương đỏ · Giữ Shift và kéo chuột để vẽ quỹ đạo Blue`
        }))
      }
    } else if (dragMode === 'blueStroke' && pts.length >= 2 && sketch.redBone) {
      const simplified = simplifyStrokePoints(pts)
      const strokeEnd = simplified[simplified.length - 1]
      const gray = computeTargetGrayBone(sketch.redBone.root, sketch.redBone.length, strokeEnd)
      const delta = normalizeAngle(gray.angle - sketch.redBone.angle)

      const nextSketch: MotionSketchState = {
        ...sketch,
        blueStroke: simplified,
        grayBone: gray,
        deltaAngle: delta,
        statusMessage: `Quỹ đạo xoay: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}° · Sẵn sàng phát thử hoặc ghi keyframe`
      }
      setMotionSketchState(nextSketch)
      // Tự động áp dụng ngay vào khung xương và uốn mesh
      onApplySketch(nextSketch)
    }
  }

  const isInteractive = isAltHeld || isShiftHeld || Boolean(dragMode)
  const red = sketch.redBone
  const blue = sketch.blueStroke
  const gray = sketch.grayBone

  return (
    <svg
      ref={svgRef}
      className={`lw-motion-sketch-overlay ${isInteractive ? 'interactive' : ''} ${isAltHeld ? 'alt-held' : ''} ${isShiftHeld ? 'shift-held' : ''}`}
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Lớp vẽ chuyển động hoạt ảnh"
    >
      <defs>
        {/* Mũi tên định hướng cho nét vẽ chuyển động blue */}
        <marker
          id="lw-sketch-arrow-blue"
          markerWidth="9"
          markerHeight="9"
          refX="6.5"
          refY="4.5"
          orient="auto"
        >
          <polygon points="1,2 8,4.5 1,7 3,4.5" fill="var(--accent-cyan, #00e5ff)" />
        </marker>
        <filter id="lw-glow-red" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="lw-glow-blue" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1. XƯƠNG MÀU ĐỎ (Alt + kéo chuột): Thể hiện xương nguồn */}
      {red && (
        <g className="lw-sketch-red-group" filter="url(#lw-glow-red)">
          <line
            x1={red.root.x}
            y1={red.root.y}
            x2={red.tip.x}
            y2={red.tip.y}
            className="lw-sketch-red-line"
          />
          {/* Khớp gốc (Pivot) */}
          <circle cx={red.root.x} cy={red.root.y} r={7.5} className="lw-sketch-root-joint" />
          <circle cx={red.root.x} cy={red.root.y} r={3} fill="#ffffff" />
          {/* Khớp ngọn (Tip) */}
          <circle cx={red.tip.x} cy={red.tip.y} r={5.5} className="lw-sketch-tip-joint" />
          <text
            x={(red.root.x + red.tip.x) / 2 + 10}
            y={(red.root.y + red.tip.y) / 2}
            className="lw-sketch-label red"
          >
            {red.matchedBoneName ? `🦴 ${red.matchedBoneName}` : '🦴 Xương đỏ'}
          </text>
        </g>
      )}

      {/* Khi đang kéo chuột vẽ xương đỏ realtime */}
      {dragMode === 'redBone' && liveStroke && liveStroke.length >= 2 && (
        <g className="lw-sketch-live-red" filter="url(#lw-glow-red)">
          <line
            x1={liveStroke[0].x}
            y1={liveStroke[0].y}
            x2={liveStroke[1].x}
            y2={liveStroke[1].y}
            className="lw-sketch-red-line live"
          />
          <circle cx={liveStroke[0].x} cy={liveStroke[0].y} r={7.5} className="lw-sketch-root-joint" />
          <circle cx={liveStroke[1].x} cy={liveStroke[1].y} r={5.5} className="lw-sketch-tip-joint" />
        </g>
      )}

      {/* 2. ĐƯỜNG KẺ XÁM (Tư thế đích đến): Từ gốc xương đỏ vươn tới hướng kết thúc của nét vẽ blue */}
      {gray && red && (
        <g className="lw-sketch-gray-group">
          <line
            x1={gray.root.x}
            y1={gray.root.y}
            x2={gray.tip.x}
            y2={gray.tip.y}
            className="lw-sketch-gray-line"
          />
          <circle cx={gray.tip.x} cy={gray.tip.y} r={5.5} className="lw-sketch-gray-joint" />
          <text x={gray.tip.x + 8} y={gray.tip.y + 4} className="lw-sketch-label gray">
            Kẻ xám (Đích đến)
          </text>
        </g>
      )}

      {/* 3. NÉT VẼ CHUYỂN ĐỘNG BLUE (Shift + kéo chuột): Quỹ đạo cong với mũi tên định hướng */}
      {blue && blue.length >= 2 && (
        <g className="lw-sketch-blue-group" filter="url(#lw-glow-blue)">
          <path
            d={toPathData(blue)}
            className="lw-sketch-blue-path"
            markerEnd="url(#lw-sketch-arrow-blue)"
          />
          {sketch.deltaAngle !== 0 && blue.length > 0 && (
            <text
              x={blue[Math.floor(blue.length / 2)].x + 12}
              y={blue[Math.floor(blue.length / 2)].y - 12}
              className="lw-sketch-label blue"
            >
              {`⟳ ${sketch.deltaAngle > 0 ? '+' : ''}${sketch.deltaAngle.toFixed(1)}°`}
            </text>
          )}
        </g>
      )}

      {/* Khi đang kéo chuột vẽ nét blue realtime */}
      {dragMode === 'blueStroke' && liveStroke && liveStroke.length >= 2 && (
        <g className="lw-sketch-live-blue" filter="url(#lw-glow-blue)">
          <path
            d={toPathData(liveStroke)}
            className="lw-sketch-blue-path live"
            markerEnd="url(#lw-sketch-arrow-blue)"
          />
        </g>
      )}

      {/* HUD Toolbar điều khiển nhanh ngay trên màn hình khi đã vẽ xong */}
      {red && gray && (
        <foreignObject
          x={-composite.width / 2 + 16}
          y={composite.height / 2 - 58}
          width={composite.width - 32}
          height={50}
          className="lw-sketch-hud-wrapper"
        >
          <div className="lw-sketch-hud-bar">
            <span className="lw-sketch-badge">
              {red.matchedBoneName ? `🦴 ${red.matchedBoneName}` : 'Động tác'}: {sketch.deltaAngle > 0 ? '+' : ''}{sketch.deltaAngle.toFixed(1)}°
            </span>
            <button
              type="button"
              className="btn xs primary lw-sketch-play-btn"
              onClick={onTogglePlay}
              title="Phát thử động tác (Phím Space)"
            >
              {isPlaying ? '⏸ Dừng' : '▶ Phát thử'}
            </button>
            <label className="lw-sketch-check" title="Uốn cong layer bằng lưới Mesh 2D mềm mại">
              <input
                type="checkbox"
                checked={sketch.enableMeshBend}
                onChange={(e) => {
                  const updated = { ...sketch, enableMeshBend: e.target.checked }
                  setMotionSketchState(updated)
                  onApplySketch(updated)
                }}
              />
              <span>Uốn Mesh 2D</span>
            </label>
            <label className="lw-sketch-check" title="Động tác khứ hồi (vung tới kẻ xám rồi thu về dáng cũ)">
              <input
                type="checkbox"
                checked={sketch.loopBack}
                onChange={(e) => {
                  const updated = { ...sketch, loopBack: e.target.checked }
                  setMotionSketchState(updated)
                  onApplySketch(updated)
                }}
              />
              <span>Khứ hồi</span>
            </label>
            <button
              type="button"
              className="btn xs lw-sketch-clear-btn"
              onClick={resetMotionSketchState}
              title="Xoá nét vẽ này"
            >
              ✕ Xoá nét
            </button>
          </div>
        </foreignObject>
      )}

      {/* Gợi ý tương tác khi người dùng giữ Alt hoặc Shift */}
      {isAltHeld && !red && (
        <text
          x={0}
          y={composite.height / 2 - 20}
          textAnchor="middle"
          className="lw-sketch-hint red"
        >
          Kéo chuột từ GỐC đến NGỌN để vẽ xương màu đỏ
        </text>
      )}
      {isShiftHeld && red && (
        <text
          x={0}
          y={composite.height / 2 - 20}
          textAnchor="middle"
          className="lw-sketch-hint blue"
        >
          Kéo chuột từ ngọn xương để vẽ nét quỹ đạo Blue đến chỗ kẻ xám
        </text>
      )}
    </svg>
  )
}
