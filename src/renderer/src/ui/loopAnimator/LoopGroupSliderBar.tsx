import React, { useRef, useState } from 'react'
import { toast } from '../../actions'
import { IconFilm, IconPlus, IconReplace, IconTrash, IconUpload } from '../icons'
import {
  LOOP_IMAGE_ACCEPT,
  appendLoopImageFilesAsGroups,
  loadLoopImageFiles,
  replaceActiveGroupImageFile
} from './loopAnimatorLauncher'
import { useLoopAnimator } from './loopAnimatorState'
import type { LoopTriggerMode } from './types'

interface Props {
  onRequestAppendUpload: () => void
}

const TRIGGER_MODE_OPTIONS: { id: LoopTriggerMode; label: string; hint: string }[] = [
  {
    id: 'sequential',
    label: '⏭ Nối tiếp',
    hint: 'Chạy sau khi nhóm liền trước kết thúc (cộng thêm thời gian chờ nếu có)'
  },
  {
    id: 'on_frame',
    label: '⚡ Tại Frame #',
    hint: 'Kết hợp chạy ngay tại thời điểm nhóm trước chạm Frame chỉ định (VD: frame sét chạm đất -> nổ)'
  },
  {
    id: 'parallel',
    label: '⇉ Song song',
    hint: 'Chạy đồng thời cùng lúc với nhóm liền trước'
  }
]

