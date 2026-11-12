import { useState } from 'react'
import type { AiInspectorSnapshot } from './aiUiInspectorScanner'
import {
  formatFriendlyDialogLabel,
  formatFriendlyRegionLabel
} from './aiUiInspectorWorkshopContext'
import { IconAiScan, IconCheck, IconCopy, IconX } from '../icons'

export interface AiUiInspectorPreviewModalProps {
  snapshot: AiInspectorSnapshot
  report: string
  onClose: () => void
  onCopyMarkdown: (markdown: string) => Promise<boolean>
}

function cleanHandlerLabel(handler: string | null): string | null {
  if (!handler) return null
  return handler
    .replace(/^onClick=\{(.+)\}$/, 'Khi bấm chuột: $1')
    .replace(/^onPointerDown=\{(.+)\}$/, 'Khi nhấn giữ/kéo: $1')
    .replace(/^onChange=\{(.+)\}$/, 'Khi thay đổi giá trị: $1')
}

export function AiUiInspectorPreviewModal({
  snapshot,
  report,
  onClose,
  onCopyMarkdown
}: AiUiInspectorPreviewModalProps) {
  const [viewMode, setViewMode] = useState<'readable' | 'markdown'>('readable')
  const [copied, setCopied] = useState(false)

  const { rect, elements, primaryRegion, workshopContext, appState } = snapshot
  const friendlyRegion = formatFriendlyRegionLabel(primaryRegion)
  const friendlyDialog = formatFriendlyDialogLabel(appState.activeDialog)

  const handleCopy = async () => {
    await onCopyMarkdown(report)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="ai-ui-inspector-preview-backdrop"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="ai-ui-inspector-preview-modal"
        data-mcp-region="ai_inspector_preview"
        data-mcp-dialog
        role="dialog"
        aria-modal="true"
        aria-label="Nội Dung Ngữ Cảnh AI"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-ui-inspector-preview-header">
          <div className="ai-ui-inspector-preview-title">
            <IconAiScan width={16} height={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Nội Dung Ngữ Cảnh AI (Đã lưu Markdown vào Clipboard)</span>
          </div>

          <div className="ai-ui-inspector-preview-header-right">
            <div className="ai-ui-inspector-mode-pills" role="tablist" aria-label="Chế độ xem">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'readable'}
                className={`ai-ui-inspector-mode-pill${viewMode === 'readable' ? ' active' : ''}`}
                onClick={() => setViewMode('readable')}
              >
                Bản đọc dễ hiểu
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'markdown'}
                className={`ai-ui-inspector-mode-pill${viewMode === 'markdown' ? ' active' : ''}`}
                onClick={() => setViewMode('markdown')}
              >
                Mã Markdown gửi AI
              </button>
            </div>

            <button
              type="button"
              className="ai-ui-inspector-arm-close"
              onClick={onClose}
              title="Đóng hộp thoại (Esc)"
              aria-label="Đóng hộp thoại"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        {viewMode === 'markdown' ? (
          <pre className="ai-ui-inspector-preview-body">{report}</pre>
        ) : (
          <div className="ai-ui-inspector-readable-body">
            {/* 1. Tóm tắt tổng quan vùng quét */}
            <div className="ai-ui-summary-strip">
              <div className="ai-ui-summary-item">
                <span className="ai-ui-summary-label">Khu vực giao diện</span>
                <strong className="ai-ui-summary-value">{friendlyRegion}</strong>
                <span className="ai-ui-summary-sub">Mã vùng: {primaryRegion}</span>
              </div>
              <div className="ai-ui-summary-item">
                <span className="ai-ui-summary-label">Khung quét &amp; Phát hiện</span>
                <strong className="ai-ui-summary-value">
                  {elements.length} thành phần giao diện
                </strong>
                <span className="ai-ui-summary-sub">
                  Kích thước: {rect.width} × {rect.height} px tại ({rect.left}, {rect.top})
                </span>
              </div>
              <div className="ai-ui-summary-item">
                <span className="ai-ui-summary-label">Cửa sổ / Xưởng đang mở</span>
                <strong className="ai-ui-summary-value">{friendlyDialog}</strong>
                <span className="ai-ui-summary-sub">
                  Giao diện: {appState.theme === 'light' ? 'Sáng (Light)' : 'Tối (Dark)'}
                </span>
              </div>
            </div>

            {/* 2. Thông tin Xưởng & Hộp thoại đang mở */}
            {workshopContext && (
              <section className="ai-ui-section-card workshop-card">
                <div className="ai-ui-section-header">
                  <span className="ai-ui-section-badge accent">Xưởng / Hộp Thoại Đang Mở</span>
                  <h4>{workshopContext.workshopTitle}</h4>
                  <span className="ai-ui-section-meta">
                    Mẫu: <strong>{workshopContext.modelName}</strong>
                    {workshopContext.canvasSize ? ` (${workshopContext.canvasSize})` : ''}
                  </span>
                </div>

                {(workshopContext.primaryModeLabel || workshopContext.activeTabLabel) && (
                  <div className="ai-ui-workshop-meta-bar">
                    {workshopContext.primaryModeLabel && (
                      <span className="ai-ui-meta-chip">
                        Chế độ: <strong>{workshopContext.primaryModeLabel}</strong>
                      </span>
                    )}
                    {workshopContext.activeTabLabel && (
                      <span className="ai-ui-meta-chip">
                        Tab đang mở: <strong>{workshopContext.activeTabLabel}</strong>
                      </span>
                    )}
                    {typeof workshopContext.totalLayers === 'number' && (
                      <span className="ai-ui-meta-chip">
                        Tổng số bộ phận: <strong>{workshopContext.totalLayers}</strong>
                      </span>
                    )}
                    {typeof workshopContext.totalBones === 'number' && (
                      <span className="ai-ui-meta-chip">
                        Tổng số xương: <strong>{workshopContext.totalBones}</strong>
                      </span>
                    )}
                  </div>
                )}

                {workshopContext.scannedParts.length > 0 && (
                  <div className="ai-ui-subblock">
                    <div className="ai-ui-subblock-title">
                      🧩 Các bộ phận 2.5D trong vùng quét ({workshopContext.scannedParts.length})
                    </div>
                    <div className="ai-ui-parts-grid">
                      {workshopContext.scannedParts.map((part) => (
                        <div
                          key={part.id}
                          className={`ai-ui-part-card${part.isSelected ? ' is-selected' : ''}`}
                        >
                          <div className="ai-ui-part-head">
                            <span className="ai-ui-part-icon">{part.roleIcon}</span>
                            <div className="ai-ui-part-titles">
                              <strong>
                                #{part.orderIndex}. {part.name}
                              </strong>
                              <span>{part.roleLabel}</span>
                            </div>
                            {part.isSelected && (
                              <span className="ai-ui-status-pill selected">Đang chọn</span>
                            )}
                          </div>
                          <div className="ai-ui-part-specs">
                            <span>
                              Chiều sâu Z: <b>{part.z}px</b>
                            </span>
                            <span>
                              Vị trí: <b>({part.x}, {part.y})</b>
                            </span>
                            <span>
                              Tỷ lệ: <b>{part.scale}x</b>
                            </span>
                            <span>
                              Góc xoay: <b>{part.rotation}°</b>
                            </span>
                          </div>
                          <div className="ai-ui-part-foot">
                            {part.boneName ? (
                              <span className="ai-ui-bone-tag bound">
                                🦴 Gắn xương: <b>{part.boneName}</b> (
                                {part.bindingMode === 'soft' ? 'Lưới uốn mềm Mesh' : 'Khớp cứng'})
                              </span>
                            ) : (
                              <span className="ai-ui-bone-tag unbound">Chưa gắn xương</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workshopContext.scannedBones.length > 0 && (
                  <div className="ai-ui-subblock">
                    <div className="ai-ui-subblock-title">
                      🦴 Các khớp xương 2.5D liên quan ({workshopContext.scannedBones.length})
                    </div>
                    <div className="ai-ui-parts-grid">
                      {workshopContext.scannedBones.map((bone) => (
                        <div
                          key={bone.id}
                          className={`ai-ui-part-card bone${bone.isSelected ? ' is-selected' : ''}`}
                        >
                          <div className="ai-ui-part-head">
                            <span className="ai-ui-part-icon">🦴</span>
                            <div className="ai-ui-part-titles">
                              <strong>{bone.name}</strong>
                              <span>Xương cha: {bone.parentName || 'Gốc (Root)'}</span>
                            </div>
                          </div>
                          <div className="ai-ui-part-specs">
                            <span>
                              Độ dài: <b>{bone.length}px</b>
                            </span>
                            <span>
                              Góc: <b>{bone.angle}°</b>
                            </span>
                            <span>
                              Gốc: <b>({bone.x}, {bone.y})</b>
                            </span>
                          </div>
                          {bone.boundLayerNames.length > 0 && (
                            <div className="ai-ui-part-foot">
                              <span className="ai-ui-bone-tag bound">
                                Bộ phận điều khiển: <b>{bone.boundLayerNames.join(', ')}</b>
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {workshopContext.extraSummaryLines && workshopContext.extraSummaryLines.length > 0 && (
                  <ul className="ai-ui-extra-list">
                    {workshopContext.extraSummaryLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}

                {workshopContext.relatedFiles && workshopContext.relatedFiles.length > 0 && (
                  <div className="ai-ui-element-row">
                    <span className="ai-ui-row-label">Tệp nguồn Hộp thoại:</span>
                    <span className="ai-ui-row-code">
                      {workshopContext.relatedFiles.join(' · ')}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* 3. Danh sách thành phần giao diện được quét */}
            <section className="ai-ui-section-card">
              <div className="ai-ui-section-header">
                <span className="ai-ui-section-badge">Thành Phần UI</span>
                <h4>Các nút bấm &amp; phần tử trong vùng quét ({elements.length})</h4>
              </div>

              {elements.length === 0 ? (
                <div className="ai-ui-empty-notice">
                  Không phát hiện phần tử tương tác riêng lẻ nào trong vùng quét này. Hãy kéo khung rộng hơn quanh nút bấm hoặc bộ phận cần soi.
                </div>
              ) : (
                <div className="ai-ui-elements-grid">
                  {elements.map((item, idx) => {
                    const displayTitle =
                      item.text ||
                      item.controlDetails?.fieldLabel ||
                      item.title ||
                      item.part25D?.name ||
                      item.bone25D?.name ||
                      `Phần tử #${idx + 1}`
                    const readableHandler = cleanHandlerLabel(item.primaryHandler)
                    const chainNames = item.componentChain.slice(0, 4).map((c) => c.componentName)

                    return (
                      <div key={`${item.tagName}-${item.id}-${idx}`} className="ai-ui-element-card">
                        <div className="ai-ui-element-card-head">
                          <span className="ai-ui-element-idx">#{idx + 1}</span>
                          <div className="ai-ui-element-main-title">
                            <strong>{displayTitle}</strong>
                            <span className="ai-ui-element-kind">{item.kindLabel}</span>
                            {item.isPrimaryFocus && (
                              <span className="ai-ui-status-pill selected" title="Tâm điểm chọn">Tâm điểm</span>
                            )}
                            {item.isFocused && (
                              <span className="ai-ui-status-pill focus" title="Phần tử đang nhận Focus">Focus</span>
                            )}
                            {item.isActive && (
                              <span className="ai-ui-status-pill active" title="Phần tử đang Active">Active</span>
                            )}
                          </div>
                        </div>

                        <div className="ai-ui-element-rows">
                          {item.sceneEntity && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">Layer / Cụm 2.5D:</span>
                              <span className="ai-ui-row-val">
                                <strong>{item.sceneEntity.displayName}</strong> ·{' '}
                                {item.sceneEntity.isFocused ? '🎯 Đang Focus BBox' : 'Trong khung quét'} ·{' '}
                                {item.sceneEntity.coordsSummary}
                              </span>
                            </div>
                          )}

                          {item.workflowNode && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">Node Workflow V2:</span>
                              <span className="ai-ui-row-val">
                                <strong>{item.workflowNode.title}</strong> ({item.workflowNode.levelLabel}) ·{' '}
                                Đích: {item.workflowNode.targetSummary} · UI:{' '}
                                {item.workflowNode.inspectorSourceFile}
                              </span>
                            </div>
                          )}

                          {item.title && item.title !== displayTitle && (
                            <div className="ai-ui-element-row">
                              <span className="ai-ui-row-label">Mô tả / Chú thích:</span>
                              <span className="ai-ui-row-val">{item.title}</span>
                            </div>
                          )}

                          {item.part25D && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">Thông số 2.5D:</span>
                              <span className="ai-ui-row-val">
                                {item.part25D.roleIcon} {item.part25D.roleLabel} · Z: {item.part25D.z}px · Тоạ độ ({item.part25D.x}, {item.part25D.y}) · Tỷ lệ {item.part25D.scale}x
                              </span>
                            </div>
                          )}

                          {item.sourceLocation && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">JSX render:</span>
                              <span className="ai-ui-row-code">{item.sourceLocation}</span>
                            </div>
                          )}

                          {item.primaryFile && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">Vị trí sửa logic:</span>
                              <span className="ai-ui-row-code">
                                {item.primaryFile}
                                {item.ownerComponentName ? ` (<${item.ownerComponentName}>)` : ''}
                              </span>
                            </div>
                          )}

                          {item.cssSources && item.cssSources.length > 0 && (
                            <div className="ai-ui-element-row">
                              <span className="ai-ui-row-label">File CSS:</span>
                              <span className="ai-ui-row-code">{item.cssSources.join(' · ')}</span>
                            </div>
                          )}

                          {item.surface && item.surface.kind !== 'main' && (
                            <div className="ai-ui-element-row">
                              <span className="ai-ui-row-label">Bề mặt:</span>
                              <span className="ai-ui-row-val">{item.surface.chain.join(' › ')}</span>
                            </div>
                          )}

                          {item.controlDetails &&
                            (item.controlDetails.fieldLabel ||
                              item.controlDetails.currentValue ||
                              item.controlDetails.propBinding) && (
                              <div className="ai-ui-element-row">
                                <span className="ai-ui-row-label">Thông số Control:</span>
                                <span className="ai-ui-row-val">
                                  {[
                                    item.controlDetails.fieldLabel
                                      ? `Nhãn: "${item.controlDetails.fieldLabel}${item.controlDetails.axis ? ` (${item.controlDetails.axis})` : ''}"`
                                      : null,
                                    item.controlDetails.currentValue
                                      ? `Giá trị: ${item.controlDetails.currentValue}`
                                      : null,
                                    item.controlDetails.propBinding
                                      ? `PropRef: ${item.controlDetails.propBinding}`
                                      : null
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              </div>
                            )}

                          {readableHandler && (
                            <div className="ai-ui-element-row">
                              <span className="ai-ui-row-label">Hành động:</span>
                              <span className="ai-ui-row-code">{readableHandler}</span>
                            </div>
                          )}

                          {item.linkedTarget && (
                            <div className="ai-ui-element-row highlight">
                              <span className="ai-ui-row-label">Dialog / Module đích:</span>
                              <span className="ai-ui-row-code">
                                &lt;{item.linkedTarget.name}&gt; — {item.linkedTarget.file}
                              </span>
                            </div>
                          )}

                          {chainNames.length > 0 && (
                            <div className="ai-ui-element-row">
                              <span className="ai-ui-row-label">Vị trí trong App:</span>
                              <span className="ai-ui-row-val">{chainNames.join(' ➔ ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 4. Trạng thái Studio lúc quét */}
            <section className="ai-ui-section-card studio-state-card">
              <div className="ai-ui-section-header">
                <span className="ai-ui-section-badge">Trạng Thái Studio</span>
                <h4>Bối cảnh Dự án lúc quét</h4>
              </div>
              <div className="ai-ui-studio-state-grid">
                <div>
                  <span>Phân cảnh hiện tại:</span>{' '}
                  <strong>
                    {appState.shotName} (Cảnh {appState.shotIndex})
                  </strong>
                </div>
                <div>
                  <span>Thời gian Playhead:</span>{' '}
                  <strong>
                    {appState.currentTime}s / {appState.duration}s ({appState.fps} FPS ·{' '}
                    {appState.isPlaying ? 'Đang phát' : 'Đang dừng'})
                  </strong>
                </div>
                <div>
                  <span>Layer đang chọn ở cảnh:</span>{' '}
                  <strong>
                    {appState.selectedLayerNames.length > 0
                      ? appState.selectedLayerNames.join(', ')
                      : 'Chưa chọn layer nào'}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="ai-ui-inspector-preview-footer">
          <span className="ai-ui-inspector-footer-note">
            💡 Khi dán (Ctrl+V) vào khung chat, AI sẽ nhận định dạng <strong>Markdown kỹ thuật</strong> đầy đủ để sửa code chính xác.
          </span>
          <div className="ai-ui-inspector-footer-actions">
            <button
              type="button"
              className="btn ghost sm"
              onClick={onClose}
            >
              Đóng (Esc)
            </button>
            <button
              type="button"
              className="btn primary sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <IconCheck width={13} height={13} /> Đã sao chép Markdown!
                </>
              ) : (
                <>
                  <IconCopy width={13} height={13} /> Sao chép cho AI (Markdown)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
