import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  Layer,
  Project,
  SubtitlePositionPreset,
  TextLayer,
  WorkflowNode,
  WorkflowNodeParams
} from '@shared/types'
import {
  computeSubtitlePlacement,
  defaultOffsetYForPreset,
  getProjectSubtitleDefaults,
  projectSpeakerScreenCenter,
  wrapBalancedSubtitle
} from '../../project/subtitleAndDialogueSync'
import { syncWorkflowV2NodeToProject } from '../../project/workflowV2Engine'
import { useEditor } from '../../store/editor'
import type { ProjectedLayer2D } from '../viewer/animateCamera/animateCameraMath'
import '../../styles/workflowSubtitleStage.css'

export interface WorkflowV2StageSubtitleOverlayProps {
  toolbarHost?: HTMLDivElement | null
  project: Project
  node: WorkflowNode
  speakerLayer?: Layer
  layers2D: ProjectedLayer2D[]
  stageW: number
  stageH: number
  shotLeft: number
  shotTop: number
  shotScreenW: number
  shotScreenH: number
  zoom: number
  sampleTime: number
}

const SUB_HANDLES: { key: 'nw' | 'ne' | 'sw' | 'se'; cls: string }[] = [
  { key: 'nw', cls: 'nw' },
  { key: 'ne', cls: 'ne' },
  { key: 'sw', cls: 'sw' },
  { key: 'se', cls: 'se' }
]

const QUICK_ANCHORS: { id: SubtitlePositionPreset; label: string; title: string }[] = [
  { id: 'bottom_center', label: '⬇ Đáy chuẩn', title: 'Đặt phụ đề tại dải an toàn đáy màn hình' },
  { id: 'top_center', label: '⬆ Đỉnh khung', title: 'Đặt phụ đề / nội tâm ở đỉnh khung hình' },
  { id: 'speech_right', label: '💬 Thoại Phải', title: 'Đặt hộp thoại bên phải nhân vật đang nói' },
  { id: 'speech_left', label: '💬 Thoại Trái', title: 'Đặt hộp thoại bên trái nhân vật đang nói' },
  { id: 'above_speaker', label: '🗣️ Trên đầu NV', title: 'Neo hộp thoại ngay phía trên đầu nhân vật' },
  { id: 'custom', label: '🎯 Tự do X/Y', title: 'Kéo đặt tự do ở bất kỳ vị trí nào trên màn hình' }
]

