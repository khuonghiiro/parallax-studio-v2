import React, { useRef, useState } from 'react'
import { toast } from '../../actions'
import {
  IconFilm,
  IconGrid,
  IconPlus,
  IconReplace,
  IconTrash,
  IconUpload
} from '../icons'
import {
  appendLoopImageFilesAsGroups,
  loadLoopImageFiles,
  LOOP_IMAGE_ACCEPT,
  replaceActiveGroupImageFile
} from './loopAnimatorLauncher'
import { useLoopAnimator } from './loopAnimatorState'

interface Props {
  onRequestAppendUpload?: () => void
}

/**
 * Thanh trượt ngang Chuỗi Nhóm Hiệu Ứng (1 dòng gọn gàng):
 * - Chọn nhóm để chỉnh cấu hình riêng (Lưới cắt, Tách nền, FPS, Nhịp...).
 * - Tích chọn `☑` ngay trên từng thẻ nhóm để nhận đồng bộ Tách nền (bỏ tích nếu có 1 ảnh nền khác biệt).
 * - Đổi thứ tự chạy bằng kéo thả (drag-and-drop) hoặc nút ◀ ▶.
 * - Nút mở "📐 So sánh & Căn vị trí" (khung đa cột chuyên sâu khi cần soi & căn điểm chạm).
 */
