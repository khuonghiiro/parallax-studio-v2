import { nanoid } from 'nanoid'
import type {
  Layer,
  LayerPhysicsColliderZone,
  LayerPhysicsMaterial,
  PhysicsImpactPulse,
  Project,
  Vec3
} from '@shared/types'
import { addKeyframe, evaluate } from '../animation/keyframes'
import { evaluateRig, rotatePoint } from './layerRig'
import { layerNominalSize } from './spatial'
import {
  createDefaultLayerPhysics,
  DEFAULT_Z_TOLERANCE,
  MATERIAL_PHYSICS_PRESETS,
  resolveEffectiveRole,
  resolveGroundSurfaceY,
  SUB_MESH_REGION_PRESETS,
  type MaterialPhysicsPreset,
  type SubMeshPresetId
} from './layerPhysicsPresets'
import { evaluateCaveDepthPortalForLayer } from './virtualLight'

export {
  createDefaultLayerPhysics,
  DEFAULT_Z_TOLERANCE,
  MATERIAL_PHYSICS_PRESETS,
  resolveEffectiveRole,
  resolveGroundSurfaceY,
  SUB_MESH_REGION_PRESETS,
  type MaterialPhysicsPreset,
  type SubMeshPresetId
}

export interface ColliderBox25D {
  minX: number
  maxX: number
  minY: number
  maxY: number
  centerX: number
  centerY: number
  z: number
  prevZ: number
  width: number
  height: number
  velocity: Vec3
  speed: number
}

export interface PhysicsTransformResult {
  positionDelta: Vec3
  rotationDelta: Vec3
  scaleMultiplier: Vec3
  /** Gợi ý điểm neo động (ví dụ [0, -0.5, 0] khi cây rung từ gốc hoặc thạch lún trên sàn) */
  dynamicAnchorBias?: Vec3
  activeImpactCount: number
  lastImpactSpeed: number
  /** Đánh dấu mũi tên / vật phóng đã ghim trúng mục tiêu cùng lớp Z */
  projectileStuck?: boolean
  /** Độ tối bóng đêm khi đi vào vùng cửa hang động (0..1, đã trừ phần được nguồn sáng ảo chiếu sáng) */
  caveDarkness?: number
  /** Cường độ nguồn sáng ảo 2.5D chiếu lên layer (0..2) */
  lightIllumination?: number
  /** Màu ánh sáng ảo chiếu lên layer [r, g, b] */
  lightTintRgb?: [number, number, number]
  /** Màu bóng tối hang động [r, g, b] */
  shadowTintRgb?: [number, number, number]
}

/**
 * Tính hộp giới hạn va chạm (Collider Box 2.5D) và vận tốc tức thời [vx, vy, vz] (px/s)
 * của một layer (hỗ trợ vùng 1 phần Mesh `meshRegion`, đầu mũi tên `arrow_tip`, và đầu xương Rig).
 */
