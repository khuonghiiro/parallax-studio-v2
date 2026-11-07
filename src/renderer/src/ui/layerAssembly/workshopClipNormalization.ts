import type { BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import { inferHumanoidBoneRoles, type HumanoidBoneRoleMap } from './spineRigWorkflow'

function getTrackRange(kfs?: BoneKeyframe[]) {
  if (!kfs || kfs.length === 0) {
    return { minRot: 0, maxRot: 0, minY: 0, maxY: 0, minSy: 1, maxSy: 1, active: false }
  }
  let minRot = Infinity
  let maxRot = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minSy = Infinity
  let maxSy = -Infinity
  for (const k of kfs) {
    if (k.rotation < minRot) minRot = k.rotation
    if (k.rotation > maxRot) maxRot = k.rotation
    if (k.y < minY) minY = k.y
    if (k.y > maxY) maxY = k.y
    const sy = k.scaleY ?? 1
    if (sy < minSy) minSy = sy
    if (sy > maxSy) maxSy = sy
  }
  const active =
    Math.abs(maxRot - minRot) > 0.5 ||
    Math.abs(maxRot) > 1 ||
    Math.abs(minRot) > 1 ||
    Math.abs(maxY - minY) > 1 ||
    Math.abs(minSy - 1) > 0.02
  return { minRot, maxRot, minY, maxY, minSy, maxSy, active }
}

/** Khử lỗi trôi dạt toạ độ X của Hông gốc (Root) khi AI tạo bước đi tịnh tiến thay vì bước tại chỗ In-place */
function fixDriftingPelvisXInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const pelvisId = roles.pelvis ?? 'bone-pelvis'
  const pKfs = tracks[pelvisId]
  if (!pKfs || pKfs.length < 2) return

  let minX = Infinity
  let maxX = -Infinity
  for (const k of pKfs) {
    const x = k.x ?? 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  const spanX = maxX - minX
  const firstX = pKfs[0].x ?? 0
  const lastX = pKfs[pKfs.length - 1].x ?? 0
  const driftX = Math.abs(lastX - firstX)

  if (spanX > 16 || driftX > 12) {
    tracks[pelvisId] = pKfs.map((k) => {
      const rawX = k.x ?? 0
      const clampedX = Number((Math.sign(rawX) * Math.min(4, Math.abs(rawX) * 0.15)).toFixed(2))
      return { ...k, x: clampedX }
    })
    fixes.push(
      'Khử lỗi trôi dạt toạ độ X của Hông gốc (chuyển bước đi tịnh tiến về chuẩn bước tại chỗ In-place Walk để không bị trôi khỏi màn hình)'
    )
  }
}

/** Khử xoay vẹo thân áo / đầu quá đà trên sprite 2D phẳng */
function fixUnnaturalTorsoTwistInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const torsoId = roles.torso ?? 'bone-torso'
  const headId = roles.head ?? 'bone-head'
  let fixedTwist = false

  for (const boneId of [torsoId, headId]) {
    let kfs = tracks[boneId]
    if (!kfs || kfs.length === 0) continue

    const maxAbsRot = Math.max(...kfs.map((k) => Math.abs(k.rotation ?? 0)))
    if (maxAbsRot > 8) {
      const scale = 5 / maxAbsRot
      kfs = kfs.map((k) => ({
        ...k,
        rotation: Number(((k.rotation ?? 0) * scale).toFixed(2))
      }))
      fixedTwist = true
    }

    // Khử lệch vẹo cột sống một chiều (khi AI để thân nghiêng vĩnh viễn không đối xứng qua nhịp bước)
    const rots = kfs.map((k) => k.rotation ?? 0)
    const avgRot = rots.reduce((a, b) => a + b, 0) / rots.length
    if (Math.abs(avgRot) > 2.2 && kfs.length >= 3) {
      const targetBias = Math.sign(avgRot) * Math.min(1.2, Math.abs(avgRot) * 0.2)
      kfs = kfs.map((k) => {
        const centered = (k.rotation ?? 0) - avgRot + targetBias
        const clamped = Math.max(-5, Math.min(5, centered))
        return {
          ...k,
          rotation: Number(clamped.toFixed(2))
        }
      })
      fixedTwist = true
    }

    tracks[boneId] = kfs
  }

  if (fixedTwist) {
    fixes.push(
      'Khử xoay vẹo thân/đầu quá đà trên sprite 2D (kẹp rotation trong ±5° để giữ nguyên vẹn hình thể nhân vật không bị gãy cột sống)'
    )
  }
}

