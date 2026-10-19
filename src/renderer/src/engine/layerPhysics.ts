import { nanoid } from 'nanoid'
import type {
  Layer,
  LayerPhysicsColliderZone,
  LayerPhysicsConfig,
  LayerPhysicsMaterial,
  LayerPhysicsRole,
  PhysicsImpactPulse,
  Project,
  Vec3
} from '@shared/types'
import { addKeyframe, evaluate } from '../animation/keyframes'
import { evaluateRig, rotatePoint } from './layerRig'
import { layerNominalSize } from './spatial'

export interface MaterialPhysicsPreset {
  id: LayerPhysicsMaterial
  label: string
  badge: string
  description: string
  defaultRole: LayerPhysicsRole
  defaultZone: LayerPhysicsColliderZone
  mass: number
  stiffness: number
  damping: number
  bounciness: number
  gravityScale: number
  frequencyHz: number
  decayRate: number
  squashRatio: number
}

export const MATERIAL_PHYSICS_PRESETS: Record<LayerPhysicsMaterial, MaterialPhysicsPreset> = {
  none: {
    id: 'none',
    label: 'Tắt vật lý (Mặc định)',
    badge: '—',
    description: 'Không áp dụng trọng lực hay phản ứng va chạm chất liệu.',
    defaultRole: 'auto',
    defaultZone: 'full',
    mass: 1.0,
    stiffness: 1.0,
    damping: 0.5,
    bounciness: 0.5,
    gravityScale: 0,
    frequencyHz: 8,
    decayRate: 4,
    squashRatio: 0
  },
  wood_tree: {
    id: 'wood_tree',
    label: '🌳 Thân cây / Gỗ đàn hồi',
    badge: '🌳 Cây / Gỗ',
    description:
      'Gốc bám đất cố định; khi nắm đấm hoặc vật thể va vào thân/cành sẽ nghiêng uốn và rung bật mạnh hay nhẹ tuỳ theo vận tốc đòn đánh.',
    defaultRole: 'prop_target',
    defaultZone: 'trunk_center',
    mass: 4.0,
    stiffness: 1.25,
    damping: 0.28,
    bounciness: 0.85,
    gravityScale: 0,
    frequencyHz: 11.5,
    decayRate: 2.8,
    squashRatio: 0.08
  },
  foliage_bush: {
    id: 'foliage_bush',
    label: '🍃 Tán lá / Bụi cỏ mềm',
    badge: '🍃 Tán lá',
    description:
      'Mềm và nhẹ; khi nhân vật lướt qua hoặc đấm trúng sẽ dạt mạnh theo chiều vận tốc rồi rung rinh tần số cao.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 0.8,
    stiffness: 0.75,
    damping: 0.22,
    bounciness: 1.1,
    gravityScale: 0,
    frequencyHz: 14.5,
    decayRate: 2.3,
    squashRatio: 0.16
  },
  jelly_slime: {
    id: 'jelly_slime',
    label: '🍮 Thạch / Đệm nhún (Jelly)',
    badge: '🍮 Thạch nhún',
    description:
      'Khi nhân vật nhấn tay hoặc nhảy dẫm lên sẽ lún bẹp xuống (nén dọc - phình ngang bảo toàn thể tích) rồi bật nảy tưng tưng như thạch.',
    defaultRole: 'prop_target',
    defaultZone: 'top_surface',
    mass: 1.5,
    stiffness: 0.55,
    damping: 0.15,
    bounciness: 1.55,
    gravityScale: 0,
    frequencyHz: 8.2,
    decayRate: 1.65,
    squashRatio: 0.42
  },
  stone_wall: {
    id: 'stone_wall',
    label: '🧱 Bờ tường / Đá cứng (Điểm tựa nhảy)',
    badge: '🧱 Tường đá',
    description:
      'Độ cứng rất cao; khi tay nhân vật chống vào để nhảy qua (Vault) hoặc đấm mạnh sẽ rung chấn vi mô và tạo điểm tựa phản lực đẩy nhân vật vọt qua.',
    defaultRole: 'prop_target',
    defaultZone: 'top_surface',
    mass: 20.0,
    stiffness: 2.1,
    damping: 0.75,
    bounciness: 0.35,
    gravityScale: 0,
    frequencyHz: 25.0,
    decayRate: 6.2,
    squashRatio: 0.025
  },
  metal_armor: {
    id: 'metal_armor',
    label: '🛡️ Kim loại / Giáp sắt',
    badge: '🛡️ Kim loại',
    description:
      'Khi trúng đòn tạo rung ngân tần số cực cao và giật lùi ngắn (recoil) sắc gọn.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 8.0,
    stiffness: 1.8,
    damping: 0.45,
    bounciness: 0.6,
    gravityScale: 0,
    frequencyHz: 21.0,
    decayRate: 4.2,
    squashRatio: 0.04
  },
  cloth_rope: {
    id: 'cloth_rope',
    label: '🚩 Vải / Dây treo / Cờ',
    badge: '🚩 Vải mềm',
    description:
      'Rủ theo trọng lực và uốn lượn sóng mềm mại khi có xung lực tác động.',
    defaultRole: 'prop_target',
    defaultZone: 'full',
    mass: 0.5,
    stiffness: 0.45,
    damping: 0.2,
    bounciness: 0.95,
    gravityScale: 0.3,
    frequencyHz: 6.0,
    decayRate: 1.8,
    squashRatio: 0.14
  },
  flesh_body: {
    id: 'flesh_body',
    label: '🥊 Nhân vật / Võ sĩ Combat',
    badge: '🥊 Võ sĩ / Nhảy',
    description:
      'Tự động tính vận tốc nắm đấm/bàn tay/bàn chân để gây lực lên cây, tường, thạch; hỗ trợ trọng lực nhảy parabol và chống tay vượt tường.',
    defaultRole: 'both',
    defaultZone: 'fist_hand',
    mass: 2.5,
    stiffness: 1.0,
    damping: 0.38,
    bounciness: 0.75,
    gravityScale: 0,
    frequencyHz: 10.0,
    decayRate: 3.5,
    squashRatio: 0.15
  }
}

