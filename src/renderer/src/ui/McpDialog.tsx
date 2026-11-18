import { useEffect, useState } from 'react'
import type { McpStatus } from '@shared/ipc'
import { useView } from '../store/view'
import { IconPlug, IconRefresh, IconX } from './icons'
import { McpAiGuideCard } from './mcp/McpAiGuideCard'
import { McpIdeAndShellCard } from './mcp/McpIdeAndShellCard'
import { MCP_TOOL_COUNT } from './mcp/aiGuide'

export function McpDialog() {
  const close = () => useView.getState().openDialog(null)
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.mcp) return
    window.api.mcp.status().then(setStatus).catch(() => undefined)
    const off = window.api.mcp.onStatus((s) => setStatus({ ...s }))
    return () => off()
  }, [])

  const handleDisconnectAll = async () => {
    if (!window.api?.mcp) {
      setActionMsg('Lỗi: window.api.mcp không khả dụng.')
      return
    }
    if (typeof window.api.mcp.disconnectAll !== 'function') {
      setActionMsg('⚠️ Cần tắt ứng dụng Electron và mở lại (Restart App) để nạp tính năng ngắt kết nối.')
      return
    }
    try {
      await window.api.mcp.disconnectAll()
      setActionMsg('✓ Đã ngắt toàn bộ kết nối client để giải phóng tài nguyên CPU/RAM.')
    } catch (err) {
      setActionMsg(`Lỗi khi ngắt kết nối: ${String(err)}`)
    }
    setTimeout(() => setActionMsg(null), 4000)
  }

  const handleToggleServer = async () => {
    if (!window.api?.mcp) {
      setActionMsg('Lỗi: window.api.mcp không khả dụng.')
      return
    }
    if (typeof window.api.mcp.toggleListening !== 'function') {
      setActionMsg('⚠️ Cần tắt ứng dụng Electron và mở lại (Restart App) để nạp tính năng bật/tắt MCP Server.')
      return
    }
    try {
      const s = await window.api.mcp.toggleListening()
      setStatus({ ...s })
      setActionMsg(s.listening ? '✓ Đã bật lại MCP Server (127.0.0.1:9877).' : '✓ Đã tạm dừng MCP Server thành công.')
    } catch (err) {
      setActionMsg(`Lỗi khi đổi trạng thái server: ${String(err)}`)
    }
    setTimeout(() => setActionMsg(null), 4000)
  }

  const handleRefreshStatus = () => {
    if (!window.api?.mcp) return
    window.api.mcp
      .status()
      .then((s) => {
        setStatus({ ...s })
        setActionMsg('Đã cập nhật trạng thái mới nhất.')
        setTimeout(() => setActionMsg(null), 2000)
      })
      .catch(() => undefined)
  }

  const serverPath = status?.serverScriptPath || './mcp-server/index.mjs'

  const showMessage = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 4000)
  }

  const isConnected = Boolean(status && status.clients > 0)
  const isListening = Boolean(status && status.listening)
  const isErrMsg = Boolean(actionMsg && (actionMsg.startsWith('⚠️') || actionMsg.startsWith('Lỗi')))

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal wide mcp-modal"
        data-mcp-region="mcp_dialog"
        data-ai-surface="dialog"
        data-ai-surface-label="Cấu hình MCP & AI Agent"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconPlug width={15} height={15} />
            </span>
            <div>
              <h2>Cấu Hình Model Context Protocol (MCP) &amp; AI Agent</h2>
              <p>
                Quản lý kết nối tự động hóa và hướng dẫn tích hợp cho Antigravity, Cursor, Claude Desktop, Cline (PowerShell &amp; CMD)
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm modal-close-btn" aria-label="Đóng hộp thoại MCP" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body mcp-modal-body">
          {/* Status & Resource Control Card */}
          <div className="mcp-status-card" data-mcp-region="mcp_status">
            <div className="mcp-status-top-row">
              <div className="mcp-status-info-row">
                <span className={`mcp-live-dot ${isConnected ? 'connected' : isListening ? 'listening' : 'off'}`} />
                <span className="mcp-status-main-text">
                  {isConnected
                    ? status?.busy
                      ? `AI đang thực thi lệnh: ${status.lastMethod ?? '...'}`
                      : `AI đã kết nối (${status?.clients ?? 0} client) — Đã xong lệnh, đang chờ`
                    : isListening
                      ? `MCP sẵn sàng tại 127.0.0.1:${status?.port ?? 9877}`
                      : 'MCP Server đang tắt (Đã giải phóng socket)'}
                </span>
                <span className="mcp-status-cmd-count">
                  (Lệnh: {status?.commands ?? 0}
                  {status?.lastMethod ? ` · gần nhất: ${status.lastMethod}` : ''})
                </span>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  aria-label="Làm mới trạng thái MCP"
                  onClick={handleRefreshStatus}
                  title="Làm mới trạng thái"
                >
                  <IconRefresh width={12} height={12} />
                </button>
              </div>

              <div className="mcp-status-btn-group">
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={handleDisconnectAll}
                  disabled={!status || status.clients === 0}
                  title="Ngắt kết nối tức thì tất cả AI client để giảm tải CPU và bộ nhớ RAM"
                >
                  Ngắt kết nối ({status?.clients ?? 0})
                </button>
                <button
                  type="button"
                  className={`btn sm ${isListening ? 'warn' : 'success'}`}
                  onClick={handleToggleServer}
                  title={isListening ? 'Tắt server MCP để giải phóng socket TCP' : 'Bật lại server MCP'}
                >
                  {isListening ? '⏸ Tạm dừng Server' : '▶ Bật Server MCP'}
                </button>
              </div>
            </div>

            {actionMsg && (
              <div className={`mcp-action-msg${isErrMsg ? ' is-error' : ''}`}>
                {actionMsg}
              </div>
            )}

            {status?.configPath && (
              <div className="mcp-token-path">
                File xác thực Token: <span>{status.configPath}</span>
              </div>
            )}
          </div>

          <McpIdeAndShellCard serverPath={serverPath} />
          <McpAiGuideCard status={status} onStatus={setStatus} onMessage={showMessage} />
        </div>

        <div className="modal-foot modal-foot-between">
          <span className="modal-foot-meta">
            {MCP_TOOL_COUNT} MCP Tools khả dụng · JSON-RPC qua TCP 127.0.0.1:9877 · Hỗ trợ CLI (<code>pnpm pxs</code>)
          </span>
          <button type="button" className="btn primary" onClick={close}>
            Hoàn tất &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
