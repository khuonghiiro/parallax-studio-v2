import type { AssetMeta, LayerMotion, Vec3 } from '@shared/types'
import { evaluate, addKeyframe } from '../../animation/keyframes'
import { frameTolerance, useEditor } from '../../store/editor'

/**
 * Đổi trạng thái khóa/mở khóa cho toàn bộ các layer trong cùng cụm composite.
 * Khi locked: true -> Di chuyển hoặc biến đổi bất kỳ layer nào sẽ kéo theo toàn bộ cụm.
 * Khi locked: false -> Có thể chọn và chỉnh sửa/tạo animation cho riêng từng layer con.
 */
export function setCompositeGroupLock(instanceId: string, locked: boolean): void {
  useEditor.getState().update((draft) => {
    let count = 0
    let compName = ''
    for (const l of draft.layers) {
      if (l.composite?.instanceId === instanceId) {
        l.composite.lockedGroup = locked
        compName = l.composite.compositeName || compName
        count++
      }
    }
    if (count > 0) {
      // Message ghi lại trong history
    }
  }, locked ? 'Khóa cụm layer' : 'Mở khóa cụm layer')
}

/**
 * Đặt một layer con làm gốc (root / anchor) định vị cho cụm layer.
 */
export function setCompositeRootLayer(instanceId: string, rootLayerId: string): void {
  useEditor.getState().update((draft) => {
    for (const l of draft.layers) {
      if (l.composite?.instanceId === instanceId) {
        l.composite.isRoot = l.id === rootLayerId
      }
    }
  }, 'Đặt layer gốc cho cụm')
}

/**
 * Áp dụng cấu hình chuyển động (Motion) đồng bộ cho toàn bộ các layer trong cụm.
 * Tuỳ chọn staggerPhase tự động làm lệch pha giữa các lớp để tạo hiệu ứng đung đưa / phân tầng sống động.
 */
export function batchApplyCompositeMotion(
  instanceId: string,
  motion: LayerMotion,
  staggerPhase = false
): void {
  useEditor.getState().update((draft) => {
    const compLayers = draft.layers.filter((l) => l.composite?.instanceId === instanceId)
    compLayers.forEach((l, idx) => {
      const phaseOffset = staggerPhase ? (motion.phase ?? 0) + idx * 0.35 : (motion.phase ?? 0)
      l.motion = {
        ...motion,
        phase: Number(phaseOffset.toFixed(2))
      }
    })
  }, 'Áp dụng Motion cho cả cụm')
}

/**
 * Xóa hoạt ảnh Motion khỏi toàn bộ các layer trong cụm.
 */
export function batchClearCompositeMotion(instanceId: string): void {
  useEditor.getState().update((draft) => {
    for (const l of draft.layers) {
      if (l.composite?.instanceId === instanceId) {
        l.motion = undefined
      }
    }
  }, 'Xóa Motion cụm layer')
}

/**
 * Lưu keyframe Transform (Vị trí, Góc xoay, Tỉ lệ) tại thời điểm timeline hiện tại
 * cho toàn bộ các layer trong cụm.
 */
export function batchKeyframeCompositeTransform(instanceId: string): void {
  const state = useEditor.getState()
  const time = state.time
  const tol = frameTolerance(state.project)

  state.update((draft) => {
    const compLayers = draft.layers.filter((l) => l.composite?.instanceId === instanceId)
    for (const l of compLayers) {
      const curPos = evaluate(l.transform.position, time)
      const curRot = evaluate(l.transform.rotation, time)
      const curScale = evaluate(l.transform.scale, time)

      addKeyframe(l.transform.position, time, [...curPos] as Vec3, 'easeInOut', tol)
      addKeyframe(l.transform.rotation, time, [...curRot] as Vec3, 'easeInOut', tol)
      addKeyframe(l.transform.scale, time, [...curScale] as Vec3, 'easeInOut', tol)
    }
  }, 'Tạo keyframe cho cả cụm layer')
}

/**
 * Thay thế asset ảnh cho một layer con trong cụm layer.
 */
export function replaceCompositeSublayerAsset(layerId: string, newAsset: AssetMeta): void {
  useEditor.getState().update((draft) => {
    const layer = draft.layers.find((l) => l.id === layerId)
    if (!layer || layer.type !== 'image') return
    layer.props.assetId = newAsset.id
    if (newAsset.name) {
      // Giữ tiền tố cụm nếu có
      const compPrefixMatch = layer.name.match(/^(\[[^\]]+\]\s*)/)
      const prefix = compPrefixMatch ? compPrefixMatch[1] : ''
      layer.name = `${prefix}${newAsset.name}`
    }
  }, 'Thay đổi asset layer con')
}
