import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimationClip, LayerBone, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { toast } from '../../actions'
import { IconCode, IconCopy, IconDownload, IconSparkles, IconUpload, IconX } from '../icons'
import {
  exportAnimationClipToJson,
  generateAiMotionPrompt,
  parseAnimationClipFromJson,
  type ClipJsonParseResult,
  type MotionMeshExportSection,
  type ParsedWindData
} from './workshopClipJson'
import { inferDescriptiveClipName, isGenericClipName } from './workshopClipBiomechanics'
import '../../styles/workshopClipJsonModal.css'

export interface WorkshopClipJsonModalProps {
  isOpen: boolean
  onClose: () => void
  clip: AnimationClip
  bones: LayerBone[]
  composite?: LayerComposite
  onImportClip: (
    clip: AnimationClip,
    mode: 'new' | 'replace',
    wind?: ParsedWindData,
    mesh?: Partial<MotionMeshExportSection>
  ) => void
}

const QUICK_AI_INTENTS = [
  {
    label: '👋 Vẫy tay chào',
    name: 'Vẫy tay chào tươi tắn',
    intent: 'Nhân vật giơ tay phải vẫy chào thân thiện, đầu nghiêng nhẹ tươi tắn, cơ thể nhún thở tự nhiên, tóc/áo đung đưa theo gió nhẹ'
  },
  {
    label: '🎉 Nhún nhảy vui',
    name: 'Nhún nhảy vươn tay (Jump)',
    intent: 'Nhân vật hạ gối lấy đà rồi bật nhảy vui mừng, hai tay vươn mở rộng sang hai bên hướng lên trời, tiếp đất đàn hồi mượt mà'
  },
  {
    label: '🚶 Bước đi 2.5D',
    name: 'Bước đi dạo phố (Walk)',
    intent: 'Nhân vật bước đi nhịp nhàng tự nhiên, tay đánh đối xứng với chân, thân người nhấp nhô nhẹ theo nhịp bước'
  },
  {
    label: '🌬️ Đứng thở & Gió',
    name: 'Đứng thở & Gió thổi nhẹ',
    intent: 'Nhân vật đứng thở êm ái, lồng ngực nâng hạ nhẹ, đầu nghiêng khẽ và tà áo/mái tóc bay phấp phới theo làn gió'
  },
  {
    label: '⚡ Tung chiêu',
    name: 'Tung chiêu thức 2.5D',
    intent: 'Nhân vật xoay thân lấy đà, vung tay tung chiêu mạnh mẽ về phía trước kèm độ nảy cơ học sắc nét rồi thu thế'
  }
] as const

interface ExportTabProps {
  clip: AnimationClip
  bones: LayerBone[]
  windCount: number
  exportName: string
  setExportName: (v: string) => void
  promptIntent: string
  setPromptIntent: (v: string) => void
  selectedAngle: MotionViewAngle
  setSelectedAngle: (v: MotionViewAngle) => void
  walkType: 'in-place' | 'root-motion'
  setWalkType: (v: 'in-place' | 'root-motion') => void
  includeWind: boolean
  setIncludeWind: (v: boolean) => void
  exportedJson: string
  onCopyPrompt: () => void
  onCopyJson: () => void
  onDownloadJson: () => void
  onLoadCurrentToImport: () => void
}