export function computeLayerColliderAtTime(
  layer: Layer,
  t: number,
  dt = 1 / 60
): ColliderBox25D {
  const tPrev = Math.max(0, t - dt)
  const actualDt = Math.max(1e-3, t - tPrev)

  const posNow = evaluate(layer.transform.position, t)
  const posPrev = evaluate(layer.transform.position, tPrev)
  const scaleNow = evaluate(layer.transform.scale, t)
  const size = layerNominalSize(layer)

  const fullW = Math.max(16, size[0] * Math.abs(scaleNow[0]))
  const fullH = Math.max(16, size[1] * Math.abs(scaleNow[1]))

  let vx = (posNow[0] - posPrev[0]) / actualDt
  let vy = (posNow[1] - posPrev[1]) / actualDt
  const vz = (posNow[2] - posPrev[2]) / actualDt

  const zone: LayerPhysicsColliderZone =
    layer.physics?.colliderZone ??
    MATERIAL_PHYSICS_PRESETS[layer.physics?.material ?? 'none']?.defaultZone ??
    'full'

  // 1. Nếu layer có Rig xương (ví dụ nhân vật đấm hoặc vung tay/chân), đo vận tốc mấu xương ngoài cùng
  const skin = layer.mesh?.skin
  if (skin?.rig?.bones?.length && (zone === 'fist_hand' || zone === 'foot_bottom')) {
    const poseNow = evaluateRig(skin.rig, t)
    const posePrev = evaluateRig(skin.rig, tPrev)
    const wantFoot = zone === 'foot_bottom'

    let bestBoneTipNow: { x: number; y: number } | null = null
    let bestBoneVel = { vx: 0, vy: 0, speed: -1 }

    for (const b of skin.rig.bones) {
      const nameLower = (b.name || b.id).toLowerCase()
      const isMatch = wantFoot
        ? nameLower.includes('foot') || nameLower.includes('leg') || nameLower.includes('chan')
        : nameLower.includes('hand') ||
          nameLower.includes('fist') ||
          nameLower.includes('arm') ||
          nameLower.includes('tay')

      const trNow = poseNow.get(b.id)
      const trPrev = posePrev.get(b.id)
      if (!trNow || !trPrev) continue

      const tipNowOff = rotatePoint(b.length * (trNow.scaleX ?? 1), 0, trNow.rotation)
      const tipPrevOff = rotatePoint(b.length * (trPrev.scaleX ?? 1), 0, trPrev.rotation)
      const tipNowX = posNow[0] + (trNow.x + tipNowOff.x - (skin.binding.x ?? 0)) * scaleNow[0]
      const tipNowY = posNow[1] - (trNow.y + tipNowOff.y - (skin.binding.y ?? 0)) * scaleNow[1]
      const tipPrevX = posPrev[0] + (trPrev.x + tipPrevOff.x - (skin.binding.x ?? 0)) * scaleNow[0]
      const tipPrevY = posPrev[1] - (trPrev.y + tipPrevOff.y - (skin.binding.y ?? 0)) * scaleNow[1]

      const bvx = (tipNowX - tipPrevX) / actualDt
      const bvy = (tipNowY - tipPrevY) / actualDt
      const bSpeed = Math.hypot(bvx, bvy) * (isMatch ? 1.5 : 1.0)

      if (bSpeed > bestBoneVel.speed) {
        bestBoneVel = { vx: bvx, vy: bvy, speed: bSpeed }
        bestBoneTipNow = { x: tipNowX, y: tipNowY }
      }
    }

    if (bestBoneTipNow && bestBoneVel.speed > Math.hypot(vx, vy)) {
      vx = bestBoneVel.vx
      vy = bestBoneVel.vy
      const subW = Math.max(28, fullW * 0.28)
      const subH = Math.max(28, fullH * 0.28)
      return {
        minX: bestBoneTipNow.x - subW / 2,
        maxX: bestBoneTipNow.x + subW / 2,
        minY: bestBoneTipNow.y - subH / 2,
        maxY: bestBoneTipNow.y + subH / 2,
        centerX: bestBoneTipNow.x,
        centerY: bestBoneTipNow.y,
        z: posNow[2],
        prevZ: posPrev[2],
        width: subW,
        height: subH,
        velocity: [vx, vy, vz],
        speed: Math.hypot(vx, vy, vz)
      }
    }
  }

  let minX = posNow[0] - fullW / 2
  let maxX = posNow[0] + fullW / 2
  let minY = posNow[1] - fullH / 2
  let maxY = posNow[1] + fullH / 2

  // 2. Nếu người dùng khoanh 1 phần Mesh (`meshRegion`) để gắn nhãn (ở Xưởng Lắp Ráp hoặc Inspector)
  const customReg = layer.physics?.meshRegion
  if (customReg && (zone === 'custom_uv' || customReg.minU > 0.01 || customReg.maxU < 0.99 || customReg.minV > 0.01 || customReg.maxV < 0.99)) {
    const u0 = Math.max(0, Math.min(0.95, customReg.minU))
    const u1 = Math.max(u0 + 0.05, Math.min(1, customReg.maxU))
    const v0 = Math.max(0, Math.min(0.95, customReg.minV))
    const v1 = Math.max(v0 + 0.05, Math.min(1, customReg.maxV))
    const baseLeft = posNow[0] - fullW / 2
    const baseBottom = posNow[1] - fullH / 2
    minX = baseLeft + u0 * fullW
    maxX = baseLeft + u1 * fullW
    minY = baseBottom + v0 * fullH
    maxY = baseBottom + v1 * fullH
  } else if (zone === 'fist_hand') {
    const dirSign = Math.abs(vx) > 15 ? Math.sign(vx) : 1
    const handW = fullW * 0.38
    if (dirSign >= 0) {
      minX = posNow[0] + fullW * 0.5 - handW
      maxX = posNow[0] + fullW * 0.5
    } else {
      minX = posNow[0] - fullW * 0.5
      maxX = posNow[0] - fullW * 0.5 + handW
    }
    minY = posNow[1] - fullH * 0.15
    maxY = posNow[1] + fullH * 0.32
  } else if (zone === 'arrow_tip') {
    // Mũi nhọn của tên/đạn theo hướng bay ngang
    const dirSign = Math.abs(vx) > 10 ? Math.sign(vx) : 1
    const tipW = Math.max(16, fullW * 0.25)
    if (dirSign >= 0) {
      minX = posNow[0] + fullW * 0.5 - tipW
      maxX = posNow[0] + fullW * 0.5
    } else {
      minX = posNow[0] - fullW * 0.5
      maxX = posNow[0] - fullW * 0.5 + tipW
    }
    minY = posNow[1] - fullH * 0.22
    maxY = posNow[1] + fullH * 0.22
  } else if (zone === 'foot_bottom') {
    minY = posNow[1] - fullH * 0.5
    maxY = posNow[1] - fullH * 0.18
    minX = posNow[0] - fullW * 0.32
    maxX = posNow[0] + fullW * 0.32
  } else if (zone === 'top_surface') {
    minY = posNow[1] + fullH * 0.12
    maxY = posNow[1] + fullH * 0.5
  } else if (zone === 'trunk_center') {
    minX = posNow[0] - fullW * 0.26
    maxX = posNow[0] + fullW * 0.26
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) * 0.5,
    centerY: (minY + maxY) * 0.5,
    z: posNow[2],
    prevZ: posPrev[2],
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
    velocity: [vx, vy, vz],
    speed: Math.hypot(vx, vy, vz)
  }
}

