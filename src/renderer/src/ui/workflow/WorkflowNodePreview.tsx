import React from 'react'
import type { WorkflowNode, WorkflowNodeType } from '@shared/types'
import { WORKFLOW_NODE_SPECS } from '../../project/workflowCatalog'

export interface WorkflowNodePreviewProps {
  node: WorkflowNode
  mode?: 'card' | 'inspector'
  onPreviewInViewport?: (node: WorkflowNode) => void
}

/** Danh sách thẻ thông số trực quan mô tả chính xác chức năng sẽ áp dụng */
function getEffectHighlights(node: WorkflowNode): string[] {
  const intensity = Math.round((node.params?.intensity ?? 1) * 100)
  switch (node.type) {
    case 'scene_shot':
      if (node.preset === 'intimate_closeup_stage') {
        return ['3 tầng Z cận cảnh (900 → -60)', 'Tập trung biểu cảm', `Biên độ ${intensity}%`]
      }
      if (node.preset === 'open_world_3d_stage') {
        return ['Không gian 3D rộng (Z 4200)', 'Tự tạo Mặt đất 3D', `Biên độ ${intensity}%`]
      }
      return ['5 tầng Z Parallax (3200 → -120)', 'Giãn chiều sâu tự động', `Biên độ ${intensity}%`]

    case 'layer_assembly':
      if (node.preset === 'composite_puppet_rig') {
        return ['Khớp xương Puppet 2.5D', 'Gắn tâm xoay [0, -0.5]', 'Tự động hướng Camera']
      }
      if (node.preset === 'hybrid_2d_3d_stage') {
        return ['Kết hợp Mô hình 3D + 2.5D', 'Đồng bộ ánh sáng 3D', 'Neo chân mặt đất']
      }
      return ['Neo gốc chân [0, -0.5]', 'Cây cối đa lớp 2.5D', 'Tự hướng mặt về Camera']

    case 'motion_choreography':
      if (node.preset === 'heroic_action_choreography') {
        return ['Nhân vật chạy (Run)', 'Gió mạnh 1.35x', 'Cây đung đưa nhịp nhanh']
      }
      if (node.preset === 'calm_cinematic_float') {
        return ['Trôi lơ lửng (Float)', 'Nhịp thở 0.75x êm dịu', 'Chuyển động mượt 60fps']
      }
      return ['Mây trôi (Drift)', 'Cây đung đưa theo gió (Wind)', `Cường độ ${intensity}%`]

    case 'physics_fx':
      if (node.preset === 'mystic_torch_cave') {
        return ['Đuốc lửa ấm nhạy gió', 'Bụi sáng huyền ảo', 'Đổ bóng rim-light 2.5D']
      }
      if (node.preset === 'storm_rain_wind_fx') {
        return ['Gió bão (Strong Wind)', 'Hạt mưa & sương rơi', 'Ánh sáng chớp động']
      }
      return [
        'Nguồn sáng ảo nhạy gió',
        node.params?.spawnParticles === false ? 'Tắt sinh hạt mới' : 'Hạt đom đóm lơ lửng',
        `Cường độ sáng ${intensity}%`
      ]

    case 'camera_director':
      if (node.preset === 'dramatic_orbit_push') {
        return ['Quỹ đạo vòng cung (Arc)', 'Dolly Push-in 0.28x', 'Rung máy Handheld nhẹ']
      }
      if (node.preset === 'smooth_pan_story') {
        return ['Lia máy ngang mượt (Ease)', 'Giữ tiêu cự ổn định', 'Chuyển cảnh tự nhiên']
      }
      return [
        'Đường bay 3D xuyên cảnh',
        'Dolly Push-in +0.15x',
        node.params?.enableDof === false ? 'Tắt xóa phông DOF' : 'Xóa phông chiều sâu DOF'
      ]

    case 'audio_lipsync':
      if (node.preset === 'dialogue_auto_lipsync') {
        return ['Tách âm thoại nhân vật', 'Tự động nhép môi Lip-Sync', 'Nén Ducking nhạc nền']
      }
      if (node.preset === 'sfx_spatial_impact') {
        return ['Âm thanh vòm 3D theo Shot', 'Điểm nhấn SFX chuyển cảnh', 'Cân bằng âm lượng']
      }
      return ['EQ Tone ấm điện ảnh', 'Fade-in 0.8s / Fade-out 1.2s', 'Hòa âm đa luồng']

    case 'look_output':
      if (node.preset === 'warm_golden_hour_grade') {
        return ['Tone Hoàng hôn Ấm (+0.18)', 'Sương mù vàng dịu', 'Tương phản 1.10']
      }
      if (node.preset === 'clean_vibrant_anime') {
        return ['Màu Anime rực rỡ (Sat 1.16)', 'Tắt sương mù 3D', 'Khung hình sắc nét']
      }
      return ['Sương mù 3D theo trục Z', 'Viền tối Vignette 0.28', 'Tương phản điện ảnh 1.08']
  }
}

