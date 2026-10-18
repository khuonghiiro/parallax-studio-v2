import { MIXAMO_RING_GROUPS, type MixamoLandmarkId } from './workshopMixamoAutoRig'
import { MixamoHollowRingIcon } from './MixamoReferenceGuide'
import { IconBone, IconInfo, IconWand } from '../icons'

export const SIZE_PRESETS = [
  { label: '60%', scale: 0.6, title: 'Khung xương nhỏ (60%) cho nhân vật Chibi / Trẻ em' },
  { label: '80%', scale: 0.8, title: 'Khung xương cỡ vừa (80%)' },
  { label: '100%', scale: 1.0, title: 'Khung xương tỉ lệ chuẩn (100%)' },
  { label: '125%', scale: 1.25, title: 'Khung xương lớn (125%) cho nhân vật cao lớn' }
]

export interface MixamoPlacerToolbarProps {
  compact: boolean
  scale: number
  onAutoFit: () => void
  onScalePreset: (scale: number) => void
  onScaleSlider: (percent: number) => void
  symmetry: boolean
  setSymmetry: (v: boolean) => void
  showBones: boolean
  setShowBones: (v: boolean) => void
  showExtra: boolean
  setShowExtra: (v: boolean) => void
  showGuide: boolean
  setShowGuide: (v: boolean) => void
}

/** Thanh công cụ của sân khấu đặt vòng mốc: tự khớp, tỉ lệ khung xương, tuỳ chọn hiển thị. */
export function MixamoPlacerToolbar(p: MixamoPlacerToolbarProps) {
  return (
    <div className={`mx-placer-toolbar${p.compact ? ' compact' : ''}`}>
      <div className="mx-placer-row">
        <button type="button" className="lw-btn sm primary" onClick={p.onAutoFit} title="Tự động đo kích thước layer nhân vật để đặt 12 vòng mốc vừa khít">
          <IconWand width={12} height={12} /> Tự khớp
        </button>
        <div className="mx-seg" role="group" aria-label="Tỉ lệ khung xương">
          {SIZE_PRESETS.map((s) => (
            <button key={s.label} type="button" className={p.scale === Math.round(s.scale * 100) ? 'active' : ''} onClick={() => p.onScalePreset(s.scale)} title={s.title}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="mx-scale" title="Tỉ lệ khung xương tuỳ chỉnh">
          <input type="range" min={35} max={160} step={5} value={p.scale} onChange={(e) => p.onScaleSlider(Number(e.target.value))} />
          <b>{p.scale}%</b>
        </label>
      </div>
      <div className="mx-placer-row">
        <label className="mx-check" title="Kéo vòng một bên, bên kia tự đối xứng qua trục Háng (giữ Alt khi kéo để chỉnh riêng 1 bên)">
          <input type="checkbox" checked={p.symmetry} onChange={(e) => p.setSymmetry(e.target.checked)} /> Đối xứng
        </label>
        <label className="mx-check" title="Hiển thị 15 đoạn xương nối giữa các vòng mốc">
          <input type="checkbox" checked={p.showBones} onChange={(e) => p.setShowBones(e.target.checked)} /> Nối xương
        </label>
        <label className="mx-check" title="Hiện thêm 2 điểm trục Đỉnh đầu & Ngực">
          <input type="checkbox" checked={p.showExtra} onChange={(e) => p.setShowExtra(e.target.checked)} /> Đỉnh đầu & Ngực
        </label>
        {!p.compact && (
          <button type="button" className={`lw-chip${p.showGuide ? ' active' : ''}`} onClick={() => p.setShowGuide(!p.showGuide)} title="Ẩn/hiện sơ đồ hình nhân mẫu 7 nhóm khớp">
            <IconInfo width={11} height={11} /> Sơ đồ mẫu
          </button>
        )}
      </div>
    </div>
  )
}

const SHORT_LABEL: Record<string, string> = {
  chin: 'Cằm',
  shoulders: 'Hai vai',
  elbows: 'Khuỷu tay',
  wrists: 'Cổ tay',
  groin: 'Háng',
  knees: 'Đầu gối',
  ankles: 'Cổ chân'
}

/** Dải chọn nhanh 7 nhóm vòng mốc (chế độ gọn trong cột Tạo xương). */
export function MixamoRingChips({ activeId, onSelect }: { activeId: MixamoLandmarkId; onSelect: (id: MixamoLandmarkId) => void }) {
  return (
    <div className="mx-ring-chips" role="group" aria-label="Nhóm vòng mốc">
      {MIXAMO_RING_GROUPS.map((g) => {
        const active = g.landmarkIds.includes(activeId)
        return (
          <button key={g.groupId} type="button" className={`mx-ring-chip${active ? ' active' : ''}`} onClick={() => onSelect(g.landmarkIds[0])}
            title={`${g.viTitle}: ${g.hint}`} style={{ ['--ring-color' as string]: g.color }}>
            <MixamoHollowRingIcon color={g.color} size={13} active={active} />
            <span>{SHORT_LABEL[g.groupId] ?? g.viTitle.split(' /')[0]}</span>
          </button>
        )
      })}
      <span className="mx-ring-chips-hint" title="12 vòng mốc tạo ra 15 xương"><IconBone width={11} height={11} /> 12 → 15</span>
    </div>
  )
}
