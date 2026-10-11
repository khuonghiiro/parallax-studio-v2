import type { BoneKeyframe, LayerBone } from '@shared/layerRig'

function smoothKey(
  time: number,
  rotation: number,
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1
): BoneKeyframe {
  return {
    time: Number(time.toFixed(3)),
    rotation: Number(rotation.toFixed(2)),
    x,
    y,
    scaleX,
    scaleY,
    easing: 'smooth'
  }
}

// ---------------------------------------------------------------------------
// 1. Quadruped Armature (Chó, Mèo, Trâu, Bò)
// ---------------------------------------------------------------------------

export function createQuadrupedBones(): LayerBone[] {
  return [
    { id: 'bone-pelvis', name: 'Hông sau (Root)', x: 40, y: 10, length: 45, angle: 180 },
    { id: 'bone-torso', name: 'Ngực / Thân trước', parentId: 'bone-pelvis', x: -40, y: 0, length: 70, angle: 180 },
    { id: 'bone-neck', name: 'Cổ', parentId: 'bone-torso', x: -45, y: -25, length: 40, angle: -125 },
    { id: 'bone-head', name: 'Đầu & Mõm', parentId: 'bone-neck', x: -25, y: -30, length: 50, angle: -160 },
    { id: 'bone-tail', name: 'Đuôi gốc', parentId: 'bone-pelvis', x: 45, y: -15, length: 45, angle: 45 },
    { id: 'bone-tail-tip', name: 'Đuôi ngọn', parentId: 'bone-tail', x: 30, y: 25, length: 40, angle: 65 },
    // Chân trước trái (Front Left)
    { id: 'bone-leg-fl-thigh', name: 'Đùi trước trái', parentId: 'bone-torso', x: -35, y: 20, length: 50, angle: 95 },
    { id: 'bone-leg-fl-shin', name: 'Cẳng chân trước trái', parentId: 'bone-leg-fl-thigh', x: 0, y: 50, length: 50, angle: 90 },
    // Chân trước phải (Front Right)
    { id: 'bone-leg-fr-thigh', name: 'Đùi trước phải', parentId: 'bone-torso', x: -20, y: 20, length: 50, angle: 85 },
    { id: 'bone-leg-fr-shin', name: 'Cẳng chân trước phải', parentId: 'bone-leg-fr-thigh', x: 0, y: 50, length: 50, angle: 90 },
    // Chân sau trái (Back Left)
    { id: 'bone-leg-bl-thigh', name: 'Đùi sau trái', parentId: 'bone-pelvis', x: 35, y: 20, length: 55, angle: 75 },
    { id: 'bone-leg-bl-shin', name: 'Cẳng chân sau trái', parentId: 'bone-leg-bl-thigh', x: 0, y: 55, length: 50, angle: 105 },
    // Chân sau phải (Back Right)
    { id: 'bone-leg-br-thigh', name: 'Đùi sau phải', parentId: 'bone-pelvis', x: 45, y: 20, length: 55, angle: 70 },
    { id: 'bone-leg-br-shin', name: 'Cẳng chân sau phải', parentId: 'bone-leg-br-thigh', x: 0, y: 55, length: 50, angle: 105 }
  ]
}

