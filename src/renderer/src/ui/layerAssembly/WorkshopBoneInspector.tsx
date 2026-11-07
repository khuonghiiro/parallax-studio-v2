import { useEffect, useMemo, useRef, useState } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { Select } from '../controls'
import { IconChevronDown, IconPin, IconSearch, IconTrash, IconX } from '../icons'
import { RigNumber } from './RigNumber'
import { WorkshopBoneConstraintCard } from './WorkshopBoneConstraintCard'
import { classifyBoneSide, computeBoneInfluenceRadius } from './mohoRigHelpers'
import { boneAncestorIds, buildBoneTreeRows, type BoneTreeRow } from './workshopBoneTree'
import { IconAutoRigSpark, IconBoneAdd, IconBoneChainBuild, IconBoneDuplicateLR, IconBoneMirror, IconFlexiMeshBind } from './LayerWorkshopStudioIcons'
import { openCutoutPartRig } from './rigToolStore'

export interface BoneTreeCardProps {
  composite: LayerComposite
  bones: LayerBone[]
  boneId: string | null
  selectBone: (id: string | null) => void
  onDelete: (id: string, e?: React.MouseEvent) => void
  onStartDraw: () => void
  onOpenBuild: () => void
  onOpenAuto: () => void
}

function BoneTreeEmpty({ onStartDraw, onOpenBuild, onOpenAuto, composite }: Pick<BoneTreeCardProps, 'onStartDraw' | 'onOpenBuild' | 'onOpenAuto' | 'composite'>) {
  return (
    <div className="lw-rig-empty-hint">
      <p>Chưa có xương nào trên nhân vật / vật thể.</p>
      <div className="lw-rig-empty-grid" role="group" aria-label="Khởi tạo khung xương">
        <button
          type="button"
          className="lw-rig-action-card is-primary lw-btn-cutout-start"
          onClick={() => openCutoutPartRig(composite.layers[0]?.id)}
          title="Vẽ xương theo từng bộ phận layer trên Sân khấu 2D (hiện ô preview 2 bên và mũi tên chỉ dẫn)"
        >
          <span className="lw-rig-card-icon">
            <IconFlexiMeshBind width={15} height={15} />
          </span>
          <span className="lw-rig-card-text">
            <strong>Theo bộ phận</strong>
            <small>Vẽ xương bám layer 2D</small>
          </span>
        </button>

        <button
          type="button"
          className="lw-rig-action-card"
          onClick={onStartDraw}
          title="Vẽ xương tự do bằng công cụ Vẽ xương (phím A) trên Sân khấu 2D"
        >
          <span className="lw-rig-card-icon">
            <IconBoneAdd width={15} height={15} />
          </span>
          <span className="lw-rig-card-text">
            <strong>Vẽ tự do (A)</strong>
            <small>Vẽ trên khung 2D</small>
          </span>
        </button>

        <button
          type="button"
          className="lw-rig-action-card"
          onClick={onOpenBuild}
          title="Mở tab dựng kết cấu xương thủ công: chuỗi đốt, chia đốt, đối xứng"
        >
          <span className="lw-rig-card-icon">
            <IconBoneChainBuild width={15} height={15} />
          </span>
          <span className="lw-rig-card-text">
            <strong>Dựng thủ công</strong>
            <small>Chuỗi đốt & chi khớp</small>
          </span>
        </button>

        <button
          type="button"
          className="lw-rig-action-card"
          onClick={onOpenAuto}
          title="Thư viện khung xương tự động: người, thú, cá, chim, nhện…"
        >
          <span className="lw-rig-card-icon">
            <IconAutoRigSpark width={15} height={15} />
          </span>
          <span className="lw-rig-card-text">
            <strong>Khung tự động</strong>
            <small>Sinh vật, người, thú…</small>
          </span>
        </button>
      </div>
    </div>
  )
}

