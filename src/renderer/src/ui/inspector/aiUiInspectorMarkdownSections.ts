import type { AiWorkshopContext } from './aiUiInspectorWorkshopContext'
import type { ScannedElementContext } from './aiUiInspectorScanner'

/**
 * Các khối Markdown chi tiết của báo cáo AI UI Inspector (tâm điểm, xưởng, từng phần tử).
 * Điều phối & bảng "Mở ngay" nằm ở `aiUiInspectorMarkdown.ts`.
 */

const code = (s: string): string => `\`${s}\``
const codeList = (list: string[]): string => list.map(code).join(', ')

function shortFileRef(fileInfo: string | null | undefined): string | null {
  if (!fileInfo) return null
  const parts = fileInfo.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || fileInfo
}

export function formatControlSpecsLine(item: ScannedElementContext): string | null {
  const cd = item.controlDetails
  if (!cd) return null
  const parts: string[] = []
  if (cd.fieldLabel) parts.push(`Nhãn: "${cd.fieldLabel}${cd.axis ? ` (${cd.axis})` : ''}"`)
  else if (cd.axis) parts.push(`Trục: ${cd.axis}`)
  if (cd.currentValue) parts.push(`Giá trị: ${code(cd.currentValue)}`)
  if (cd.rangeSpec) parts.push(`Phạm vi: ${code(cd.rangeSpec)}`)
  if (cd.propBinding) parts.push(`Store PropRef: ${code(cd.propBinding)}`)
  if (cd.optionsSummary) parts.push(`Tuỳ chọn: [${cd.optionsSummary}]`)
  if (cd.primitiveName) {
    const pFile = cd.primitiveFile ? ` (${code(cd.primitiveFile)})` : ''
    parts.push(`UI Control gốc: ${code(`<${cd.primitiveName}>`)}${pFile}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatFocusHeadline(focusItem: ScannedElementContext): string {
  const isV2Card =
    focusItem.classes.includes('wf-v2-card') || (Boolean(focusItem.workflowNode) && focusItem.tagName === 'div')
  const focusTitle = focusItem.text
    ? `"${focusItem.text}"`
    : focusItem.controlDetails?.fieldLabel
      ? `"${focusItem.controlDetails.fieldLabel}"`
      : focusItem.title
        ? `[${focusItem.title}]`
        : `<${focusItem.tagName}>`
  const sel = focusItem.controlDetails?.targetSelector || (focusItem.id ? `#${focusItem.id}` : focusItem.tagName)
  if (isV2Card && focusItem.workflowNode) {
    const wn = focusItem.workflowNode
    return `- **Thẻ Node trọng tâm:** **"${wn.title}"** (${wn.levelLabel} · ${code(`id="${wn.nodeId}"`)}) — Selector: ${code(sel)}`
  }
  return `- **Control trọng tâm:** **${focusTitle}** (${focusItem.kindLabel}) — Selector: ${code(sel)}`
}

function formatFocusSceneEntity(focusItem: ScannedElementContext, lines: string[]): void {
  const se = focusItem.sceneEntity
  if (!se) return
  lines.push(
    `- **Đối tượng Cảnh / Khung BBox đang chọn:** **${se.displayName}** (${code(`id="${se.layerId}"`)} · ${se.bboxRoleLabel} · ${se.isFocused ? '🎯 Đang Focus BBox' : 'Trong vùng quét'})`
  )
  lines.push(`- **Tọa độ & Biến đổi 3D/2.5D:** ${se.coordsSummary}`)
  if (se.clusterSummary) {
    const cs = se.clusterSummary
    const scope = se.bboxScope === 'cluster' ? 'Toàn bộ cụm 2.5D' : `Riêng mảnh "${cs.partShortName}"`
    lines.push(
      `- **Thông tin Cụm 2.5D:** Cụm "${cs.clusterName}" (${code(`instanceId="${cs.instanceId}"`)}, ${cs.memberCount} mảnh · Phạm vi BBox: ${scope})`
    )
  }
  if (se.connectedLogicSummaries && se.connectedLogicSummaries.length > 0) {
    lines.push(`- **Các Node Logic Workflow V2 đang gắn:** ${se.connectedLogicSummaries.join(', ')}`)
  }
  if (se.relatedFiles.length > 0) {
    lines.push(`- **File xử lý Khung nhìn / BBox liên quan:** ${codeList(se.relatedFiles)}`)
  }
}

function formatFocusDetails(focusItem: ScannedElementContext, lines: string[]): void {
  lines.push(formatFocusHeadline(focusItem))
  if (focusItem.sourceLocation) lines.push(`- **📍 Dòng JSX render chính xác:** ${code(focusItem.sourceLocation)}`)
  if (focusItem.primaryFile) {
    const owner = focusItem.ownerComponentName ? ` (trong component ${code(`<${focusItem.ownerComponentName}>`)})` : ''
    lines.push(`- **File & dòng logic cần sửa:** ${code(focusItem.primaryFile)}${owner}`)
  }
  if (focusItem.cssSources?.length) lines.push(`- **CSS định nghĩa giao diện:** ${codeList(focusItem.cssSources)}`)
  formatFocusSceneEntity(focusItem, lines)
  if (focusItem.workflowNode) {
    const wn = focusItem.workflowNode
    lines.push(
      `- **Node Workflow V2 đang thao tác:** **"${wn.title}"** (${code(`id="${wn.nodeId}"`)} · ${wn.levelLabel} · Thời gian: ${code(wn.timeRange)})`
    )
    lines.push(`- **Đối tượng đích của Node:** ${wn.targetSummary} · Tóm tắt: ${wn.summaryText}`)
    lines.push(
      `- **File Inspector & Engine của Node:** UI: ${code(wn.inspectorSourceFile)} · Engine: ${code(wn.engineSourceFile)}`
    )
  }
  const specsLine = formatControlSpecsLine(focusItem)
  if (specsLine) lines.push(`- **Thông số & trạng thái Control:** ${specsLine}`)
  if (focusItem.primaryHandler) lines.push(`- **Hàm xử lý chính:** ${code(focusItem.primaryHandler)}`)
  if (focusItem.linkedTarget) {
    const lt = focusItem.linkedTarget
    const subStr = lt.subFiles?.length ? ` · File con: ${codeList(lt.subFiles)}` : ''
    lines.push(
      `- **Hộp thoại / Module đích liên kết:** ${code(`<${lt.name}>`)} tại ${code(lt.file)} (${lt.description})${subStr}`
    )
  }
}

/** 1. Khối Tâm điểm sửa code (AI Focus Target). */
export function formatFocusSection(
  focusItem: ScannedElementContext | undefined,
  workshopContext: AiWorkshopContext | null
): string[] {
  if (!focusItem && !workshopContext?.relatedFiles?.length) return []
  const lines = ['#### 🎯 Tâm điểm cần sửa (AI Focus Target):']
  if (focusItem) formatFocusDetails(focusItem, lines)
  if (workshopContext?.relatedFiles?.length) {
    lines.push(`- **Các file của Hộp thoại / Xưởng đang mở:** ${codeList(workshopContext.relatedFiles)}`)
  }
  lines.push('')
  return lines
}

/** 2. Ngữ cảnh Xưởng / Hộp thoại đang mở. */
export function formatWorkshopSection(wc: AiWorkshopContext | null): string[] {
  if (!wc) return []
  const lines = [`#### 🛠️ Ngữ cảnh ${wc.workshopTitle}:`]
  lines.push(
    `- **Mẫu / Đối tượng đang mở:** "${wc.modelName}" (${code(wc.modelId)})${wc.canvasSize ? ` · Khung: ${wc.canvasSize}` : ''}`
  )
  if (wc.primaryModeLabel || wc.activeTabLabel) {
    const countsStr =
      typeof wc.totalLayers === 'number' ? ` (${wc.totalLayers} bộ phận, ${wc.totalBones ?? 0} xương)` : ''
    lines.push(
      `- **Chế độ / Tab:** ${wc.primaryModeLabel || ''}${wc.activeTabLabel ? ` · Tab: **${wc.activeTabLabel}**` : ''}${countsStr}`
    )
  }
  if (wc.relatedFiles?.length) lines.push(`- **File mã nguồn Hộp thoại / Xưởng:** ${codeList(wc.relatedFiles)}`)
  if (wc.scannedParts.length > 0) {
    lines.push(`- **Các bộ phận 2.5D trong vùng quét (${wc.scannedParts.length}):**`)
    for (const p of wc.scannedParts) {
      const boneStr = p.boneName
        ? `Gắn xương "${p.boneName}" (${code(p.boneId || '')}, ${p.bindingMode === 'soft' ? 'Uốn mềm Mesh' : 'Khớp cứng'})`
        : 'Chưa gắn xương'
      lines.push(
        `  * ${p.roleIcon} **#${p.orderIndex} "${p.name}"** (${code(p.id)} · ${p.roleLabel}) — Tọa độ: ${code(`(${p.x}, ${p.y})`)}, Độ sâu ${code(`Z: ${p.z}px`)}, Scale: ${code(String(p.scale))}, Xoay: ${code(`${p.rotation}°`)} | ${boneStr}`
      )
    }
  }
  if (wc.scannedBones.length > 0) {
    lines.push(`- **Khớp xương 2.5D liên quan (${wc.scannedBones.length}):**`)
    for (const b of wc.scannedBones) {
      lines.push(
        `  * 🦴 **"${b.name}"** (${code(b.id)}) — Gốc ${code(`(${b.x}, ${b.y})`)}, Dài ${code(`${b.length}px`)}, Góc ${code(`${b.angle}°`)}, Cha: ${code(b.parentName || 'Gốc')} | Bộ phận gắn: ${b.boundLayerNames.join(', ') || 'Chưa gắn'}`
      )
    }
  }
  for (const l of wc.extraSummaryLines || []) lines.push(`- ${l}`)
  lines.push('')
  return lines
}

function elementTagDescriptor(item: ScannedElementContext): string {
  if (item.id || item.classes.length === 0) return `<${item.tagName}${item.id ? ` id="${item.id}"` : ''}>`
  const keyClass =
    item.classes.find(
      (c) =>
        c.startsWith('wf-v2-') ||
        c.startsWith('lw-') ||
        c.startsWith('btn-') ||
        c.startsWith('tb-') ||
        c.startsWith('custom-select-')
    ) || item.classes[0]
  return keyClass ? `<${item.tagName} class="${keyClass}">` : `<${item.tagName}>`
}

function formatElementEntityLines(item: ScannedElementContext, lines: string[]): void {
  if (item.sceneEntity) {
    const se = item.sceneEntity
    lines.push(
      `   - 🎬 **Chi tiết Layer / Cụm 2.5D:** ${code(`id="${se.layerId}"`)} · ${se.bboxRoleLabel} · ${se.isFocused ? '🎯 Đang Focus BBox' : 'Trong vùng quét'} · ${se.coordsSummary}`
    )
    if (se.clusterSummary) {
      const mode = se.bboxScope === 'cluster' ? 'Toàn cụm' : `Mảnh "${se.clusterSummary.partShortName}"`
      lines.push(
        `   - 🧩 **Thuộc Cụm 2.5D:** "${se.clusterSummary.clusterName}" (${code(`instanceId="${se.clusterSummary.instanceId}"`)}, ${se.clusterSummary.memberCount} mảnh · Chế độ BBox: ${mode})`
      )
    }
  }
  if (item.workflowNode) {
    const wn = item.workflowNode
    lines.push(
      `   - 🔗 **Node Workflow V2:** "${wn.title}" (${code(`id="${wn.nodeId}"`)} · ${wn.levelLabel}) · Đích: ${wn.targetSummary} · UI: ${code(wn.inspectorSourceFile)} · Engine: ${code(wn.engineSourceFile)}`
    )
  }
  if (item.part25D) {
    const p = item.part25D
    const bone = p.boneName ? `Xương: "${p.boneName}" (${p.bindingMode})` : 'Chưa gắn xương'
    lines.push(
      `   - 🧩 **Chi tiết Bộ phận 2.5D:** ${code(`id="${p.id}"`)} · Vai trò: ${p.roleLabel} · Vị trí: ${code(`(${p.x}, ${p.y}, Z:${p.z})`)} · Scale: ${code(String(p.scale))} · ${bone}`
    )
  }
  if (item.bone25D) {
    const b = item.bone25D
    lines.push(
      `   - 🦴 **Chi tiết Xương 2.5D:** ${code(`id="${b.id}"`)} · Dài: ${code(`${b.length}px`)} · Góc: ${code(`${b.angle}°`)} · Cha: ${code(b.parentName || 'Gốc')}`
    )
  }
}

function formatElementSourceLines(item: ScannedElementContext, idx: number, lines: string[]): void {
  if (item.sourceLocation) lines.push(`   - 📍 **JSX render:** ${code(item.sourceLocation)}`)
  if (item.primaryFile) {
    const ownerNote = item.ownerComponentName ? ` (trong ${code(`<${item.ownerComponentName}>`)})` : ''
    lines.push(`   - 📂 **File nguồn:** ${code(item.primaryFile)}${ownerNote}`)
  }
  if (item.surface && item.surface.kind !== 'main' && idx > 0) {
    lines.push(`   - 🪟 **Bề mặt:** ${item.surface.chain.join(' › ')}`)
  }
  const specsLine = formatControlSpecsLine(item)
  if (specsLine) lines.push(`   - 🎛️ **Thông số Control:** ${specsLine}`)
  if (item.primaryHandler) lines.push(`   - ⚡ **Hàm xử lý:** ${code(item.primaryHandler)}`)
  if (item.linkedTarget) {
    const lt = item.linkedTarget
    lines.push(`   - 🪟 **Hộp thoại / Module đích:** ${code(`<${lt.name}>`)} (${code(lt.file)}) — ${lt.description}`)
  }
  if (item.componentChain.length > 0) {
    const chainStr = item.componentChain
      .slice(0, 5)
      .map((c) => {
        const sf = shortFileRef(c.fileInfo)
        return sf ? `<${c.componentName}> (${code(sf)})` : `<${c.componentName}>`
      })
      .join(' ➔ ')
    lines.push(`   - 🧱 **Cây Component:** ${chainStr}`)
  }
}

function formatElementStyleLines(item: ScannedElementContext, rawHeading: string, lines: string[]): void {
  if (item.title && item.title !== rawHeading) lines.push(`   - 💡 **Tooltip / Title:** "${item.title}"`)
  if (item.classes.length > 0 || item.controlDetails?.targetSelector) {
    const selPart = item.controlDetails?.targetSelector ? `Selector: ${code(item.controlDetails.targetSelector)} · ` : ''
    const clsPart = item.classes.length > 0 ? `Classes: ${code(item.classes.slice(0, 5).join(' '))}` : ''
    lines.push(`   - 🎨 **CSS / Định danh:** ${selPart}${clsPart}`)
  }
  if (item.cssSources?.length) lines.push(`   - 🖌️ **File CSS:** ${codeList(item.cssSources)}`)
  if (item.domPath) lines.push(`   - 🧭 **DOM path:** ${code(item.domPath)}`)
}

/** 3. Danh sách thành phần giao diện được chọn. */
export function formatElementsSection(elements: ScannedElementContext[]): string[] {
  if (elements.length === 0) return ['*Không phát hiện phần tử tương tác nào trong vùng quét này.*']
  const lines = [`#### 🧩 Thành phần giao diện được chọn (${elements.length}):`]
  elements.forEach((item, idx) => {
    const rawHeading = item.text || item.controlDetails?.fieldLabel || item.title || 'Phần tử'
    const label = item.text ? `"${item.text}"` : `[${rawHeading}]`
    const focusBadge = idx === 0 && elements.length > 1 ? ' · 🎯 **Tâm điểm**' : ''
    lines.push(
      `${idx + 1}. **${label}** (${item.kindLabel || 'Thành phần'}) — ${code(elementTagDescriptor(item))}${focusBadge}`
    )
    formatElementEntityLines(item, lines)
    formatElementSourceLines(item, idx, lines)
    formatElementStyleLines(item, rawHeading, lines)
    lines.push('')
  })
  return lines
}
