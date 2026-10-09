import { useState, useMemo, useCallback } from 'react'
import type { Layer, LayerMotion, LayerMotionType, Vec3 } from '@shared/types'
import { useEditor } from '../../../store/editor'
import {
  IconLock,
  IconUnlock,
  IconLayersStack,
  IconAnchor,
  IconImage,
  IconCheck,
  IconPlay
} from '../../icons'
import { AssetReplaceModal } from '../AssetReplaceModal'
import {
  setCompositeGroupLock,
  setCompositeRootLayer,
  batchApplyCompositeMotion,
  batchClearCompositeMotion,
  batchKeyframeCompositeTransform
} from '../../layerAssembly/compositeOps'
import { Row, Select } from '../../controls'

export function LayerCompositeSection({ layer }: { layer: Layer }) {
  const composite = layer.composite
  const allLayers = useEditor((s) => s.project.layers)
  const selectLayer = useEditor((s) => s.selectLayer)

  const [replacingLayerId, setReplacingLayerId] = useState<string | null>(null)
  const [showBatchMotion, setShowBatchMotion] = useState(false)
  const [motionType, setMotionType] = useState<LayerMotionType>('sway')
  const [motionSpeed, setMotionSpeed] = useState<number>(1.2)
  const [motionAmp, setMotionAmp] = useState<number>(15)
  const [staggerPhase, setStaggerPhase] = useState<boolean>(true)

  const compLayers = useMemo(() => {
    if (!composite) return []
    return allLayers.filter((l) => l.composite?.instanceId === composite.instanceId)
  }, [allLayers, composite])

  if (!composite || compLayers.length === 0) return null

  const isLocked = !!composite.lockedGroup
  const rootLayer = compLayers.find((l) => l.composite?.isRoot) || compLayers[0]
  const isCurrentRoot = rootLayer?.id === layer.id

  const handleToggleLock = () => {
    setCompositeGroupLock(composite.instanceId, !isLocked)
  }

  const handleSetRoot = (targetId: string) => {
    setCompositeRootLayer(composite.instanceId, targetId)
  }

  const handleApplyBatchMotion = () => {
    const motion: LayerMotion = {
      type: motionType,
      speed: motionSpeed,
      amplitude: [motionAmp, motionAmp, 0],
      phase: 0
    }
    batchApplyCompositeMotion(composite.instanceId, motion, staggerPhase)
    setShowBatchMotion(false)
  }

  const handleClearBatchMotion = () => {
    batchClearCompositeMotion(composite.instanceId)
    setShowBatchMotion(false)
  }

  const handleBatchKeyframe = () => {
    batchKeyframeCompositeTransform(composite.instanceId)
  }

  const targetReplaceLayer = replacingLayerId ? compLayers.find((l) => l.id === replacingLayerId) : null

  return (
    <div
      className="section"
      style={{
        borderLeft: isLocked ? '3px solid var(--key)' : '3px solid var(--accent-cyan)',
        paddingLeft: '8px',
        background: isLocked ? 'rgba(235, 175, 40, 0.03)' : 'rgba(61, 214, 245, 0.03)',
        borderRadius: '0 4px 4px 0'
      }}
    >
      <div
        className="section-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconLayersStack
            width={14}
            height={14}
            style={{ color: isLocked ? 'var(--key)' : 'var(--accent-cyan)' }}
          />
          <span style={{ fontWeight: 600 }}>Cụm Layer Chồng</span>
        </div>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '10px',
            background: isLocked ? 'rgba(235, 175, 40, 0.2)' : 'rgba(61, 214, 245, 0.2)',
            color: isLocked ? 'var(--key)' : 'var(--accent-cyan)',
            fontWeight: 600
          }}
        >
          {compLayers.length} lớp
        </span>
      </div>

      {/* Tên cụm */}
      <div style={{ marginBottom: 8, fontSize: '11.5px', color: 'var(--text-dim)' }}>
        Mẫu: <strong style={{ color: 'var(--text)' }}>{composite.compositeName || 'Layer Assembly'}</strong>
      </div>

      {/* Nút Hero Toggle Khóa / Mở khóa cụm */}
      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={handleToggleLock}
          style={{
            width: '100%',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            fontWeight: 600,
            fontSize: '11.5px',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            border: isLocked ? '1px solid var(--key)' : '1px solid var(--line-focus)',
            background: isLocked ? 'var(--key)' : 'var(--bg-2)',
            color: isLocked ? '#121212' : 'var(--text)'
          }}
          title={
            isLocked
              ? 'Bấm để MỞ KHÓA: Cho phép chọn, di chuyển, thay ảnh hoặc tạo animation riêng cho từng layer con'
              : 'Bấm để KHÓA CỤM: Giữ cố định liên kết gốc để di chuyển hoặc biến đổi toàn bộ cụm cùng nhau'
          }
        >
          {isLocked ? (
            <>
              <IconLock width={14} height={14} />
              <span>🔒 Đang khóa cụm (Di chuyển toàn bộ)</span>
            </>
          ) : (
            <>
              <IconUnlock width={14} height={14} style={{ color: 'var(--accent-cyan)' }} />
              <span>🔓 Mở khóa (Chỉnh sửa riêng lẻ)</span>
            </>
          )}
        </button>

        <p
          className="hint-text"
          style={{ margin: '5px 0 0', fontSize: '10px', lineHeight: '1.35', color: 'var(--text-faint)' }}
        >
          {isLocked
            ? '💡 Đang liên kết cả cụm: Kéo trên viewport hoặc dùng Gizmo sẽ di chuyển toàn bộ các layer con theo layer gốc.'
            : '💡 Đang chỉnh sửa riêng: Bạn có thể chọn layer con bên dưới để thay ảnh, chỉnh vị trí Z hoặc tạo hoạt ảnh riêng.'}
        </p>
      </div>

      {/* Thông tin Layer Gốc (Root) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: 'var(--bg-2)',
          borderRadius: 4,
          marginBottom: 10,
          fontSize: '11px',
          border: '1px solid var(--line-soft)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
          <IconAnchor width={13} height={13} style={{ color: 'var(--key)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Gốc neo:</span>
          <span
            style={{
              fontWeight: 600,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={rootLayer?.name}
          >
            {rootLayer?.name}
          </span>
        </div>
        {!isCurrentRoot && (
          <button
            type="button"
            className="btn sm ghost"
            style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0, height: 22 }}
            onClick={() => handleSetRoot(layer.id)}
            title="Đặt layer đang chọn làm điểm neo gốc định vị cho cả cụm"
          >
            Đặt làm Gốc
          </button>
        )}
      </div>

      {/* Danh sách các layer con */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-dim)',
            marginBottom: 4,
            display: 'flex',
            justifyContent: 'space-between'
          }}
        >
          <span>Danh sách layer con</span>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>Z (độ sâu)</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            maxHeight: 180,
            overflowY: 'auto',
            paddingRight: 2
          }}
        >
          {compLayers.map((l) => {
            const isSelected = l.id === layer.id
            const isSubRoot = l.composite?.isRoot || l.id === rootLayer?.id
            const zVal = Array.isArray(l.transform.position.value) ? l.transform.position.value[2] : 0

            return (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 4,
                  background: isSelected ? 'var(--bg-3)' : 'var(--bg-1)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line-soft)',
                  fontSize: '11px',
                  transition: 'background 0.15s ease'
                }}
              >
                {/* Badge Gốc */}
                {isSubRoot ? (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'var(--key)',
                      color: '#000',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                    title="Layer gốc của cụm"
                  >
                    GỐC
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'var(--bg-3)',
                      color: 'var(--text-dim)',
                      flexShrink: 0
                    }}
                  >
                    CON
                  </span>
                )}

                {/* Tên layer con */}
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isSelected ? 'var(--text)' : 'var(--text-dim)',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer'
                  }}
                  onClick={() => selectLayer(l.id)}
                  title={`Chọn layer: ${l.name}`}
                >
                  {l.name.replace(/^\[[^\]]+\]\s*/, '')}
                </span>

                {/* Độ sâu Z */}
                <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>
                  {Math.round(zVal)}
                </span>

                {/* Nút Thay ảnh trực tiếp */}
                {l.type === 'image' && (
                  <button
                    type="button"
                    className="btn sm ghost"
                    style={{ padding: '1px 5px', fontSize: '10px', height: 20 }}
                    onClick={() => setReplacingLayerId(l.id)}
                    title="Đổi sang ảnh / asset khác cho layer con này"
                  >
                    <IconImage width={11} height={11} />
                    <span>Đổi ảnh</span>
                  </button>
                )}

                {/* Nút Chọn */}
                {!isSelected && (
                  <button
                    type="button"
                    className="btn sm"
                    style={{ padding: '1px 5px', fontSize: '10px', height: 20 }}
                    onClick={() => selectLayer(l.id)}
                    title="Chọn layer này để chỉnh sửa riêng"
                  >
                    Chọn
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tác vụ Hoạt Ảnh & Keyframe Hàng Loạt cho Cả Cụm */}
      <div
        style={{
          borderTop: '1px solid var(--line-soft)',
          paddingTop: 8,
          marginTop: 6
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
          Hoạt ảnh & Keyframe cả cụm
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm ghost"
            style={{ flex: '1 1 120px', fontSize: '11px', height: 26 }}
            onClick={() => setShowBatchMotion(!showBatchMotion)}
            title="Đồng bộ hiệu ứng chuyển động Motion (đung đưa, phập phồng) cho toàn bộ layer trong cụm"
          >
            <span>✨ Áp dụng Motion cả cụm</span>
          </button>

          <button
            type="button"
            className="btn sm ghost"
            style={{ flex: '1 1 120px', fontSize: '11px', height: 26 }}
            onClick={handleBatchKeyframe}
            title="Lưu keyframe Transform (Vị trí, Góc xoay, Tỉ lệ) tại frame hiện tại cho mọi layer trong cụm"
          >
            <span>🔑 Đặt Keyframe cả cụm</span>
          </button>
        </div>

        {/* Bảng cấu hình Motion hàng loạt */}
        {showBatchMotion && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: 'var(--bg-2)',
              borderRadius: 4,
              border: '1px solid var(--line-soft)',
              fontSize: '11px'
            }}
          >
            <Row label="Kiểu motion">
              <Select
                id="batch-motion-type"
                value={motionType}
                options={[
                  { value: 'sway', label: '🌿 Sway (Đung đưa lá/cành)' },
                  { value: 'pulse', label: '💓 Pulse (Phập phồng)' },
                  { value: 'float', label: '☁️ Float (Bồng bềnh)' },
                  { value: 'wiggle', label: '⚡ Wiggle (Rung rinh)' },
                  { value: 'wind', label: '💨 Wind (Gió thổi)' }
                ]}
                onChange={(val) => setMotionType(val as LayerMotionType)}
              />
            </Row>

            <Row label="Tốc độ" title="Tốc độ chuyển động chu kỳ">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={motionSpeed}
                  onChange={(e) => setMotionSpeed(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ fontSize: '10.5px', minWidth: 28, textAlign: 'right' }}>
                  {motionSpeed.toFixed(1)}x
                </span>
              </div>
            </Row>

            <Row label="Biên độ" title="Độ lắc / độ phập phồng">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                <input
                  type="range"
                  min="2"
                  max="50"
                  step="1"
                  value={motionAmp}
                  onChange={(e) => setMotionAmp(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                />
                <span style={{ fontSize: '10.5px', minWidth: 28, textAlign: 'right' }}>
                  {motionAmp}px
                </span>
              </div>
            </Row>

            <Row label="Phân tầng" title="Làm lệch pha giữa các lớp để tạo chiều sâu tự nhiên">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={staggerPhase}
                  onChange={(e) => setStaggerPhase(e.target.checked)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Lệch pha so le các lớp (Staggered)
                </span>
              </label>
            </Row>

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                className="btn sm accent"
                style={{ flex: 1, height: 24, fontSize: '10.5px' }}
                onClick={handleApplyBatchMotion}
              >
                Áp dụng cho {compLayers.length} lớp
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ height: 24, fontSize: '10.5px' }}
                onClick={handleClearBatchMotion}
                title="Gỡ bỏ motion khỏi toàn bộ cụm"
              >
                Xóa Motion
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thay đổi Asset cho layer con */}
      {targetReplaceLayer && targetReplaceLayer.type === 'image' && (
        <AssetReplaceModal
          layerId={targetReplaceLayer.id}
          currentAssetId={targetReplaceLayer.props.assetId}
          layerName={targetReplaceLayer.name}
          onClose={() => setReplacingLayerId(null)}
        />
      )}
    </div>
  )
}
