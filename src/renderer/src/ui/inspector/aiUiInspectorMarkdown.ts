import {
  formatFriendlyDialogLabel,
  formatFriendlyRegionLabel
} from './aiUiInspectorWorkshopContext'
import type { AiInspectorSnapshot, ScannedElementContext } from './aiUiInspectorScanner'

function shortFileRef(fileInfo: string | null | undefined): string | null {
  if (!fileInfo) return null
  const parts = fileInfo.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || fileInfo
}

function formatControlSpecsLine(item: ScannedElementContext): string | null {
  const cd = item.controlDetails
  if (!cd) return null
  const parts: string[] = []
  if (cd.fieldLabel) {
    parts.push(`Nhãn: "${cd.fieldLabel}${cd.axis ? ` (${cd.axis})` : ''}"`)
  } else if (cd.axis) {
    parts.push(`Trục: ${cd.axis}`)
  }
  if (cd.currentValue) {
    parts.push(`Giá trị: \`${cd.currentValue}\``)
  }
  if (cd.rangeSpec) {
    parts.push(`Phạm vi: \`${cd.rangeSpec}\``)
  }
  if (cd.propBinding) {
    parts.push(`Store PropRef: \`${cd.propBinding}\``)
  }
  if (cd.optionsSummary) {
    parts.push(`Tuỳ chọn: [${cd.optionsSummary}]`)
  }
  if (cd.primitiveName) {
    const pFile = cd.primitiveFile ? ` (\`${cd.primitiveFile}\`)` : ''
    parts.push(`UI Control gốc: \`<${cd.primitiveName}>\`${pFile}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Biên soạn báo cáo Markdown chuyên biệt để lưu vào Clipboard gửi cho AI đọc code tức thì.
 */
export function formatAiInspectorMarkdown(snapshot: AiInspectorSnapshot): string {
  const { rect, elements, primaryRegion, workshopContext, appState } = snapshot
  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

  const lines: string[] = []
  lines.push('### 🎯 NGỮ CẢNH GIAO DIỆN (AI UI INSPECTOR)')
  lines.push(
    `> 📍 **Vùng quét:** ${rect.width} × ${rect.height}px tại (${rect.left}, ${rect.top}) | Khu vực MCP: \`${primaryRegion}\` (${formatFriendlyRegionLabel(primaryRegion)})`
  )
  lines.push(`> 🕒 **Thời điểm:** ${timeStr} | Giao diện: \`${appState.theme}\``)
  lines.push('')

  // 1. Khối Tâm điểm sửa code (AI Focus Target) — giúp AI nhảy thẳng vào đúng file và logic cần sửa
  const focusItem = elements[0]
  if (focusItem || workshopContext?.relatedFiles?.length) {
    lines.push('#### 🎯 Tâm điểm cần sửa (AI Focus Target):')
    if (focusItem) {
      const focusTitle = focusItem.text
        ? `"${focusItem.text}"`
        : focusItem.controlDetails?.fieldLabel
          ? `"${focusItem.controlDetails.fieldLabel}"`
          : focusItem.title
            ? `[${focusItem.title}]`
            : `<${focusItem.tagName}>`
      const sel =
        focusItem.controlDetails?.targetSelector ||
        (focusItem.id ? `#${focusItem.id}` : focusItem.tagName)
      lines.push(
        `- **Control trọng tâm:** **${focusTitle}** (${focusItem.kindLabel}) — Selector: \`${sel}\``
      )
      if (focusItem.primaryFile) {
        const ownerSuffix = focusItem.ownerComponentName
          ? ` (trong component \`<${focusItem.ownerComponentName}>\`)`
          : ''
        lines.push(`- **File & dòng logic cần sửa:** \`${focusItem.primaryFile}\`${ownerSuffix}`)
      }
      if (focusItem.sceneEntity) {
        const se = focusItem.sceneEntity
        lines.push(
          `- **Đối tượng Cảnh / Khung BBox đang chọn:** **${se.displayName}** (\`id="${se.layerId}"\` · ${se.bboxRoleLabel} · ${se.isFocused ? '🎯 Đang Focus BBox' : 'Trong vùng quét'})`
        )
        lines.push(`- **Tọa độ & Biến đổi 3D/2.5D:** ${se.coordsSummary}`)
        if (se.clusterSummary) {
          const cs = se.clusterSummary
          lines.push(
            `- **Thông tin Cụm 2.5D:** Cụm "${cs.clusterName}" (\`instanceId="${cs.instanceId}"\`, ${cs.memberCount} mảnh · Phạm vi BBox: ${se.bboxScope === 'cluster' ? 'Toàn bộ cụm 2.5D' : `Riêng mảnh "${cs.partShortName}"`})`
          )
        }
        if (se.connectedLogicSummaries && se.connectedLogicSummaries.length > 0) {
          lines.push(
            `- **Các Node Logic Workflow V2 đang gắn:** ${se.connectedLogicSummaries.join(', ')}`
          )
        }
        if (se.relatedFiles.length > 0) {
          lines.push(
            `- **File xử lý Khung nhìn / BBox liên quan:** ${se.relatedFiles.map((f) => `\`${f}\``).join(', ')}`
          )
        }
      }
      if (focusItem.workflowNode) {
        const wn = focusItem.workflowNode
        lines.push(
          `- **Node Workflow V2 đang thao tác:** **"${wn.title}"** (\`id="${wn.nodeId}"\` · ${wn.levelLabel} · Thời gian: \`${wn.timeRange}\`)`
        )
        lines.push(`- **Đối tượng đích của Node:** ${wn.targetSummary} · Tóm tắt: ${wn.summaryText}`)
        lines.push(
          `- **File Inspector & Engine của Node:** UI: \`${wn.inspectorSourceFile}\` · Engine: \`${wn.engineSourceFile}\``
        )
      }
      const specsLine = formatControlSpecsLine(focusItem)
      if (specsLine) {
        lines.push(`- **Thông số & trạng thái Control:** ${specsLine}`)
      }
      if (focusItem.primaryHandler) {
        lines.push(`- **Hàm xử lý chính:** \`${focusItem.primaryHandler}\``)
      }
      if (focusItem.linkedTarget) {
        const lt = focusItem.linkedTarget
        const subStr = lt.subFiles?.length
          ? ` · File con: ${lt.subFiles.map((f) => `\`${f}\``).join(', ')}`
          : ''
        lines.push(
          `- **Hộp thoại / Module đích liên kết:** \`<${lt.name}>\` tại \`${lt.file}\` (${lt.description})${subStr}`
        )
      }
    }
    if (workshopContext?.relatedFiles?.length) {
      lines.push(
        `- **Các file của Hộp thoại / Xưởng đang mở:** ${workshopContext.relatedFiles.map((f) => `\`${f}\``).join(', ')}`
      )
    }
    lines.push('')
  }

  // 2. Ngữ cảnh Xưởng / Hộp thoại đang mở
  if (workshopContext) {
    lines.push(`#### 🛠️ Ngữ cảnh ${workshopContext.workshopTitle}:`)
    lines.push(
      `- **Mẫu / Đối tượng đang mở:** "${workshopContext.modelName}" (\`${workshopContext.modelId}\`)${workshopContext.canvasSize ? ` · Khung: ${workshopContext.canvasSize}` : ''}`
    )
    if (workshopContext.primaryModeLabel || workshopContext.activeTabLabel) {
      const countsStr =
        typeof workshopContext.totalLayers === 'number'
          ? ` (${workshopContext.totalLayers} bộ phận, ${workshopContext.totalBones ?? 0} xương)`
          : ''
      lines.push(
        `- **Chế độ / Tab:** ${workshopContext.primaryModeLabel || ''}${workshopContext.activeTabLabel ? ` · Tab: **${workshopContext.activeTabLabel}**` : ''}${countsStr}`
      )
    }
    if (workshopContext.relatedFiles?.length) {
      lines.push(
        `- **File mã nguồn Hộp thoại / Xưởng:** ${workshopContext.relatedFiles.map((f) => `\`${f}\``).join(', ')}`
      )
    }
    if (workshopContext.scannedParts.length > 0) {
      lines.push(
        `- **Các bộ phận 2.5D trong vùng quét (${workshopContext.scannedParts.length}):**`
      )
      for (const p of workshopContext.scannedParts) {
        const boneStr = p.boneName
          ? `Gắn xương "${p.boneName}" (\`${p.boneId}\`, ${p.bindingMode === 'soft' ? 'Uốn mềm Mesh' : 'Khớp cứng'})`
          : 'Chưa gắn xương'
        lines.push(
          `  * ${p.roleIcon} **#${p.orderIndex} "${p.name}"** (\`${p.id}\` · ${p.roleLabel}) — Tọa độ: \`(${p.x}, ${p.y})\`, Độ sâu \`Z: ${p.z}px\`, Scale: \`${p.scale}\`, Xoay: \`${p.rotation}°\` | ${boneStr}`
        )
      }
    }
    if (workshopContext.scannedBones.length > 0) {
      lines.push(`- **Khớp xương 2.5D liên quan (${workshopContext.scannedBones.length}):**`)
      for (const b of workshopContext.scannedBones) {
        lines.push(
          `  * 🦴 **"${b.name}"** (\`${b.id}\`) — Gốc \`(${b.x}, ${b.y})\`, Dài \`${b.length}px\`, Góc \`${b.angle}°\`, Cha: \`${b.parentName || 'Gốc'}\` | Bộ phận gắn: ${b.boundLayerNames.join(', ') || 'Chưa gắn'}`
        )
      }
    }
    if (workshopContext.extraSummaryLines?.length) {
      for (const l of workshopContext.extraSummaryLines) {
        lines.push(`- ${l}`)
      }
    }
    lines.push('')
  }

  // 3. Danh sách thành phần giao diện được chọn
  if (elements.length === 0) {
    lines.push('*Không phát hiện phần tử tương tác nào trong vùng quét này.*')
  } else {
    lines.push(`#### 🧩 Thành phần giao diện được chọn (${elements.length}):`)
    elements.forEach((item, idx) => {
      const rawHeading = item.text || item.controlDetails?.fieldLabel || item.title || 'Phần tử'
      const label = item.text ? `"${item.text}"` : `[${rawHeading}]`
      const tagDesc = `<${item.tagName}${item.id ? ` id="${item.id}"` : ''}>`
      const focusBadge = idx === 0 && elements.length > 1 ? ' · 🎯 **Tâm điểm**' : ''
      lines.push(
        `${idx + 1}. **${label}** (${item.kindLabel || 'Thành phần'}) — \`${tagDesc}\`${focusBadge}`
      )

      if (item.sceneEntity) {
        const se = item.sceneEntity
        lines.push(
          `   - 🎬 **Chi tiết Layer / Cụm 2.5D:** \`id="${se.layerId}"\` · ${se.bboxRoleLabel} · ${se.isFocused ? '🎯 Đang Focus BBox' : 'Trong vùng quét'} · ${se.coordsSummary}`
        )
        if (se.clusterSummary) {
          lines.push(
            `   - 🧩 **Thuộc Cụm 2.5D:** "${se.clusterSummary.clusterName}" (\`instanceId="${se.clusterSummary.instanceId}"\`, ${se.clusterSummary.memberCount} mảnh · Chế độ BBox: ${se.bboxScope === 'cluster' ? 'Toàn cụm' : `Mảnh "${se.clusterSummary.partShortName}"`})`
          )
        }
      }
      if (item.workflowNode) {
        const wn = item.workflowNode
        lines.push(
          `   - 🔗 **Node Workflow V2:** "${wn.title}" (\`id="${wn.nodeId}"\` · ${wn.levelLabel}) · Đích: ${wn.targetSummary} · UI: \`${wn.inspectorSourceFile}\` · Engine: \`${wn.engineSourceFile}\``
        )
      }
      if (item.part25D) {
        const p = item.part25D
        lines.push(
          `   - 🧩 **Chi tiết Bộ phận 2.5D:** \`id="${p.id}"\` · Vai trò: ${p.roleLabel} · Vị trí: \`(${p.x}, ${p.y}, Z:${p.z})\` · Scale: \`${p.scale}\` · ${p.boneName ? `Xương: "${p.boneName}" (${p.bindingMode})` : 'Chưa gắn xương'}`
        )
      }
      if (item.bone25D) {
        const b = item.bone25D
        lines.push(
          `   - 🦴 **Chi tiết Xương 2.5D:** \`id="${b.id}"\` · Dài: \`${b.length}px\` · Góc: \`${b.angle}°\` · Cha: \`${b.parentName || 'Gốc'}\``
        )
      }
      if (item.primaryFile) {
        const ownerNote = item.ownerComponentName ? ` (trong \`<${item.ownerComponentName}>\`)` : ''
        lines.push(`   - 📂 **File nguồn:** \`${item.primaryFile}\`${ownerNote}`)
      }
      const specsLine = formatControlSpecsLine(item)
      if (specsLine) {
        lines.push(`   - 🎛️ **Thông số Control:** ${specsLine}`)
      }
      if (item.primaryHandler) {
        lines.push(`   - ⚡ **Hàm xử lý:** \`${item.primaryHandler}\``)
      }
      if (item.linkedTarget) {
        const lt = item.linkedTarget
        lines.push(
          `   - 🪟 **Hộp thoại / Module đích:** \`<${lt.name}>\` (\`${lt.file}\`) — ${lt.description}`
        )
      }
      if (item.componentChain.length > 0) {
        const chainStr = item.componentChain
          .slice(0, 5)
          .map((c) => {
            const sf = shortFileRef(c.fileInfo)
            return sf ? `<${c.componentName}> (\`${sf}\`)` : `<${c.componentName}>`
          })
          .join(' ➔ ')
        lines.push(`   - 🧱 **Cây Component:** ${chainStr}`)
      }
      if (item.title && item.title !== rawHeading) {
        lines.push(`   - 💡 **Tooltip / Title:** "${item.title}"`)
      }
      if (item.classes.length > 0 || item.controlDetails?.targetSelector) {
        const selPart = item.controlDetails?.targetSelector
          ? `Selector: \`${item.controlDetails.targetSelector}\` · `
          : ''
        const clsPart =
          item.classes.length > 0 ? `Classes: \`${item.classes.slice(0, 5).join(' ')}\`` : ''
        lines.push(`   - 🎨 **CSS / Định danh:** ${selPart}${clsPart}`)
      }
      lines.push('')
    })
  }

  lines.push('#### ⚙️ Trạng thái Studio lúc quét:')
  lines.push(
    `- 🎬 **Cảnh:** ${appState.shotName} (Cảnh ${appState.shotIndex}) | ⏱️ **Playhead:** ${appState.currentTime}s / ${appState.duration}s (${appState.fps}fps) | ${appState.isPlaying ? '▶️ Đang phát' : '⏸️ Đang dừng'}`
  )
  lines.push(
    `- 📌 **Layer đang chọn:** ${
      appState.selectedLayerNames.length > 0
        ? appState.selectedLayerNames.join(', ')
        : 'Chưa chọn layer nào'
    }`
  )
  lines.push(
    `- 💬 **Hộp thoại / Xưởng:** ${appState.activeDialog ? `\`${appState.activeDialog}\` (${formatFriendlyDialogLabel(appState.activeDialog)})` : 'Không có (Màn hình chính)'}`
  )
  lines.push('')
  lines.push('---')
  lines.push('*(Gửi đoạn này cho AI để AI nhảy thẳng vào đúng file và hàm xử lý!)*')

  return lines.join('\n')
}
