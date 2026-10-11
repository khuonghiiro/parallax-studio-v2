import { useState } from 'react'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import { renderTemplateThumbnail } from './templateIcons'
import { IconX, IconCopy } from '../../icons'

interface TemplatePromptModalProps {
  template: LayerAssemblyTemplate | null
  onClose: () => void
  onUseTemplate: (template: LayerAssemblyTemplate) => void
}

type ModalTab = 'prompt' | 'slots' | 'guide'

function PromptTabContent({ template, copied, onCopy }: {
  template: LayerAssemblyTemplate
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="tpm-tab-content">
      <div className="tpm-alert-banner">
        <span>💡 <strong>Mẹo Prompt AI & Đạo cụ Hoá trang:</strong> Sao chép prompt bên dưới và gửi kèm ảnh nhân vật mẫu cho AI (Flux, Midjourney v6, DALL-E 3, Recraft...) để tạo ảnh atlas chia ô. Khuôn mặt mộc được tách biệt hoàn toàn với mũ, kính, râu giả, mặt nạ để dễ dàng hoá trang đóng phim bằng cách bật/tắt layer.</span>
      </div>
      <div className="tpm-code-container">
        <div className="tpm-code-header">
          <span className="tpm-code-lang">PROMPT CHUẨN ATLAS SPRITE (TIẾNG ANH)</span>
          <button
            type="button"
            className={`btn sm ${copied ? 'success' : 'primary'}`}
            onClick={onCopy}
            title="Sao chép toàn bộ prompt vào clipboard"
          >
            {copied ? '✓ Đã sao chép!' : <><IconCopy width={14} height={14} /> Sao chép Prompt</>}
          </button>
        </div>
        <pre className="tpm-code-block">
          <code>{template.promptGuide.systemPrompt}</code>
        </pre>
      </div>
    </div>
  )
}

