import React, { useMemo, useState } from 'react'
import type { Project, WorkflowNode } from '@shared/types'
import { evaluateScene } from '../../engine/evaluateScene'
import { assetStore } from '../../project/assets'
import { partEditContext, patchPartCue, addPartCue } from '../../project/workflowPartEditing'
import { effectiveTimeParams } from '../../project/workflowTiming'
import { projectShotLayers2D } from '../viewer/animateCamera/animateCameraMath'
import { useEditor } from '../../store/editor'
import '../../styles/workflowPartPreview.css'

type Props = { project: Project; node: WorkflowNode; currentTime: number; onScrubTime: (t: number) => void; onSelectNode?: (id: string) => void }
export function WorkflowPartPreview({ project, node, currentTime, onScrubTime, onSelectNode }: Props) {
  const [closeup, setCloseup] = useState(false)
  const context = useMemo(() => partEditContext(project, node.id), [project, node.id])
  const playing = useEditor(s => s.playing)
  const timing = effectiveTimeParams(project, node, node.params ?? {})
  const start = timing.timeStart ?? 0, end = timing.timeEnd ?? project.comp.duration
  const seek = (t: number) => { useEditor.getState().setPlaying(false); onScrubTime(Math.max(0, Math.min(project.comp.duration, t))) }
  const frame = 1 / Math.max(1, project.comp.fps)
  return <section className="wf-part-preview" data-mcp-region="workflow_part_preview">
    <header><strong>Khung chỉnh bộ phận</strong><span>{currentTime.toFixed(2)}s</span>
      <button type="button" onClick={() => { if (!playing) onScrubTime(start); useEditor.getState().setPlaying(!playing) }}>{playing ? '■ Dừng' : '▶ Phát'}</button></header>
    <div className="wf-part-seek" aria-label="Phạm vi khung bộ phận">
      <button type="button" aria-pressed={!closeup} onClick={() => setCloseup(false)}>▧ Toàn cảnh</button>
      <button type="button" aria-pressed={closeup} onClick={() => setCloseup(true)}>⌕ Cận cụm</button>
    </div>
    <PartStage closeup={closeup} project={project} node={node} time={currentTime} onSelectNode={onSelectNode} />
    <div className="wf-part-seek" aria-label="Xem trước và sau mốc bộ phận">
      {[['Trước', start - frame], ['Đầu', start], ['Giữa', (start + end) / 2], ['Cuối', end - frame], ['Sau', end]].map(([label, t]) =>
        <button type="button" key={label} onClick={() => seek(Number(t))}>{label}</button>)}
    </div>
    {node.params?.isPartChild && <button type="button" disabled={currentTime + .5 > project.comp.duration} onClick={() => {
      let id = ''
      useEditor.getState().update(d => { id = addPartCue(d, node.id, currentTime, Math.min(1, project.comp.duration - currentTime)) })
      if (id) onSelectNode?.(id)
    }}>+ Mốc riêng tại {currentTime.toFixed(2)}s</button>}
    <input aria-label="Tua khung bộ phận" type="range" min={0} max={project.comp.duration} step={frame} value={currentTime} onChange={e => seek(Number(e.target.value))} />
    <p>{node.params?.isPartHub ? 'Chọn bộ phận trong hình hoặc danh sách để chỉnh mốc.' : 'Tua để xem đúng vị trí khi cụm di chuyển. Kéo bộ phận đang chọn để chỉnh tư thế trong mốc.'}</p>
    <div className="wf-part-cues" data-mcp-region="workflow_part_cues">
      {context.motions.map(m => { const p = effectiveTimeParams(project, m, m.params ?? {}), a = p.timeStart ?? 0, b = p.timeEnd ?? project.comp.duration
        return <div className="wf-part-motion-cue" key={m.id}><span title={m.title}>↗ {m.title}</span>
          {[['Đầu', a], ['½', (a + b) / 2], ['Đích', b]].map(([label, t]) => <button type="button" key={label} onClick={() => seek(Number(t))}>{label} · {Number(t).toFixed(1)}s</button>)}</div> })}
    </div>
  </section>
}

