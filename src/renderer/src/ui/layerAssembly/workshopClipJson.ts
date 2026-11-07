import type { AnimationClip, BoneEasing, BoneKeyframe, LayerBone } from '@shared/layerRig'

export interface MotionJsonExportFormat {
  format: 'parallax-motion-v1'
  name: string
  duration: number
  loop: boolean
  fps?: number
  viewAngle?: 'front' | 'diagonal' | 'side' | 'back'
  description?: string
  /** Danh sách xương của nhân vật để AI hiểu cấu trúc khung xương */
  bones: Array<{
    id: string
    name: string
    parentId?: string | null
    length?: number
    angle?: number
  }>
  /** Keyframe của từng xương theo thời gian */
  tracks: Record<string, BoneKeyframe[]>
}

const VALID_EASINGS = new Set<BoneEasing>([
  'smooth',
  'linear',
  'hold',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'bezier'
])

/**
 * Xuất AnimationClip kèm thông tin khung xương thành định dạng JSON chuẩn để gửi cho AI hoặc lưu trữ
 */
export function exportAnimationClipToJson(
  clip: AnimationClip,
  bones: LayerBone[],
  pretty = true
): string {
  const bonesMeta = bones.map((b) => ({
    id: b.id,
    name: b.name,
    parentId: b.parentId || null,
    length: Math.round(b.length),
    angle: Math.round(b.angle)
  }))

  // Sắp xếp tracks theo thứ tự xương
  const sortedTracks: Record<string, BoneKeyframe[]> = {}
  for (const b of bones) {
    if (clip.tracks[b.id] && clip.tracks[b.id].length > 0) {
      sortedTracks[b.id] = clip.tracks[b.id]
    }
  }
  // Bổ sung các track còn lại nếu có
  for (const [boneId, kfs] of Object.entries(clip.tracks)) {
    if (!sortedTracks[boneId] && kfs && kfs.length > 0) {
      sortedTracks[boneId] = kfs
    }
  }

  const payload: MotionJsonExportFormat = {
    format: 'parallax-motion-v1',
    name: clip.name,
    duration: Number(clip.duration.toFixed(2)),
    loop: clip.loop ?? true,
    fps: clip.fps ?? 30,
    viewAngle: clip.viewAngle ?? 'front',
    description: clip.description || undefined,
    bones: bonesMeta,
    tracks: sortedTracks
  }

  return JSON.stringify(payload, null, pretty ? 2 : undefined)
}

/**
 * Sinh Prompt hướng dẫn chi tiết dành cho AI (ChatGPT, Claude, DeepSeek, v.v.)
 * kèm sẵn danh sách xương của nhân vật để AI sinh đúng chuyển động.
 */
