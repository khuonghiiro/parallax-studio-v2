import type { AiInspectorSnapshot } from './aiUiInspectorScanner'
import { formatAiInspectorMarkdown } from './aiUiInspectorMarkdown'
import { findCssSourcesForClasses } from './aiUiInspectorSourceLocator'
import { readDomSourceLocation } from './aiUiInspectorSourceLocator'
import { withInspectorOverlaysHidden, probeTopmostAt } from './aiUiInspectorSurfaces'

export function sourcePathsForSnapshot(snapshot: AiInspectorSnapshot): string[] {
  const refs = snapshot.elements.flatMap((e) => [e.sourceLocation, e.primaryFile, e.surface?.source,
    e.linkedTarget?.file, e.workflowNode?.inspectorSourceFile, ...(e.sceneEntity?.relatedFiles || []), ...(e.cssSources || []),
    ...findCssSourcesForClasses(e.classes, 1000, true)])
  refs.push(...(snapshot.workshopContext?.relatedFiles || []))
  // A blank panel background may have no interactive control. Use its real JSX owner,
  // rather than guessing a filename or returning an empty bundle.
  if (!snapshot.elements.length && typeof document !== 'undefined') {
    const { left, top, width, height } = snapshot.rect
    const target = withInspectorOverlaysHidden(() => probeTopmostAt(left + width / 2, top + height / 2))
    refs.push(readDomSourceLocation(target)?.ref)
    if (target) refs.push(...findCssSourcesForClasses(Array.from(target.classList), 1000, true))
  }
  return [...new Set(refs.flatMap((ref) => {
    const match = ref?.replace(/\\/g, '/').match(/src\/(?:renderer\/src|shared|main|preload)\/[^\s:()]+\.(?:tsx?|jsx?|mjs|css)/)
    return match ? [match[0]] : []
  }))]
}

export async function exportSnapshotCode(snapshot: AiInspectorSnapshot) {
  if (!window.api?.aiCode) throw new Error('Hãy khởi động lại app để nạp tính năng xuất/nhập mã nguồn.')
  return window.api.aiCode.export(sourcePathsForSnapshot(snapshot), formatAiInspectorMarkdown(snapshot))
}
