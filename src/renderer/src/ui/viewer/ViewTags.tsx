import { useView, type PrimaryView } from '../../store/view'
import { StudioTooltip } from '../controls/StudioTooltip'
import { IconCamera, IconCube, IconCameraStage, IconDepth25D, IconNodeStage2D } from '../icons'
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
    id: 'node2d',
    dom: 'node2d',
    label: 'Khung 2D',
    shortPhone: 'Khung 2D',
    hint: 'Màn Khung 2D chỉnh Node, BBox, Chuyển động & 2.5D trực tiếp',
    Icon: IconNodeStage2D
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

  const soloView = (id: PrimaryView) => {
    view.set({ activeViews: [id], primary: id, split: false, animate2dSplit: false })
  }

  const toggle = (id: PrimaryView, solo = false) => {
    if (solo || isPhone) {
      soloView(id)
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
    const next = active.includes(id) ? active.filter((item) => item !== id) : VIEW_ORDER.filter((item) => active.includes(item) || item === id)
    if (next.length) view.set({ activeViews: next, primary: next.includes(id) ? id : next[0] })
  }

  return (
    <div className="viewer-mode-seg viewer-view-tags" role="group" aria-label="Bật các khung xem">
      {tags.map(({ id, dom, label, shortPhone, hint, Icon }) => {
        const isActive = active.includes(id)
        const isLockedLast = !isPhone && active.length === 1 && active[0] === id
        return (
          <StudioTooltip
            key={id}
            title={label}
            badge={isActive ? 'Đang mở' : 'Khung xem'}
            badgeTone={isActive ? 'green' : 'cyan'}
            description={hint}
            meta={isPhone ? undefined : 'Nhấp bật song song · Alt+Click hoặc Nhấp đúp để mở riêng'}
            placement="bottom"
          >
            <button
              id={`view-${dom}`}
              type="button"
              className={`seg-btn${isPhone ? ' phone-labeled' : ' icon-only'}${isActive ? ' active' : ''}`}
              aria-pressed={isActive}
              aria-label={label}
              disabled={isLockedLast}
              onClick={(e) => toggle(id, e.altKey)}
              onDoubleClick={() => soloView(id)}
            >
              <Icon width={14} height={14} />
              {isPhone && <span className="view-tag-phone-txt">{shortPhone}</span>}
            </button>
          </StudioTooltip>
        )
      })}
    </div>
  )
}