export function generateAiMotionPrompt(
  clip: AnimationClip,
  bones: LayerBone[],
  promptIntent = 'Tạo động tác hoạt ảnh tự nhiên cho nhân vật'
): string {
  const boneTreeList = bones.map((b) => {
    const parent = bones.find((p) => p.id === b.parentId)
    const parentLabel = parent ? `(Cha: "${parent.name}" [${parent.id}])` : '(Gốc / Root)'
    return `  - ID: "${b.id}" | Tên: "${b.name}" ${parentLabel} | Dài: ${Math.round(b.length)}px`
  })

  return `Bạn là một chuyên gia Animator 2D/2.5D. Hãy thiết kế hoạt ảnh cho nhân vật trong ứng dụng Parallax Studio.

🎯 YÊU CẦU HOẠT ẢNH:
${promptIntent}

🦴 CẤU TRÚC KHUNG XƯƠNG CỦA NHÂN VẬT:
${boneTreeList.join('\n')}

⏱️ THÔNG SỐ ĐỘNG TÁC GỢI Ý:
- Tên động tác: "${clip.name || 'Động tác mới'}"
- Thời lượng: ${clip.duration.toFixed(1)} giây
- Số khung hình (FPS): ${clip.fps ?? 30} fps
- Vòng lặp (Loop): ${clip.loop ? 'Có lặp (Loop vô tận)' : 'Không lặp (Chạy 1 lần)'}
- Góc nhìn: ${clip.viewAngle ?? 'Chính diện (0°)'}

📋 QUY TẮC KEYFRAME CỦA PARALLAX STUDIO:
1. Góc xoay "rotation": Tính bằng ĐỘ (độ âm là ngược chiều kim đồng hồ, độ dương là cùng chiều).
2. Tịnh tiến "x", "y": Pixel lệch so với tư thế gốc (thường chỉ dịch chuyển cho xương Hông/Gốc pelvis để nhún nhảy).
3. "time": Thời điểm giây từ 0 đến thời lượng kết thúc.
4. "easing": Chọn một trong các kiểu: "smooth" (mặc định mượt mà), "ease-in-out", "ease-out", "linear", "hold".
5. Nếu là động tác lặp (loop: true), Keyframe tại time = 0 và time = thời lượng kết thúc NÊN CÙNG TƯ THẾ để chuyển động nối tiếp mượt mà.

📦 ĐỊNH DẠNG ĐẦU RA (BẮT BUỘC):
Chỉ trả về DUY NHẤT một khối mã JSON hợp lệ nằm trong \`\`\`json ... \`\`\` theo mẫu sau:

\`\`\`json
{
  "format": "parallax-motion-v1",
  "name": "Tên động tác",
  "duration": ${clip.duration.toFixed(1)},
  "loop": ${clip.loop ? 'true' : 'false'},
  "fps": ${clip.fps ?? 30},
  "tracks": {
    "${bones[0]?.id || 'bone-torso'}": [
      { "time": 0.0, "rotation": 0, "easing": "smooth" },
      { "time": ${(clip.duration * 0.5).toFixed(2)}, "rotation": 15, "easing": "smooth" },
      { "time": ${clip.duration.toFixed(2)}, "rotation": 0, "easing": "smooth" }
    ]
  }
}
\`\`\``
}

export interface ParseClipResult {
  success: boolean
  clip?: AnimationClip
  error?: string
  warnings?: string[]
}

/**
 * Trích xuất chuỗi JSON từ văn bản người dùng dán (kể cả có bọc markdown ```json ... ```)
 */
