import { useEffect, useState } from 'react'
import {
  addGroundLayer,
  addMistLayer,
  addParticleLayer,
  addRainLayer,
  addSolidLayer,
  addTextLayer,
  importAudio,
  importImages,
  loadDemo,
  newProject,
  openProject,
  openProjectJson,
  saveProject,
  saveProjectJson
} from '../actions'
import type { McpStatus } from '@shared/ipc'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import {
  IconExport,
  IconFile,
  IconFolder,
  IconGround,
  IconImage,
  IconMusic,
  IconPlus,
  IconRedo,
  IconSave,
  IconSparkles,
  IconSquare,
  IconText,
  IconUndo,
  IconWand,
  IconSun,
  IconMoon,
  IconSettings,
  IconLayerAssembly
} from './icons'
import { requestOpenLayerAssembly } from './layerAssembly/layerAssemblyBridge'

import { Menu } from './controls'

/** Shows real-time MCP connection lifecycle: listening, AI executing, AI connected (idle/done), and AI disconnected. */
function McpChip() {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeMethod, setActiveMethod] = useState<string | null>(null)
  const [justDisconnected, setJustDisconnected] = useState(false)

  useEffect(() => {
    if (!window.api?.mcp) return
    let busyTimer: number | undefined
    let discTimer: number | undefined
    let idleDisconnectTimer: number | undefined
    let prevClients = -1
    let lastCount = -1

    const resetIdleDisconnect = (clients: number, isBusy: boolean): void => {
      window.clearTimeout(idleDisconnectTimer)
      if (clients > 0 && !isBusy) {
        idleDisconnectTimer = window.setTimeout(() => {
          window.api?.mcp?.disconnectAll?.().catch(() => undefined)
        }, 8000)
      }
    }

    const apply = (s: McpStatus): void => {
      setStatus({ ...s })
      const commandChanged = lastCount >= 0 && s.commands !== lastCount
      if (commandChanged || s.busy) {
        setBusy(true)
        if (s.lastMethod) setActiveMethod(s.lastMethod)
        window.clearTimeout(busyTimer)
        if (!s.busy) {
          busyTimer = window.setTimeout(() => setBusy(false), 750)
        }
      } else if (s.busy === false) {
        window.clearTimeout(busyTimer)
        busyTimer = window.setTimeout(() => setBusy(false), 450)
      }

      if (prevClients > 0 && s.clients === 0) {
        setBusy(false)
        setJustDisconnected(true)
        window.clearTimeout(discTimer)
        discTimer = window.setTimeout(() => setJustDisconnected(false), 4500)
      } else if (s.clients > 0) {
        setJustDisconnected(false)
      }

      prevClients = s.clients
      lastCount = s.commands
      resetIdleDisconnect(s.clients, Boolean(s.busy || commandChanged))
    }

    const onActivity = (e: Event): void => {
      const detail = (e as CustomEvent<{ busy: boolean; method: string }>).detail
      if (!detail) return
      if (detail.busy) {
        setBusy(true)
        setActiveMethod(detail.method)
        window.clearTimeout(busyTimer)
        window.clearTimeout(idleDisconnectTimer)
      } else {
        window.clearTimeout(busyTimer)
        busyTimer = window.setTimeout(() => setBusy(false), 500)
      }
    }

    window.api.mcp.status().then(apply).catch(() => undefined)
    const off = window.api.mcp.onStatus(apply)
    window.addEventListener('pxs:mcp-activity', onActivity)
    return () => {
      off()
      window.removeEventListener('pxs:mcp-activity', onActivity)
      window.clearTimeout(busyTimer)
      window.clearTimeout(discTimer)
      window.clearTimeout(idleDisconnectTimer)
    }
  }, [])

  if (!status) return null

  const isBusy = status.clients > 0 && (busy || Boolean(status.busy))
  const state = status.error
    ? 'error'
    : isBusy
      ? 'connected busy flash'
      : status.clients > 0
        ? 'connected idle'
        : justDisconnected && status.listening
          ? 'disconnected'
          : status.listening
            ? 'listening'
            : 'off'

  const label = status.error
    ? 'MCP lỗi'
    : isBusy
      ? 'AI đang thao tác'
      : status.clients > 0
        ? 'AI đã kết nối (Đã xong)'
        : justDisconnected && status.listening
          ? 'AI đã ngắt kết nối'
          : status.listening
            ? 'MCP sẵn sàng'
            : 'MCP tắt'

  const shownMethod = activeMethod || status.lastMethod
  const title = [
    status.error ?? `Cổng 127.0.0.1:${status.port} · ${status.clients} client kết nối`,
    isBusy
      ? `Trạng thái: Đang thực thi lệnh "${shownMethod ?? '...'}"`
      : status.clients > 0
        ? `Trạng thái: Đã thực thi xong lệnh, đang giữ kết nối chờ (tự ngắt sau 8s nhàn rỗi)`
        : justDisconnected
          ? `Trạng thái: AI vừa hoàn tất phiên và ngắt kết nối`
          : status.listening
            ? `Trạng thái: Đang chờ AI kết nối`
            : `Trạng thái: Đã tắt MCP Server`,
    `Tổng lệnh đã nhận: ${status.commands}${status.lastMethod ? ` · gần nhất: ${status.lastMethod}` : ''}`,
    `Token: ${status.configPath}`
  ].join('\n')

  return (
    <div
      id="mcp-chip"
      className={`mcp-chip ${state}`}
      title={`${title}\n\n👉 Bấm vào đây để mở Cấu hình & Quản lý kết nối MCP`}
      onClick={() => useView.getState().openDialog('mcp')}
    >
      <IconPlug width={13} height={13} />
      <span className="dot" />
      <span className="mcp-chip-label">{label}</span>
      {shownMethod && isBusy && <small>{shownMethod}</small>}
      {status.lastMethod && status.clients > 0 && !isBusy && <small>✓ {status.lastMethod}</small>}
      {status.lastMethod && status.clients === 0 && justDisconnected && <small>✓ {status.lastMethod}</small>}
      {status.clients > 0 && (
        <span
          className="mcp-chip-disconnect"
          title="Ngắt kết nối AI ngay lập tức"
          onClick={(e) => {
            e.stopPropagation()
            window.api?.mcp?.disconnectAll?.().catch(() => undefined)
          }}
        >
          ✕
        </span>
      )}
    </div>
  )
}

