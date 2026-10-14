import { useState, useMemo } from 'react'
import type { LayerAssemblyTemplate } from './layerTemplateTypes'
import { buildTemplatePromptWithBrief, type CharacterPromptCustomBrief } from './characterPrompt'
import { renderTemplateThumbnail } from './templateIcons'
import { CharacterReferenceOptions } from './CharacterReferenceOptions'
import { NEW_CHARACTER_EXAMPLES } from './characterPromptReference'
import { IconX, IconCopy, IconSparkles } from '../../icons'

interface TemplatePromptModalProps {
  template: LayerAssemblyTemplate | null
  onClose: () => void
  onUseTemplate: (template: LayerAssemblyTemplate) => void
}

type ModalTab = 'prompt' | 'slots' | 'guide'

const CHARACTER_BRIEF_PRESETS: Array<{ label: string; brief: CharacterPromptCustomBrief }> = [
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
  },
  ...NEW_CHARACTER_EXAMPLES
]

const NATURE_BRIEF_PRESETS: Array<{ label: string; brief: CharacterPromptCustomBrief }> = [
  {
    label: '🌳 Đại Thụ Sồi & Táo Lẻ Ghép Chùm (Chuẩn 4 Góc)',
    brief: {
      appearance: 'Standalone 4-corner unclipped mossy grass ground mound (no tree roots on the ground), paired with a unified ancient oak trunk that includes both upper branches and sprawling gnarled roots in one piece',
      costume: '3 depth-layered billowy emerald-to-sunlit-green oak foliage crowns (plus golden autumn and sakura pink canopy variants matching the exact contour)',
      props: 'Isolated single glossy ripe red apples (with short stem & 2 small green oak leaves for free stacking into custom clusters) and 6–8 white-pink blossom clusters matching the canopy contour'
    }
  },
  {
    label: '🌸 Đại Thụ Anh Đào Cổ Thụ',
    brief: {
      appearance: 'Standalone 4-corner unclipped mossy ground mound with fallen petals (no tree roots), paired with a graceful cherry blossom tree trunk and its full gnarled root system in one piece',
      costume: 'Lush multi-lobe spring green and pastel sakura-pink layered foliage canopies',
      props: 'Isolated single ripe cherries/apples for stacking into clusters and abundant glowing 5-petal sakura blossom garlands nestled across the canopy puffs'
    }
  },
  {
    label: '💎 Cụm Đá Rêu Phong & Tinh Thể',
    brief: {
      appearance: 'Heavy chiseled granite boulder resting inside a complete 4-corner unclipped flat-bottomed grassy soil mound with rounded corner pebbles (zero flat side cuts)',
      costume: 'Thick emerald forest moss blanket and toggleable fluffy white winter snow cap draping over the top boulder ridges',
      props: 'Radiant cyan-blue magic crystal cluster, mossy foreground pebbles, and swaying forest ferns & wildflowers'
    }
  }
]

