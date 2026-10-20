import React, { useMemo } from 'react'
import type { Project, WorkflowBoundTarget, WorkflowNode, WorkflowNodeType } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'
import { resolveNodeTargetBinding } from '../../project/workflowEngine'
import { describeNodeConcreteConfig, type NodeRuntimeTelemetry } from './workflowLayoutAndFlow'

export interface WorkflowNodePreviewProps {
  node: WorkflowNode
  project?: Project
  mode?: 'card' | 'inspector'
  runtimeTelemetry?: NodeRuntimeTelemetry
  onPreviewInViewport?: (node: WorkflowNode) => void
}

export function getTargetKindIcon(kind: WorkflowBoundTarget['kind']): string {
  switch (kind) {
    case 'composite_25d':
      return '🧩'
    case 'model_3d':
      return '🏛️'
    case 'image_25d':
      return '🖼️'
    case 'particles':
      return '🪄'
    case 'ground_3d':
      return '🟫'
    case 'shot':
      return '🎬'
    case 'audio_track':
      return '🎙️'
    case 'camera_3d':
      return '🎥'
    case 'look_post':
      return '🎞️'
  }
}

/** Minh họa đồ họa động (SVG Schematic) cho từng loại khối chức năng */
function renderSchematicSvg(type: WorkflowNodeType, preset: string, color: string) {
  switch (type) {
    case 'scene_shot':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <path
            d="M 10 36 L 45 23 L 135 23 L 170 36 Z"
            fill={color}
            fillOpacity="0.14"
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth="0.9"
          />
          <rect x="22" y="5" width="36" height="21" rx="2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1" />
          <text x="40" y="18" textAnchor="middle" className="wf-svg-tag">Z:3200</text>
          <rect x="70" y="7" width="38" height="23" rx="2" fill={color} fillOpacity="0.32" stroke={color} strokeWidth="1.2" />
          <text x="89" y="21" textAnchor="middle" className="wf-svg-tag">Z:600</text>
          <rect x="120" y="9" width="38" height="25" rx="2" fill={color} fillOpacity="0.52" stroke={color} strokeWidth="1.4" />
          <text x="139" y="24" textAnchor="middle" className="wf-svg-tag">Z:0</text>
          <path d="M 60 17 L 68 17 M 110 19 L 118 19" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
      )

    case 'layer_assembly':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <line x1="16" y1="35" x2="164" y2="35" stroke={color} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 2" />
          {/* 2.5D Character Rig Skeleton */}
          <circle cx="48" cy="10" r="4.5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.3" />
          <line x1="48" y1="14.5" x2="48" y2="26" stroke={color} strokeWidth="1.5" />
          <line x1="38" y1="18" x2="58" y2="18" stroke={color} strokeWidth="1.3" />
          <line x1="48" y1="26" x2="41" y2="35" stroke={color} strokeWidth="1.3" />
          <line x1="48" y1="26" x2="55" y2="35" stroke={color} strokeWidth="1.3" />
          <circle cx="48" cy="35" r="2.8" fill="#22c55e" stroke="#fff" strokeWidth="0.8" />
          {/* Multi-layer Tree 2.5D */}
          <polygon points="104,7 92,25 116,25" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.2" />
          <line x1="104" y1="25" x2="104" y2="35" stroke={color} strokeWidth="1.6" />
          <circle cx="104" cy="35" r="2.6" fill="#22c55e" />
          <text x="145" y="22" textAnchor="middle" className="wf-svg-tag">RIG 2.5D</text>
        </svg>
      )

    case 'motion_choreography':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <path
            d="M 12 25 Q 34 8, 56 21 T 100 19 T 144 17 T 168 21"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            className="wf-svg-anim-wave"
          />
          <path
            d="M 12 31 Q 38 18, 64 27 T 116 25 T 168 28"
            fill="none"
            stroke={color}
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <circle cx="56" cy="21" r="3" fill={color} />
          <circle cx="100" cy="19" r="3" fill={color} />
          <circle cx="144" cy="17" r="3" fill={color} />
          <text x="90" y="11" textAnchor="middle" className="wf-svg-tag">WIND · BREATHE · IK</text>
        </svg>
      )

    case 'physics_fx':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <defs>
            <radialGradient id={`wf-light-${preset}`} cx="35%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.75" />
              <stop offset="65%" stopColor={color} stopOpacity="0.24" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="58" cy="20" rx="44" ry="17" fill={`url(#wf-light-${preset})`} />
          <circle cx="44" cy="20" r="4.8" fill="#fde047" stroke={color} strokeWidth="1.2" />
          <circle cx="86" cy="11" r="2.2" fill="#fde047" className="wf-svg-pulse" />
          <circle cx="106" cy="25" r="1.8" fill={color} className="wf-svg-pulse" />
          <circle cx="126" cy="14" r="2.4" fill="#fde047" className="wf-svg-pulse" />
          <circle cx="150" cy="26" r="2" fill={color} />
          <text x="128" y="35" textAnchor="middle" className="wf-svg-tag">MESH + LIGHT 2.5D</text>
        </svg>
      )

    case 'camera_director':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <polygon
            points="16,23 34,11 34,33"
            fill={color}
            fillOpacity="0.28"
            stroke={color}
            strokeWidth="1.2"
          />
          <rect x="10" y="18" width="9" height="10" rx="1.5" fill={color} />
          <path
            d="M 36 22 C 66 7, 108 35, 156 15"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />
          <circle cx="78" cy="18" r="2.8" fill={color} />
          <circle cx="118" cy="24" r="2.8" fill={color} />
          <circle cx="156" cy="15" r="3.6" fill="#fff" stroke={color} strokeWidth="1.5" />
          <text x="115" y="11" textAnchor="middle" className="wf-svg-tag">SPLINE 3D + DOF</text>
        </svg>
      )

    case 'audio_lipsync':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {[16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104].map((x, i) => {
            const h = [8, 16, 24, 14, 26, 20, 12, 24, 18, 22, 14, 8][i % 12]
            return (
              <rect
                key={x}
                x={x}
                y={20 - h / 2}
                width="4"
                height={h}
                rx="1.5"
                fill={color}
                fillOpacity={0.48 + (i % 3) * 0.16}
              />
            )
          })}
          <ellipse cx="144" cy="20" rx="16" ry="6.5" fill={color} fillOpacity="0.24" stroke={color} strokeWidth="1.3" />
          <path d="M 132 20 Q 144 25, 156 20" fill="none" stroke={color} strokeWidth="1.2" />
          <text x="144" y="35" textAnchor="middle" className="wf-svg-tag">LIP-SYNC 2.5D</text>
        </svg>
      )

    case 'look_output':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <defs>
            <linearGradient id={`wf-grade-${preset}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.38" />
              <stop offset="50%" stopColor={color} stopOpacity="0.45" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <rect
            x="14"
            y="6"
            width="152"
            height="28"
            rx="4"
            fill={`url(#wf-grade-${preset})`}
            stroke={color}
            strokeWidth="1.2"
          />
          <line x1="90" y1="6" x2="90" y2="34" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 2" />
          <text x="52" y="23" textAnchor="middle" className="wf-svg-tag">Z-FOG 3D</text>
          <text x="128" y="23" textAnchor="middle" className="wf-svg-tag">MASTER MP4</text>
        </svg>
      )
  }
}