export function Toolbar({ onExport }: { onExport: () => void }) {
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const dirty = useEditor((s) => s.dirty)
  const filePath = useEditor((s) => s.filePath)
  const comp = useEditor((s) => s.project.comp)
  const compName = comp.name
  const { undo, redo } = useEditor.getState()
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : 'Chưa lưu'

  const theme = useView((s) => s.theme)

  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-logo" />
        <div className="brand-text">
          Parallax Studio
          <small>2.5D motion</small>
        </div>
      </div>

      <Menu id="menu-file" label="Tệp" icon={<IconFile />}>
        <button className="menu-item" onClick={newProject}>
          <IconFile width={15} /> Dự án mới <span className="hint">Ctrl+N</span>
        </button>
        <button className="menu-item" onClick={openProject}>
          <IconFolder width={15} /> Mở dự án… <span className="hint">Ctrl+O</span>
        </button>
        <button className="menu-item" onClick={() => saveProject(false)}>
          <IconSave width={15} /> Lưu <span className="hint">Ctrl+S</span>
        </button>
        <button className="menu-item" onClick={() => saveProject(true)}>
          <IconSave width={15} /> Lưu thành… <span className="hint">Ctrl+Shift+S</span>
        </button>
        <div className="menu-label">JSON (Dễ chỉnh sửa)</div>
        <button id="import-json" className="menu-item" onClick={openProjectJson}>
          <IconFolder width={15} /> Nhập từ JSON…
        </button>
        <button id="export-json" className="menu-item" onClick={saveProjectJson}>
          <IconSave width={15} /> Xuất ra JSON…
        </button>
        <div className="menu-label">Mẫu dựng sẵn</div>
        <button className="menu-item" onClick={() => loadDemo()}>
          <IconWand width={15} /> Mở cảnh mẫu “Parallax Journey” (4 cảnh)
        </button>
      </Menu>

      <Menu id="menu-add" label="Thêm layer" icon={<IconPlus />}>
        <button id="add-image" className="menu-item" onClick={() => importImages(true)}>
          <IconImage width={15} /> Ảnh (PNG/JPG)… <span className="hint">Ctrl+I</span>
        </button>
        <button id="add-text" className="menu-item" onClick={addTextLayer}>
          <IconText width={15} /> Chữ (Text Layer) <span className="hint">Ctrl+T</span>
        </button>
        <button id="add-solid" className="menu-item" onClick={addSolidLayer}>
          <IconSquare width={15} /> Solid / Gradient nền
        </button>
        <button id="add-ground" className="menu-item" onClick={addGroundLayer}>
          <IconGround width={15} /> Mặt đất 3D / Sàn (Ground Plane)
        </button>
        <button id="add-mist" className="menu-item" onClick={addMistLayer}>
          <IconSparkles width={15} /> Sương mù thực (Ảnh PNG/WebP)
        </button>
        <button id="add-rain" className="menu-item" onClick={addRainLayer}>
          <IconSparkles width={15} /> Mưa rào thực (Ảnh PNG/WebP)
        </button>
        <button id="add-particles" className="menu-item" onClick={addParticleLayer}>
          <IconSparkles width={15} /> Hạt môi trường (Bụi, Đom đóm, Tuyết)
        </button>
        <div className="menu-label">Âm thanh & Lắp ráp</div>
        <button id="add-audio-file" className="menu-item" onClick={() => importAudio()}>
          <IconMusic width={15} /> Nhập âm thanh / Nhạc nền…
        </button>
        <button id="add-assembly-workshop" className="menu-item" onClick={() => requestOpenLayerAssembly()}>
          <IconLayerAssembly width={15} /> Xưởng Lắp Ráp Layer & Rigging 2.5D…
        </button>
      </Menu>

      <span className="tb-sep" />
      <button id="undo" className="btn ghost icon" title="Hoàn tác (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <IconUndo />
      </button>
      <button id="redo" className="btn ghost icon" title="Làm lại (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
        <IconRedo />
      </button>

      <span className="tb-spacer" />
      <div
        className="doc-title"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          useEditor.getState().setInspectorTab('scene')
          useView.getState().setMobileTab('right')
          useView.getState().setTabletTab('right')
        }}
        title={`Composition: ${compName} (${comp.width}×${comp.height} @ ${comp.fps}fps) — Bấm để mở thiết lập Composition & Cảnh`}
      >
        {dirty && <span className="dirty" title="Có thay đổi chưa lưu" />}
        <b style={{ color: 'var(--text)' }}>{compName}</b>
        <span style={{ color: 'var(--accent-cyan)', opacity: 0.85, fontSize: '10.5px', fontFamily: 'var(--mono)' }}>
          {comp.width}×{comp.height} @ {comp.fps}fps
        </span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ color: 'var(--text-dim)' }}>{fileName}</span>
      </div>
      <span className="tb-spacer" />

      <McpChip />
      <button
        id="audio-studio-btn"
        className="tb-btn-icon"
        onClick={() => useView.getState().openAudioDialog('waveform')}
        title="Mở Studio Âm thanh, Sóng âm & Bàn trộn Mixer (Phím tắt: L / LL)"
      >
        <IconMusic width={14} height={14} />
      </button>
      <button
        id="theme-toggle"
        className="tb-btn-icon"
        onClick={() => useView.getState().toggleTheme()}
        title={theme === 'dark' ? 'Chuyển sang giao diện Sáng (Light Mode)' : 'Chuyển sang giao diện Tối (Dark Mode)'}
      >
        {theme === 'dark' ? <IconSun width={14} height={14} /> : <IconMoon width={14} height={14} />}
      </button>
      <button
        id="perf-settings-btn"
        className="tb-btn-icon"
        onClick={() => useView.getState().openDialog('performance')}
        title="Cấu hình Hiệu năng, RAM & VRAM GPU"
      >
        <IconSettings width={14} height={14} />
      </button>
      <button id="save" className="tb-btn-save" onClick={() => saveProject(false)} title="Lưu dự án (Ctrl+S)">
        <IconSave width={14} height={14} /> <span className="tb-btn-text">Lưu</span>
      </button>
      <button id="export" className="btn primary" onClick={onExport} title="Xuất MP4 (Ctrl+M)">
        <IconExport width={14} height={14} /> <span className="tb-btn-text">Xuất </span>MP4
      </button>
    </header>
  )
}

