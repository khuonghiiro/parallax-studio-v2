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
    label: '🐼 Cát Gấu Tu Tiên',
    brief: {
      appearance: 'Classic Chinese Panda-Head meme (熊猫头), round pure-white head with 2 black panda ears and smug Baozou Manhua comic human smirk face',
      costume: 'Sky-blue & white Xianxia cross-collar immortal robe with golden cloud embroidery, jade waist sash, flared lower robe skirt, white cloth gaiters and black cloud boots',
      props: 'Ancient gold-and-jade cultivator hair crown, 8-bit Thug-Life sunglasses, Taoist beard, and a wooden sword tied with a red clay brick'
    }
  },
  {
    label: '🍄 Đầu Nấm Tổng Tài',
    brief: {
      appearance: 'Chinese Mushroom-Head meme (蘑菇头), oversized white cartoon head with shiny black bowl-cut hair and cheeky Baozou smirk expression',
      costume: 'Modern boss outfit: sleek black tailored suit jacket over a red shirt with a thick gold chain, floral beach shorts and yellow-blue flip-flop sandals',
      props: 'Black boss sunglasses, yellow construction hard-hat, and a giant blue flip-flop slipper weapon'
    }
  },
  {
    label: '⚔️ Kiếm Khách Cổ Trang',
    brief: {
      appearance: 'Handsome anime/comic martial arts swordsman with sharp heroic eyes, confident smile and flowing black-and-silver hair',
      costume: 'White and royal-blue Wuxia martial robe with silver dragon trim, armored leather bracers, dark trousers and martial boots',
      props: 'Silver headband crown, mysterious half-face mask, and a glowing celestial broadsword'
    }
  },
  {
    label: '🕶️ Giang Hồ Dép Lào',
    brief: {
      appearance: 'Funny Baozou meme street character with exaggerated smug grin, thick comic eyebrows and spiky hair',
      costume: 'Sleeveless red street tank-top with gold necklace, tropical floral shorts and plastic flip-flops',
      props: 'Pixelated Deal-With-It sunglasses, fake handlebar mustache, and a red brick / slipper slapstick prop'
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
          <span className="tpm-field-label">1. Tướng mạo, Khuôn mặt & Kiểu tóc</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Đầu gấu trúc meme cười đểu, mắt sắc / hoặc Nam hiệp sĩ tóc bạc dài..."
            value={brief.appearance || ''}
            onChange={(e) => onChange({ ...brief, appearance: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">2. Quần áo, Trang phục & Giày dép</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Mặc trường bào tu tiên xanh trắng thêu mây vàng, đai ngọc, đi hài cổ trang..."
            value={brief.costume || ''}
            onChange={(e) => onChange({ ...brief, costume: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">3. Phụ kiện Hoá trang & Vũ khí cầm tay</span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder="VD: Đội mão ngọc, đeo kính đen 8-bit Thug Life, cầm kiếm gỗ buộc gạch ống..."
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
          <h4>Đạo cụ đóng phim & Biểu cảm Điêu Khắc Cát (Meme Face Swap)</h4>
          <p>
            Các chi tiết đầu (Đầu gốc, Biểu cảm phụ Khóc/Nổi gân, Mũ, Kính mắt, Râu giả) và Vũ khí cầm tay được tách thành từng layer độc lập. Bạn chỉ cần bật/tắt (ẩn/hiện) layer để đổi biểu cảm tức thì hoặc hoá trang nhân vật đóng nhiều vai khác nhau.
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
