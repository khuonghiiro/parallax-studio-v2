import { useEffect, useState } from 'react'
import { usePerformance } from '../store/performance'
import { useView } from '../store/view'
import { getLiveRenderer } from '../engine/liveRenderer'
import type { ResidencyStats } from '../engine/renderTypes'
import { Select } from './controls'
import { IconCheck, IconRedo, IconSparkles, IconX } from './icons'

const ANISO_OPTIONS = [
  { value: 1, label: '1x (Tắt — Tiết kiệm tối đa)' },
  { value: 2, label: '2x (Cơ bản)' },
  { value: 4, label: '4x (Cân bằng)' },
  { value: 8, label: '8x (Sắc nét)' },
  { value: 16, label: '16x (Cực nét — Khuyên dùng)' }
]

const TEXTURE_SIZE_OPTIONS = [
  { value: 4096, label: '4096px (Chuẩn 4K)' },
  { value: 8192, label: '8192px (Chuẩn 8K — Khuyên dùng)' },
  { value: 16384, label: '16384px (Siêu phân giải)' }
]

export function PerformanceDialog() {
  const perf = usePerformance()
  const [stats, setStats] = useState<ResidencyStats | null>(null)
  const close = (): void => useView.getState().openDialog(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const live = getLiveRenderer()
      if (live) {
        setStats(live.stats())
      }
    }, 500)
    const live = getLiveRenderer()
    if (live) setStats(live.stats())
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const hw = perf.hardware
  const totalRamGB = hw ? Math.round(hw.totalRamMB / 1024) : 16
  const freeRamGB = hw ? (hw.freeRamMB / 1024).toFixed(1) : '8.0'
  const gpuName = hw?.gpuName || perf.webgl?.renderer || 'GPU hệ thống'
  const vramGB = hw?.gpuVramMB ? Math.round(hw.gpuVramMB / 1024) : null

  const usedMB = stats?.textureMB ?? 0
  const curBudgetMB = perf.budgetMB
  const percentUsed = Math.min(100, Math.round((usedMB / Math.max(1, curBudgetMB)) * 100))

  const presets = [
    { mb: 768, label: '768 MB', desc: 'Tiết kiệm pin' },
    { mb: 1024, label: '1024 MB', desc: 'Mặc định' },
    { mb: 2048, label: '2048 MB', desc: 'Mượt mà' },
    { mb: 3072, label: '3072 MB', desc: 'Tối ưu RTX' },
    { mb: 4096, label: '4096 MB', desc: 'Đồ họa 4K' },
    { mb: 6144, label: '6144 MB', desc: 'Đại cảnh 8K' }
  ]

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal perf-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconSparkles width={15} height={15} />
            </span>
            <div>
              <h2>Cấu hình Hiệu năng, RAM & VRAM GPU</h2>
              <p>Tối ưu hóa bộ nhớ đệm và sức mạnh đồ họa dựa trên cấu hình phần cứng thực tế của bạn.</p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm modal-close-btn" onClick={close} title="Đóng (Esc)">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body">
          {/* Hardware Specs Overview */}
          <div className="hw-grid">
            <div className="hw-card">
              <span className="hw-icon">🎮</span>
              <div className="hw-info">
                <span className="hw-label">Card đồ họa (GPU)</span>
                <span className="hw-val" title={gpuName}>
                  {gpuName}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
                  {vramGB ? `${vramGB} GB VRAM chuyên dụng` : 'GPU chia sẻ bộ nhớ'}
                </span>
              </div>
            </div>

            <div className="hw-card">
              <span className="hw-icon">🧠</span>
              <div className="hw-info">
                <span className="hw-label">Bộ nhớ hệ thống (RAM)</span>
                <span className="hw-val">{totalRamGB} GB RAM</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Khả dụng: ~{freeRamGB} GB</span>
              </div>
            </div>

            <div className="hw-card">
              <span className="hw-icon">💻</span>
              <div className="hw-info">
                <span className="hw-label">Bộ vi xử lý (CPU)</span>
                <span className="hw-val" title={hw?.cpuModel || 'CPU'}>
                  {hw?.cpuModel || 'Intel / AMD Processor'}
                </span>
              </div>
            </div>

            <div className="hw-card">
              <span className="hw-icon">✨</span>
              <div className="hw-info">
                <span className="hw-label">WebGL Renderer & Texture</span>
                <span className="hw-val">
                  Tối đa: {perf.webgl?.maxTextureSize || 8192}px · Aniso {perf.webgl?.maxAnisotropy || 16}x
                </span>
              </div>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="perf-tabs">
            <button
              type="button"
              className={`perf-tab${perf.mode === 'auto' ? ' active' : ''}`}
              onClick={() => perf.setMode('auto')}
            >
              ⚡ Tự động tính toán (Khuyên dùng)
            </button>
            <button
              type="button"
              className={`perf-tab${perf.mode === 'manual' ? ' active' : ''}`}
              onClick={() => perf.setMode('manual')}
            >
              🛠 Cấu hình thủ công
            </button>
          </div>

          {/* Content based on Mode */}
          {perf.mode === 'auto' ? (
            <div className="perf-auto-box highlight">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="perf-badge">
                  <IconCheck width={12} height={12} /> ĐÃ TỰ ĐỘNG TỐI ƯU
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
                  {perf.optimal.summary}
                </span>
              </div>

              <div className="perf-stats-row">
                <div className="perf-stat-item">
                  <span className="perf-stat-num">{perf.budgetMB} MB</span>
                  <span className="perf-stat-label">Ngân sách VRAM</span>
                </div>
                <div className="perf-stat-item">
                  <span className="perf-stat-num">{perf.maxAnisotropy}x</span>
                  <span className="perf-stat-label">Lọc nghiêng (Aniso)</span>
                </div>
                <div className="perf-stat-item">
                  <span className="perf-stat-num">{perf.maxTextureSize}px</span>
                  <span className="perf-stat-label">Ảnh tối đa</span>
                </div>
              </div>

              <p className="perf-reason">{perf.optimal.reason}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="perf-section-title">Chọn nhanh mức VRAM:</div>
                <div className="perf-preset-grid">
                  {presets.map((p) => (
                    <button
                      key={p.mb}
                      type="button"
                      className={`perf-preset-btn${perf.budgetMB === p.mb ? ' active' : ''}`}
                      onClick={() => perf.setBudget(p.mb)}
                    >
                      <span className="mb">{p.label}</span>
                      <span className="desc">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="perf-section-title">Ngân sách bộ đệm VRAM chi tiết:</span>
                  <b style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: '13px' }}>
                    {perf.budgetMB} MB ({(perf.budgetMB / 1024).toFixed(1)} GB)
                  </b>
                </div>
                <input
                  type="range"
                  min={512}
                  max={Math.max(8192, (hw?.gpuVramMB ?? 0) > 8000 ? 12288 : 8192)}
                  step={256}
                  value={perf.budgetMB}
                  onChange={(e) => perf.setBudget(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 6 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <span className="perf-section-title" style={{ display: 'block', marginBottom: 4 }}>
                    Lọc bề mặt nghiêng (Anisotropic):
                  </span>
                  <Select
                    size="sm"
                    value={perf.maxAnisotropy}
                    options={ANISO_OPTIONS}
                    onChange={(val) => perf.setAnisotropy(Number(val))}
                  />
                </div>

                <div>
                  <span className="perf-section-title" style={{ display: 'block', marginBottom: 4 }}>
                    Kích thước ảnh tối đa (Texture):
                  </span>
                  <Select
                    size="sm"
                    value={perf.maxTextureSize}
                    options={TEXTURE_SIZE_OPTIONS}
                    onChange={(val) => perf.setMaxTextureSize(Number(val))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Live VRAM Meter */}
          <div className="perf-meter">
            <div className="perf-meter-head">
              <span>Đang chiếm dụng GPU:</span>
              <span style={{ fontFamily: 'var(--mono)' }}>
                {usedMB.toFixed(0)} / {curBudgetMB} MB ({percentUsed}%) · {stats?.textures ?? 0} texture
              </span>
            </div>
            <div className="perf-meter-bar">
              <div
                className={`perf-meter-fill${percentUsed > 85 ? ' warn' : ''}`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              💡 Khi làm việc với nhiều layer ảnh, app chỉ nạp các layer trong khung nhìn camera vào VRAM và tự động giải phóng ảnh ở cảnh xa.
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {perf.mode === 'manual' && (
            <button type="button" className="btn ghost" onClick={() => perf.resetToAuto()} title="Quay về mức tự động tính toán">
              <IconRedo /> Khôi phục Tự động
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn primary" onClick={close}>
            <IconCheck /> Áp dụng & Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