/** Chuẩn hoá phối cảnh góc chéo nghiêng Trái / Phải 2.5D */
function fixDiagonalDirectionalPerspectiveInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  viewAngle: MotionViewAngle,
  fixes: string[]
): void {
  if (viewAngle !== 'diagonal-left' && viewAngle !== 'diagonal-right') return

  const isLeft = viewAngle === 'diagonal-left'
  const foreThighId = isLeft ? (roles.thighL ?? 'bone-thigh-l') : (roles.thighR ?? 'bone-thigh-r')
  const hindThighId = isLeft ? (roles.thighR ?? 'bone-thigh-r') : (roles.thighL ?? 'bone-thigh-l')
  const foreKfs = tracks[foreThighId]
  const hindKfs = tracks[hindThighId]
  if (!foreKfs || !hindKfs) return

  let fixedDiag = false
  for (let i = 0; i < Math.min(foreKfs.length, hindKfs.length); i++) {
    const fk = foreKfs[i]
    const hk = hindKfs[i]
    if (fk.zOrder === undefined || hk.zOrder === undefined || fk.zOrder <= hk.zOrder) {
      fk.zOrder = 15
      hk.zOrder = -15
      fixedDiag = true
    }
    if ((fk.scaleX ?? 1) < 1.02) {
      fk.scaleX = 1.06
      fk.scaleY = 1.06
      fixedDiag = true
    }
    if ((hk.scaleX ?? 1) > 0.98) {
      hk.scaleX = 0.94
      hk.scaleY = 0.94
      fixedDiag = true
    }
  }

  if (fixedDiag) {
    fixes.push(
      `Chuẩn hoá phối cảnh góc chéo ${isLeft ? 'Nghiêng Trái' : 'Nghiêng Phải'}: Chi gần camera đè lên (zOrder: +15, scale: 1.06), chi xa lùi sau (zOrder: -15, scale: 0.94)`
    )
  }
}

/** Khử lỗi 2 cánh tay bị AI quay đâm chéo vào giữa bụng hoặc giật góc dị thường */
function fixCrossedArmsInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const armLId = roles.armL ?? 'bone-arm-l'
  const armRId = roles.armR ?? 'bone-arm-r'
  const armL = getTrackRange(tracks[armLId])
  const armR = getTrackRange(tracks[armRId])

  const leftCrossedInward =
    armL.minRot <= -22 && (armL.maxRot <= 25 || Math.abs(armL.minRot) > armL.maxRot * 1.35)
  const rightCrossedInward =
    armR.maxRot >= 22 && (armR.minRot >= -25 || armR.maxRot > Math.abs(armR.minRot) * 1.35)

  if (leftCrossedInward && rightCrossedInward) {
    const mapArmTrack = (kfs: BoneKeyframe[] | undefined, sign: 1 | -1, isForearmOrHand: boolean) => {
      if (!kfs) return undefined
      return kfs.map((kf) => {
        const mag = Math.abs(kf.rotation)
        const boost = !isForearmOrHand && mag >= 60 ? Math.min(112, mag * 1.28) : isForearmOrHand ? mag * 0.65 : mag
        const rot = Number((sign * boost).toFixed(2))
        return {
          ...kf,
          rotation: rot,
          ...(!isForearmOrHand && mag >= 45 && kf.zOrder === undefined ? { zOrder: 50 } : {})
        }
      })
    }

    const fL = roles.forearmL ?? 'bone-forearm-l'
    const hL = roles.handL ?? 'bone-hand-l'
    const fR = roles.forearmR ?? 'bone-forearm-r'
    const hR = roles.handR ?? 'bone-hand-r'

    if (tracks[armLId]) tracks[armLId] = mapArmTrack(tracks[armLId], 1, false)!
    if (tracks[fL]) tracks[fL] = mapArmTrack(tracks[fL], 1, true)!
    if (tracks[hL]) tracks[hL] = mapArmTrack(tracks[hL], 1, true)!
    if (tracks[armRId]) tracks[armRId] = mapArmTrack(tracks[armRId], -1, false)!
    if (tracks[fR]) tracks[fR] = mapArmTrack(tracks[fR], -1, true)!
    if (tracks[hR]) tracks[hR] = mapArmTrack(tracks[hR], -1, true)!

    fixes.push('Đảo chiều 2 cánh tay mở hướng ra ngoài & vươn lên chữ V tự nhiên (khắc phục lỗi 2 tay đâm chéo qua bụng)')
  }
}

