import { useState } from 'react'
import { IconCheck, IconCode, IconCopy } from '../icons'
import { MCP_TOOL_COUNT } from './aiGuide'

type IdeTarget = 'antigravity' | 'cursor' | 'claude'
type ShellTarget = 'node' | 'powershell' | 'cmd'

interface Props {
  serverPath: string
}

function buildMcpServerEntry(serverPath: string, shell: ShellTarget): { command: string; args: string[] } {
  if (shell === 'powershell') {
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `node '${serverPath}'`]
    }
  }
  if (shell === 'cmd') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `node "${serverPath}"`]
    }
  }
  return {
    command: 'node',
    args: [serverPath]
  }
}

const POWERSHELL_CLI_SNIPPET = `# 1. Kiểm tra trạng thái & tra cứu công cụ (PowerShell)
pnpm pxs status
pnpm pxs help add_image_layer

# 2. Gọi tool bằng JSON nháy đơn hoặc Hashtable (PowerShell 5.1 & 7+)
pnpm pxs call set_ui_dialog '{"theme":"dark"}'
pnpm pxs call add_shot '@{name="Cảnh Mở Đầu"; color="#38bdf8"}'

# 3. Gọi bằng cờ --key value (tối ưu cho mọi shell, không cần escape dấu nháy)
pnpm pxs call add_image_layer --file_path D:/assets/sky.png --z 3000 --name "Bầu trời"`

const CMD_CLI_SNIPPET = `REM 1. Kiểm tra trạng thái & tra cứu công cụ (CMD)
pnpm pxs status
pnpm pxs help add_image_layer

REM 2. Gọi tool bằng JSON escape nháy kép (cmd.exe)
pnpm pxs call set_ui_dialog "{\\"theme\\":\\"dark\\"}"
pnpm pxs call add_shot "{\\"name\\":\\"Cảnh Mở Đầu\\",\\"color\\":\\"#38bdf8\\"}"

REM 3. Gọi bằng cờ --key value (tối ưu cho mọi shell, không cần escape dấu nháy)
pnpm pxs call add_image_layer --file_path D:/assets/sky.png --z 3000 --name "Bầu trời"`

