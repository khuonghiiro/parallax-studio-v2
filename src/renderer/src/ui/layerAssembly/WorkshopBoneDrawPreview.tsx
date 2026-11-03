import type { Point2D } from './workshopMotionSketch'
import type { LayerBone } from '@shared/layerRig'
import type { BoneCapsuleHit, BoneJointHit } from './mohoRigHelpers'
import { resolveClosestBoneJointForPoint } from './mohoRigHelpers'
import type { BoneTransform } from '../../engine/layerRig'
import type { PendingBoneDashedLink } from './rigToolStore'

export type DrawBoneStepMode =
  | 'weld-bone'
  | 'link-step1'
  | 'link-step2'
  | 'outside-bone'
  | 'root-bone'

export interface DrawNewBoneDrag {
  start: Point2D
  current: Point2D
  parentBone: LayerBone | null
  parentJoint?: 'head' | 'tail'
  snapped?: boolean
  mode?: DrawBoneStepMode
}

export interface WorkshopBoneDrawPreviewProps {
  drawPreview: DrawNewBoneDrag | null
  snapTarget: BoneJointHit | null
  capsuleTarget?: BoneCapsuleHit | null
  pendingDashedLink?: PendingBoneDashedLink | null
  bones?: LayerBone[]
  isAddBoneTool: boolean
  mirrorDraw: boolean
  transforms?: Map<string, BoneTransform>
  parentBoneCandidate?: LayerBone | null
  hoverPoint?: Point2D | null
}

function getParentAnchorPoint(
  pb: LayerBone,
  transforms: Map<string, BoneTransform> | undefined,
  preferredJoint: 'head' | 'tail' | undefined,
  refPoint: Point2D
): Point2D {
  const pTf = transforms?.get(pb.id)
  if (preferredJoint) {
    const hx = pTf?.x ?? pb.x
    const hy = pTf?.y ?? pb.y
    if (preferredJoint === 'head' || pb.pin) return { x: hx, y: hy }
    const rad = ((pb.angle + (pTf?.rotation ?? 0)) * Math.PI) / 180
    return {
      x: hx + Math.cos(rad) * pb.length,
      y: hy + Math.sin(rad) * pb.length
    }
  }
  return resolveClosestBoneJointForPoint(pb, pTf, refPoint).point
}

/**
 * Hiển thị đường vẽ xem trước khi tạo xương và chỉ báo bắt dính khớp (Snapping & 2-Step Capsule Link Cue):
 * - Gần 2 điểm gốc/ngọn (≤ 24px): Vòng sáng Hàn khớp trực tiếp.
 * - Trong Vỏ uốn (ngoài 2 điểm gốc): Nét 1 kéo vẽ tạo Nét đứt tới điểm đặt khớp (Esc để huỷ) → Nét 2 kéo vẽ tạo Xương.
 * - Ngoài Vỏ uốn: Nếu đang focus xương thì lấy đầu khớp gần nhất làm nét đứt và Nét 1 tạo xương luôn; nếu đã Esc bỏ focus thì tạo xương mới tách rời.
 */
