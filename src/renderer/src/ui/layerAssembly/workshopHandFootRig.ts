import type { BoneKeyframe, LayerBone } from '@shared/layerRig'
import { createHumanoidBones } from './workshopRigPresets'

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

/**
 * 1. Khung xương Người 2D Chi Tiết (19 xương):
 * Mở rộng từ bộ 15 xương cơ bản, bổ sung thêm đốt ngón tay (finger-l/r) và đốt mũi chân (toe-l/r)
 * giúp điều hướng tiếp đất, uốn mũi giày khi bước và diễn hoạt ngón tay tinh xảo.
 */
export function createFullHumanoidBones(): LayerBone[] {
  const base = createHumanoidBones()
  return [
    ...base,
    // Ngón tay trái & phải gắn tiếp sau bàn tay
    {
      id: 'bone-finger-l',
      name: 'Ngón tay trái',
      parentId: 'bone-hand-l',
      x: -38,
      y: 60,
      length: 18,
      angle: 90
    },
    {
      id: 'bone-finger-r',
      name: 'Ngón tay phải',
      parentId: 'bone-hand-r',
      x: 38,
      y: 60,
      length: 18,
      angle: 90
    },
    // Mũi ngón chân trái & phải gắn tiếp sau bàn chân
    {
      id: 'bone-toe-l',
      name: 'Mũi chân trái',
      parentId: 'bone-foot-l',
      x: 5,
      y: 175,
      length: 20,
      angle: 0
    },
    {
      id: 'bone-toe-r',
      name: 'Mũi chân phải',
      parentId: 'bone-foot-r',
      x: 55,
      y: 175,
      length: 20,
      angle: 0
    }
  ]
}

/**
 * 2. Khung xương Bàn Tay Chi Tiết (12 xương):
 * Bộ rig chuyên biệt cho bàn tay cận cảnh: cổ tay, lòng bàn tay và 5 ngón tay riêng biệt
 * (mỗi ngón có đốt gốc và đốt ngọn), phục vụ cầm nắm đồ vật, chỉ trỏ, làm thủ ngữ hoặc nắm đấm.
 */
export function createHandDetailedBones(): LayerBone[] {
  return [
    { id: 'bone-wrist', name: 'Cổ tay (Root)', x: 0, y: 130, length: 45, angle: -90 },
    { id: 'bone-palm', name: 'Lòng bàn tay', parentId: 'bone-wrist', x: 0, y: 85, length: 50, angle: -90 },

    // Ngón cái (Thumb - 2 đốt)
    { id: 'bone-thumb-base', name: 'Gốc ngón cái', parentId: 'bone-palm', x: -22, y: 70, length: 30, angle: -140 },
    { id: 'bone-thumb-tip', name: 'Đốt ngón cái', parentId: 'bone-thumb-base', x: -45, y: 50, length: 25, angle: -130 },

    // Ngón trỏ (Index finger - 2 đốt)
    { id: 'bone-index-base', name: 'Gốc ngón trỏ', parentId: 'bone-palm', x: -18, y: 35, length: 35, angle: -98 },
    { id: 'bone-index-tip', name: 'Đốt ngón trỏ', parentId: 'bone-index-base', x: -23, y: 0, length: 28, angle: -95 },

    // Ngón giữa (Middle finger - 2 đốt)
    { id: 'bone-middle-base', name: 'Gốc ngón giữa', parentId: 'bone-palm', x: -2, y: 35, length: 40, angle: -90 },
    { id: 'bone-middle-tip', name: 'Đốt ngón giữa', parentId: 'bone-middle-base', x: -2, y: -5, length: 32, angle: -90 },

    // Ngón áp út (Ring finger - 2 đốt)
    { id: 'bone-ring-base', name: 'Gốc ngón áp út', parentId: 'bone-palm', x: 14, y: 35, length: 36, angle: -82 },
    { id: 'bone-ring-tip', name: 'Đốt ngón áp út', parentId: 'bone-ring-base', x: 19, y: -1, length: 28, angle: -85 },

    // Ngón út (Pinky - 2 đốt)
    { id: 'bone-pinky-base', name: 'Gốc ngón út', parentId: 'bone-palm', x: 28, y: 45, length: 28, angle: -72 },
    { id: 'bone-pinky-tip', name: 'Đốt ngón út', parentId: 'bone-pinky-base', x: 37, y: 18, length: 22, angle: -75 }
  ]
}