export const WorkflowNodePreview: React.FC<WorkflowNodePreviewProps> = ({
  node,
  project,
  mode = 'card',
  runtimeTelemetry,
  onPreviewInViewport
}) => {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const presetSpec = spec?.presets.find((p) => p.id === node.preset) ?? spec?.presets[0]
  const color = spec?.color ?? '#38bdf8'

  const binding = useMemo(() => resolveNodeTargetBinding(node, project), [node, project])
  const visibleTargets = binding.boundTargets.slice(0, 1)
  const extraTargetsCount = Math.max(0, binding.boundTargets.length - visibleTargets.length)

  const customRuleCount = useMemo(
    () => (node.params?.customRules ?? []).filter((r) => r.enabled).length,
    [node.params?.customRules]
  )
  const configSummary = useMemo(
    () => runtimeTelemetry?.configSummary ?? describeNodeConcreteConfig(node, project),
    [runtimeTelemetry?.configSummary, node, project]
  )

  const targetsTooltip = binding.boundTargets
    .map((t) => `${getTargetKindIcon(t.kind)} ${t.name} (${t.roleLabel})`)
    .join('\n')

  const partsTooltip = binding.activeParts
    .map((p) => `${p.icon} ${p.label}: ${p.description}`)
    .join('\n')

  if (mode === 'card') {
    return (
      <div className="wf-node-binding-box">
        {/* Dòng 1: Layer tác động + Bộ phận 2.5D */}
        <div
          className="wf-binding-row"
          title={`Layer / Thực thể tác động (${binding.mode === 'custom' ? 'Chỉ định' : 'Tự động'}):\n${targetsTooltip}\n\nBộ phận 2.5D:\n${partsTooltip}`}
        >
          <span className="wf-binding-label">
            {binding.mode === 'custom' ? '🎯 Layer:' : '🔄 Layer:'}
          </span>
          <div className="wf-binding-chips">
            {visibleTargets.map((t) => (
              <span key={t.id} className={`wf-target-chip primary kind-${t.kind}`}>
                <span className="wf-chip-ic">{getTargetKindIcon(t.kind)}</span>
                <span className="wf-chip-txt">{t.name}</span>
                {t.subLayerCount ? (
                  <span className="wf-chip-meta">{t.subLayerCount}L</span>
                ) : typeof t.zDepth === 'number' ? (
                  <span className="wf-chip-meta">Z:{t.zDepth}</span>
                ) : null}
              </span>
            ))}
            {extraTargetsCount > 0 && (
              <span className="wf-target-chip more">+{extraTargetsCount}</span>
            )}
            {binding.activeParts.length > 0 && (
              <span className="wf-part-chip" title={partsTooltip}>
                <span className="wf-chip-ic">{binding.activeParts[0].icon}</span>
                <span className="wf-chip-txt">{binding.activeParts.length}p</span>
              </span>
            )}
          </div>
        </div>

        {/* Dòng 2: Cấu hình chuyển động / Thông số xử lý cụ thể */}
        <div
          className="wf-binding-row wf-config-summary-row"
          title={`Cấu hình xử lý & thông số chuyển động:\n${configSummary}`}
        >
          <span className="wf-binding-label">⚙️ Xử lý:</span>
          <span className="wf-config-summary-text">{configSummary}</span>
          {customRuleCount > 0 && (
            <span className="wf-custom-rule-badge" title={`Đã gắn thêm ${customRuleCount} lệnh chuyển động / tính năng riêng`}>
              +{customRuleCount} lệnh
            </span>
          )}
        </div>

        {/* Dòng 3: Lộ trình & Trạng thái Luồng Xử lý Thời gian thực */}
        {runtimeTelemetry && (
          <div
            className={`wf-node-runtime-bar state-${runtimeTelemetry.state}${runtimeTelemetry.isStageHighlight ? ' stage-pulse' : ''}`}
            title={`${runtimeTelemetry.routeText}\n${runtimeTelemetry.liveSummary}`}
          >
            <div className="wf-runtime-content">
              <span className={`wf-runtime-dot state-${runtimeTelemetry.state}`} />
              <span className="wf-runtime-text">{runtimeTelemetry.liveSummary}</span>
            </div>
            {runtimeTelemetry.state === 'running' && (
              <div className="wf-runtime-progress-track">
                <div
                  className="wf-runtime-progress-fill"
                  style={{ width: `${runtimeTelemetry.progressPct}%`, background: color }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="wf-inspector-preview-box" data-mcp-region="workflow_preview">
      <div className="wf-inspector-preview-top">
        <span className="wf-inspector-preview-badge" style={{ color }}>
          ● Mô phỏng Chức năng ({presetSpec?.label})
        </span>
        {onPreviewInViewport && (
          <button
            type="button"
            className="btn ghost sm wf-preview-try-btn"
            title="Áp dụng và chạy thử hiệu ứng này ngay trên khung nhìn 3D"
            onClick={() => onPreviewInViewport(node)}
          >
            ▶ Xem thử Cảnh 3D
          </button>
        )}
      </div>

      <div className="wf-inspector-preview-stage">
        {renderSchematicSvg(node.type, node.preset, color)}
      </div>

      {runtimeTelemetry && (
        <div className={`wf-node-runtime-bar inspector state-${runtimeTelemetry.state}`}>
          <div className="wf-runtime-content">
            <span className={`wf-runtime-dot state-${runtimeTelemetry.state}`} />
            <strong className="wf-runtime-badge-lbl">{runtimeTelemetry.routeText}:</strong>
            <span className="wf-runtime-text">{runtimeTelemetry.liveSummary}</span>
          </div>
        </div>
      )}

      <div className="wf-inspector-preview-pills">
        <span className="wf-inspector-preview-pill config" title="Thông số cấu hình hiện tại">
          ⚙️ {configSummary}
        </span>
        {binding.activeParts.map((part) => (
          <span key={part.id} className="wf-inspector-preview-pill" title={part.description}>
            {part.icon} {part.shortLabel}
          </span>
        ))}
      </div>
    </div>
  )
}
