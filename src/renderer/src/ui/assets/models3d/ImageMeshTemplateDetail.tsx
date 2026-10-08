import { useState } from 'react'
import type { AssemblyTemplate } from './assemblyTemplateKit'
import type { Model3D } from './types'
import { modelFromTemplate } from './templateCatalogue'
import { bindTemplateImages, imageTemplateGuide, resolveImageTemplate } from './imageMeshRecipe'
import { IMAGE_RENDER_RULES, type ImageMeshSlot } from './imageMeshTypes'

function ImageSlotInput({ slot, image, onImage }: { slot: ImageMeshSlot; image?: string; onImage: (value: string) => void }) {
  const [error, setError] = useState('')
  const readFile = async (file?: File) => {
    if (!file) return
    if (file.type !== 'image/png') { setError('Chọn PNG có nền trong suốt.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Ảnh tối đa 20 MB.'); return }
    const reader = new FileReader()
    reader.onerror = () => setError('Không đọc được ảnh.')
    reader.onload = () => { onImage(String(reader.result)); setError('') }
    reader.readAsDataURL(file)
  }
  return <div className="c3d-image-slot">
    {image && <img src={image} alt={slot.label} />}
    <strong>{slot.label} · {slot.aspect.join(':')}</strong>
    <p>{slot.guidance}</p>
    <label>Chọn ảnh PNG <input type="file" accept="image/png" onChange={(e) => void readFile(e.target.files?.[0])} /></label>
    {image && <button className="btn xs" onClick={() => onImage('')}>Bỏ ảnh</button>}
    {error && <p role="alert">{error}</p>}
  </div>
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
    try { await navigator.clipboard.writeText(JSON.stringify(guide, null, 2)); setNotice('Đã sao chép hướng dẫn cho AI.') }
    catch { setNotice('Không truy cập được clipboard. AI có thể dùng get_assembly_template.') }
  }
  return <div className="c3d-recipe c3d-scroll">
    <button className="btn sm" onClick={onBack}>← Danh sách mẫu</button>
    <h2>{template.label}</h2>
    <p>{template.hint}</p>
    <p>{IMAGE_RENDER_RULES.vi}</p>
    <div className="c3d-recipe-actions">
      {guide.variants.map((v) => <button key={v.id} className={`btn sm${variant === v.id ? ' primary' : ''}`}
        aria-pressed={variant === v.id} onClick={() => setVariant(v.id)}>{v.label}</button>)}
      <button className="btn sm" onClick={() => void copy()}>Sao chép hướng dẫn AI</button>
    </div>
    <p>{guide.slots.length} ảnh nguồn → {guide.faces.length} mặt mesh. Có thể để trống ảnh và gắn sau trong xưởng hoặc qua MCP.</p>
    <div className="c3d-recipe-slots">{template.imageRecipe?.slots.map((s) => <ImageSlotInput key={s.id} slot={s} image={images[s.id]}
      onImage={(value) => setImages((prev) => { const next = { ...prev }; if (value) next[s.id] = value; else delete next[s.id]; return next })} />)}</div>
    <details><summary>Prompt render và sơ đồ gắn ảnh cho AI</summary><pre>{JSON.stringify(guide, null, 2)}</pre></details>
    <p role="status">{notice}</p>
    <button className="btn sm primary" onClick={create}>Tạo mesh · {Object.keys(images).length}/{guide.slots.length} ảnh đã chọn</button>
  </div>
}
