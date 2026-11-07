import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { toast } from '../../actions'
import { IconCode, IconCopy, IconDownload, IconSparkles, IconUpload, IconX } from '../icons'
import {
  exportAnimationClipToJson,
  generateAiMotionPrompt,
  parseAnimationClipFromJson,
  type ClipJsonParseResult,
  type ParsedWindData
} from './workshopClipJson'
import { inferDescriptiveClipName, isGenericClipName } from './workshopClipBiomechanics'

export interface WorkshopClipJsonModalProps {
  isOpen: boolean
  onClose: () => void
  clip: AnimationClip
  bones: LayerBone[]
  composite?: LayerComposite
  onImportClip: (clip: AnimationClip, mode: 'new' | 'replace', wind?: ParsedWindData) => void
}

const QUICK_AI_INTENTS = [
  { label: '👋 Vẫy tay chào', name: 'Vẫy tay chào tươi tắn', intent: 'Nhân vật giơ tay phải vẫy chào thân thiện, đầu nghiêng nhẹ tươi tắn, cơ thể nhún thở tự nhiên, tóc/áo đung đưa theo gió nhẹ' },
  { label: '🎉 Nhún nhảy vui', name: 'Nhún nhảy vươn tay (Jump)', intent: 'Nhân vật hạ gối lấy đà rồi bật nhảy vui mừng, hai tay vươn mở rộng sang hai bên hướng lên trời, tiếp đất đàn hồi mượt mà' },
  { label: '🚶 Bước đi 2.5D', name: 'Bước đi dạo phố (Walk)', intent: 'Nhân vật bước đi nhịp nhàng tự nhiên, tay đánh đối xứng với chân, thân người nhấp nhô nhẹ theo nhịp bước' },
  { label: '🌬️ Đứng thở & Gió', name: 'Đứng thở & Gió thổi nhẹ', intent: 'Nhân vật đứng thở êm ái, lồng ngực nâng hạ nhẹ, đầu nghiêng khẽ và tà áo/mái tóc bay phấp phới theo làn gió' },
  { label: '⚡ Tung chiêu', name: 'Tung chiêu thức 2.5D', intent: 'Nhân vật xoay thân lấy đà, vung tay tung chiêu mạnh mẽ về phía trước kèm độ nảy cơ học sắc nét rồi thu thế' }
] as const

