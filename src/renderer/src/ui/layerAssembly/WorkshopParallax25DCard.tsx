import { useRef, useState } from 'react'
import type { LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { RigAction } from './workshopRig'
import {
  DEFAULT_PARAMETERIZED_CYCLE_25D,
  PARAMETERIZED_CYCLE_TYPES,
  PARALLAX_25D_PRESETS,
  type Parallax25DClipPreset,
  type ParameterizedCycle25DConfig,
  type ParameterizedCycleType
} from './workshopParallax25D'

export interface WorkshopParallax25DCardProps {
  rig: LayerRig
  time: number
  run: (action: RigAction) => void
  onStartPlayback?: () => void
  onPausePlayback?: () => void
}

export function WorkshopParallax25DCard({
  rig,
  time,
  run,
  onStartPlayback,
  onPausePlayback
}: WorkshopParallax25DCardProps) {
  const [mode, setMode] = useState<'parallax' | 'duik'>('parallax')
  const [yawX, setYawX] = useState(0)
  const [pitchY, setPitchY] = useState(0)
  const [intensity, setIntensity] = useState(1.0)
  const [applyLayerTilt, setApplyLayerTilt] = useState(false)
  const [cycleCfg, setCycleCfg] = useState<ParameterizedCycle25DConfig>(DEFAULT_PARAMETERIZED_CYCLE_25D)
  const [status, setStatus] = useState('')
  const padRef = useRef<HTMLDivElement | null>(null)

  const hasBones = rig.bones.length > 0

  const applyXYPose = (nx: number, ny: number) => {
    const cx = Number(Math.max(-1, Math.min(1, nx)).toFixed(2))
    const cy = Number(Math.max(-1, Math.min(1, ny)).toFixed(2))
    setYawX(cx)
    setPitchY(cy)
    if (!hasBones) return
    onPausePlayback?.()
    run({
      action: 'apply-parallax-25d-pose',
      time,
      yawX: cx,
      pitchY: cy,
      intensity,
      applyLayerTilt
    })
  }

  const handlePadPointer = (clientX: number, clientY: number) => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    const ny = ((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
    applyXYPose(nx, ny)
  }

  const handleCreateParallaxClip = (preset: Parallax25DClipPreset) => {
    if (!hasBones) return
    run({ action: 'add-parallax-25d-clip', preset, intensity })
    const meta = PARALLAX_25D_PRESETS.find((p) => p.id === preset)
    setStatus(`✓ Đã tạo clip 2.5D "${meta?.name ?? preset}"`)
    onStartPlayback?.()
  }

  const handleSelectCycleType = (cycleType: ParameterizedCycleType) => {
    const preset = PARAMETERIZED_CYCLE_TYPES.find((t) => t.id === cycleType)
    setCycleCfg((prev) => ({
      ...prev,
      cycleType,
      ...(preset?.defaultConfig ?? {})
    }))
  }

  const handleGenerateCycle = (asNewClip: boolean) => {
    if (!hasBones) return
    run({ action: 'add-parameterized-cycle-25d', config: cycleCfg, asNewClip })
    const meta = PARAMETERIZED_CYCLE_TYPES.find((t) => t.id === cycleCfg.cycleType)
    setStatus(`✓ Đã tổng hợp chu kỳ 2.5D "${meta?.label ?? cycleCfg.cycleType}"`)
    onStartPlayback?.()
  }

  return (
    <div
      className="lw-card-section lw-parallax-25d-card"
      data-mcp-region="layer_assembly_parallax_25d"
    >
      <div className="lw-card-header">
        <span className="lw-card-title">🕹️ Điều khiển 2.5D & Tổng hợp Chu kỳ</span>
      </div>

      {/* Thanh chuyển 2 chế độ: Bàn xoay 2.5D (Live2D/Spine) vs Bộ tổng hợp Duik */}
      <div
        role="tablist"
        aria-label="Công cụ chuyển động 2.5D"
        style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'parallax'}
          className={`btn xs ${mode === 'parallax' ? 'primary' : 'ghost'}`}
          onClick={() => setMode('parallax')}
          style={{ flex: 1, fontSize: '10.5px', padding: '4px 6px', borderRadius: 'var(--radius-sm, 4px)' }}
          title="Bàn xoay XY điều khiển quay đầu, nghiêng vai và lệch pha chiều sâu kiểu Live2D / Spine 2.5D"
        >
          🕹️ Bàn xoay 2.5D (Live2D)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'duik'}
          className={`btn xs ${mode === 'duik' ? 'primary' : 'ghost'}`}
          onClick={() => setMode('duik')}
          style={{ flex: 1, fontSize: '10.5px', padding: '4px 6px', borderRadius: 'var(--radius-sm, 4px)' }}
          title="Bộ tổng hợp chu kỳ Bước đi, Chạy, Rón rén, Hành quân tùy chỉnh Sải chân, Độ nảy, Đánh tay kiểu Duik"
        >
          🎛️ Tổng hợp Chu kỳ (Duik)
        </button>
      </div>

      {mode === 'parallax' ? (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            {/* Bàn xoay XY 2.5D */}
            <div
              ref={padRef}
              role="slider"
              aria-label="Bàn xoay 2.5D Yaw Pitch"
              aria-valuenow={Math.round(yawX * 100)}
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                handlePadPointer(e.clientX, e.clientY)
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) handlePadPointer(e.clientX, e.clientY)
              }}
              style={{
                position: 'relative',
                width: '108px',
                height: '92px',
                flexShrink: 0,
                background: 'var(--bg-0)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                cursor: hasBones ? 'crosshair' : 'not-allowed',
                userSelect: 'none',
                overflow: 'hidden'
              }}
              title="Kéo chấm tròn để quay đầu & thân 2.5D (Trái/Phải/Lên/Xuống)"
            >
              {/* Trục tọa độ ngang & dọc */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: 'var(--line-soft)' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'var(--line-soft)' }} />
              {/* Vòng tâm */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '48px',
                  height: '48px',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: '1px dashed var(--line-soft)'
                }}
              />
              {/* Chấm điều khiển XY */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(yawX + 1) * 50}%`,
                  top: `${(pitchY + 1) * 50}%`,
                  width: '14px',
                  height: '14px',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  background: 'var(--accent-cyan)',
                  border: '2px solid var(--bg-0)',
                  boxShadow: '0 0 8px var(--accent)'
                }}
              />
            </div>

            {/* Thông số & Điều khiển nhanh */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Ngang (Yaw): <strong>{Math.round(yawX * 100)}%</strong></span>
                <span>Dọc (Pitch): <strong>{Math.round(-pitchY * 100)}%</strong></span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--text-dim)' }}>
                <span>Biên độ:</span>
                <input
                  type="range"
                  min={0.4}
                  max={2.0}
                  step={0.1}
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: '28px', textAlign: 'right' }}>{intensity}x</span>
              </label>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)', cursor: 'pointer' }}
                title="Kết hợp nghiêng mặt phẳng 3D (RotationX / RotationY) của từng mảnh Layer theo độ sâu Z"
              >
                <input
                  type="checkbox"
                  checked={applyLayerTilt}
                  onChange={(e) => setApplyLayerTilt(e.target.checked)}
                />
                <span>Nghiêng cả mặt phẳng Layer 3D</span>
              </label>
              <button
                type="button"
                className="btn xs"
                onClick={() => applyXYPose(0, 0)}
                disabled={!hasBones}
                style={{ alignSelf: 'flex-start', padding: '2px 8px', fontSize: '10px' }}
              >
                ↺ Đưa về chính diện (0, 0)
              </button>
            </div>
          </div>

          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
            🎬 Tạo nhanh Clip Hoạt ảnh 2.5D Parallax:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px' }}>
            {PARALLAX_25D_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn xs ghost"
                disabled={!hasBones}
                onClick={() => handleCreateParallaxClip(p.id)}
                title={p.description}
                style={{
                  justifyContent: 'flex-start',
                  padding: '4px 6px',
                  fontSize: '10px',
                  borderRadius: 'var(--radius-sm, 4px)'
                }}
              >
                <span aria-hidden="true">{p.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name.split(' (')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {/* 1. Kiểu chu kỳ Duik */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px', marginBottom: '6px' }}>
            {PARAMETERIZED_CYCLE_TYPES.map((item) => {
              const active = cycleCfg.cycleType === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`btn xs ${active ? 'primary' : 'ghost'}`}
                  onClick={() => handleSelectCycleType(item.id)}
                  style={{
                    justifyContent: 'flex-start',
                    padding: '4px 5px',
                    fontSize: '10px',
                    borderRadius: 'var(--radius-sm, 4px)'
                  }}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 2. Góc nhìn */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
            {([
              ['front', '🧭 0° Chính diện'],
              ['diagonal', '📐 45° Chéo'],
              ['side', '↔️ 90° Ngang'],
              ['back', '🔙 180° Sau']
            ] as Array<[MotionViewAngle, string]>).map(([ang, label]) => (
              <button
                key={ang}
                type="button"
                className={`btn xs ${cycleCfg.viewAngle === ang ? 'primary' : 'ghost'}`}
                onClick={() => setCycleCfg((prev) => ({ ...prev, viewAngle: ang }))}
                style={{ flex: 1, fontSize: '9.5px', padding: '3px 4px', borderRadius: 'var(--radius-sm, 4px)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 3. Các thanh trượt tham số Duik */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', fontSize: '10.5px' }}>
            {([
              ['Sải chân (Stride)', 'stride', 0.3, 2.0, 0.05, 'x'],
              ['Độ nảy hông (Bounce)', 'bounce', 0.2, 2.0, 0.05, 'x'],
              ['Đánh tay (Arm Swing)', 'armSwing', 0.0, 2.0, 0.05, 'x'],
              ['Nghiêng thân (Lean)', 'bodyLean', -15, 20, 1, '°'],
              ['Phối cảnh 2.5D', 'depth25D', 0.0, 2.0, 0.1, 'x']
            ] as const).map(([label, field, min, max, step, unit]) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '112px', color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={cycleCfg[field]}
                  onChange={(e) => setCycleCfg((prev) => ({ ...prev, [field]: Number(e.target.value) }))}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '34px', textAlign: 'right', fontWeight: 600 }}>
                  {cycleCfg[field]}
                  {unit}
                </span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              type="button"
              className="btn sm primary"
              style={{ flex: 1 }}
              disabled={!hasBones}
              onClick={() => handleGenerateCycle(true)}
              title="Tạo một Clip động tác mới từ bộ tham số chu kỳ 2.5D ở trên"
            >
              🎬 + Tạo Clip Chu kỳ 2.5D
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={!hasBones}
              onClick={() => handleGenerateCycle(false)}
              title="Áp dụng trực tiếp thông số chu kỳ này lên Clip đang chọn"
            >
              🔄 Cập nhật Clip này
            </button>
          </div>
        </div>
      )}

      {status && (
        <div
          role="status"
          style={{
            marginTop: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'var(--bg-1)',
            border: '1px solid var(--line-soft)',
            fontSize: '10.5px',
            color: 'var(--accent-cyan)'
          }}
        >
          {status}
        </div>
      )}
    </div>
  )
}
