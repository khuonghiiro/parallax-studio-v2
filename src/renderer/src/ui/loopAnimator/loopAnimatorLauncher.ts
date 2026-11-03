import { useView } from '../../store/view'
import { useLoopAnimator } from './loopAnimatorState'
import {
  extractFrameNumberFromTitle,
  loadLoopImageFiles,
  sortAndAssignFrameFiles,
  upgradeLoopImageFilesKeepMesh
} from './loopMultiFrameImporter'

/**
 * Định dạng ảnh chấp nhận khi chọn tệp (dùng phần mở rộng tệp thay vì MIME type
 * để tránh Windows Chromium quét toàn bộ Registry và Windows Shell gây đơ 2-10s)
 */
export const LOOP_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.bmp'

export {
  extractFrameNumberFromTitle,
  loadLoopImageFiles,
  sortAndAssignFrameFiles,
  upgradeLoopImageFilesKeepMesh
}

/** Đọc ảnh sprite sheet từ máy (input file hoặc kéo thả) và nạp vào xưởng */
export function loadLoopImageFile(file: File): boolean {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return false
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      useLoopAnimator.getState().loadCustomImage(reader.result, file.name)
    }
  }
  reader.readAsDataURL(file)
  return true
}

/**
 * Nâng cấp ảnh Sprite Sheet lên chất lượng cao (2K/4K) từ tệp máy tính nhưng GIỮ NGUYÊN
 * tỉ lệ Mesh, cấu hình cắt khung, nhịp phát và tự động căn lại tâm Alpha Mesh.
 */
export function upgradeLoopImageFileKeepMesh(file: File): boolean {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return false
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      useLoopAnimator.getState().upgradeSourceImageKeepMesh(reader.result, file.name)
    }
  }
  reader.readAsDataURL(file)
  return true
}

/**
 * Mở Xưởng Tách Hoạt Ảnh Loop ở trạng thái trống hoàn toàn
 * (dùng cho mọi nút "Tạo Loop Animate" — không mang theo tài nguyên cũ).
 */
export function openLoopAnimatorBlank(): void {
  useLoopAnimator.getState().startBlank()
  useView.getState().openLoopAnimator()
}

/** Mở xưởng và nạp một mẫu hoạt ảnh lặp trong kho để chỉnh sửa */
export function openLoopAnimatorTemplate(templateId: string): void {
  useLoopAnimator.getState().open(templateId)
  useView.getState().openLoopAnimator()
}

/**
 * Mở xưởng ngay tại chỗ (không đóng Xưởng Layer 2.5D / dialog nền đang mở):
 * nạp mẫu nếu có id, ngược lại mở phiên trống.
 */
export function openLoopAnimatorInPlace(templateId?: string): void {
  const animator = useLoopAnimator.getState()
  if (templateId) animator.open(templateId)
  else animator.startBlank()
  useView.getState().openDialog('loop_animator')
}
