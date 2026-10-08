import { useMemo, useState } from 'react'
import type { McpDocsLang, McpStatus } from '@shared/ipc'
import { IconCheck, IconCopy } from '../icons'
import { renderAiGuide } from './aiGuide'

interface Props {
  status: McpStatus | null
  onStatus: (s: McpStatus) => void
  onMessage: (msg: string) => void
}

/**
 * Docs-language toggle (ON = English, default) + the AI guide in that language.
 * The choice is stored in mcp.json; running MCP servers re-describe their tools live
 * (tools/list_changed), older clients pick it up after reconnecting.
 */
export function McpAiGuideCard({ status, onStatus, onMessage }: Props) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const lang: McpDocsLang = status?.docsLang === 'vi' ? 'vi' : 'en'
  const guideText = useMemo(() => renderAiGuide(lang), [lang])
  const english = lang === 'en'

  const toggle = async (): Promise<void> => {
    if (typeof window.api?.mcp?.setDocsLang !== 'function') {
      onMessage('⚠️ Cần khởi động lại ứng dụng để nạp tính năng đổi ngôn ngữ tài liệu AI.')
      return
    }
    setBusy(true)
    try {
      const next = await window.api.mcp.setDocsLang(english ? 'vi' : 'en')
      onStatus({ ...next })
      onMessage(
        next.docsLang === 'en'
          ? '✓ AI sẽ nhận tài liệu tiếng Anh (cập nhật trực tiếp cho client đang kết nối).'
          : '✓ AI sẽ nhận tài liệu tiếng Việt (cập nhật trực tiếp cho client đang kết nối).'
      )
    } catch (err) {
      onMessage(`Lỗi khi đổi ngôn ngữ tài liệu: ${String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const copy = (): void => {
    navigator.clipboard.writeText(guideText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="mcp-guide">
      <div className="mcp-guide-lang">
        <div className="mcp-guide-lang-text">
          <b>Tài liệu AI bằng tiếng Anh (khuyến nghị)</b>
          <span>
            Bật: AI đọc mô tả công cụ, tham số và hướng dẫn bằng tiếng Anh — chính xác nhất khi gọi tool. Tắt: dùng bản
            tiếng Việt. Hai bản được đồng bộ 1:1 từ cùng một nguồn.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={english}
          aria-label="Tài liệu AI bằng tiếng Anh"
          className={`switch mcp-guide-switch${english ? ' on' : ''}`}
          disabled={busy}
          onClick={toggle}
        />
        <span className="mcp-guide-badge">{english ? 'EN' : 'VI'}</span>
      </div>

      <div className="mcp-guide-head">
        <span>📖 Hướng dẫn cho AI Agent ({english ? 'English' : 'Tiếng Việt'})</span>
        <button type="button" className="btn sm mcp-guide-copy" onClick={copy} title="Sao chép prompt hướng dẫn AI">
          {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
          <span>{copied ? 'Đã sao chép prompt' : 'Sao chép prompt hướng dẫn AI'}</span>
        </button>
      </div>
      <pre className="mcp-guide-body">{guideText}</pre>
    </section>
  )
}
