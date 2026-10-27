import { useEffect, useState } from 'react'
import type { McpStatus } from '@shared/ipc'
import { useView } from '../store/view'
import {
  IconPlug,
  IconRefresh,
  IconX
} from './icons'
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

  const serverPath =
    status?.serverScriptPath || 'd:/_DuAn/App_Desktop/parallax-studio-v2/mcp-server/index.mjs'

  const showMessage = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 4000)
  }

  const isConnected = status && status.clients > 0
  const isListening = status && status.listening

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal wide mcp-modal"
        data-mcp-region="mcp_dialog"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 760,
          width: '92vw',
          overflowX: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPlug width={18} height={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h2 style={{ fontSize: '14px', margin: 0 }}>Cấu Hình Model Context Protocol (MCP) &amp; AI Agent</h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                Quản lý kết nối tự động hóa và hướng dẫn tích hợp cho Antigravity, Cursor, Claude Desktop, Cline (PowerShell &amp; CMD)
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div
          className="modal-body"
          style={{
            maxHeight: '74vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '12px 16px',
            boxSizing: 'border-box',
            width: '100%'
          }}
        >
          {/* Status & Resource Control Card */}
          <div
            className="mcp-status-card"
            data-mcp-region="mcp_status"
            style={{
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isConnected ? 'var(--ok)' : isListening ? 'var(--key)' : 'var(--danger)',
                    boxShadow: isConnected ? '0 0 8px var(--ok)' : isListening ? '0 0 6px var(--key)' : undefined
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text)' }}>
                  {isConnected
                    ? status.busy
                      ? `AI đang thực thi lệnh: ${status.lastMethod ?? '...'}`
                      : `AI đã kết nối (${status.clients} client) — Đã xong lệnh, đang chờ (tự ngắt sau 8s nhàn rỗi)`
                    : isListening
                      ? `MCP sẵn sàng tại 127.0.0.1:${status?.port ?? 9877} (Chưa có AI giữ kết nối)`
                      : 'MCP Server đang tắt (Đã giải phóng socket)'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  (Lệnh đã chạy: {status?.commands ?? 0}
                  {status?.lastMethod ? ` · gần nhất: ${status.lastMethod}` : ''})
                </span>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  onClick={handleRefreshStatus}
                  title="Làm mới trạng thái"
                  style={{ padding: '2px 4px' }}
                >
                  <IconRefresh width={12} height={12} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleDisconnectAll}
                  disabled={!status || status.clients === 0}
                  title="Ngắt kết nối tức thì tất cả AI client để giảm tải CPU và bộ nhớ RAM"
                  style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
                >
                  Ngắt kết nối ({status?.clients ?? 0})
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleToggleServer}
                  title={isListening ? 'Tắt server MCP để giải phóng socket TCP' : 'Bật lại server MCP'}
                  style={isListening ? {} : { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }}
                >
                  {isListening ? '⏸ Tạm dừng Server' : '▶ Bật Server MCP'}
                </button>
              </div>
            </div>

            {actionMsg && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: '11px',
                  color: actionMsg.startsWith('⚠️') || actionMsg.startsWith('Lỗi') ? 'var(--danger)' : 'var(--accent-cyan)',
                  fontWeight: 500,
                  wordBreak: 'break-word'
                }}
              >
                {actionMsg}
              </div>
            )}

            {status?.configPath && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: '10.5px',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--mono)',
                  wordBreak: 'break-all'
                }}
              >
                File xác thực Token: <span style={{ color: 'var(--text)' }}>{status.configPath}</span>
              </div>
            )}
          </div>

          {/* Quick Config Tabs + Dual Shell (Node / PowerShell / CMD) */}
          <McpIdeAndShellCard serverPath={serverPath} />

          {/* AI docs language toggle (EN default) + guide in that language */}
          <McpAiGuideCard status={status} onStatus={setStatus} onMessage={showMessage} />
        </div>

        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {MCP_TOOL_COUNT} MCP Tools khả dụng · Giao thức JSON-RPC qua TCP 127.0.0.1:9877 · Hỗ trợ CLI (<code>pnpm pxs</code> / PowerShell &amp; CMD)
          </span>
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
