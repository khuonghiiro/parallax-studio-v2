import { useRef } from 'react'
import type { ScreenLabel } from '../../engine/editorHelpers'
import type { Rect } from '../../engine/SceneRenderer'

export function useViewerLabels(labelsRef: React.RefObject<HTMLDivElement | null>) {
  const labelEls = useRef(new Map<string, HTMLDivElement>()).current

  function updateLabels(labels: ScreenLabel[], ed: Rect | null, dpr: number, selectedShotId: string | null): void {
    const host = labelsRef.current
    if (!host) return
    const seen = new Set<string>()
    if (ed) {
      for (const l of labels) {
        const key = `${l.kind}:${l.id}`
        const x = ed.x + l.x / dpr
        const y = ed.y + l.y / dpr
        if (x < ed.x - 40 || x > ed.x + ed.w + 40 || y < ed.y - 20 || y > ed.y + ed.h + 20) continue
        seen.add(key)
        let el = labelEls.get(key)
        if (!el) {
          el = document.createElement('div')
          if (l.kind === 'shot') {
            el.className = 'v-label shot'
            el.dataset.shot = l.id
            el.title = 'Kéo để di chuyển cảnh trong không gian 3D (Shift: khóa trục, Alt: kéo chiều sâu Z)'
          } else if (l.kind === 'camera') {
            el.className = 'v-label cam'
            el.dataset.cam = 'pos'
            el.title = 'Kéo để dời Camera trong 3D · Click để cấu hình góc quay (Alt: kéo chiều sâu Z, Shift: khóa trục)'
          } else if (l.kind === 'cam-target') {
            el.className = 'v-label cam-target'
            el.dataset.cam = 'target'
            el.title = 'Kéo để dời điểm nhìn của Camera trong 3D (Alt: kéo chiều sâu Z, Shift: khóa trục)'
          }
          host.appendChild(el)
          labelEls.set(key, el)
        }
        if (el.textContent !== l.text) el.textContent = l.text
        el.style.transform = `translate(${x}px, ${y}px)`
        el.style.setProperty('--c', l.color)
        el.classList.toggle('selected', l.kind === 'shot' && l.id === selectedShotId)
      }
    }
    for (const [key, el] of labelEls) {
      if (!seen.has(key)) {
        el.remove()
        labelEls.delete(key)
      }
    }
  }

  return { updateLabels }
}