export function McpIdeAndShellCard({ serverPath }: Props) {
  const [ideTab, setIdeTab] = useState<IdeTarget>('antigravity')
  const [shellTab, setShellTab] = useState<ShellTarget>('node')
  const [cliShell, setCliShell] = useState<'powershell' | 'cmd'>('powershell')
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const serverEntry = buildMcpServerEntry(serverPath, shellTab)
  const serverJson = JSON.stringify({ mcpServers: { 'parallax-studio': serverEntry } }, null, 2)

  const configs: Record<IdeTarget, { title: string; file: string; note: string }> = {
    antigravity: {
      title: 'Google Antigravity',
      file: '.agents/mcp_config.json',
      note: `Dự án đã có sẵn file này tại thư mục gốc. Antigravity tự động kết nối và nhận ${MCP_TOOL_COUNT} tools ngay khi mở workspace.`
    },
    cursor: {
      title: 'Cursor / Cline / Roo Code',
      file: '.cursor/mcp.json (hoặc Settings > MCP Servers)',
      note: 'Dán vào file .cursor/mcp.json trong workspace hoặc cấu hình toàn cục trong Cursor Settings.'
    },
    claude: {
      title: 'Claude Desktop',
      file: '%APPDATA%\\Claude\\claude_desktop_config.json',
      note: 'Mở ứng dụng Claude Desktop > Settings > Developer > Edit Config và dán cấu hình này vào.'
    }
  }

  const activeCfg = configs[ideTab]
  const activeCliSnippet = cliShell === 'powershell' ? POWERSHELL_CLI_SNIPPET : CMD_CLI_SNIPPET

  return (
    <div
      className="mcp-ide-config"
      data-mcp-region="mcp_config"
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
          <IconCode width={14} height={14} /> Cấu hình MCP Server &amp; Shell (Node / PowerShell / CMD):
        </div>

        {/* IDE Selector Pills */}
        <div style={{ display: 'flex', background: 'var(--bg-1)', borderRadius: 6, padding: 2, border: '1px solid var(--line-soft)', gap: 2 }}>
          {([
            ['antigravity', '🤖 Antigravity'],
            ['cursor', '⚡ Cursor / Cline'],
            ['claude', '🟣 Claude Desktop']
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="btn sm ghost"
              onClick={() => setIdeTab(id)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 4,
                background: ideTab === id ? 'var(--accent)' : 'transparent',
                color: ideTab === id ? 'var(--on-accent)' : 'var(--text-dim)',
                fontWeight: ideTab === id ? 600 : 400
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active IDE + Shell Config Panel */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div
              role="group"
              aria-label="Chọn kiểu khởi chạy Shell MCP"
              style={{ display: 'flex', background: 'var(--bg-0)', borderRadius: 5, padding: 2, border: '1px solid var(--line-soft)', gap: 2 }}
            >
              {([
                ['node', '🟢 Node'],
                ['powershell', '🔵 PowerShell'],
                ['cmd', '⚫ CMD']
              ] as const).map(([sId, sLabel]) => (
                <button
                  key={sId}
                  type="button"
                  className="btn sm ghost"
                  onClick={() => setShellTab(sId)}
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: shellTab === sId ? 'var(--accent)' : 'transparent',
                    color: shellTab === sId ? 'var(--on-accent)' : 'var(--text-dim)',
                    fontWeight: shellTab === sId ? 600 : 400
                  }}
                >
                  {sLabel}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn sm"
              onClick={() => handleCopy(serverJson, `${ideTab}-${shellTab}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontWeight: 600 }}
            >
              {copied === `${ideTab}-${shellTab}` ? (
                <>
                  <IconCheck width={13} height={13} style={{ color: 'var(--ok)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--ok)' }}>Đã sao chép</span>
                </>
              ) : (
                <>
                  <IconCopy width={13} height={13} />
                  <span style={{ fontSize: '11px' }}>Sao chép JSON ({shellTab.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{ fontSize: '10.5px', color: 'var(--text-faint)', lineHeight: 1.4 }}>ℹ️ {activeCfg.note}</div>

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
            maxHeight: 115,
            overflowY: 'auto'
          }}
        >
          {serverJson}
        </pre>
      </div>

      {/* Dual-Shell CLI Controller (PowerShell & CMD) */}
      <div
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <b style={{ fontSize: '11.5px', color: 'var(--text)' }}>
            💻 Lệnh CLI Controller (<code>pnpm pxs</code>) — Tự động tương thích cả PowerShell &amp; CMD:
          </b>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', background: 'var(--bg-0)', borderRadius: 5, padding: 2, border: '1px solid var(--line-soft)', gap: 2 }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setCliShell('powershell')}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: cliShell === 'powershell' ? 'var(--accent)' : 'transparent',
                  color: cliShell === 'powershell' ? 'var(--on-accent)' : 'var(--text-dim)',
                  fontWeight: cliShell === 'powershell' ? 600 : 400
                }}
              >
                🔵 Lệnh PowerShell
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setCliShell('cmd')}
                style={{
                  fontSize: '10.5px',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: cliShell === 'cmd' ? 'var(--accent)' : 'transparent',
                  color: cliShell === 'cmd' ? 'var(--on-accent)' : 'var(--text-dim)',
                  fontWeight: cliShell === 'cmd' ? 600 : 400
                }}
              >
                ⚫ Lệnh CMD
              </button>
            </div>
            <button
              type="button"
              className="btn sm"
              onClick={() => handleCopy(activeCliSnippet, `cli-${cliShell}`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px' }}
            >
              {copied === `cli-${cliShell}` ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
              <span style={{ fontSize: '10.5px' }}>{copied === `cli-${cliShell}` ? 'Đã chép' : 'Sao chép lệnh'}</span>
            </button>
          </div>
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
            wordBreak: 'break-all'
          }}
        >
          {activeCliSnippet}
        </pre>
      </div>
    </div>
  )
}