export const WorkflowV2StageSubtitleOverlay: React.FC<WorkflowV2StageSubtitleOverlayProps> = ({
  toolbarHost,
  project,
  node,
  speakerLayer,
  layers2D,
  stageW,
  stageH,
  shotLeft,
  shotTop,
  shotScreenW,
  shotScreenH,
  zoom,
  sampleTime
}) => {
  const update = useEditor((s) => s.update)
  const setPlaying = useEditor((s) => s.setPlaying)
  const [dragging, setDragging] = useState(false)

  const defaults = getProjectSubtitleDefaults(project)
  const p = node.params ?? {}
  const posPreset = (p.subtitlePositionPreset ?? defaults.positionPreset) as SubtitlePositionPreset
  const offX = typeof p.subtitleOffsetX === 'number' ? p.subtitleOffsetX : defaults.offsetX
  const offY = typeof p.subtitleOffsetY === 'number' ? p.subtitleOffsetY : defaultOffsetYForPreset(posPreset)
  const fontSize = p.subtitleFontSize ?? defaults.fontSize
  const italic = p.subtitleItalic ?? defaults.italic ?? false
  const color = p.subtitleColor ?? defaults.color
  const strokeColor = p.subtitleStrokeColor ?? defaults.strokeColor
  const strokeW = p.subtitleStrokeWidth ?? defaults.strokeWidth
  const boxColor = p.subtitleBoxColor ?? defaults.boxColor ?? ''
  const boxOp = p.subtitleBoxOpacity ?? defaults.boxOpacity
  const rawText = p.subtitleText ?? 'Lời thoại Vietsub'
  const wrapped = wrapBalancedSubtitle(rawText, p.subtitleMaxChars ?? defaults.maxCharsPerLine ?? 42)

  const subLayer = project.layers.find(
    (l): l is TextLayer =>
      l.type === 'text' && (l.id === p.subtitleLayerId || l.id === `sub-${node.id}`)
  )
  const projSub = subLayer ? layers2D.find((l) => l.id === subLayer.id) : undefined

  const placement = computeSubtitlePlacement(project, speakerLayer, posPreset, offX, offY, sampleTime)
  const speakerCenter = speakerLayer ? projectSpeakerScreenCenter(project, speakerLayer, sampleTime) : null

  const lines = wrapped.split('\n')
  const longestChars = Math.max(...lines.map((l) => l.length), 6)
  const estWorldW = projSub ? projSub.width : Math.min(1680, Math.max(240, longestChars * fontSize * 0.58 + 72))
  const estWorldH = projSub ? projSub.height : Math.max(64, lines.length * fontSize * 1.32 + 34)

  const boxW = Math.max(44, estWorldW * zoom)
  const boxH = Math.max(20, estWorldH * zoom)
  const centerX = shotLeft + shotScreenW / 2 + (projSub ? projSub.offsetX : placement.screenX) * zoom
  const centerY = shotTop + shotScreenH / 2 + (projSub ? projSub.offsetY : -placement.screenY) * zoom
  const boxLeft = centerX - boxW / 2
  const boxTop = centerY - boxH / 2

  const patchSubtitle = useCallback(
    (patch: Partial<WorkflowNodeParams>, mergeKey = 'wf-sub-bbox-drag'): void => {
      update((d) => {
        if (!d.workflow) return
        const target = d.workflow.nodes.find((n) => n.id === node.id)
        if (!target) return
        target.params = { ...(target.params ?? {}), ...patch }
        syncWorkflowV2NodeToProject(d, target, patch)
      }, mergeKey)
    },
    [node.id, update]
  )

  const startSubtitleDrag = useCallback(
    (e: React.PointerEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'): void => {
      e.stopPropagation()
      e.preventDefault()
      setPlaying(false)
      setDragging(true)

      const startX = e.clientX
      const startY = e.clientY
      const origOffX = offX
      const origOffY = offY
      const origScreenX = placement.screenX
      const origScreenY = placement.screenY
      const origSize = fontSize
      const safeZoom = Math.max(0.02, zoom)
      const keepSpeakerAnchor =
        posPreset === 'above_speaker' ||
        posPreset === 'below_speaker' ||
        posPreset === 'speech_left' ||
        posPreset === 'speech_right'

      const onMove = (pev: PointerEvent): void => {
        const dxScreen = (pev.clientX - startX) / safeZoom
        const dyScreen = -(pev.clientY - startY) / safeZoom
        if (mode === 'move') {
          if (keepSpeakerAnchor && speakerLayer) {
            patchSubtitle({
              subtitleOffsetX: Math.round(origOffX + dxScreen),
              subtitleOffsetY: Math.round(origOffY + dyScreen)
            })
          } else {
            patchSubtitle({
              subtitlePositionPreset: 'custom',
              subtitleOffsetX: Math.round(origScreenX + dxScreen),
              subtitleOffsetY: Math.round(origScreenY + dyScreen)
            })
          }
        } else {
          const signX = mode === 'ne' || mode === 'se' ? 1 : -1
          const deltaW = dxScreen * signX * 2
          const ratio = Math.max(0.45, Math.min(2.2, (estWorldW + deltaW) / Math.max(80, estWorldW)))
          const nextFontSize = Math.max(20, Math.min(72, Math.round(origSize * ratio)))
          patchSubtitle({ subtitleFontSize: nextFontSize }, 'wf-sub-bbox-scale')
        }
      }

      const onUp = (): void => {
        setDragging(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setPlaying, offX, offY, placement.screenX, placement.screenY, fontSize, zoom, posPreset, speakerLayer, patchSubtitle, estWorldW]
  )

  const safeMarginX = shotScreenW * 0.07
  const safeMarginY = shotScreenH * 0.07
  const railY = shotTop + shotScreenH / 2 + 405 * zoom
  const spScreenPt = speakerCenter
    ? {
        x: shotLeft + shotScreenW / 2 + speakerCenter.screenX * zoom,
        y: shotTop + shotScreenH / 2 - speakerCenter.screenY * zoom
      }
    : null

  const quickToolbar = (
    <div className="wf-sub-quick-bar" data-mcp-region="workflow_subtitle_stage">
      <div className="wf-sub-quick-pills" role="group" aria-label="Neo nhanh vị trí Vietsub và Hộp thoại">
        {QUICK_ANCHORS.map((anc) => (
          <button
            key={anc.id}
            type="button"
            className={`wf-sub-quick-pill${posPreset === anc.id ? ' active' : ''}`}
            title={anc.title}
            onClick={() =>
              patchSubtitle(
                {
                  subtitlePositionPreset: anc.id,
                  subtitleOffsetX: 0,
                  subtitleOffsetY: defaultOffsetYForPreset(anc.id)
                },
                'wf-sub-anchor-preset'
              )
            }
          >
            {anc.label}
          </button>
        ))}
      </div>
      <div className="wf-sub-quick-meta">
        <span className="wf-sub-quick-coords">
          X <b>{placement.screenX}</b> · Y <b>{placement.screenY}</b> · Cỡ <b>{fontSize}px</b>
        </span>
        <button
          type="button"
          className="wf-v2-direct-btn"
          title="Đặt nhanh phụ đề về chính giữa theo chiều ngang (X = 0)"
          onClick={() => patchSubtitle({ subtitleOffsetX: 0 }, 'wf-sub-center-x')}
        >
          ⊡ Căn giữa X
        </button>
      </div>
    </div>
  )

  return (
    <>
      <svg className="wf-sub-stage-svg" width={stageW} height={stageH}>
        <rect
          className="wf-sub-safe-rect"
          x={shotLeft + safeMarginX}
          y={shotTop + safeMarginY}
          width={Math.max(10, shotScreenW - safeMarginX * 2)}
          height={Math.max(10, shotScreenH - safeMarginY * 2)}
          rx={4}
        />
        <line
          className="wf-sub-rail-line"
          x1={shotLeft + safeMarginX}
          y1={railY}
          x2={shotLeft + shotScreenW - safeMarginX}
          y2={railY}
        />
        {spScreenPt && (
          <>
            <line
              className="wf-sub-speaker-link"
              x1={spScreenPt.x}
              y1={spScreenPt.y}
              x2={centerX}
              y2={centerY}
            />
            <circle className="wf-sub-speaker-dot" cx={spScreenPt.x} cy={spScreenPt.y} r={3.5} />
          </>
        )}
      </svg>

      <div
        className={`wf-sub-bbox${dragging ? ' dragging' : ''}`}
        data-workflow-node-id={node.id}
        data-bbox-role="subtitle_bbox"
        data-bbox-focused="true"
        style={{
          left: boxLeft,
          top: boxTop,
          width: boxW,
          height: boxH
        }}
        title="Kéo để chỉnh trực tiếp vị trí Vietsub / Hộp thoại trên màn hình · Kéo 4 góc để chỉnh cỡ chữ"
        onPointerDown={(e) => {
          if (e.button === 0) startSubtitleDrag(e, 'move')
        }}
      >
        <span className="wf-sub-bbox-tag">
          💬 {speakerLayer ? speakerLayer.name.slice(0, 14) : 'Vietsub'} · {fontSize}px
        </span>
        {!projSub && (
          <div
            className="wf-sub-bbox-preview-inner"
            style={{
              color,
              fontSize: Math.max(8, fontSize * zoom * 0.88),
              fontStyle: italic ? 'italic' : 'normal',
              fontWeight: 800,
              background: boxColor && boxOp > 0.02 ? boxColor : undefined,
              textShadow:
                strokeColor && strokeW > 0
                  ? `0 0 3px ${strokeColor}, 0 1px 2px rgba(0,0,0,0.85)`
                  : undefined
            }}
          >
            {wrapped}
          </div>
        )}
        {SUB_HANDLES.map((h) => (
          <span
            key={h.key}
            className={`wf-v2-bbox-handle ${h.cls}`}
            onPointerDown={(e) => startSubtitleDrag(e, h.key)}
          />
        ))}
      </div>

      {toolbarHost ? createPortal(quickToolbar, toolbarHost) : null}
    </>
  )
}