/**
 * 3. Khung xương Cẳng Chân & Bàn Chân Chi Tiết (8 xương):
 * Bộ rig chuyên biệt cho chân và bàn chân: đùi, đầu gối, cẳng chân, cổ chân (ankle),
 * gót chân (heel), vòm bàn chân (foot arch), khớp ức ngón (toe-ball) và mũi ngón chân (toe-tip).
 * Phục vụ các tư thế nhón chân, chạm gót, bước đi uốn cong mũi giày tự nhiên.
 */
export function createFootDetailedBones(): LayerBone[] {
  return [
    { id: 'bone-leg-thigh', name: 'Đùi trên (Root)', x: 0, y: -160, length: 80, angle: 90 },
    { id: 'bone-leg-shin', name: 'Đầu gối & Cẳng chân', parentId: 'bone-leg-thigh', x: 0, y: -80, length: 85, angle: 90 },
    { id: 'bone-foot-ankle', name: 'Khớp cổ chân', parentId: 'bone-leg-shin', x: 0, y: 5, length: 25, angle: 65 },
    { id: 'bone-foot-heel', name: 'Gót chân tiếp đất', parentId: 'bone-foot-ankle', x: 0, y: 5, length: 25, angle: 170 },
    { id: 'bone-foot-arch', name: 'Mu & Vòm bàn chân', parentId: 'bone-foot-ankle', x: 0, y: 5, length: 45, angle: 0 },
    { id: 'bone-foot-toe-ball', name: 'Khớp ức ngón chân', parentId: 'bone-foot-arch', x: 45, y: 5, length: 25, angle: 0 },
    { id: 'bone-foot-toe-tip', name: 'Mũi ngón chân', parentId: 'bone-foot-toe-ball', x: 70, y: 5, length: 20, angle: 0 },
    { id: 'bone-foot-ik-target', name: 'Tay nắm điều hướng bàn chân', parentId: 'bone-leg-shin', x: 0, y: 35, length: 30, angle: 0 }
  ]
}

/**
 * 4. Chuyển động mẫu: Nắm & Xòe Bàn Tay (Hand Fist Clench)
 * Tự động uốn cong các khớp ngón tay từ trạng thái xòe tự nhiên sang nắm đấm rồi thả lỏng.
 */
export function generateHandFistClench(bones: LayerBone[], duration = 2.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  const find = (keywords: string[]) => {
    for (const b of bones) {
      const id = b.id.toLowerCase()
      const name = (b.name || '').toLowerCase()
      for (const kw of keywords) {
        if (id.includes(kw) || name.includes(kw)) return b.id
      }
    }
    return undefined
  }

  const thumbBase = find(['thumb-base', 'gốc ngón cái'])
  const thumbTip = find(['thumb-tip', 'đốt ngón cái'])
  const indexBase = find(['index-base', 'gốc ngón trỏ'])
  const indexTip = find(['index-tip', 'đốt ngón trỏ'])
  const middleBase = find(['middle-base', 'gốc ngón giữa'])
  const middleTip = find(['middle-tip', 'đốt ngón giữa'])
  const ringBase = find(['ring-base', 'gốc ngón áp út'])
  const ringTip = find(['ring-tip', 'đốt ngón áp út'])
  const pinkyBase = find(['pinky-base', 'gốc ngón út'])
  const pinkyTip = find(['pinky-tip', 'đốt ngón út'])
  const palm = find(['palm', 'lòng bàn tay'])
  const wrist = find(['wrist', 'cổ tay'])

  if (wrist) {
    tracks[wrist] = [
      smoothKey(0, 0),
      smoothKey(d * 0.4, 6),
      smoothKey(d * 0.7, -4),
      smoothKey(d, 0)
    ]
  }

  if (palm) {
    tracks[palm] = [
      smoothKey(0, 0),
      smoothKey(d * 0.5, -4),
      smoothKey(d, 0)
    ]
  }

  const addFingerCurl = (baseId: string | undefined, tipId: string | undefined, baseAngle: number, tipAngle: number) => {
    if (baseId) {
      tracks[baseId] = [
        smoothKey(0, 0),
        smoothKey(d * 0.45, baseAngle),
        smoothKey(d * 0.7, baseAngle * 0.95),
        smoothKey(d, 0)
      ]
    }
    if (tipId) {
      tracks[tipId] = [
        smoothKey(0, 0),
        smoothKey(d * 0.5, tipAngle),
        smoothKey(d * 0.75, tipAngle * 0.95),
        smoothKey(d, 0)
      ]
    }
  }

  addFingerCurl(thumbBase, thumbTip, -30, -50)
  addFingerCurl(indexBase, indexTip, -42, -65)
  addFingerCurl(middleBase, middleTip, -48, -70)
  addFingerCurl(ringBase, ringTip, -44, -66)
  addFingerCurl(pinkyBase, pinkyTip, -38, -58)

  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
    }
  }

  return tracks
}