interface ExportTabProps {
  clip: AnimationClip
  bones: LayerBone[]
  windCount: number
  exportName: string
  setExportName: (v: string) => void
  promptIntent: string
  setPromptIntent: (v: string) => void
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
  includeWind,
  setIncludeWind,
  exportedJson,
  onCopyPrompt,
  onCopyJson,
  onDownloadJson,
  onLoadCurrentToImport
}: ExportTabProps) {
  const activeTrackCount = Object.keys(clip.tracks || {}).length
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
            Tên động tác (gắn vào JSON & AI):
          </label>
          <input
            type="text"
            className="lw-field-input"
            style={{
              width: '100%',
              padding: '6px 9px',
              borderRadius: 'var(--radius-sm, 4px)',
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 600
            }}
            value={exportName}
            onChange={(e) => setExportName(e.target.value)}
            placeholder="Nhập tên mô tả động tác..."
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
            Mục tiêu chuyển động (để AI thiết kế đúng cơ học 2.5D):
          </label>
          <input
            type="text"
            className="lw-field-input"
            style={{
              width: '100%',
              padding: '6px 9px',
              borderRadius: 'var(--radius-sm, 4px)',
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              color: 'var(--text)',
              fontSize: '12px'
            }}
            value={promptIntent}
            onChange={(e) => setPromptIntent(e.target.value)}
            placeholder="Ví dụ: Nhân vật vẫy tay chào, nhún nhảy hoặc bước đi..."
          />
        </div>
      </div>

      {/* Gợi ý nhanh ý đồ & tên động tác */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-faint)', marginRight: '2px' }}>Gợi ý nhanh:</span>
        {QUICK_AI_INTENTS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="btn xs ghost"
            onClick={() => {
              setPromptIntent(item.intent)
              setExportName(item.name)
            }}
            style={{ fontSize: '10px', padding: '2px 7px' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tuỳ chọn đính kèm Gió & Chuẩn hoá nhanh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'var(--bg-2)',
          border: '1px solid var(--line-soft)'
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeWind}
            onChange={(e) => setIncludeWind(e.target.checked)}
          />
          <span>
            🌿 Đính kèm cấu hình <strong>Gió &amp; Nhịp thở thực vật</strong> vào JSON/Prompt ({windCount} dây gió)
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <button
          type="button"
          className="btn xs primary"
          onClick={onCopyPrompt}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <IconSparkles width={12} height={12} />
          <span>Sao chép Prompt chuẩn 2.5D cho AI (ChatGPT/Claude)</span>
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={onCopyJson}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <IconCopy width={12} height={12} />
          <span>Sao chép mã JSON</span>
        </button>
        <button
          type="button"
          className="btn xs"
          onClick={onDownloadJson}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <IconDownload width={12} height={12} />
          <span>Tải tệp .motion.json</span>
        </button>
      </div>

      <div
        style={{
          background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
          border: '1px solid color-mix(in srgb, var(--accent) 24%, var(--line))',
          borderRadius: 'var(--radius, 6px)',
          padding: '8px 12px',
          fontSize: '11px',
          lineHeight: 1.45,
          color: 'var(--text-dim)'
        }}
      >
        💡 <strong>Đã nâng cấp quy chuẩn cơ học 2.5D + Gió:</strong> JSON và Prompt xuất ra đã đính kèm{' '}
        <strong>Bảng quy ước dấu góc xoay từng xương</strong> (Tay trái <code>+</code> giơ lên / Tay phải{' '}
        <code>-</code> giơ lên, nhịp nhún đầu gối <code>scaleY</code> góc chính diện) và cấu hình{' '}
        <strong>Gió (wind.plantSpines)</strong> để AI bên ngoài tạo chuyển động chuẩn xác và tự đặt tên động tác.
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)' }}>
            Nội dung JSON ({exportName || clip.name}):
          </label>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
            {bones.length} xương · {activeTrackCount} track hoạt ảnh · {windCount} dây gió
          </span>
        </div>
        <textarea
          readOnly
          value={exportedJson}
          style={{
            width: '100%',
            height: '155px',
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
  onTriggerFileInput
}: ImportTabProps) {
  const windSpinesCount = parseResult?.wind?.plantSpines?.length ?? 0
  const windMotionsCount = Object.keys(parseResult?.wind?.layerMotions ?? {}).length
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>
          Dán chuỗi JSON nhận được từ AI hoặc tệp bên ngoài vào đây:
        </label>
        <button
          type="button"
          className="btn xs"
          onClick={onTriggerFileInput}
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <IconUpload width={11} height={11} />
          <span>Chọn tệp .json</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm, 4px)',
          background: 'var(--bg-2)',
          border: '1px solid var(--line-soft)',
          fontSize: '11px'
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoFixBiomechanics}
            onChange={(e) => setAutoFixBiomechanics(e.target.checked)}
          />
          <span>
            ✨ <strong>Tự động chuẩn hoá cơ học 2.5D</strong> (sửa tay đan chéo bụng, chân chữ X, hông vọt lố)
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={applyImportedWind}
            onChange={(e) => setApplyImportedWind(e.target.checked)}
          />
          <span>🌿 Áp dụng luôn dữ liệu Gió (nếu có trong JSON)</span>
        </label>
      </div>

      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Dán mã JSON (kể cả khối ```json ... ``` từ ChatGPT / Claude) vào đây..."
        style={{
          width: '100%',
          height: '135px',
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
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
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
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    background: 'var(--bg-0)',
                    border: '1px solid var(--line-focus)',
                    color: 'var(--text)',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                />
              </div>
              <div style={{ color: 'var(--text-dim)', lineHeight: 1.5 }}>
                - Thời lượng: <strong>{parseResult.clip.duration.toFixed(2)}s</strong> | FPS:{' '}
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
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-1))',
                    border: '1px solid color-mix(in srgb, var(--accent) 30%, var(--line))',
                    color: 'var(--text)',
                    lineHeight: 1.45
                  }}
                >
                  <strong>✨ Đã tự động chuẩn hoá cơ học 2.5D ({parseResult.fixesApplied.length} mục):</strong>
                  <ul style={{ margin: '3px 0 0 16px', padding: 0 }}>
                    {parseResult.fixesApplied.map((fix: string, idx: number) => (
                      <li key={idx}>{fix}</li>
                    ))}
                  </ul>
                </div>
              )}
              {parseResult.warnings && (
                <div style={{ color: '#f59e0b' }}>⚠️ {parseResult.warnings.join(' ')}</div>
              )}
            </>
          ) : (
            <div style={{ color: '#ef4444', fontWeight: 500 }}>✕ {parseResult.error}</div>
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
    }
  }, [isOpen, clip, bones, windCount])

  const exportedJson = useMemo(() => {
    return exportAnimationClipToJson(clip, bones, true, {
      composite,
      includeWind,
      suggestedName: exportName
    })
  }, [clip, bones, composite, includeWind, exportName])

  const aiPrompt = useMemo(() => {
    return generateAiMotionPrompt(clip, bones, promptIntent, {
      composite,
      includeWind,
      suggestedName: exportName
    })
  }, [clip, bones, promptIntent, composite, includeWind, exportName])

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
    onImportClip(finalClip, mode, windToApply)
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
          width: '680px',
          maxWidth: '95vw',
          maxHeight: '92vh',
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
        <div
          style={{
            padding: '12px 18px',
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
                Xuất / Nhập JSON Động Tác 2.5D &amp; Gió (Chuẩn Hoá AI)
              </h3>
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '11px' }}>
                Đang chọn: <strong>{clip.name}</strong> ({clip.duration.toFixed(2)}s · {activeTrackCount} xương · {windCount} dây gió)
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
            <span>Xuất JSON &amp; Prompt AI Chuẩn 2.5D</span>
          </button>
          <button
            type="button"
            className={`btn xs ${activeTab === 'import' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('import')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <IconUpload width={12} height={12} />
            <span>Nhập &amp; Chuẩn Hoá JSON từ AI / Tệp</span>
          </button>
        </div>

        <div
          style={{
            padding: '14px 18px',
            overflowY: 'auto',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {activeTab === 'export' ? (
            <ExportTabPanel
              clip={clip}
              bones={bones}
              windCount={windCount}
              exportName={exportName}
              setExportName={setExportName}
              promptIntent={promptIntent}
              setPromptIntent={setPromptIntent}
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
            />
          )}
        </div>

        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-2)'
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            Format: <code>parallax-motion-v2</code> (tương thích ngược v1 + hỗ trợ Gió &amp; 2.5D Smart Fix)
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
