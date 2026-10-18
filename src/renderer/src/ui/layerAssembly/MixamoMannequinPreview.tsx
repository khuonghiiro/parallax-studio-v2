import { useEffect, useMemo, useState } from 'react'
import type { LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import { evaluateRig } from '../../engine/layerRig'
import {
  createHumanoidBones,
  createClipFromPreset,
  type ProceduralMotionPreset
} from './workshopRigPresets'

export interface MixamoMannequinPreviewProps {
  preset: ProceduralMotionPreset | 'blank'
  viewAngle: MotionViewAngle
  duration: number
  customBones?: LayerBone[]
  height?: number
}

interface RenderedBoneSegment {
  id: string
  headX: number
  headY: number
  tailX: number
  tailY: number
  angle: number
}

export function MixamoMannequinPreview({
  preset,
  viewAngle,
  duration,
  customBones,
  height = 185
}: MixamoMannequinPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState<number>(1)
  const [time, setTime] = useState<number>(0)

  const demoRig = useMemo<LayerRig>(() => {
    const bones = customBones && customBones.length > 0 ? customBones : createHumanoidBones()
    if (preset === 'blank') {
      return {
        bones,
        duration: Math.max(0.4, duration || 2.0),
        loop: true,
        tracks: {}
      }
    }
    const clip = createClipFromPreset(preset, bones, 'Demo', viewAngle)
    return {
      bones,
      duration: clip.duration,
      loop: true,
      tracks: clip.tracks
    }
  }, [preset, viewAngle, duration, customBones])

  useEffect(() => {
    if (!isPlaying) return
    let rafId = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setTime((prev) => (prev + dt * speed) % Math.max(0.2, demoRig.duration))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, speed, demoRig.duration])

  const segments = useMemo(() => {
    const transforms = evaluateRig(demoRig, time)
    const map = new Map<string, RenderedBoneSegment>()
    for (const bone of demoRig.bones) {
      const tf = transforms.get(bone.id)
      if (!tf) continue
      const angle = bone.angle + tf.rotation
      const rad = (angle * Math.PI) / 180
      const headX = tf.x
      const headY = tf.y
      const tailX = headX + Math.cos(rad) * bone.length
      const tailY = headY + Math.sin(rad) * bone.length
      map.set(bone.id, { id: bone.id, headX, headY, tailX, tailY, angle })
    }
    return map
  }, [demoRig, time])

  const getBone = (id: string): RenderedBoneSegment | undefined => segments.get(id)

  const restMetrics = useMemo(() => {
    let minY = Infinity
    let maxY = -Infinity
    let sumX = 0
    for (const b of demoRig.bones) {
      const rad = (b.angle * Math.PI) / 180
      const tx = b.x + Math.cos(rad) * b.length
      const ty = b.y + Math.sin(rad) * b.length
      if (b.y < minY) minY = b.y
      if (ty < minY) minY = ty
      if (b.y > maxY) maxY = b.y
      if (ty > maxY) maxY = ty
      sumX += b.x
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      minY = -145
      maxY = 175
    }
    const pelvisBone = demoRig.bones.find((b) => b.id === 'bone-pelvis')
    const centerX = pelvisBone ? pelvisBone.x : demoRig.bones.length ? sumX / demoRig.bones.length : 0
    const spanH = Math.max(180, maxY - minY)
    const s = Math.max(0.45, Math.min(3.2, spanH / 320))
    const vbH = Math.round(spanH * 1.28)
    const vbW = Math.round(vbH * 0.95)
    const vbX = Math.round(centerX - vbW / 2)
    const vbY = Math.round(minY - spanH * 0.14)
    const floorY = Math.round(maxY + 6 * s)
    return { centerX, minY, maxY, spanH, s, vbX, vbY, vbW, vbH, floorY }
  }, [demoRig.bones])

  const { s, vbX, vbY, vbW, vbH, floorY, centerX } = restMetrics

  const renderLimbCapsule = (
    bone: RenderedBoneSegment | undefined,
    baseWidth: number,
    fill: string,
    stroke: string
  ) => {
    if (!bone) return null
    const width = baseWidth * s
    return (
      <g key={`limb-${bone.id}`}>
        <line
          x1={bone.headX}
          y1={bone.headY}
          x2={bone.tailX}
          y2={bone.tailY}
          stroke={stroke}
          strokeWidth={width + 2.5 * s}
          strokeLinecap="round"
        />
        <line
          x1={bone.headX}
          y1={bone.headY}
          x2={bone.tailX}
          y2={bone.tailY}
          stroke={fill}
          strokeWidth={width}
          strokeLinecap="round"
        />
      </g>
    )
  }

  const pelvis = getBone('bone-pelvis')
  const torso = getBone('bone-torso')
  const head = getBone('bone-head')
  const armL = getBone('bone-arm-l')
  const forearmL = getBone('bone-forearm-l')
  const handL = getBone('bone-hand-l')
  const armR = getBone('bone-arm-r')
  const forearmR = getBone('bone-forearm-r')
  const handR = getBone('bone-hand-r')
  const thighL = getBone('bone-thigh-l')
  const shinL = getBone('bone-shin-l')
  const footL = getBone('bone-foot-l')
  const thighR = getBone('bone-thigh-r')
  const shinR = getBone('bone-shin-r')
  const footR = getBone('bone-foot-r')

  const headCenterX = head ? (head.headX + head.tailX) * 0.5 : centerX
  const headCenterY = head ? (head.headY + head.tailY) * 0.5 : -115 * s
  const faceOffsetX =
    (viewAngle === 'side' ? 9 : viewAngle === 'diagonal' ? 5 : 0) * s

  return (
    <div
      className="lw-mixamo-mannequin-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-0)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line-soft)',
          fontSize: '11px'
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
          🕺 Mẫu Demo Người & Xương (Mixamo Preview)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn xs"
            onClick={() => setSpeed((sp) => (sp === 1 ? 0.5 : 1))}
            title="Đổi tốc độ xem thử"
            style={{ fontSize: '10px', padding: '1px 5px' }}
          >
            {speed}x
          </button>
          <button
            type="button"
            className={`btn xs ${isPlaying ? 'primary' : ''}`}
            onClick={() => setIsPlaying((p) => !p)}
            style={{ fontSize: '10px', padding: '1px 6px' }}
          >
            {isPlaying ? '⏸ Tạm dừng' : '▶ Phát'}
          </button>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: `${height}px`,
          width: '100%',
          background: 'radial-gradient(circle at 50% 45%, rgba(30, 41, 59, 0.22), transparent 78%)'
        }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <radialGradient id="mannequinFloorGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.35)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
            </radialGradient>
          </defs>

          {/* Lưới nền & mặt đất */}
          <line
            x1={centerX - 125 * s}
            y1={floorY}
            x2={centerX + 125 * s}
            y2={floorY}
            stroke="var(--line)"
            strokeWidth={1.5 * s}
            strokeDasharray={`${4 * s} ${4 * s}`}
          />
          <ellipse
            cx={pelvis?.headX ?? centerX}
            cy={floorY + 2 * s}
            rx={52 * s}
            ry={10 * s}
            fill="url(#mannequinFloorGrad)"
          />

          {/* Tay & Chân phía sau (Back limbs) */}
          {renderLimbCapsule(thighL, 16, '#64748b', '#334155')}
          {renderLimbCapsule(shinL, 13, '#64748b', '#334155')}
          {renderLimbCapsule(footL, 10, '#475569', '#1e293b')}
          {renderLimbCapsule(armL, 13, '#64748b', '#334155')}
          {renderLimbCapsule(forearmL, 11, '#64748b', '#334155')}
          {renderLimbCapsule(handL, 9, '#475569', '#1e293b')}

          {/* Thân người (Pelvis & Torso) */}
          {renderLimbCapsule(pelvis, 30, '#3b82f6', '#1d4ed8')}
          {renderLimbCapsule(torso, 36, '#2563eb', '#1e40af')}

          {/* Đầu Mannequin */}
          {head && (
            <g>
              <circle
                cx={headCenterX}
                cy={headCenterY}
                r={24 * s}
                fill="#3b82f6"
                stroke="#1d4ed8"
                strokeWidth={2.2 * s}
              />
              {viewAngle !== 'back' && (
                <rect
                  x={headCenterX - 12 * s + faceOffsetX}
                  y={headCenterY - 6 * s}
                  width={24 * s}
                  height={8 * s}
                  rx={4 * s}
                  fill="#e0f2fe"
                  stroke="#0284c7"
                  strokeWidth={1 * s}
                />
              )}
            </g>
          )}

          {/* Tay & Chân phía trước (Front limbs) */}
          {renderLimbCapsule(thighR, 16, '#60a5fa', '#2563eb')}
          {renderLimbCapsule(shinR, 13, '#60a5fa', '#2563eb')}
          {renderLimbCapsule(footR, 10, '#38bdf8', '#0284c7')}
          {renderLimbCapsule(armR, 13, '#60a5fa', '#2563eb')}
          {renderLimbCapsule(forearmR, 11, '#60a5fa', '#2563eb')}
          {renderLimbCapsule(handR, 9, '#38bdf8', '#0284c7')}

          {/* Lớp Xương (Skeleton Overlay) nổi rõ bên trong Mannequin */}
          {Array.from(segments.values()).map((b) => (
            <g key={`bone-${b.id}`}>
              <line
                x1={b.headX}
                y1={b.headY}
                x2={b.tailX}
                y2={b.tailY}
                stroke="#fef08a"
                strokeWidth={2.4 * s}
                strokeLinecap="round"
              />
              <circle
                cx={b.headX}
                cy={b.headY}
                r={(b.id === 'bone-pelvis' ? 5.5 : 3.8) * s}
                fill={b.id === 'bone-pelvis' ? '#facc15' : '#ffffff'}
                stroke="#0f172a"
                strokeWidth={1.6 * s}
              />
            </g>
          ))}
        </svg>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 10px',
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--line-soft)',
          fontSize: '10px',
          color: 'var(--text-dim)'
        }}
      >
        <span>
          Góc nhìn: <strong style={{ color: 'var(--text)' }}>{viewAngle === 'front' ? '0° Chính diện' : viewAngle === 'diagonal' ? '45° Chéo' : viewAngle === 'side' ? '90° Ngang' : '180° Sau lưng'}</strong>
        </span>
        <span>
          {time.toFixed(1)}s / {demoRig.duration.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