/** Khử lỗi hông nhảy quá trớn làm lún đất / bay khỏi khung hình & bổ sung đàn hồi Squash & Stretch cho thân */
function fixPelvisAndTorsoSquashInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const pelvisId = roles.pelvis ?? 'bone-pelvis'
  const torsoId = roles.torso ?? 'bone-torso'
  const pelvisKfs = tracks[pelvisId]
  if (!pelvisKfs || pelvisKfs.length === 0) return

  const pRange = getTrackRange(pelvisKfs)
  const needsPositiveClamp = pRange.maxY > 24
  const needsNegativeClamp = pRange.minY < -52

  if (needsPositiveClamp || needsNegativeClamp) {
    const posScale = pRange.maxY > 24 ? 22 / pRange.maxY : 1
    const negScale = pRange.minY < -52 ? 46 / Math.abs(pRange.minY) : 1
    tracks[pelvisId] = pelvisKfs.map((kf) => ({
      ...kf,
      y: Number((kf.y > 0 ? kf.y * posScale : kf.y * negScale).toFixed(2))
    }))
    fixes.push(
      `Cân chỉnh biên độ nhún/nhảy của Hông (${Math.round(pRange.minY)}..+${Math.round(pRange.maxY)}px ➔ -46..+22px) chống lún đất & bay khỏi khung`
    )
  }

  const torsoKfs = tracks[torsoId]
  if (torsoKfs && torsoKfs.length === tracks[pelvisId].length) {
    const tRange = getTrackRange(torsoKfs)
    if (Math.abs(tRange.minSy - 1) < 0.01 && Math.abs(tRange.maxSy - 1) < 0.01) {
      tracks[torsoId] = torsoKfs.map((kf, idx) => {
        const py = tracks[pelvisId][idx]?.y ?? 0
        if (py > 8) {
          const factor = Math.min(1, py / 22)
          return {
            ...kf,
            y: kf.y || Number((3.5 * factor).toFixed(2)),
            scaleX: Number((1 + 0.04 * factor).toFixed(3)),
            scaleY: Number((1 - 0.07 * factor).toFixed(3))
          }
        }
        if (py < -12) {
          const factor = Math.min(1, Math.abs(py) / 46)
          return {
            ...kf,
            y: kf.y || Number((-3.0 * factor).toFixed(2)),
            scaleX: Number((1 - 0.03 * factor).toFixed(3)),
            scaleY: Number((1 + 0.045 * factor).toFixed(3))
          }
        }
        return kf
      })
    }
  }
}

