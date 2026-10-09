import { useRef, useState } from 'react'
import type { LayerComposite } from './types'
import { captureCompositeThumbnail } from './layerAssemblyThumbnail'
import { saveComposite } from './layerAssemblyStorage'
import { insertLayerCompositeToScene } from './insertLayerComposite'

export function useWorkshopSave(getComposite: () => LayerComposite, onClose: () => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const perform = async (insert: boolean, closeAfter = true) => {
    if (lock.current) return false
    const composite = getComposite()
    if (!composite.layers.length) return false
    lock.current = true; setBusy(true); setError('')
    try {
      let thumbnail = composite.thumbnail
      try { thumbnail = await captureCompositeThumbnail(composite) }
      catch (err) { console.warn('[LayerAssembly] Thumbnail unavailable:', err) }
      const saved = { ...composite, thumbnail }
      saveComposite(saved)
      if (insert) await insertLayerCompositeToScene({ composite: saved })
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
