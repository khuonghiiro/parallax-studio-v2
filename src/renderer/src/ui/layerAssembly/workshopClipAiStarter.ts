import type { BoneKeyframe } from '@shared/layerRig'
import type { MotionBoneTreeNode } from './workshopClipAiGuide'

/**
 * Ví dụ khởi đầu (starter) cho AI: động tác "thở / đứng chờ" lặp liền mạch sinh từ CÂY XƯƠNG THẬT của cụm 2.5D.
 * Minh hoạ đúng quy tắc mượt: hình sin khép kín vòng lặp, trễ pha theo độ sâu xương, biên độ nhỏ dần, squash giữ thể tích.
 */

export interface StarterMotionExample {
  note: string
  name: string
  duration: number
  loop: true
  fps: number
  tracks: Record<string, BoneKeyframe[]>
}

const MAX_EXAMPLE_BONES = 6
const SAMPLE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1]

function flatten(nodes: MotionBoneTreeNode[], out: MotionBoneTreeNode[] = []): MotionBoneTreeNode[] {
  for (const n of nodes) {
    out.push(n)
    if (n.children) flatten(n.children, out)
  }
  return out
}

function priority(node: MotionBoneTreeNode): number {
  if (node.depth === 0) return 0
  if (node.role === 'torso') return 1
  if (node.role === 'head') return 2
  if (/^arm/.test(node.role)) return 3
  if (/^forearm|^hand/.test(node.role)) return 4
  return 5 + node.depth
}

const sideSign = (id: string): number => (/(^|[-_])r$/i.test(id) || /right|phải/i.test(id) ? -1 : 1)

const snap = (t: number, fps: number): number => Number((Math.round(t * fps) / fps).toFixed(3))

interface Channel {
  field: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'
  amplitude: number
  base: number
}

function channelsFor(node: MotionBoneTreeNode): Channel[] {
  const idleMax = node.typicalRotationDeg.idle[1]
  if (node.depth === 0 || node.translation === 'free') return [{ field: 'y', amplitude: 2.5, base: 0 }]
  if (node.role === 'torso') {
    return [
      { field: 'rotation', amplitude: Math.min(1.5, idleMax), base: 0 },
      { field: 'scaleY', amplitude: 0.015, base: 1 },
      { field: 'scaleX', amplitude: -0.01, base: 1 }
    ]
  }
  const amp = Math.max(1, Math.min(idleMax * 0.6, 4)) * sideSign(node.id)
  return [{ field: 'rotation', amplitude: Number(amp.toFixed(2)), base: 0 }]
}

function buildTrack(node: MotionBoneTreeNode, duration: number, fps: number): BoneKeyframe[] {
  const channels = channelsFor(node)
  const delay = node.suggestedPhaseDelaySec
  return SAMPLE_FRACTIONS.map((f) => {
    const time = snap(duration * f, fps)
    const phase = (2 * Math.PI * (time - delay)) / duration
    const key: BoneKeyframe = { time, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, easing: 'smooth' }
    for (const ch of channels) {
      const digits = ch.field.startsWith('scale') ? 3 : 2
      key[ch.field] = Number((ch.base + ch.amplitude * Math.sin(phase)).toFixed(digits))
    }
    return key
  })
}

/** Khép kín vòng lặp tuyệt đối: key cuối = key đầu (tránh sai số làm tròn). */
function closeLoop(track: BoneKeyframe[]): BoneKeyframe[] {
  const first = track[0]
  const last = track[track.length - 1]
  return [...track.slice(0, -1), { ...first, time: last.time }]
}

export function buildStarterMotionExample(
  tree: MotionBoneTreeNode[],
  duration: number,
  fps: number
): StarterMotionExample {
  const picked = flatten(tree)
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, MAX_EXAMPLE_BONES)
  const d = Number(duration.toFixed(2))
  const tracks: Record<string, BoneKeyframe[]> = {}
  for (const node of picked) tracks[node.id] = closeLoop(buildTrack(node, d, fps))
  return {
    note:
      'Ví dụ tham khảo "thở / đứng chờ" dùng đúng id xương của cụm này: sin khép kín vòng lặp, xương con trễ pha (suggestedPhaseDelaySec), easing "smooth". Thay bằng động tác người dùng yêu cầu.',
    name: 'Đứng thở tự nhiên',
    duration: d,
    loop: true,
    fps,
    tracks
  }
}
