import { useState } from 'react'
import type { LayerComposite } from './types'
import type { RigAction } from './workshopRig'
import {
  SMART_RIG_ARCHETYPES,
  detectCompositeRigArchetype,
  type SmartRigArchetype
} from './workshopSmartRig25D'

export interface WorkshopSmartRig25DCardProps {
  composite: LayerComposite
  run: (action: RigAction) => void
}

export function WorkshopSmartRig25DCard({ composite, run }: WorkshopSmartRig25DCardProps) {
  const [archetype, setArchetype] = useState<SmartRigArchetype>('auto')
  const [bindMode, setBindMode] = useState<'auto' | 'rigid' | 'soft'>('auto')
  const [sortZDepth, setSortZDepth] = useState<boolean>(true)
  const [statusMsg, setStatusMsg] = useState<string>('')

  const detected = detectCompositeRigArchetype(composite)
  const detectedMeta = SMART_RIG_ARCHETYPES.find((a) => a.id === detected)
  const boundCount = composite.layers.filter((l) => Boolean(l.boneId)).length
  const totalLayers = composite.layers.length

  const handleSmartAutoRig = () => {
    run({
      action: 'smart-auto-rig-25d',
      archetype,
      bindMode,
      includeStarterClips: true,
      sortZDepth
    })
    const targetArch = archetype === 'auto' ? detectedMeta?.label : SMART_RIG_ARCHETYPES.find((a) => a.id === archetype)?.label
    setStatusMsg(`✓ Đã dựng khung xương ${targetArch ?? '2.5D'}, gắn ${totalLayers} layer & nạp bộ động tác mẫu`)
  }

  const handleAutoBindOnly = () => {
    run({ action: 'smart-auto-bind-25d', bindMode })
    setStatusMsg(`✓ Đã tự động gắn kết ${totalLayers} layer vào bộ xương hiện có`)
  }

  const handleSortZDepthOnly = () => {
    run({ action: 'auto-sort-z-25d' })
    setStatusMsg('✓ Đã chuẩn hóa thứ tự độ sâu Z 2.5D theo lớp giải phẫu')
  }

  return (
    <div
      className="lw-card-section lw-smart-rig-25d-card"
      data-mcp-region="layer_assembly_smart_rig_25d"
    >
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>⚡ Gắn xương Thông minh 2.5D</span>
          <span className="lw-card-badge" title="Số layer đã gắn xương / Tổng số layer">
            {boundCount}/{totalLayers} lớp
          </span>
        </span>
        {detectedMeta && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'color-mix(in srgb, var(--accent) 16%, var(--bg-2))',
              color: 'var(--accent-cyan)',
              fontWeight: 600
            }}
            title="Kiểu cơ thể được nhận diện tự động từ danh sách mảnh Layer"
          >
            {detectedMeta.icon} {detectedMeta.label}
          </span>
        )}
      </div>

      <p style={{ margin: '2px 0 8px', fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.45 }}>
        Tự động phân tích tọa độ các mảnh Layer để đặt khớp xoay giải phẫu, sinh xương phụ (tóc, áo choàng, đuôi, vũ khí) và liên kết Layer chỉ với 1-Click.
      </p>

      {/* 1. Chọn kiểu khung xương */}
      <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
        1. Kiểu giải phẫu khung xương:
      </div>
      <div
        role="group"
        aria-label="Kiểu giải phẫu khung xương 2.5D"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '4px',
          marginBottom: '8px'
        }}
      >
        {SMART_RIG_ARCHETYPES.map((item) => {
          const active = archetype === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`btn xs ${active ? 'primary' : 'ghost'}`}
              onClick={() => setArchetype(item.id)}
              title={item.hint}
              style={{
                justifyContent: 'flex-start',
                padding: '4px 6px',
                fontSize: '10.5px',
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

      {/* 2. Chế độ liên kết Layer vào xương */}
      <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
        2. Chế độ gắn Layer (Skinning Mode):
      </div>
      <div
        role="group"
        aria-label="Chế độ gắn Layer vào xương"
        style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}
      >
        {([
          ['auto', '✨ Tự động (Chuẩn 2.5D)', 'Chi cắt rời gắn cứng (Rigid); tóc, áo choàng, đuôi, ảnh đơn uốn mềm (Soft Mesh)'],
          ['rigid', '🔗 Gắn cứng (Cutout)', 'Mọi mảnh bộ phận xoay/di chuyển nguyên khối theo khớp xương'],
          ['soft', '🌿 Uốn mềm (Mesh)', 'Biến dạng lưới đa giác 2D mượt mà theo chuỗi xương']
        ] as const).map(([id, label, hint]) => (
          <button
            key={id}
            type="button"
            className={`btn xs ${bindMode === id ? 'primary' : 'ghost'}`}
            onClick={() => setBindMode(id)}
            title={hint}
            style={{ flex: 1, fontSize: '10px', padding: '4px 5px', borderRadius: 'var(--radius-sm, 4px)' }}
          >
            {label}
          </button>
        ))}
      </div>

      <label
        className="lw-rig-check"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '8px', cursor: 'pointer' }}
        title="Tự động sắp xếp tọa độ chiều sâu Z của Kính, Mặt, Đầu, Thân, Tay, Chân, Áo choàng để không bị đè hình khi xoay 2.5D"
      >
        <input
          type="checkbox"
          checked={sortZDepth}
          onChange={(e) => setSortZDepth(e.target.checked)}
        />
        <span>Chuẩn hóa thứ tự độ sâu Z 2.5D theo giải phẫu</span>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <button
          type="button"
          className="btn sm primary"
          disabled={totalLayers === 0}
          onClick={handleSmartAutoRig}
          title="Tự động tạo bộ xương khớp với vị trí các mảnh Layer, gắn xương và nạp sẵn các động tác mẫu"
        >
          ⚡ Tự dựng Xương & Gắn Layer 2.5D ({totalLayers} mảnh)
        </button>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            type="button"
            className="btn xs"
            style={{ flex: 1, padding: '4px 6px' }}
            disabled={!composite.rig?.bones?.length || totalLayers === 0}
            onClick={handleAutoBindOnly}
            title="Giữ nguyên bộ xương hiện có, tự động gắn kết toàn bộ Layer vào xương gần nhất theo tên và khoảng cách hình học"
          >
            🔗 Tự gắn mọi Layer vào xương
          </button>
          <button
            type="button"
            className="btn xs"
            style={{ flex: 1, padding: '4px 6px' }}
            disabled={totalLayers === 0}
            onClick={handleSortZDepthOnly}
            title="Sắp xếp lại độ sâu Z (Z-Depth) của các mảnh Kính, Mặt, Đầu, Thân, Tay, Chân, Tóc sau"
          >
            📐 Xếp lớp Độ sâu Z 2.5D
          </button>
        </div>
      </div>

      {statusMsg && (
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
          {statusMsg}
        </div>
      )}
    </div>
  )
}
