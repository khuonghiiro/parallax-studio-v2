import React, { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import type { CompositeCustomAction } from '@shared/types'
import type { LayerComposite } from './types'

interface Props {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
}

function findMatchingLayers(composite: LayerComposite, pattern: RegExp): string[] {
  const matched = composite.layers.filter(
    (l) => pattern.test(l.name) || (l.slot && pattern.test(l.slot)) || (l.variant && pattern.test(l.variant))
  )
  if (matched.length >= 2) return matched.slice(0, 4).map((l) => l.id)
  return composite.layers.slice(0, Math.min(2, composite.layers.length)).map((l) => l.id)
}

export const WorkshopCustomActionsCard: React.FC<Props> = ({ composite, setComposite }) => {
  const actions: CompositeCustomAction[] = useMemo(
    () => composite.customActions ?? [],
    [composite.customActions]
  )
  const [selectedId, setSelectedId] = useState<string | null>(actions[0]?.id ?? null)
  const [showHint, setShowHint] = useState(false)
  const activeAction = actions.find((a) => a.id === selectedId) ?? actions[0] ?? null

  const updateActions = (next: CompositeCustomAction[]): void => {
    setComposite((prev) => ({
      ...prev,
      customActions: next,
      updatedAt: Date.now()
    }))
  }

  const addQuickAction = (
    presetKind: 'mouth' | 'blink' | 'expr' | 'pose'
  ): void => {
    const id = `act-${nanoid(6)}`
    let item: CompositeCustomAction
    if (presetKind === 'mouth') {
      item = {
        id,
        name: 'Nhép miệng nói',
        icon: '👄',
        kind: 'sprite_cycle',
        layerIds: findMatchingLayers(composite, /miệng|môi|mouth|talk|nói|face|mặt|biểu cảm/i),
        speedHz: 4.5,
        duration: 2.5,
        loop: true
      }
    } else if (presetKind === 'blink') {
      item = {
        id,
        name: 'Nháy mắt tự nhiên',
        icon: '👁',
        kind: 'sprite_cycle',
        layerIds: findMatchingLayers(composite, /mắt|nháy|eye|blink|face|mặt/i),
        speedHz: 0.8,
        duration: 2.5,
        loop: true
      }
    } else if (presetKind === 'expr') {
      item = {
        id,
        name: 'Đổi biểu cảm',
        icon: '😊',
        kind: 'sprite_cycle',
        layerIds: findMatchingLayers(composite, /face|mặt|biểu cảm|cười|vui|buồn|giận/i),
        speedHz: 1.2,
        duration: 2.0,
        loop: false
      }
    } else {
      item = {
        id,
        name: `Động tác ${actions.length + 1}`,
        icon: '👋',
        kind: 'part_pose',
        layerIds: composite.layers.slice(0, 1).map((l) => l.id),
        speedHz: 1.5,
        rotDeg: 18,
        duration: 2.0,
        loop: true
      }
    }
    updateActions([...actions, item])
    setSelectedId(id)
  }

  const patchActive = (patch: Partial<CompositeCustomAction>): void => {
    if (!activeAction) return
    updateActions(actions.map((a) => (a.id === activeAction.id ? { ...a, ...patch } : a)))
  }

  const toggleLayerInAction = (layerId: string): void => {
    if (!activeAction) return
    const cur = activeAction.layerIds ?? []
    const next = cur.includes(layerId) ? cur.filter((x) => x !== layerId) : [...cur, layerId]
    patchActive({ layerIds: next })
  }

  return (
    <div className="lw-card-section lw-custom-actions-card">
      <div className="lw-card-header">
        <span className="lw-card-title">
          <span>🎭 Biểu cảm &amp; Động tác ảnh</span>
          <span className="lw-card-badge">{actions.length}</span>
        </span>
        <button
          type="button"
          className={`btn xs icon${showHint ? ' active' : ''}`}
          style={{ width: 22, height: 22, padding: 0 }}
          onClick={() => setShowHint((v) => !v)}
          title={showHint ? 'Ẩn chú thích hướng dẫn' : 'Hiện chú thích hướng dẫn'}
        >
          ℹ
        </button>
      </div>

      {/* Chú thích toggle: Mặc định tắt, chỉ hiện khi người dùng bấm icon ℹ */}
      {showHint && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            padding: '6px 8px',
            marginBottom: 8,
            background: 'var(--bg-0)',
            borderRadius: 'var(--radius-sm, 4px)',
            border: '1px solid var(--line-soft)'
          }}
        >
          💡 Tạo động tác nhép miệng, nháy mắt, đổi biểu cảm khuôn mặt sprite để điều khiển trực tiếp trên Node Animation.
        </div>
      )}

      {/* 4 Nút tạo nhanh động tác dạng lưới 2x2 cực gọn */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginBottom: 8 }}>
        <button
          type="button"
          className="btn ghost xs"
          style={{ height: 26, fontSize: 11, justifyContent: 'flex-start', padding: '0 8px' }}
          onClick={() => addQuickAction('mouth')}
          title="Tạo động tác nhép miệng nói theo nhịp âm thanh"
        >
          👄 Nhép miệng
        </button>
        <button
          type="button"
          className="btn ghost xs"
          style={{ height: 26, fontSize: 11, justifyContent: 'flex-start', padding: '0 8px' }}
          onClick={() => addQuickAction('blink')}
          title="Tạo động tác nháy mắt tự nhiên chu kỳ 0.8s"
        >
          👁 Nháy mắt
        </button>
        <button
          type="button"
          className="btn ghost xs"
          style={{ height: 26, fontSize: 11, justifyContent: 'flex-start', padding: '0 8px' }}
          onClick={() => addQuickAction('expr')}
          title="Tạo động tác đổi biểu cảm khuôn mặt (vui, buồn, giận...)"
        >
          😊 Biểu cảm
        </button>
        <button
          type="button"
          className="btn ghost xs"
          style={{ height: 26, fontSize: 11, justifyContent: 'flex-start', padding: '0 8px' }}
          onClick={() => addQuickAction('pose')}
          title="Tạo động tác cử động xoay lắc bộ phận tự do"
        >
          👋 Xoay mảnh
        </button>
      </div>

      {/* Danh sách động tác đã cấu hình */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {actions.map((act) => {
            const isSel = act.id === activeAction?.id
            return (
              <button
                key={act.id}
                type="button"
                className={`btn xs ${isSel ? 'primary' : 'ghost'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 24,
                  padding: '0 7px',
                  fontSize: 11
                }}
                onClick={() => setSelectedId(act.id)}
                title={`${act.name} (${act.layerIds.length} mảnh)`}
              >
                <span>{act.icon || '🎬'}</span>
                <span>{act.name}</span>
                <small style={{ opacity: 0.75 }}>({act.layerIds.length})</small>
              </button>
            )
          })}
        </div>
      )}

      {/* Trình chỉnh sửa chi tiết động tác đang chọn */}
      {activeAction && (
        <div
          style={{
            padding: 8,
            borderRadius: 'var(--radius, 6px)',
            background: 'var(--bg-0)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              className="lw-field-input"
              value={activeAction.name}
              placeholder="Tên động tác..."
              title="Đặt tên động tác"
              onChange={(e) => patchActive({ name: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                height: 25,
                fontSize: 11.5,
                background: 'var(--bg-1)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '0 8px',
                color: 'var(--text)'
              }}
            />
            <button
              type="button"
              className="btn xs icon lw-muted-danger-btn"
              title="Xoá động tác này"
              style={{ width: 24, height: 25, padding: 0 }}
              onClick={() => {
                const remain = actions.filter((a) => a.id !== activeAction.id)
                updateActions(remain)
                setSelectedId(remain[0]?.id ?? null)
              }}
            >
              🗑
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <button
              type="button"
              className={`btn xs ${activeAction.kind === 'sprite_cycle' ? 'primary' : 'ghost'}`}
              style={{ height: 25, fontSize: 10.5 }}
              onClick={() => patchActive({ kind: 'sprite_cycle' })}
              title="Luân phiên hiển thị các ảnh / mảnh trong danh sách theo chu kỳ nhịp"
            >
              🔄 Luân phiên ảnh
            </button>
            <button
              type="button"
              className={`btn xs ${activeAction.kind === 'part_pose' ? 'primary' : 'ghost'}`}
              style={{ height: 25, fontSize: 10.5 }}
              onClick={() => patchActive({ kind: 'part_pose' })}
              title="Xoay lắc bộ phận theo góc dao động"
            >
              📐 Cử động xoay
            </button>
          </div>

          <div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                marginBottom: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>Mảnh tham gia:</span>
              <strong style={{ color: 'var(--accent)' }}>{activeAction.layerIds.length} đã chọn</strong>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 4,
                maxHeight: 110,
                overflowY: 'auto',
                paddingRight: 2
              }}
            >
              {composite.layers.map((l) => {
                const checked = activeAction.layerIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`btn xs ${checked ? 'primary' : 'ghost'}`}
                    style={{
                      justifyContent: 'flex-start',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 10.5,
                      height: 24,
                      padding: '0 6px'
                    }}
                    title={`${l.name}${l.slot ? ` (slot: ${l.slot})` : ''}`}
                    onClick={() => toggleLayerInAction(l.id)}
                  >
                    {checked ? '☑ ' : '☐ '}
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <label style={{ fontSize: 10.5, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              Tốc độ: <strong>{(activeAction.speedHz ?? 3.5).toFixed(1)} Hz</strong>
            </label>
            <input
              type="range"
              min={0.3}
              max={8}
              step={0.1}
              value={activeAction.speedHz ?? 3.5}
              onChange={(e) => patchActive({ speedHz: Number(e.target.value) })}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