function SlotsTabContent({ template }: { template: LayerAssemblyTemplate }) {
  return (
    <div className="tpm-tab-content">
      <div className="tpm-table-wrap">
        <table className="tpm-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Ô #</th>
              <th>Tên bộ phận (Tiếng Việt)</th>
              <th>Role (EN)</th>
              <th>Khớp xương</th>
              <th>Chi tiết yêu cầu</th>
            </tr>
          </thead>
          <tbody>
            {template.slots.map((slot, idx) => (
              <tr key={slot.id}>
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                  {slot.atlasCell || idx + 1}
                </td>
                <td>
                  <strong>{slot.name}</strong>
                  {slot.suggestedAsset && (
                    <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>
                      Có sẵn: {slot.suggestedAsset.startsWith('data:') ? 'Ảnh vector trong suốt' : slot.suggestedAsset}
                    </div>
                  )}
                </td>
                <td><code>{slot.role}</code></td>
                <td>
                  <span className="tpm-bone-tag">{slot.boneId || 'Vật lý (Motion)'}</span>
                </td>
                <td style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {slot.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuideTabContent({ template }: { template: LayerAssemblyTemplate }) {
  return (
    <div className="tpm-tab-content tpm-guide-body">
      <div className="tpm-guide-step">
        <div className="tpm-step-num">1</div>
        <div>
          <h4>Tạo ảnh bộ phận bằng AI</h4>
          <p>Dán prompt atlas vào công cụ tạo ảnh AI. Luôn yêu cầu phông nền màu phẳng (chroma-key như <code>#00FF00</code> hoặc <code>#FF00FF</code>) để tách nền sạch sẽ.</p>
        </div>
      </div>
      <div className="tpm-guide-step">
        <div className="tpm-step-num">2</div>
        <div>
          <h4>Quy chuẩn chồng lấp khớp (Joint Overlaps)</h4>
          <p>Mỗi đầu khớp nối (khuỷu tay, đầu gối, cổ chân, cổ áo) cần được vẽ kéo dài thêm 10-15% bo tròn kín. Khi xoay xương trong hoạt ảnh 2.5D, khớp sẽ không bị rỗng hoặc lộ viền đen.</p>
        </div>
      </div>
      <div className="tpm-guide-step">
        <div className="tpm-step-num">3</div>
        <div>
          <h4>Tách nền & Nhập vào Xưởng Lắp Ráp Layer</h4>
          <p>{template.promptGuide.userGuide}</p>
        </div>
      </div>
      <div className="tpm-guide-step">
        <div className="tpm-step-num">4</div>
        <div>
          <h4>Đạo cụ đóng phim & Hoá trang đa năng (Modular Disguise & Film Props)</h4>
          <p>
            Đối với nhân vật người, các chi tiết đầu (Mặt mộc, Mũ, Kính mắt, Râu giả, Mặt nạ) và chân tay (Bàn tay, Bàn chân) được tách thành từng layer độc lập. Giống như đạo cụ trên phim trường, bạn có thể bật/tắt (ẩn/hiện) layer để biến hoá nhân vật thành nhiều vai diễn khác nhau (cải trang đeo kính, mang mặt nạ bí ẩn, gắn râu quai nón, cầm kiếm hoặc vali) mà không cần vẽ lại từ đầu hay tạo lại bộ khung xương.
          </p>
        </div>
      </div>
    </div>
  )
}

export function TemplatePromptModal({
  template,
  onClose,
  onUseTemplate
}: TemplatePromptModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('prompt')
  const [copied, setCopied] = useState(false)

  if (!template) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.promptGuide.systemPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // fallback
    }
  }

  return (
    <div className="tpm-overlay" role="dialog" aria-modal="true" aria-label="Chi tiết Prompt AI">
      <div className="tpm-modal">
        {/* Header */}
        <div className="tpm-header">
          <div className="tpm-title-wrap">
            <div className="tpm-thumb-icon">
              {renderTemplateThumbnail(template.id, 36)}
            </div>
            <div>
              <div className="tpm-title">{template.name}</div>
              <div className="tpm-subtitle">
                <span>{template.slots.length} bộ phận</span>
                <span> · </span>
                <span>{template.category === 'character' ? 'Nhân vật' : template.category === 'animal' ? 'Động vật' : 'Thiên nhiên / Kiến trúc'}</span>
                {template.clips.length > 0 && (
                  <>
                    <span> · </span>
                    <span style={{ color: 'var(--key)' }}>{template.clips.length} hoạt ảnh có sẵn</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button type="button" className="btn sm icon ghost" onClick={onClose} aria-label="Đóng">
            <IconX width={16} height={16} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="tpm-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'prompt'}
            className={`tpm-tab${activeTab === 'prompt' ? ' active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            Prompt tạo ảnh AI
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'slots'}
            className={`tpm-tab${activeTab === 'slots' ? ' active' : ''}`}
            onClick={() => setActiveTab('slots')}
          >
            Bố cục {template.slots.length} bộ phận
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guide'}
            className={`tpm-tab${activeTab === 'guide' ? ' active' : ''}`}
            onClick={() => setActiveTab('guide')}
          >
            Hướng dẫn kỹ thuật
          </button>
        </div>

        {/* Body Content */}
        <div className="tpm-body">
          {activeTab === 'prompt' && (
            <PromptTabContent template={template} copied={copied} onCopy={handleCopy} />
          )}
          {activeTab === 'slots' && <SlotsTabContent template={template} />}
          {activeTab === 'guide' && <GuideTabContent template={template} />}
        </div>

        {/* Footer Actions */}
        <div className="tpm-footer">
          <button type="button" className="btn sm ghost" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="btn sm primary tpm-btn-use-now"
            onClick={() => {
              onClose()
              onUseTemplate(template)
            }}
          >
            Dùng mẫu này ngay
          </button>
        </div>
      </div>
    </div>
  )
}
