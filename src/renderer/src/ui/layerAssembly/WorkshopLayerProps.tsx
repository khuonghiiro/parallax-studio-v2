import { useMemo, useState } from 'react'
import type { AssembledLayerItem, LayerComposite } from './types'
import { Select } from '../controls'
import { PartThumb } from './PartThumb'
import { IconAnchor, IconBone, IconCopy, IconFaceSwap, IconLayersStack, IconPuzzle, IconReplace, IconSliders, IconTrash } from '../icons'
import { activateVariant, assignToGroup, layerAssetPath, updatePartGroup } from './workshopParts'
import { addLayersToVariant, createVariantSet, removeFromSlot, renameVariant, slotNames, slotVariantGroups } from './workshopPartSets'
import { PartEditableTitle } from './PartEditableTitle'
import {
  autoScanAndBindClothRegionsForComposite,
  detectGarmentCoversLegs,
  scanClothFollowerRegionsForLayer
} from './workshopClothScanner'


export interface WorkshopLayerPropsProps {
  composite: LayerComposite
  layer: AssembledLayerItem
  setComposite: (next: LayerComposite) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onMoveLayer: (id: string, x: number, y: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onSelectLayer: (id: string) => void
  onOpenSwap: (layerId: string, mode: 'replace' | 'variant') => void
  section?: 'all' | 'transform' | 'depth' | 'parts' | 'cloth'
}

const DEPTH_PRESETS: Array<[number, string, string]> = [
  [-120, 'Nền xa', 'Nền xa nằm sâu phía dưới (-120px)'],
  [-50, 'Hậu cảnh', 'Hậu cảnh nằm bên dưới (-50px)'],
  [0, 'Trọng tâm', 'Mặt phẳng chuẩn (0px)'],
  [50, 'Cận cảnh', 'Cận cảnh nổi lên trên (+50px)'],
  [120, 'Tiền cảnh', 'Tiền cảnh đè lên trước (+120px)']
]

function NumField({ label, value, step = 1, axis, onChange }: { label: string; value: number; step?: number; axis?: 'x' | 'y' | 'z'; onChange: (v: number) => void }) {
  return (
    <label className="lw-field">
      <span className={`lw-field-label${axis ? ` ${axis}` : ''}`}>{label}</span>
      <input className="lw-input" type="number" step={step} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v) }} />
    </label>
  )
}

const NEW_SLOT = '__new_slot__'

