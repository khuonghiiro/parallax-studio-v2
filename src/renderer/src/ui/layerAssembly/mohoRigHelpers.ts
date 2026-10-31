import type { BoneEasing, BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'

export type BoneAnatomicalSide = 'left' | 'right' | 'center'

export interface TweenSpanSegment {
  startTime: number
  endTime: number
  leftPct: number
  widthPct: number
  easing: BoneEasing
  kind: 'motion' | 'linear' | 'hold'
}

/**
 * Phân loại màu xương chuẩn Moho Pro:
 * - `left` (Cyan): xương bên trái nhân vật
 * - `right` (Coral/Amber): xương bên phải nhân vật
 * - `center` (Royal Blue): trục cột sống / đầu / gốc trung tâm
 */
export function classifyBoneSide(bone: Pick<LayerBone, 'id' | 'name' | 'x'>): BoneAnatomicalSide {
  const token = `${bone.id} ${bone.name}`.toLowerCase()
  if (/(?:^|[-_.\s])(left|trái|l)(?:$|[-_.\s])|\(l\)/i.test(token)) return 'left'
  if (/(?:^|[-_.\s])(right|phải|r)(?:$|[-_.\s])|\(r\)/i.test(token)) return 'right'
  if (Math.abs(bone.x) > 28) return bone.x < 0 ? 'left' : 'right'
  return 'center'
}

/** Tính độ sâu phân cấp (0, 1, 2...) an toàn chống vòng lặp cho từng xương. */
export function computeBoneDepthMap(bones: LayerBone[]): Map<string, number> {
  const byId = new Map(bones.map((b) => [b.id, b]))
  const depths = new Map<string, number>()

  for (const bone of bones) {
    let depth = 0
    const seen = new Set<string>([bone.id])
    let cur = bone.parentId
    while (cur && byId.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      depth += 1
      cur = byId.get(cur)?.parentId
    }
    depths.set(bone.id, depth)
  }
  return depths
}

/** Bán kính viên nang Vùng ảnh hưởng xương (Moho Bone Strength Capsule) trên khung 2D (đơn vị px). */
export function computeBoneInfluenceRadius(bone: Pick<LayerBone, 'length' | 'strength' | 'pin'>): number {
  const mult = Math.max(0.15, Math.min(3.5, bone.strength ?? 1))
  const baseRadius = bone.pin ? 22 : Math.max(14, bone.length * 0.28)
  return Number((baseRadius * mult).toFixed(1))
}

/** Quy đổi khoảng cách kéo chuột vuông góc với thân xương sang hệ số `strength` (0.15..3.5). */
export function computeStrengthFromPointerDistance(
  bone: Pick<LayerBone, 'length' | 'pin'>,
  radialDistancePx: number
): number {
  const baseRadius = bone.pin ? 22 : Math.max(14, bone.length * 0.28)
  const raw = Math.max(4, radialDistancePx) / baseRadius
  return Number(Math.max(0.15, Math.min(3.5, raw)).toFixed(2))
}

/**
 * Tạo xương mới khi bấm-kéo trực tiếp trên sân khấu 2D (Công cụ Moho Add Bone `A`):
 * - Kéo < 12px: tạo **Pin Bone** (chốt ghim điểm đơn giống Moho Pin Bone).
 * - Kéo >= 12px: tạo xương có hướng và độ dài đúng theo vệt kéo, tự nối vào `parentBone` đang chọn.
 */
export function createBoneFromCanvasDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  parentBone: LayerBone | null,
  existingCount: number,
  customId?: string
): LayerBone {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.hypot(dx, dy)
  const isPin = dist < 12
  const idx = existingCount + 1
  const id = customId ?? `bone-${Math.random().toString(36).slice(2, 9)}`

  if (isPin) {
    return {
      id,
      name: `Chốt Pin ${idx}`,
      parentId: parentBone?.id,
      x: Math.round(start.x),
      y: Math.round(start.y),
      length: 16,
      angle: -90,
      strength: 1,
      pin: true
    }
  }

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  return {
    id,
    name: `Xương ${idx}`,
    parentId: parentBone?.id,
    x: Math.round(start.x),
    y: Math.round(start.y),
    length: Math.max(12, Math.round(dist)),
    angle: Number(angleDeg.toFixed(1)),
    strength: 1
  }
}