/**
 * Kiểm tra va chạm 2.5D chuẩn theo lớp chiều sâu Z (`zTolerance`):
 * - Chỉ cho phép tương tác khi 2 vật thể nằm cùng mặt phẳng Z (`|a.z - b.z| <= zTolerance`)
 *   HOẶC khi vật thể A (ví dụ mũi tên bay xuyên lớp Z) vừa bay cắt ngang qua mặt phẳng `b.z` trong bước thời gian hiện tại!
 * - Đồng thời vùng Mesh / Sub-Mesh `X, Y` phải chạm vào nhau.
 */
export function boxesOverlap25D(
  a: ColliderBox25D,
  b: ColliderBox25D,
  margin = 14,
  zTolerance = DEFAULT_Z_TOLERANCE
): boolean {
  const sameZLayer = Math.abs(a.z - b.z) <= zTolerance
  const crossedZPlane =
    (a.prevZ - b.z) * (a.z - b.z) <= 0 &&
    Math.abs(a.z - a.prevZ) <= Math.max(zTolerance * 6, 360)
  if (!sameZLayer && !crossedZPlane) return false

  return (
    a.maxX + margin >= b.minX &&
    a.minX - margin <= b.maxX &&
    a.maxY + margin >= b.minY &&
    a.minY - margin <= b.maxY
  )
}

/**
 * Thu thập tất cả các xung lực tác động lên `targetLayer` tại thời điểm `t`:
 * Kết hợp cả xung lực đã cấu hình trong `targetLayer.physics.impacts`
 * VÀ tự động phát hiện va chạm trực tiếp từ các layer Striker / Projectile / Jumper khi cùng lớp Z.
 */
