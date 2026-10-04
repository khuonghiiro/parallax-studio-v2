import { useEffect, useRef, useState } from 'react'
import {
  addParticleLayer,
  addSolidLayer,
  addTextLayer,
  importImages,
  loadDemo,
  newProject,
  openProject,
  saveProject
} from '../actions'
import type { McpStatus } from '@shared/ipc'
import { useEditor } from '../store/editor'
import {
  IconChevronDown,
  IconExport,
  IconFile,
  IconFolder,
  IconImage,
  IconPlus,
  IconRedo,
  IconSave,
  IconSparkles,
  IconSquare,
  IconText,
  IconUndo,
  IconWand,
  IconPlug
} from './icons'

function Menu({ label, icon, children, id }: { label: string; icon?: React.ReactNode; children: React.ReactNode; id: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button id={id} className={`btn${open ? ' active' : ''}`} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        <IconChevronDown style={{ width: 12, height: 12, opacity: 0.6 }} />
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Shows whether the local MCP bridge is listening and flashes on every AI command. */
function McpChip() {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!window.api?.mcp) return
    let timer: number | undefined
    let lastCount = -1
    const apply = (s: McpStatus): void => {
      setStatus({ ...s })
      if (lastCount >= 0 && s.commands !== lastCount) {
        setFlash(true)
        window.clearTimeout(timer)
        timer = window.setTimeout(() => setFlash(false), 700)
      }
      lastCount = s.commands
    }
    window.api.mcp.status().then(apply).catch(() => undefined)
    const off = window.api.mcp.onStatus(apply)
    return () => {
      off()
      window.clearTimeout(timer)
    }
  }, [])
  if (!status) return null
  const state = status.error ? 'error' : status.clients > 0 ? 'connected' : status.listening ? 'listening' : 'off'
  const label = state === 'connected' ? `AI đã kết nối` : state === 'listening' ? 'MCP sẵn sàng' : state === 'error' ? 'MCP lỗi' : 'MCP tắt'
  const title = [
    status.error ?? `Cổng 127.0.0.1:${status.port} · ${status.clients} client`,
    `Lệnh đã nhận: ${status.commands}${status.lastMethod ? ` · gần nhất: ${status.lastMethod}` : ''}`,
    `Token: ${status.configPath}`
  ].join('\n')
  return (
    <div id="mcp-chip" className={`mcp-chip ${state}${flash ? ' flash' : ''}`} title={title}>
      <IconPlug width={13} height={13} />
      <span className="dot" />
      {label}
      {status.lastMethod && state === 'connected' && <small>{status.lastMethod}</small>}
    </div>
  )
}

export function Toolbar({ onExport }: { onExport: () => void }) {
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const dirty = useEditor((s) => s.dirty)
  const filePath = useEditor((s) => s.filePath)
  const compName = useEditor((s) => s.project.comp.name)
  const { undo, redo } = useEditor.getState()
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : 'Chưa lưu'

  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-logo" />
        <div>
          Parallax Studio
          <small>2.5D motion</small>
        </div>
      </div>

      <Menu id="menu-file" label="File" icon={<IconFile />}>
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
        <div className="menu-label">Mẫu</div>
        <button className="menu-item" onClick={() => loadDemo()}>
          <IconWand width={15} /> Mở cảnh mẫu “Parallax Journey” (3 cảnh)
        </button>
      </Menu>

      <Menu id="menu-add" label="Thêm layer" icon={<IconPlus />}>
        <button id="add-image" className="menu-item" onClick={() => importImages(true)}>
          <IconImage width={15} /> Ảnh (PNG/JPG)… <span className="hint">Ctrl+I</span>
        </button>
        <button id="add-text" className="menu-item" onClick={addTextLayer}>
          <IconText width={15} /> Text <span className="hint">Ctrl+T</span>
        </button>
        <button id="add-solid" className="menu-item" onClick={addSolidLayer}>
          <IconSquare width={15} /> Solid / Gradient nền
        </button>
        <button id="add-particles" className="menu-item" onClick={addParticleLayer}>
          <IconSparkles width={15} /> Particles (bụi, đom đóm, tuyết)
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
      <div className="doc-title">
        {dirty && <span className="dirty" title="Có thay đổi chưa lưu" />}
        <b style={{ color: 'var(--text)' }}>{compName}</b> · {fileName}
      </div>
      <span className="tb-spacer" />

      <McpChip />
      <button id="save" className="btn ghost" onClick={() => saveProject(false)} title="Lưu (Ctrl+S)">
        <IconSave /> Lưu
      </button>
      <button id="export" className="btn primary" onClick={onExport} title="Xuất MP4 (Ctrl+M)">
        <IconExport /> Xuất MP4
      </button>
    </header>
  )
}