/** Đổi tên xương đối xứng Trái ⇄ Phải tự động. */
export function mirrorBoneName(name: string): string {
  const rules: Array<[RegExp, string]> = [
    [/\bTrái\b/g, 'Phải'],
    [/\btrái\b/g, 'phải'],
    [/\bTRÁI\b/g, 'PHẢI'],
    [/\bPhải\b/g, 'Trái'],
    [/\bphải\b/g, 'trái'],
    [/\bPHẢI\b/g, 'TRÁI'],
    [/\bLeft\b/g, 'Right'],
    [/\bleft\b/g, 'right'],
    [/\bRight\b/g, 'Left'],
    [/\bright\b/g, 'left'],
    [/([-_.])L\b/g, '$1R'],
    [/([-_.])l\b/g, '$1r'],
    [/([-_.])R\b/g, '$1L'],
    [/([-_.])r\b/g, '$1l'],
    [/\(L\)/g, '(R)'],
    [/\(R\)/g, '(L)']
  ]
  for (const [pat, rep] of rules) {
    if (pat.test(name)) {
      return name.replace(pat, rep)
    }
  }
  return `${name} (Đối xứng)`
}

/** Đổi ID xương đối xứng hoặc sinh ID mới sạch sẽ. */
export function mirrorBoneId(id: string, existingIds: Set<string>): string {
  const rules: Array<[RegExp, string]> = [
    [/([-_.])l(?=$|[-_.])/i, '$1r'],
    [/([-_.])r(?=$|[-_.])/i, '$1l'],
    [/left/i, 'right'],
    [/right/i, 'left']
  ]
  for (const [pat, rep] of rules) {
    if (pat.test(id)) {
      const candidate = id.replace(pat, (match) => {
        if (/^[-_.]l$/i.test(match)) return match[0] + (match[1] === 'L' ? 'R' : 'r')
        if (/^[-_.]r$/i.test(match)) return match[0] + (match[1] === 'R' ? 'L' : 'l')
        if (/^left$/i.test(match)) return match[0] === 'L' ? 'Right' : 'right'
        return match[0] === 'R' ? 'Left' : 'left'
      })
      if (!existingIds.has(candidate)) return candidate
    }
  }
  let suffix = 1
  while (existingIds.has(`${id}-mirror${suffix > 1 ? `-${suffix}` : ''}`)) {
    suffix += 1
  }
  return `${id}-mirror${suffix > 1 ? `-${suffix}` : ''}`
}

/** Phản chiếu góc xương (Y hướng xuống, thuận chiều kim đồng hồ) qua trục dọc X = 0. */
export function mirrorAngleAcrossYAxis(angleDeg: number): number {
  let mirrored = 180 - angleDeg
  while (mirrored > 180) mirrored -= 360
  while (mirrored <= -180) mirrored += 360
  return Number(mirrored.toFixed(1))
}

/**
 * Tạo bản sao đối xứng Trái ⇄ Phải qua trục X = 0 cho một xương hoặc cả nhánh xương con (Moho Mirror Bone Chain).
 */
export function buildMirroredBoneChain(
  bones: LayerBone[],
  rootBoneId: string,
  findMirrorFn?: (boneId: string, list: LayerBone[]) => string | null
): LayerBone[] {
  const root = bones.find((b) => b.id === rootBoneId)
  if (!root) return []

  const branchIds = new Set<string>([root.id])
  let added = true
  while (added) {
    added = false
    for (const b of bones) {
      if (b.parentId && branchIds.has(b.parentId) && !branchIds.has(b.id)) {
        branchIds.add(b.id)
        added = true
      }
    }
  }

  const branch = bones.filter((b) => branchIds.has(b.id))
  const existingIds = new Set(bones.map((b) => b.id))
  const mirroredIdMap = new Map<string, string>()
  const created: LayerBone[] = []

  for (const b of branch) {
    const existingTwin = findMirrorFn?.(b.id, bones)
    if (existingTwin && existingTwin !== b.id) {
      mirroredIdMap.set(b.id, existingTwin)
      continue
    }

    const newId = mirrorBoneId(b.id, existingIds)
    existingIds.add(newId)
    mirroredIdMap.set(b.id, newId)

    let mirroredParentId = b.parentId
    if (b.parentId) {
      if (mirroredIdMap.has(b.parentId)) {
        mirroredParentId = mirroredIdMap.get(b.parentId)
      } else {
        const parentTwin = findMirrorFn?.(b.parentId, bones)
        if (parentTwin) mirroredParentId = parentTwin
      }
    }

    const hasExplicitSide = mirrorBoneName(b.name) !== `${b.name} (Đối xứng)`
    const sideLabel =
      hasExplicitSide
        ? mirrorBoneName(b.name)
        : b.x < -4
          ? `${b.name} Phải`
          : b.x > 4
            ? `${b.name} Trái`
            : `${b.name} (Đối xứng)`

    created.push({
      ...b,
      id: newId,
      name: sideLabel,
      parentId: mirroredParentId,
      x: Math.round(-b.x) || 0,
      y: b.y,
      angle: mirrorAngleAcrossYAxis(b.angle)
    })
  }

  return created
}