function PartSection({ composite, layer, setComposite, onSelectLayer, onOpenSwap }: Pick<WorkshopLayerPropsProps, 'composite' | 'layer' | 'setComposite' | 'onSelectLayer' | 'onOpenSwap'>) {
  const groups = composite.partGroups ?? []
  const group = groups.find((g) => g.id === layer.partGroupId)
  const variants = layer.slot ? slotVariantGroups(composite, layer.slot) : []
  const pickSlot = (v: string) => {
    if (!v) setComposite(removeFromSlot(composite, layer.id))
    else if (v === NEW_SLOT) setComposite(createVariantSet(composite, [layer.id], layer.name).composite)
    else setComposite(addLayersToVariant(composite, [layer.id], v))
  }
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconPuzzle width={13} height={13} /> Bộ phận &amp; Thay thế</span>
        <button type="button" className="lw-btn sm primary" onClick={() => onOpenSwap(layer.id, 'replace')} title="Thay ảnh bộ phận này, giữ nguyên vị trí / xương / nhóm">
          <IconReplace width={12} height={12} /> Thay thế…
        </button>
      </div>
      <div className="lw-prop-grid">
        <div className="lw-field">
          <span className="lw-field-label">Nhóm liên kết</span>
          <Select size="sm" value={layer.partGroupId ?? ''}
            options={[{ value: '', label: 'Không thuộc nhóm' }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
            onChange={(v) => setComposite(assignToGroup(composite, [layer.id], String(v) || null))} />
        </div>
        <div className="lw-field">
          <span className="lw-field-label">Bộ biến thể</span>
          <Select size="sm" value={layer.slot ?? ''}
            options={[{ value: '', label: 'Không thuộc bộ' }, ...slotNames(composite).map((s) => ({ value: s, label: s })), { value: NEW_SLOT, label: '＋ Tạo bộ mới từ layer này' }]}
            onChange={(v) => pickSlot(String(v))} />
        </div>
      </div>
      {layer.slot && (
        <div className="lw-field">
          <span className="lw-field-label">Tên biến thể của layer này</span>
          <PartEditableTitle value={layer.variant || layer.name} ariaLabel="Tên biến thể"
            onCommit={(name) => setComposite(renameVariant(composite, layer.slot!, layer.variant || layer.name, name))} />
        </div>
      )}
      {group && (
        <div className="lw-chip-row">
          <button type="button" className={`lw-chip${group.anchorLayerId === layer.id ? ' active' : ''}`}
            onClick={() => setComposite(updatePartGroup(composite, group.id, { anchorLayerId: layer.id }))} title="Đặt layer này làm điểm neo của nhóm">
            <IconAnchor width={11} height={11} /> {group.anchorLayerId === layer.id ? 'Đang là neo nhóm' : 'Đặt làm neo nhóm'}
          </button>
          <button type="button" className={`lw-chip${group.locked ? ' active' : ''}`}
            onClick={() => setComposite(updatePartGroup(composite, group.id, { locked: !group.locked }))}>
            {group.locked ? 'Nhóm đang liên kết' : 'Nhóm đang tách rời'}
          </button>
        </div>
      )}
      {variants.length > 0 && <PartVariantStrip composite={composite} layerId={layer.id} variants={variants} setComposite={setComposite} onSelectLayer={onSelectLayer} onOpenSwap={onOpenSwap} />}
    </section>
  )
}

function PartVariantStrip({ composite, layerId, variants, setComposite, onSelectLayer, onOpenSwap }: Pick<WorkshopLayerPropsProps, 'composite' | 'setComposite' | 'onSelectLayer' | 'onOpenSwap'> & {
  layerId: string; variants: ReturnType<typeof slotVariantGroups>
}) {
  return (
    <div className="lw-variant-strip" aria-label="Biến thể cùng bộ">
      {variants.map((v) => (
        <button key={v.variant} type="button" className={`lw-variant${v.active ? ' active' : ''}`} title={`Dùng biến thể "${v.variant}" (${v.layers.length} lớp)`}
          onClick={() => { setComposite(activateVariant(composite, v.layers[0].id)); onSelectLayer(v.layers[0].id) }}>
          <PartThumb path={layerAssetPath(composite, v.layers[0])} previewUrl={v.layers[0].imageUrl} assets={composite.assets} />
          <span className="lw-variant-name">{v.variant}</span>
        </button>
      ))}
      <button type="button" className="lw-variant add" onClick={() => onOpenSwap(layerId, 'variant')} title="Thêm biến thể mới vào bộ">
        <span className="lw-variant-plus"><IconFaceSwap width={16} height={16} /></span>
        <span className="lw-variant-name">Thêm</span>
      </button>
    </div>
  )
}

function TransformSection({ layer, onUpdateLayer, onMoveLayer }: Pick<WorkshopLayerPropsProps, 'layer' | 'onUpdateLayer' | 'onMoveLayer'>) {
  const up = (patch: Partial<AssembledLayerItem>) => onUpdateLayer(layer.id, patch)
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconSliders width={13} height={13} /> Biến đổi</span>
        <button type="button" className="lw-btn sm ghost" onClick={() => { onMoveLayer(layer.id, 0, 0); up({ rotation: 0, rotationX: 0, rotationY: 0 }) }} title="Đưa về tâm (0, 0) và góc 0°">Đặt lại</button>
      </div>
      <div className="lw-prop-grid">
        <NumField label="X (ngang)" value={layer.x} onChange={(v) => onMoveLayer(layer.id, v, layer.y)} />
        <NumField label="Y (dọc)" value={layer.y} onChange={(v) => onMoveLayer(layer.id, layer.x, v)} />
        <NumField label="Tỉ lệ" value={layer.scale} step={0.05} onChange={(v) => v > 0 && up({ scale: v })} />
        <label className="lw-field">
          <span className="lw-field-label">Độ mờ đục</span>
          <span className="lw-range-row">
            <input type="range" min={0.05} max={1} step={0.05} value={layer.opacity} onChange={(e) => up({ opacity: Number(e.target.value) })} />
            <span className="lw-range-value">{Math.round(layer.opacity * 100)}%</span>
          </span>
        </label>
      </div>
      <div className="lw-prop-grid three">
        <NumField label="Xoay X (nghiêng)" axis="x" value={layer.rotationX || 0} onChange={(v) => up({ rotationX: v })} />
        <NumField label="Xoay Y (lắc)" axis="y" value={layer.rotationY || 0} onChange={(v) => up({ rotationY: v })} />
        <NumField label="Xoay Z (roll)" axis="z" value={layer.rotation} onChange={(v) => up({ rotation: v })} />
      </div>
    </section>
  )
}

