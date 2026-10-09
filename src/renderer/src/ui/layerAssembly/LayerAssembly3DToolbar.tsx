import { useState, useRef, useEffect } from 'react'
import {
  IconCube,
  IconEye,
  IconFocus,
  IconCamera,
  IconFit,
  IconAxisMove,
  IconAxisRotate
} from '../icons'

export interface LayerAssembly3DToolbarProps {
  cameraPreset: 'orbit' | 'top' | 'side' | 'front'
  onApplyPreset: (preset: 'orbit' | 'top' | 'side' | 'front') => void
  onApplyQuickAngle: (az: number, el: number) => void
  onFitFramingDistance: () => void
  onFocusAll: () => void
  showFrustum: boolean
  onToggleFrustum: () => void
  showGrid: boolean
  onToggleGrid: () => void
  clipToCamera: boolean
  onToggleClipToCamera: () => void
  showTranslate: boolean
  onToggleTranslate: () => void
  showRotate: boolean
  onToggleRotate: () => void
  camDistance: number
  onChangeCamDistance: (dist: number) => void
  zExaggeration: number
  onChangeZExaggeration: (zEx: number) => void
}

interface TooltipInfo {
  title: string
  tag?: string
  tagType?: 'cyan' | 'amber' | 'red' | 'green' | 'blue'
  sub?: string
  desc: string
  tip?: string
  top: number
  right: number
}

// Icon Mặt trước (Front View)
function IconFrontView() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  )
}

// Icon Mặt trên (Top View)
function IconTopView() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 3 21 8 12 13 3 8 12 3" fill="currentColor" fillOpacity="0.25" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  )
}

// Icon Mặt cạnh (Side View)
function IconSideView() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="6" height="16" rx="1" fill="currentColor" fillOpacity="0.25" />
      <rect x="15" y="4" width="6" height="16" rx="1" />
      <path d="M9 12h6M12 9l3 3-3 3" />
    </svg>
  )
}

// Icon Góc xoay (Quick Angle View)
function IconAngleView() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12A9 9 0 1 1 12 3v9z" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 12l6.36-6.36" />
    </svg>
  )
}

// Icon Cắt khung (Scissors)
function IconScissors() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  )
}

// Icon Thước đo / Độ sâu Z
function IconDepthRuler() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V3M8 6h6M8 12h10M8 18h4" />
      <path d="M20 7l-2 5 2 5" />
    </svg>
  )
}