/**
 * Tính các thanh khoảng nội suy Tween Span kiểu Adobe Animate giữa các keyframe liên tiếp `k[i] -> k[i+1]`.
 */
export function computeTweenSpans(keys: BoneKeyframe[], duration: number): TweenSpanSegment[] {
  if (!keys || keys.length < 2 || duration <= 0) return []
  const spans: TweenSpanSegment[] = []
  for (let i = 0; i < keys.length - 1; i++) {
    const cur = keys[i]
    const next = keys[i + 1]
    if (next.time <= cur.time + 1e-4) continue
    const leftPct = Math.max(0, Math.min(100, (cur.time / duration) * 100))
    const rightPct = Math.max(leftPct, Math.min(100, (next.time / duration) * 100))
    const kind: TweenSpanSegment['kind'] =
      cur.easing === 'hold' ? 'hold' : cur.easing === 'linear' ? 'linear' : 'motion'
    spans.push({
      startTime: cur.time,
      endTime: next.time,
      leftPct,
      widthPct: Math.max(0.4, rightPct - leftPct),
      easing: cur.easing,
      kind
    })
  }
  return spans
}

/** Gom tất cả mốc thời gian có keyframe trên toàn bộ khung xương cho hàng tổng hợp `TẤT CẢ KHỚP` (Moho Master Channel). */
export function collectMasterPoseTimes(rig: LayerRig): number[] {
  const raw: number[] = []
  for (const bone of rig.bones) {
    const track = rig.tracks[bone.id] ?? []
    for (const k of track) {
      raw.push(k.time)
    }
  }
  raw.sort((a, b) => a - b)
  const unique: number[] = []
  for (const t of raw) {
    if (unique.length === 0 || Math.abs(t - unique[unique.length - 1]) > 0.001) {
      unique.push(t)
    }
  }
  return unique
}

/** Tính toạ độ khớp ngọn (tail) của xương ở trạng thái gốc Frame 0. */
export function computeBoneTail(bone: Pick<LayerBone, 'x' | 'y' | 'length' | 'angle'>): { x: number; y: number } {
  const rad = (bone.angle * Math.PI) / 180
  return {
    x: bone.x + Math.cos(rad) * bone.length,
    y: bone.y + Math.sin(rad) * bone.length
  }
}