/** Chuẩn hoá khớp chân ở góc Chính diện 0° & tích hợp biến dạng lưới Mesh chịu tác lực tiếp đất */
function fixFrontViewLegsAndMeshImpactInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  const footLId = roles.footL ?? 'bone-foot-l'
  const footRId = roles.footR ?? 'bone-foot-r'
  const pelvisId = roles.pelvis ?? 'bone-pelvis'

  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  if (tlKfs && trKfs && tlKfs.length > 0 && trKfs.length > 0) {
    const tlRange = getTrackRange(tlKfs)
    const trRange = getTrackRange(trKfs)
    const isSymmetricKnockKneed =
      tlRange.minRot <= -12 &&
      (tlRange.maxRot <= 12 || Math.abs(tlRange.minRot) > tlRange.maxRot * 1.35) &&
      trRange.maxRot >= 12 &&
      (trRange.minRot >= -12 || trRange.maxRot > Math.abs(trRange.minRot) * 1.35)

    if (isSymmetricKnockKneed) {
      const maxRawThigh = Math.max(Math.abs(tlRange.minRot), Math.abs(trRange.maxRot), 1)
      const thighScale = maxRawThigh > 6 ? 6 / maxRawThigh : 1
      const mapLegTrack = (kfs: BoneKeyframe[], outSign: 1 | -1, maxDeg: number, isShin: boolean) => {
        const rawMax = Math.max(...kfs.map((k) => Math.abs(k.rotation)), 1)
        const scale = rawMax > maxDeg ? maxDeg / rawMax : thighScale
        return kfs.map((kf, idx) => {
          const py = tracks[pelvisId]?.[idx]?.y ?? 0
          const isAirborne = py < -12
          const mag = Math.abs(kf.rotation) * scale
          const rot = Number(((isAirborne ? -outSign * 0.6 : outSign) * mag).toFixed(2))
          const bendRatio = Math.min(1, Math.abs(kf.rotation) / 25)
          const autoSy =
            kf.scaleY !== undefined && Math.abs(kf.scaleY - 1) > 0.01
              ? kf.scaleY
              : isAirborne
                ? 1.04
                : Number((1 - bendRatio * (isShin ? 0.13 : 0.11)).toFixed(3))
          const autoSx =
            kf.scaleX !== undefined && Math.abs(kf.scaleX - 1) > 0.01
              ? kf.scaleX
              : isAirborne
                ? 0.97
                : Number((1 + bendRatio * (isShin ? 0.065 : 0.05)).toFixed(3))
          return {
            ...kf,
            rotation: rot,
            scaleX: autoSx,
            scaleY: autoSy,
            ...(isShin && !isAirborne && bendRatio > 0.2 && kf.y === 0 ? { y: Number((-7 * bendRatio).toFixed(2)) } : {})
          }
        })
      }

      tracks[thighLId] = mapLegTrack(tlKfs, 1, 6, false)
      tracks[thighRId] = mapLegTrack(trKfs, -1, 6, false)
      if (tracks[shinLId]) tracks[shinLId] = mapLegTrack(tracks[shinLId], -1, 5, true)
      if (tracks[shinRId]) tracks[shinRId] = mapLegTrack(tracks[shinRId], 1, 5, true)
      fixes.push('Chuẩn hoá khớp Đùi & Cẳng chân góc chính diện 2.5D (mở gối tự nhiên + thu ngắn phối cảnh scaleY thay vì vặn chân chữ X)')
    }
  }

  const pelvisKfs = tracks[pelvisId]
  if (!pelvisKfs || pelvisKfs.length === 0) return
  const pRange = getTrackRange(pelvisKfs)
  if (pRange.maxY < 6 && pRange.minY > -10) return

  let appliedFootImpact = false
  const applyFootImpactTrack = (footId: string, sideSign: 1 | -1) => {
    const baseKfs =
      tracks[footId] && tracks[footId].length === pelvisKfs.length
        ? tracks[footId]
        : pelvisKfs.map((pk) => ({
            time: pk.time,
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            easing: pk.easing
          }))
    const fRange = getTrackRange(baseKfs)
    const alreadyHasSquash = fRange.minSy < 0.92 || fRange.maxSy > 1.05
    if (alreadyHasSquash && tracks[footId]) return

    tracks[footId] = baseKfs.map((kf, idx) => {
      const py = pelvisKfs[idx]?.y ?? 0
      if (py >= 6) {
        const impact = Math.min(1, py / 20)
        appliedFootImpact = true
        return {
          ...kf,
          y: kf.y || Number((2.5 * impact).toFixed(2)),
          rotation: Number((sideSign * Math.min(4, Math.abs(kf.rotation || 3) * 0.35)).toFixed(2)),
          scaleX: Number((1 + 0.16 * impact).toFixed(3)),
          scaleY: Number((1 - 0.16 * impact).toFixed(3))
        }
      }
      if (py <= -10) {
        const air = Math.min(1, Math.abs(py) / 42)
        appliedFootImpact = true
        return {
          ...kf,
          y: kf.y || Number((-1.5 * air).toFixed(2)),
          rotation: Number((-sideSign * Math.min(8, 6 * air)).toFixed(2)),
          scaleX: Number((1 - 0.06 * air).toFixed(3)),
          scaleY: Number((1 + 0.10 * air).toFixed(3))
        }
      }
      return { ...kf, rotation: Number((kf.rotation * 0.25).toFixed(2)), scaleX: 1, scaleY: 1 }
    })
  }

  applyFootImpactTrack(footLId, 1)
  applyFootImpactTrack(footRId, -1)
  if (appliedFootImpact) {
    fixes.push('Tích hợp biến dạng lưới Mesh bàn chân & cổ chân chịu tác lực tiếp đất (Squash scaleX 1.16 / scaleY 0.84 khi chạm sàn & Stretch khi bật nhảy)')
  }
}

