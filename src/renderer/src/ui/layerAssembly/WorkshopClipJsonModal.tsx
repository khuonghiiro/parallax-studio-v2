import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import { toast } from '../../actions'
import { IconCode, IconCopy, IconDownload, IconSparkles, IconUpload, IconX } from '../icons'
import {
  exportAnimationClipToJson,
  generateAiMotionPrompt,
  parseAnimationClipFromJson
} from './workshopClipJson'

export interface WorkshopClipJsonModalProps {
  isOpen: boolean
  onClose: () => void
  clip: AnimationClip
  bones: LayerBone[]
  onImportClip: (clip: AnimationClip, mode: 'new' | 'replace') => void
}

export function WorkshopClipJsonModal({
  isOpen,
  onClose,
  clip,
  bones,
  onImportClip
}: WorkshopClipJsonModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [promptIntent, setPromptIntent] = useState('Nhân vật thực hiện động tác tự nhiên, mượt mà')
  const [importText, setImportText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // JSON xuất ra từ clip hiện tại
  const exportedJson = useMemo(() => {
    return exportAnimationClipToJson(clip, bones, true)
  }, [clip, bones])

  // Prompt AI sinh ra từ clip và bones
  const aiPrompt = useMemo(() => {
    return generateAiMotionPrompt(clip, bones, promptIntent)
  }, [clip, bones, promptIntent])

  // Phân tích kết quả khi người dùng dán JSON
  const parseResult = useMemo(() => {
    if (!importText.trim()) return null
    return parseAnimationClipFromJson(importText, bones)
  }, [importText, bones])

  // Reset tab và text khi mở
  useEffect(() => {
    if (isOpen) {
      setImportText('')
    }
  }, [isOpen])

  // Đóng bằng phím Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportedJson)
      toast('✓ Đã sao chép JSON động tác vào Clipboard!')
    } catch {
      toast('Không thể sao chép tự động, vui lòng chọn văn bản và nhấn Ctrl+C.')
    }
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt)
      toast('✓ Đã sao chép Prompt AI vào Clipboard! Bạn có thể dán vào ChatGPT / Claude ngay.')
    } catch {
      toast('Không thể sao chép tự động, vui lòng chọn văn bản và nhấn Ctrl+C.')
    }
  }

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([exportedJson], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = clip.name.replace(/[^\w\s-]/gi, '').trim().replace(/\s+/g, '_') || 'clip'
      a.href = url
      a.download = `${safeName}.motion.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(`✓ Đã tải tệp "${safeName}.motion.json"!`)
    } catch (err) {
      toast(`Lỗi khi tải tệp: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        setImportText(content)
        setActiveTab('import')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleApplyImport = (mode: 'new' | 'replace') => {
    if (!parseResult || !parseResult.success || !parseResult.clip) {
      toast('Dữ liệu JSON không hợp lệ để áp dụng.')
      return
    }
    onImportClip(parseResult.clip, mode)
    toast(
      mode === 'new'
        ? `✓ Đã tạo động tác mới "${parseResult.clip.name}" từ JSON!`
        : `✓ Đã ghi đè động tác "${clip.name}" bằng dữ liệu JSON mới!`
    )
    onClose()
  }

  const activeTrackCount = Object.keys(clip.tracks || {}).length

  return (
    <div
      className="lw-clip-json-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        zIndex: 65000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="lw-clip-json-modal"
        data-mcp-region="layer_assembly_clip_json"
        data-mcp-dialog
        style={{
          width: '640px',
          maxWidth: '94vw',
          maxHeight: '90vh',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-focus)',
          borderRadius: 'var(--radius-lg, 10px)',
          boxShadow: 'var(--shadow-popup, 0 12px 36px rgba(0,0,0,0.5))',
          color: 'var(--text)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: 'var(--radius-sm, 4px)',
                background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                color: 'var(--accent)'
              }}
            >
              <IconCode width={15} height={15} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                Xuất / Nhập JSON Động Tác Hoạt Ảnh
              </h3>
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '11px' }}>
                Động tác hiện tại: <strong>{clip.name}</strong> ({clip.duration.toFixed(2)}s ·{' '}
                {activeTrackCount} xương có keyframe)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng hộp thoại (Esc)"
            style={{ width: '24px', height: '24px' }}
          >
            <IconX width={13} height={13} />
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--line)',
            background: 'var(--bg-0)',
            padding: '4px 12px',
            gap: '8px'
          }}
        >
          <button
            type="button"
            className={`btn xs ${activeTab === 'export' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('export')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <IconSparkles width={12} height={12} />
            <span>Xuất JSON & Prompt AI</span>
          </button>
          <button
            type="button"
            className={`btn xs ${activeTab === 'import' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('import')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <IconUpload width={12} height={12} />
            <span>Nhập JSON từ AI / Tệp</span>
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '16px 18px',
            overflowY: 'auto',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {activeTab === 'export' ? (
            <>
              {/* Ý đồ hoạt ảnh để AI hiểu */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    color: 'var(--text)'
                  }}
                >
                  Mục tiêu động tác (để gắn vào Prompt AI):
                </label>
                <input
                  type="text"
                  className="lw-field-input"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontSize: '12px'
                  }}
                  value={promptIntent}
                  onChange={(e) => setPromptIntent(e.target.value)}
                  placeholder="Ví dụ: Nhân vật cúi chào trang trọng, mắt nhìn xuống, tay khép nhẹ..."
                />
              </div>

              {/* Nút hành động copy Prompt & JSON */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="btn xs primary"
                  onClick={handleCopyPrompt}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <IconSparkles width={12} height={12} />
                  <span>Sao chép Prompt cho AI (ChatGPT/Claude)</span>
                </button>
                <button
                  type="button"
                  className="btn xs"
                  onClick={handleCopyJson}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <IconCopy width={12} height={12} />
                  <span>Sao chép mã JSON</span>
                </button>
                <button
                  type="button"
                  className="btn xs"
                  onClick={handleDownloadJson}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <IconDownload width={12} height={12} />
                  <span>Tải tệp .motion.json</span>
                </button>
              </div>

              {/* Hướng dẫn nhanh */}
              <div
                style={{
                  background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
                  border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--line))',
                  borderRadius: 'var(--radius, 6px)',
                  padding: '8px 12px',
                  fontSize: '11px',
                  lineHeight: 1.5,
                  color: 'var(--text-dim)'
                }}
              >
                💡 <strong>Mẹo quy trình với AI:</strong> Bấm <em>&quot;Sao chép Prompt cho AI&quot;</em> ➔ Dán
                vào ChatGPT / Claude / DeepSeek ➔ AI sẽ trả về mã JSON chuẩn đúng với {bones.length} khớp
                xương của nhân vật này ➔ Sao chép khối JSON của AI và chuyển sang tab <em>&quot;Nhập JSON từ AI&quot;</em>.
              </div>

              {/* Xem trước JSON */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}
                >
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
                    Nội dung JSON của động tác:
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                    {bones.length} xương trong rig · {activeTrackCount} xương có chuyển động
                  </span>
                </div>
                <textarea
                  readOnly
                  value={exportedJson}
                  style={{
                    width: '100%',
                    height: '180px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    padding: '8px 10px',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm, 4px)',
                    color: 'var(--text)',
                    resize: 'vertical',
                    whiteSpace: 'pre'
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Tab Nhập JSON */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
                  Dán chuỗi JSON nhận được từ AI hoặc tệp bên ngoài vào đây:
                </label>
                <button
                  type="button"
                  className="btn xs"
                  onClick={handleTriggerFileInput}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <IconUpload width={11} height={11} />
                  <span>Chọn tệp .json</span>
                </button>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Dán mã JSON (kể cả khối ```json ... ``` từ ChatGPT / Claude) vào đây..."
                style={{
                  width: '100%',
                  height: '160px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  padding: '8px 10px',
                  background: 'var(--bg-0)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  color: 'var(--text)',
                  resize: 'vertical'
                }}
              />

              {/* Kết quả kiểm tra JSON */}
              {parseResult && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius, 6px)',
                    border: `1px solid ${
                      parseResult.success
                        ? 'color-mix(in srgb, #10b981 40%, var(--line))'
                        : 'color-mix(in srgb, #ef4444 40%, var(--line))'
                    }`,
                    background: parseResult.success
                      ? 'color-mix(in srgb, #10b981 10%, var(--bg-2))'
                      : 'color-mix(in srgb, #ef4444 10%, var(--bg-2))',
                    fontSize: '11px'
                  }}
                >
                  {parseResult.success && parseResult.clip ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                        ✓ JSON hợp lệ: &ldquo;{parseResult.clip.name}&rdquo;
                      </div>
                      <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        - Thời lượng: <strong>{parseResult.clip.duration.toFixed(2)}s</strong> | FPS:{' '}
                        <strong>{parseResult.clip.fps ?? 30}</strong> | Lặp:{' '}
                        <strong>{parseResult.clip.loop ? 'Có' : 'Không'}</strong>
                        <br />- Khớp xương có hoạt ảnh:{' '}
                        <strong>{Object.keys(parseResult.clip.tracks).length} xương</strong> (
                        {Object.keys(parseResult.clip.tracks).join(', ')})
                      </div>
                      {parseResult.warnings && (
                        <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                          ⚠️ {parseResult.warnings.join(' ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#ef4444', fontWeight: 500 }}>
                      ✕ {parseResult.error}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Modal */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            Hỗ trợ format Parallax Motion JSON V1 & AnimationClip
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="btn xs" onClick={onClose}>
              Đóng
            </button>
            {activeTab === 'import' && parseResult?.success && (
              <>
                <button
                  type="button"
                  className="btn xs lw-muted-danger-btn"
                  onClick={() => handleApplyImport('replace')}
                  title="Thay thế toàn bộ keyframe của động tác đang chọn bằng dữ liệu JSON mới"
                >
                  <span>⚡ Ghi đè vào clip này</span>
                </button>
                <button
                  type="button"
                  className="btn xs primary"
                  onClick={() => handleApplyImport('new')}
                  title="Tạo thêm một động tác mới trong danh sách và áp dụng ngay"
                >
                  <span>➕ Thêm thành Clip mới</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Input ẩn để nạp file */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
