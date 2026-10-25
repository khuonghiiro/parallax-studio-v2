import type { Animatable, AnimValue, EaseName, Project } from '@shared/types'
import { keyAt } from '../animation/keyframes'

/**
 * Keyframe do Node Va chạm Vật lý (Workflow V2) tự sinh được gắn id có tiền tố định danh
 * `wfcol:<nodeId>:<slot>` để mỗi lần đồng bộ lại (kéo khoảng mốc, đổi lực, bật/tắt, xoá node)
 * có thể gỡ sạch bộ keyframe cũ trước khi tạo bộ mới — không tích tụ keyframe rác trên Timeline.
 */
const COLLISION_KEY_PREFIX = 'wfcol:'

export function collisionKeyPrefix(nodeId: string): string {
  return `${COLLISION_KEY_PREFIX}${nodeId}:`
}

export function isCollisionGeneratedKey(keyId: string, nodeId?: string): boolean {
  return nodeId ? keyId.startsWith(collisionKeyPrefix(nodeId)) : keyId.startsWith(COLLISION_KEY_PREFIX)
}

/** Gỡ toàn bộ keyframe Position/Scale do Node Va chạm `nodeId` sinh ra trên mọi Layer của Project. */
export function stripCollisionGeneratedKeys(project: Project, nodeId: string): void {
  const prefix = collisionKeyPrefix(nodeId)
  for (const layer of project.layers) {
    const tracks = [layer.transform?.position, layer.transform?.scale]
    for (const track of tracks) {
      if (!track?.keyframes?.length) continue
      if (!track.keyframes.some((k) => k.id.startsWith(prefix))) continue
      track.keyframes = track.keyframes.filter((k) => !k.id.startsWith(prefix))
    }
  }
}

/**
 * Thêm một keyframe va chạm có định danh. Nếu tại đúng mốc đã có keyframe người dùng tự đặt,
 * chỉ cập nhật giá trị (giữ id gốc để không xoá nhầm keyframe của người dùng ở lần đồng bộ sau).
 */
export function upsertCollisionKey<T extends AnimValue>(
  track: Animatable<T>,
  t: number,
  value: T,
  ease: EaseName,
  nodeId: string,
  slot: string
): void {
  const existing = keyAt(track, t, 1e-4)
  if (existing) {
    existing.value = value
    existing.ease = ease
    return
  }
  track.keyframes.push({ id: `${collisionKeyPrefix(nodeId)}${slot}`, t, value, ease })
  track.keyframes.sort((a, b) => a.t - b.t)
}
