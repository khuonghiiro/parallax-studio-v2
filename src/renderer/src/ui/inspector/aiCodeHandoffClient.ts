import type { AiInspectorSnapshot } from './aiUiInspectorScanner'
import type { AiCodeTarget } from '@shared/aiCodeHandoff'
import { findCssSourcesForClasses, readDomSourceLocation } from './aiUiInspectorSourceLocator'
import { withInspectorOverlaysHidden, probeTopmostAt } from './aiUiInspectorSurfaces'
import { matchedUiSelectors } from './aiCodeMatchedStyles'

export function sourceTargetsForSnapshot(snapshot: AiInspectorSnapshot): AiCodeTarget[] {
  const targets = new Map<string, AiCodeTarget>()
  const elements: Element[] = []
  const add = (ref: string | null | undefined, classes: string[]) => {
    const match = ref?.replace(/\\/g, '/').match(/(src\/renderer\/src\/[^\s:()]+\.(?:tsx?|jsx?|css))(?::(\d+))?/)
    if (!match) return
    const path = match[1], line = Number(match[2] || 1)
    // A file without a line is not a precise JS location; do not export its beginning by guesswork.
    if (!path.endsWith('.css') && !match[2]) return
    const key = `${path}:${path.endsWith('.css') ? 1 : line}`
    const previous = targets.get(key)
    targets.set(key, { path, line, classes: [...new Set([...(previous?.classes || []), ...classes])] })
  }
  for (const item of snapshot.elements) {
    const classes = [...item.classes]
    if (item.element) elements.push(item.element)
    let parent = item.element?.parentElement
    for (let i = 0; parent && i < 2; i++, parent = parent.parentElement) {
      classes.push(...parent.classList); elements.push(parent)
    }
    add(item.sourceLocation, classes)
    add(item.primaryFile, classes)
    for (const ref of findCssSourcesForClasses(classes, 1000, true)) add(ref, classes)
    for (const ref of item.cssSources || []) add(ref, classes)
  }
  if (!snapshot.elements.length && typeof document !== 'undefined') {
    const { left, top, width, height } = snapshot.rect
    const target = withInspectorOverlaysHidden(() => probeTopmostAt(left + width / 2, top + height / 2))
    const classes = target ? Array.from(target.classList) : []
    if (target) elements.push(target)
    add(readDomSourceLocation(target)?.ref, classes)
    for (const ref of findCssSourcesForClasses(classes, 1000, true)) add(ref, classes)
  }
  const selectors = matchedUiSelectors([...new Set(elements)])
  return [...targets.values()].map((target) => target.path.endsWith('.css') ? { ...target, selectors } : target)
}

export async function exportSnapshotCode(snapshot: AiInspectorSnapshot) {
  if (!window.api?.aiCode) throw new Error('Hãy khởi động lại app để nạp tính năng xuất/nhập mã nguồn.')
  const summary = `Vùng: ${snapshot.primaryRegion}; theme: ${snapshot.appState.theme}.\n` + snapshot.elements.slice(0, 8)
    .map((e) => {
      const stateBadge = e.isFocused ? '[FOCUS] ' : e.isActive ? '[ACTIVE] ' : e.isPrimaryFocus ? '[TARGET] ' : ''
      return `${stateBadge}${(e.text || e.tagName).slice(0, 80)} · ${e.sourceLocation || e.primaryFile || ''} · ${e.primaryHandler || ''}`
    }).join('\n')
  return window.api.aiCode.export(sourceTargetsForSnapshot(snapshot), summary.slice(0, 1500))
}