export interface ColliderBox25D {
  minX: number
  maxX: number
  minY: number
  maxY: number
  centerX: number
  centerY: number
  z: number
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
}

/**
 * Khởi tạo cấu hình vật lý mặc định chuẩn theo từng loại chất liệu.
 */
export function createDefaultLayerPhysics(
  material: LayerPhysicsMaterial = 'wood_tree'
): LayerPhysicsConfig {
  const preset = MATERIAL_PHYSICS_PRESETS[material] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
  return {
    enabled: material !== 'none',
    material,
    role: preset.defaultRole,
    colliderZone: preset.defaultZone,
    mass: preset.mass,
    gravityScale: preset.gravityScale,
    stiffness: preset.stiffness,
    damping: preset.damping,
    bounciness: preset.bounciness,
    hitSensitivity: 1.0,
    impacts: []
  }
}

function resolveEffectiveRole(cfg: LayerPhysicsConfig): LayerPhysicsRole {
  if (cfg.role && cfg.role !== 'auto') return cfg.role
  return MATERIAL_PHYSICS_PRESETS[cfg.material]?.defaultRole ?? 'prop_target'
}

/**
 * Tính hộp giới hạn va chạm (Collider Box 2.5D) và vận tốc tức thời [vx, vy, vz] (px/s)
 * của một layer (bao gồm cả đầu xương nắm đấm/tay/chân nếu layer có gắn Rig xương).
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

  // Nếu layer có Rig xương (ví dụ nhân vật đấm hoặc vung tay/chân), đo thêm vận tốc và vị trí mấu xương ngoài cùng
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

  if (zone === 'fist_hand') {
    // Vùng cạnh nắm đấm / bàn tay nằm ở nửa hướng di chuyển ngang (hoặc cạnh phải nếu đứng yên)
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
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
    velocity: [vx, vy, vz],
    speed: Math.hypot(vx, vy, vz)
  }
}

function boxesOverlap25D(a: ColliderBox25D, b: ColliderBox25D, margin = 18): boolean {
  if (Math.abs(a.z - b.z) > 480) return false
  return (
    a.maxX + margin >= b.minX &&
    a.minX - margin <= b.maxX &&
    a.maxY + margin >= b.minY &&
    a.minY - margin <= b.maxY
  )
}

/**
 * Thu thập tất cả các xung lực tác động lên `targetLayer` tại thời điểm `t`:
 * Kết hợp cả xung lực đã cấu hình/bake trong `targetLayer.physics.impacts`
 * VÀ tự động phát hiện va chạm trực tiếp từ các layer Striker/Jumper trong cùng cảnh trong khoảng [t - 1.5s, t].
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

  // 2. Tự động dò va chạm giữa các layer Striker / Jumper với Target trong cùng cảnh
  const targetRole = resolveEffectiveRole(cfg)
  if (targetRole === 'prop_target' || targetRole === 'both') {
    const strikers = project.layers.filter((other) => {
      if (other.id === targetLayer.id || !other.visible) return false
      if ((other.shotId ?? null) !== (targetLayer.shotId ?? null)) return false
      const oCfg = other.physics
      if (oCfg?.enabled) {
        const oRole = resolveEffectiveRole(oCfg)
        if (oRole === 'striker' || oRole === 'vault_jumper' || oRole === 'both') return true
      }
      // Hoặc layer nhân vật đang có keyframe di chuyển động tác
      return other.transform.position.keyframes.length >= 2 || Boolean(other.mesh?.skin?.rig)
    })

    if (strikers.length > 0) {
      const sampleStep = 1 / 24
      const tStart = Math.max(0, t - lookback)
      for (const striker of strikers) {
        let wasOverlapping = false
        for (let tau = tStart; tau <= t + 1e-4; tau += sampleStep) {
          const clampedTau = Math.min(t, tau)
          const sBox = computeLayerColliderAtTime(striker, clampedTau, sampleStep)
          const tBox = computeLayerColliderAtTime(targetLayer, clampedTau, sampleStep)
          const isOver = boxesOverlap25D(sBox, tBox, 12)

          if (isOver && !wasOverlapping && sBox.speed >= 65) {
            const uHit = Math.max(
              0.05,
              Math.min(0.95, (sBox.centerX - tBox.minX) / Math.max(1, tBox.width))
            )
            const vHit = Math.max(
              0.05,
              Math.min(0.95, (sBox.centerY - tBox.minY) / Math.max(1, tBox.height))
            )
            const isJellyOrTop =
              cfg.material === 'jelly_slime' ||
              (sBox.velocity[1] < -40 && vHit >= 0.55)
            const isWallVault =
              cfg.material === 'stone_wall' &&
              (striker.physics?.role === 'vault_jumper' || vHit >= 0.6)

            results.push({
              id: `auto-${striker.id}-${Math.round(clampedTau * 20)}`,
              time: clampedTau,
              type: isWallVault ? 'vault' : isJellyOrTop ? 'press' : 'punch',
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
 * Tính toán biến đổi Transform (Position, Rotation, Scale Squash & Stretch, Gravity & Wall Vault)
 * cho `layer` tại thời điểm `t` dựa trên chất liệu vật lý và các va chạm.
 */