/** Tính lại `{ length, angle }` để ngọn xương hướng chính xác tới điểm `target` mà không đổi khớp gốc `(x, y)`. */
export function aimBoneAtPoint(
  bone: Pick<LayerBone, 'x' | 'y' | 'length' | 'angle'>,
  target: { x: number; y: number }
): { length: number; angle: number } {
  const dx = target.x - bone.x
  const dy = target.y - bone.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return { length: bone.length, angle: bone.angle }
  return {
    length: Number(Math.max(1, dist).toFixed(2)),
    angle: Number(((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2))
  }
}

/**
 * Tìm xương con nối liền trực tiếp tại ngọn xương cha (VD: Bắp tay -> Cẳng tay -> Bàn tay, Đùi -> Cẳng chân -> Bàn chân, Hông -> Thân -> Đầu).
 * Các nhánh phụ rẽ ngang từ xa (như 2 vai rẽ từ ngực, 2 đùi rẽ từ hông, hay xương con đồng tâm tại gốc cổ chân) được bỏ qua để giữ đường nét đứt chuẩn Moho.
 */
export function findPrimaryConnectedChild(
  parent: LayerBone,
  bones: LayerBone[],
  maxGapRatio = 0.28
): LayerBone | null {
  if (parent.pin) return null
  const tail = computeBoneTail(parent)
  const threshold = Math.max(26, parent.length * maxGapRatio)
  let best: LayerBone | null = null
  let bestDist = Infinity

  for (const candidate of bones) {
    if (candidate.parentId !== parent.id) continue
    // Bỏ qua xương con đặt trùng ngay tại khớp gốc của xương cha (VD gót chân & vòm bàn chân cùng chung pivot cổ chân)
    if (Math.hypot(candidate.x - parent.x, candidate.y - parent.y) < 6) continue
    const dist = Math.hypot(tail.x - candidate.x, tail.y - candidate.y)
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  return best
}

/**
 * Hàn khớp nối chuỗi xương chuẩn Moho Pro / Spine 2D:
 * Tự động căn chỉnh `{ length, angle }` của mọi xương cha có xương con nối tiếp để khớp tròn ngọn (tail)
 * trùng khít 100% tâm khớp gốc (head) của xương con, triệt tiêu hoàn toàn hiện tượng 2 vòng tròn lệch nhau.
 */
export function weldConnectedLimbBones(bones: LayerBone[], maxGapRatio = 0.28): LayerBone[] {
  return bones.map((bone) => {
    const child = findPrimaryConnectedChild(bone, bones, maxGapRatio)
    if (!child) return { ...bone }
    return {
      ...bone,
      ...aimBoneAtPoint(bone, { x: child.x, y: child.y })
    }
  })
}

/** Kiểm tra xem khớp ngọn thực tế (sau biến đổi động) của xương có đang trùng khít với khớp gốc của ít nhất 1 xương con hay không. */
export function isBoneTailCoincidentWithChild(
  parent: LayerBone,
  bones: LayerBone[],
  transforms: Map<string, { x: number; y: number; rotation: number }>,
  tolerance = 3
): boolean {
  if (parent.pin) return false
  const pTf = transforms.get(parent.id)
  if (!pTf) return false
  const rad = ((parent.angle + pTf.rotation) * Math.PI) / 180
  const tx = pTf.x + Math.cos(rad) * parent.length
  const ty = pTf.y + Math.sin(rad) * parent.length

  for (const child of bones) {
    if (child.parentId !== parent.id) continue
    const cTf = transforms.get(child.id)
    if (!cTf) continue
    if (Math.hypot(tx - cTf.x, ty - cTf.y) <= tolerance) return true
  }
  return false
}

/**
 * Co giãn hoặc kẹp an toàn toàn bộ mốc thời gian keyframe khi đổi thời lượng / tổng số frame của clip:
 * - `scaleKeys = true`: co giãn tỷ lệ `t' = (t / oldDuration) * newDuration` (Retime mượt toàn bộ động tác).
 * - `scaleKeys = false`: giữ nguyên thời điểm các key nằm trong `[0, newDuration]` và cắt bỏ/gộp an toàn các key vượt quá `newDuration` để không bao giờ gây lỗi `validateRig`.
 */
export function retimeOrClampTracks(
  tracks: Record<string, BoneKeyframe[]>,
  oldDuration: number,
  newDuration: number,
  scaleKeys: boolean
): Record<string, BoneKeyframe[]> {
  const safeNew = Math.max(0.1, Math.min(120, Number(newDuration.toFixed(4))))
  const safeOld = Math.max(0.001, oldDuration)
  const out: Record<string, BoneKeyframe[]> = {}

  for (const [boneId, keys] of Object.entries(tracks)) {
    if (!Array.isArray(keys) || keys.length === 0) continue
    const mapped = keys
      .map((k) => {
        const rawTime = scaleKeys ? (k.time / safeOld) * safeNew : Math.min(safeNew, k.time)
        return {
          ...k,
          time: Math.max(0, Math.min(safeNew, Number(rawTime.toFixed(4))))
        }
      })
      .sort((a, b) => a.time - b.time)

    const deduped: BoneKeyframe[] = []
    for (const k of mapped) {
      if (deduped.length > 0 && k.time - deduped[deduped.length - 1].time <= 1e-4) {
        deduped[deduped.length - 1] = k
      } else {
        deduped.push(k)
      }
    }
    if (deduped.length > 0) out[boneId] = deduped
  }
  return out
}
