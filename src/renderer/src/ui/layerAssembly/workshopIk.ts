import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'

/**
 * IK (Inverse Kinematics) cho khung xương 2D của Xưởng lắp ráp layer — giống Spine / Moho / Cartoon Animator:
 * kéo NGỌN của một xương (bàn tay, bàn chân, đuôi…) và các xương cha trong chuỗi tự xoay theo.
 * Dùng thuật toán CCD (Cyclic Coordinate Descent) trên mảng điểm cục bộ nên rất nhanh (chạy mỗi lần rê chuột).
 */

export interface Point2D {
  x: number
  y: number
}

export interface IkChain {
  /** Các xương trong chuỗi, xếp từ GỐC chuỗi tới xương NGỌN (end effector). */
  boneIds: string[]
  /** Khớp gốc của từng xương + ngọn của xương cuối (boneIds.length + 1 điểm) tại tư thế ban đầu. */
  points: Point2D[]
  /** Góc xoay (pose.rotation) ban đầu của từng xương. */
  baseRotations: number[]
}

export const IK_CHAIN_MAX = 4

/** Lấy chuỗi xương từ xương ngọn đi ngược lên cha, tối đa length xương. Dừng trước các khớp rẽ nhánh thân chính (như Hông/Ngực có nhiều nhánh con) để kéo tay/chân không làm nghiêng cả thân người. */
export function ikChainIds(rig: LayerRig, endBoneId: string, length: number): string[] {
  const byId = new Map(rig.bones.map((b) => [b.id, b]))
  const childCount = new Map<string, number>()
  for (const b of rig.bones) {
    if (b.parentId) childCount.set(b.parentId, (childCount.get(b.parentId) ?? 0) + 1)
  }
  const ids: string[] = []
  let current = byId.get(endBoneId)
  const maxLen = Math.max(1, Math.min(IK_CHAIN_MAX, length))
  while (current && ids.length < maxLen) {
    if (ids.includes(current.id)) break
    // Nếu đã có ít nhất 1 xương chi trong chuỗi và xương cha tiếp theo là khớp phân nhánh (ví dụ ngực chia ra đầu + 2 tay, hoặc hông chia ra bụng + 2 chân) thì dừng lại để không xoay cả thân
    if (ids.length > 0 && (childCount.get(current.id) ?? 0) > 1) break
    ids.unshift(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return ids
}

/** Chụp chuỗi IK tại thời điểm time: vị trí các khớp và góc xoay hiện tại. */
export function buildIkChain(rig: LayerRig, endBoneId: string, length: number, time: number): IkChain {
  const boneIds = ikChainIds(rig, endBoneId, length)
  if (!boneIds.length) throw new Error(`Không tìm thấy xương "${endBoneId}"`)
  const flat = { ...rig, loop: false }
  const transforms = evaluateRig(flat, time)
  const points: Point2D[] = boneIds.map((id) => {
    const tf = transforms.get(id)
    return { x: tf?.x ?? 0, y: tf?.y ?? 0 }
  })
  const end = rig.bones.find((b) => b.id === boneIds[boneIds.length - 1])!
  const endTf = transforms.get(end.id)!
  const tip = rotatePoint(end.length, 0, end.angle + endTf.rotation)
  points.push({ x: endTf.x + tip.x, y: endTf.y + tip.y })
  return { boneIds, points, baseRotations: boneIds.map((id) => sampleBonePose(flat, id, time).rotation) }
}

/** Vị trí các khớp sau khi mỗi xương xoay thêm deltas[i] độ (xoay xương cha kéo theo cả phần con). */
export function chainPositions(chain: IkChain, deltas: number[]): Point2D[] {
  const out: Point2D[] = [{ ...chain.points[0] }]
  let acc = 0
  for (let i = 0; i < chain.boneIds.length; i++) {
    acc += deltas[i] ?? 0
    const a = chain.points[i]
    const b = chain.points[i + 1]
    const d = rotatePoint(b.x - a.x, b.y - a.y, acc)
    out.push({ x: out[i].x + d.x, y: out[i].y + d.y })
  }
  return out
}

const angleOf = (from: Point2D, to: Point2D) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
const wrap = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180

/**
 * Giải CCD: lần lượt từ xương ngọn về gốc, xoay mỗi khớp sao cho ngọn chuỗi hướng về target.
 * Bắt đầu từ nghiệm trước (deltas0) để chuyển động liền mạch, không lật khớp đột ngột.
 */
export function solveCcd(chain: IkChain, target: Point2D, deltas0?: number[], iterations = 14, tolerance = 0.4): number[] {
  const n = chain.boneIds.length
  const deltas = Array.from({ length: n }, (_, i) => deltas0?.[i] ?? 0)
  for (let iter = 0; iter < iterations; iter++) {
    for (let j = n - 1; j >= 0; j--) {
      const pos = chainPositions(chain, deltas)
      const end = pos[n]
      if (Math.hypot(end.x - target.x, end.y - target.y) < tolerance) return deltas
      const pivot = pos[j]
      if (Math.hypot(end.x - pivot.x, end.y - pivot.y) < 1e-6) continue
      deltas[j] += wrap(angleOf(pivot, target) - angleOf(pivot, end))
    }
  }
  return deltas
}

/** Góc xoay mới (pose.rotation) cho từng xương trong chuỗi để ngọn chạm target. */
export function ikRotations(chain: IkChain, deltas: number[]): Array<{ boneId: string; rotation: number }> {
  return chain.boneIds.map((boneId, i) => ({ boneId, rotation: Number((chain.baseRotations[i] + deltas[i]).toFixed(2)) }))
}

/** Một lần giải trọn: chụp chuỗi tại time rồi kéo ngọn xương endBoneId tới target. */
export function solveIkPose(
  rig: LayerRig,
  time: number,
  endBoneId: string,
  target: Point2D,
  length: number
): Array<{ boneId: string; rotation: number }> {
  const chain = buildIkChain(rig, endBoneId, length, time)
  return ikRotations(chain, solveCcd(chain, target, undefined, 40))
}