export function evaluateLayerPhysicsTransform(
  project: Project,
  layer: Layer,
  t: number,
  nominalSize?: [number, number]
): PhysicsTransformResult {
  const cfg = layer.physics
  if (!cfg || !cfg.enabled || cfg.material === 'none') {
    return {
      positionDelta: [0, 0, 0],
      rotationDelta: [0, 0, 0],
      scaleMultiplier: [1, 1, 1],
      activeImpactCount: 0,
      lastImpactSpeed: 0
    }
  }

  const preset = MATERIAL_PHYSICS_PRESETS[cfg.material] ?? MATERIAL_PHYSICS_PRESETS.wood_tree
  const stiffness = cfg.stiffness ?? preset.stiffness
  const damping = cfg.damping ?? preset.damping
  const bounciness = cfg.bounciness ?? preset.bounciness
  const sensitivity = cfg.hitSensitivity ?? 1.0
  const mass = Math.max(0.1, cfg.mass ?? preset.mass)
  const size = nominalSize ?? layerNominalSize(layer)

  let dx = 0
  let dy = 0
  let dz = 0
  let rotZ = 0
  let rotX = 0
  let sx = 1
  let sy = 1
  let lastSpeed = 0

  const impacts = collectActiveImpactsForLayer(project, layer, t)

  for (const imp of impacts) {
    const elapsed = t - imp.time
    if (elapsed < 0 || elapsed > (imp.duration ?? 1.4)) continue

    const vx = imp.velocity[0]
    const vy = imp.velocity[1]
    const speed = Math.hypot(vx, vy, imp.velocity[2])
    if (speed > lastSpeed) lastSpeed = speed

    // Chuẩn hóa cường độ lực theo vận tốc (nhẹ ~ 150px/s -> 0.25, mạnh ~ 900px/s -> 1.5)
    const normForce =
      Math.min(2.4, (speed / 550) * sensitivity * (2.2 / Math.sqrt(mass))) * bounciness
    const omega = preset.frequencyHz * Math.sqrt(stiffness) * Math.PI * 2
    const decay = Math.exp(-preset.decayRate * (0.45 + damping) * elapsed)
    const dirX = Math.abs(vx) > 10 ? Math.sign(vx) : 1

    if (cfg.material === 'wood_tree' || cfg.material === 'foliage_bush') {
      // 🌳 Cây / Bụi cỏ: Gốc bám đất, thân nghiêng theo hướng đấm rồi đàn hồi lắc lư tắt dần theo vận tốc
      const wave = Math.sin(omega * elapsed)
      const secondaryHighFreq = Math.sin(omega * 2.35 * elapsed) * 0.28
      const bendDeg = normForce * (cfg.material === 'wood_tree' ? 9.5 : 14.0) * decay
      rotZ -= dirX * bendDeg * (wave + secondaryHighFreq)
      dx += dirX * normForce * (cfg.material === 'wood_tree' ? 18 : 28) * decay * wave
      // Tán cây rùng mình nhẹ theo phương dọc khi trúng đòn mạnh
      const squash = normForce * preset.squashRatio * decay * Math.cos(omega * 1.5 * elapsed)
      sx *= 1 + squash * 0.55
      sy *= 1 - squash * 0.45
    } else if (cfg.material === 'jelly_slime') {
      // 🍮 Thạch / Đệm nhún: Lún sâu xuống (Squash) bảo toàn thể tích rồi bật nảy tưng tưng (Jiggle)
      const osc = Math.cos(omega * elapsed)
      const squashAmp = Math.min(0.52, Math.max(0.12, normForce * preset.squashRatio * 1.35)) * decay
      // Giai đoạn đầu (osc > 0): nén lún chiều cao (sy < 1), phình rộng chiều ngang (sx > 1)
      sy *= Math.max(0.42, 1 - squashAmp * osc)
      sx *= Math.min(1.65, 1 + squashAmp * 0.88 * osc)
      // Giữ đáy thạch bám mặt sàn trong lúc lún xuống
      dy -= (1 - sy) * size[1] * 0.42
      rotZ += dirX * squashAmp * 8.5 * Math.sin(omega * elapsed)
    } else if (cfg.material === 'stone_wall' || cfg.material === 'metal_armor') {
      // 🧱 Tường đá / 🛡️ Kim loại: Rung chấn vi mô tần số cao (Micro-shock)
      const shockWave = Math.sin(omega * elapsed)
      const ampPx = normForce * (cfg.material === 'stone_wall' ? 5.5 : 11.0) * decay
      dx += dirX * ampPx * shockWave
      dy += (vy < 0 ? -1 : 1) * ampPx * 0.45 * Math.cos(omega * 1.3 * elapsed)
      rotZ -= dirX * normForce * (cfg.material === 'stone_wall' ? 0.8 : 2.2) * decay * shockWave
    } else if (cfg.material === 'cloth_rope') {
      const wave = Math.sin(omega * elapsed)
      rotZ -= dirX * normForce * 16 * decay * wave
      dx += dirX * normForce * 24 * decay * wave
    } else if (cfg.material === 'flesh_body') {
      if (imp.type === 'vault') {
        // 🤸 Nhân vật chống tay nhảy qua bờ tường (Parkour Wall Vault Parabolic Gravity Arc)
        const vaultDur = Math.max(0.45, imp.duration ?? 0.85)
        const u = Math.max(0, Math.min(1, elapsed / vaultDur))
        // Quỹ đạo parabol trọng lực: vọt cao qua đỉnh tường ở u = 0.48 rồi đáp đất ở u = 1.0
        const parabola = 4 * u * (1 - u)
        const jumpHeight = Math.max(140, Math.abs(vy) * 0.35 + 210) * bounciness
        dy += parabola * jumpHeight
        // Nghiêng người về trước khi chống tay vượt tường rồi cân bằng lại khi đáp
        rotZ -= dirX * Math.sin(u * Math.PI * 2) * 18
        // Nhún nhẹ khi tiếp đất (u > 0.82)
        if (u > 0.82) {
          const landU = (u - 0.82) / 0.18
          const landSquash = Math.sin(landU * Math.PI) * 0.14
          sy *= 1 - landSquash
          sx *= 1 + landSquash * 0.75
        }
      } else {
        // Phản lực giật nhẹ khi tung đòn hoặc nhận đòn (Combat Hit-Stop / Recoil)
        const recoil = Math.sin(omega * elapsed) * decay * normForce
        dx += dirX * 14 * recoil
        rotZ -= dirX * 4.5 * recoil
      }
    }
  }

  // 3. Mô phỏng Trọng lực rơi tự do & Nảy trên mặt đất (nếu bật gravityScale > 0 và có groundY)
  const gravScale = cfg.gravityScale ?? preset.gravityScale
  if (gravScale > 0 && cfg.groundY !== undefined) {
    const basePos = evaluate(layer.transform.position, t)
    const currentY = basePos[1] + dy
    if (currentY > cfg.groundY) {
      const dtFall = Math.max(0, t - layer.inPoint)
      const g = 980 * gravScale
      const fallDrop = 0.5 * g * dtFall * dtFall
      const rawY = currentY - fallDrop
      if (rawY <= cfg.groundY) {
        const impactVel = Math.sqrt(2 * g * Math.max(0, currentY - cfg.groundY))
        const tGround = Math.sqrt((2 * Math.max(0.01, currentY - cfg.groundY)) / g)
        const afterGround = Math.max(0, dtFall - tGround)
        const bounceDecay = Math.exp(-2.8 * (0.4 + damping) * afterGround)
        const bounceH =
          Math.abs(Math.sin(afterGround * 7.5)) *
          impactVel *
          0.18 *
          bounciness *
          bounceDecay
        dy = cfg.groundY - basePos[1] + bounceH
        const groundSquash =
          Math.max(0, Math.cos(afterGround * 15)) * 0.18 * bounciness * bounceDecay
        sy *= 1 - groundSquash
        sx *= 1 + groundSquash * 0.75
      } else {
        dy -= fallDrop
      }
    }
  }

  return {
    positionDelta: [dx, dy, dz],
    rotationDelta: [rotX, 0, rotZ],
    scaleMultiplier: [sx, sy, 1],
    activeImpactCount: impacts.length,
    lastImpactSpeed: Math.round(lastSpeed)
  }
}