interface BoneTreeRowItemProps {
  row: BoneTreeRow
  selected: boolean
  layers: number
  onSelect: () => void
  onToggle: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

function BoneTreeRowItem({ row, selected, layers, onSelect, onToggle, onDelete }: BoneTreeRowItemProps) {
  const { bone: b, depth, childCount, collapsed } = row
  const side = classifyBoneSide(b)
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={childCount > 0 ? !collapsed : undefined}
      data-bone-row={b.id}
      onClick={onSelect}
      className={`lw-bone-item side-${side}${selected ? ' active' : ''}`}
      style={{ paddingLeft: `${4 + Math.min(8, depth) * 12}px` }}
    >
      <div className="lw-bone-item-label">
        {childCount > 0 ? (
          <button type="button" className={`lw-bone-item-toggle${collapsed ? ' collapsed' : ''}`} onClick={onToggle} aria-label={collapsed ? 'Mở nhánh' : 'Thu nhánh'}>
            <IconChevronDown width={10} height={10} />
          </button>
        ) : (
          <span className="lw-bone-item-toggle-spacer" />
        )}
        <span className={`lw-bone-side-dot side-${side}`} title={`Nhóm ${side.toUpperCase()}`} />
        {b.pin && <IconPin width={10} height={10} className="lw-bone-item-pin" />}
        <span className="lw-bone-item-name">{b.name}</span>
        {collapsed && <span className="lw-bone-item-sub">+{childCount}</span>}
        {b.parentId && (
          <span
            className={`lw-bone-joint-tag ${b.parentJoint === 'head' ? 'head' : 'tail'}`}
            title={b.parentJoint === 'head' ? 'Neo vào Trục Gốc của cha' : 'Neo vào Trục Ngọn của cha'}
          >
            {b.parentJoint === 'head' ? 'Gốc' : 'Ngọn'}
          </span>
        )}
        {b.minAngle !== undefined && b.maxAngle !== undefined && (
          <span className="lw-bone-item-limit" title={`Giới hạn góc ${b.minAngle}° … ${b.maxAngle}°`}>
            ∠
          </span>
        )}
        {layers > 0 && (
          <span className="lw-bone-item-count" title={`${layers} layer đang gắn`}>
            {layers}
          </span>
        )}
      </div>
      <button type="button" className="lw-bone-item-delete" onClick={onDelete} title="Xóa xương này và nhánh con (Del)" aria-label={`Xóa xương ${b.name}`}>
        <IconTrash width={11} height={11} />
      </button>
    </div>
  )
}

