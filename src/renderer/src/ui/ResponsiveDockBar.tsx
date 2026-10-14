import { formatTimecode } from '../animation/math'
import { useEditor } from '../store/editor'
import { useView, type MobileWorkspaceTab, type TabletSideTab } from '../store/view'
import { IconFilm, IconFolder, IconPause, IconPlay, IconSliders } from './icons'

interface ResponsiveDockBarProps {
  mobileTab: MobileWorkspaceTab
  tabletTab: TabletSideTab
  setMobileTab: (tab: MobileWorkspaceTab) => void
  setTabletTab: (tab: TabletSideTab) => void
}

export function ResponsiveDockBar({
  mobileTab,
  tabletTab,
  setMobileTab,
  setTabletTab
}: ResponsiveDockBarProps) {

  const layerCount = useEditor((s) => s.project.layers.length)
  const shotCount = useEditor((s) => s.project.shots.length)
  const playing = useEditor((s) => s.playing)
  const time = useEditor((s) => s.time)
  const fps = useEditor((s) => s.project.comp.fps)
  const duration = useEditor((s) => s.project.comp.duration)

  const togglePlay = (): void => {
    const st = useEditor.getState()
    if (!st.playing && st.time >= duration - 1e-3) st.setTime(0)
    st.setPlaying(!st.playing)
  }

  return (
    <nav id="responsive-dock" className="responsive-dock" aria-label="Điều hướng vùng làm việc">
      <div className="responsive-dock-tabs">
        <button
          id="dock-tab-timeline"
          type="button"
          className={`dock-tab phone-only-tab${mobileTab === 'timeline' ? ' active-mobile' : ''}`}
          onClick={() => setMobileTab('timeline')}
          title="Mở bảng Timeline & Keyframe"
        >
          <IconFilm width={14} height={14} />
          <span>Timeline</span>
          <span className="dock-badge">{layerCount}</span>
        </button>

        <button
          id="dock-tab-left"
          type="button"
          className={`dock-tab${mobileTab === 'left' ? ' active-mobile' : ''}${tabletTab === 'left' ? ' active-tablet' : ''}`}
          onClick={() => {
            setMobileTab('left')
            setTabletTab('left')
          }}
          title="Mở bảng Cảnh, Kho mẫu có sẵn, Mô hình 3D & Âm thanh"
        >
          <IconFolder width={14} height={14} />
          <span>Tài nguyên</span>
          <span className="dock-badge">{shotCount}</span>
        </button>

        <button
          id="dock-tab-right"
          type="button"
          className={`dock-tab${mobileTab === 'right' ? ' active-mobile' : ''}${tabletTab === 'right' ? ' active-tablet' : ''}`}
          onClick={() => {
            setMobileTab('right')
            setTabletTab('right')
          }}
          title="Mở bảng Thuộc tính (Layer, Camera, Dự án)"
        >
          <IconSliders width={14} height={14} />
          <span>Thuộc tính</span>
        </button>
      </div>

      <button
        id="dock-quick-play"
        type="button"
        className={`dock-quick-play phone-only-tab${playing ? ' playing' : ''}`}
        onClick={togglePlay}
        title={playing ? 'Tạm dừng (Space)' : 'Phát thử cảnh (Space)'}
      >
        {playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
        <span>{formatTimecode(time, fps)}</span>
      </button>
    </nav>
  )
}