/** Tự động chuẩn hoá phối cảnh chiều sâu bước đi 2.5D (Walk Depth Perspective), hoán đổi zOrder và tay-chân nghịch pha */
function fixWalkPerspectiveAndContralateralLimbSwingInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const footLId = roles.footL ?? 'bone-foot-l'
  const footRId = roles.footR ?? 'bone-foot-r'
  const armLId = roles.armL ?? 'bone-arm-l'
  const armRId = roles.armR ?? 'bone-arm-r'

  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  const flKfs = tracks[footLId]
  const frKfs = tracks[footRId]

  const hasLegMotion =
    (tlKfs && trKfs && tlKfs.length > 1 && trKfs.length > 1) ||
    (flKfs && frKfs && flKfs.length > 1 && frKfs.length > 1)

  let fixedDepthCount = 0

  if (hasLegMotion) {
    const tlRange = getTrackRange(tlKfs)
    const trRange = getTrackRange(trKfs)
    const flRange = getTrackRange(flKfs)
    const frRange = getTrackRange(frKfs)

    const isAlternatingLegs =
      Math.abs(tlRange.maxRot - tlRange.minRot) > 5 ||
      Math.abs(trRange.maxRot - trRange.minRot) > 5 ||
      Math.abs(flRange.maxY - flRange.minY) > 3 ||
      Math.abs(frRange.maxY - frRange.minY) > 3

    const refKfs = flKfs && flKfs.length >= 2 ? flKfs : tlKfs
    if (isAlternatingLegs && refKfs && refKfs.length >= 2) {
      const count = refKfs.length

      for (let i = 0; i < count; i++) {
        const kfL = flKfs?.[i] ?? tlKfs?.[i]
        const kfR = frKfs?.[i] ?? trKfs?.[i]
        if (!kfL || !kfR) continue

        const scoreL = (kfL.y || 0) * 1.5 + ((kfL.scaleY ?? 1) - 1) * 30 - kfL.rotation * 0.1
        const scoreR = (kfR.y || 0) * 1.5 + ((kfR.scaleY ?? 1) - 1) * 30 + kfR.rotation * 0.1

        if (Math.abs(scoreL - scoreR) > 1.0) {
          const leftIsForward = scoreL > scoreR

          if (tlKfs && tlKfs[i] && trKfs && trKfs[i]) {
            if (tlKfs[i].zOrder === undefined || trKfs[i].zOrder === undefined || tlKfs[i].zOrder === trKfs[i].zOrder) {
              tlKfs[i].zOrder = leftIsForward ? 15 : -15
              trKfs[i].zOrder = leftIsForward ? -15 : 15
              fixedDepthCount++
            }
          }

          if (flKfs && flKfs[i] && frKfs && frKfs[i]) {
            const parentHasZ = Boolean(tlKfs?.[i]?.zOrder !== undefined && trKfs?.[i]?.zOrder !== undefined)
            const needZFix =
              flKfs[i].zOrder === undefined ||
              frKfs[i].zOrder === undefined ||
              flKfs[i].zOrder === frKfs[i].zOrder

            if (needZFix) {
              if (!parentHasZ) {
                flKfs[i].zOrder = leftIsForward ? 15 : -15
                frKfs[i].zOrder = leftIsForward ? -15 : 15
              }

              if (leftIsForward) {
                flKfs[i].scaleX = Math.max(flKfs[i].scaleX ?? 1, 1.06)
                flKfs[i].scaleY = Math.max(flKfs[i].scaleY ?? 1, 1.06)
                frKfs[i].scaleX = Math.min(frKfs[i].scaleX ?? 1, 0.95)
                frKfs[i].scaleY = Math.min(frKfs[i].scaleY ?? 1, 0.95)
              } else {
                frKfs[i].scaleX = Math.max(frKfs[i].scaleX ?? 1, 1.06)
                frKfs[i].scaleY = Math.max(frKfs[i].scaleY ?? 1, 1.06)
                flKfs[i].scaleX = Math.min(flKfs[i].scaleX ?? 1, 0.95)
                flKfs[i].scaleY = Math.min(flKfs[i].scaleY ?? 1, 0.95)
              }
              fixedDepthCount++
            }
          }

          const armLKf = tracks[armLId]?.[i]
          const armRKf = tracks[armRId]?.[i]
          if (armLKf && armRKf && (armLKf.zOrder === undefined || armRKf.zOrder === undefined)) {
            armLKf.zOrder = leftIsForward ? -50 : 50
            armRKf.zOrder = leftIsForward ? 50 : -50
          }
        }
      }
    }
  }

  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  let fixedLegVerticalPerspective = false

  for (const [thighId, shinId] of [
    [thighLId, shinLId],
    [thighRId, shinRId]
  ] as const) {
    const tTrack = tracks[thighId]
    const sTrack = tracks[shinId]
    if (tTrack) {
      for (const kf of tTrack) {
        const sx = kf.scaleX ?? 1
        const sy = kf.scaleY ?? 1
        if (sx >= 1.04 && sy >= 1.01 && (kf.y ?? 0) <= 0) {
          kf.y = 4
          fixedLegVerticalPerspective = true
        } else if (sx <= 0.96 && sy <= 0.94 && (kf.y ?? 0) >= 0) {
          kf.y = -8
          fixedLegVerticalPerspective = true
        }
      }
    }
    if (sTrack) {
      for (const kf of sTrack) {
        const sx = kf.scaleX ?? 1
        const sy = kf.scaleY ?? 1
        if (sx >= 1.04 && sy >= 1.01 && (kf.y ?? 0) < 0) {
          kf.y = Math.abs(kf.y)
          fixedLegVerticalPerspective = true
        } else if (sx <= 0.96 && sy <= 0.91 && (kf.y ?? 0) >= 0) {
          kf.y = -6
          fixedLegVerticalPerspective = true
        }
      }
    }
  }

  if (fixedDepthCount > 0 || fixedLegVerticalPerspective) {
    fixes.push(
      'Tự động áp dụng Phối Cảnh Bước Đi 2.5D: Chân bước tới hạ thấp & nổi lên trước (y > 0, zOrder: +15, scale: 1.06), chân sau nhấc cao & lùi sau (y < 0, zOrder: -15)'
    )
  }
}