export function collectActiveImpactsForLayer(
  project: Project,
  targetLayer: Layer,
  t: number
): PhysicsImpactPulse[] {
  const cfg = targetLayer.physics
  if (!cfg || !cfg.enabled || cfg.material === 'none') return []

  const results: PhysicsImpactPulse[] = []
  const lookback = 1.6

  // 1. Các xung lực tường minh (explicit impacts) trên layer
  if (cfg.impacts?.length) {
    for (const imp of cfg.impacts) {
      const dur = imp.duration ?? 1.4
      if (t >= imp.time && t <= imp.time + dur) {
        results.push(imp)
      }
    }
  }

  // 2. Tự động dò va chạm giữa các layer Striker / Projectile (Mũi tên) / Jumper với Target ở cùng lớp Z
  const targetRole = resolveEffectiveRole(cfg)
  if (targetRole === 'prop_target' || targetRole === 'both') {
    const seenCompositeIds = new Set<string>()
    const strikers = project.layers.filter((other) => {
      if (other.id === targetLayer.id || !other.visible) return false
      if ((other.shotId ?? null) !== (targetLayer.shotId ?? null)) return false
      const oCfg = other.physics
      if (!oCfg?.enabled) return false
      const oRole = resolveEffectiveRole(oCfg)
      const isStrikerRole =
        oRole === 'striker' ||
        oRole === 'projectile' ||
        oRole === 'vault_jumper' ||
        oRole === 'both'
      if (!isStrikerRole) return false
      const instId = other.composite?.instanceId
      if (instId) {
        if (other.composite && !other.composite.isRoot) return false
        if (seenCompositeIds.has(instId)) return false
        seenCompositeIds.add(instId)
      }
      return true
    })

    if (strikers.length > 0) {
      const sampleStep = 1 / 24
      const tStart = Math.max(0, t - lookback)
      for (const striker of strikers) {
        const zTol = Math.max(
          10,
          cfg.zTolerance ?? striker.physics?.zTolerance ?? DEFAULT_Z_TOLERANCE
        )
        const sRole = striker.physics ? resolveEffectiveRole(striker.physics) : 'striker'
        let wasOverlapping = false

        for (let tau = tStart; tau <= t + 1e-4; tau += sampleStep) {
          const clampedTau = Math.min(t, tau)
          const sBox = computeLayerColliderAtTime(striker, clampedTau, sampleStep)
          const tBox = computeLayerColliderAtTime(targetLayer, clampedTau, sampleStep)
          const isOver = boxesOverlap25D(sBox, tBox, 12, zTol)

          if (isOver && !wasOverlapping && sBox.speed >= 55) {
            const uHit = Math.max(
              0.05,
              Math.min(0.95, (sBox.centerX - tBox.minX) / Math.max(1, tBox.width))
            )
            const vHit = Math.max(
              0.05,
              Math.min(0.95, (sBox.centerY - tBox.minY) / Math.max(1, tBox.height))
            )
            const isJellyOrTop =
              cfg.material === 'jelly_slime' || (sBox.velocity[1] < -40 && vHit >= 0.55)
            const isWallVault =
              cfg.material === 'stone_wall' &&
              (sRole === 'vault_jumper' || vHit >= 0.6)

            results.push({
              id: `auto-${striker.id}-${Math.round(clampedTau * 20)}`,
              time: clampedTau,
              type:
                sRole === 'projectile'
                  ? 'arrow'
                  : isWallVault
                    ? 'vault'
                    : isJellyOrTop
                      ? 'press'
                      : 'punch',
              velocity: sBox.velocity,
              contactUV: [uHit, vHit],
              sourceLayerId: striker.id,
              duration: 1.35
            })
          }
          wasOverlapping = isOver
        }
      }
    }
  }

  return results
}

/**
 * Tìm thời điểm đầu tiên `tHit` mà một layer Đạn / Mũi tên (`role === 'projectile'`)
 * bay tới đúng lớp Z và chạm vào vùng Mesh của một mục tiêu trong cùng Shot.
 */
function findProjectileFirstHitTime(
  project: Project,
  projectileLayer: Layer,
  t: number
): { hitTime: number; targetLayer: Layer } | null {
  const pCfg = projectileLayer.physics
  if (!pCfg?.enabled || resolveEffectiveRole(pCfg) !== 'projectile') return null
  if (pCfg.stickOnHit === false) return null

  const targets = project.layers.filter((other) => {
    if (other.id === projectileLayer.id || !other.visible) return false
    if ((other.shotId ?? null) !== (projectileLayer.shotId ?? null)) return false
    if (!other.physics?.enabled || other.physics.material === 'none') return false
    const r = resolveEffectiveRole(other.physics)
    return r === 'prop_target' || r === 'both'
  })
  if (targets.length === 0) return null

  const step = 1 / 30
  const startT = Math.max(0, projectileLayer.inPoint)
  for (let tau = startT; tau <= t; tau += step) {
    const pBox = computeLayerColliderAtTime(projectileLayer, tau, step)
    if (pBox.speed < 30) continue
    for (const target of targets) {
      const zTol = Math.max(
        10,
        pCfg.zTolerance ?? target.physics?.zTolerance ?? DEFAULT_Z_TOLERANCE
      )
      const tBox = computeLayerColliderAtTime(target, tau, step)
      if (boxesOverlap25D(pBox, tBox, 10, zTol)) {
        return { hitTime: tau, targetLayer: target }
      }
    }
  }
  return null
}

/**
 * Tính toán biến đổi Transform (Position, Rotation, Scale Squash & Stretch, Gravity, Projectile Stick & Cave Portal)
 * cho `layer` tại thời điểm `t` dựa trên chất liệu vật lý, lớp chiều sâu Z và các va chạm.
 */
