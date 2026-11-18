import React from 'react'
import type {
  Project,
  SolidLayer,
  SolidPattern,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import { toast } from '../../actions'
import * as factory from '../../project/factory'
import { syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import { syncWorkflowV2Graph } from '../../project/workflowV2Sync'
import { useEditor } from '../../store/editor'
import {
  cleanV2NodeTitle,
  resolveV2NodeLevel,
  resolveV2NodeTheme,
  type WorkflowV2SpawnCategory
} from './workflowV2Theme'
import '../../styles/workflowQuickDirector.css'

export type WorkflowDirectorTab = 'scene' | 'character' | 'dialogue'

const SCENE_MOOD_PRESETS: {
  id: 'world' | SolidPattern
  label: string
  color: string
  color2: string
}[] = [
  { id: 'world', label: '🌅 Cảnh Thế giới', color: '#0f172a', color2: '#1e293b' },
  { id: 'comic_burst', label: '💥 Hào quang Vàng', color: '#fde047', color2: '#ef4444' },
  { id: 'speedlines_radial', label: '⚡ Tia Tốc độ', color: '#2b0938', color2: '#7a0e52' },
  { id: 'question_sky', label: '❓ Ngơ ngác (?)', color: '#5ca4ff', color2: '#cbe6ff' },
  { id: 'spotlight_stage', label: '🔦 Spotlight', color: '#3b3e45', color2: '#1d2026' },
  { id: 'anger_veins', label: '💢 Nổi giận', color: '#be123c', color2: '#fb7185' }
]

const QUICK_CHARACTER_ATOMS: {
  cat: WorkflowV2SpawnCategory
  presetId: string
  label: string
  title: string
}[] = [
  { cat: 'action', presetId: 'v2:action:bbox_target', label: '+ BBox', title: 'Gắn Node Di chuyển BBox (#1 → #2) độc lập' },
  { cat: 'fx', presetId: 'v2:fx:fadeInOut', label: '+ Mờ/Hiện', title: 'Gắn Node Hiện/Ẩn mờ dần độc lập' },
  { cat: 'fx', presetId: 'v2:fx:shake', label: '+ Rung', title: 'Gắn Node Rung chấn cảm xúc độc lập' },
  { cat: 'subtitle', presetId: 'v2:subtitle:lugia_cyan', label: '+ Vietsub', title: 'Gắn Node Phụ đề Vietsub gắn riêng nhân vật này' },
  { cat: 'subtitle', presetId: 'v2:subtitle:comic_bubble', label: '+ Hộp thoại', title: 'Gắn Hộp thoại truyện tranh có đuôi trỏ vào nhân vật này' }
]

export function applyQuickSceneMoodBackdrop(
  shotId: string | null,
  moodId: 'world' | SolidPattern
): void {
  const preset = SCENE_MOOD_PRESETS.find((m) => m.id === moodId) ?? SCENE_MOOD_PRESETS[0]
  useEditor.getState().update((d) => {
    const targetShotId = shotId ?? d.shots[0]?.id ?? null
    const existingMood = d.layers.find(
      (l): l is SolidLayer =>
        l.type === 'solid' &&
        l.shotId === targetShotId &&
        Boolean(l.props.pattern && l.props.pattern !== 'none' && l.props.pattern !== 'grid')
    )
    if (moodId === 'world') {
      if (existingMood) existingMood.visible = false
      d.workflow = syncWorkflowV2Graph(d, d.workflow)
      return
    }
    if (existingMood) {
      existingMood.visible = true
      existingMood.name = `Nền Tâm Lý · ${preset.label}`
      existingMood.props.color = preset.color
      existingMood.props.color2 = preset.color2
      existingMood.props.gradient = true
      existingMood.props.pattern = moodId
    } else {
      const solid = factory.createSolidLayer(d.comp)
      solid.shotId = targetShotId
      solid.name = `Nền Tâm Lý · ${preset.label}`
      solid.autoScale = true
      solid.transform.position.value = [0, 0, 1420]
      solid.props = {
        color: preset.color,
        color2: preset.color2,
        gradient: true,
        pattern: moodId,
        width: Math.round(d.comp.width * 1.3),
        height: Math.round(d.comp.height * 1.3)
      }
      d.layers.push(solid)
    }
    d.workflow = syncWorkflowV2Graph(d, d.workflow)
  }, `wf-quick-mood-${moodId}`)
  toast(`🎬 Đã chuyển nền cảnh sang: ${preset.label}`)
}

export const WorkflowSceneMoodStrip: React.FC<{
  project?: Project
  activeShotId: string | null
}> = ({ project, activeShotId }) => {
  if (!project || project.shots.length === 0) return null
  const shotId = activeShotId ?? project.shots[0]?.id ?? null
  const activeMoodLayer = project.layers.find(
    (l): l is SolidLayer =>
      l.type === 'solid' &&
      l.visible &&
      l.shotId === shotId &&
      Boolean(l.props.pattern && l.props.pattern !== 'none' && l.props.pattern !== 'grid')
  )
  const curMood = activeMoodLayer?.props.pattern ?? 'world'

  return (
    <section className="wf-v2-sidebar-sec">
      <div className="wf-v2-sec-title">Nền Tâm Lý Cảnh Đang Quay (1 Chạm)</div>
      <div className="wf-director-mood-grid" role="group" aria-label="Chọn nhanh nền tâm lý cảnh">
        {SCENE_MOOD_PRESETS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`wf-director-mood-btn${curMood === m.id ? ' active' : ''}`}
            onClick={() => applyQuickSceneMoodBackdrop(shotId, m.id)}
            title={`Đặt bối cảnh "${m.label}" cho cảnh hiện tại`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </section>
  )
}

export const WorkflowCharacterQuickList: React.FC<{
  workflow: WorkflowGraph
  project?: Project
  activeShotId: string | null
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
  onAttachLogic: (
    layerNodeId: string,
    category: WorkflowV2SpawnCategory,
    presetId?: string,
    extraParams?: Partial<WorkflowNodeParams>,
    customTitle?: string
  ) => void
}> = ({ workflow, project, activeShotId, selectedNodeId, onSelectNode, onAttachLogic }) => {
  const setTime = useEditor((s) => s.setTime)

  const charNodes = workflow.nodes.filter((n) => {
    if (n.params?.logicCategory === 'cluster_lock') {
      return !activeShotId || n.params?.shotId === activeShotId
    }
    if (resolveV2NodeLevel(n) !== 'layer') return false
    if (activeShotId && n.params?.shotId && n.params.shotId !== activeShotId) return false
    const layer = project?.layers.find((l) => n.params?.targetLayerIds?.includes(l.id))
    if (!layer) return true
    if (layer.type === 'solid' || (layer.type === 'text' && layer.props.isSubtitleCue)) return false
    if (layer.composite && !layer.composite.isRoot) return false
    if ((layer.transform.position.value?.[2] ?? 0) >= 980) return false
    return true
  })

  if (charNodes.length === 0) {
    return (
      <p className="wf-v2-hint">
        Chưa có nhân vật / chủ thể trung cảnh trong cảnh này. Kéo ảnh nhân vật từ Kho Tài nguyên vào khung nhìn để bắt đầu!
      </p>
    )
  }

  return (
    <div className="wf-director-card-list" role="list" aria-label="Danh sách Nhân vật và Node đơn nhiệm">
      {charNodes.map((cn) => {
        const targetId = cn.params?.targetLayerIds?.[0]
        const instId = cn.params?.instanceId
        const attached = workflow.nodes.filter(
          (ln) =>
            resolveV2NodeLevel(ln) === 'logic' &&
            ln.id !== cn.id &&
            ln.type !== 'camera_director' &&
            !ln.params?.isPartChild &&
            ((targetId && ln.params?.targetLayerIds?.includes(targetId)) ||
              (instId && ln.params?.instanceId === instId))
        )
        const t0 = cn.params?.timeStart ?? 0
        const t1 = cn.params?.timeEnd ?? 0
        return (
          <div
            key={cn.id}
            role="listitem"
            className={`wf-director-card${selectedNodeId === cn.id ? ' active' : ''}`}
          >
            <div className="wf-director-card-head">
              <button
                type="button"
                className="wf-director-card-title"
                onClick={() => {
                  setTime(t0)
                  onSelectNode(cn.id)
                }}
                title="Nhấp để chọn nhân vật và mở Khung chỉnh BBox 2D"
              >
                <span aria-hidden="true">🧍</span>
                <span>{cleanV2NodeTitle(cn.title)}</span>
              </button>
              <span className="wf-director-time-tag">
                {t0.toFixed(1)}–{t1.toFixed(1)}s
              </span>
            </div>

            {attached.length > 0 && (
              <div className="wf-director-chip-row">
                {attached.map((ln) => {
                  const th = resolveV2NodeTheme(ln)
                  return (
                    <button
                      key={ln.id}
                      type="button"
                      className={`wf-director-atom-chip${selectedNodeId === ln.id ? ' active' : ''}`}
                      style={{ ['--logic-c' as string]: th.accent }}
                      title={`${ln.title} — Nhấp để chỉnh riêng node đơn nhiệm này`}
                      onClick={() => {
                        if (typeof ln.params?.timeStart === 'number') setTime(ln.params.timeStart)
                        onSelectNode(ln.id)
                      }}
                    >
                      <span>{th.icon}</span>
                      <span>{cleanV2NodeTitle(ln.title).slice(0, 14)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="wf-director-chip-row">
              {QUICK_CHARACTER_ATOMS.map((atom) => (
                <button
                  key={atom.presetId}
                  type="button"
                  className="wf-director-atom-chip add"
                  title={atom.title}
                  onClick={() => onAttachLogic(cn.id, atom.cat, atom.presetId)}
                >
                  {atom.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const WorkflowDialogueQuickList: React.FC<{
  workflow: WorkflowGraph
  project?: Project
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}> = ({ workflow, project, selectedNodeId, onSelectNode }) => {
  const update = useEditor((s) => s.update)
  const setTime = useEditor((s) => s.setTime)

  const subtitleNodes = [...workflow.nodes]
    .filter((n) => n.params?.logicCategory === 'subtitle')
    .sort((a, b) => (a.params?.timeStart ?? 0) - (b.params?.timeStart ?? 0))

  const updateDialogueText = (nodeId: string, nextText: string): void => {
    update((d) => {
      const target = d.workflow?.nodes.find((n) => n.id === nodeId)
      if (!target) return
      const patch: Partial<WorkflowNodeParams> = { subtitleText: nextText }
      target.params = { ...(target.params ?? {}), ...patch }
      syncWorkflowV2NodeToProject(d, target, patch)
    }, `wf-quick-sub-${nodeId}`)
  }

  if (subtitleNodes.length === 0) {
    return (
      <p className="wf-v2-hint">
        Chưa có câu thoại / Vietsub nào. Chuyển sang tab <b>Nhân vật</b> và bấm <b>+ Vietsub</b> hoặc <b>+ Hộp thoại</b> để thêm ngay!
      </p>
    )
  }

  return (
    <div className="wf-director-card-list" role="list" aria-label="Danh sách lời thoại Vietsub toàn dự án">
      {subtitleNodes.map((sn, idx) => {
        const p = sn.params ?? {}
        const speakerId = p.targetLayerIds?.[0]
        const speaker = project?.layers.find((l) => l.id === speakerId)
        const t0 = p.timeStart ?? 0
        const t1 = p.timeEnd ?? 0
        const isLocked = Boolean(p.preserveCustomSettings)
        const isBubble = p.subtitleStylePreset === 'comic_bubble'
        return (
          <div
            key={sn.id}
            role="listitem"
            className={`wf-director-card${selectedNodeId === sn.id ? ' active' : ''}`}
          >
            <div className="wf-director-card-head">
              <button
                type="button"
                className="wf-director-card-title"
                onClick={() => {
                  setTime(Number(((t0 + t1) * 0.5).toFixed(2)))
                  onSelectNode(sn.id)
                }}
                title="Nhấp để nhảy tới câu thoại và mở Khung kéo vị trí BBox Vietsub"
              >
                <span aria-hidden="true">{isBubble ? '💭' : '💬'}</span>
                <span>
                  #{idx + 1} {p.subtitleSpeakerName || speaker?.name || 'Dẫn truyện'}{' '}
                  {isLocked ? '🔒' : ''}
                </span>
              </button>
              <span className="wf-director-time-tag">
                {t0.toFixed(1)}–{t1.toFixed(1)}s
              </span>
            </div>
            <input
              type="text"
              className="wf-director-sub-input"
              value={p.subtitleText ?? ''}
              aria-label={`Nội dung câu thoại ${idx + 1}`}
              placeholder="Nhập lời thoại / Vietsub..."
              onFocus={() => {
                setTime(Number(((t0 + t1) * 0.5).toFixed(2)))
                onSelectNode(sn.id)
              }}
              onChange={(e) => updateDialogueText(sn.id, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}
