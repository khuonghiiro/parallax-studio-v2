import { useView } from '../../store/view'
import { useLoopAnimator } from './loopAnimatorState'
import {
  extractFrameNumberFromTitle,
  loadLoopImageFiles,
  readFileAsDataUrl,
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
  readFileAsDataUrl,
  sortAndAssignFrameFiles,
  upgradeLoopImageFilesKeepMesh
}

/**
 * Đọc ảnh sprite sheet từ máy và nạp vào xưởng theo cơ chế GHI ĐÈ:
 * - Xoá hết các ảnh cũ hoặc nhóm cũ trong phiên, chỉ để lại 1 nhóm duy nhất với ảnh mới.
 */
export function loadLoopImageFile(file: File): boolean {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return false
  void readFileAsDataUrl(file).then((dataUrl) => {
    useLoopAnimator.getState().loadCustomImage(dataUrl, file.name)
  })
  return true
}

/**
 * Nạp 1 hoặc nhiều ảnh từ nút "Ảnh nối tiếp" thành các nhóm hiệu ứng nối tiếp (Nhóm 1 -> Nhóm 2 -> Nhóm 3...)
 * mà không ghi đè các nhóm đã có trong phiên.
 */
export async function appendLoopImageFilesAsGroups(files: File[]): Promise<number> {
  const validFiles = files.filter(
    (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
  )
  if (validFiles.length === 0) return 0
  let added = 0
  for (const file of validFiles) {
    try {
      const dataUrl = await readFileAsDataUrl(file)
      useLoopAnimator.getState().appendImageAsGroup(dataUrl, file.name)
      added++
    } catch {
      // Bỏ qua tệp lỗi
    }
  }
  return added
}

/** Thay thế ảnh nguồn của riêng nhóm đang chọn (không thêm nhóm mới) */
export function replaceActiveGroupImageFile(file: File): boolean {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return false
  void readFileAsDataUrl(file).then((dataUrl) => {
    useLoopAnimator.getState().replaceActiveGroupImage(dataUrl, file.name)
  })
  return true
}

/**
 * Nâng cấp ảnh Sprite Sheet lên chất lượng cao (2K/4K) từ tệp máy tính nhưng GIỮ NGUYÊN
 * tỉ lệ Mesh, cấu hình cắt khung, nhịp phát và tự động căn lại tâm Alpha Mesh.
 */
export function upgradeLoopImageFileKeepMesh(file: File): boolean {
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return false
  void readFileAsDataUrl(file).then((dataUrl) => {
    useLoopAnimator.getState().upgradeSourceImageKeepMesh(dataUrl, file.name)
  })
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