export function LoopGroupSliderBar({ onRequestAppendUpload }: Props): React.ReactElement | null {
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const comboPreviewMode = useLoopAnimator((s) => s.comboPreviewMode)
  const selectGroup = useLoopAnimator((s) => s.selectGroup)
  const reorderGroup = useLoopAnimator((s) => s.reorderGroup)
  const deleteGroup = useLoopAnimator((s) => s.deleteGroup)
  const updateActiveGroupMeta = useLoopAnimator((s) => s.updateActiveGroupMeta)
  const setComboPreviewMode = useLoopAnimator((s) => s.setComboPreviewMode)

  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const stitchFramesInputRef = useRef<HTMLInputElement | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (groups.length === 0) return null

  const activeGroup = groups[activeGroupIndex] ?? groups[0]
  const prevGroup = activeGroupIndex > 0 ? groups[activeGroupIndex - 1] : null
  const prevEnabledCount = prevGroup ? Math.max(1, prevGroup.frames.filter((f) => f.enabled).length) : 1

  return (
    <div className="loop-group-slider-bar" data-mcp-region="loop_animator_groups">
      <input
        ref={replaceInputRef}
        type="file"
        accept={LOOP_IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            if (replaceActiveGroupImageFile(file)) {
              toast(`🔄 Đã thay ảnh cho "${activeGroup.name}"`)
            } else {
              toast('⚠ Tệp không phải ảnh hợp lệ')
            }
          }
          e.target.value = ''
        }}
      />
      <input
        ref={stitchFramesInputRef}
        type="file"
        accept={LOOP_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 1) {
            const ok = await loadLoopImageFiles(files)
            if (ok) toast(`🎞 Đã ghép ${files.length} ảnh lẻ vào "${activeGroup.name}"`)
          } else if (files.length === 1) {
            await appendLoopImageFilesAsGroups(files)
          }
          e.target.value = ''
        }}
      />

      {/* Dòng 1: Thanh trượt các Nhóm hiệu ứng (Slider đổi thứ tự chạy + Thêm ảnh nối tiếp) */}
      <div className="loop-group-slider-row">
        <div className="loop-group-slider-head">
          <span className="la-label">Chuỗi nhóm ({groups.length})</span>
          {groups.length > 1 && (
            <div className="la-seg" title="Chế độ xem trên sân khấu Preview">
              <button
                type="button"
                className={`la-seg-btn${comboPreviewMode ? ' active' : ''}`}
                onClick={() => setComboPreviewMode(true)}
                title="Xem toàn bộ chuỗi hiệu ứng kết hợp theo thời gian & vị trí"
              >
                🔗 Tổ hợp ({groups.length})
              </button>
              <button
                type="button"
                className={`la-seg-btn${!comboPreviewMode ? ' active' : ''}`}
                onClick={() => setComboPreviewMode(false)}
                title="Chỉ xem riêng nhóm đang chọn"
              >
                🎯 Nhóm #{activeGroupIndex + 1}
              </button>
            </div>
          )}
        </div>

        <div className="loop-group-slider-track" role="tablist" aria-label="Danh sách nhóm hiệu ứng nối tiếp">
          {groups.map((g, idx) => {
            const isSel = idx === activeGroupIndex
            const enabledCount = g.frames.filter((f) => f.enabled).length
            const connectorBadge =
              idx === 0
                ? null
                : g.triggerMode === 'on_frame'
                  ? `⚡F#${g.triggerFrameIndex}${g.delaySec > 0 ? `+${g.delaySec}s` : ''}`
                  : g.triggerMode === 'parallel'
                    ? `⇉${g.delaySec > 0 ? `+${g.delaySec}s` : ''}`
                    : `→${g.delaySec > 0 ? `+${g.delaySec}s` : ''}`

            return (
              <React.Fragment key={g.id}>
                {connectorBadge && (
                  <span
                    className={`loop-group-connector mode-${g.triggerMode}`}
                    title={
                      g.triggerMode === 'on_frame'
                        ? `Nhóm ${idx + 1} kích hoạt ngay khi Nhóm ${idx} chạy tới Frame #${g.triggerFrameIndex}`
                        : g.triggerMode === 'parallel'
                          ? `Nhóm ${idx + 1} chạy song song với Nhóm ${idx}`
                          : `Nhóm ${idx + 1} chạy nối tiếp sau Nhóm ${idx}`
                    }
                  >
                    {connectorBadge}
                  </span>
                )}
                <div
                  role="tab"
                  aria-selected={isSel}
                  draggable={groups.length > 1}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOverIdx !== idx) setDragOverIdx(idx)
                  }}
                  onDragLeave={() => {
                    if (dragOverIdx === idx) setDragOverIdx(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIdx !== null && dragIdx !== idx) {
                      reorderGroup(dragIdx, idx)
                      toast(`🔀 Đã đổi thứ tự chạy: Nhóm #${dragIdx + 1} → vị trí #${idx + 1}`)
                    }
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  onDragEnd={() => {
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  className={`loop-group-chip${isSel ? ' active' : ''}${dragOverIdx === idx ? ' drag-over' : ''}`}
                  onClick={() => selectGroup(idx)}
                  title={`Nhóm #${idx + 1}: ${g.name} (${enabledCount} frame • ${g.fps} FPS). Kéo thả hoặc bấm ◀ ▶ để đổi thứ tự chạy.`}
                >
                  <span className="loop-group-step">#{idx + 1}</span>
                  <span className="loop-group-name">{g.name}</span>
                  <span className="loop-group-meta">
                    {enabledCount}F · {g.fps}fps
                  </span>
                  {isSel && groups.length > 1 && (
                    <span className="loop-group-chip-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="loop-group-mini-btn"
                        disabled={idx === 0}
                        onClick={() => reorderGroup(idx, idx - 1)}
                        title="Đẩy nhóm này chạy sớm hơn (sang trái)"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        className="loop-group-mini-btn"
                        disabled={idx === groups.length - 1}
                        onClick={() => reorderGroup(idx, idx + 1)}
                        title="Đẩy nhóm này chạy muộn hơn (sang phải)"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="loop-group-mini-btn danger"
                        onClick={() => {
                          deleteGroup(idx)
                          toast(`🗑 Đã xoá "${g.name}" khỏi chuỗi hiệu ứng`)
                        }}
                        title="Xoá nhóm hiệu ứng này"
                      >
                        <IconTrash width={11} height={11} />
                      </button>
                    </span>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>

        <div className="loop-group-slider-actions">
          <button
            type="button"
            className="la-btn la-btn--danger la-btn--sm"
            onClick={onRequestAppendUpload}
            title="Thêm 1 hoặc nhiều ảnh làm nhóm hiệu ứng nối tiếp (không ghi đè nhóm hiện có)"
          >
            <IconPlus width={12} height={12} />
            <IconUpload width={12} height={12} />
            <span>Ảnh nối tiếp</span>
          </button>
          <button
            type="button"
            className="la-btn la-btn--outline la-btn--sm"
            onClick={() => replaceInputRef.current?.click()}
            title="Thay ảnh nguồn của riêng nhóm đang chọn"
          >
            <IconReplace width={12} height={12} />
            <span>Thay ảnh nhóm</span>
          </button>
          <button
            type="button"
            className="la-btn la-btn--outline la-btn--sm"
            onClick={() => stitchFramesInputRef.current?.click()}
            title="Chọn nhiều ảnh frame lẻ (1.png, 2.png...) để ghép thành lưới cho nhóm hiện tại"
          >
            <IconFilm width={12} height={12} />
            <span>Ghép frame lẻ</span>
          </button>
        </div>
      </div>

      {/* Dòng 2: Cấu hình riêng của Nhóm đang chọn (Thứ tự/Trigger frame, Chờ giây, Giữ giây, Căn vị trí X/Y/Tỉ lệ) */}
      <div className="loop-group-config-row">
        <label className="loop-group-name-field" title="Tên định danh của nhóm hiệu ứng này (sẽ lưu vào animation.json và Node Animation Loop)">
          <span className="la-label">Nhóm #{activeGroupIndex + 1}</span>
          <input
            type="text"
            className="la-input loop-group-name-input"
            value={activeGroup.name}
            onChange={(e) => updateActiveGroupMeta({ name: e.target.value })}
            placeholder={`Tên nhóm #${activeGroupIndex + 1}…`}
          />
        </label>

        {activeGroupIndex > 0 && (
          <div className="loop-group-trigger-field">
            <span className="la-label">Khởi chạy</span>
            <div className="la-seg" role="radiogroup" aria-label="Chế độ kích hoạt nhóm">
              {TRIGGER_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={activeGroup.triggerMode === opt.id}
                  className={`la-seg-btn${activeGroup.triggerMode === opt.id ? ' active' : ''}`}
                  onClick={() => updateActiveGroupMeta({ triggerMode: opt.id })}
                  title={opt.hint}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeGroupIndex > 0 && activeGroup.triggerMode === 'on_frame' && (
          <label
            className="la-num"
            title={`Chọn Frame của Nhóm #${activeGroupIndex} (${prevGroup?.name || ''}, gồm ${prevEnabledCount} frame) để kích hoạt Nhóm #${activeGroupIndex + 1} chạy cùng thời điểm (VD: frame sét đánh chạm đất)`}
          >
            <span className="la-num-label">Tại Frame N.{activeGroupIndex}</span>
            <input
              type="number"
              min={1}
              max={prevEnabledCount}
              step={1}
              value={Math.min(prevEnabledCount, Math.max(1, activeGroup.triggerFrameIndex || 1))}
              onChange={(e) =>
                updateActiveGroupMeta({
                  triggerFrameIndex: Math.max(1, Math.min(prevEnabledCount, Number(e.target.value) || 1))
                })
              }
            />
            <span className="la-num-unit">/{prevEnabledCount}</span>
          </label>
        )}

        <label
          className="la-num"
          title={
            activeGroupIndex === 0
              ? 'Thời gian trễ (giây) trước khi Nhóm #1 bắt đầu chạy'
              : activeGroup.triggerMode === 'on_frame'
                ? 'Thời gian chờ thêm (giây) sau khi chạm Frame kích hoạt của nhóm trước'
                : 'Thời gian chờ (giây) sau khi nhóm trước chạy xong rồi mới bắt đầu nhóm này'
          }
        >
          <span className="la-num-label">Chờ</span>
          <input
            type="number"
            min={0}
            max={30}
            step={0.1}
            value={activeGroup.delaySec}
            onChange={(e) => updateActiveGroupMeta({ delaySec: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="la-num-unit">s</span>
        </label>

        <label
          className="la-num"
          title="Thời lượng duy trì chạy/hiển thị của nhóm này trong cảnh (0 = tự động theo 1 chu kỳ của nhóm)"
        >
          <span className="la-num-label">Giữ</span>
          <input
            type="number"
            min={0}
            max={120}
            step={0.2}
            value={activeGroup.holdDurationSec}
            onChange={(e) => updateActiveGroupMeta({ holdDurationSec: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="la-num-unit">s</span>
        </label>

        <div className="loop-group-pos-cluster" title="Điều chỉnh vị trí chạy của nhóm này (hoặc kéo trực tiếp trên sân khấu Xem trước) để căn khớp hướng/điểm chạm giữa các hiệu ứng (VD: điểm sét đánh & tâm vụ nổ)">
          <label className="la-num">
            <span className="la-num-label">Vị trí X</span>
            <input
              type="number"
              min={-1000}
              max={1000}
              step={2}
              value={activeGroup.offsetX}
              onChange={(e) => updateActiveGroupMeta({ offsetX: Math.round(Number(e.target.value) || 0) })}
            />
            <span className="la-num-unit">px</span>
          </label>
          <label className="la-num">
            <span className="la-num-label">Y</span>
            <input
              type="number"
              min={-1000}
              max={1000}
              step={2}
              value={activeGroup.offsetY}
              onChange={(e) => updateActiveGroupMeta({ offsetY: Math.round(Number(e.target.value) || 0) })}
            />
            <span className="la-num-unit">px</span>
          </label>
          <label className="la-num">
            <span className="la-num-label">Tỉ lệ</span>
            <input
              type="number"
              min={10}
              max={400}
              step={5}
              value={Math.round((activeGroup.scale || 1) * 100)}
              onChange={(e) =>
                updateActiveGroupMeta({
                  scale: Math.max(0.1, Math.min(4, (Number(e.target.value) || 100) / 100))
                })
              }
            />
            <span className="la-num-unit">%</span>
          </label>
          {(activeGroup.offsetX !== 0 || activeGroup.offsetY !== 0 || Math.abs((activeGroup.scale || 1) - 1) > 0.01) && (
            <button
              type="button"
              className="la-btn la-btn--ghost la-btn--sm"
              onClick={() => updateActiveGroupMeta({ offsetX: 0, offsetY: 0, scale: 1 })}
              title="Đặt lại vị trí (X=0, Y=0) và tỉ lệ (100%) của nhóm này"
            >
              ↺ Tâm
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