function DepthSection({ layer, onUpdateLayer }: Pick<WorkshopLayerPropsProps, 'layer' | 'onUpdateLayer'>) {
  const zone = layer.z > 20 ? ['front', 'Tiền cảnh · đè lên trên'] : layer.z < -20 ? ['back', 'Hậu cảnh · nằm phía dưới'] : ['', 'Trọng tâm · chuẩn']
  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconLayersStack width={13} height={13} /> Chiều sâu Z</span>
        <span className={`lw-depth-badge ${zone[0]}`}>{zone[1]}</span>
      </div>
      <span className="lw-range-row">
        <input type="range" min={-500} max={800} step={5} value={layer.z} onChange={(e) => onUpdateLayer(layer.id, { z: Number(e.target.value) })}
          title="Z dương (+): Tiến lên trên (đè lên lớp dưới) · Z âm (-): Lùi xuống dưới (bị lớp trên đè)" />
        <span className="lw-range-value">{layer.z}px</span>
      </span>
      <div className="lw-chip-row lw-depth-presets">
        {DEPTH_PRESETS.map(([z, label, title]) => (
          <button key={z} type="button" className={`lw-chip${layer.z === z ? ' active' : ''}`} title={title} onClick={() => onUpdateLayer(layer.id, { z })}>{label}</button>
        ))}
      </div>
    </section>
  )
}