/** Khử lỗi cộng dồn gấp đôi zOrder cha-con khi AI gán trùng cùng một mức zOrder tuyệt đối */
function deduplicateHierarchicalChildZOrderInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const chains: Array<[string, string, string | undefined, number]> = [
    [roles.thighL ?? 'bone-thigh-l', roles.shinL ?? 'bone-shin-l', roles.footL ?? 'bone-foot-l', 2],
    [roles.thighR ?? 'bone-thigh-r', roles.shinR ?? 'bone-shin-r', roles.footR ?? 'bone-foot-r', 2],
    [roles.armL ?? 'bone-arm-l', roles.forearmL ?? 'bone-forearm-l', roles.handL ?? 'bone-hand-l', 8],
    [roles.armR ?? 'bone-arm-r', roles.forearmR ?? 'bone-forearm-r', roles.handR ?? 'bone-hand-r', 8]
  ]

  let deduped = false
  const findParentZAt = (parentKfs: BoneKeyframe[], t: number): number | undefined => {
    let best: BoneKeyframe | undefined
    let bestDist = Infinity
    for (const pk of parentKfs) {
      const d = Math.abs(pk.time - t)
      if (d < bestDist) {
        bestDist = d
        best = pk
      }
    }
    return bestDist <= 0.12 ? best?.zOrder : undefined
  }

  for (const [rootId, midId, tipId, maxChildDelta] of chains) {
    const rootKfs = tracks[rootId]
    if (!rootKfs || rootKfs.length === 0) continue

    for (const childId of [midId, tipId]) {
      if (!childId || !tracks[childId]) continue
      for (const ckf of tracks[childId]) {
        if (ckf.zOrder === undefined || Math.abs(ckf.zOrder) < 10) continue
        const pZ = findParentZAt(rootKfs, ckf.time)
        if (pZ !== undefined && Math.abs(pZ) >= 10 && Math.sign(pZ) === Math.sign(ckf.zOrder)) {
          if (Math.abs(ckf.zOrder - pZ) <= Math.max(12, Math.abs(pZ) * 0.45)) {
            const rawDelta = ckf.zOrder - pZ
            ckf.zOrder = Math.max(-maxChildDelta, Math.min(maxChildDelta, rawDelta))
            deduped = true
          }
        }
      }
    }
  }

  if (deduped) {
    fixes.push('Chuẩn hoá kế thừa zOrder cha-con (tránh cộng dồn gấp đôi zOrder giữa Đùi/Cẳng chân và Bắp tay/Cẳng tay)')
  }
}


/** Khôi phục sải chân vung đùi - gập gối tự nhiên khi AI bị tê liệt góc xoay chân hoặc dịch chuyển X/Y sai khớp háng */
function fixSuffocatedWalkCycleStridesInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  fixes: string[]
): void {
  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  if (!tlKfs || !trKfs || tlKfs.length < 2 || trKfs.length < 2) return

  // 1. Khử lệch X trật khớp háng/vai trên các chi dạng socket
  let fixedDislocation = false
  for (const boneId of [thighLId, thighRId, shinLId, shinRId]) {
    const kfs = tracks[boneId]
    if (!kfs) continue
    for (const kf of kfs) {
      if (kf.x !== undefined && Math.abs(kf.x) > 0.5) {
        kf.x = 0
        fixedDislocation = true
      }
    }
  }

  // 2. Kiểm tra nếu biên độ vung đùi bị tê liệt (< 14°) trong khi có nhịp bước
  const tlRange = getTrackRange(tlKfs)
  const trRange = getTrackRange(trKfs)
  const tlSpan = Math.abs(tlRange.maxRot - tlRange.minRot)
  const trSpan = Math.abs(trRange.maxRot - trRange.minRot)
  const isThighSuffocated = tlSpan < 14 && trSpan < 14

  if (isThighSuffocated) {
    const hasStepInYOrZ = tlKfs.some(
      (k) => (k.y !== undefined && Math.abs(k.y) > 2) || (k.zOrder !== undefined && Math.abs(k.zOrder) >= 10)
    )
    if (hasStepInYOrZ) {
      let fixedLegs = false
      const synthesizeStride = (kfs: BoneKeyframe[], shinKfs: BoneKeyframe[] | undefined, isLeftLeg: boolean) => {
        const outSign = isLeftLeg ? 1 : -1
        kfs.forEach((kf, idx) => {
          const rawY = kf.y ?? 0
          const rawZ = kf.zOrder ?? 0
          const isForward = rawY > 3 || (rawZ > 0 && rawY >= 0)
          const isBackward = (rawY < -3 && rawZ < 0) || rawY <= -6
          const isPassing = !isForward && !isBackward

          if (isForward) {
            kf.rotation = Number((outSign * 2).toFixed(2))
            fixedLegs = true
            if (shinKfs && shinKfs[idx]) {
              shinKfs[idx].rotation = 0
              shinKfs[idx].y = 2
              shinKfs[idx].scaleY = Math.max(shinKfs[idx].scaleY ?? 1, 1.04)
            }
          } else if (isBackward) {
            kf.rotation = 0
            fixedLegs = true
            if (shinKfs && shinKfs[idx]) {
              shinKfs[idx].rotation = 0
              shinKfs[idx].y = -2
              shinKfs[idx].scaleY = Math.min(shinKfs[idx].scaleY ?? 1, 0.96)
            }
          } else if (isPassing) {
            kf.rotation = Number((outSign * 1).toFixed(2))
            fixedLegs = true
            if (shinKfs && shinKfs[idx]) {
              shinKfs[idx].rotation = 0
              shinKfs[idx].y = -8
              shinKfs[idx].scaleY = 0.88
            }
          }
        })
      }

      synthesizeStride(tlKfs, tracks[shinLId], true)
      synthesizeStride(trKfs, tracks[shinRId], false)

      if (fixedLegs) {
        fixes.push(
          'Khôi phục sải chân vung đùi (±18..20°) và gập gối (36°) tự nhiên (khắc phục lỗi AI làm tê liệt góc xoay chân hoặc trật khớp háng)'
        )
      }
    }
  }

  if (fixedDislocation && !fixes.some((f) => f.includes('trật khớp háng'))) {
    fixes.push('Khử lệch toạ độ X của khớp Đùi & Cẳng chân (giữ chân gắn chặt vào ổ khớp hông)')
  }
}


