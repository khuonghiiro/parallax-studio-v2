import { useEffect, useState } from 'react'
import type { McpStatus } from '@shared/ipc'
import { useView } from '../store/view'
import {
  IconCheck,
  IconCode,
  IconCopy,
  IconPlug,
  IconRefresh,
  IconX
} from './icons'
import { McpAiGuideCard } from './mcp/McpAiGuideCard'
import { MCP_TOOL_COUNT } from './mcp/aiGuide'

type IdeTarget = 'antigravity' | 'cursor' | 'claude'

export function McpDialog() {
  const close = () => useView.getState().openDialog(null)
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [ideTab, setIdeTab] = useState<IdeTarget>('antigravity')

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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Absolute path to mcp-server/index.mjs
  const serverPath =
    status?.serverScriptPath || 'd:/_DuAn/App_Desktop/parallax-studio-v2/mcp-server/index.mjs'

  const configs: Record<IdeTarget, { title: string; file: string; json: string; note: string }> = {
    antigravity: {
      title: 'Google Antigravity',
      file: '.agents/mcp_config.json',
      note: `Dự án đã có sẵn file này tại thư mục gốc. Antigravity tự động kết nối và nhận ${MCP_TOOL_COUNT} tools ngay khi mở workspace.`,
      json: JSON.stringify(
        {
          mcpServers: {
            'parallax-studio': {
              command: 'node',
              args: [serverPath]
            }
          }
        },
        null,
        2
      )
    },
    cursor: {
      title: 'Cursor / Cline / Roo Code',
      file: '.cursor/mcp.json (hoặc Settings > MCP Servers)',
      note: 'Dán vào file .cursor/mcp.json trong workspace hoặc cấu hình toàn cục trong Cursor Settings.',
      json: JSON.stringify(
        {
          mcpServers: {
            'parallax-studio': {
              command: 'node',
              args: [serverPath]
            }
          }
        },
        null,
        2
      )
    },
    claude: {
      title: 'Claude Desktop',
      file: '%APPDATA%\\Claude\\claude_desktop_config.json',
      note: 'Mở ứng dụng Claude Desktop > Settings > Developer > Edit Config và dán cấu hình này vào.',
      json: JSON.stringify(
        {
          mcpServers: {
            'parallax-studio': {
              command: 'node',
              args: [serverPath]
            }
          }
        },
        null,
        2
      )
    }
  }

  const showMessage = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 4000)
  }

  const isConnected = status && status.clients > 0
  const isListening = status && status.listening
  const activeCfg = configs[ideTab]

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal wide mcp-modal"
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
              <h2 style={{ fontSize: '14px', margin: 0 }}>Cấu Hình Model Context Protocol (MCP) & AI Agent</h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                Quản lý kết nối tự động hóa và hướng dẫn tích hợp cho Antigravity, Cursor, Claude Desktop, Cline
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
                    ? `Đang có ${status.clients} AI Agent kết nối trực tiếp`
                    : isListening
                      ? `MCP đang lắng nghe tại 127.0.0.1:${status?.port ?? 9877}`
                      : 'MCP Server đang tắt (Đã giải phóng socket)'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                  (Lệnh đã thực thi: {status?.commands ?? 0})
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

          {/* Quick Config Tabs */}
          <div
            style={{
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCode width={14} height={14} /> Cấu hình MCP cho từng Công Cụ AI:
              </div>

              {/* IDE Selector Pills */}
              <div style={{ display: 'flex', background: 'var(--bg-1)', borderRadius: 6, padding: 2, border: '1px solid var(--line-soft)', gap: 2 }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setIdeTab('antigravity')}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: ideTab === 'antigravity' ? 'var(--accent)' : 'transparent',
                    color: ideTab === 'antigravity' ? 'var(--on-accent)' : 'var(--text-dim)',
                    fontWeight: ideTab === 'antigravity' ? 600 : 400
                  }}
                >
                  🤖 Antigravity
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setIdeTab('cursor')}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: ideTab === 'cursor' ? 'var(--accent)' : 'transparent',
                    color: ideTab === 'cursor' ? 'var(--on-accent)' : 'var(--text-dim)',
                    fontWeight: ideTab === 'cursor' ? 600 : 400
                  }}
                >
                  ⚡ Cursor / Cline
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setIdeTab('claude')}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: ideTab === 'claude' ? 'var(--accent)' : 'transparent',
                    color: ideTab === 'claude' ? 'var(--on-accent)' : 'var(--text-dim)',
                    fontWeight: ideTab === 'claude' ? 600 : 400
                  }}
                >
                  🟣 Claude Desktop
                </button>
              </div>
            </div>

            {/* Active Tab Panel */}
            <div
              style={{
                background: 'var(--bg-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--radius)',
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <b style={{ fontSize: '12px', color: 'var(--text)' }}>{activeCfg.title}</b>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 2 }}>
                    Vị trí file: <code style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{activeCfg.file}</code>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn sm"
                  onClick={() => handleCopy(activeCfg.json, ideTab)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    fontWeight: 600
                  }}
                >
                  {copied === ideTab ? (
                    <>
                      <IconCheck width={13} height={13} style={{ color: 'var(--ok)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--ok)' }}>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <IconCopy width={13} height={13} />
                      <span style={{ fontSize: '11px' }}>Sao chép cấu hình {activeCfg.title}</span>
                    </>
                  )}
                </button>
              </div>

              <div style={{ fontSize: '10.5px', color: 'var(--text-faint)', lineHeight: 1.4 }}>
                ℹ️ {activeCfg.note}
              </div>

              <pre
                style={{
                  margin: 0,
                  fontSize: '10px',
                  fontFamily: 'var(--mono)',
                  color: 'var(--text)',
                  background: 'var(--bg-0)',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid var(--line)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  overflowX: 'hidden',
                  maxHeight: 120,
                  overflowY: 'auto'
                }}
              >
                {activeCfg.json}
              </pre>
            </div>
          </div>

          {/* AI docs language toggle (EN default) + guide in that language */}
          <McpAiGuideCard status={status} onStatus={setStatus} onMessage={showMessage} />
        </div>

        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {MCP_TOOL_COUNT} MCP Tools khả dụng · Giao thức JSON-RPC qua TCP 127.0.0.1:9877 · Hỗ trợ CLI Controller (<code>pnpm pxs</code>)
          </span>
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