function PartStage({ project, node, time, closeup, onSelectNode }: { project: Project; node: WorkflowNode; time: number; closeup: boolean; onSelectNode?: (id: string) => void }) {
  const context = useMemo(() => partEditContext(project, node.id), [project, node.id])
  const ev = useMemo(() => evaluateScene(project, time), [project, time])
  const visible = new Set(ev.layers.filter(l => l.active && l.opacity > .01).map(l => l.layer.id))
  const shotId = node.params?.shotId ?? context.members[0]?.shotId ?? null
  const projected = projectShotLayers2D(project, ev, shotId, true).filter(l => visible.has(l.id))
  const members = new Set(context.members.map(l => l.id)), selected = new Set(node.params?.targetLayerIds ?? [])
  const w = project.comp.width, h = project.comp.height
  const boxes = projected.filter(l => members.has(l.id))
  const left = Math.min(...boxes.map(l => l.offsetX - Math.hypot(l.width, l.height) / 2)), right = Math.max(...boxes.map(l => l.offsetX + Math.hypot(l.width, l.height) / 2))
  const top = Math.min(...boxes.map(l => l.offsetY - Math.hypot(l.width, l.height) / 2)), bottom = Math.max(...boxes.map(l => l.offsetY + Math.hypot(l.width, l.height) / 2))
  const viewW = closeup && boxes.length ? Math.max(120, right - left, (bottom - top) * w / h) * 1.15 : w
  const viewH = viewW * h / w
  const viewX = closeup && boxes.length ? w / 2 + (left + right) / 2 - viewW / 2 : 0
  const viewY = closeup && boxes.length ? h / 2 + (top + bottom) / 2 - viewH / 2 : 0
  const beginDrag = (event: React.PointerEvent<SVGGElement>, layerId: string) => {
    event.stopPropagation()
    if (node.params?.isPartHub) { const child = context.children.find(n => n.params?.targetLayerIds?.includes(layerId)); if (child) onSelectNode?.(child.id); return }
    if (!selected.has(layerId) || event.button !== 0) return
    const timing = effectiveTimeParams(project, node, node.params ?? {})
    if (time < (timing.timeStart ?? 0) || time >= (timing.timeEnd ?? project.comp.duration)) return
    event.preventDefault(); useEditor.getState().setPlaying(false)
    const svg = event.currentTarget.ownerSVGElement!, rect = svg.getBoundingClientRect(), x = event.clientX, y = event.clientY
    const source = ev.layers.find(l => l.layer.id === layerId)!
    const ref = ev.camera.refDistance ?? 1483.64, perspective = ref / Math.max(80, ref + source.position[2])
    const ox = node.params?.partOffsetX ?? 0, oy = node.params?.partOffsetY ?? 0
    const move = (e: PointerEvent) => useEditor.getState().update(d => patchPartCue(d, node.id, {
      partOffsetX: Math.round(ox + (e.clientX - x) * viewW / rect.width / perspective),
      partOffsetY: Math.round(oy - (e.clientY - y) * viewH / rect.height / perspective), partPoseWave: 'hold', partActionMode: 'pose'
    }), `part-drag-${node.id}`)
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  return <svg className="wf-part-stage" data-mcp-region="workflow_part_stage" viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`} role="img" aria-label="Cụm và bộ phận tại playhead" style={{ background: project.comp.background }}>
    {projected.filter(l => !closeup || members.has(l.id)).map(l => {
      const x = w / 2 + l.offsetX, y = h / 2 + l.offsetY, target = members.has(l.id)
      const asset = l.assetId ? assetStore.get(l.assetId) : undefined, saved = project.assets.find(a => a.id === l.assetId)
      const url = asset?.url || asset?.thumbUrl || saved?.dataUrl || saved?.path
      return <g key={l.id} transform={`translate(${x} ${y}) rotate(${l.rotation})`} opacity={ev.layers.find(e => e.layer.id === l.id)?.opacity ?? l.opacity}
        onPointerDown={e => target && beginDrag(e, l.id)} style={{ cursor: target ? 'pointer' : 'default' }}>
        <title>{l.name}</title>
        {l.type === 'image' && url ? <image href={url} x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} />
          : l.type === 'solid' ? <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} fill={l.solidColor} />
          : l.type === 'text' ? <text textAnchor="middle" fill={l.textColor} fontSize={l.fontSize}>{l.text}</text> : null}
        {target && (selected.has(l.id) || node.params?.isPartHub) && <rect x={-l.width / 2} y={-l.height / 2} width={l.width} height={l.height} fill="none" stroke="var(--accent-cyan)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </g>
    })}
  </svg>
}
