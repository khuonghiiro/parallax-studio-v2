import { formatTimecode } from '../animation/math'
import { ensureProjectWorkflow, resolveConnectedWorkflowNodes } from '../project/workflowEngine'
import { useEditor } from '../store/editor'
import { useView, type MobileWorkspaceTab, type TabletSideTab } from '../store/view'
import { IconFolder, IconPause, IconPlay, IconSliders } from './icons'
import { IconTimelineTracks, IconWorkflowGraph } from './workflow/workflowIcons'

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
  const project = useEditor((s) => s.project)
  const layerCount = project.layers.length
  const shotCount = project.shots.length
  const playing = useEditor((s) => s.playing)
  const time = useEditor((s) => s.time)
  const fps = project.comp.fps
  const duration = project.comp.duration
  const timelineTab = useView((s) => s.timelineTab)

  const wf = ensureProjectWorkflow(project)
  const { activeNodes } = resolveConnectedWorkflowNodes(wf)

  const togglePlay = (): void => {
    const st = useEditor.getState()
    if (!st.playing && st.time >= duration - 1e-3) st.setTime(0)
    st.setPlaying(!st.playing)
  }

  const isTimelineDrawer = mobileTab === 'timeline' && timelineTab === 'timeline'
  const isWorkflowDrawer = mobileTab === 'timeline' && timelineTab === 'workflow'

  return (
    <nav
      id="responsive-dock"
      className="responsive-dock"
      data-mcp-region="responsive_dock"
      aria-label="Điều hướng vùng làm việc"
    >
      <div className="responsive-dock-tabs" role="tablist">
        <button
          id="dock-tab-timeline"
          type="button"
          role="tab"
          aria-selected={isTimelineDrawer}
          className={`dock-tab phone-only-tab${isTimelineDrawer ? ' active-mobile' : ''}`}
          onClick={() => {
            useView.getState().setTimelineTab('timeline')
            setMobileTab('timeline')
          }}
          title="Mở bảng Timeline & Keyframe"
        >
          <IconTimelineTracks width={14} height={14} />
          <span>Timeline</span>
          <span className="dock-badge">{layerCount}</span>
        </button>

        <button
          id="dock-tab-workflow"
          type="button"
          role="tab"
          aria-selected={isWorkflowDrawer}
          className={`dock-tab phone-only-tab${isWorkflowDrawer ? ' active-mobile' : ''}`}
          onClick={() => {
            useView.getState().setTimelineTab('workflow')
            setMobileTab('timeline')
          }}
          title="Mở Sơ đồ Quy trình Workflow V2"
        >
          <IconWorkflowGraph width={14} height={14} />
          <span>Workflow</span>
          <span className="dock-badge">{activeNodes.length}</span>
        </button>

        <button
          id="dock-tab-left"
          type="button"
          role="tab"
          aria-selected={mobileTab === 'left' || tabletTab === 'left'}
          className={`dock-tab${mobileTab === 'left' ? ' active-mobile' : ''}${tabletTab === 'left' ? ' active-tablet' : ''}`}
          onClick={() => {
            useView.getState().setLeftCollapsed(false)
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
          role="tab"
          aria-selected={mobileTab === 'right' || tabletTab === 'right'}
          className={`dock-tab${mobileTab === 'right' ? ' active-mobile' : ''}${tabletTab === 'right' ? ' active-tablet' : ''}`}
          onClick={() => {
            useView.getState().setRightCollapsed(false)
            setMobileTab('right')
            setTabletTab('right')
          }}
          title="Mở bảng Thuộc tính (Layer, Camera, Lộ trình, Dự án, Node & JSON)"
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