export function evaluateLayerPhysicsTransform(
  project: Project,
  layer: Layer,
  t: number,
  nominalSize?: [number, number]
): PhysicsTransformResult {
  const basePos = evaluate(layer.transform.position, t)
  const portal = evaluateCaveDepthPortalForLayer(project, layer, basePos, t)

  const cfg = layer.physics
  if (!cfg || !cfg.enabled || cfg.material === 'none') {
    return {
      positionDelta: [portal.xDelta, portal.yDelta, portal.zDelta],
      rotationDelta: [0, 0, 0],
      scaleMultiplier: [portal.scaleMultiplier, portal.scaleMultiplier, 1],
      activeImpactCount: 0,
      lastImpactSpeed: 0,
      caveDarkness: portal.effectiveDarkness,
      lightIllumination: portal.lightIllumination,
      lightTintRgb: portal.lightTintRgb,
      shadowTintRgb: portal.shadowTintRgb
    }
  }

  const preset = MATERIAL_PHYSICS_PRESETS[cfg.material] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
  const stiffness = cfg.stiffness ?? preset.stiffness
  const damping = cfg.damping ?? preset.damping
  const bounciness = cfg.bounciness ?? preset.bounciness
  const sensitivity = cfg.hitSensitivity ?? 1.0
  const mass = Math.max(0.1, cfg.mass ?? preset.mass)
  const size = nominalSize ?? layerNominalSize(layer)

  let dx = portal.xDelta
  let dy = portal.yDelta
  let dz = portal.zDelta
  let rotZ = 0
  const rotX = 0
  let sx = portal.scaleMultiplier
  let sy = portal.scaleMultiplier
  let lastSpeed = 0

  // 1. Nếu là Mũi tên / Đạn bay (`projectile`) có `stickOnHit`, kiểm tra xem đã ghim trúng mục tiêu cùng lớp Z chưa
  if (resolveEffectiveRole(cfg) === 'projectile' && cfg.stickOnHit !== false) {
    const hit = findProjectileFirstHitTime(project, layer, t)
    if (hit && t >= hit.hitTime) {
      const posAtHit = evaluate(layer.transform.position, hit.hitTime)
      dx += posAtHit[0] - basePos[0]
      dy += posAtHit[1] - basePos[1]
      dz += posAtHit[2] - basePos[2]
      const elapsedHit = t - hit.hitTime
      if (elapsedHit <= 0.9) {
        // Đuôi mũi tên rung bần bật tần số cao khi vừa cắm phập vào thân cây/khiên
        const quiver = Math.sin(elapsedHit * 42) * Math.exp(-5.5 * elapsedHit) * 6.5
        rotZ += quiver
      }
      return {
        positionDelta: [dx, dy, dz],
        rotationDelta: [rotX, 0, rotZ],
        scaleMultiplier: [sx, sy, 1],
        activeImpactCount: 1,
        lastImpactSpeed: 650,
        projectileStuck: true,
        caveDarkness: portal.effectiveDarkness,
        lightIllumination: portal.lightIllumination,
        lightTintRgb: portal.lightTintRgb,
        shadowTintRgb: portal.shadowTintRgb
      }
    }
  }

  // 2. Xử lý các xung lực va chạm lên layer
  const impacts = collectActiveImpactsForLayer(project, layer, t)

  for (const imp of impacts) {
    const elapsed = t - imp.time
    if (elapsed < 0 || elapsed > (imp.duration ?? 1.4)) continue

    const vx = imp.velocity[0]
    const vy = imp.velocity[1]
    const speed = Math.hypot(vx, vy, imp.velocity[2])
    if (speed > lastSpeed) lastSpeed = speed

    const normForce =
      Math.min(2.4, (speed / 550) * sensitivity * (2.2 / Math.sqrt(mass))) * bounciness
    const omega = preset.frequencyHz * Math.sqrt(stiffness) * Math.PI * 2
    const decay = Math.exp(-preset.decayRate * (0.45 + damping) * elapsed)
    const dirX = Math.abs(vx) > 10 ? Math.sign(vx) : 1

    if (cfg.material === 'wood_tree') {
      const wave = Math.sin(omega * elapsed)
      const secondaryHighFreq = Math.sin(omega * 2.5 * elapsed) * 0.22
      const bendDeg = normForce * 4.2 * decay
      rotZ -= dirX * bendDeg * (wave + secondaryHighFreq)
      dx += dirX * normForce * 8.5 * decay * wave
      // Thân gỗ cứng cáp: tuyệt đối không co giãn (squash & stretch) trục X/Y như cao su hay thạch
    } else if (cfg.material === 'foliage_bush') {
      const wave = Math.sin(omega * elapsed)
      const secondaryHighFreq = Math.sin(omega * 2.35 * elapsed) * 0.28
      const bendDeg = normForce * 12.0 * decay
      rotZ -= dirX * bendDeg * (wave + secondaryHighFreq)
      dx += dirX * normForce * 22 * decay * wave
      const squash = normForce * preset.squashRatio * decay * Math.cos(omega * 1.5 * elapsed)
      sx *= 1 + squash * 0.22
      sy *= 1 - squash * 0.18
    } else if (cfg.material === 'jelly_slime') {
      const osc = Math.cos(omega * elapsed)
      const squashAmp = Math.min(0.52, Math.max(0.12, normForce * preset.squashRatio * 1.35)) * decay
      sy *= Math.max(0.42, 1 - squashAmp * osc)
      sx *= Math.min(1.65, 1 + squashAmp * 0.88 * osc)
      dy -= (1 - sy / portal.scaleMultiplier) * size[1] * 0.42
      rotZ += dirX * squashAmp * 8.5 * Math.sin(omega * elapsed)
    } else if (
      cfg.material === 'stone_wall' ||
      cfg.material === 'metal_armor' ||
      cfg.material === 'ground_terrain'
    ) {
      const shockWave = Math.sin(omega * elapsed)
      const ampPx = normForce * (cfg.material === 'metal_armor' ? 11.0 : 5.5) * decay
      dx += dirX * ampPx * shockWave
      dy += (vy < 0 ? -1 : 1) * ampPx * 0.45 * Math.cos(omega * 1.3 * elapsed)
      rotZ -= dirX * normForce * (cfg.material === 'metal_armor' ? 2.2 : 0.8) * decay * shockWave
    } else if (cfg.material === 'cloth_rope') {
      const wave = Math.sin(omega * elapsed)
      rotZ -= dirX * normForce * 16 * decay * wave
      dx += dirX * normForce * 24 * decay * wave
    } else if (cfg.material === 'flesh_body') {
      if (imp.type === 'vault') {
        const vaultDur = Math.max(0.45, imp.duration ?? 0.85)
        const u = Math.max(0, Math.min(1, elapsed / vaultDur))
        const parabola = 4 * u * (1 - u)
        const jumpHeight = Math.max(140, Math.abs(vy) * 0.35 + 210) * bounciness
        dy += parabola * jumpHeight
        rotZ -= dirX * Math.sin(u * Math.PI * 2) * 18
        if (u > 0.82) {
          const landU = (u - 0.82) / 0.18
          const landSquash = Math.sin(landU * Math.PI) * 0.14
          sy *= 1 - landSquash
          sx *= 1 + landSquash * 0.75
        }
      } else {
        const recoil = Math.sin(omega * elapsed) * decay * normForce
        dx += dirX * 14 * recoil
        rotZ -= dirX * 4.5 * recoil
      }
    }
  }

  // 3. Mô phỏng Trọng lực rơi tự do & Nảy trên mặt đất (hỗ trợ cả groundY lẫn layer gắn nhãn `ground_surface` cùng lớp Z)
  const gravScale = cfg.gravityScale ?? preset.gravityScale
  if (gravScale > 0) {
    const effectiveGroundY = resolveGroundSurfaceY(
      project,
      layer,
      basePos[0] + dx,
      basePos[2] + dz,
      t
    )
    if (effectiveGroundY !== undefined) {
      const currentScale = evaluate(layer.transform.scale, t)
      const halfH = size[1] * Math.abs(currentScale[1]) * 0.5
      // Nếu tiếp đất lên một layer `ground_surface`, đáy của vật thể (centerY - halfH) nằm trên bề mặt đất
      const restCenterY =
        cfg.groundY !== undefined && effectiveGroundY === cfg.groundY
          ? effectiveGroundY
          : effectiveGroundY + halfH
      const currentY = basePos[1] + dy
      if (currentY > restCenterY) {
        const dtFall = Math.max(0, t - layer.inPoint)
        const g = 980 * gravScale
        const fallDrop = 0.5 * g * dtFall * dtFall
        const rawY = currentY - fallDrop
        if (rawY <= restCenterY) {
          const dropDist = Math.max(0, currentY - restCenterY)
          const impactVel = Math.sqrt(2 * g * dropDist)
          const tGround = Math.sqrt((2 * Math.max(0.01, dropDist)) / g)
          const afterGround = Math.max(0, dtFall - tGround)
          const bounceDecay =
            afterGround > 0.95 ? 0 : Math.exp(-5.2 * (0.45 + damping) * afterGround)
          const bounceH =
            Math.abs(Math.sin(afterGround * 7.5)) *
            impactVel *
            0.16 *
            bounciness *
            bounceDecay
          dy = restCenterY - basePos[1] + bounceH
          const groundSquash =
            Math.max(0, Math.cos(afterGround * 15)) * 0.18 * bounciness * bounceDecay
          sy *= 1 - groundSquash
          sx *= 1 + groundSquash * 0.75
        } else {
          dy -= fallDrop
        }
      }
    }
  }

  return {
    positionDelta: [dx, dy, dz],
    rotationDelta: [rotX, 0, rotZ],
    scaleMultiplier: [sx, sy, 1],
    activeImpactCount: impacts.length,
    lastImpactSpeed: Math.round(lastSpeed),
    caveDarkness: portal.effectiveDarkness,
    lightIllumination: portal.lightIllumination,
    lightTintRgb: portal.lightTintRgb,
    shadowTintRgb: portal.shadowTintRgb
  }
}

