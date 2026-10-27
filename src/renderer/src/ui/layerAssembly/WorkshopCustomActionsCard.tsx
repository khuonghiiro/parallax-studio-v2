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
        name: 'Đổi biểu cảm khuôn mặt',
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
    <div className="lw-rig-card lw-custom-actions-card" style={{ marginBottom: 8 }}>
      <div className="lw-rig-section-head">
        <div>
          <strong>🎭 Động tác Ảnh &amp; Tên Động (Đồng bộ Node Animation)</strong>
          <div className="lw-rig-hint">
            Tạo động tác nhép miệng, nháy mắt, đổi biểu cảm và đặt tên tuỳ ý để chọn trực tiếp trên Node Animation
          </div>
        </div>
      </div>

      {/* Các nút tạo nhanh động tác */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5, marginTop: 6 }}>
        <button type="button" className="btn ghost sm" onClick={() => addQuickAction('mouth')}>
          + 👄 Nhép miệng
        </button>
        <button type="button" className="btn ghost sm" onClick={() => addQuickAction('blink')}>
          + 👁 Nháy mắt
        </button>
        <button type="button" className="btn ghost sm" onClick={() => addQuickAction('expr')}>
          + 😊 Đổi biểu cảm
        </button>
        <button type="button" className="btn ghost sm" onClick={() => addQuickAction('pose')}>
          + 👋 Động tác bộ phận
        </button>
      </div>

      {/* Danh sách động tác đã cấu hình */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {actions.map((act) => {
            const isSel = act.id === activeAction?.id
            return (
              <button
                key={act.id}
                type="button"
                className={`btn sm ${isSel ? 'primary' : 'ghost'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setSelectedId(act.id)}
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
            marginTop: 8,
            padding: 8,
            borderRadius: 'var(--radius)',
            background: 'var(--bg-2)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>Tên động tác:</span>
            <input
              type="text"
              className="lw-input"
              value={activeAction.name}
              placeholder="Đặt tên động tác (VD: Nhép miệng nói, Nháy mắt...)"
              onChange={(e) => patchActive({ name: e.target.value })}
              style={{ flex: 1, minWidth: 0, height: 26, fontSize: 11.5 }}
            />
            <button
              type="button"
              className="btn ghost sm"
              title="Xoá động tác này"
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
              className={`btn sm ${activeAction.kind === 'sprite_cycle' ? 'primary' : 'ghost'}`}
              onClick={() => patchActive({ kind: 'sprite_cycle' })}
            >
              🔄 Luân phiên ảnh (Nhép/Nháy)
            </button>
            <button
              type="button"
              className={`btn sm ${activeAction.kind === 'part_pose' ? 'primary' : 'ghost'}`}
              onClick={() => patchActive({ kind: 'part_pose' })}
            >
              📐 Cử động xoay bộ phận
            </button>
          </div>

          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 4 }}>
              Chọn các ảnh / mảnh tham gia động tác ({activeAction.layerIds.length} đã chọn):
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 4,
                maxHeight: 116,
                overflowY: 'auto'
              }}
            >
              {composite.layers.map((l) => {
                const checked = activeAction.layerIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`btn sm ${checked ? 'primary' : 'ghost'}`}
                    style={{
                      justifyContent: 'flex-start',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 10.5
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
            <label style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
              Tốc độ nhịp: <strong>{(activeAction.speedHz ?? 3.5).toFixed(1)} Hz</strong>
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
