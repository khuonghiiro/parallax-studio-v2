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

export function McpDialog() {
  const close = () => useView.getState().openDialog(null)
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.mcp) return
    window.api.mcp.status().then(setStatus).catch(() => undefined)
    const off = window.api.mcp.onStatus((s) => setStatus({ ...s }))
    return () => off()
  }, [])

  const handleDisconnectAll = async () => {
    if (!window.api?.mcp) return
    await window.api.mcp.disconnectAll()
    setActionMsg('Đã ngắt toàn bộ kết nối client để giải phóng tài nguyên CPU/RAM.')
    setTimeout(() => setActionMsg(null), 3000)
  }

  const handleToggleServer = async () => {
    if (!window.api?.mcp) return
    const s = await window.api.mcp.toggleListening()
    setStatus({ ...s })
    setActionMsg(s.listening ? 'Đã bật lại MCP Server.' : 'Đã tạm dừng MCP Server.')
    setTimeout(() => setActionMsg(null), 3000)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Get project root path from current executable or standard location
  const serverPath = 'mcp-server/index.mjs'

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'parallax-studio': {
          command: 'node',
          args: [`${window.location.origin.replace(/^file:\/\/\//, '').replace(/\/[^/]*$/, '')}/mcp-server/index.mjs`]
        }
      }
    },
    null,
    2
  )

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        'parallax-studio': {
          command: 'node',
          args: ['./mcp-server/index.mjs']
        }
      }
    },
    null,
    2
  )

  const aiPromptInstructions = `Bạn đang kết nối với Parallax Studio V2 qua MCP server.
Nguyên lý không gian 2.5D:
- Trục X: Ngang (sang phải là dương)
- Trục Y: Đứng (lên trên là dương)
- Trục Z: Độ sâu (càng xa camera giá trị Z càng lớn):
  + Tiền cảnh (Foreground): Z = -300 đến 0
  + Tiêu điểm (Focus plane): Z = 0
  + Trung cảnh (Midground): Z = 300 đến 800
  + Hậu cảnh (Background): Z = 1000 đến 2500
  + Bầu trời / Vòm xa (Sky): Z = 3000 trở lên

Quy trình dựng video cơ bản:
1. Gọi get_project_info để xem kích thước composition và các cảnh hiện có.
2. Gọi add_shot để thêm phân cảnh mới.
3. Gọi add_image_layer / add_text_layer / add_particles để sắp xếp các layer theo chiều sâu Z.
4. Gọi build_camera_path để tự động sinh đường bay camera mượt mà nối các cảnh.
5. Gọi get_viewport_screenshot (view: "camera" hoặc "3d") để kiểm tra hình ảnh trực quan.
6. Gọi export_video để render ra video MP4 hoàn chỉnh.`

  const isConnected = status && status.clients > 0
  const isListening = status && status.listening

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal wide mcp-modal" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, width: '94vw' }}>
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPlug width={18} height={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h2 style={{ fontSize: '14px', margin: 0 }}>Cấu Hình Model Context Protocol (MCP) & AI Agent</h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                Quản lý kết nối tự động hóa bằng AI và hướng dẫn tích hợp cho các Agent ngoài (Claude, Cursor, Copilot, Antigravity)
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 18px' }}>
          {/* Status & Resource Control Card */}
          <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
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
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleDisconnectAll}
                  disabled={!status || status.clients === 0}
                  title="Ngắt kết nối tức thì tất cả AI client để giảm tải CPU và bộ nhớ RAM"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                >
                  Ngắt kết nối ({status?.clients ?? 0})
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleToggleServer}
                  title={isListening ? 'Tắt server MCP để tiết kiệm tài nguyên' : 'Bật lại server MCP'}
                >
                  {isListening ? 'Tạm dừng Server' : 'Bật Server MCP'}
                </button>
              </div>
            </div>

            {actionMsg && (
              <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--accent-cyan)' }}>
                ✓ {actionMsg}
              </div>
            )}

            {status?.configPath && (
              <div style={{ marginTop: 8, fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                File xác thực Token: <span style={{ color: 'var(--text)' }}>{status.configPath}</span>
              </div>
            )}
          </div>

          {/* Quick Config Snippets */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 6, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconCode width={14} height={14} /> Cấu hình kết nối cho Claude Desktop & Cursor
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <b style={{ fontSize: '11px', color: 'var(--text)' }}>Claude Desktop Config</b>
                  <button
                    type="button"
                    className="btn sm icon ghost"
                    onClick={() => handleCopy(claudeConfig, 'claude')}
                    title="Sao chép JSON"
                  >
                    {copied === 'claude' ? <IconCheck style={{ color: 'var(--ok)' }} /> : <IconCopy />}
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--accent-cyan)', overflowX: 'auto', maxHeight: 110 }}>
                  {claudeConfig}
                </pre>
              </div>

              <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <b style={{ fontSize: '11px', color: 'var(--text)' }}>Cursor / Cline MCP</b>
                  <button
                    type="button"
                    className="btn sm icon ghost"
                    onClick={() => handleCopy(cursorConfig, 'cursor')}
                    title="Sao chép JSON"
                  >
                    {copied === 'cursor' ? <IconCheck style={{ color: 'var(--ok)' }} /> : <IconCopy />}
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--accent-cyan)', overflowX: 'auto', maxHeight: 110 }}>
                  {cursorConfig}
                </pre>
              </div>
            </div>
          </div>

          {/* AI Agent Cheatsheet & Prompt Guide */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text)' }}>
                📖 Hướng dẫn & Quy ước không gian 2.5D cho AI Agent
              </span>
              <button
                type="button"
                className="btn sm"
                onClick={() => handleCopy(aiPromptInstructions, 'prompt')}
                title="Sao chép prompt hướng dẫn AI"
              >
                {copied === 'prompt' ? <><IconCheck style={{ color: 'var(--ok)' }} /> Đã sao chép prompt</> : <><IconCopy /> Sao chép Prompt hướng dẫn AI</>}
              </button>
            </div>
            <div
              style={{
                background: 'var(--bg-0)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                fontSize: '11px',
                lineHeight: 1.5,
                color: 'var(--text-dim)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--mono)'
              }}
            >
              {aiPromptInstructions}
            </div>
          </div>
        </div>

        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            42 MCP Tools khả dụng · Giao thức JSON-RPC qua TCP 127.0.0.1
          </span>
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