/**
 * Biến dạng trực tiếp lưới đỉnh (Vertex Mesh Deformation) theo chất liệu vật lý và vùng chạm `contactUV`.
 */
export function deformVerticesByPhysics(
  positions: Float32Array,
  surfaceWidth: number,
  surfaceHeight: number,
  layer: Layer,
  project: Project,
  t: number
): void {
  const cfg = layer.physics
  if (!cfg || !cfg.enabled || cfg.material === 'none') return

  const impacts = collectActiveImpactsForLayer(project, layer, t)
  if (impacts.length === 0) return

  const preset = MATERIAL_PHYSICS_PRESETS[cfg.material] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
  const stiffness = cfg.stiffness ?? preset.stiffness
  const damping = cfg.damping ?? preset.damping
  const bounciness = cfg.bounciness ?? preset.bounciness
  const sensitivity = cfg.hitSensitivity ?? 1.0
  const halfW = Math.max(1, surfaceWidth * 0.5)
  const halfH = Math.max(1, surfaceHeight * 0.5)

  const vCount = positions.length / 3

  for (const imp of impacts) {
    const elapsed = t - imp.time
    if (elapsed < 0 || elapsed > (imp.duration ?? 1.4)) continue

    const vx = imp.velocity[0]
    const vy = imp.velocity[1]
    const speed = Math.hypot(vx, vy, imp.velocity[2])
    const normForce = Math.min(2.5, (speed / 500) * sensitivity) * bounciness
    const omega = preset.frequencyHz * Math.sqrt(stiffness) * Math.PI * 2
    const decay = Math.exp(-preset.decayRate * (0.45 + damping) * elapsed)
    if (decay < 0.005) continue

    const dirX = Math.abs(vx) > 10 ? Math.sign(vx) : 1
    const hitU = imp.contactUV?.[0] ?? 0.5
    const hitV = imp.contactUV?.[1] ?? 0.5

    for (let i = 0; i < vCount; i++) {
      const i3 = i * 3
      const x = positions[i3]
      const y = positions[i3 + 1]
      const u = Math.max(0, Math.min(1, (x + halfW) / surfaceWidth))
      const v = Math.max(0, Math.min(1, (y + halfH) / surfaceHeight))

      if (cfg.material === 'wood_tree' || cfg.material === 'foliage_bush') {
        const rootPin = Math.pow(v, 1.45)
        const distV = Math.abs(v - hitV)
        const localHitBoost = Math.exp(-distV * distV * 6.0) * 0.65
        const phaseLag = (v - hitV) * 3.2
        const wave = Math.sin(omega * elapsed - phaseLag)
        const rustle = Math.sin(omega * 2.6 * elapsed + u * 8.0 + v * 6.0) * 0.25

        const dispX =
          dirX *
          surfaceWidth *
          0.085 *
          normForce *
          decay *
          rootPin *
          (1 + localHitBoost) *
          (wave + rustle)
        positions[i3] += dispX
        positions[i3 + 1] -= Math.abs(dispX) * 0.14 * v
      } else if (cfg.material === 'jelly_slime') {
        const du = u - hitU
        const dv = v - hitV
        const radialDist = Math.hypot(du, dv * 0.7)
        const indentGaussian = Math.exp(-radialDist * radialDist * 5.5)
        const ripple = Math.cos(omega * elapsed - radialDist * 5.0) * decay
        const indentY = surfaceHeight * 0.22 * normForce * indentGaussian * v * ripple
        const bulgeX =
          (u - 0.5) * surfaceWidth * 0.26 * normForce * Math.sin(v * Math.PI) * ripple

        positions[i3] += bulgeX
        positions[i3 + 1] -= indentY
      } else if (
        cfg.material === 'stone_wall' ||
        cfg.material === 'metal_armor' ||
        cfg.material === 'ground_terrain'
      ) {
        const dist = Math.hypot(u - hitU, v - hitV)
        const localShock = Math.exp(-dist * dist * 10.0) * decay
        const tremor = Math.sin(omega * elapsed - dist * 8.0)
        positions[i3] += dirX * surfaceWidth * 0.018 * normForce * localShock * tremor
        positions[i3 + 1] -= surfaceHeight * 0.014 * normForce * localShock * tremor
      }
    }
  }
}