/** Minh họa đồ họa động (SVG Schematic) cho từng loại khối chức năng */
function renderSchematicSvg(type: WorkflowNodeType, preset: string, color: string) {
  switch (type) {
    case 'scene_shot':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          {/* 3D Perspective Floor Grid */}
          <path
            d="M 10 38 L 45 24 L 135 24 L 170 38 Z"
            fill={color}
            fillOpacity="0.12"
            stroke={color}
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
          {/* Z-Depth Planes */}
          <rect x="26" y="6" width="34" height="22" rx="2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1" />
          <text x="43" y="19" textAnchor="middle" className="wf-svg-tag">Z:3200</text>
          <rect x="72" y="8" width="36" height="24" rx="2" fill={color} fillOpacity="0.32" stroke={color} strokeWidth="1.2" />
          <text x="90" y="22" textAnchor="middle" className="wf-svg-tag">Z:600</text>
          <rect x="120" y="10" width="36" height="26" rx="2" fill={color} fillOpacity="0.52" stroke={color} strokeWidth="1.4" />
          <text x="138" y="25" textAnchor="middle" className="wf-svg-tag">Z:0</text>
          <path d="M 62 18 L 70 18 M 110 20 L 118 20" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
      )

    case 'layer_assembly':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          {/* Character Puppet Skeleton + Foliage */}
          <line x1="20" y1="36" x2="160" y2="36" stroke={color} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 2" />
          {/* Character Rig */}
          <circle cx="56" cy="11" r="4.5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.3" />
          <line x1="56" y1="15.5" x2="56" y2="27" stroke={color} strokeWidth="1.5" />
          <line x1="46" y1="19" x2="66" y2="19" stroke={color} strokeWidth="1.3" />
          <line x1="56" y1="27" x2="49" y2="36" stroke={color} strokeWidth="1.3" />
          <line x1="56" y1="27" x2="63" y2="36" stroke={color} strokeWidth="1.3" />
          {/* Root Pivot [0, -0.5] */}
          <circle cx="56" cy="36" r="3" fill="#22c55e" stroke="#fff" strokeWidth="0.8" />
          {/* 3D Box / Tree */}
          <polygon points="118,8 106,26 130,26" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.2" />
          <line x1="118" y1="26" x2="118" y2="36" stroke={color} strokeWidth="1.6" />
          <circle cx="118" cy="36" r="2.8" fill="#22c55e" />
          <text x="148" y="23" textAnchor="middle" className="wf-svg-tag">2.5D+3D</text>
        </svg>
      )

    case 'motion_choreography':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          {/* Smooth Sine Wave & Motion Vectors */}
          <path
            d="M 12 26 Q 34 8, 56 22 T 100 20 T 144 18 T 168 22"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            className="wf-svg-anim-wave"
          />
          <path
            d="M 12 32 Q 38 18, 64 28 T 116 26 T 168 29"
            fill="none"
            stroke={color}
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
          <circle cx="56" cy="22" r="3.2" fill={color} />
          <circle cx="100" cy="20" r="3.2" fill={color} />
          <circle cx="144" cy="18" r="3.2" fill={color} />
          <text x="90" y="11" textAnchor="middle" className="wf-svg-tag">
            {preset === 'heroic_action_choreography' ? 'RUN + WIND 1.35x' : 'WIND + FLOAT 60FPS'}
          </text>
        </svg>
      )

    case 'physics_fx':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          <defs>
            <radialGradient id={`wf-light-${preset}`} cx="35%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.75" />
              <stop offset="65%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="62" cy="21" rx="46" ry="18" fill={`url(#wf-light-${preset})`} />
          <circle cx="48" cy="21" r="5" fill="#fde047" stroke={color} strokeWidth="1.2" />
          {/* Floating Firefly Particles */}
          <circle cx="88" cy="12" r="2.2" fill="#fde047" className="wf-svg-pulse" />
          <circle cx="108" cy="26" r="1.8" fill={color} className="wf-svg-pulse" />
          <circle cx="128" cy="15" r="2.5" fill="#fde047" className="wf-svg-pulse" />
          <circle cx="148" cy="28" r="1.9" fill={color} />
          <circle cx="158" cy="14" r="2.1" fill="#fde047" />
          <text x="132" y="37" textAnchor="middle" className="wf-svg-tag">LIGHT + PARTICLES</text>
        </svg>
      )

    case 'camera_director':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          {/* Camera Frustum + Curved Spline Trajectory */}
          <polygon
            points="16,24 34,12 34,34"
            fill={color}
            fillOpacity="0.28"
            stroke={color}
            strokeWidth="1.2"
          />
          <rect x="10" y="19" width="9" height="10" rx="1.5" fill={color} />
          <path
            d="M 36 23 C 66 8, 108 36, 156 16"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />
          <circle cx="78" cy="19" r="3" fill={color} />
          <circle cx="118" cy="25" r="3" fill={color} />
          <circle cx="156" cy="16" r="3.8" fill="#fff" stroke={color} strokeWidth="1.5" />
          <text x="115" y="12" textAnchor="middle" className="wf-svg-tag">FLY PATH + DOF</text>
        </svg>
      )

    case 'audio_lipsync':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
          {/* Audio Waveform Bars */}
          {[18, 26, 34, 42, 50, 58, 66, 74, 82, 90, 98, 106].map((x, i) => {
            const h = [8, 16, 24, 14, 28, 20, 12, 26, 18, 22, 14, 8][i % 12]
            return (
              <rect
                key={x}
                x={x}
                y={21 - h / 2}
                width="4"
                height={h}
                rx="1.5"
                fill={color}
                fillOpacity={0.45 + (i % 3) * 0.18}
              />
            )
          })}
          {/* Lip-Sync Mouth Curve */}
          <ellipse cx="144" cy="21" rx="16" ry="7" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.3" />
          <path d="M 132 21 Q 144 26, 156 21" fill="none" stroke={color} strokeWidth="1.2" />
          <text x="144" y="37" textAnchor="middle" className="wf-svg-tag">LIP-SYNC</text>
        </svg>
      )

    case 'look_output':
      return (
        <svg viewBox="0 0 180 42" className="wf-preview-svg">
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
            height="30"
            rx="4"
            fill={`url(#wf-grade-${preset})`}
            stroke={color}
            strokeWidth="1.2"
          />
          <line x1="90" y1="6" x2="90" y2="36" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="2 2" />
          <text x="52" y="24" textAnchor="middle" className="wf-svg-tag">FOG 3D</text>
          <text x="128" y="24" textAnchor="middle" className="wf-svg-tag">GRADE MP4</text>
        </svg>
      )
  }
}

export const WorkflowNodePreview: React.FC<WorkflowNodePreviewProps> = ({
  node,
  mode = 'card',
  onPreviewInViewport
}) => {
  const spec = WORKFLOW_NODE_SPECS[node.type]
  const presetSpec = spec?.presets.find((p) => p.id === node.preset) ?? spec?.presets[0]
  const color = spec?.color ?? '#38bdf8'
  const highlights = getEffectHighlights(node)

  if (mode === 'card') {
    return (
      <div className="wf-node-mini-preview" title={presetSpec?.summary}>
        {renderSchematicSvg(node.type, node.preset, color)}
        <div className="wf-node-mini-tags">
          {highlights.slice(0, 2).map((tag) => (
            <span key={tag} className="wf-node-mini-tag">
              {tag}
            </span>
          ))}
        </div>
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

      <div className="wf-inspector-preview-pills">
        {highlights.map((item) => (
          <span key={item} className="wf-inspector-preview-pill">
            ✓ {item}
          </span>
        ))}
      </div>
    </div>
  )
}
