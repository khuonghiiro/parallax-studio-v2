import type { AiInspectorSnapshot, ScannedElementContext } from './aiUiInspectorScanner'
import type { AiCodeTarget } from '@shared/aiCodeHandoff'
import { findCssSourcesForClasses, readDomSourceLocation } from './aiUiInspectorSourceLocator'
import { withInspectorOverlaysHidden, probeTopmostAt } from './aiUiInspectorSurfaces'
import { matchedUiSelectors } from './aiCodeMatchedStyles'
import { isSharedPrimitiveFile } from './aiUiInspectorControlMeta'

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
    let depth = 0
    while (parent && parent !== document.body && depth < 12) {
      classes.push(...parent.classList)
      elements.push(parent)
      if (parent.getAttribute('data-mcp-region') || parent.getAttribute('role') === 'dialog') break
      parent = parent.parentElement
      depth++
    }
    const isSrcPrimitive = isSharedPrimitiveFile(item.sourceLocation)
    const isPrimaryPrimitive = isSharedPrimitiveFile(item.primaryFile)
    const effectiveJsx = (!isSrcPrimitive && item.sourceLocation)
      ? item.sourceLocation
      : (!isPrimaryPrimitive && item.primaryFile)
        ? item.primaryFile
        : (item.sourceLocation || item.primaryFile)

    add(effectiveJsx, classes)
    for (const ref of findCssSourcesForClasses(classes, 1000, true)) add(ref, classes)
    for (const ref of item.cssSources || []) add(ref, classes)
  }
  if (!snapshot.elements.length && typeof document !== 'undefined') {
    const { left, top, width, height } = snapshot.rect
    const target = withInspectorOverlaysHidden(() => probeTopmostAt(left + width / 2, top + height / 2))
    const classes = target ? Array.from(target.classList) : []
    if (target) elements.push(target)
    let parent = target?.parentElement
    let depth = 0
    while (parent && parent !== document.body && depth < 12) {
      classes.push(...parent.classList)
      elements.push(parent)
      if (parent.getAttribute('data-mcp-region') || parent.getAttribute('role') === 'dialog') break
      parent = parent.parentElement
      depth++
    }
    add(readDomSourceLocation(target)?.ref, classes)
    for (const ref of findCssSourcesForClasses(classes, 1000, true)) add(ref, classes)
  }
  const selectors = matchedUiSelectors([...new Set(elements)])
  return [...targets.values()].map((target) => target.path.endsWith('.css') ? { ...target, selectors } : target)
}

export async function exportSnapshotCode(snapshot: AiInspectorSnapshot) {
  if (!window.api?.aiCode) throw new Error('Hãy khởi động lại app để nạp tính năng xuất/nhập mã nguồn.')

  const seenRefs = new Map<string, { count: number; element: ScannedElementContext }>()
  for (const e of snapshot.elements) {
    const isSrcPrim = isSharedPrimitiveFile(e.sourceLocation)
    const isPriPrim = isSharedPrimitiveFile(e.primaryFile)
    const loc = (!isSrcPrim && e.sourceLocation)
      ? e.sourceLocation
      : (!isPriPrim && e.primaryFile)
        ? e.primaryFile
        : (e.sourceLocation || e.primaryFile || '')
    const key = loc ? `${loc}:${e.id || ''}` : `${e.tagName}:${e.classes[0] || ''}`
    const existing = seenRefs.get(key)
    if (existing) {
      existing.count++
      if ((e.isFocused || e.isActive) && !(existing.element.isFocused || existing.element.isActive)) {
        existing.element = e
      }
    } else {
      seenRefs.set(key, { count: 1, element: e })
    }
  }

  const prioritized = Array.from(seenRefs.values()).slice(0, 10)
  const bp = snapshot.viewport?.breakpointLabel || 'desktop'
  const summaryHeader = `Vùng: ${snapshot.primaryRegion}; theme: ${snapshot.appState.theme}; viewport: ${bp}.\n`
  const summaryLines = prioritized.map(({ count, element: e }) => {
    const stateBadge = e.isFocused ? '[FOCUS] ' : e.isActive ? '[ACTIVE] ' : e.isPrimaryFocus ? '[TARGET] ' : ''
    const isSrcPrim = isSharedPrimitiveFile(e.sourceLocation)
    const isPriPrim = isSharedPrimitiveFile(e.primaryFile)
    const loc = (!isSrcPrim && e.sourceLocation)
      ? e.sourceLocation
      : (!isPriPrim && e.primaryFile)
        ? e.primaryFile
        : (e.sourceLocation || e.primaryFile || '')
    const idStr = e.id ? `#${e.id}` : ''
    const primStr = isSrcPrim && e.controlDetails?.primitiveName ? ` (${e.controlDetails.primitiveName}${idStr})` : idStr ? ` (${idStr})` : ''
    const repeatStr = count > 1 ? ` · (lặp lại ${count} lần)` : ''
    const boundsStr = e.bounds ? ` · ${Math.round(e.bounds.width)}×${Math.round(e.bounds.height)}px` : ''
    const fontStr = e.computedSizing?.fontSize ? ` · font: ${e.computedSizing.fontSize}` : ''
    const displayStr = e.computedSizing?.display ? ` · ${e.computedSizing.display}` : ''
    const inlineStyle = e.element?.getAttribute?.('style')
    const inlineStr = inlineStyle ? ` · ⚠️ [INLINE STYLE: "${inlineStyle.slice(0, 50)}"]` : ''
    const handlerStr = e.primaryHandler ? ` · [runtime: ${e.primaryHandler}]` : ''
    const domPathStr = e.domPath ? ` · [path: ${e.domPath}]` : ''

    const name = (e.text || e.title || e.tagName).slice(0, 60)
    return `${stateBadge}${name}${primStr} · ${loc}${repeatStr}${boundsStr}${fontStr}${displayStr}${inlineStr}${handlerStr}${domPathStr}`
  })

  const summary = (summaryHeader + summaryLines.join('\n')).slice(0, 2000)
  return window.api.aiCode.export(sourceTargetsForSnapshot(snapshot), summary)
}
