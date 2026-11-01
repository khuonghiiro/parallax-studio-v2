import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { Select } from '../controls'
import { IconTrash } from '../icons'
import { RigNumber } from './RigNumber'
import { WorkshopBoneConstraintCard } from './WorkshopBoneConstraintCard'
import { classifyBoneSide, computeBoneInfluenceRadius } from './mohoRigHelpers'
import { IconAutoRigSpark, IconBoneAdd, IconBoneChainBuild, IconBoneMirror } from './LayerWorkshopStudioIcons'

export interface BoneTreeCardProps {
  composite: LayerComposite
  bones: LayerBone[]
  boneId: string | null
  depthMap: Map<string, number>
  selectBone: (id: string | null) => void
  onDelete: (id: string, e?: React.MouseEvent) => void
  onMirror: (id: string) => void
  onStartDraw: () => void
  onOpenBuild: () => void
  onOpenAuto: () => void
}

/** Cây phân cấp xương (Moho Bone List): thụt lề theo độ sâu, màu L/C/R, số layer đang gắn. */
export function BoneTreeCard(props: BoneTreeCardProps) {
  const { composite, bones, boneId, depthMap, selectBone, onDelete, onMirror } = props
  const bone = bones.find((b) => b.id === boneId)
  return (
    <div className="lw-card-section">
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>Cây phân cấp xương</span>
          <span className="lw-card-badge">{bones.length}</span>
        </span>
        {bone && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" className="btn xs" onClick={() => onMirror(bone.id)} title="Tạo bản sao đối xứng Trái ⇄ Phải qua trục X = 0 cho xương này và toàn bộ nhánh con">
              <IconBoneMirror width={11} height={11} />
              <span>Nhân bản L⇄R</span>
            </button>
            <button type="button" className="btn xs" onClick={() => selectBone(null)} title="Bỏ chọn xương hiện tại">
              Bỏ chọn
            </button>
          </div>
        )}
      </div>
      <div className="lw-bone-list" role="listbox" aria-label="Danh sách xương">
        {bones.map((b) => {
          const isSelected = b.id === boneId
          const side = classifyBoneSide(b)
          const depth = Math.min(6, depthMap.get(b.id) ?? 0)
          const boundLayersCount = composite.layers.filter((l) => l.boneId === b.id).length
          const limited = b.minAngle !== undefined && b.maxAngle !== undefined
          return (
            <div
              key={b.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => selectBone(b.id)}
              className={`lw-bone-item side-${side}${isSelected ? ' active' : ''}`}
              style={{ paddingLeft: `${8 + depth * 12}px` }}
            >
              <div className="lw-bone-item-label">
                <span className={`lw-bone-side-dot side-${side}`} title={`Nhóm ${side.toUpperCase()}`} />
                <span className="lw-bone-item-indent">{b.pin ? '📌' : depth > 0 ? '↳' : '◇'}</span>
                <span className="lw-bone-item-name">{b.name}</span>
                {limited && (
                  <span className="lw-bone-item-limit" title={`Giới hạn góc ${b.minAngle}° … ${b.maxAngle}°`}>
                    ∠
                  </span>
                )}
                {boundLayersCount > 0 && <span className="lw-bone-item-count">{boundLayersCount} lớp</span>}
              </div>
              <button type="button" className="lw-bone-item-delete" onClick={(e) => onDelete(b.id, e)} title="Xóa xương này (Del)" aria-label={`Xóa xương ${b.name}`}>
                <IconTrash width={11} height={11} />
              </button>
            </div>
          )
        })}
        {!bones.length && (
          <div className="lw-rig-empty-hint">
            <p>Chưa có xương nào trên nhân vật / vật thể.</p>
            <div className="lw-rig-empty-actions">
              <button type="button" className="btn xs primary" onClick={props.onStartDraw}>
                <IconBoneAdd width={12} height={12} /> Vẽ xương (A) trên khung 2D
              </button>
              <button type="button" className="btn xs" onClick={props.onOpenBuild}>
                <IconBoneChainBuild width={12} height={12} /> Dựng thủ công
              </button>
              <button type="button" className="btn xs" onClick={props.onOpenAuto}>
                <IconAutoRigSpark width={12} height={12} /> Tự động: nhện, cá, ngựa, chim…
              </button>
            </div>
          </div>
        )}
      </div>
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
  const presets = isHand ? HAND_PRESETS : FOOT_PRESETS
  return (
    <div className="lw-limb-quick-box">
      <div className="lw-limb-quick-title">{isHand ? 'Góc nhanh Bàn tay:' : 'Góc nhanh Bàn chân:'}</div>
      <div className="lw-limb-quick-pills">
        {presets.map((item) => (
          <button key={item.label} type="button" className="btn xs" onClick={() => patch({ angle: item.angle })}>
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
  onDelete: (id: string) => void
}

/** Thuộc tính khớp đang chọn: tên, xương cha, toạ độ, độ dài, vùng uốn, giới hạn góc, Pin Bone. */
export function BoneInspectorCard({ bone, bones, mirrorTwin, mirrorDraw, patch, onDelete }: BoneInspectorCardProps) {
  return (
    <div className="lw-card-section">
      <div className="lw-card-header">
        <span className="lw-card-title">Khớp: {bone.name}</span>
        <span className="lw-card-badge">{bone.pin ? 'Pin Bone' : `R=${Math.round(computeBoneInfluenceRadius(bone))}px`}</span>
      </div>
      {mirrorDraw && mirrorTwin && (
        <div className="lw-mirror-pair-note">
          <IconBoneMirror width={11} height={11} />
          <span>Đang đồng bộ đối xứng với &ldquo;{mirrorTwin.name}&rdquo;</span>
        </div>
      )}
      <div className="lw-form-group">
        <label className="lw-form-label" htmlFor="lw-bone-name-input">
          Tên xương:
        </label>
        <input id="lw-bone-name-input" className="lw-field-input" aria-label="Tên xương" value={bone.name} onChange={(e) => e.target.value.trim() && patch({ name: e.target.value })} />
      </div>
      <div className="lw-form-group">
        <span className="lw-form-label">Xương cha (Phân cấp FK/IK):</span>
        <Select
          size="sm"
          dropdownWidth={280}
          style={{ width: '100%' }}
          value={bone.parentId ?? ''}
          options={[{ value: '', label: 'Không có (Xương gốc Root)' }, ...bones.filter((b) => b.id !== bone.id).map((b) => ({ value: b.id, label: b.name }))]}
          onChange={(val) => patch({ parentId: String(val) || undefined })}
        />
      </div>
      <div className="lw-rig-grid">
        <RigNumber label="Khớp X" value={bone.x} onChange={(x) => patch({ x })} />
        <RigNumber label="Khớp Y" value={bone.y} onChange={(y) => patch({ y })} />
        <RigNumber label="Chiều dài (px)" value={bone.length} min={10} onChange={(length) => patch({ length })} />
        <RigNumber label="Hướng xương (°)" value={bone.angle} onChange={(angle) => patch({ angle })} />
      </div>
      <div className="lw-moho-strength-row">
        <div className="lw-moho-strength-head">
          <span>Vùng ảnh hưởng Mesh (Strength)</span>
          <strong>{Math.round((bone.strength ?? 1) * 100)}%</strong>
        </div>
        <input type="range" min={0.15} max={3.0} step={0.05} value={bone.strength ?? 1} aria-label="Vùng ảnh hưởng xương" onChange={(e) => patch({ strength: Number(e.target.value) })} />
      </div>
      {!bone.pin && <WorkshopBoneConstraintCard bone={bone} patch={patch} />}
      <LimbQuickAngles bone={bone} patch={patch} />
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
        <button
          type="button"
          className="btn xs"
          onClick={() => patch({ pin: !bone.pin, ...(bone.pin ? { length: Math.max(40, bone.length) } : { length: 16 }) })}
          title="Chuyển đổi giữa Xương thường và Chốt Pin Bone (Moho Pin Bone)"
        >
          {bone.pin ? '🦴 Đổi thành Xương dài' : '📌 Đổi thành Pin Bone'}
        </button>
        <button type="button" className="btn xs danger" style={{ color: 'var(--danger, #ef4444)' }} onClick={() => onDelete(bone.id)} title="Xóa xương này và toàn bộ nhánh con (Del)">
          <IconTrash width={11} height={11} />
          <span>Xóa xương</span>
        </button>
      </div>
    </div>
  )
}