export function LayerAssembly3DToolbar({
  cameraPreset,
  onApplyPreset,
  onApplyQuickAngle,
  onFitFramingDistance,
  onFocusAll,
  showFrustum,
  onToggleFrustum,
  showGrid,
  onToggleGrid,
  clipToCamera,
  onToggleClipToCamera,
  showTranslate,
  onToggleTranslate,
  showRotate,
  onToggleRotate,
  camDistance,
  onChangeCamDistance,
  zExaggeration,
  onChangeZExaggeration
}: LayerAssembly3DToolbarProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const [isAnglesOpen, setIsAnglesOpen] = useState(false)
  const [isDepthOpen, setIsDepthOpen] = useState(false)

  const anglesRef = useRef<HTMLDivElement>(null)
  const depthRef = useRef<HTMLDivElement>(null)

  // Đóng popover an toàn khi click ra ngoài hoặc bấm phím Escape
  useEffect(() => {
    if (!isAnglesOpen && !isDepthOpen) return

    const handlePointerDown = (e: PointerEvent): void => {
      if (anglesRef.current && !anglesRef.current.contains(e.target as Node)) {
        setIsAnglesOpen(false)
      }
      if (depthRef.current && !depthRef.current.contains(e.target as Node)) {
        setIsDepthOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsAnglesOpen(false)
        setIsDepthOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAnglesOpen, isDepthOpen])

  const showTooltip = (e: React.MouseEvent<HTMLElement>, key: string) => {
    if (isAnglesOpen || isDepthOpen) return
    const rect = e.currentTarget.getBoundingClientRect()

    let def: Omit<TooltipInfo, 'top' | 'right'> | null = null

    switch (key) {
      case 'orbit':
        def = {
          title: 'Góc nhìn phối cảnh tự do',
          tag: 'Tự do',
          tagType: 'cyan',
          sub: 'Xoay chuột 360°',
          desc: 'Xoay tự do góc nhìn 3D quanh tâm cụm layer bằng chuột trái.',
          tip: '💡 Giữ Alt hoặc chuột giữa để Pan dời khung'
        }
        break
      case 'front':
        def = {
          title: 'Góc nhìn chính diện',
          tag: 'Mặt trước',
          tagType: 'cyan',
          sub: 'Trục X · Y',
          desc: 'Góc nhìn phẳng vuông góc mặt trước, giống khung hình camera 2D nhưng trong không gian 3D.',
          tip: '🖼 Xem tổng thể bố cục chính'
        }
        break
      case 'top':
        def = {
          title: 'Góc nhìn từ trên cao',
          tag: 'Mặt trên',
          tagType: 'cyan',
          sub: 'Trục X · Z',
          desc: 'Xem trực diện từ đỉnh nhìn xuống để thấy rõ khoảng cách và thứ tự phân tầng layer Z.',
          tip: '📐 Phù hợp để sắp xếp chiều sâu layer'
        }
        break
      case 'side':
        def = {
          title: 'Góc nhìn cạnh bên',
          tag: 'Mặt cạnh',
          tagType: 'cyan',
          sub: 'Trục Y · Z',
          desc: 'Xem từ góc cạnh bên như các lát cắt đứng để kiểm tra độ so le các tấm layer.',
          tip: '📏 Kiểm tra góc nghiêng và khoảng cách Z'
        }
        break
      case 'angle':
        def = {
          title: 'Góc xoay camera cố định',
          tag: '5 góc mẫu',
          tagType: 'amber',
          sub: 'Góc nghiêng nhanh',
          desc: 'Mở menu chọn nhanh các góc máy nghiêng đẹp mắt (-30°, +30°, +22°, -15°, 75°).',
          tip: '⚡ Bấm để chọn góc xoay mẫu'
        }
        break
      case 'fit':
        def = {
          title: 'Căn vừa khung nhìn',
          tag: 'Tỉ lệ',
          tagType: 'cyan',
          sub: 'Tự động tính',
          desc: 'Đặt khoảng cách camera vừa vặn bao trọn toàn bộ cụm layer vào giữa khung nhìn.',
          tip: '🎯 Tự động canh góc nhìn hoàn hảo'
        }
        break
      case 'focus':
        def = {
          title: 'Lấy nét toàn bộ layer',
          tag: 'Phím F',
          tagType: 'green',
          sub: 'Tâm (0, 0, 0)',
          desc: 'Đưa tâm quay camera về chính giữa toàn bộ các layer và căn giữa màn hình.',
          tip: '🔍 Bấm phím F để lấy nét nhanh'
        }
        break
      case 'frustum':
        def = {
          title: 'Tháp tầm nhìn Camera',
          tag: showFrustum ? 'Đang hiện' : 'Đang ẩn',
          tagType: showFrustum ? 'cyan' : 'amber',
          sub: 'Frustum Wireframe',
          desc: 'Hiển thị khung dây nón tháp mô phỏng góc mở ống kính và tầm nhìn thực tế của camera.',
          tip: '🎥 Xem vùng bao quát của camera'
        }
        break
      case 'grid':
        def = {
          title: 'Lưới mặt sàn 3D',
          tag: showGrid ? 'Đang hiện' : 'Đang ẩn',
          tagType: showGrid ? 'cyan' : 'amber',
          sub: '3D Grid & Trục',
          desc: 'Bật hoặc ẩn lưới sàn 3D và các trục tọa độ không gian tham chiếu.',
          tip: '👁 Hỗ trợ định vị vị trí các layer'
        }
        break
      case 'clip':
        def = {
          title: 'Cắt gọn tầm nhìn Camera',
          tag: clipToCamera ? 'Cắt khung' : 'Tràn viền',
          tagType: clipToCamera ? 'green' : 'amber',
          sub: clipToCamera ? 'Ẩn phần vượt ngoài' : 'Xem tràn viền ngoài khung',
          desc: 'Cắt gọn hình ảnh layer theo tầm nhìn camera, hoặc hiển thị tràn viền để dễ căn chỉnh.',
          tip: '✂️ Bấm để chuyển đổi Cắt khung / Tràn viền'
        }
        break
      case 'translate':
        def = {
          title: 'Trục di chuyển XYZ (Gizmo)',
          tag: 'Phím W',
          tagType: 'green',
          sub: '3 Trục X · Y · Z',
          desc: 'Kéo thả mũi tên đỏ (X), xanh lá (Y), xanh dương (Z) để dời vị trí layer trực tiếp trong không gian 3D.',
          tip: '🕹 Phím tắt W để bật / tắt'
        }
        break
      case 'rotate':
        def = {
          title: 'Vòng xoay góc 3D (Gizmo)',
          tag: 'Phím E',
          tagType: 'green',
          sub: 'Xoay đa trục',
          desc: 'Kéo vòng tròn xoay góc quanh trục X, Y hoặc Z để xoay nghiêng layer.',
          tip: '🔄 Phím tắt E để bật / tắt'
        }
        break
      case 'depth':
        def = {
          title: 'Khoảng cách & Độ sâu 3D',
          tag: `${zExaggeration.toFixed(1)}x Z`,
          tagType: 'amber',
          sub: `Cam: ${camDistance}px`,
          desc: 'Mở bảng thanh trượt tùy chỉnh khoảng cách camera và hệ số giãn chiều sâu các layer Z.',
          tip: '📏 Bấm để chỉnh khoảng cách & giãn Z'
        }
        break
    }

    if (def) {
      setTooltip({
        ...def,
        top: rect.top + rect.height / 2,
        right: rect.right
      })
    }
  }

  const hideTooltip = () => setTooltip(null)

  return (
    <>
      <aside className="layer-workshop-3d-vertical-dock" aria-label="Thanh công cụ 3D">
        {/* Nhóm 1: Các góc nhìn Camera Presets */}
        <button
          type="button"
          className={`layer-3d-dock-btn${cameraPreset === 'orbit' ? ' active' : ''}`}
          onClick={() => {
            onApplyPreset('orbit')
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'orbit')}
          onMouseLeave={hideTooltip}
          aria-label="Góc nhìn tự do"
        >
          <IconCube width={16} height={16} />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${cameraPreset === 'front' ? ' active' : ''}`}
          onClick={() => {
            onApplyPreset('front')
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'front')}
          onMouseLeave={hideTooltip}
          aria-label="Góc nhìn chính diện"
        >
          <IconFrontView />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${cameraPreset === 'top' ? ' active' : ''}`}
          onClick={() => {
            onApplyPreset('top')
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'top')}
          onMouseLeave={hideTooltip}
          aria-label="Góc nhìn từ trên xuống"
        >
          <IconTopView />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${cameraPreset === 'side' ? ' active' : ''}`}
          onClick={() => {
            onApplyPreset('side')
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'side')}
          onMouseLeave={hideTooltip}
          aria-label="Góc nhìn cạnh bên"
        >
          <IconSideView />
        </button>

        {/* Nút Góc xoay nhanh */}
        <div style={{ position: 'relative' }} ref={anglesRef}>
          <button
            type="button"
            className={`layer-3d-dock-btn${isAnglesOpen ? ' active' : ''}`}
            onClick={() => {
              setIsAnglesOpen((v) => !v)
              setIsDepthOpen(false)
              hideTooltip()
            }}
            onMouseEnter={(e) => {
              if (!isAnglesOpen) showTooltip(e, 'angle')
            }}
            onMouseLeave={hideTooltip}
            aria-label="Góc xoay camera cố định"
          >
            <IconAngleView />
          </button>

          {isAnglesOpen && (
            <div
              className="layer-workshop-popover-menu"
              style={{ position: 'absolute', left: 'calc(100% + 8px)', top: '-4px', minWidth: '155px' }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', padding: '2px 8px', fontWeight: 600 }}>
                GÓC XOAY CAMERA
              </div>
              {[
                { label: '-30° Nghiêng trái', az: -30, el: 0 },
                { label: '+30° Nghiêng phải', az: 30, el: 0 },
                { label: '+22° Từ trên cao', az: 0, el: 22 },
                { label: '-15° Từ dưới thấp', az: 0, el: -15 },
                { label: '75° Từ đỉnh xuống', az: 0, el: 75 }
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="layer-workshop-popover-item"
                  onClick={() => {
                    onApplyQuickAngle(a.az, a.el)
                    setIsAnglesOpen(false)
                  }}
                >
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dock-divider" />

        {/* Nhóm 2: Căn chỉnh & Khung hình */}
        <button
          type="button"
          className="layer-3d-dock-btn"
          onClick={() => {
            onFitFramingDistance()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'fit')}
          onMouseLeave={hideTooltip}
          aria-label="Căn vừa khung hình"
        >
          <IconFit width={15} height={15} />
        </button>

        <button
          type="button"
          className="layer-3d-dock-btn"
          onClick={() => {
            onFocusAll()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'focus')}
          onMouseLeave={hideTooltip}
          aria-label="Lấy nét toàn bộ layer"
        >
          <IconFocus width={15} height={15} />
        </button>

        <div className="dock-divider" />

        {/* Nhóm 3: Hiển thị Tháp Camera, Lưới sàn, Cắt khung */}
        <button
          type="button"
          className={`layer-3d-dock-btn${showFrustum ? ' active' : ''}`}
          onClick={() => {
            onToggleFrustum()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'frustum')}
          onMouseLeave={hideTooltip}
          aria-label="Tháp tầm nhìn Camera"
        >
          <IconCamera width={15} height={15} />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${showGrid ? ' active' : ''}`}
          onClick={() => {
            onToggleGrid()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'grid')}
          onMouseLeave={hideTooltip}
          aria-label="Lưới mặt sàn 3D"
        >
          <IconEye width={15} height={15} />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${clipToCamera ? ' active' : ''}`}
          onClick={() => {
            onToggleClipToCamera()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'clip')}
          onMouseLeave={hideTooltip}
          aria-label="Cắt gọn tầm nhìn Camera"
        >
          <IconScissors />
        </button>

        <div className="dock-divider" />

        {/* Nhóm 4: Công cụ Gizmo & Tọa độ */}
        <button
          type="button"
          className={`layer-3d-dock-btn${showTranslate ? ' active' : ''}`}
          onClick={() => {
            onToggleTranslate()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'translate')}
          onMouseLeave={hideTooltip}
          aria-label="Trục di chuyển XYZ"
        >
          <IconAxisMove width={15} height={15} />
        </button>

        <button
          type="button"
          className={`layer-3d-dock-btn${showRotate ? ' active' : ''}`}
          onClick={() => {
            onToggleRotate()
            hideTooltip()
          }}
          onMouseEnter={(e) => showTooltip(e, 'rotate')}
          onMouseLeave={hideTooltip}
          aria-label="Vòng xoay góc 3D"
        >
          <IconAxisRotate width={15} height={15} />
        </button>

        {/* Nút Độ sâu Z & Khoảng cách Camera */}
        <div style={{ position: 'relative' }} ref={depthRef}>
          <button
            type="button"
            className={`layer-3d-dock-btn${isDepthOpen ? ' active' : ''}`}
            onClick={() => {
              setIsDepthOpen((v) => !v)
              setIsAnglesOpen(false)
              hideTooltip()
            }}
            onMouseEnter={(e) => {
              if (!isDepthOpen) showTooltip(e, 'depth')
            }}
            onMouseLeave={hideTooltip}
            aria-label="Khoảng cách & Độ sâu 3D"
          >
            <IconDepthRuler />
          </button>

          {isDepthOpen && (
            <div
              className="layer-workshop-popover-menu"
              style={{
                position: 'absolute',
                left: 'calc(100% + 8px)',
                top: 'auto',
                bottom: '-8px',
                minWidth: '240px',
                padding: '12px 14px',
                gap: '10px'
              }}
            >
              <div style={{ fontSize: '10.5px', color: 'var(--text-faint)', fontWeight: 700, letterSpacing: '0.5px' }}>
                KHOẢNG CÁCH & ĐỘ SÂU 3D
              </div>

              {/* Slider Khoảng cách */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Khoảng cách camera:</span>
                  <strong style={{ color: 'var(--text)' }}>{camDistance}px</strong>
                </div>
                <input
                  type="range"
                  min="300"
                  max="4500"
                  step="10"
                  value={camDistance}
                  onChange={(e) => onChangeCamDistance(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* Slider Giãn khoảng cách Z */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Hệ số giãn độ sâu Z:</span>
                  <strong style={{ color: 'var(--accent)' }}>{zExaggeration.toFixed(1)}x</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={zExaggeration}
                  onChange={(e) => onChangeZExaggeration(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
                  <span>0.5x (Phẳng)</span>
                  <span>1.0x (Chuẩn)</span>
                  <span>5.0x (Sâu)</span>
                </div>
              </div>

              {/* Nút tác vụ nhanh */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                <button
                  type="button"
                  className="btn xs"
                  style={{ flex: 1, padding: '3px 8px' }}
                  onClick={() => {
                    onFitFramingDistance()
                    setIsDepthOpen(false)
                  }}
                  title="Căn chỉnh khoảng cách camera vừa khít mô hình"
                >
                  📐 Vừa vặn
                </button>
                <button
                  type="button"
                  className="btn xs"
                  style={{ flex: 1, padding: '3px 8px' }}
                  onClick={() => {
                    onChangeZExaggeration(1.8)
                    onChangeCamDistance(1200)
                  }}
                  title="Đặt lại khoảng cách và giãn Z về mặc định 1.8x"
                >
                  Mặc định
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Rich Tooltip popup matching BuiltInAssetBar */}
      {tooltip && (
        <div
          className="vertical-tab-tooltip"
          role="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.right + 8,
            top: tooltip.top,
            transform: 'translateY(-50%)',
            zIndex: 9999
          }}
        >
          <div className="tooltip-title">
            <span>{tooltip.title}</span>
            {tooltip.tag && (
              <span className={`tooltip-tag-system tag-${tooltip.tagType || 'cyan'}`}>
                {tooltip.tag}
              </span>
            )}
          </div>
          {tooltip.sub && <div className="tooltip-folder">{tooltip.sub}</div>}
          <div className="tooltip-desc">{tooltip.desc}</div>
          {tooltip.tip && (
            <div className="tooltip-count">
              <span>{tooltip.tip}</span>
            </div>
          )}
        </div>
      )}
    </>
  )
}