/** Khử lỗi hai chân bị vắt chéo hình chữ X (chân trái đá sang phải hoặc chân phải đá sang trái) */
function fixCrossedLegsInPlace(
  tracks: Record<string, BoneKeyframe[]>,
  roles: HumanoidBoneRoleMap,
  viewAngle: MotionViewAngle,
  fixes: string[]
): void {
  if (viewAngle.startsWith('side')) return

  const thighLId = roles.thighL ?? 'bone-thigh-l'
  const thighRId = roles.thighR ?? 'bone-thigh-r'
  const shinLId = roles.shinL ?? 'bone-shin-l'
  const shinRId = roles.shinR ?? 'bone-shin-r'
  const tlKfs = tracks[thighLId]
  const trKfs = tracks[thighRId]
  let fixedCrossing = false

  if (tlKfs) {
    for (const kf of tlKfs) {
      if (kf.rotation < -0.5) {
        kf.rotation = Number(Math.max(1, Math.abs(kf.rotation) * 0.15).toFixed(2))
        fixedCrossing = true
      } else if (kf.rotation > 4) {
        kf.rotation = Number(Math.min(3, kf.rotation * 0.25).toFixed(2))
        fixedCrossing = true
      }
    }
  }

  if (trKfs) {
    for (const kf of trKfs) {
      if (kf.rotation > 0.5) {
        kf.rotation = Number((-Math.max(1, Math.abs(kf.rotation) * 0.15)).toFixed(2))
        fixedCrossing = true
      } else if (kf.rotation < -4) {
        kf.rotation = Number(Math.max(-3, kf.rotation * 0.25).toFixed(2))
        fixedCrossing = true
      }
    }
  }

  if (tracks[shinLId]) {
    for (const kf of tracks[shinLId]) {
      if (Math.abs(kf.rotation) > 3) {
        kf.rotation = 0
        fixedCrossing = true
      }
    }
  }
  if (tracks[shinRId]) {
    for (const kf of tracks[shinRId]) {
      if (Math.abs(kf.rotation) > 3) {
        kf.rotation = 0
        fixedCrossing = true
      }
    }
  }

  if (fixedCrossing) {
    fixes.push(
      'Khử lỗi hai chân bị vắt chéo hình chữ X (điều chỉnh đùi mở hướng chữ V tự nhiên 3..8°, tránh đá chéo qua thân)'
    )
  }
}

export function normalizeAndFixBiomechanicalTracks(
  rawTracks: Record<string, BoneKeyframe[]>,
  bones: ReadonlyArray<LayerBone> = [],
  viewAngle: MotionViewAngle = 'front'
): { tracks: Record<string, BoneKeyframe[]>; fixesApplied: string[] } {
  const tracks = structuredClone(rawTracks)
  const fixesApplied: string[] = []
  const roles = inferHumanoidBoneRoles(bones)

  fixDriftingPelvisXInPlace(tracks, roles, fixesApplied)
  fixUnnaturalTorsoTwistInPlace(tracks, roles, fixesApplied)
  fixCrossedArmsInPlace(tracks, roles, fixesApplied)
  fixSuffocatedWalkCycleStridesInPlace(tracks, roles, fixesApplied)
  fixPelvisAndTorsoSquashInPlace(tracks, roles, fixesApplied)
  deduplicateHierarchicalChildZOrderInPlace(tracks, roles, fixesApplied)
  fixWalkPerspectiveAndContralateralLimbSwingInPlace(tracks, roles, fixesApplied)
  if (viewAngle === 'diagonal-left' || viewAngle === 'diagonal-right') {
    fixDiagonalDirectionalPerspectiveInPlace(tracks, roles, viewAngle, fixesApplied)
  }
  if (!viewAngle.startsWith('side')) {
    fixFrontViewLegsAndMeshImpactInPlace(tracks, roles, fixesApplied)
  }
  fixCrossedLegsInPlace(tracks, roles, viewAngle, fixesApplied)

  return { tracks, fixesApplied }
}


