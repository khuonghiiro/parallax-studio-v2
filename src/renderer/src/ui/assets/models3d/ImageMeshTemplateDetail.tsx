import { useState, useRef } from 'react'
import type { AssemblyTemplate } from './assemblyTemplateKit'
import type { Model3D } from './types'
import { modelFromTemplate } from './templateCatalogue'
import { bindTemplateImages, imageTemplateGuide, resolveImageTemplate } from './imageMeshRecipe'
import { IMAGE_RENDER_RULES, type ImageMeshSlot } from './imageMeshTypes'
import { IMAGE_ALPHA_RULES } from './imageMeshSlotRules'
import { ImageAlignmentEditor } from './ImageAlignmentEditor'

function ImageSlotInput({
  slot,
  image,
  guideSvgUrl,
  renderPromptEn,
  onImage
}: {
  slot: ImageMeshSlot
  image?: string
  guideSvgUrl?: string
  renderPromptEn?: string
  onImage: (value: string) => void
}) {
  const [error, setError] = useState('')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const fileRevisionRef = useRef(0)

  const readFile = async (file?: File) => {
    if (!file) return
    if (file.type !== 'image/png') { setError('Chọn file định dạng PNG.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Ảnh tối đa 20 MB.'); return }

    const currentRevision = ++fileRevisionRef.current
    const reader = new FileReader()
    reader.onerror = () => {
      if (fileRevisionRef.current === currentRevision) setError('Không đọc được file ảnh.')
    }
    reader.onload = () => {
      if (fileRevisionRef.current !== currentRevision) return
      onImage(String(reader.result))
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleCopyPrompt = async () => {
    if (!renderPromptEn) return
    try {
      await navigator.clipboard.writeText(renderPromptEn)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch {
      // Ignore clipboard fail
    }
  }

  return (
    <div className="c3d-image-slot">
      <div style={{ position: 'relative', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {image ? (
          <img src={image} alt={slot.label} style={{ maxHeight: 140, objectFit: 'contain' }} />
        ) : guideSvgUrl ? (
          <img
            src={guideSvgUrl}
            alt="Sơ đồ mẫu"
            style={{ maxHeight: 120, opacity: 0.6, border: '1px dashed var(--line)' }}
            title="Sơ đồ toạ độ điểm neo và vùng tiếp giáp"
          />
        ) : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{slot.label} · {slot.aspect.join(':')}</strong>
        {renderPromptEn && (
          <button
            type="button"
            className="btn xs"
            onClick={handleCopyPrompt}
            title="Sao chép prompt render tiếng Anh cho AI"
          >
            {copiedPrompt ? '✓ Đã chép prompt' : '📋 Prompt AI'}
          </button>
        )}
      </div>

      <p>{slot.guidance}</p>
      {slot.attachmentBand && (
        <p style={{ fontSize: 11, color: '#f59e0b' }}>
          ⚓ Điểm neo chân gốc chạm mép dưới (v={slot.attachmentBand.vMin.toFixed(2)}..{slot.attachmentBand.vMax.toFixed(2)}).
        </p>
      )}
      <p>{IMAGE_ALPHA_RULES[slot.alphaMode].vi}</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn xs">
          Chọn ảnh PNG
          <input type="file" accept="image/png" style={{ display: 'none' }} onChange={(e) => void readFile(e.target.files?.[0])} />
        </label>
        {image && (
          <>
            <button type="button" className="btn xs" onClick={() => setIsEditorOpen(true)}>
              ⚙ Căn chỉnh ảnh
            </button>
            <button type="button" className="btn xs" onClick={() => onImage('')}>
              Bỏ ảnh
            </button>
          </>
        )}
      </div>

      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}

      {isEditorOpen && image && (
        <ImageAlignmentEditor
          slot={slot}
          imageUrl={image}
          onApply={(alignedDataUrl) => {
            onImage(alignedDataUrl)
            setIsEditorOpen(false)
          }}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  )
}

export function ImageMeshTemplateDetail({ template, onBack, onCreate }: {
  template: AssemblyTemplate; onBack: () => void; onCreate: (model: Model3D) => void
}) {
  const [variant, setVariant] = useState('standard')
  const [images, setImages] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const guide = imageTemplateGuide(template, variant)

  const create = () => {
    const resolved = resolveImageTemplate(template, variant)
    const model = modelFromTemplate(resolved)
    model.faces = bindTemplateImages(resolved, model.faces, images)
    onCreate(model)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(guide, null, 2))
      setNotice('Đã sao chép hướng dẫn và cấu hình mesh cho AI.')
    } catch {
      setNotice('Không truy cập được clipboard. AI có thể dùng get_assembly_template.')
    }
  }

  return (
    <div className="c3d-recipe c3d-scroll">
      <button type="button" className="btn sm" onClick={onBack}>← Danh sách mẫu</button>
      <h2>{template.label}</h2>
      <p>{template.hint}</p>
      <p>{IMAGE_RENDER_RULES.vi}</p>

      <div className="c3d-recipe-actions">
        {guide.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`btn sm${variant === v.id ? ' primary' : ''}`}
            aria-pressed={variant === v.id}
            onClick={() => setVariant(v.id)}
          >
            {v.label}
          </button>
        ))}
        <button type="button" className="btn sm" onClick={() => void copy()}>Sao chép hướng dẫn AI</button>
      </div>

      <p>{guide.slots.length} ảnh nguồn → {guide.faces.length} mặt mesh. Có thể gắn ảnh ngay hoặc tạo khung trước và gắn ảnh sau.</p>

      <div className="c3d-recipe-slots">
        {guide.slots.map((s) => (
          <ImageSlotInput
            key={s.id}
            slot={s}
            image={images[s.id]}
            guideSvgUrl={s.guideSvgDataUrl}
            renderPromptEn={s.renderPromptEn}
            onImage={(value) => setImages((prev) => {
              const next = { ...prev }
              if (value) next[s.id] = value
              else delete next[s.id]
              return next
            })}
          />
        ))}
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Prompt render và sơ đồ toạ độ điểm neo cho AI</summary>
        <pre style={{ maxHeight: 200, overflowY: 'auto' }}>{JSON.stringify(guide, null, 2)}</pre>
      </details>

      <p role="status">{notice}</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <button type="button" className="btn sm primary" onClick={create}>
          Chọn mẫu này &amp; Tạo mesh ({Object.keys(images).length}/{guide.slots.length} ảnh)
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => onCreate(modelFromTemplate(resolveImageTemplate(template, variant)))}
        >
          Chọn mẫu khung này (không gắn ảnh)
        </button>
      </div>
    </div>
  )
}
