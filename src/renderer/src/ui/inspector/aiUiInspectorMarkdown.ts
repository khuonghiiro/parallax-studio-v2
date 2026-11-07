import {
  formatFriendlyDialogLabel,
  formatFriendlyRegionLabel
} from './aiUiInspectorWorkshopContext'
import type { AiInspectorSnapshot } from './aiUiInspectorScanner'

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

  if (workshopContext) {
    lines.push(`#### 🛠️ Ngữ cảnh ${workshopContext.workshopTitle}:`)
    lines.push(
      `- **Mẫu đang mở:** "${workshopContext.modelName}" (\`${workshopContext.modelId}\`)${workshopContext.canvasSize ? ` · Khung: ${workshopContext.canvasSize}` : ''}`
    )
    if (workshopContext.primaryModeLabel || workshopContext.activeTabLabel) {
      lines.push(
        `- **Chế độ / Tab:** ${workshopContext.primaryModeLabel || ''} · Tab: **${workshopContext.activeTabLabel || ''}** (${workshopContext.totalLayers ?? 0} bộ phận, ${workshopContext.totalBones ?? 0} xương)`
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

  if (elements.length === 0) {
    lines.push('*Không phát hiện phần tử tương tác nào trong vùng quét này.*')
  } else {
    lines.push(`#### 🧩 Thành phần giao diện được chọn (${elements.length}):`)
    elements.forEach((item, idx) => {
      const label = item.text ? `"${item.text}"` : item.title ? `[${item.title}]` : 'Phần tử'
      const tagDesc = `<${item.tagName}${item.id ? ` id="${item.id}"` : ''}>`
      lines.push(`${idx + 1}. **${label}** (${item.kindLabel || 'Thành phần'}) — \`${tagDesc}\``)

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
        lines.push(`   - 📂 **File nguồn:** \`${item.primaryFile}\``)
      }
      if (item.primaryHandler) {
        lines.push(`   - ⚡ **Hàm xử lý:** \`${item.primaryHandler}\``)
      }
      if (item.componentChain.length > 0) {
        const chainStr = item.componentChain
          .slice(0, 4)
          .map((c) => `<${c.componentName}>`)
          .join(' ➔ ')
        lines.push(`   - 🧱 **Cây Component:** ${chainStr}`)
      }
      if (item.title && item.title !== item.text) {
        lines.push(`   - 💡 **Tooltip / Title:** "${item.title}"`)
      }
      if (item.classes.length > 0) {
        lines.push(`   - 🎨 **CSS Classes:** \`${item.classes.slice(0, 5).join(' ')}\``)
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
