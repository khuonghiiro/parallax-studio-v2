import { useEffect, useState } from 'react'
import { usePerformance, type UiEffectsMode } from '../store/performance'
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

const UI_FX_OPTIONS: { id: UiEffectsMode; icon: string; label: string; desc: string }[] = [
  { id: 'auto', icon: '⚡', label: 'Theo cấu hình máy', desc: 'Mạnh bật Ultra · Yếu tự giảm' },
  { id: 'ultra', icon: '💎', label: 'Ultra Xịn Sò', desc: 'Kính mờ, hào quang & nhịp sáng' },
  { id: 'balanced', icon: '⚖️', label: 'Cân bằng mượt', desc: 'Bo bóng sắc nét · Nhẹ GPU' },
  { id: 'lite', icon: '🪶', label: 'Siêu nhẹ (Lite)', desc: 'Tắt kính mờ · Tối đa FPS' }
]

const TIER_LABELS = {
  ultra: '💎 Đang chạy: ULTRA XỊN SÒ',
  balanced: '⚖️ Đang chạy: CÂN BẰNG',
  lite: '🪶 Đang chạy: SIÊU NHẸ'
} as const

export function PerformanceDialog() {
  const perf = usePerformance()
  const [stats, setStats] = useState<ResidencyStats | null>(null)
  const close = (): void => useView.getState().openDialog(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const live = getLiveRenderer()
      if (live) setStats(live.stats())
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
      <div
        className="modal perf-modal"
        role="dialog"
        aria-modal="true"
        data-ai-surface="dialog"
        data-ai-surface-label="Cấu hình Hiệu năng & Hiệu ứng Giao diện"
        data-mcp-region="perf_dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconSparkles width={15} height={15} />
            </span>
            <div>
              <h2>Cấu hình Hiệu năng, VRAM & Hiệu ứng Giao diện</h2>
              <p>Tự động phân bổ bộ nhớ đệm GPU và điều chỉnh độ xịn sò của hiệu ứng UI theo cấu hình máy.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn icon ghost sm modal-close-btn"
            aria-label="Đóng hộp thoại hiệu năng"
            onClick={close}
            title="Đóng (Esc)"
          >
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body">
          {/* Hardware Specs Overview */}
          <div className="hw-grid" data-mcp-region="perf_hardware">
            <div className="hw-card">
              <span className="hw-icon">🎮</span>
              <div className="hw-info">
                <span className="hw-label">Card đồ họa (GPU)</span>
                <span className="hw-val" title={gpuName}>
                  {gpuName}
                </span>
                <span className="hw-sub-accent">
                  {vramGB ? `${vramGB} GB VRAM chuyên dụng` : 'GPU chia sẻ bộ nhớ'}
                </span>
              </div>
            </div>

            <div className="hw-card">
              <span className="hw-icon">🧠</span>
              <div className="hw-info">
                <span className="hw-label">Bộ nhớ hệ thống (RAM)</span>
                <span className="hw-val">{totalRamGB} GB RAM</span>
                <span className="hw-sub-dim">Khả dụng: ~{freeRamGB} GB</span>
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

          {/* Hardware-Adaptive UI Effects Card */}
          <div className="perf-ui-fx-card" data-mcp-region="perf_ui_fx">
            <div className="perf-ui-fx-head">
              <div>
                <div className="perf-section-title">✨ Hiệu ứng Giao diện Studio (Adaptive UI FX)</div>
                <p className="perf-ui-fx-desc">
                  Cấu hình mạnh hiển thị kính mờ Acrylic, viền ánh kim & hào quang node; máy yếu tự tắt hiệu ứng nặng.
                </p>
              </div>
              <span className={`perf-tier-pill tier-${perf.resolvedUiEffectsTier}`}>
                {TIER_LABELS[perf.resolvedUiEffectsTier]}
              </span>
            </div>
            <div className="perf-ui-fx-grid" role="radiogroup" aria-label="Mức độ hiệu ứng giao diện">
              {UI_FX_OPTIONS.map((opt) => {
                const active = perf.uiEffectsMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`perf-fx-option${active ? ' active' : ''}`}
                    onClick={() => perf.setUiEffectsMode(opt.id)}
                  >
                    <span className="perf-fx-opt-title">
                      <span>{opt.icon}</span> {opt.label}
                    </span>
                    <span className="perf-fx-opt-desc">{opt.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Child Mode Switch Tabs */}
          <div className="perf-tabs child-subtabs">
            <button
              type="button"
              className={`perf-tab${perf.mode === 'auto' ? ' active' : ''}`}
              onClick={() => perf.setMode('auto')}
            >
              ⚡ Tự động phân bổ VRAM (Khuyên dùng)
            </button>
            <button
              type="button"
              className={`perf-tab${perf.mode === 'manual' ? ' active' : ''}`}
              onClick={() => perf.setMode('manual')}
            >
              🛠 Cấu hình VRAM thủ công
            </button>
          </div>

          {perf.mode === 'auto' ? (
            <div className="perf-auto-box highlight" data-mcp-region="perf_settings">
              <div className="perf-auto-head-row">
                <span className="perf-badge">
                  <IconCheck width={12} height={12} /> ĐÃ TỰ ĐỘNG TỐI ƯU
                </span>
                <span className="perf-auto-summary">{perf.optimal.summary}</span>
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
            <div className="perf-manual-stack" data-mcp-region="perf_settings">
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
                <div className="perf-slider-head-row">
                  <span className="perf-section-title">Ngân sách bộ đệm VRAM chi tiết:</span>
                  <b className="perf-slider-val">
                    {perf.budgetMB} MB ({(perf.budgetMB / 1024).toFixed(1)} GB)
                  </b>
                </div>
                <input
                  type="range"
                  className="perf-budget-range"
                  min={512}
                  max={Math.max(8192, (hw?.gpuVramMB ?? 0) > 8000 ? 12288 : 8192)}
                  step={256}
                  value={perf.budgetMB}
                  onChange={(e) => perf.setBudget(Number(e.target.value))}
                />
              </div>

              <div className="perf-selects-two-col">
                <div>
                  <span className="perf-field-block-label">Lọc bề mặt nghiêng (Anisotropic):</span>
                  <Select
                    size="sm"
                    value={perf.maxAnisotropy}
                    options={ANISO_OPTIONS}
                    onChange={(val) => perf.setAnisotropy(Number(val))}
                  />
                </div>

                <div>
                  <span className="perf-field-block-label">Kích thước ảnh tối đa (Texture):</span>
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
          <div className="perf-meter" data-mcp-region="perf_meter">
            <div className="perf-meter-head">
              <span>Đang chiếm dụng GPU:</span>
              <span className="perf-meter-mono">
                {usedMB.toFixed(0)} / {curBudgetMB} MB ({percentUsed}%) · {stats?.textures ?? 0} texture
              </span>
            </div>
            <div className="perf-meter-bar">
              <div
                className={`perf-meter-fill${percentUsed > 85 ? ' warn' : ''}`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="perf-meter-note">
              💡 Khi làm việc với nhiều layer ảnh, app chỉ nạp các layer trong khung nhìn camera vào VRAM và tự động giải phóng ảnh ở cảnh xa.
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {(perf.mode === 'manual' || perf.uiEffectsMode !== 'auto') && (
            <button
              type="button"
              className="btn warn"
              onClick={() => perf.resetToAuto()}
              title="Quay về mức tự động tính toán theo phần cứng"
            >
              <IconRedo /> Khôi phục Tự động
            </button>
          )}
          <span className="modal-foot-spacer" />
          <button type="button" className="btn primary" onClick={close}>
            <IconCheck /> Áp dụng & Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
