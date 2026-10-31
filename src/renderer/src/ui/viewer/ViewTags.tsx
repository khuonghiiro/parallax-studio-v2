import { useView, type PrimaryView } from '../../store/view'
import { IconCamera, IconCube, IconCameraStage, IconDepth25D } from '../icons'
import { useResponsiveViewport } from '../primitives'
import { effectiveDeviceViews, VIEW_ORDER } from './taggedLayout'

const tags = [
  {
    id: 'camera',
    dom: 'camera',
    label: 'Camera',
    shortPhone: 'Cam',
    hint: 'Khung nhìn Camera chính (Kết quả Render)',
    Icon: IconCamera
  },
  {
    id: 'editor',
    dom: '3d',
    label: '3D',
    shortPhone: '3D',
    hint: 'Không gian 3D (Phối cảnh đa chiều)',
    Icon: IconCube
  },
  {
    id: 'animate2d',
    dom: 'animate2d',
    label: 'Cam 2D',
    shortPhone: 'Lộ trình',
    hint: 'Sân khấu Camera 2D (Lộ trình & Keyframe)',
    Icon: IconCameraStage
  },
  {
    id: 'topview',
    dom: 'topview',
    label: 'Độ sâu 2.5D',
    shortPhone: 'Độ sâu',
    hint: 'Sơ đồ Độ sâu 2.5D (Trục Z-Depth)',
    Icon: IconDepth25D
  }
] as const

export function ViewTags() {
  const view = useView()
  const { breakpoint, isPhone, isTablet } = useResponsiveViewport()
  const active = effectiveDeviceViews(view, breakpoint)

  const toggle = (id: PrimaryView) => {
    if (isPhone) {
      view.set({ activeViews: [id], primary: id, split: false, animate2dSplit: false })
      return
    }
    if (isTablet) {
      if (active.includes(id)) {
        const rest = active.filter((item) => item !== id)
        if (rest.length) view.set({ activeViews: rest, primary: rest[0] })
        return
      }
      const kept = active.includes(view.primary) ? view.primary : active[0]
      const next = VIEW_ORDER.filter((item) => item === kept || item === id)
      view.set({ activeViews: next, primary: id })
      return
    }
    const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id]
    if (next.length) view.set({ activeViews: next, primary: next.includes(id) ? id : next[0] })
  }

  return (
    <div className="viewer-mode-seg viewer-view-tags" role="group" aria-label="Bật các khung xem">
      {tags.map(({ id, dom, label, shortPhone, hint, Icon }) => {
        const isActive = active.includes(id)
        return (
          <button
            key={id}
            id={`view-${dom}`}
            type="button"
            className={`seg-btn${isPhone ? ' phone-labeled' : ' icon-only'}${isActive ? ' active' : ''}`}
            aria-pressed={isActive}
            aria-label={label}
            disabled={!isPhone && active.length === 1 && active[0] === id}
            title={
              isPhone
                ? `Chuyển sang ${hint}`
                : `${isActive ? 'Ẩn' : 'Hiện'} ${hint} · Có thể bật nhiều khung cùng lúc`
            }
            onClick={() => toggle(id)}
          >
            <Icon width={14} height={14} />
            {isPhone && <span className="view-tag-phone-txt">{shortPhone}</span>}
          </button>
        )
      })}
    </div>
  )
}
