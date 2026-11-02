import { useView } from '../../store/view'
import { useLoopAnimator } from './loopAnimatorState'

/** Định dạng ảnh sprite sheet được chấp nhận khi tải lên / kéo thả */
export const LOOP_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** Đọc ảnh sprite sheet từ máy (input file hoặc kéo thả) và nạp vào xưởng */
export function loadLoopImageFile(file: File): boolean {
  if (!file.type.startsWith('image/')) return false
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
