import { useRef, useState } from 'react'
import type { LayerComposite } from './types'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'

export function useWorkshopSave(getComposite: () => LayerComposite, onClose: () => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const perform = async (insert: boolean) => {
    if (lock.current) return
    const composite = getComposite()
    if (!composite.layers.length) return
    lock.current = true; setBusy(true); setError('')
    try {
      let thumbnail = composite.thumbnail
      try { thumbnail = await captureCompositeThumbnail(composite) }
      catch (err) { console.warn('[LayerAssembly] Thumbnail unavailable:', err) }
      const saved = { ...composite, thumbnail }
      saveComposite(saved)
      if (insert) await insertLayerCompositeToScene({ composite: saved })
      onClose()
    } catch (err) {
      setError(`Không thể ${insert ? 'thêm vào cảnh' : 'lưu mẫu'}: ${err instanceof Error ? err.message : String(err)}`)
    } finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, save: () => perform(false), insert: () => perform(true) }
}