export function extractJsonFromText(rawText: string): string {
  const trimmed = rawText.trim()
  // Nếu có khối markdown ```json ... ```
  const mdMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (mdMatch && mdMatch[1]) {
    return mdMatch[1].trim()
  }

  // Tìm dấu { đầu tiên và } cuối cùng
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

/**
 * Phân tích và chuẩn hóa AnimationClip từ JSON được nhập từ AI hoặc file bên ngoài
 */
export function parseAnimationClipFromJson(
  rawText: string,
  existingBones?: LayerBone[]
): ParseClipResult {
  const warnings: string[] = []
  if (!rawText || !rawText.trim()) {
    return { success: false, error: 'Dữ liệu JSON trống, vui lòng dán nội dung JSON.' }
  }

  const jsonStr = extractJsonFromText(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    return {
      success: false,
      error: `Cú pháp JSON không hợp lệ: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Dữ liệu JSON phải là một đối tượng (Object).' }
  }

  const data = parsed as Record<string, unknown>

  // Lấy tracks
  const rawTracks = data.tracks
  if (typeof rawTracks !== 'object' || rawTracks === null) {
    return {
      success: false,
      error: 'Thiếu trường "tracks" chứa danh sách keyframe của các xương.'
    }
  }

  // Map tên xương nếu AI lỡ dùng tên thay vì ID
  const boneMap = new Map<string, string>() // alias lowercase -> real bone id
  if (existingBones) {
    for (const b of existingBones) {
      boneMap.set(b.id.toLowerCase(), b.id)
      boneMap.set(b.name.toLowerCase(), b.id)
      // Thêm biến thể không dấu hoặc bỏ dấu gạch nối
      boneMap.set(b.id.replace(/-/g, '').toLowerCase(), b.id)
      boneMap.set(b.name.replace(/\s+/g, '').toLowerCase(), b.id)
    }
  }

  let maxKeyframeTime = 0
  const normalizedTracks: Record<string, BoneKeyframe[]> = {}

  for (const [key, val] of Object.entries(rawTracks as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue

    let targetBoneId = key
    const cleanKey = key.trim().toLowerCase()
    if (boneMap.has(cleanKey)) {
      targetBoneId = boneMap.get(cleanKey)!
    } else if (existingBones && existingBones.length > 0) {
      // Tìm xem có xương nào chứa từ khoá tương đồng
      const matchedBone = existingBones.find(
        (b) =>
          b.id.toLowerCase().includes(cleanKey) ||
          b.name.toLowerCase().includes(cleanKey) ||
          cleanKey.includes(b.name.toLowerCase())
      )
      if (matchedBone) {
        targetBoneId = matchedBone.id
      } else {
        warnings.push(`Xương "${key}" không có trong khung xương hiện tại, vẫn giữ track này.`)
      }
    }

    const keyframes: BoneKeyframe[] = []
    for (const item of val) {
      if (typeof item !== 'object' || item === null) continue
      const kf = item as Record<string, unknown>

      const time = typeof kf.time === 'number' && !isNaN(kf.time) ? Math.max(0, kf.time) : 0
      const rotation =
        typeof kf.rotation === 'number' && !isNaN(kf.rotation)
          ? Number(kf.rotation.toFixed(3))
          : 0
      const x = typeof kf.x === 'number' && !isNaN(kf.x) ? Number(kf.x.toFixed(2)) : 0
      const y = typeof kf.y === 'number' && !isNaN(kf.y) ? Number(kf.y.toFixed(2)) : 0
      const scaleX =
        typeof kf.scaleX === 'number' && !isNaN(kf.scaleX) ? Number(kf.scaleX.toFixed(3)) : 1
      const scaleY =
        typeof kf.scaleY === 'number' && !isNaN(kf.scaleY) ? Number(kf.scaleY.toFixed(3)) : 1

      let easing: BoneEasing = 'smooth'
      if (typeof kf.easing === 'string' && VALID_EASINGS.has(kf.easing as BoneEasing)) {
        easing = kf.easing as BoneEasing
      }

      if (time > maxKeyframeTime) {
        maxKeyframeTime = time
      }

      keyframes.push({
        time: Number(time.toFixed(4)),
        rotation,
        x,
        y,
        scaleX,
        scaleY,
        easing,
        ...(kf.zOrder !== undefined ? { zOrder: Number(kf.zOrder) } : {})
      })
    }

    // Sắp xếp keyframes theo thời gian
    keyframes.sort((a, b) => a.time - b.time)
    if (keyframes.length > 0) {
      normalizedTracks[targetBoneId] = keyframes
    }
  }

  const trackCount = Object.keys(normalizedTracks).length
  if (trackCount === 0) {
    return {
      success: false,
      error: 'Không tìm thấy keyframe hợp lệ nào trong trường "tracks".'
    }
  }

  // Xác định thời lượng
  let duration = typeof data.duration === 'number' && !isNaN(data.duration) ? data.duration : 0
  if (duration <= 0) {
    duration = maxKeyframeTime > 0 ? maxKeyframeTime : 2.0
  }
  duration = Math.max(0.1, Math.min(120, Number(duration.toFixed(2))))

  const name =
    typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : `Động tác nhập (${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`

  const loop = typeof data.loop === 'boolean' ? data.loop : true
  const fps =
    typeof data.fps === 'number' && [12, 24, 30, 60].includes(data.fps) ? data.fps : 30

  const clip: AnimationClip = {
    id: `clip-imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    duration,
    loop,
    fps,
    tracks: normalizedTracks,
    description: typeof data.description === 'string' ? data.description : 'Nhập từ JSON / AI'
  }

  if (
    typeof data.viewAngle === 'string' &&
    ['front', 'diagonal', 'side', 'back'].includes(data.viewAngle)
  ) {
    clip.viewAngle = data.viewAngle as AnimationClip['viewAngle']
  }

  return {
    success: true,
    clip,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}
