import React from 'react'
import type { WorkflowNodeType } from '@shared/types'

/**
 * Minh họa đồ họa động (SVG Schematic) trực quan, chuẩn xác theo từng Node Logic và chức năng 2.5D.
 * Mỗi loại Node Logic sở hữu một bản vẽ kỹ thuật riêng biệt, không trùng lặp.
 */
export function renderSchematicSvg(
  type: WorkflowNodeType,
  preset: string,
  color: string,
  logicId?: string
): React.ReactElement {
  // 1. Phân biệt theo từng mã định danh Logic Node chuyên biệt trong Catalog (32 chức năng)
  switch (logicId) {
    // ---------------------------------------------------------------- CAMERA LOGIC
    case 'logic-cam-fly':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <path
            d="M 16 32 C 45 10, 95 36, 142 16"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />
          <circle cx="16" cy="32" r="3" fill={color} />
          <circle cx="80" cy="24" r="2.8" fill={color} />
          <circle cx="142" cy="16" r="3.6" fill="#fff" stroke={color} strokeWidth="1.6" />
          <polygon points="144,16 164,7 164,25" fill={color} fillOpacity="0.32" stroke={color} strokeWidth="1" />
          <text x="75" y="11" textAnchor="middle" className="wf-svg-tag">SPLINE 3D PATH</text>
        </svg>
      )

    case 'logic-cam-dolly':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Phễu hội tụ tiêu cự đẩy cận (Dolly Zoom Frustum) */}
          <polygon points="14,6 48,15 48,25 14,34" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.2" />
          <line x1="48" y1="20" x2="124" y2="20" stroke={color} strokeWidth="2" strokeDasharray="3 3" />
          <polygon points="124,15 136,20 124,25" fill={color} />
          {/* Kim cương tâm điểm hội tụ */}
          <polygon points="152,11 162,20 152,29 142,20" fill={color} fillOpacity="0.5" stroke="#fff" strokeWidth="1.2" />
          <text x="88" y="12" textAnchor="middle" className="wf-svg-tag">DOLLY IN ➔ FOCUS</text>
        </svg>
      )

    case 'logic-cam-orbit':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Vòng cung quỹ đạo 360 độ bao quanh tâm */}
          <ellipse cx="90" cy="20" rx="68" ry="14" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
          {/* Khối lập phương tâm điểm cảnh */}
          <rect x="84" y="14" width="12" height="12" rx="2" fill={color} fillOpacity="0.45" stroke="#fff" strokeWidth="1" />
          {/* Camera xoay trên cung */}
          <circle cx="152" cy="23" r="4.2" fill={color} stroke="#fff" strokeWidth="1.4" />
          <polygon points="152,19 162,23 154,28" fill={color} />
          <text x="90" y="10" textAnchor="middle" className="wf-svg-tag">ORBIT 360° ARC</text>
        </svg>
      )

    case 'logic-cam-pan':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Mũi tên lia ngang hai chiều và camera bám mục tiêu */}
          <line x1="20" y1="24" x2="160" y2="24" stroke={color} strokeWidth="1.6" />
          <polygon points="20,20 12,24 20,28" fill={color} />
          <polygon points="160,20 168,24 160,28" fill={color} />
          <rect x="76" y="8" width="28" height="18" rx="3" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.2" />
          <circle cx="90" cy="17" r="4" fill={color} />
          <text x="90" y="35" textAnchor="middle" className="wf-svg-tag">PAN & TRACK ➔</text>
        </svg>
      )

    case 'logic-cam-shake':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Sóng chấn động rung giật Handheld dứt khoát */}
          <path
            d="M 12 20 L 36 20 L 46 8 L 58 32 L 70 12 L 82 28 L 94 15 L 106 25 L 118 18 L 130 20 L 168 20"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
          />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">HANDHELD SHAKE</text>
        </svg>
      )

    case 'logic-cam-dof':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Lá khẩu độ Bokeh tròn & vạch làm mờ phông */}
          <circle cx="45" cy="20" r="14" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="90" cy="20" r="13" fill={color} fillOpacity="0.32" stroke="#fff" strokeWidth="1.5" />
          <circle cx="135" cy="20" r="14" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="90" cy="20" r="4" fill="#fff" />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">BOKEH DOF f/1.8</text>
        </svg>
      )

    // ---------------------------------------------------------------- AUDIO LOGIC
    case 'logic-audio-bgm':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Dải phổ nhạc tần số ấm kết hợp nốt nhạc BGM */}
          {[20, 32, 44, 56, 68, 80, 92, 104, 116, 128].map((x, i) => {
            const h = [10, 18, 24, 16, 28, 22, 14, 20, 12, 8][i]
            return (
              <rect
                key={x}
                x={x}
                y={22 - h / 2}
                width="6"
                height={h}
                rx="2"
                fill={color}
                fillOpacity={0.45 + (i % 3) * 0.2}
              />
            )
          })}
          {/* Biểu tượng nốt móc đơn */}
          <circle cx="152" cy="23" r="4.5" fill={color} />
          <line x1="156.5" y1="23" x2="156.5" y2="9" stroke={color} strokeWidth="1.8" />
          <path d="M 156.5 9 Q 165 11, 166 16" fill="none" stroke={color} strokeWidth="1.8" />
          <text x="74" y="37" textAnchor="middle" className="wf-svg-tag">BGM EQUALIZER</text>
        </svg>
      )

    case 'logic-audio-lipsync':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Sóng âm giọng nói dẫn truyền vào khuôn miệng 2.5D */}
          <path d="M 14 20 Q 28 8, 42 20 T 70 20 T 98 20" fill="none" stroke={color} strokeWidth="1.6" />
          <ellipse cx="138" cy="20" rx="20" ry="9" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.4" />
          <path d="M 124 20 Q 138 27, 152 20" fill="none" stroke="#fff" strokeWidth="1.5" />
          <text x="138" y="36" textAnchor="middle" className="wf-svg-tag">LIP-SYNC VISEME</text>
        </svg>
      )

    case 'logic-audio-sfx':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Tiếng nổ / hiệu ứng va chạm Starburst SFX */}
          <circle cx="90" cy="20" r="16" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" strokeDasharray="3 2" />
          <circle cx="90" cy="20" r="7" fill={color} fillOpacity="0.5" stroke="#fff" strokeWidth="1.2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
            const rad = (ang * Math.PI) / 180
            const x1 = 90 + Math.cos(rad) * 9
            const y1 = 20 + Math.sin(rad) * 9
            const x2 = 90 + Math.cos(rad) * 16
            const y2 = 20 + Math.sin(rad) * 16
            return <line key={ang} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" />
          })}
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">SFX IMPACT BURST</text>
        </svg>
      )

    // ---------------------------------------------------------------- PHYSICS 2.5D
    case 'logic-physics-wind':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Luồng gió uốn lượn thổi bay tán lá */}
          <path d="M 14 14 Q 55 4, 95 16 T 166 12" fill="none" stroke={color} strokeWidth="1.8" />
          <path d="M 24 24 Q 68 14, 110 26 T 156 22" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="4 2" />
          {/* Lá bay xoay */}
          <ellipse cx="65" cy="18" rx="4" ry="2" transform="rotate(-25 65 18)" fill={color} />
          <ellipse cx="125" cy="20" rx="4" ry="2" transform="rotate(35 125 20)" fill={color} />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">WIND BREEZE 2.5D</text>
        </svg>
      )

    case 'logic-physics-elastic':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Lưới biến dạng lò xo đàn hồi (Mesh Jiggle Spring) */}
          <path
            d="M 18 20 L 38 20 L 46 10 L 56 30 L 66 12 L 76 28 L 86 16 L 96 24 L 106 20 L 162 20"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
          />
          <circle cx="162" cy="20" r="5" fill={color} stroke="#fff" strokeWidth="1.4" />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">ELASTIC SPRING</text>
        </svg>
      )

    case 'logic-physics-sway':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Con lắc đung đưa quanh trục neo đỉnh */}
          <circle cx="90" cy="6" r="3" fill="#fff" stroke={color} strokeWidth="1.5" />
          <line x1="90" y1="6" x2="68" y2="28" stroke={color} strokeWidth="1.5" />
          <circle cx="68" cy="28" r="5.5" fill={color} stroke="#fff" strokeWidth="1.2" />
          <path d="M 64 30 Q 90 35, 116 30" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="112" cy="28" r="4" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
          <text x="140" y="20" textAnchor="middle" className="wf-svg-tag">SWAY ARC</text>
        </svg>
      )

    case 'logic-physics-bounce':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Trọng lực rơi & nảy parabolic nhiều nhịp */}
          <line x1="14" y1="32" x2="166" y2="32" stroke={color} strokeWidth="1.2" />
          <path d="M 22 10 Q 38 32, 54 32 Q 74 16, 94 32 Q 112 22, 130 32 Q 144 26, 158 32" fill="none" stroke={color} strokeWidth="1.8" />
          <circle cx="22" cy="10" r="4.5" fill={color} stroke="#fff" strokeWidth="1.2" />
          <text x="90" y="11" textAnchor="middle" className="wf-svg-tag">GRAVITY BOUNCE</text>
        </svg>
      )

    // ---------------------------------------------------------------- LIGHT & GLOW FX
    case 'logic-fx-candle':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <circle cx="90" cy="20" r="16" fill="#f59e0b" fillOpacity="0.22" />
          <circle cx="90" cy="20" r="9" fill="#fbbf24" fillOpacity="0.45" />
          <ellipse cx="90" cy="18" rx="3.5" ry="6" fill="#fff" />
          <circle cx="90" cy="17" r="2" fill="#ef4444" />
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">WARM CANDLE GLOW</text>
        </svg>
      )

    case 'logic-fx-flashlight':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Đèn pin chùm tia nón định hướng */}
          <rect x="18" y="16" width="16" height="8" rx="2" fill={color} />
          <polygon points="34,16 162,5 162,35 34,24" fill={color} fillOpacity="0.26" stroke={color} strokeWidth="0.8" />
          <line x1="34" y1="20" x2="162" y2="20" stroke="#fff" strokeWidth="1.2" strokeDasharray="3 3" />
          <text x="100" y="36" textAnchor="middle" className="wf-svg-tag">SPOTLIGHT CONE</text>
        </svg>
      )

    case 'logic-fx-rimglow':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Viền sáng neon ôm sát hình thể */}
          <rect x="55" y="8" width="70" height="24" rx="12" fill="none" stroke={color} strokeWidth="2.5" />
          <rect x="55" y="8" width="70" height="24" rx="12" fill={color} fillOpacity="0.18" />
          <rect x="62" y="12" width="56" height="16" rx="8" fill="var(--bg-1)" />
          <text x="90" y="24" textAnchor="middle" className="wf-svg-tag">NEON RIM GLOW</text>
        </svg>
      )

    case 'logic-fx-particles':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {[
            [26, 14, 2.5],
            [54, 26, 2],
            [78, 12, 3],
            [104, 24, 2.2],
            [132, 15, 3.2],
            [156, 28, 2]
          ].map(([x, y, r], idx) => (
            <g key={idx}>
              <circle cx={x} cy={y} r={r * 2} fill={color} fillOpacity="0.25" />
              <circle cx={x} cy={y} r={r} fill="#fff" />
            </g>
          ))}
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">FIREFLY PARTICLES</text>
        </svg>
      )

    // ---------------------------------------------------------------- MOTION 2.5D
    case 'logic-motion-walk-z':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Lưới phối cảnh chiều sâu Z và bước chân */}
          <line x1="90" y1="8" x2="30" y2="34" stroke={color} strokeWidth="1.2" />
          <line x1="90" y1="8" x2="150" y2="34" stroke={color} strokeWidth="1.2" />
          <line x1="60" y1="21" x2="120" y2="21" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="82" cy="27" r="3.2" fill={color} />
          <circle cx="98" cy="20" r="2.5" fill={color} />
          <circle cx="90" cy="14" r="2" fill={color} />
          <text x="90" y="9" textAnchor="middle" className="wf-svg-tag">WALK INTO Z-DEPTH</text>
        </svg>
      )

    case 'logic-motion-jump':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Quỹ đạo bật nhảy Parabol đỉnh cao */}
          <path d="M 22 32 Q 90 -4, 158 32" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="90" cy="5" r="4.5" fill="#fff" stroke={color} strokeWidth="1.5" />
          <line x1="16" y1="33" x2="164" y2="33" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
          <text x="90" y="24" textAnchor="middle" className="wf-svg-tag">PARABOLIC JUMP</text>
        </svg>
      )

    case 'logic-motion-drift':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Mây trôi ngang nhẹ nhàng */}
          <path d="M 24 20 Q 36 12, 54 18 Q 72 12, 90 20 Q 96 26, 84 26 L 30 26 Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1" />
          <path d="M 100 18 Q 112 10, 130 16 Q 146 10, 160 18 Q 166 24, 154 24 L 106 24 Z" fill={color} fillOpacity="0.45" stroke={color} strokeWidth="1" />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">DRIFT CLOUDS</text>
        </svg>
      )

    case 'logic-motion-breathe':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          {/* Nhịp thở điều hòa Sinusoidal */}
          <path d="M 16 20 Q 52 4, 90 20 T 164 20" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="52" cy="12" r="3.2" fill={color} />
          <circle cx="128" cy="28" r="3.2" fill={color} />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">BREATHE CYCLE</text>
        </svg>
      )

    // ---------------------------------------------------------------- SCENE & ENTITIES
    case 'logic-scene-deep':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="20" y="6" width="34" height="20" rx="2" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1" />
          <rect x="72" y="8" width="36" height="22" rx="2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
          <rect x="126" y="10" width="36" height="24" rx="2" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1.5" />
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">DEEP Z-LAYERS</text>
        </svg>
      )

    case 'logic-scene-compact':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="50" y="7" width="80" height="26" rx="4" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.2" />
          <circle cx="90" cy="18" r="7" fill={color} stroke="#fff" strokeWidth="1.2" />
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">PORTRAIT STAGE</text>
        </svg>
      )

    case 'logic-assembly-child':
    case 'logic-assembly-billboard':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <line x1="20" y1="34" x2="160" y2="34" stroke={color} strokeWidth="1" />
          <rect x="72" y="8" width="36" height="24" rx="2" fill={color} fillOpacity="0.32" stroke={color} strokeWidth="1.4" />
          <circle cx="90" cy="34" r="3.2" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          <text x="90" y="21" textAnchor="middle" className="wf-svg-tag">BILLBOARD Y</text>
        </svg>
      )

    case 'logic-assembly-parts':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <circle cx="90" cy="12" r="5" fill={color} />
          <rect x="83" y="18" width="14" height="12" rx="2" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1" />
          <line x1="77" y1="21" x2="83" y2="21" stroke={color} strokeWidth="1.4" />
          <line x1="97" y1="21" x2="103" y2="21" stroke={color} strokeWidth="1.4" />
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">PARTS RIG</text>
        </svg>
      )

    case 'logic-assembly-arch3d':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <polygon points="90,6 126,14 90,22 54,14" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1" />
          <polygon points="54,14 90,22 90,34 54,26" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1" />
          <polygon points="126,14 90,22 90,34 126,26" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1" />
          <text x="90" y="37" textAnchor="middle" className="wf-svg-tag">3D ISOMETRIC</text>
        </svg>
      )

    // ---------------------------------------------------------------- LOOK OUTPUT
    case 'logic-look-sharp':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <polygon points="90,7 108,20 90,33 72,20" fill={color} fillOpacity="0.4" stroke="#fff" strokeWidth="1.4" />
          <line x1="90" y1="7" x2="90" y2="33" stroke="#fff" strokeWidth="1" strokeDasharray="2 2" />
          <text x="90" y="24" textAnchor="middle" className="wf-svg-tag">VIBRANT SHARP</text>
        </svg>
      )

    case 'logic-look-warm':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <defs>
            <linearGradient id="wf-sunset-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#eab308" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <rect x="18" y="7" width="144" height="26" rx="4" fill="url(#wf-sunset-glow)" stroke="#fff" strokeWidth="1" />
          <text x="90" y="24" textAnchor="middle" className="wf-svg-tag">WARM SUNSET</text>
        </svg>
      )

    case 'logic-look-fog':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="18" y="7" width="144" height="26" rx="4" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1" />
          <path d="M 22 22 Q 55 12, 90 22 T 158 22" fill="none" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.8" />
          <text x="90" y="35" textAnchor="middle" className="wf-svg-tag">Z-DEPTH FOG</text>
        </svg>
      )
  }

  // 2. Dự phòng theo loại Node cơ sở (Generic fallback)
  switch (type) {
    case 'scene_shot':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="22" y="7" width="36" height="22" rx="2" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1" />
          <rect x="70" y="7" width="38" height="23" rx="2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
          <rect x="120" y="7" width="38" height="25" rx="2" fill={color} fillOpacity="0.55" stroke={color} strokeWidth="1.4" />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">SCENE COMPOSITE</text>
        </svg>
      )

    case 'layer_assembly':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <circle cx="48" cy="11" r="4.5" fill={color} stroke={color} strokeWidth="1.2" />
          <line x1="48" y1="15.5" x2="48" y2="28" stroke={color} strokeWidth="1.5" />
          <polygon points="104,8 92,26 116,26" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.2" />
          <line x1="16" y1="35" x2="164" y2="35" stroke={color} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 2" />
          <text x="145" y="23" textAnchor="middle" className="wf-svg-tag">RIG 2.5D</text>
        </svg>
      )

    case 'motion_choreography':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <path d="M 12 22 Q 34 8, 56 21 T 100 19 T 144 17 T 168 21" fill="none" stroke={color} strokeWidth="1.8" />
          <circle cx="56" cy="21" r="3" fill={color} />
          <circle cx="100" cy="19" r="3" fill={color} />
          <text x="90" y="36" textAnchor="middle" className="wf-svg-tag">MOTION STREAM</text>
        </svg>
      )

    case 'physics_fx':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <circle cx="44" cy="20" r="5" fill="#fde047" stroke={color} strokeWidth="1.2" />
          <circle cx="86" cy="14" r="2.5" fill="#fde047" />
          <circle cx="126" cy="18" r="3" fill={color} />
          <text x="128" y="35" textAnchor="middle" className="wf-svg-tag">PHYSICS + VFX</text>
        </svg>
      )

    case 'camera_director':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <polygon points="16,23 34,11 34,33" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.2" />
          <path d="M 36 22 C 66 7, 108 35, 156 15" fill="none" stroke={color} strokeWidth="1.8" strokeDasharray="4 2" />
          <text x="115" y="11" textAnchor="middle" className="wf-svg-tag">CAMERA DIRECTOR</text>
        </svg>
      )

    case 'audio_lipsync':
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="40" y="14" width="4" height="14" rx="1.5" fill={color} />
          <rect x="52" y="8" width="4" height="24" rx="1.5" fill={color} />
          <rect x="64" y="12" width="4" height="18" rx="1.5" fill={color} />
          <text x="120" y="24" textAnchor="middle" className="wf-svg-tag">AUDIO TRACK</text>
        </svg>
      )

    case 'look_output':
    default:
      return (
        <svg viewBox="0 0 180 40" className="wf-preview-svg">
          <rect x="14" y="8" width="152" height="24" rx="4" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.2" />
          <text x="90" y="24" textAnchor="middle" className="wf-svg-tag">MASTER OUTPUT</text>
        </svg>
      )
  }
}
