import React from 'react'
import { IconCamera, IconFocus, IconX } from '../icons'

export interface CameraControlPopoverProps {
  cameraFov: number
  onChangeCameraFov: (fov: number) => void
  cameraYaw: number
  onChangeCameraYaw: (yaw: number) => void
  cameraPitch: number
  onChangeCameraPitch: (pitch: number) => void
  camDistance: number
  onChangeCamDistance: (dist: number) => void
  cameraTarget: { x: number; y: number; z: number }
  onChangeCameraTarget: (target: { x: number; y: number; z: number }) => void
  cameraPosition: { x: number; y: number; z: number }
  onChangeCameraPosition?: (pos: { x: number; y: number; z: number }) => void
  onApplyQuickAngle: (yawDeg: number, pitchDeg: number) => void
  onFitFramingDistance: () => void
  onFocusAll: () => void
  onAimAtSelectedLayer?: () => void
  selectedLayerName?: string | null
  showFrustum: boolean
  onToggleFrustum: () => void
  clipToCamera: boolean
  onToggleClipToCamera: () => void
  onClose: () => void
}

export function CameraControlPopover({
  cameraFov,
  onChangeCameraFov,
  cameraYaw,
  onChangeCameraYaw,
  cameraPitch,
  onChangeCameraPitch,
  camDistance,
  onChangeCamDistance,
  cameraTarget,
  onChangeCameraTarget,
  cameraPosition,
  onApplyQuickAngle,
  onFitFramingDistance,
  onFocusAll,
  onAimAtSelectedLayer,
  selectedLayerName,
  showFrustum,
  onToggleFrustum,
  clipToCamera,
  onToggleClipToCamera,
  onClose
}: CameraControlPopoverProps) {
  const getFovLabel = (fov: number) => {
    if (fov <= 35) return 'Góc hẹp (Telephoto)'
    if (fov <= 55) return 'Chuẩn tự nhiên'
    return 'Góc rộng (Wide)'
  }

  return (
    <div
      className="layer-workshop-popover-menu"
      style={{
        position: 'absolute',
        left: 'calc(100% + 8px)',
        top: '-100px',
        width: '285px',
        maxHeight: 'calc(100vh - 220px)',
        overflowY: 'auto',
        padding: '12px 14px',
        gap: '10px',
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-soft)', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text)', fontWeight: 700, letterSpacing: '0.4px' }}>
          <IconCamera width={13} height={13} />
          <span>CAMERA & TẦM NHÌN 3D</span>
        </div>
        <button
          type="button"
          className="btn xs icon"
          onClick={onClose}
          aria-label="Đóng bảng camera"
          style={{ width: '18px', height: '18px', padding: 0 }}
        >
          <IconX width={12} height={12} />
        </button>
      </div>

      {/* 1. Tầm nhìn (FOV - Field of View) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-dim)' }}>Tầm nhìn (Góc mở FOV):</span>
          <strong style={{ color: 'var(--accent-cyan)' }}>{cameraFov}°</strong>
        </div>
        <input
          type="range"
          min="25"
          max="85"
          step="1"
          value={cameraFov}
          onChange={(e) => onChangeCameraFov(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
          <span>25° Hẹp</span>
          <span>{getFovLabel(cameraFov)}</span>
          <span>85° Rộng</span>
        </div>
      </div>

      {/* 2. Xoay quanh tâm 360° (Orbit Yaw) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-dim)' }}>Xoay 360° (Góc ngang):</span>
          <strong style={{ color: 'var(--text)' }}>{cameraYaw}°</strong>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={cameraYaw}
          onChange={(e) => onChangeCameraYaw(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
          <span>-180° Trái</span>
          <span>0° Thẳng</span>
          <span>+180° Phải</span>
        </div>
      </div>

      {/* 3. Góc ngẩng / cúi (Pitch) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-dim)' }}>Góc ngẩng / cúi (Pitch):</span>
          <strong style={{ color: 'var(--text)' }}>{cameraPitch > 0 ? `+${cameraPitch}` : cameraPitch}°</strong>
        </div>
        <input
          type="range"
          min="-80"
          max="80"
          step="1"
          value={cameraPitch}
          onChange={(e) => onChangeCameraPitch(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-faint)' }}>
          <span>-80° Dưới lên</span>
          <span>0° Ngang</span>
          <span>+80° Trên xuống</span>
        </div>
      </div>

      {/* 4. Khoảng cách (Distance) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--text-dim)' }}>Khoảng cách tới mục tiêu:</span>
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

      {/* 5. Điểm nhìn (Target) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '6px 8px', background: 'var(--bg-2)', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text)' }}>🎯 Điểm nhìn (Target):</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-faint)' }}>({cameraTarget.x}, {cameraTarget.y}, {cameraTarget.z})</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
            X
            <input
              type="number"
              value={cameraTarget.x}
              onChange={(e) => onChangeCameraTarget({ ...cameraTarget, x: Number(e.target.value) || 0 })}
              style={{ width: '46px', padding: '2px 4px', fontSize: '10.5px', borderRadius: '3px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--text)' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
            Y
            <input
              type="number"
              value={cameraTarget.y}
              onChange={(e) => onChangeCameraTarget({ ...cameraTarget, y: Number(e.target.value) || 0 })}
              style={{ width: '46px', padding: '2px 4px', fontSize: '10.5px', borderRadius: '3px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--text)' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-dim)' }}>
            Z
            <input
              type="number"
              value={cameraTarget.z}
              onChange={(e) => onChangeCameraTarget({ ...cameraTarget, z: Number(e.target.value) || 0 })}
              style={{ width: '46px', padding: '2px 4px', fontSize: '10.5px', borderRadius: '3px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--text)' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
          {selectedLayerName && onAimAtSelectedLayer && (
            <button
              type="button"
              className="btn xs"
              onClick={onAimAtSelectedLayer}
              title={`Nhắm camera vào layer "${selectedLayerName}"`}
              style={{ flex: 1, padding: '2px 6px', fontSize: '10px' }}
            >
              <IconFocus width={11} height={11} /> Nhắm layer
            </button>
          )}
          <button
            type="button"
            className="btn xs"
            onClick={onFocusAll}
            title="Đưa điểm nhìn về gốc (0, 0, 0)"
            style={{ flex: 1, padding: '2px 6px', fontSize: '10px' }}
          >
            Tâm (0, 0, 0)
          </button>
        </div>
      </div>

      {/* 6. Vị trí Camera thực tế */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-dim)', padding: '2px 4px' }}>
        <span>🎥 Vị trí Camera:</span>
        <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>
          ({cameraPosition.x}, {cameraPosition.y}, {cameraPosition.z})
        </strong>
      </div>

      {/* 7. Các góc xoay 360° nhanh */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: 600 }}>GÓC NHÌN 360° NHANH:</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {[
            { label: '0° Thẳng', az: 0, el: 0 },
            { label: '-30° Trái', az: -30, el: 0 },
            { label: '+30° Phải', az: 30, el: 0 },
            { label: '-45° Trái', az: -45, el: 0 },
            { label: '+45° Phải', az: 45, el: 0 },
            { label: '180° Sau', az: 180, el: 0 },
            { label: '+22° Cao', az: 0, el: 22 },
            { label: '-15° Thấp', az: 0, el: -15 },
            { label: '75° Đỉnh', az: 0, el: 75 }
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              className="btn xs"
              onClick={() => onApplyQuickAngle(a.az, a.el)}
              style={{ padding: '2px 4px', fontSize: '9.5px', whiteSpace: 'nowrap' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8. Tác vụ nhanh */}
      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--line-soft)', paddingTop: '8px' }}>
        <button
          type="button"
          className="btn xs"
          onClick={onFitFramingDistance}
          style={{ flex: 1, padding: '3px 6px', fontSize: '10.5px' }}
        >
          📐 Vừa khung hình
        </button>
        <button
          type="button"
          className={`btn xs${showFrustum ? ' active' : ''}`}
          onClick={onToggleFrustum}
          style={{ padding: '3px 8px', fontSize: '10.5px' }}
          title={showFrustum ? 'Ẩn tháp tầm nhìn camera' : 'Hiện tháp tầm nhìn camera'}
        >
          {showFrustum ? '✓ Tháp nhìn' : 'Tháp nhìn'}
        </button>
        <button
          type="button"
          className={`btn xs${clipToCamera ? ' active' : ''}`}
          onClick={onToggleClipToCamera}
          style={{ padding: '3px 8px', fontSize: '10.5px' }}
          title={clipToCamera ? 'Tắt cắt gọn theo tầm nhìn camera' : 'Bật cắt gọn theo tầm nhìn camera'}
        >
          {clipToCamera ? '✓ Cắt gọn' : 'Cắt gọn'}
        </button>
      </div>
    </div>
  )
}