export function generateQuadrupedWalk(bones: LayerBone[], duration = 1.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  // Pelvis bobbing & subtle sway
  tracks['bone-pelvis'] = [
    smoothKey(0, 0, 0, 0),
    smoothKey(d * 0.25, -2, 0, -4),
    smoothKey(d * 0.5, 0, 0, 0),
    smoothKey(d * 0.75, 2, 0, -4),
    smoothKey(d, 0, 0, 0)
  ]

  // Torso counter-bob
  tracks['bone-torso'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, 2),
    smoothKey(d * 0.5, 0),
    smoothKey(d * 0.75, -2),
    smoothKey(d, 0)
  ]

  // Head nodding
  tracks['bone-head'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, -5),
    smoothKey(d * 0.5, 2),
    smoothKey(d * 0.75, -5),
    smoothKey(d, 0)
  ]

  // Tail gentle sway
  tracks['bone-tail'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, 12),
    smoothKey(d * 0.5, 0),
    smoothKey(d * 0.75, -12),
    smoothKey(d, 0)
  ]

  // Diagonal gait pairs: (FL + BR) vs (FR + BL)
  tracks['bone-leg-fl-thigh'] = [
    smoothKey(0, -18),
    smoothKey(d * 0.25, 22),
    smoothKey(d * 0.5, 15),
    smoothKey(d * 0.75, -25),
    smoothKey(d, -18)
  ]
  tracks['bone-leg-fl-shin'] = [
    smoothKey(0, 10),
    smoothKey(d * 0.25, -20),
    smoothKey(d * 0.5, 5),
    smoothKey(d * 0.75, 25),
    smoothKey(d, 10)
  ]

  tracks['bone-leg-br-thigh'] = [
    smoothKey(0, -16),
    smoothKey(d * 0.25, 20),
    smoothKey(d * 0.5, 12),
    smoothKey(d * 0.75, -22),
    smoothKey(d, -16)
  ]
  tracks['bone-leg-br-shin'] = [
    smoothKey(0, 8),
    smoothKey(d * 0.25, -18),
    smoothKey(d * 0.5, 4),
    smoothKey(d * 0.75, 22),
    smoothKey(d, 8)
  ]

  tracks['bone-leg-fr-thigh'] = [
    smoothKey(0, 15),
    smoothKey(d * 0.25, -25),
    smoothKey(d * 0.5, -18),
    smoothKey(d * 0.75, 22),
    smoothKey(d, 15)
  ]
  tracks['bone-leg-fr-shin'] = [
    smoothKey(0, 5),
    smoothKey(d * 0.25, 25),
    smoothKey(d * 0.5, 10),
    smoothKey(d * 0.75, -20),
    smoothKey(d, 5)
  ]

  tracks['bone-leg-bl-thigh'] = [
    smoothKey(0, 12),
    smoothKey(d * 0.25, -22),
    smoothKey(d * 0.5, -16),
    smoothKey(d * 0.75, 20),
    smoothKey(d, 12)
  ]
  tracks['bone-leg-bl-shin'] = [
    smoothKey(0, 4),
    smoothKey(d * 0.25, 22),
    smoothKey(d * 0.5, 8),
    smoothKey(d * 0.75, -18),
    smoothKey(d, 4)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

export function generateQuadrupedWagTail(bones: LayerBone[], duration = 1.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  tracks['bone-tail'] = [
    smoothKey(0, -28),
    smoothKey(d * 0.25, 28),
    smoothKey(d * 0.5, -28),
    smoothKey(d * 0.75, 28),
    smoothKey(d, -28)
  ]
  tracks['bone-tail-tip'] = [
    smoothKey(0, -20),
    smoothKey(d * 0.25, 30),
    smoothKey(d * 0.5, -20),
    smoothKey(d * 0.75, 30),
    smoothKey(d, -20)
  ]
  tracks['bone-pelvis'] = [
    smoothKey(0, -4),
    smoothKey(d * 0.5, 4),
    smoothKey(d, -4)
  ]
  tracks['bone-head'] = [
    smoothKey(0, 3),
    smoothKey(d * 0.5, -3),
    smoothKey(d, 3)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

export function generateQuadrupedGraze(bones: LayerBone[], duration = 2.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  tracks['bone-neck'] = [
    smoothKey(0, 15),
    smoothKey(d * 0.5, 24),
    smoothKey(d, 15)
  ]
  tracks['bone-head'] = [
    smoothKey(0, 20),
    smoothKey(d * 0.4, 30),
    smoothKey(d * 0.7, 18),
    smoothKey(d, 20)
  ]
  tracks['bone-tail'] = [
    smoothKey(0, -10),
    smoothKey(d * 0.25, 15),
    smoothKey(d * 0.5, -12),
    smoothKey(d * 0.75, 18),
    smoothKey(d, -10)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

// ---------------------------------------------------------------------------
// 2. Aquatic Armature (Cá chép, Cá Koi, Thủy sinh)
// ---------------------------------------------------------------------------

export function createFishBones(): LayerBone[] {
  return [
    { id: 'bone-fish-head', name: 'Đầu & Mang (Root)', x: -80, y: 0, length: 60, angle: 0 },
    { id: 'bone-fish-mid', name: 'Thân giữa & Lưng', parentId: 'bone-fish-head', x: 50, y: 0, length: 60, angle: 0 },
    { id: 'bone-fish-tail-base', name: 'Cuống đuôi', parentId: 'bone-fish-mid', x: 55, y: 0, length: 50, angle: 0 },
    { id: 'bone-fish-fin-tail', name: 'Đuôi lụa xòe', parentId: 'bone-fish-tail-base', x: 45, y: 0, length: 60, angle: 0 },
    { id: 'bone-fish-fin-dorsal', name: 'Vây lưng trên', parentId: 'bone-fish-mid', x: 0, y: -35, length: 35, angle: -90 },
    { id: 'bone-fish-fin-pectoral-l', name: 'Vây bơi trái', parentId: 'bone-fish-head', x: 10, y: 25, length: 40, angle: 45 },
    { id: 'bone-fish-fin-pectoral-r', name: 'Vây bơi phải', parentId: 'bone-fish-head', x: 10, y: -25, length: 40, angle: -45 }
  ]
}

export function generateFishSwim(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  // Sinusoidal wave propagation through head -> mid -> tail-base -> tail fin
  tracks['bone-fish-head'] = [
    smoothKey(0, -6, 0, -3),
    smoothKey(d * 0.5, 6, 0, 3),
    smoothKey(d, -6, 0, -3)
  ]
  tracks['bone-fish-mid'] = [
    smoothKey(0, 10),
    smoothKey(d * 0.5, -10),
    smoothKey(d, 10)
  ]
  tracks['bone-fish-tail-base'] = [
    smoothKey(0, -22),
    smoothKey(d * 0.5, 22),
    smoothKey(d, -22)
  ]
  tracks['bone-fish-fin-tail'] = [
    smoothKey(0, 32),
    smoothKey(d * 0.5, -32),
    smoothKey(d, 32)
  ]
  tracks['bone-fish-fin-pectoral-l'] = [
    smoothKey(0, 15),
    smoothKey(d * 0.5, -12),
    smoothKey(d, 15)
  ]
  tracks['bone-fish-fin-pectoral-r'] = [
    smoothKey(0, -15),
    smoothKey(d * 0.5, 12),
    smoothKey(d, -15)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

export function generateFishFloat(bones: LayerBone[], duration = 2.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  tracks['bone-fish-head'] = [
    smoothKey(0, -2, 0, -6),
    smoothKey(d * 0.5, 2, 0, 6),
    smoothKey(d, -2, 0, -6)
  ]
  tracks['bone-fish-fin-tail'] = [
    smoothKey(0, 10),
    smoothKey(d * 0.5, -10),
    smoothKey(d, 10)
  ]
  tracks['bone-fish-fin-pectoral-l'] = [
    smoothKey(0, 8),
    smoothKey(d * 0.5, -8),
    smoothKey(d, 8)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

// ---------------------------------------------------------------------------
// 3. Avian Armature (Gà, Chim, Vịt)
// ---------------------------------------------------------------------------

export function createBirdBones(): LayerBone[] {
  return [
    { id: 'bone-bird-body', name: 'Thân & Ức (Root)', x: 0, y: 15, length: 60, angle: -90 },
    { id: 'bone-bird-neck', name: 'Cổ gà', parentId: 'bone-bird-body', x: -20, y: -45, length: 35, angle: -125 },
    { id: 'bone-bird-head', name: 'Đầu mào & Mỏ', parentId: 'bone-bird-neck', x: -15, y: -25, length: 35, angle: -150 },
    { id: 'bone-bird-wing-l', name: 'Cánh trái', parentId: 'bone-bird-body', x: -10, y: -20, length: 55, angle: 105 },
    { id: 'bone-bird-wing-r', name: 'Cánh phải', parentId: 'bone-bird-body', x: 10, y: -20, length: 55, angle: 75 },
    { id: 'bone-bird-tail', name: 'Chùm lông đuôi', parentId: 'bone-bird-body', x: 35, y: -25, length: 55, angle: 30 },
    { id: 'bone-bird-thigh-l', name: 'Đùi trái', parentId: 'bone-bird-body', x: -15, y: 25, length: 40, angle: 90 },
    { id: 'bone-bird-shin-l', name: 'Cẳng chân & Móng trái', parentId: 'bone-bird-thigh-l', x: 0, y: 40, length: 45, angle: 90 },
    { id: 'bone-bird-thigh-r', name: 'Đùi phải', parentId: 'bone-bird-body', x: 15, y: 25, length: 40, angle: 90 },
    { id: 'bone-bird-shin-r', name: 'Cẳng chân & Móng phải', parentId: 'bone-bird-thigh-r', x: 0, y: 40, length: 45, angle: 90 }
  ]
}

export function generateBirdPeckWalk(bones: LayerBone[], duration = 1.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  tracks['bone-bird-body'] = [
    smoothKey(0, 0, 0, 0),
    smoothKey(d * 0.25, 4, 0, -4),
    smoothKey(d * 0.5, 0, 0, 0),
    smoothKey(d * 0.75, -4, 0, -4),
    smoothKey(d, 0, 0, 0)
  ]

  // Head dipping down to peck at footfall
  tracks['bone-bird-neck'] = [
    smoothKey(0, -10),
    smoothKey(d * 0.25, 20),
    smoothKey(d * 0.5, -8),
    smoothKey(d * 0.75, 18),
    smoothKey(d, -10)
  ]
  tracks['bone-bird-head'] = [
    smoothKey(0, -5),
    smoothKey(d * 0.25, 25),
    smoothKey(d * 0.5, -4),
    smoothKey(d * 0.75, 22),
    smoothKey(d, -5)
  ]

  // Wings slight flap on walk
  tracks['bone-bird-wing-l'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, -12),
    smoothKey(d * 0.5, 0),
    smoothKey(d * 0.75, -12),
    smoothKey(d, 0)
  ]

  // Tail bob
  tracks['bone-bird-tail'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, -15),
    smoothKey(d * 0.5, 5),
    smoothKey(d * 0.75, -15),
    smoothKey(d, 0)
  ]

  // Alternating step
  tracks['bone-bird-thigh-l'] = [
    smoothKey(0, -20),
    smoothKey(d * 0.25, 22),
    smoothKey(d * 0.5, 10),
    smoothKey(d * 0.75, -25),
    smoothKey(d, -20)
  ]
  tracks['bone-bird-thigh-r'] = [
    smoothKey(0, 10),
    smoothKey(d * 0.25, -25),
    smoothKey(d * 0.5, -20),
    smoothKey(d * 0.75, 22),
    smoothKey(d, 10)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

export function generateBirdWingFlap(bones: LayerBone[], duration = 0.8): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  tracks['bone-bird-wing-l'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, -55),
    smoothKey(d * 0.5, 15),
    smoothKey(d * 0.75, -50),
    smoothKey(d, 0)
  ]
  tracks['bone-bird-wing-r'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.25, 55),
    smoothKey(d * 0.5, -15),
    smoothKey(d * 0.75, 50),
    smoothKey(d, 0)
  ]
  tracks['bone-bird-body'] = [
    smoothKey(0, 0, 0, 0),
    smoothKey(d * 0.25, 0, 0, -8),
    smoothKey(d * 0.5, 0, 0, 4),
    smoothKey(d, 0, 0, 0)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

// ---------------------------------------------------------------------------
// 4. Humanoid Age-Specific Armatures & Motions
// ---------------------------------------------------------------------------

/** Proportions for toddler/child (shorter limbs, bigger head ratio). */
export function createChildBones(): LayerBone[] {
  return [
    { id: 'bone-pelvis', name: 'Hông nhỏ (Root)', x: 0, y: 35, length: 35, angle: -90 },
    { id: 'bone-torso', name: 'Thân áo trẻ em', parentId: 'bone-pelvis', x: 0, y: -10, length: 45, angle: -90 },
    { id: 'bone-head', name: 'Đầu to tròn Chibi', parentId: 'bone-torso', x: 0, y: -65, length: 70, angle: -90 },
    { id: 'bone-arm-l', name: 'Tay trái bụ bẫm', parentId: 'bone-torso', x: -28, y: -45, length: 40, angle: 95 },
    { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -30, y: -5, length: 35, angle: 90 },
    { id: 'bone-arm-r', name: 'Tay phải bụ bẫm', parentId: 'bone-torso', x: 28, y: -45, length: 40, angle: 85 },
    { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 30, y: -5, length: 35, angle: 90 },
    { id: 'bone-thigh-l', name: 'Chân trái ngắn', parentId: 'bone-pelvis', x: -18, y: 30, length: 45, angle: 90 },
    { id: 'bone-shin-l', name: 'Giày trẻ em trái', parentId: 'bone-thigh-l', x: -18, y: 75, length: 40, angle: 90 },
    { id: 'bone-thigh-r', name: 'Chân phải ngắn', parentId: 'bone-pelvis', x: 18, y: 30, length: 45, angle: 90 },
    { id: 'bone-shin-r', name: 'Giày trẻ em phải', parentId: 'bone-thigh-r', x: 18, y: 75, length: 40, angle: 90 }
  ]
}

export function generateChildToddle(bones: LayerBone[], duration = 1.1): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  // Quick energetic waddle
  tracks['bone-pelvis'] = [
    smoothKey(0, -6, 0, 0),
    smoothKey(d * 0.25, 6, 0, -5),
    smoothKey(d * 0.5, -6, 0, 0),
    smoothKey(d * 0.75, 6, 0, -5),
    smoothKey(d, -6, 0, 0)
  ]
  tracks['bone-torso'] = [
    smoothKey(0, 4),
    smoothKey(d * 0.5, -4),
    smoothKey(d, 4)
  ]
  tracks['bone-head'] = [
    smoothKey(0, -5),
    smoothKey(d * 0.25, 4),
    smoothKey(d * 0.5, -5),
    smoothKey(d * 0.75, 4),
    smoothKey(d, -5)
  ]
  tracks['bone-arm-l'] = [
    smoothKey(0, -25),
    smoothKey(d * 0.5, 30),
    smoothKey(d, -25)
  ]
  tracks['bone-arm-r'] = [
    smoothKey(0, 30),
    smoothKey(d * 0.5, -25),
    smoothKey(d, 30)
  ]
  tracks['bone-thigh-l'] = [
    smoothKey(0, 25),
    smoothKey(d * 0.5, -28),
    smoothKey(d, 25)
  ]
  tracks['bone-thigh-r'] = [
    smoothKey(0, -28),
    smoothKey(d * 0.5, 25),
    smoothKey(d, -28)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}

/** Elderly armature with stooped back, walking cane arm, hands and feet. */
export function createElderlyBones(): LayerBone[] {
  return [
    { id: 'bone-pelvis', name: 'Hông khom (Root)', x: 0, y: 35, length: 45, angle: -85 },
    { id: 'bone-torso', name: 'Lưng còng / Ngực', parentId: 'bone-pelvis', x: -8, y: -15, length: 60, angle: -80 },
    { id: 'bone-head', name: 'Đầu tóc bạc râu dài', parentId: 'bone-torso', x: -16, y: -75, length: 55, angle: -85 },
    { id: 'bone-arm-l', name: 'Tay trái buông', parentId: 'bone-torso', x: -38, y: -65, length: 50, angle: 95 },
    { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -40, y: -15, length: 45, angle: 90 },
    { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: -42, y: 30, length: 25, angle: 90 },
    { id: 'bone-arm-r', name: 'Tay phải chống gậy', parentId: 'bone-torso', x: 30, y: -65, length: 50, angle: 75 },
    { id: 'bone-forearm-r', name: 'Cẳng tay giữ gậy ba toong', parentId: 'bone-arm-r', x: 38, y: -18, length: 55, angle: 70 },
    { id: 'bone-hand-r', name: 'Bàn tay phải cầm gậy', parentId: 'bone-forearm-r', x: 44, y: 35, length: 25, angle: 70 },
    { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -22, y: 40, length: 65, angle: 90 },
    { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -22, y: 105, length: 65, angle: 90 },
    { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -22, y: 170, length: 30, angle: 0 },
    { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 22, y: 40, length: 65, angle: 90 },
    { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 22, y: 105, length: 65, angle: 90 },
    { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 22, y: 170, length: 30, angle: 0 }
  ]
}

export function generateElderlyCaneWalk(bones: LayerBone[], duration = 2.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  // Slow, measured cane-assisted pacing
  tracks['bone-pelvis'] = [
    smoothKey(0, 0, 0, 0),
    smoothKey(d * 0.25, 2, 0, -2),
    smoothKey(d * 0.5, 0, 0, 0),
    smoothKey(d * 0.75, -2, 0, -2),
    smoothKey(d, 0, 0, 0)
  ]
  tracks['bone-torso'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.5, 4),
    smoothKey(d, 0)
  ]
  tracks['bone-head'] = [
    smoothKey(0, 0),
    smoothKey(d * 0.5, -4),
    smoothKey(d, 0)
  ]
  // Right arm plants the cane ahead, leans on it, then resets
  tracks['bone-arm-r'] = [
    smoothKey(0, -10),
    smoothKey(d * 0.3, 14),
    smoothKey(d * 0.6, 6),
    smoothKey(d, -10)
  ]
  // Left arm gentle sway
  tracks['bone-arm-l'] = [
    smoothKey(0, 10),
    smoothKey(d * 0.5, -12),
    smoothKey(d, 10)
  ]
  // Shorter, steady foot strides
  tracks['bone-thigh-l'] = [
    smoothKey(0, -14),
    smoothKey(d * 0.5, 16),
    smoothKey(d, -14)
  ]
  tracks['bone-thigh-r'] = [
    smoothKey(0, 16),
    smoothKey(d * 0.5, -14),
    smoothKey(d, 16)
  ]

  for (const b of bones) {
    if (!tracks[b.id]) tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
  }
  return tracks
}
