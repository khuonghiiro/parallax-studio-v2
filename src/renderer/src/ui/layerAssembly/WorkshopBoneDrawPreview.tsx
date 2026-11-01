import type { Point2D } from './workshopMotionSketch'
import type { LayerBone } from '@shared/layerRig'
import type { BoneJointHit } from './mohoRigHelpers'

export interface DrawNewBoneDrag {
  start: Point2D
  current: Point2D
  parentBone: LayerBone | null
  parentJoint?: 'head' | 'tail'
  snapped?: boolean
}

export interface WorkshopBoneDrawPreviewProps {
  drawPreview: DrawNewBoneDrag | null
  snapTarget: BoneJointHit | null
  isAddBoneTool: boolean
  mirrorDraw: boolean
}

/**
 * Hiển thị đường vẽ xem trước khi tạo xương và chỉ báo bắt dính khớp (Snapping Cue):
 * - Vòng sáng đứt nét màu cam/cyan báo hiệu chuẩn bị nối vào Trục Ngọn hoặc Trục Gốc.
 * - Đường nét đứt nối từ khớp gốc đến vị trí chuột nhả.
 * - Nhánh đối xứng L ⇄ R tự động khi bật mirrorDraw.
 */
export function WorkshopBoneDrawPreview({
  drawPreview,
  snapTarget,
  isAddBoneTool,
  mirrorDraw
}: WorkshopBoneDrawPreviewProps) {
  return (
    <>
      {/* Vòng tròn bắt dính khớp khi hover công cụ Vẽ xương (A) và chưa kéo chuột */}
      {isAddBoneTool && !drawPreview && snapTarget && (
        <g pointerEvents="none" className="lw-snap-joint-cue">
          <circle
            cx={snapTarget.point.x}
            cy={snapTarget.point.y}
            r={16}
            fill="none"
            stroke="var(--key, #f59e0b)"
            strokeWidth={2.4}
            strokeDasharray="4 3"
            className="lw-snap-ring-pulse"
          />
          <circle cx={snapTarget.point.x} cy={snapTarget.point.y} r={5} fill="var(--key, #f59e0b)" />
          <rect
            x={snapTarget.point.x - 70}
            y={snapTarget.point.y - 28}
            width={140}
            height={18}
            rx={4}
            fill="var(--bg-0)"
            stroke="var(--key, #f59e0b)"
            strokeWidth={1}
            opacity={0.92}
          />
          <text
            x={snapTarget.point.x}
            y={snapTarget.point.y - 15}
            textAnchor="middle"
            fill="var(--text)"
            fontSize={9.5}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            {snapTarget.joint === 'tail'
              ? `🔗 Trục Ngọn · ${snapTarget.bone.name}`
              : `🔗 Trục Gốc · ${snapTarget.bone.name}`}
          </text>
        </g>
      )}

      {/* Đường xem trước khi đang kéo chuột vẽ xương mới */}
      {drawPreview && (
        <g pointerEvents="none" className="lw-draw-bone-preview">
          <line
            x1={drawPreview.start.x}
            y1={drawPreview.start.y}
            x2={drawPreview.current.x}
            y2={drawPreview.current.y}
            stroke="var(--key)"
            strokeWidth={3}
            strokeDasharray="5 4"
          />
          <circle cx={drawPreview.start.x} cy={drawPreview.start.y} r={drawPreview.snapped ? 7.5 : 6} fill="var(--key)" />
          {drawPreview.snapped && (
            <circle
              cx={drawPreview.start.x}
              cy={drawPreview.start.y}
              r={12}
              fill="none"
              stroke="var(--key)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
          )}
          <circle cx={drawPreview.current.x} cy={drawPreview.current.y} r={5} fill="var(--accent-cyan)" />

          {/* Đường đối xứng phụ L ⇄ R nếu đang bật vẽ đối xứng */}
          {mirrorDraw && Math.abs(drawPreview.start.x) > 10 && (
            <>
              <line
                x1={-drawPreview.start.x}
                y1={drawPreview.start.y}
                x2={-drawPreview.current.x}
                y2={drawPreview.current.y}
                stroke="var(--accent-cyan)"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                opacity={0.8}
              />
              <circle
                cx={-drawPreview.start.x}
                cy={drawPreview.start.y}
                r={5.5}
                fill="var(--accent-cyan)"
                opacity={0.8}
              />
            </>
          )}
        </g>
      )}
    </>
  )
}

export function WorkshopSymmetryGuide({ height }: { height: number }) {
  return (
    <g pointerEvents="none" className="lw-symmetry-axis-guide">
      <line
        x1={0}
        y1={-height / 2}
        x2={0}
        y2={height / 2}
        stroke="var(--accent)"
        strokeWidth={1.6}
        strokeDasharray="6 4"
        opacity={0.78}
      />
      <rect
        x={-68}
        y={-height / 2 + 8}
        width={136}
        height={18}
        rx={4}
        fill="var(--bg-1)"
        stroke="var(--accent)"
        strokeWidth={1.1}
      />
      <text
        x={0}
        y={-height / 2 + 20}
        textAnchor="middle"
        fill="var(--text)"
        fontSize={9.5}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
      >
        ĐỐI XỨNG L ⇄ R (X = 0)
      </text>
    </g>
  )
}

export function WorkshopBoneHudBadge({
  hud
}: {
  hud: { x: number; y: number; text: string; isLive?: boolean } | null
}) {
  if (!hud) return null
  const badgeW = Math.max(96, hud.text.length * 7.0 + 22)
  return (
    <g transform={`translate(${hud.x + 14}, ${hud.y - 14})`} pointerEvents="none">
      <rect
        x={-6}
        y={-15}
        width={badgeW}
        height={22}
        rx={5}
        fill="var(--bg-1)"
        stroke={hud.isLive ? 'var(--key)' : 'var(--accent-cyan)'}
        strokeWidth={1.5}
      />
      <text
        x={(badgeW - 12) / 2}
        y={0}
        textAnchor="middle"
        fill={hud.isLive ? 'var(--key)' : 'var(--text)'}
        fontSize={11}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
      >
        {hud.text}
      </text>
    </g>
  )
}
