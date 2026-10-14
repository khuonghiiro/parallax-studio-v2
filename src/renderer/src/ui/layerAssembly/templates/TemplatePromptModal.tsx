import { useState, useMemo } from 'react'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import { buildTemplatePromptWithBrief, type CharacterPromptCustomBrief } from './characterPrompt'
import { renderTemplateThumbnail } from './templateIcons'
import { IconX, IconCopy, IconSparkles } from '../../icons'

interface TemplatePromptModalProps {
  template: LayerAssemblyTemplate | null
  onClose: () => void
  onUseTemplate: (template: LayerAssemblyTemplate) => void
}

type ModalTab = 'prompt' | 'slots' | 'guide'

const BRIEF_PRESETS: Array<{ label: string; brief: CharacterPromptCustomBrief }> = [
  {
    label: '👓 Nam Sinh Kính Cận (Mẫu Minh Hoạ)',
    brief: {
      appearance: 'Anime young male student, combined faceless head with messy layered black hair and hairpin, plus 2 floating facial expressions (calm smile & confident smirk)',
      costume: 'White collared dress shirt with diagonal black shoulder strap and brown leather waist belt, rolled-up white upper sleeves, dark charcoal trousers and black-and-white shoes',
      props: 'Thin black rectangular eyeglasses frame and a wristwatch on the right forearm'
    }
  },
  {
    label: '🎓 Nam Sinh Học Viện',
    brief: {
      appearance: 'Handsome anime academy student, combined faceless head with dark-blue hair and silver highlights, plus 2 floating facial expressions (calm & cheerful)',
      costume: 'Dark-navy sleeveless academy sweater vest over a white collared shirt with blue tie and brown leather belt, white upper sleeves, charcoal slacks and sneakers',
      props: 'Sleek rectangular black eyeglasses frame'
    }
  },
  {
    label: '⚔️ Kiếm Khách Cổ Trang',
    brief: {
      appearance: 'Handsome young adult martial arts swordsman, faceless head with layered black-and-navy hair and 2 expressive anime faces',
      costume: 'Royal-blue and white Wuxia martial tunic with gold trim, leather waist belt, charcoal trousers and martial boots',
      props: 'Stylish headband / glasses frame accessory'
    }
  },
  {
    label: '🌸 Nữ Sinh Anime Dịu Dàng',
    brief: {
      appearance: 'Cute anime high school girl, combined faceless head with long twin-tail chestnut hair and ribbon clips, plus 2 floating kawaii facial expressions',
      costume: 'Cream sailor uniform blouse with red ribbon tie, pleated navy skirt/trousers and brown loafers with white socks',
      props: 'Round thin gold wire eyeglasses frame'
    }
  }
]