export function WorkshopBoneDrawPreview({
  drawPreview,
  snapTarget,
  capsuleTarget,
  pendingDashedLink,
  bones = [],
  isAddBoneTool,
  mirrorDraw,
  transforms,
  parentBoneCandidate,
  hoverPoint
}: WorkshopBoneDrawPreviewProps) {
  const isLinkStep1 = drawPreview?.mode === 'link-step1'

  // 1. Tính toán điểm mốc của xương cha khi đang kéo vẽ (Nét 1 nét đứt hoặc Nét 2 / Ngoài vỏ)
  let parentAnchor: Point2D | null = null
  if (drawPreview?.parentBone && !drawPreview.snapped) {
    const refPt = isLinkStep1 ? drawPreview.current : drawPreview.start
    parentAnchor = getParentAnchorPoint(drawPreview.parentBone, transforms, drawPreview.parentJoint, refPt)
  }

  // 2. Tính toán điểm mốc khi đã chốt Nét 1 (pendingDashedLink) và đang chờ kéo Nét 2
  let lockedLinkSource: Point2D | null = null
  if (isAddBoneTool && !drawPreview && pendingDashedLink) {
    const pb = bones.find((b) => b.id === pendingDashedLink.parentBoneId)
    if (pb) {
      lockedLinkSource = getParentAnchorPoint(
        pb,
        transforms,
        pendingDashedLink.parentJoint,
        pendingDashedLink.anchorPoint
      )
    }
  }

  // 3. Điểm mốc gợi ý khi hover ngoài Vỏ uốn mà đang focus một xương cha
  let hoverOutsideAnchor: { pt: Point2D; joint: 'head' | 'tail'; boneName: string } | null = null
  if (
    isAddBoneTool &&
    !drawPreview &&
    !pendingDashedLink &&
    !snapTarget &&
    !capsuleTarget &&
    parentBoneCandidate &&
    hoverPoint &&
    transforms
  ) {
    const nearest = resolveClosestBoneJointForPoint(
      parentBoneCandidate,
      transforms.get(parentBoneCandidate.id),
      hoverPoint
    )
    if (Math.hypot(hoverPoint.x - nearest.point.x, hoverPoint.y - nearest.point.y) > 18) {
      hoverOutsideAnchor = {
        pt: nearest.point,
        joint: nearest.joint,
        boneName: parentBoneCandidate.name
      }
    }
  }

  return (
    <>
      {/* 1. Vòng tròn bắt dính HÀN KHỚP khi hover vào gần bán kính 2 điểm gốc/ngọn */}
      {isAddBoneTool && !drawPreview && !pendingDashedLink && snapTarget && (
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
            x={snapTarget.point.x - 84}
            y={snapTarget.point.y - 30}
            width={168}
            height={19}
            rx={4}
            fill="var(--bg-0)"
            stroke="var(--key, #f59e0b)"
            strokeWidth={1}
            opacity={0.94}
          />
          <text
            x={snapTarget.point.x}
            y={snapTarget.point.y - 17}
            textAnchor="middle"
            fill="var(--text)"
            fontSize={9.5}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            {snapTarget.joint === 'tail'
              ? `🔗 Hàn khớp Ngọn · ${snapTarget.bone.name}`
              : `🔗 Hàn khớp Gốc · ${snapTarget.bone.name}`}
          </text>
        </g>
      )}

      {/* 2. Chỉ báo khi hover bên trong VỎ UỐN (ngoài bán kính 2 điểm gốc): Click = Chọn, Kéo Nét 1 = Tạo nét đứt */}
      {isAddBoneTool && !drawPreview && !pendingDashedLink && !snapTarget && capsuleTarget && hoverPoint && (
        <g pointerEvents="none" className="lw-hover-capsule-cue" opacity={0.88}>
          <line
            x1={capsuleTarget.jointPoint.x}
            y1={capsuleTarget.jointPoint.y}
            x2={hoverPoint.x}
            y2={hoverPoint.y}
            stroke="var(--key, #f59e0b)"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <circle cx={capsuleTarget.jointPoint.x} cy={capsuleTarget.jointPoint.y} r={4.5} fill="var(--key, #f59e0b)" />
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={8}
            fill="none"
            stroke="var(--key, #f59e0b)"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
          <rect
            x={hoverPoint.x - 108}
            y={hoverPoint.y - 30}
            width={216}
            height={19}
            rx={4}
            fill="var(--bg-0)"
            stroke="var(--key, #f59e0b)"
            strokeWidth={1}
            opacity={0.94}
          />
          <text
            x={hoverPoint.x}
            y={hoverPoint.y - 17}
            textAnchor="middle"
            fill="var(--text)"
            fontSize={9.2}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            {`✨ Vỏ uốn "${capsuleTarget.bone.name}" · Click chọn · Kéo Nét 1 = Nét đứt`}
          </text>
        </g>
      )}

      {/* 3. Chỉ báo khi hover NGOÀI VỎ UỐN mà đang focus xương: tự lấy điểm gần nhất làm nét đứt & Nét 1 tạo xương luôn */}
      {hoverOutsideAnchor && hoverPoint && (
        <g pointerEvents="none" className="lw-hover-parent-cue" opacity={0.82}>
          <line
            x1={hoverOutsideAnchor.pt.x}
            y1={hoverOutsideAnchor.pt.y}
            x2={hoverPoint.x}
            y2={hoverPoint.y}
            stroke="var(--accent-cyan)"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <circle cx={hoverOutsideAnchor.pt.x} cy={hoverOutsideAnchor.pt.y} r={4.5} fill="var(--accent-cyan)" />
          <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill="var(--accent-cyan)" opacity={0.75} />
        </g>
      )}

      {/* 4. Hiển thị NÉT 1 ĐÃ CHỐT (pendingDashedLink) đang chờ người dùng kéo NÉT 2 để tạo xương (hoặc nhấn Esc để huỷ) */}
      {isAddBoneTool && !drawPreview && pendingDashedLink && lockedLinkSource && (
        <g pointerEvents="none" className="lw-pending-dashed-link-cue">
          <line
            x1={lockedLinkSource.x}
            y1={lockedLinkSource.y}
            x2={pendingDashedLink.anchorPoint.x}
            y2={pendingDashedLink.anchorPoint.y}
            stroke="var(--key, #f59e0b)"
            strokeWidth={2.2}
            strokeDasharray="5 3"
          />
          <circle cx={lockedLinkSource.x} cy={lockedLinkSource.y} r={5} fill="var(--key, #f59e0b)" />
          <circle
            cx={pendingDashedLink.anchorPoint.x}
            cy={pendingDashedLink.anchorPoint.y}
            r={13}
            fill="none"
            stroke="var(--key, #f59e0b)"
            strokeWidth={2}
            strokeDasharray="4 2"
            className="lw-snap-ring-pulse"
          />
          <circle cx={pendingDashedLink.anchorPoint.x} cy={pendingDashedLink.anchorPoint.y} r={5.5} fill="var(--key, #f59e0b)" />
          {mirrorDraw && Math.abs(pendingDashedLink.anchorPoint.x) > 10 && (
            <>
              <line
                x1={-lockedLinkSource.x}
                y1={lockedLinkSource.y}
                x2={-pendingDashedLink.anchorPoint.x}
                y2={pendingDashedLink.anchorPoint.y}
                stroke="var(--accent-cyan)"
                strokeWidth={1.8}
                strokeDasharray="5 3"
                opacity={0.75}
              />
              <circle
                cx={-pendingDashedLink.anchorPoint.x}
                cy={pendingDashedLink.anchorPoint.y}
                r={5}
                fill="var(--accent-cyan)"
                opacity={0.8}
              />
            </>
          )}
          <rect
            x={pendingDashedLink.anchorPoint.x - 122}
            y={pendingDashedLink.anchorPoint.y - 32}
            width={244}
            height={20}
            rx={4}
            fill="var(--bg-0)"
            stroke="var(--key, #f59e0b)"
            strokeWidth={1.2}
            opacity={0.95}
          />
          <text
            x={pendingDashedLink.anchorPoint.x}
            y={pendingDashedLink.anchorPoint.y - 19}
            textAnchor="middle"
            fill="var(--text)"
            fontSize={9.5}
            fontWeight={700}
            fontFamily="system-ui, sans-serif"
          >
            {`🎯 Đã chốt nét đứt (${pendingDashedLink.parentBoneName}) · Kéo Nét 2 tạo xương · Esc huỷ`}
          </text>
        </g>
      )}

      {/* 5. Đường xem trước khi đang kéo chuột (Nét 1 tạo nét đứt HOẶC Nét 2 / Ngoài vỏ tạo xương) */}
      {drawPreview && (
        <g pointerEvents="none" className="lw-draw-bone-preview">
          {isLinkStep1 ? (
            <>
              {/* Đang kéo Nét 1 từ Vỏ uốn: chỉ vẽ NÉT ĐỨT KẾT NỐI tới điểm đặt khớp */}
              {parentAnchor && (
                <>
                  <line
                    x1={parentAnchor.x}
                    y1={parentAnchor.y}
                    x2={drawPreview.current.x}
                    y2={drawPreview.current.y}
                    stroke="var(--key, #f59e0b)"
                    strokeWidth={2.2}
                    strokeDasharray="5 3"
                  />
                  <circle cx={parentAnchor.x} cy={parentAnchor.y} r={5} fill="var(--key, #f59e0b)" />
                  {mirrorDraw && Math.abs(drawPreview.current.x) > 10 && (
                    <line
                      x1={-parentAnchor.x}
                      y1={parentAnchor.y}
                      x2={-drawPreview.current.x}
                      y2={drawPreview.current.y}
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.8}
                      strokeDasharray="5 3"
                      opacity={0.75}
                    />
                  )}
                </>
              )}
              <line
                x1={drawPreview.start.x}
                y1={drawPreview.start.y}
                x2={drawPreview.current.x}
                y2={drawPreview.current.y}
                stroke="var(--accent-cyan)"
                strokeWidth={1.2}
                strokeDasharray="2 3"
                opacity={0.65}
              />
              <circle
                cx={drawPreview.current.x}
                cy={drawPreview.current.y}
                r={12}
                fill="none"
                stroke="var(--key, #f59e0b)"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
              <circle cx={drawPreview.current.x} cy={drawPreview.current.y} r={5.5} fill="var(--key, #f59e0b)" />
            </>
          ) : (
            <>
              {/* Đường nét đứt nối từ mốc xương cha tới điểm bắt đầu của xương con mới */}
              {parentAnchor && (
                <>
                  <line
                    x1={parentAnchor.x}
                    y1={parentAnchor.y}
                    x2={drawPreview.start.x}
                    y2={drawPreview.start.y}
                    stroke="var(--key)"
                    strokeWidth={1.8}
                    strokeDasharray="4 3"
                    opacity={0.88}
                  />
                  <circle cx={parentAnchor.x} cy={parentAnchor.y} r={4.5} fill="var(--key)" opacity={0.9} />
                  {mirrorDraw && Math.abs(parentAnchor.x) > 10 && (
                    <line
                      x1={-parentAnchor.x}
                      y1={parentAnchor.y}
                      x2={-drawPreview.start.x}
                      y2={drawPreview.start.y}
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.6}
                      strokeDasharray="4 3"
                      opacity={0.75}
                    />
                  )}
                </>
              )}

              {/* Thân chiếc xương mới đang được kéo vẽ: hiển thị nét liền rõ nét (solid) */}
              <line
                x1={drawPreview.start.x}
                y1={drawPreview.start.y}
                x2={drawPreview.current.x}
                y2={drawPreview.current.y}
                stroke="var(--key)"
                strokeWidth={3.6}
                strokeLinecap="round"
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
                    strokeWidth={3.2}
                    strokeLinecap="round"
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