/** Cây phân cấp xương (Moho Bone List): duyệt sâu cha → con, thu gọn nhánh, lọc theo tên, tự cuộn tới xương đang chọn. */
export function BoneTreeCard(props: BoneTreeCardProps) {
  const { composite, bones, boneId, selectBone, onDelete } = props
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildBoneTreeRows(bones, collapsed, filter), [bones, collapsed, filter])
  const boundCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of composite.layers) if (l.boneId) map.set(l.boneId, (map.get(l.boneId) ?? 0) + 1)
    return map
  }, [composite.layers])
  const branchIds = useMemo(() => new Set(bones.map((b) => b.parentId).filter(Boolean) as string[]), [bones])

  useEffect(() => {
    if (!boneId) return
    const hidden = boneAncestorIds(bones, boneId).filter((id) => collapsed.has(id))
    if (hidden.length) {
      setCollapsed((prev) => new Set([...prev].filter((id) => !hidden.includes(id))))
      return
    }
    listRef.current?.querySelector<HTMLElement>(`[data-bone-row="${CSS.escape(boneId)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [boneId, bones, collapsed])

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allCollapsed = branchIds.size > 0 && [...branchIds].every((id) => collapsed.has(id))

  return (
    <div className="lw-card-section lw-bone-tree-card" data-mcp-region="layer_assembly_bone_tree">
      <div className="lw-bone-tree-head">
        <span className="lw-card-title">
          <span>Cây xương</span>
          <span className="lw-card-badge">{bones.length}</span>
        </span>
        {bones.length > 0 && (
          <div className="lw-bone-tree-tools">
            <label className="lw-bone-tree-search" title="Lọc xương theo tên">
              <IconSearch width={11} height={11} />
              <input value={filter} placeholder="Tìm xương…" aria-label="Tìm xương" onChange={(e) => setFilter(e.target.value)} />
              {filter && (
                <button type="button" aria-label="Xoá lọc" onClick={() => setFilter('')}>
                  <IconX width={10} height={10} />
                </button>
              )}
            </label>
            <button
              type="button"
              className="lw-bone-tree-btn lw-btn-cutout-quick"
              onClick={() => openCutoutPartRig(composite.layers[0]?.id)}
              title="Mở chế độ vẽ xương theo từng bộ phận layer (2D) kèm ô preview 2 bên & mũi tên nét đứt"
            >
              🎨 Vẽ theo layer (2D)
            </button>
            {branchIds.size > 0 && (
              <button
                type="button"
                className="lw-bone-tree-btn"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(branchIds))}
                title={allCollapsed ? 'Mở rộng mọi nhánh' : 'Thu gọn mọi nhánh'}
              >
                {allCollapsed ? 'Mở hết' : 'Thu gọn'}
              </button>
            )}
          </div>
        )}
      </div>
      {bones.length === 0 ? (
        <BoneTreeEmpty onStartDraw={props.onStartDraw} onOpenBuild={props.onOpenBuild} onOpenAuto={props.onOpenAuto} composite={composite} />
      ) : (
        <div className="lw-bone-list" role="tree" aria-label="Danh sách xương" ref={listRef}>
          {rows.map((row) => (
            <BoneTreeRowItem
              key={row.bone.id}
              row={row}
              selected={row.bone.id === boneId}
              layers={boundCount.get(row.bone.id) ?? 0}
              onSelect={() => selectBone(row.bone.id)}
              onToggle={(e) => toggle(row.bone.id, e)}
              onDelete={(e) => onDelete(row.bone.id, e)}
            />
          ))}
          {rows.length === 0 && <div className="lw-bone-tree-noresult">Không có xương khớp “{filter}”.</div>}
        </div>
      )}
    </div>
  )
}

const HAND_PRESETS = [
  { label: 'Thẳng 90°', angle: 90 },
  { label: 'Nắm 55°', angle: 55 },
  { label: 'Ngửa 135°', angle: 135 },
  { label: 'Xuôi 75°', angle: 75 }
]
const FOOT_PRESETS = [
  { label: 'Phẳng 0°', angle: 0 },
  { label: 'Nhón +30°', angle: 30 },
  { label: 'Gót -25°', angle: -25 },
  { label: 'Bước +12°', angle: 12 }
]

function LimbQuickAngles({ bone, patch }: { bone: LayerBone; patch: (p: Partial<LayerBone>) => void }) {
  const tag = `${bone.id} ${bone.name || ''}`
  const isHand = /hand|wrist|finger|palm|bàn tay|cổ tay|ngón/i.test(tag)
  const isFoot = /foot|ankle|toe|heel|bàn chân|cổ chân|mũi chân|gót/i.test(tag)
  if (!isHand && !isFoot) return null
  return (
    <div className="lw-bone-insp-row">
      <span className="lw-bone-insp-label">{isHand ? 'Bàn tay' : 'Bàn chân'}</span>
      <div className="lw-creature-pills">
        {(isHand ? HAND_PRESETS : FOOT_PRESETS).map((item) => (
          <button key={item.label} type="button" className="lw-creature-pill" onClick={() => patch({ angle: item.angle })}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface BoneInspectorCardProps {
  bone: LayerBone
  bones: LayerBone[]
  mirrorTwin: LayerBone | null
  mirrorDraw: boolean
  patch: (p: Partial<LayerBone>) => void
  patchAllDelta?: (delta: BoneEnvelopeDeltaPatch) => void
  onDelete: (id: string) => void
  onMirror: (id: string) => void
  onSplit?: (id: string) => void
  onDeselect: () => void
}

function InspectorHeader({ bone, patch, onDelete, onMirror, onSplit, onDeselect }: Pick<BoneInspectorCardProps, 'bone' | 'patch' | 'onDelete' | 'onMirror' | 'onSplit' | 'onDeselect'>) {
  const side = classifyBoneSide(bone)
  return (
    <div className="lw-bone-insp-head">
      <span className={`lw-bone-side-dot side-${side}`} />
      <input className="lw-field-input lw-bone-insp-name" aria-label="Tên xương" value={bone.name} onChange={(e) => e.target.value.trim() && patch({ name: e.target.value })} />
      <button
        type="button"
        className={`lw-bone-insp-icon${bone.pin ? ' active' : ''}`}
        onClick={() => patch({ pin: !bone.pin, length: bone.pin ? Math.max(40, bone.length) : 16 })}
        title={bone.pin ? 'Đổi Pin Bone thành xương dài' : 'Đổi thành chốt Pin Bone (Moho)'}
        aria-pressed={Boolean(bone.pin)}
      >
        <IconPin width={12} height={12} />
      </button>
      {!bone.pin && bone.length >= 16 && (
        <button
          type="button"
          className="lw-bone-insp-icon"
          onClick={() => onSplit?.(bone.id)}
          title="✂️ Chia đôi xương (Tạo khớp gối/khuỷu 2 đoạn chuẩn Moho)"
        >
          ✂️
        </button>
      )}
      <button type="button" className="lw-bone-insp-icon" onClick={() => onMirror(bone.id)} title="Nhân bản xương + nhánh con sang bên kia trục X = 0">
        <IconBoneDuplicateLR width={12} height={12} />
      </button>
      <button type="button" className="lw-bone-insp-icon danger" onClick={() => onDelete(bone.id)} title="Xóa xương này và toàn bộ nhánh con (Del)">
        <IconTrash width={12} height={12} />
      </button>
      <button type="button" className="lw-bone-insp-icon" onClick={onDeselect} title="Bỏ chọn xương (Esc)">
        <IconX width={12} height={12} />
      </button>
    </div>
  )
}


export interface BoneEnvelopeDeltaPatch {
  lengthDelta?: number
  strengthDelta?: number
  reachDelta?: number
  meshEnvelope?: boolean
}

interface BoneEnvelopeControlsProps {
  bone: LayerBone
  bones: LayerBone[]
  patch: (p: Partial<LayerBone>) => void
  patchAllDelta?: (delta: BoneEnvelopeDeltaPatch) => void
}

function BoneEnvelopeControls({ bone, bones, patch, patchAllDelta }: BoneEnvelopeControlsProps) {
  const [applyAll, setApplyAll] = useState(false)

  // 1. Độ rộng vùng uốn (strength)
  const handleWidthChange = (val: number) => {
    const cur = bone.strength ?? 1
    const delta = Number((val - cur).toFixed(2))
    if (applyAll && patchAllDelta) {
      patchAllDelta({ strengthDelta: delta })
    } else {
      patch({ strength: val })
    }
  }

  // 2. Độ dài vùng uốn (influenceReach)
  const handleReachChange = (val: number) => {
    const cur = bone.influenceReach ?? 1
    const delta = Number((val - cur).toFixed(2))
    if (applyAll && patchAllDelta) {
      patchAllDelta({ reachDelta: delta })
    } else {
      patch({ influenceReach: val })
    }
  }

  // 3. Kích thước xương (length): Cộng trừ delta tương đối cho từng xương theo kích thước có sẵn
  const handleLengthChange = (targetLen: number) => {
    const delta = targetLen - bone.length
    if (applyAll && patchAllDelta) {
      patchAllDelta({ lengthDelta: delta })
    } else {
      patch({ length: targetLen })
    }
  }

  // 4. Toggle Vùng uốn theo Mesh
  const handleToggleMeshEnvelope = (nextVal: boolean) => {
    if (applyAll && patchAllDelta) {
      patchAllDelta({ meshEnvelope: nextVal })
    } else {
      patch({ meshEnvelope: nextVal })
    }
  }

  const reach = bone.influenceReach ?? 1.0

  return (
    <div className="lw-card-section lw-envelope-control-box" style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Vùng uốn & Kích thước</span>
        <div className="lw-creature-pills" role="radiogroup" aria-label="Phạm vi áp dụng">
          <button
            type="button"
            role="radio"
            aria-checked={!applyAll}
            className={`lw-creature-pill${!applyAll ? ' active' : ''}`}
            onClick={() => setApplyAll(false)}
            title="Chỉ áp dụng cho xương đang chọn"
          >
            Chỉ xương này
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={applyAll}
            className={`lw-creature-pill${applyAll ? ' active' : ''}`}
            onClick={() => setApplyAll(true)}
            title="Cộng/trừ tương đối theo kích thước có sẵn của từng xương trên toàn cơ thể (không ép bằng nhau)"
          >
            Toàn bộ xương ({bones.length})
          </button>
        </div>
      </div>

      <div className="lw-bone-insp-row" title="Độ rộng vùng ảnh hưởng uốn Mesh (Bán kính viên nang Moho)">
        <span className="lw-bone-insp-label">Độ rộng</span>
        <input
          type="range"
          min={0.15}
          max={3.5}
          step={0.05}
          value={bone.strength ?? 1}
          aria-label="Độ rộng vùng uốn"
          onChange={(e) => handleWidthChange(Number(e.target.value))}
        />
        <strong className="lw-bone-insp-value">{Math.round((bone.strength ?? 1) * 100)}%</strong>
        <span className="lw-bone-insp-hint">R {Math.round(computeBoneInfluenceRadius(bone))}px</span>
      </div>

      <div className="lw-bone-insp-row" title="Độ dài vươn xa của vùng uốn dọc theo thân xương">
        <span className="lw-bone-insp-label">Độ dài uốn</span>
        <input
          type="range"
          min={0.5}
          max={2.5}
          step={0.05}
          value={reach}
          aria-label="Độ dài vùng uốn"
          onChange={(e) => handleReachChange(Number(e.target.value))}
        />
        <strong className="lw-bone-insp-value">{Math.round(reach * 100)}%</strong>
        <span className="lw-bone-insp-hint">{Math.round(bone.length * reach)}px</span>
      </div>

      <div className="lw-bone-insp-row" title="Kích thước độ dài xương (Cộng/trừ tương đối từng xương khi chọn Toàn bộ xương)">
        <span className="lw-bone-insp-label">Kích thước</span>
        <input
          type="range"
          min={10}
          max={300}
          step={1}
          value={bone.length}
          aria-label="Kích thước xương"
          onChange={(e) => handleLengthChange(Number(e.target.value))}
        />
        <strong className="lw-bone-insp-value">{Math.round(bone.length)}px</strong>
      </div>

      <div className="lw-bone-insp-row" style={{ marginTop: 4 }} title="Vùng uốn theo Mesh: Sử dụng trực tiếp vùng bao Mesh của bộ phận, đảm bảo không hụt đỉnh và không lấn sang bộ phận khác">
        <span className="lw-bone-insp-label">Theo Mesh</span>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(bone.meshEnvelope)}
          className={`lw-moho-opt-pill${bone.meshEnvelope ? ' active' : ''}`}
          onClick={() => handleToggleMeshEnvelope(!bone.meshEnvelope)}
          style={{ flex: 1, justifyContent: 'center' }}
          title="Bật: Sử dụng trực tiếp vùng bao Mesh của bộ phận (không hụt đỉnh, không lấn sang bên khác)"
        >
          <span>{bone.meshEnvelope ? '📐 Bám sát Mesh (BẬT)' : 'Viên nang mặc định'}</span>
        </button>
      </div>
    </div>
  )
}

/** Thuộc tính khớp đang chọn, gọn trong 1 khung cuộn riêng: tên + thao tác nhanh, xương cha, hình học, vùng uốn, giới hạn góc. */
export function BoneInspectorCard(props: BoneInspectorCardProps) {
  const { bone, bones, mirrorTwin, mirrorDraw, patch } = props
  return (
    <div className="lw-card-section lw-bone-insp-card" data-mcp-region="layer_assembly_bone_inspector">
      <InspectorHeader {...props} />
      {mirrorDraw && mirrorTwin && (
        <div className="lw-mirror-pair-note">
          <IconBoneMirror width={11} height={11} />
          <span>Đồng bộ đối xứng với &ldquo;{mirrorTwin.name}&rdquo;</span>
        </div>
      )}
      <div className="lw-bone-insp-row">
        <span className="lw-bone-insp-label">Xương cha</span>
        <Select
          size="sm"
          dropdownWidth={260}
          style={{ flex: 1, minWidth: 0 }}
          value={bone.parentId ?? ''}
          options={[{ value: '', label: 'Không có (Root)' }, ...bones.filter((b) => b.id !== bone.id).map((b) => ({ value: b.id, label: b.name }))]}
          onChange={(val) => patch({ parentId: String(val) || undefined })}
        />
      </div>
      {bone.parentId && (
        <div className="lw-bone-insp-row">
          <span className="lw-bone-insp-label">Khớp neo cha</span>
          <div className="lw-joint-pill-group" role="group" aria-label="Khớp neo cha">
            <button
              type="button"
              className={`lw-joint-pill${bone.parentJoint !== 'head' ? ' active' : ''}`}
              title="Neo vào Trục Ngọn của xương cha (đầu nhọn/vòng nhỏ)"
              onClick={() => patch({ parentJoint: 'tail' })}
            >
              Trục Ngọn (Tail)
            </button>
            <button
              type="button"
              className={`lw-joint-pill${bone.parentJoint === 'head' ? ' active' : ''}`}
              title="Neo vào Trục Gốc của xương cha (vòng tròn to)"
              onClick={() => patch({ parentJoint: 'head' })}
            >
              Trục Gốc (Head)
            </button>
          </div>
        </div>
      )}
      <div className="lw-bone-insp-grid">
        <RigNumber label="Khớp X" value={bone.x} onChange={(x) => patch({ x })} />
        <RigNumber label="Khớp Y" value={bone.y} onChange={(y) => patch({ y })} />
        <RigNumber label="Dài (px)" value={bone.length} min={1} onChange={(length) => patch({ length })} />
        <RigNumber label="Góc (°)" value={bone.angle} onChange={(angle) => patch({ angle })} />
      </div>

      {/* Điều chỉnh độ dài xương trực quan (Length Slider + Phím nhanh +-10px) */}
      {!bone.pin && (
        <div
          className="lw-bone-length-box"
          style={{
            margin: '8px 0 4px',
            padding: '7px 9px',
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius, 5px)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
              Độ dài xương: <strong style={{ color: 'var(--accent-cyan)' }}>{Math.round(bone.length)}px</strong>
            </span>
            <div style={{ display: 'flex', gap: '3px' }}>
              <button
                type="button"
                className="btn xs ghost"
                style={{ padding: '0 6px', height: '20px', fontSize: '10px' }}
                onClick={() => patch({ length: Math.max(10, Math.round(bone.length - 10)) })}
                title="Thu ngắn 10px (-10px)"
              >
                -10px
              </button>
              <button
                type="button"
                className="btn xs ghost"
                style={{ padding: '0 6px', height: '20px', fontSize: '10px' }}
                onClick={() => patch({ length: Math.min(500, Math.round(bone.length + 10)) })}
                title="Kéo dài 10px (+10px)"
              >
                +10px
              </button>
            </div>
          </div>
          <input
            type="range"
            min={10}
            max={400}
            step={1}
            value={bone.length}
            aria-label="Thanh trượt độ dài xương"
            onChange={(e) => patch({ length: Number(e.target.value) })}
            style={{ width: '100%', margin: 0 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', color: 'var(--text-faint)' }}>
            <span>💡</span>
            <span>Kéo vòng tròn ở ngọn (Tail) trên sân khấu 2D để đổi độ dài & góc xoay</span>
          </div>
        </div>
      )}
<BoneEnvelopeControls bone={bone} bones={bones} patch={patch} patchAllDelta={props.patchAllDelta} />
      <LimbQuickAngles bone={bone} patch={patch} />
      {!bone.pin && <WorkshopBoneConstraintCard bone={bone} patch={patch} />}
    </div>
  )
}
