import React, { useState } from 'react'
import type { AssembledLayerItem } from '../types'
import type { TemplateSlotPreset } from './types'
import { createPresetFromLayers, saveCustomPreset } from './slotPresets'
import { IconCheck, IconTrash } from '../../icons'

export interface SaveTemplateDialogProps {
  layers: AssembledLayerItem[]
  onClose: () => void
  onSaved: (preset: TemplateSlotPreset) => void
}

export function SaveTemplateDialog({ layers, onClose, onSaved }: SaveTemplateDialogProps) {
  const [name, setName] = useState<string>('Mẫu nhân vật mới')
  const [desc, setDesc] = useState<string>('Khung mẫu tự sắp xếp')
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!name.trim()) {
      setError('Vui lòng nhập tên khuôn mẫu')
      return
    }
    if (layers.length === 0) {
      setError('Cần ít nhất 1 bộ phận trên bố cục để tạo mẫu')
      return
    }
    const preset = createPresetFromLayers(name, desc, layers)
    saveCustomPreset(preset)
    onSaved(preset)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440,
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 8,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-3)',
            borderBottom: '1px solid var(--line-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <strong style={{ fontSize: 13, color: 'var(--text)' }}>
            💾 Lưu bố cục thành Khuôn mẫu mới
          </strong>
          <button
            id="btn-close-save-template"
            type="button"
            className="btn sm icon"
            onClick={onClose}
            style={{ width: 22, height: 22 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                fontSize: 11
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              Tên khuôn mẫu:
            </label>
            <input
              type="text"
              className="input sm"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Mẫu Chibi Kiếm Hiệp, Nữ sinh Anime..."
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              Mô tả ngắn:
            </label>
            <input
              type="text"
              className="input sm"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="VD: Gồm 9 bộ phận chi tiết"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
              Danh sách {layers.length} bộ phận sẽ lưu vào mẫu:
            </label>
            <div
              style={{
                maxHeight: 140,
                overflowY: 'auto',
                background: 'var(--bg-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: 4,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
            >
              {layers.map((l, i) => (
                <div
                  key={l.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text)'
                  }}
                >
                  <span>
                    #{i + 1}. <strong>{l.name}</strong>
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>
                    ({Math.round(l.x)}, {Math.round(l.y)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--bg-3)',
            borderTop: '1px solid var(--line-soft)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}
        >
          <button type="button" className="btn sm" onClick={onClose}>
            Hủy bỏ
          </button>
          <button
            id="btn-confirm-save-template"
            type="button"
            className="btn sm primary"
            onClick={handleSave}
          >
            <IconCheck width={12} height={12} /> Xác nhận Lưu mẫu
          </button>
        </div>
      </div>
    </div>
  )
}