/**
 * 5. Chuyển động mẫu: Cuộn Gót - Mu - Mũi Bàn Chân (Foot Heel-Toe Roll)
 * Mô phỏng bước lăn bàn chân mềm mại chuẩn giải phẫu: Gót chạm sàn -> Đặt phẳng mu chân -> Nhón mũi chân -> Nhấc chân.
 */
export function generateFootHeelToeRoll(bones: LayerBone[], duration = 2.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  const find = (keywords: string[]) => {
    for (const b of bones) {
      const id = b.id.toLowerCase()
      const name = (b.name || '').toLowerCase()
      for (const kw of keywords) {
        if (id.includes(kw) || name.includes(kw)) return b.id
      }
    }
    return undefined
  }

  const ankle = find(['foot-ankle', 'cổ chân', 'ankle'])
  const footArch = find(['foot-arch', 'vòm bàn chân', 'mu'])
  const toeBall = find(['toe-ball', 'khớp ức ngón', 'toe'])
  const toeTip = find(['toe-tip', 'mũi ngón chân'])
  const heel = find(['heel', 'gót chân'])
  const shin = find(['shin', 'cẳng chân'])
  const thigh = find(['thigh', 'đùi'])

  if (thigh) {
    tracks[thigh] = [
      smoothKey(0, -10),
      smoothKey(d * 0.35, 12),
      smoothKey(d * 0.7, 5),
      smoothKey(d, -10)
    ]
  }

  if (shin) {
    tracks[shin] = [
      smoothKey(0, 8),
      smoothKey(d * 0.35, -14),
      smoothKey(d * 0.7, 18),
      smoothKey(d, 8)
    ]
  }

  if (ankle) {
    tracks[ankle] = [
      smoothKey(0, -22),      // Gót chạm sàn, mũi chân ngửa lên
      smoothKey(d * 0.35, 0),  // Bàn chân đặt phẳng chạm đất
      smoothKey(d * 0.7, 28),  // Gót nhấc lên, cổ chân duỗi
      smoothKey(d * 0.85, 10), // Rời khỏi mặt đất
      smoothKey(d, -22)
    ]
  }

  if (footArch) {
    tracks[footArch] = [
      smoothKey(0, 5),
      smoothKey(d * 0.35, 0),
      smoothKey(d * 0.7, -10), // Mu bàn chân uốn cong theo lực đẩy
      smoothKey(d, 5)
    ]
  }

  if (toeBall) {
    tracks[toeBall] = [
      smoothKey(0, 10),       // Mũi chân hơi ngửa khi chạm gót
      smoothKey(d * 0.35, 0), // Phẳng
      smoothKey(d * 0.7, -32),// Mũi chân uốn gập mạnh bám sàn khi nhón gót
      smoothKey(d * 0.85, -8),
      smoothKey(d, 10)
    ]
  }

  if (toeTip) {
    tracks[toeTip] = [
      smoothKey(0, 5),
      smoothKey(d * 0.35, 0),
      smoothKey(d * 0.7, -16),
      smoothKey(d, 5)
    ]
  }

  if (heel) {
    tracks[heel] = [
      smoothKey(0, 4),
      smoothKey(d * 0.35, 0),
      smoothKey(d * 0.7, -8),
      smoothKey(d, 4)
    ]
  }

  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
    }
  }

  return tracks
}
