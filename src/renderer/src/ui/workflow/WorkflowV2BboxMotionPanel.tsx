import React, { useState } from 'react'
import type { WorkflowV2NodeParamsProps } from './WorkflowV2NodeParams'
import { useBboxMotionModel } from './useBboxMotionModel'
import { BboxMotionTargetSection } from './BboxMotionTargetSection'
import { BboxMotionDepthSection } from './BboxMotionDepthSection'
import '../../styles/workflowMotionPanel.css'

const TABS = [
  { id: 'target', label: 'Đích', icon: '⊡' },
  { id: 'depth', label: 'Chiều sâu', icon: '▱' }
] as const

export function WorkflowV2BboxMotionPanel({ props }: {
  props: WorkflowV2NodeParamsProps
  onSpawnFollowupNode?: (durationSec?: number) => void
}): React.ReactElement {
  const model = useBboxMotionModel(props)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('target')
  const { targetScalePct, isPlaying, handleTogglePreview } = model
  return (
    <section className="wf-motion-panel" data-mcp-region="workflow_motion_panel">
      <header className="wf-motion-header">
        <div><strong>Chuyển động BBox</strong><span>Đầu → Đích · {targetScalePct}%</span></div>
        <button type="button" className="wf-v2-mini-btn" onClick={handleTogglePreview} aria-pressed={isPlaying}>
          {isPlaying ? '■ Dừng' : '▶ Xem thử'}
        </button>
      </header>
      <div className="wf-motion-tabs" role="tablist" aria-label="Cấu hình Motion BBox">
        {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
          aria-controls={`wf-motion-${item.id}`} id={`wf-motion-tab-${item.id}`} onClick={() => setTab(item.id)}>
          <span aria-hidden="true">{item.icon}</span>{item.label}
        </button>)}
      </div>
      <div className="wf-motion-content" role="tabpanel" id={`wf-motion-${tab}`} aria-labelledby={`wf-motion-tab-${tab}`}>
        {tab === 'target' && <section className="wf-motion-target" data-mcp-region="workflow_motion_target"><BboxMotionTargetSection model={model} /></section>}
        {tab === 'depth' && <section className="wf-motion-depth" data-mcp-region="workflow_motion_depth"><BboxMotionDepthSection model={model} /></section>}
      </div>
    </section>
  )
}