export function LoopGroupSliderBar({ onRequestAppendUpload }: Props = {}): React.ReactElement | null {
  const groups = useLoopAnimator((s) => s.groups)
  const activeGroupIndex = useLoopAnimator((s) => s.activeGroupIndex)
  const comboPreviewMode = useLoopAnimator((s) => s.comboPreviewMode)
  const syncChromaAll = useLoopAnimator((s) => s.syncChromaAll)
  const selectGroup = useLoopAnimator((s) => s.selectGroup)
  const reorderGroup = useLoopAnimator((s) => s.reorderGroup)
  const deleteGroup = useLoopAnimator((s) => s.deleteGroup)
  const toggleGroupSyncChroma = useLoopAnimator((s) => s.toggleGroupSyncChroma)
  const setComboPreviewMode = useLoopAnimator((s) => s.setComboPreviewMode)
  const setAlignModalOpen = useLoopAnimator((s) => s.setAlignModalOpen)

  const appendInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const stitchFramesInputRef = useRef<HTMLInputElement | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (groups.length === 0) return null

  const activeGroup = groups[activeGroupIndex] ?? groups[0]

  return (
    <div className="loop-group-slider-bar" data-mcp-region="loop_animator_groups">
      <input
        ref={appendInputRef}
        type="file"
        accept={LOOP_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) {
            const added = await appendLoopImageFilesAsGroups(files)
            if (added > 1) {
              toast(`✨ Đã thêm nối tiếp ${added} nhóm ảnh hiệu ứng vào thanh trượt`)
            } else if (added === 1) {
              const totalGroups = useLoopAnimator.getState().groups.length
              toast(
                totalGroups > 1
                  ? `✨ Đã thêm nối tiếp Nhóm #${totalGroups} (không ghi đè nhóm trước)`
                  : '✨ Đã nạp ảnh hoạt ảnh vào Nhóm #1'
              )
            } else {
              toast('⚠ Tệp không phải ảnh hợp lệ')
            }
          }
          e.target.value = ''
        }}
      />
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
            replaceActiveGroupImageFile(files[0])
          }
          e.target.value = ''
        }}
      />

      <div className="loop-group-slider-row">
        <div className="loop-group-slider-head">
          <span className="la-label">Chuỗi ({groups.length})</span>
          {groups.length > 1 && (
            <div className="la-seg" role="group" aria-label="Chế độ xem sân khấu">
              <button
                type="button"
                className={`la-seg-btn${comboPreviewMode ? ' active' : ''}`}
                onClick={() => setComboPreviewMode(true)}
                title="Xem trước toàn bộ chuỗi hiệu ứng kết hợp theo thứ tự"
              >
                🔗 Tổ hợp
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

        <div className="loop-group-slider-track" role="tablist" aria-label="Danh sách nhóm hiệu ứng">
          {groups.map((g, idx) => {
            const isActive = idx === activeGroupIndex
            const enabledFrames = g.frames.filter((f) => f.enabled).length
            const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
            const isSynced = g.syncChromaKey !== false
            const connectorLabel =
              idx === 0
                ? null
                : g.triggerMode === 'on_frame'
                  ? `⚡F#${g.triggerFrameIndex}`
                  : g.triggerMode === 'parallel'
                    ? '⇉'
                    : g.delaySec > 0
                      ? `+${g.delaySec}s`
                      : '→'
            return (
              <React.Fragment key={g.id}>
                {connectorLabel && (
                  <button
                    type="button"
                    className={`loop-group-connector mode-${g.triggerMode}`}
                    onClick={() => setAlignModalOpen(true)}
                    title={
                      g.triggerMode === 'on_frame'
                        ? `Nhóm ${idx + 1} kích hoạt tại Frame #${g.triggerFrameIndex} của Nhóm ${idx} (Bấm để mở khung căn chỉnh & đổi logic)`
                        : g.triggerMode === 'parallel'
                          ? `Nhóm ${idx + 1} chạy song song với Nhóm ${idx} (Bấm để mở khung căn chỉnh)`
                          : `Nhóm ${idx + 1} chạy nối tiếp sau Nhóm ${idx} (Chờ ${g.delaySec}s · Bấm để mở khung căn chỉnh)`
                    }
                  >
                    {connectorLabel}
                  </button>
                )}
                <div
                  role="tab"
                  aria-selected={isActive}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverIdx(idx)
                  }}
                  onDragLeave={() => setDragOverIdx((cur) => (cur === idx ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIdx !== null && dragIdx !== idx) {
                      reorderGroup(dragIdx, idx)
                      toast(`🔀 Đã đổi thứ tự Nhóm #${dragIdx + 1} sang vị trí #${idx + 1}`)
                    }
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  onDragEnd={() => {
                    setDragIdx(null)
                    setDragOverIdx(null)
                  }}
                  className={`loop-group-chip${isActive ? ' active' : ''}${isDragOver ? ' drag-over' : ''}`}
                  onClick={() => selectGroup(idx)}
                  title={`${g.name} (${enabledFrames}F · ${g.fps} FPS) — Bấm để chỉnh sửa, kéo thả để đổi thứ tự chạy`}
                >
                  {groups.length > 1 && syncChromaAll && (
                    <input
                      type="checkbox"
                      className="loop-group-sync-check"
                      checked={isSynced}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleGroupSyncChroma(idx, e.target.checked)
                        toast(
                          e.target.checked
                            ? `🔗 Đã bật đồng bộ Tách nền cho "${g.name}"`
                            : `🔓 Đã tách riêng cấu hình nền của "${g.name}" (không ăn theo nhóm khác)`
                        )
                      }}
                      title={
                        isSynced
                          ? 'Đang tích chọn đồng bộ Tách nền cùng các nhóm khác (Bỏ tích nếu ảnh này có nền khác biệt)'
                          : 'Ảnh này đang chỉnh nền độc lập (Tích chọn để ăn theo cấu hình Tách nền chung)'
                      }
                    />
                  )}
                  <span className="loop-group-step">#{idx + 1}</span>
                  <span className="loop-group-name">{g.name.replace(/^Nhóm \d+:\s*/i, '')}</span>
                  <span className="loop-group-meta">{enabledFrames}F</span>
                  {(g.offsetX !== 0 || g.offsetY !== 0) && (
                    <span className="loop-group-offset-tag" title={`Vị trí lệch: X=${g.offsetX}px, Y=${g.offsetY}px`}>
                      {g.offsetX >= 0 ? `+${g.offsetX}` : g.offsetX},{g.offsetY >= 0 ? `+${g.offsetY}` : g.offsetY}
                    </span>
                  )}
                  {groups.length > 1 && isActive && (
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
            className="la-btn la-btn--primary la-btn--sm loop-open-align-btn"
            onClick={() => setAlignModalOpen(true)}
            title="Mở khung rộng So sánh các cột & Căn chỉnh vị trí chạy, chọn Frame kích hoạt, thời gian chờ/giữ giữa các nhóm"
          >
            <IconGrid width={12} height={12} />
            <span>So sánh & Căn vị trí ({groups.length} cột)</span>
          </button>
          <button
            type="button"
            className="la-btn la-btn--danger la-btn--sm"
            onClick={() => {
              if (onRequestAppendUpload) onRequestAppendUpload()
              else appendInputRef.current?.click()
            }}
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
            <span>Thay ảnh</span>
          </button>
          <button
            type="button"
            className="la-btn la-btn--outline la-btn--sm"
            onClick={() => stitchFramesInputRef.current?.click()}
            title="Chọn nhiều ảnh frame lẻ (1.png, 2.png...) để ghép thành lưới cho nhóm hiện tại"
          >
            <IconFilm width={12} height={12} />
            <span>Ghép lẻ</span>
          </button>
        </div>
      </div>
    </div>
  )
}
