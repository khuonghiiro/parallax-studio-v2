import React from 'react'
import { useView, type TimelineMainTab } from '../../store/view'
import { IconTimelineTracks, IconWorkflowGraph } from './workflowIcons'

export interface TimelineModeTabsProps {
  layerCount: number
  connectedNodeCount: number
  totalNodeCount: number
}

export const TimelineModeTabs: React.FC<TimelineModeTabsProps> = ({
  layerCount,
  connectedNodeCount,
  totalNodeCount
}) => {
  const timelineTab = useView((s) => s.timelineTab)
  const setTimelineTab = useView((s) => s.setTimelineTab)

  const handleSelect = (tab: TimelineMainTab) => {
    setTimelineTab(tab)
  }

  return (
    <div className="tl-mode-tabs" data-mcp-region="timeline_tabs" role="tablist" aria-label="Chế độ Timeline và Workflow">
      <button
        id="tab-timeline-main"
        type="button"
        role="tab"
        aria-selected={timelineTab === 'timeline'}
        className={`tl-mode-tab${timelineTab === 'timeline' ? ' active' : ''}`}
        title="Dòng thời gian (Timeline): Quản lý layer, keyframe, âm thanh và đường bay camera"
        onClick={() => handleSelect('timeline')}
      >
        <IconTimelineTracks width={14} height={14} />
        <span>Timeline</span>
        <span className="tl-mode-tab-badge">{layerCount}</span>
      </button>

      <button
        id="tab-timeline-workflow"
        type="button"
        role="tab"
        aria-selected={timelineTab === 'workflow'}
        className={`tl-mode-tab wf-tab${timelineTab === 'workflow' ? ' active' : ''}`}
        title="Quy trình Tạo Video (Workflow Node-Port): Nối cổng chức năng, xuất JSON và điều phối Tác nhân AI qua MCP"
        onClick={() => handleSelect('workflow')}
      >
        <IconWorkflowGraph width={14} height={14} />
        <span>Workflow</span>
        <span className="tl-mode-tab-badge wf">
          {connectedNodeCount}/{totalNodeCount}
        </span>
      </button>
    </div>
  )
}
