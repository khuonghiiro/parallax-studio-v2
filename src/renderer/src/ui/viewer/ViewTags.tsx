import { useView, type PrimaryView } from '../../store/view'
import { IconCamera, IconCube, IconCameraStage, IconDepth25D } from '../icons'
import { selectedViews } from './taggedLayout'

const tags = [
  {
    id: 'camera',
    dom: 'camera',
    label: 'Camera',
    hint: 'Khung nhìn Camera chính (Kết quả Render)',
    Icon: IconCamera
  },
  {
    id: 'editor',
    dom: '3d',
    label: '3D',
    hint: 'Không gian 3D (Phối cảnh đa chiều)',
    Icon: IconCube
  },
  {
    id: 'animate2d',
    dom: 'animate2d',
    label: 'Cam 2D',
    hint: 'Sân khấu Camera 2D (Lộ trình & Keyframe)',
    Icon: IconCameraStage
  },
  {
    id: 'topview',
    dom: 'topview',
    label: 'Độ sâu 2.5D',
    hint: 'Sơ đồ Độ sâu 2.5D (Trục Z-Depth)',
    Icon: IconDepth25D
  }
] as const

export function ViewTags() {
  const view = useView()
  const active = selectedViews(view)
  const toggle = (id: PrimaryView) => {
    const next = active.includes(id) ? active.filter((item) => item !== id) : [...active, id]
    if (next.length) view.set({ activeViews: next })
  }
  return (
    <div className="viewer-mode-seg viewer-view-tags" role="group" aria-label="Bật các khung xem">
      {tags.map(({ id, dom, label, hint, Icon }) => (
        <button
          key={id}
          id={`view-${dom}`}
          type="button"
          className={`seg-btn icon-only${active.includes(id) ? ' active' : ''}`}
          aria-pressed={active.includes(id)}
          aria-label={label}
          disabled={active.length === 1 && active[0] === id}
          title={`${active.includes(id) ? 'Ẩn' : 'Hiện'} ${hint} · Có thể bật nhiều khung cùng lúc`}
          onClick={() => toggle(id)}
        >
          <Icon width={14} height={14} />
        </button>
      ))}
    </div>
  )
}