function ExportTabPanel({
  clip,
  bones,
  windCount,
  exportName,
  setExportName,
  promptIntent,
  setPromptIntent,
  selectedAngle,
  setSelectedAngle,
  walkType,
  setWalkType,
  includeWind,
  setIncludeWind,
  exportedJson,
  onCopyPrompt,
  onCopyJson,
  onDownloadJson,
  onLoadCurrentToImport
}: ExportTabProps) {
  const activeTrackCount = Object.keys(clip.tracks || {}).length
  const fileName = `${(exportName || clip.name).replace(/[^\w\s\u00C0-\u1EF9-]/gi, '').trim().replace(/\s+/g, '_') || 'clip'}.motion.json`

  return (
    <>
      <div className="lw-clip-grid-2col">
        <div>
          <label className="lw-form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
            Tên động tác (đính vào JSON &amp; AI):
          </label>
          <input
            type="text"
            className="lw-field-input"
            style={{ width: '100%', height: '32px', fontWeight: 600 }}
            value={exportName}
            onChange={(e) => setExportName(e.target.value)}
            placeholder="Nhập tên mô tả động tác..."
          />
        </div>
        <div>
          <label className="lw-form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
            Mục tiêu chuyển động (để AI thiết kế chuẩn cơ học 2.5D):
          </label>
          <input
            type="text"
            className="lw-field-input"
            style={{ width: '100%', height: '32px' }}
            value={promptIntent}
            onChange={(e) => setPromptIntent(e.target.value)}
            placeholder="Ví dụ: Nhân vật vẫy tay chào, nhún nhảy hoặc bước đi..."
          />
        </div>
      </div>

      {/* Gợi ý nhanh ý đồ & tên động tác */}
      <div className="lw-clip-intents-wrap">
        <span className="lw-clip-intents-label">Gợi ý nhanh ý đồ:</span>
        {QUICK_AI_INTENTS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="lw-clip-intent-chip"
            onClick={() => {
              setPromptIntent(item.intent)
              setExportName(item.name)
            }}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Chọn góc nhìn & Hướng diễn hoạt cho AI */}
      <div className="lw-clip-option-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            📐 Góc nhìn &amp; Hướng diễn hoạt cho AI:
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={walkType === 'in-place'}
              onChange={(e) => setWalkType(e.target.checked ? 'in-place' : 'root-motion')}
            />
            <span>🚶 <strong>Bước đi tại chỗ (In-place)</strong> — giữ nhân vật giữa khung hình</span>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'front', label: '0° Chính diện' },
            { id: 'diagonal-left', label: '45° Chéo Trái' },
            { id: 'diagonal-right', label: '45° Chéo Phải' },
            { id: 'side-left', label: '90° Ngang Trái' },
            { id: 'side-right', label: '90° Ngang Phải' },
            { id: 'back', label: '180° Sau lưng' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn xs ${selectedAngle === item.id ? 'primary' : 'ghost'}`}
              onClick={() => setSelectedAngle(item.id as MotionViewAngle)}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tuỳ chọn đính kèm Gió & Chuẩn hoá nhanh */}
      <div className="lw-clip-option-card">
        <label>
          <input
            type="checkbox"
            checked={includeWind}
            onChange={(e) => setIncludeWind(e.target.checked)}
          />
          <span>
            🌿 Đính kèm <strong>Gió ({windCount} dây)</strong> + 🕸️ <strong>Lưới Mesh chịu tác lực tiếp đất (Soft Mesh)</strong>
          </span>
        </label>
        <button
          type="button"
          className="btn xs ghost"
          onClick={onLoadCurrentToImport}
          title="Chuyển JSON của clip đang mở sang tab Nhập để tự động chuẩn hoá cơ học 2.5D (sửa tay đan chéo, chân chữ X)"
        >
          ✨ Tự chuẩn hoá clip này
        </button>
      </div>

      {/* Toolbar hành động copy/download */}
      <div className="lw-clip-actions-bar">
        <button
          type="button"
          className="btn xs primary lw-clip-prompt-cta"
          onClick={onCopyPrompt}
        >
          <IconSparkles width={13} height={13} />
          <span>Sao chép Prompt chuẩn 2.5D cho AI (ChatGPT/Claude/DeepSeek)</span>
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={onCopyJson}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <IconCopy width={12} height={12} />
          <span>Sao chép mã JSON</span>
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={onDownloadJson}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <IconDownload width={12} height={12} />
          <span>Tải tệp .motion.json</span>
        </button>
      </div>

      <div className="lw-clip-banner">
        💡 <strong>Đã tích hợp Cơ học 2.5D + Phối Cảnh Bước Đi + Lưới Mesh Chịu Lực + Gió:</strong> JSON và Prompt xuất ra đã đính kèm{' '}
        <strong>Quy ước tên xương theo Màn hình</strong>, <strong>Phối cảnh bước đi 2.5D (chân tới chạm sàn thấp hơn, to hơn, zOrder đè chân sau, tay nghịch pha)</strong>, cấu hình <strong>Lưới Mesh (meshDeformation)</strong> và{' '}
        <strong>Gió (wind.plantSpines)</strong> để AI phân tích và tạo chuyển động có chiều sâu chân thực.
      </div>

      {/* Khung Code Terminal xem trước JSON */}
      <div className="lw-clip-terminal">
        <div className="lw-clip-terminal-header">
          <div className="lw-clip-terminal-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="lw-clip-terminal-file">{fileName}</span>
          <div className="lw-clip-terminal-meta">
            <span>{bones.length} xương · {activeTrackCount} track · {windCount} dây gió</span>
            <button
              type="button"
              className="btn xs ghost"
              onClick={onCopyJson}
              title="Sao chép nhanh mã JSON"
              style={{ padding: '2px 7px', height: '22px' }}
            >
              <IconCopy width={11} height={11} />
              <span>Copy</span>
            </button>
          </div>
        </div>
        <textarea
          readOnly
          className="lw-clip-terminal-textarea"
          value={exportedJson}
          aria-label="Mã JSON động tác 2.5D"
        />
      </div>
    </>
  )
}

interface ImportTabProps {
  importText: string
  setImportText: (v: string) => void
  importClipName: string
  setImportClipName: (v: string) => void
  autoFixBiomechanics: boolean
  setAutoFixBiomechanics: (v: boolean) => void
  applyImportedWind: boolean
  setApplyImportedWind: (v: boolean) => void
  parseResult: ClipJsonParseResult | null
  onTriggerFileInput: () => void
  onFileLoaded: (content: string) => void
}

function ImportTabPanel({
  importText,
  setImportText,
  importClipName,
  setImportClipName,
  autoFixBiomechanics,
  setAutoFixBiomechanics,
  applyImportedWind,
  setApplyImportedWind,
  parseResult,
  onTriggerFileInput,
  onFileLoaded
}: ImportTabProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const windSpinesCount = parseResult?.wind?.plantSpines?.length ?? 0
  const windMotionsCount = Object.keys(parseResult?.wind?.layerMotions ?? {}).length

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        onFileLoaded(content)
      }
    }
    reader.readAsText(file)
  }

  return (
    <>
      {/* Vùng Drag & Drop tệp .json */}
      <div
        className={`lw-clip-dropzone${isDragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={onTriggerFileInput}
        title="Bấm hoặc kéo thả tệp .motion.json vào đây"
      >
        <IconUpload width={18} height={18} style={{ color: 'var(--accent-cyan)' }} />
        <div className="lw-clip-dropzone-text">
          <strong>Kéo thả tệp .json vào đây</strong> hoặc bấm để chọn tệp từ máy tính
        </div>
      </div>

      {/* Tuỳ chọn chuẩn hoá tự động */}
      <div className="lw-clip-option-card">
        <label>
          <input
            type="checkbox"
            checked={autoFixBiomechanics}
            onChange={(e) => setAutoFixBiomechanics(e.target.checked)}
          />
          <span>
            ✨ <strong>Tự chuẩn hoá cơ học 2.5D &amp; Lưới Mesh chịu lực</strong> (sửa tay đan chéo, chân chữ X, nén Mesh tiếp đất)
          </span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={applyImportedWind}
            onChange={(e) => setApplyImportedWind(e.target.checked)}
          />
          <span>🌿 Áp dụng dữ liệu Gió (nếu có trong JSON)</span>
        </label>
      </div>

      {/* Terminal dán mã JSON */}
      <div className="lw-clip-terminal">
        <div className="lw-clip-terminal-header">
          <div className="lw-clip-terminal-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="lw-clip-terminal-file">Dán mã JSON từ AI (hỗ trợ cả khối markdown ```json ... ```)</span>
          {importText && (
            <button
              type="button"
              className="btn xs ghost"
              onClick={() => setImportText('')}
              style={{ padding: '2px 7px', height: '22px' }}
            >
              <span>Xoá</span>
            </button>
          )}
        </div>
        <textarea
          className="lw-clip-terminal-textarea"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Dán mã JSON nhận được từ AI vào đây..."
          aria-label="Khung dán mã JSON động tác"
        />
      </div>

      {/* Thẻ Phân Tích Kết Quả Parse */}
      {parseResult && (
        <div className={`lw-clip-result-card ${parseResult.success ? 'success' : 'error'}`}>
          {parseResult.success && parseResult.clip ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  ✓ Tên động tác sẽ lưu:
                </span>
                <input
                  type="text"
                  className="lw-field-input"
                  value={importClipName}
                  onChange={(e) => setImportClipName(e.target.value)}
                  style={{
                    flex: '1 1 200px',
                    height: '28px',
                    fontWeight: 600
                  }}
                />
              </div>
              <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                ⏱️ Thời lượng: <strong>{parseResult.clip.duration.toFixed(2)}s</strong> | FPS:{' '}
                <strong>{parseResult.clip.fps ?? 30}</strong> | Lặp:{' '}
                <strong>{parseResult.clip.loop ? 'Có' : 'Không'}</strong> | Khớp xương:{' '}
                <strong>{Object.keys(parseResult.clip.tracks).length} xương</strong>
                {(windSpinesCount > 0 || windMotionsCount > 0) && (
                  <span>
                    {' '}| 🌿 Gió: <strong>{windSpinesCount} dây xương sống, {windMotionsCount} mảnh</strong>
                  </span>
                )}
              </div>
              {parseResult.fixesApplied && parseResult.fixesApplied.length > 0 && (
                <div className="lw-clip-fixes-box">
                  <strong>✨ Đã tự động chuẩn hoá cơ học 2.5D ({parseResult.fixesApplied.length} mục):</strong>
                  <ul>
                    {parseResult.fixesApplied.map((fix: string, idx: number) => (
                      <li key={idx}>{fix}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parseResult.warnings && (
                <div style={{ color: '#f59e0b', fontWeight: 500 }}>⚠️ {parseResult.warnings.join(' ')}</div>
              )}
            </>
          ) : (
            <div style={{ color: '#ef4444', fontWeight: 600 }}>✕ {parseResult.error}</div>
          )}
        </div>
      )}
    </>
  )
}

export function WorkshopClipJsonModal({
  isOpen,
  onClose,
  clip,
  bones,
  composite,
  onImportClip
}: WorkshopClipJsonModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export')
  const [promptIntent, setPromptIntent] = useState('Nhân vật thực hiện động tác tự nhiên, đúng cơ học 2.5D, có nhịp gió nhẹ')
  const [exportName, setExportName] = useState(clip.name)
  const [selectedAngle, setSelectedAngle] = useState<MotionViewAngle>(clip.viewAngle ?? 'front')
  const [walkType, setWalkType] = useState<'in-place' | 'root-motion'>('in-place')
  const [includeWind, setIncludeWind] = useState(true)
  const [importText, setImportText] = useState('')
  const [importClipName, setImportClipName] = useState('')
  const [autoFixBiomechanics, setAutoFixBiomechanics] = useState(true)
  const [applyImportedWind, setApplyImportedWind] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const windCount = composite?.plantSpines?.length ?? 0

  useEffect(() => {
    if (isOpen) {
      setImportText('')
      const smartName = isGenericClipName(clip.name)
        ? inferDescriptiveClipName(clip.tracks, bones, windCount, promptIntent)
        : clip.name
      setExportName(smartName)
      setSelectedAngle(clip.viewAngle ?? 'front')
      setWalkType('in-place')
    }
  }, [isOpen, clip, bones, windCount])

  const exportedJson = useMemo(() => {
    return exportAnimationClipToJson(clip, bones, true, {
      composite,
      includeWind,
      suggestedName: exportName,
      viewAngle: selectedAngle,
      walkType
    })
  }, [clip, bones, composite, includeWind, exportName, selectedAngle, walkType])

  const aiPrompt = useMemo(() => {
    return generateAiMotionPrompt(clip, bones, promptIntent, {
      composite,
      includeWind,
      suggestedName: exportName,
      viewAngle: selectedAngle,
      walkType
    })
  }, [clip, bones, promptIntent, composite, includeWind, exportName, selectedAngle, walkType])

  const parseResult = useMemo(() => {
    if (!importText.trim()) return null
    return parseAnimationClipFromJson(importText, bones, {
      autoFixBiomechanics,
      composite
    })
  }, [importText, bones, autoFixBiomechanics, composite])

  useEffect(() => {
    if (parseResult?.success && parseResult.clip) {
      setImportClipName(parseResult.clip.name)
    }
  }, [parseResult])

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
      toast('✓ Đã sao chép JSON động tác (kèm quy ước 2.5D & Gió) vào Clipboard!')
    } catch {
      toast('Không thể sao chép tự động, vui lòng chọn văn bản và nhấn Ctrl+C.')
    }
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt)
      toast('✓ Đã sao chép Prompt AI chuẩn cơ học 2.5D vào Clipboard!')
    } catch {
      toast('Không thể sao chép tự động, vui lòng chọn văn bản và nhấn Ctrl+C.')
    }
  }

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([exportedJson], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const baseName = (exportName || clip.name).replace(/[^\w\s\u00C0-\u1EF9-]/gi, '').trim().replace(/\s+/g, '_') || 'clip'
      a.href = url
      a.download = `${baseName}.motion.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast(`✓ Đã tải tệp "${baseName}.motion.json"!`)
    } catch (err) {
      toast(`Lỗi khi tải tệp: ${err instanceof Error ? err.message : String(err)}`)
    }
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
    const finalName = importClipName.trim() || parseResult.clip.name
    const finalClip: AnimationClip = {
      ...parseResult.clip,
      name: finalName
    }
    const windToApply = applyImportedWind ? parseResult.wind : undefined
    const meshToApply = autoFixBiomechanics ? (parseResult.mesh ?? { enabled: true, meshEnvelope: true }) : undefined
    onImportClip(finalClip, mode, windToApply, meshToApply)
    toast(
      mode === 'new'
        ? `✓ Đã tạo động tác "${finalName}" (đã chuẩn hoá 2.5D${windToApply ? ' & Gió' : ''})!`
        : `✓ Đã cập nhật động tác "${finalName}" (đã chuẩn hoá 2.5D${windToApply ? ' & Gió' : ''})!`
    )
    onClose()
  }

  const activeTrackCount = Object.keys(clip.tracks || {}).length

  return (
    <div
      className="lw-clip-json-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="lw-clip-json-modal"
        data-mcp-region="layer_assembly_clip_json"
        data-mcp-dialog
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hiện Đại Chuẩn Studio */}
        <div className="lw-clip-json-header">
          <div className="lw-clip-json-header-main">
            <span className="lw-clip-json-icon-box">
              <IconCode width={16} height={16} />
            </span>
            <div className="lw-clip-json-title-wrap">
              <h3 className="lw-clip-json-title">
                <span>Xuất / Nhập JSON Động Tác 2.5D &amp; Gió</span>
                <span className="lw-json-badge-sparkle">✨</span>
              </h3>
              <div className="lw-clip-json-subtitle">
                <span>Đang chọn: <strong>{clip.name}</strong></span>
                <span className="lw-clip-stat-pill">⏱️ {clip.duration.toFixed(2)}s</span>
                <span className="lw-clip-stat-pill">🦴 {activeTrackCount} xương</span>
                {windCount > 0 && <span className="lw-clip-stat-pill">🌿 {windCount} dây gió</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn xs icon"
            onClick={onClose}
            title="Đóng hộp thoại (Esc)"
            style={{ width: '26px', height: '26px' }}
          >
            <IconX width={13} height={13} />
          </button>
        </div>

        {/* Dải 2 Tab Chuyển Đổi */}
        <div className="lw-clip-json-tabs">
          <button
            type="button"
            className={`lw-clip-json-tab-btn${activeTab === 'export' ? ' active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <IconSparkles width={13} height={13} />
            <span>✨ Xuất JSON &amp; Prompt AI (Chuẩn 2.5D + Mesh + Gió)</span>
          </button>
          <button
            type="button"
            className={`lw-clip-json-tab-btn${activeTab === 'import' ? ' active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            <IconUpload width={13} height={13} />
            <span>📥 Nhập &amp; Chuẩn Hoá JSON (Auto-Fix 2.5D)</span>
          </button>
        </div>

        {/* Nội Dung Cuộn Body */}
        <div className="lw-clip-json-body">
          {activeTab === 'export' ? (
            <ExportTabPanel
              clip={clip}
              bones={bones}
              windCount={windCount}
              exportName={exportName}
              setExportName={setExportName}
              promptIntent={promptIntent}
              setPromptIntent={setPromptIntent}
              selectedAngle={selectedAngle}
              setSelectedAngle={setSelectedAngle}
              walkType={walkType}
              setWalkType={setWalkType}
              includeWind={includeWind}
              setIncludeWind={setIncludeWind}
              exportedJson={exportedJson}
              onCopyPrompt={handleCopyPrompt}
              onCopyJson={handleCopyJson}
              onDownloadJson={handleDownloadJson}
              onLoadCurrentToImport={() => {
                setImportText(exportedJson)
                setActiveTab('import')
              }}
            />
          ) : (
            <ImportTabPanel
              importText={importText}
              setImportText={setImportText}
              importClipName={importClipName}
              setImportClipName={setImportClipName}
              autoFixBiomechanics={autoFixBiomechanics}
              setAutoFixBiomechanics={setAutoFixBiomechanics}
              applyImportedWind={applyImportedWind}
              setApplyImportedWind={setApplyImportedWind}
              parseResult={parseResult}
              onTriggerFileInput={() => fileInputRef.current?.click()}
              onFileLoaded={(content) => {
                setImportText(content)
                setActiveTab('import')
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="lw-clip-json-footer">
          <div className="lw-clip-json-format-badge">
            <span>Format:</span>
            <code>parallax-motion-v2</code>
            <span>· 2.5D Biomechanics + Wind + Soft Mesh</span>
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
                  title="Cập nhật đè vào động tác đang mở (kèm tên mới và chuẩn hoá 2.5D)"
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
