import type { LayerComposite, AssembledLayerItem } from './types'
import { saveComposite } from './layerAssemblyStorage'
import { toast } from '../../actions'

/**
 * Chuyển chuỗi Base64 DataURL thành Uint8Array để lưu file nhị phân qua Electron IPC
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(',')
  const base64 = parts[1] || parts[0]
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function sanitizeFileName(name: string): string {
  return (name || 'layer')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40)
}

/**
 * Xuất cấu hình Layer Composite và các layer ảnh đã tẩy sửa (Base64) ra file PNG và JSON thật trên đĩa
 * để người dùng có thể dùng Git track và commit lên repository.
 */
export async function exportCompositeToGitProject(
  composite: LayerComposite,
  onUpdateComposite?: (updated: LayerComposite) => void
): Promise<{ ok: boolean; savedPath?: string; error?: string }> {
  try {
    const api = (window as unknown as { api?: any }).api
    if (!api?.importBuiltInAssetFile || !api?.saveJson) {
      toast('Chức năng xuất tệp chỉ khả dụng trên ứng dụng máy tính Electron')
      return { ok: false, error: 'Thiếu API Electron' }
    }

    const compSlug = sanitizeFileName(composite.name)
    const timestamp = Date.now().toString(36)
    let exportedLayersCount = 0

    // 1. Duyệt qua từng layer để tìm các layer có ảnh Base64 do cọ tẩy chỉnh sửa
    const updatedLayers: AssembledLayerItem[] = []

    for (let i = 0; i < composite.layers.length; i++) {
      const layer = { ...composite.layers[i] }
      if (typeof layer.imageUrl === 'string' && layer.imageUrl.startsWith('data:image/')) {
        const layerSlug = sanitizeFileName(layer.name || `layer_${i + 1}`)
        const fileName = `${compSlug}_${layerSlug}_${timestamp}.png`
        const bytes = dataUrlToUint8Array(layer.imageUrl)

        const res = await api.importBuiltInAssetFile({
          name: fileName,
          buffer: bytes.buffer,
          folder: 'uploads',
          title: `${layer.name || 'Lớp'} (Mẫu ${composite.name})`
        })

        if (res && res.ok && res.relPath) {
          layer.assetPath = res.relPath
          delete layer.imageUrl
          exportedLayersCount++
        }
      }
      updatedLayers.push(layer)
    }

    // 2. Xử lý ảnh thumbnail nếu là dataUrl
    let finalThumbnail = composite.thumbnail
    if (typeof finalThumbnail === 'string' && finalThumbnail.startsWith('data:image/')) {
      const thumbFileName = `${compSlug}_thumb_${timestamp}.png`
      const thumbBytes = dataUrlToUint8Array(finalThumbnail)
      const thumbRes = await api.importBuiltInAssetFile({
        name: thumbFileName,
        buffer: thumbBytes.buffer,
        folder: 'uploads',
        title: `Thumbnail ${composite.name}`
      })
      if (thumbRes && thumbRes.ok && thumbRes.relPath) {
        finalThumbnail = thumbRes.relPath
      }
    }

    // 3. Tạo đối tượng composite đã được chuẩn hóa đường dẫn file thật
    const cleanComposite: LayerComposite = {
      ...composite,
      thumbnail: finalThumbnail,
      layers: updatedLayers,
      updatedAt: Date.now()
    }

    // 4. Mở hộp thoại lưu tệp JSON cấu hình vào thư mục dự án
    const jsonContent = JSON.stringify(cleanComposite, null, 2)
    const suggestedFileName = `${compSlug}.composite.json`
    const savedPath = await api.saveJson(jsonContent, suggestedFileName)

    if (!savedPath) {
      // Người dùng huỷ hộp thoại lưu
      return { ok: false }
    }

    // 5. Cập nhật vào storage và state của workshop
    saveComposite(cleanComposite)
    onUpdateComposite?.(cleanComposite)

    const msg = exportedLayersCount > 0
      ? `✓ Đã xuất ${exportedLayersCount} ảnh PNG vào assets/uploads/ và lưu cấu hình mẫu JSON! Bạn có thể commit lên Git ngay.`
      : `✓ Đã lưu cấu hình mẫu JSON vào dự án! Bạn có thể commit lên Git ngay.`

    toast(msg)
    return { ok: true, savedPath }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    toast(`Lỗi khi xuất tệp Git: ${errorMsg}`)
    return { ok: false, error: errorMsg }
  }
}

/**
 * Nhập một mẫu Layer Composite từ tệp JSON trong thư mục dự án
 */
export async function importCompositeFromGitProject(
  onLoaded: (loaded: LayerComposite) => void
): Promise<{ ok: boolean; error?: string }> {
  try {
    const api = (window as unknown as { api?: any }).api
    if (!api?.openJson) {
      toast('Chức năng nhập tệp chỉ khả dụng trên ứng dụng máy tính Electron')
      return { ok: false, error: 'Thiếu API Electron' }
    }

    const res = await api.openJson()
    if (!res || !res.content) return { ok: false }

    const parsed = JSON.parse(res.content)
    if (!parsed || !Array.isArray(parsed.layers)) {
      toast('Tệp JSON không đúng định dạng mẫu Layer Composite')
      return { ok: false, error: 'Định dạng tệp không hợp lệ' }
    }

    const imported: LayerComposite = {
      ...parsed,
      id: parsed.id || `comp-${Date.now().toString(36)}`,
      name: parsed.name || 'Mẫu nhập khẩu',
      updatedAt: Date.now()
    }

    saveComposite(imported)
    onLoaded(imported)
    toast(`✓ Đã nạp mẫu "${imported.name}" từ tệp JSON thành công!`)
    return { ok: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    toast(`Không thể đọc tệp JSON: ${errorMsg}`)
    return { ok: false, error: errorMsg }
  }
}