/**
 * Kích hoạt nhanh kịch bản tương tác Vật lý / Combat tại thời điểm `time` trên `layer`:
 * - `'punch_light'`: Đấm nhẹ (vận tốc 260 px/s) -> cây/vật thể rung nhẹ.
 * - `'punch_heavy'`: Đấm cực mạnh (vận tốc 980 px/s) -> thân cây uốn cong & rung bần bật.
 * - `'jelly_press'`: Nhấn lún đàn hồi (vận tốc nén dọc -720 px/s) -> lún bẹp và nảy tưng tưng như thạch.
 * - `'wall_vault'`: Chống tay vào bờ tường rồi nhảy vọt qua theo quỹ đạo trọng lực Parabol.
 * - `'arrow_shot'`: Mũi tên bay xuyên từ lớp Z khác tới đúng Z-index của layer và cắm phập vào mesh.
 */
export function triggerLayerPhysicsInteraction(
  project: Project,
  layerId: string,
  time: number,
  action: 'punch_light' | 'punch_heavy' | 'jelly_press' | 'wall_vault' | 'arrow_shot'
): PhysicsImpactPulse | null {
  const layer = project.layers.find((l) => l.id === layerId)
  if (!layer) return null

  if (!layer.physics) {
    const defaultMat: LayerPhysicsMaterial =
      action === 'jelly_press'
        ? 'jelly_slime'
        : action === 'wall_vault'
          ? 'flesh_body'
          : 'wood_tree'
    layer.physics = createDefaultLayerPhysics(defaultMat)
  }
  layer.physics.enabled = true
  if (layer.physics.material === 'none') {
    layer.physics.material =
      action === 'jelly_press'
        ? 'jelly_slime'
        : action === 'wall_vault'
          ? 'flesh_body'
          : 'wood_tree'
  }
  layer.physics.impacts ??= []

  let pulse: PhysicsImpactPulse
  if (action === 'punch_light') {
    pulse = {
      id: nanoid(8),
      time,
      type: 'punch',
      velocity: [260, 25, 0],
      contactUV: [0.35, 0.52],
      duration: 1.25
    }
  } else if (action === 'punch_heavy') {
    pulse = {
      id: nanoid(8),
      time,
      type: 'punch',
      velocity: [980, 90, 0],
      contactUV: [0.45, 0.58],
      duration: 1.55
    }
  } else if (action === 'arrow_shot') {
    pulse = {
      id: nanoid(8),
      time,
      type: 'arrow',
      velocity: [680, -45, 580],
      contactUV: [0.5, 0.62],
      duration: 1.45
    }
  } else if (action === 'jelly_press') {
    if (layer.physics.material !== 'jelly_slime') {
      layer.physics.material = 'jelly_slime'
    }
    pulse = {
      id: nanoid(8),
      time,
      type: 'press',
      velocity: [40, -720, 0],
      contactUV: [0.5, 0.88],
      duration: 1.65
    }
  } else {
    layer.physics.role = 'vault_jumper'
    pulse = {
      id: nanoid(8),
      time,
      type: 'vault',
      velocity: [520, 680, 0],
      contactUV: [0.5, 0.9],
      duration: 0.9
    }

    const wallLayer = project.layers.find(
      (other) =>
        other.id !== layer.id &&
        (other.shotId ?? null) === (layer.shotId ?? null) &&
        other.physics?.enabled &&
        other.physics.material === 'stone_wall'
    )
    if (wallLayer && wallLayer.physics) {
      wallLayer.physics.impacts ??= []
      wallLayer.physics.impacts.push({
        id: nanoid(8),
        time: Math.round((time + 0.18) * 100) / 100,
        type: 'vault',
        velocity: [420, -480, 0],
        contactUV: [0.5, 0.92],
        sourceLayerId: layer.id,
        duration: 0.85
      })
    }

    const curPos = evaluate(layer.transform.position, time)
    const targetX = wallLayer
      ? evaluate(wallLayer.transform.position, time)[0] + 220
      : curPos[0] + 280
    addKeyframe(layer.transform.position, time, [...curPos] as Vec3, 'easeOut')
    addKeyframe(
      layer.transform.position,
      Math.round((time + 0.85) * 100) / 100,
      [targetX, curPos[1], curPos[2]],
      'easeInOut'
    )
  }

  layer.physics.impacts.push(pulse)
  return pulse
}