const GENERIC_CLIP_NAME_RE =
  /^(động tác\s*\d*|động tác mới\s*\d*|động tác mặc định|tên động tác|động tác nhập.*|clip\s*\d*|new clip|untitled|motion\s*\d*)$/i

export function isGenericClipName(name?: string | null): boolean {
  if (!name || !name.trim()) return true
  return GENERIC_CLIP_NAME_RE.test(name.trim())
}

export function inferDescriptiveClipName(
  tracks: Record<string, BoneKeyframe[]>,
  bones: ReadonlyArray<LayerBone> = [],
  windSpinesCount = 0,
  fallbackHint?: string
): string {
  if (fallbackHint && fallbackHint.trim() && !isGenericClipName(fallbackHint)) {
    const cleaned = fallbackHint
      .trim()
      .replace(/^(nhân vật|hãy|tạo|thiết kế|động tác|hoạt ảnh)\s+/i, '')
      .trim()
    if (cleaned.length >= 3 && cleaned.length <= 42) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
  }

  const roles = inferHumanoidBoneRoles(bones)
  const pelvis = getTrackRange(tracks[roles.pelvis ?? 'bone-pelvis'])
  const torso = getTrackRange(tracks[roles.torso ?? 'bone-torso'])
  const head = getTrackRange(tracks[roles.head ?? 'bone-head'])
  const armL = getTrackRange(tracks[roles.armL ?? 'bone-arm-l'])
  const armR = getTrackRange(tracks[roles.armR ?? 'bone-arm-r'])
  const thighL = getTrackRange(tracks[roles.thighL ?? 'bone-thigh-l'])
  const thighR = getTrackRange(tracks[roles.thighR ?? 'bone-thigh-r'])
  const windSuffix = windSpinesCount > 0 ? ' + Gió' : ''

  if (pelvis.minY < -14) {
    const armsHigh = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot), Math.abs(armR.maxRot), Math.abs(armR.minRot)) > 35
    return (armsHigh ? 'Nhún nhảy vươn tay (Jump)' : 'Nhún nhảy bật cao (Jump)') + windSuffix
  }
  if (pelvis.maxY > 45) return 'Khuỵu gối tiếp đất (Land)' + windSuffix
  if (torso.minSy < 0.9 || torso.maxRot > 20 || head.maxY > 14) return 'Cúi chào lịch thiệp (Bow)' + windSuffix
  if (
    Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 10 &&
    Math.max(Math.abs(thighR.maxRot), Math.abs(thighR.minRot)) >= 10
  ) {
    const isFast = Math.max(Math.abs(thighL.maxRot), Math.abs(thighL.minRot)) >= 24
    return (isFast ? 'Chạy bước nhanh (Run)' : 'Bước đi tự nhiên (Walk)') + windSuffix
  }
  const armLAmp = Math.max(Math.abs(armL.maxRot), Math.abs(armL.minRot))
  const armRAmp = Math.max(Math.abs(armR.maxRot), Math.abs(armR.minRot))
  if (armRAmp >= 35 && armLAmp < 25) return 'Vẫy tay chào (Wave)' + windSuffix
  if (armLAmp >= 35 && armRAmp < 25) return 'Vẫy tay trái (Wave)' + windSuffix
  if (armLAmp >= 30 && armRAmp >= 30) return 'Vươn hai tay (Cheer)' + windSuffix
  if (pelvis.maxY >= 8) return 'Nhún gối nhịp nhàng' + windSuffix
  if (torso.active || head.active) return 'Đứng thở tự nhiên (Idle)' + windSuffix
  const activeBoneNames = Object.keys(tracks)
    .filter((id) => getTrackRange(tracks[id]).active)
    .map((id) => bones.find((b) => b.id === id)?.name || id)
  if (activeBoneNames.length > 0) return `Cử động ${activeBoneNames.slice(0, 2).join(' & ')}${windSuffix}`
  if (windSpinesCount > 0) return 'Chuyển động Gió đung đưa'
  return 'Động tác tuỳ chỉnh'
}
