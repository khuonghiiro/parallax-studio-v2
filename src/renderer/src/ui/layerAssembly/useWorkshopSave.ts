import { useRef, useState } from 'react'
import type { LayerComposite } from './types'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'
import { toast } from '../../actions'

export function useWorkshopSave(
  getComposite: () => LayerComposite,
  onClose: () => void,
  getTime?: () => number
) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const perform = async (insert: boolean, closeAfter = true) => {
    if (lock.current) return false
    const composite = getComposite()
    if (!composite.layers.length) return false
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const time = getTime ? getTime() : 0
      let thumbnail = composite.thumbnail
      try {
        thumbnail = await captureCompositeThumbnail(composite, {
          size: 280,
          time,
          autoFit: true
        })
      } catch (err) {
        console.warn('[LayerAssembly] Thumbnail capture failed:', err)
      }
      const saved = { ...composite, thumbnail }
      saveComposite(saved)
      if (insert) {
        await insertLayerCompositeToScene({ composite: saved })
      } else {
        const hasEditedPixels = composite.layers.some(
          (l) => typeof l.imageUrl === 'string' && l.imageUrl.startsWith('data:image/')
        )
        if (hasEditedPixels) {
          toast('✓ Đã lưu mẫu vào bộ nhớ app! Bạn có layer đã tẩy sửa pixel: bấm "Xuất tệp Git" để xuất ảnh PNG vào assets/ và commit lên Git.')
        } else {
          toast(`✓ Đã lưu mẫu "${composite.name}" vào bộ nhớ app thành công!`)
        }
      }
      if (closeAfter) onClose()
      return true
    } catch (err) {
      setError(`Không thể ${insert ? 'thêm vào cảnh' : 'lưu mẫu'}: ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally { lock.current = false; setBusy(false) }
  }
  return {
    busy,
    error,
    save: async () => { await perform(false, true) },
    saveWithoutClosing: () => perform(false, false),
    insert: async () => { await perform(true, true) }
  }
}