function RigSection({
  composite,
  layer,
  setComposite,
  onUpdateLayer
}: Pick<WorkshopLayerPropsProps, 'composite' | 'layer' | 'setComposite' | 'onUpdateLayer'>) {
  const bones = composite.rig?.bones ?? []
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const clothMatches = useMemo(
    () => scanClothFollowerRegionsForLayer(layer, composite.layers, bones),
    [layer, composite.layers, bones]
  )
  const garmentInfo = useMemo(
    () => detectGarmentCoversLegs(composite.layers, bones),
    [composite.layers, bones]
  )
  const isRobeCoveringLegs = garmentInfo.robeLayers.some((r) => r.id === layer.id)

  const handleScanCurrentLayerCloth = () => {
    if (clothMatches.length === 0) {
      const fallbackBone = bones.find((b) => b.id !== layer.boneId && /chân|đùi|tay|leg|thigh|arm/i.test(b.name))
      if (fallbackBone) {
        const extra = Array.from(new Set([...(layer.extraBoneIds ?? []), fallbackBone.id]))
        onUpdateLayer(layer.id, {
          isCloth: true,
          bindingMode: 'soft',
          clothFollowBoneId: fallbackBone.id,
          clothAmplitude: layer.clothAmplitude ?? 45,
          extraBoneIds: extra
        })
        setScanStatus(`Đã gắn vùng vải uốn theo xương "${fallbackBone.name}"`)
      } else {
        setScanStatus('Không phát hiện xương chi nào nằm dưới vùng phủ của mảnh này.')
      }
      return
    }
    const extra = Array.from(new Set([...(layer.extraBoneIds ?? []), ...clothMatches.map((m) => m.boneId)]))
    onUpdateLayer(layer.id, {
      isCloth: true,
      bindingMode: 'soft',
      clothFollowBoneId: clothMatches[0]?.boneId,
      clothAmplitude: layer.clothAmplitude ?? 45,
      extraBoneIds: extra
    })
    setScanStatus(
      `✓ Đã quét & gắn ${clothMatches.length} vùng xương uốn theo vải: ${clothMatches.map((m) => m.boneName).join(', ')}`
    )
  }

  const handleScanAllCharacterCloth = () => {
    const res = autoScanAndBindClothRegionsForComposite(composite)
    setComposite(res.composite)
    if (res.updatedLayerNames.length > 0) {
      setScanStatus(
        `✓ Đã quét toàn nhân vật: Gắn ${res.totalBoundBones} vùng xương uốn vải cho ${res.updatedLayerNames.join(', ')}`
      )
    } else {
      setScanStatus('Không phát hiện mảnh áo/váy nào che phủ xương chi.')
    }
  }

  const toggleExtraClothBone = (boneId: string) => {
    const current = new Set(layer.extraBoneIds ?? [])
    if (current.has(boneId)) current.delete(boneId)
    else current.add(boneId)
    const nextExtra = Array.from(current)
    onUpdateLayer(layer.id, {
      isCloth: nextExtra.length > 0 ? true : layer.isCloth,
      bindingMode: 'soft',
      clothFollowBoneId: nextExtra[0] ?? layer.clothFollowBoneId,
      clothAmplitude: layer.clothAmplitude ?? 45,
      extraBoneIds: nextExtra
    })
  }

  return (
    <section className="lw-prop-section">
      <div className="lw-prop-head">
        <span className="lw-prop-title"><IconBone width={13} height={13} /> Khung xương &amp; Vùng uốn vải</span>
        {layer.boneId && <span className="lw-tag bone">{layer.bindingMode === 'soft' ? 'Uốn mềm' : 'Khớp cứng'}</span>}
      </div>
      {bones.length ? (
        <>
          <div className="lw-prop-grid">
            <div className="lw-field">
              <span className="lw-field-label">Gắn vào xương chính</span>
              <Select
                size="sm"
                value={layer.boneId ?? ''}
                options={[
                  { value: '', label: 'Không gắn' },
                  ...bones.map((b) => ({ value: b.id, label: `${b.parentId ? '↳ ' : ''}${b.name}` }))
                ]}
                onChange={(v) =>
                  onUpdateLayer(layer.id, {
                    boneId: String(v) || undefined,
                    bindingMode: String(v) ? layer.bindingMode || 'soft' : undefined
                  })
                }
              />
            </div>
            <div className="lw-field">
              <span className="lw-field-label">Chế độ gắn</span>
              <Select
                size="sm"
                value={layer.bindingMode || 'soft'}
                disabled={!layer.boneId}
                options={[
                  { value: 'soft', label: 'Uốn mềm Mesh 2D' },
                  { value: 'rigid', label: 'Gắn cứng theo xương' }
                ]}
                onChange={(v) => onUpdateLayer(layer.id, { bindingMode: v as 'soft' | 'rigid' })}
              />
            </div>
          </div>

          {bones.length > 0 && (
            <div
              className="lw-cloth-dynamics-box"
              style={{
                marginTop: 8,
                padding: '9px 10px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line-soft)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span
                  style={{ minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title="Vùng vải uốn theo chân/tay (Cloth Physics)"
                >
                  👗 Vải uốn theo chân/tay
                </span>
                <label className="lw-rig-check" style={{ margin: 0, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(layer.isCloth || isRobeCoveringLegs)}
                    onChange={(e) => {
                      const isCloth = e.target.checked
                      const detectedIds = clothMatches.map((m) => m.boneId)
                      const defaultFollowBone =
                        detectedIds[0] || bones.find((b) => /chân|đùi|leg|thigh/i.test(b.name))?.id || bones[0]?.id
                      const extra = Array.from(
                        new Set([...(layer.extraBoneIds ?? []), ...(isCloth ? detectedIds : [])])
                      )
                      if (isCloth && defaultFollowBone && !extra.includes(defaultFollowBone)) {
                        extra.push(defaultFollowBone)
                      }
                      onUpdateLayer(layer.id, {
                        isCloth,
                        bindingMode: isCloth ? 'soft' : layer.bindingMode,
                        clothFollowBoneId: isCloth ? (layer.clothFollowBoneId || defaultFollowBone) : undefined,
                        clothAmplitude: isCloth ? (layer.clothAmplitude ?? 45) : undefined,
                        extraBoneIds: isCloth ? extra : []
                      })
                    }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 500 }}>
                    {layer.isCloth || isRobeCoveringLegs ? 'Đã bật' : 'Bật nhãn Vải'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  type="button"
                  className="lw-btn sm primary"
                  onClick={handleScanCurrentLayerCloth}
                  title="Tự động quét các xương Đùi/Chân/Tay nằm dưới vạt vải của mảnh này và gắn uốn mềm"
                  style={{ flex: '1 1 auto' }}
                >
                  🔍 Quét vùng vải mảnh này ({clothMatches.length})
                </button>
                <button
                  type="button"
                  className="lw-btn sm"
                  onClick={handleScanAllCharacterCloth}
                  title="Tự động quét toàn bộ nhân vật để phát hiện Áo dài / Váy che chân và gắn vùng uốn vải tự động"
                  style={{ flex: '1 1 auto' }}
                >
                  🪄 Quét toàn nhân vật
                </button>
              </div>

              {scanStatus && (
                <div
                  style={{
                    fontSize: 10.5,
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))',
                    color: 'var(--text)',
                    border: '1px solid var(--line-focus)'
                  }}
                >
                  {scanStatus}
                </div>
              )}

              {garmentInfo.hasLongGarmentCoveringLegs && (
                <div
                  style={{
                    fontSize: 10.5,
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--key) 12%, var(--bg-1))',
                    border: '1px solid color-mix(in srgb, var(--key) 35%, transparent)',
                    color: 'var(--text)',
                    lineHeight: 1.4
                  }}
                >
                  👘 <b>Trang phục Áo dài / Cổ trang che chân:</b> Phát hiện thân áo phủ qua đùi (Z={garmentInfo.minRobeZ}px &gt; Chân Z={garmentInfo.maxLegBaseZ}px). Hệ thống tự động khóa Z chân (zOrder ≤ +{garmentInfo.maxSafeLegZOrder}) để chân luôn ẩn dưới tà áo và truyền chuyển động bước chân lên vạt áo!
                </div>
              )}

              {clothMatches.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 600 }}>
                    Vùng xương nằm dưới mảnh vải này (bấm để bật/tắt uốn theo):
                  </span>
                  <div className="lw-chip-row">
                    {clothMatches.map((m) => {
                      const active = Boolean(
                        layer.extraBoneIds?.includes(m.boneId) ||
                          (isRobeCoveringLegs && m.role.startsWith('thigh'))
                      )
                      return (
                        <button
                          key={m.boneId}
                          type="button"
                          className={`lw-chip${active ? ' active' : ''}`}
                          onClick={() => toggleExtraClothBone(m.boneId)}
                          title={`${m.regionDesc} · Độ phủ ${Math.round(m.overlapRatio * 100)}%${m.coveredLayerNames.length ? ` · Che bộ phận: ${m.coveredLayerNames.join(', ')}` : ''}`}
                        >
                          {active ? '✓ ' : '+ '}
                          {m.boneName} ({Math.round(m.overlapRatio * 100)}%)
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {(layer.isCloth || isRobeCoveringLegs) && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 80 }}>Biên độ vải uốn:</span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={layer.clothAmplitude ?? 45}
                      aria-label="Biên độ uốn vải"
                      onChange={(e) =>
                        onUpdateLayer(layer.id, { isCloth: true, clothAmplitude: Number(e.target.value) })
                      }
                      style={{ flex: 1 }}
                    />
                    <strong style={{ fontSize: 11, minWidth: 36, textAlign: 'right', color: 'var(--text)' }}>
                      {layer.clothAmplitude ?? 45}%
                    </strong>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: 0, lineHeight: 1.35 }}>
                    💡 Khi chân bước hoặc nhấc gối dưới lớp áo dài, vùng lưới Mesh ở vạt áo sẽ uốn lượn vật lý theo chân với biên độ {layer.clothAmplitude ?? 45}%.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="lw-callout">Chưa có khung xương. Mở tab <b>Tạo xương</b> để thêm xương hoặc áp dụng mẫu xương nhân vật.</p>
      )}
    </section>
  )
}

/** Thuộc tính layer đang chọn: tên, bộ phận & thay thế, biến đổi, chiều sâu Z, khung xương. */
export function WorkshopLayerProps(props: WorkshopLayerPropsProps) {
  const { layer, onUpdateLayer, onDuplicate, onDelete, section = 'all' } = props
  return (
    <div className="lw-props-panel" data-mcp-region="layer_assembly_properties">
      <div className="lw-prop-head">
        <input className="lw-input" aria-label="Tên layer" value={layer.name} onChange={(e) => onUpdateLayer(layer.id, { name: e.target.value })} />
        <button type="button" className="lw-icon-btn" onClick={() => onDuplicate(layer.id)} title="Nhân bản layer (Ctrl+D)"><IconCopy width={13} height={13} /></button>
        <button type="button" className="lw-icon-btn danger" onClick={() => onDelete(layer.id)} title="Xoá layer (Delete)"><IconTrash width={13} height={13} /></button>
      </div>
      {(section === 'all' || section === 'parts') && <PartSection {...props} />}
      {(section === 'all' || section === 'transform') && <TransformSection {...props} />}
      {(section === 'all' || section === 'depth') && <DepthSection {...props} />}
      {(section === 'all' || section === 'cloth') && <RigSection {...props} />}
    </div>
  )
}