function PromptCustomizerBox({
  isNature,
  brief,
  onChange
}: {
  isNature: boolean
  brief: CharacterPromptCustomBrief
  onChange: (next: CharacterPromptCustomBrief) => void
}) {
  const hasAny = Boolean(brief.appearance?.trim() || brief.costume?.trim() || brief.props?.trim())
  const presets = isNature ? NATURE_BRIEF_PRESETS : CHARACTER_BRIEF_PRESETS
  return (
    <div className="tpm-customizer" id="template-prompt-customizer">
      <div className="tpm-customizer-header">
        <div className="tpm-customizer-title">
          <IconSparkles width={14} height={14} />
          <span>
            {isNature
              ? 'Tuỳ chỉnh Nền đất riêng, Thân kèm rễ, Tán lá & Quả lẻ (Tự động gắn vào Prompt AI)'
              : 'Mô tả Tướng mạo & Quần áo Nhân vật (Tự động gắn vào Prompt AI)'}
          </span>
        </div>
        <div className="tpm-preset-chips">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="tpm-preset-chip"
              onClick={() => onChange({ ...brief, ...p.brief })}
              title="Điền nhanh mẫu mô tả này vào Prompt"
            >
              {p.label}
            </button>
          ))}
          {hasAny && (
            <button
              type="button"
              className="tpm-preset-chip clear"
              onClick={() => onChange({ ...brief, appearance: '', costume: '', props: '' })}
            >
              ✕ Xoá mô tả
            </button>
          )}
        </div>
      </div>
      <div className="tpm-customizer-grid">
        <label className="tpm-field">
          <span className="tpm-field-label">
            {isNature
              ? '1. Nền đất cỏ riêng (không rễ) & Thân gỗ kèm rễ cây liền khối'
              : '1. Tướng mạo, Kiểu tóc & Biểu cảm rời'}
          </span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder={
              isNature
                ? 'VD: Nền đất cỏ rêu riêng đủ 4 góc cạnh không chứa rễ; thân gỗ sồi đi kèm luôn cả bộ rễ xoè rộng...'
                : 'VD: Gender: male. Hair: messy short ginger hair. Eyes: sharp amber eyes. Skin: tan. Vibe: laid-back.'
            }
            value={brief.appearance || ''}
            onChange={(e) => onChange({ ...brief, appearance: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">
            {isNature
              ? '2. Tán lá / Lớp phủ Rêu & Biến thể theo mùa'
              : '2. Quần áo, Trang phục & Giày dép'}
          </span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder={
              isNature
                ? 'VD: 3 tầng tán lá xanh ngọc bích bồng bềnh dạng mây, kèm tán vàng mùa thu & hồng sakura...'
                : 'VD: Dark green hooded jacket over a white t-shirt, black cargo pants, white sneakers.'
            }
            value={brief.costume || ''}
            onChange={(e) => onChange({ ...brief, costume: e.target.value })}
          />
        </label>
        <label className="tpm-field">
          <span className="tpm-field-label">
            {isNature
              ? '3. Quả lẻ tẻ (để ghép chồng tạo chùm), Hoa nở & Chi tiết phụ'
              : '3. Áo choàng & Vũ khí / Đạo cụ cầm tay'}
          </span>
          <input
            type="text"
            className="input-text sm tpm-field-input"
            placeholder={
              isNature
                ? 'VD: Quả táo đỏ lẻ tẻ kèm 2 lá nhỏ ở cuống để ghép chồng tạo chùm, hoa trắng hồng ăn khít tán lá...'
                : 'VD: Silver chain necklace, fingerless glove on the left hand (2-3 phụ kiện).'
            }
            value={brief.props || ''}
            onChange={(e) => onChange({ ...brief, props: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

function PromptTabContent({
  isNature,
  activePrompt,
  brief,
  onChangeBrief,
  copied,
  onCopy
}: {
  isNature: boolean
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
        {isNature ? (
          <span>
            💡 <strong>Chuẩn Cây Cối &amp; Đá Tảng 2.5D (Nền Đất Riêng · Thân Kèm Rễ · Quả Lẻ Ghép Chùm):</strong> Prompt bắt buộc AI vẽ <strong>trọn vẹn 100% chu vi 4 góc cạnh với lề xanh &gt;=15%</strong>, tách <em>Nền đất cỏ rêu riêng biệt không chứa rễ cây</em>, đưa <em>toàn bộ bộ rễ cây liền khối vào Thân gỗ</em> để đặt lên nền đất luôn khớp 100%, và vẽ <em>Quả táo đỏ thành từng quả lẻ tẻ</em> để bạn tự do ghép chồng nhiều quả lên nhau tạo chùm quả đẹp mắt.
          </span>
        ) : (
          <span>
            💡 <strong>Vì sao AI hay &quot;sửa ảnh mẫu&quot; thay vì tạo nhân vật mới?</strong> Khi đính kèm ảnh, AI thường hiểu đó là ảnh cần chỉnh sửa. Hãy chọn <em>vai trò ảnh đính kèm</em> bên dưới và mô tả nhân vật mới thật cụ thể (giới tính, tóc, mắt, trang phục, 2-3 phụ kiện, màu da, tính cách). Nếu AI vẫn chép mẫu: giảm <em>image strength / reference weight</em> hoặc bỏ hẳn ảnh mẫu.
          </span>
        )}
      </div>
      {!isNature && <CharacterReferenceOptions brief={brief} onChange={onChangeBrief} />}
      <PromptCustomizerBox isNature={isNature} brief={brief} onChange={onChangeBrief} />
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
  if (template.category === 'nature') {
    return (
      <div className="tpm-tab-content tpm-guide-body">
        <div className="tpm-guide-step">
          <div className="tpm-step-num">1</div>
          <div>
            <h4>Chuẩn chỉ 4 góc cạnh ảnh — Tuyệt đối không chạm viền ô (15% Safe Margin)</h4>
            <p>
              Mọi bộ phận, đặc biệt là <strong>Nền đất &amp; Thảm cỏ rêu</strong> (<code>tree-roots</code>) và <strong>Đế đất &amp; Thảm cỏ chân đá</strong> (<code>rock-ground</code>), bắt buộc vẽ trọn vẹn 100% chu vi gò đất thấp đáy bằng, hai đầu trái/phải bo tròn tự nhiên với khoảng lề xanh <code>#00FF00</code> tối thiểu 15% ở cả 4 phía để không bao giờ bị cắt phẳng mép ảnh.
            </p>
          </div>
        </div>
        <div className="tpm-guide-step">
          <div className="tpm-step-num">2</div>
          <div>
            <h4>Nền đất cỏ riêng không chứa rễ &amp; Thân cây đi kèm cả bộ rễ liền khối</h4>
            <p>
              Lớp <code>tree-roots</code> chỉ vẽ gò đất và thảm cỏ rêu thuần tuý (tuyệt đối không vẽ rễ cây gỗ trên nền đất). Toàn bộ bộ rễ cây xoè rộng nằm liền khối luôn với <code>tree-trunk</code> (Thân gỗ đại thụ &amp; Bộ rễ cây) để khi đặt thân cây lên nền đất cỏ luôn ăn khớp tự nhiên 100%, không bao giờ bị lệch cổ gốc.
            </p>
          </div>
        </div>
        <div className="tpm-guide-step">
          <div className="tpm-step-num">3</div>
          <div>
            <h4>Layer Quả táo đỏ lẻ tẻ — Tự do ghép chồng tạo chùm quả đẹp mắt</h4>
            <p>
              Thay vì vẽ sẵn cả một mảng chùm quả cứng nhắc, mỗi layer quả (<code>tree-fruits</code>, <code>tree-fruits-2</code>...) là <strong>một quả táo đỏ chín mọng đơn lẻ</strong> kèm cuống và 1–2 chiếc lá xanh nhỏ. Bạn có thể tự do kéo thả, nhân bản và xếp chồng nhiều quả lên nhau để tạo chùm quả 2–3 trái tại bất kỳ múi tán lá nào.
            </p>
          </div>
        </div>
        <div className="tpm-guide-step">
          <div className="tpm-step-num">4</div>
          <div>
            <h4>Tài nguyên đóng gói riêng (Private) &amp; Đổi mùa linh hoạt</h4>
            <p>{template.promptGuide.userGuide}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tpm-tab-content tpm-guide-body">
      <div className="tpm-guide-step">
        <div className="tpm-step-num">1</div>
        <div>
          <h4>Ảnh mẫu chỉ là bố cục — Mô tả nhân vật mới thật cụ thể</h4>
          <p>Chọn &quot;Ảnh mẫu chỉ để tham khảo bố cục&quot; khi đính kèm sprite sheet mẫu: prompt ghi rõ AI chỉ học cách tách bộ phận trên nền xanh, không chép mặt, tóc, quần áo hay màu của mẫu. Mô tả càng mơ hồ AI càng bám ảnh mẫu, nên hãy điền đủ giới tính, tóc, mắt, trang phục, phụ kiện, màu da và tính cách. Dán thêm phần Negative prompt vào ô negative của công cụ tạo ảnh.</p>
          <p><strong>Quy trình 2 bước cho nhân vật nhất quán:</strong> (1) tạo ảnh nhân vật đầy đủ (không đính kèm mẫu), (2) đính kèm ảnh vừa tạo và chọn &quot;Tách bộ phận đúng nhân vật trong ảnh&quot;. Mỗi lần nên tạo một nhóm bộ phận (đầu / thân trên / thân dưới) để phần bị che khuất được vẽ đầy đủ hơn.</p>
          <p><strong>Kiểu sheet:</strong> &quot;13 mảnh theo khung mẫu&quot; để nhập thẳng vào mẫu này; &quot;Bóc tách chi tiết Live2D / Spine&quot; (~45 mảnh: tóc nhiều lớp, đầu trơn, mắt/lông mày/miệng rời, thân trần + quần áo từng lớp, tay chân trái phải riêng) khi cần rig 2.5D mềm mại hơn.</p>
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
    props: '',
    referenceMode: 'layout',
    partGroup: 'all',
    sheetStyle: 'template'
  })

  const activePrompt = useMemo(() => {
    if (!template) return ''
    return buildTemplatePromptWithBrief(template, brief)
  }, [template, brief])

  if (!template) return null

  const isNature = template.category === 'nature'

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
                      : 'Thiên nhiên / Cây cối & Đá bóc tách'}
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
              isNature={isNature}
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