/**
 * Biến dạng trực tiếp lưới đỉnh (Vertex Mesh Deformation) theo chất liệu vật lý:
 * - Cây cối (`wood_tree`, `foliage_bush`): Gốc (v=0) giữ chặt, phần thân và ngọn (v > 0.15) uốn cong và rung theo sóng lan truyền từ điểm đấm `contactUV`.
 * - Thạch (`jelly_slime`): Vùng đỉnh quanh điểm chạm `contactUV` lún lõm xuống và phình sườn ngang theo sóng đàn hồi gelatin.
 * - Tường đá (`stone_wall`): Rung chấn cục bộ quanh điểm bàn tay chống vào hoặc điểm va chạm.
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
      // Chuẩn hóa u, v trong [0..1] (v = 0 ở chân đáy, v = 1 ở đỉnh trên)
      const u = Math.max(0, Math.min(1, (x + halfW) / surfaceWidth))
      const v = Math.max(0, Math.min(1, (y + halfH) / surfaceHeight))

      if (cfg.material === 'wood_tree' || cfg.material === 'foliage_bush') {
        // Hệ số uốn tăng lũy tiến từ gốc (v=0 -> 0) lên ngọn (v=1 -> 1) + tập trung mạnh quanh cao độ bị đấm hitV
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
        // Sóng lún thạch quanh điểm nhấn (hitU, hitV): đỉnh lún xuống, hai bên sườn phình ra
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
      } else if (cfg.material === 'stone_wall' || cfg.material === 'metal_armor') {
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
 * - `'jelly_press'`: Nhấn lún đàn hồi (vận tốc nén dọc -680 px/s) -> lún bẹp và nảy tưng tưng như thạch.
 * - `'wall_vault'`: Chống tay vào bờ tường rồi nhảy vọt qua theo quỹ đạo trọng lực Parabol (và tạo chấn động nhẹ lên bờ tường gần nhất).
 */
export function triggerLayerPhysicsInteraction(
  project: Project,
  layerId: string,
  time: number,
  action: 'punch_light' | 'punch_heavy' | 'jelly_press' | 'wall_vault'
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
    // 'wall_vault': Chống tay nhảy qua tường
    layer.physics.role = 'vault_jumper'
    pulse = {
      id: nanoid(8),
      time,
      type: 'vault',
      velocity: [520, 680, 0],
      contactUV: [0.5, 0.9],
      duration: 0.9
    }

    // Nếu trong cùng cảnh có layer bờ tường (`stone_wall`), đồng thời ghi nhận xung lực bàn tay chống lên đỉnh tường
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

    // Tạo chuyển động ngang nhảy qua bờ tường trên keyframe vị trí X của nhân vật nếu cần
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