function PromptCustomizerBox({
  brief,
  onChange
}: {
  brief: CharacterPromptCustomBrief
  onChange: (next: CharacterPromptCustomBrief) => void
}) {
  const hasAny = Boolean(brief.appearance?.trim() || brief.costume?.trim() || brief.props?.trim())
  return (
    <div className="tpm-customizer" id="template-prompt-customizer">
      <div className="tpm-customizer-header">
        <div className="tpm-customizer-title">
          <IconSparkles width={14} height={14} />
          <span>Mô tả Tướng mạo & Quần áo Nhân vật (Tự động gắn vào Prompt AI)</span>
        </div>
        <div className="tpm-preset-chips">
          {BRIEF_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="tpm-preset-chip"
              onClick={() => onChange(p.brief)}
              title="Điền nhanh mẫu mô tả này vào Prompt"
            >
              {p.label}
            </button>
          ))}
          {hasAny && (
            <button
              type="button"
              className="tpm-preset-chip clear"
              onClick={() => onChange({ appearance: '', costume: '', props: '' })}
            >
              ✕ Xoá mô tả
            </button>
          )}
        </div>
      </div>
      <div className="tpm-customizer-grid">
        <label className="tpm-field">
          <span className="tpm-field-label">1. Tướng mạo, Kiểu tóc & Biểu cảm rời</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Nam thanh niên tuấn tú, tóc đen rẽ ngôi, đầu gốc trơn kèm 4 biểu cảm mắt xanh..."
            value={brief.appearance || ''}
            onChange={(e) => onChange({ ...brief, appearance: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">2. Quần áo, Trang phục & Giày dép</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Mặc võ phục xanh hoàng gia viền vàng, đai lưng da, quần tối màu và ủng cổ cao..."
            value={brief.costume || ''}
            onChange={(e) => onChange({ ...brief, costume: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">3. Áo choàng & Vũ khí / Đạo cụ cầm tay</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Áo choàng đỏ viền vàng sau lưng, tay phải cầm trường kiếm bạc..."
            value={brief.props || ''}
            onChange={(e) => onChange({ ...brief, props: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

function PromptTabContent({
  activePrompt,
  brief,
  onChangeBrief,
  copied,
  onCopy
}: {
  activePrompt: string
  brief: CharacterPromptCustomBrief
  onChangeBrief: (next: CharacterPromptCustomBrief) => void
  copied: boolean
  onCopy: () => void
}) {
  const hasCustom = Boolean(brief.appearance?.trim() || brief.costume?.trim() || brief.props?.trim())
  return (
    <div className="tpm-tab-content">
      <div className="tpm-alert-banner">
        <span>
          💡 <strong>Mẹo Tạo Nhân Vật Chuẩn Khớp Lắp Ráp:</strong> Nhập mô tả <em>Tướng mạo</em>, <em>Quần áo</em> và <em>Phụ kiện</em> ở khung dưới (bằng tiếng Việt hoặc tiếng Anh). Hệ thống sẽ tự động gắn mô tả của bạn vào cả phần <code>IDENTITY</code> lẫn từng ô bộ phận (<code>CELL ASSIGNMENTS</code>) để AI vẽ tất cả các mảnh khớp nhau như một bức vẽ hoàn chỉnh.
        </span>
      </div>
      <PromptCustomizerBox brief={brief} onChange={onChangeBrief} />
      <div className="tpm-code-container">
        <div className="tpm-code-header">
          <span className="tpm-code-lang">
            PROMPT CHUẨN ATLAS SPRITE {hasCustom ? '· ✓ ĐÃ GẮN MÔ TẢ TUỲ CHỈNH' : '(MẶC ĐỊNH)'}
          </span>
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
          <code>{activePrompt}</code>
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
          <h4>Mô tả Tướng mạo & Quần áo trước khi copy Prompt</h4>
          <p>Điền tướng mạo khuôn mặt, trang phục và đạo cụ vào khung tuỳ chỉnh ở tab đầu tiên. Prompt sẽ tự động đồng bộ chất liệu vải và màu sắc vào từng ô tay, chân, thân, hông để khi ghép lại nhìn như một nhân vật vẽ liền mạch.</p>
        </div>
      </div>
      <div className="tpm-guide-step">
        <div className="tpm-step-num">2</div>
        <div>
          <h4>Quy chuẩn chồng lấp khớp (Joint Overlaps)</h4>
          <p>Mỗi đầu khớp nối (khuỷu tay, đầu gối, cổ chân, đai lưng/vạt áo) được vẽ kéo dài 10-15% bo tròn kín. Khi xoay xương trong hoạt ảnh 2.5D, khớp sẽ không bị rỗng hoặc lộ viền cắt ngang.</p>
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
          <h4>Đầu người trơn không ngũ quan & Ghép biểu cảm rời (Faceless Head + Swappable Faces)</h4>
          <p>
            Phần đầu gốc (<code>head</code>) được thiết kế trơn hoàn toàn (không vẽ sẵn mắt, mũi, miệng) để bạn tự do bật/tắt hoặc ghép chồng các layer biểu cảm rời (Bình thường, Vui vẻ, Tức giận, Hoảng hốt) lên trên theo từng phân cảnh diễn xuất.
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
  const [brief, setBrief] = useState<CharacterPromptCustomBrief>({
    appearance: '',
    costume: '',
    props: ''
  })

  const activePrompt = useMemo(() => {
    if (!template) return ''
    return buildTemplatePromptWithBrief(template, brief)
  }, [template, brief])

  if (!template) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activePrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // fallback
    }
  }

  return (
    <div className="tpm-overlay" role="dialog" aria-modal="true" aria-label="Chi tiết Prompt AI">
      <div className="tpm-modal">
        <div className="tpm-header">
          <div className="tpm-title-wrap">
            <div className="tpm-thumb-icon">{renderTemplateThumbnail(template.id, 36)}</div>
            <div>
              <div className="tpm-title">{template.name}</div>
              <div className="tpm-subtitle">
                <span>{template.slots.length} bộ phận</span>
                <span> · </span>
                <span>
                  {template.category === 'character'
                    ? 'Nhân vật'
                    : template.category === 'animal'
                      ? 'Động vật'
                      : 'Thiên nhiên / Kiến trúc'}
                </span>
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

        <div className="tpm-body">
          {activeTab === 'prompt' && (
            <PromptTabContent
              activePrompt={activePrompt}
              brief={brief}
              onChangeBrief={setBrief}
              copied={copied}
              onCopy={handleCopy}
            />
          )}
          {activeTab === 'slots' && <SlotsTabContent template={template} />}
          {activeTab === 'guide' && <GuideTabContent template={template} />}
        </div>

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
