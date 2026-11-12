import { useEffect, useState } from 'react'
import {
  addParticleLayer,
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
  IconAiScan,
  IconAssetManifest,
  IconCode,
  IconExport,
  IconFile,
  IconFolder,
  IconImage,
  IconCube,
  IconLayerAssembly,
  IconLoopAnimate,
  IconMoon,
  IconMusic,
  IconPlug,
  IconPlus,
  IconQrCode,
  IconRedo,
  IconSave,
  IconSettings,
  IconSparkles,
  IconSun,
  IconText,
  IconUndo,
  IconWand
} from './icons'
import { requestOpenLayerAssembly } from './layerAssembly/layerAssemblyBridge'
import { Menu } from './controls'
import { ToolCluster } from './primitives'

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
      data-mcp-region="mcp_chip"
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
    <header className="toolbar" data-mcp-region="toolbar">
      {/* 1. Left Cluster: Brand + File & Layer Menus + Undo/Redo */}
      <div className="tb-left" data-mcp-region="toolbar_left">
        <div
          className="brand tb-brand-compact"
          title="Parallax Studio V2 — Studio dựng video Parallax 2.5D & 3D Camera"
        >
          <span className="brand-logo" />
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

        <Menu id="menu-create" label="Xưởng sáng tạo" icon={<IconSparkles />}>
          <button id="create-photo-editor" className="menu-item" onClick={() => useView.getState().openPhotoEditor()}>
            <IconImage width={15} /> Thêm ảnh (Tách nền & Chỉnh sửa)…
          </button>
          <button id="create-3d-model" className="menu-item" onClick={() => useView.getState().openDialog('create_3d')}>
            <IconCube width={15} /> Tạo 3D (Xưởng mô hình 3D)…
          </button>
          <button id="create-layer-assembly" className="menu-item" onClick={() => requestOpenLayerAssembly()}>
            <IconLayerAssembly width={15} /> Tạo lắp ráp (Xưởng Layer & Rigging 2.5D)…
          </button>
          <button id="create-loop-animator" className="menu-item" onClick={() => useView.getState().openLoopAnimator()}>
            <IconLoopAnimate width={15} /> Tạo loop animate (Xưởng hoạt ảnh lặp)…
          </button>
          <button id="create-audio-studio" className="menu-item" onClick={() => useView.getState().openAudioDialog('mixer')}>
            <IconMusic width={15} /> Thêm nhạc (Xưởng âm thanh & Mixer)…
          </button>
        </Menu>

        <ToolCluster ariaLabel="Hoàn tác và làm lại" className="tb-history-cluster">
          <button
            id="undo"
            type="button"
            className="btn ghost icon sm"
            title="Hoàn tác (Ctrl+Z)"
            aria-label="Hoàn tác"
            disabled={!canUndo}
            onClick={undo}
          >
            <IconUndo width={14} height={14} />
          </button>
          <button
            id="redo"
            type="button"
            className="btn ghost icon sm"
            title="Làm lại (Ctrl+Y)"
            aria-label="Làm lại"
            disabled={!canRedo}
            onClick={redo}
          >
            <IconRedo width={14} height={14} />
          </button>
        </ToolCluster>
      </div>

      {/* 2. Center Composition Pill (min-width: 0; overflow: hidden so it never pushes right CTA off-screen) */}
      <div className="tb-center">
        <button
          type="button"
          className="doc-title"
          data-mcp-region="toolbar_doc"
          onClick={() => {
            useEditor.getState().setInspectorTab('scene')
            useView.getState().setRightCollapsed(false)
            useView.getState().setMobileTab('right')
            useView.getState().setTabletTab('right')
          }}
          title={`Composition: ${compName} (${comp.width}×${comp.height} @ ${comp.fps}fps · ${fileName}) — Bấm để mở thiết lập Dự án`}
        >
          {dirty && <span className="dirty" title="Có thay đổi chưa lưu" />}
          <b className="doc-title-name">{compName}</b>
          <span className="doc-title-spec">
            {comp.width}×{comp.height} · {comp.fps}fps
          </span>
          <span className="doc-title-sep">•</span>
          <span className="doc-title-file">{fileName}</span>
        </button>
      </div>

      {/* 3. Right Cluster: AI MCP + Studio Utilities + Save & Export MP4 */}
      <div className="tb-right" data-mcp-region="toolbar_actions">
        <McpChip />

        <ToolCluster ariaLabel="Tiện ích Studio" className="tb-utility-cluster">
          <button
            id="ai-ui-inspector-btn"
            type="button"
            className="tb-btn-icon ai-inspector-chip"
            aria-label="Soi giao diện cho AI"
            onClick={() => window.dispatchEvent(new CustomEvent('pxs:toggle-ai-inspector'))}
            title="Soi vùng giao diện cho AI (Phím tắt: Win + Alt để khoá & hiện viền, kéo chuột trái để quét khung, hoặc click vào đây)"
          >
            <IconAiScan width={14} height={14} style={{ color: 'var(--accent-cyan)' }} />
          </button>
          <button
            id="ai-code-handoff-btn"
            type="button"
            className="tb-btn-icon ai-code-handoff-chip"
            aria-label="Gói sửa UI (CSS/JSX/JS)"
            onClick={() => window.dispatchEvent(new CustomEvent('pxs:open-ai-code-handoff'))}
            title="Gói sửa UI & Nhập bản sửa AI (Phím tắt: Win + Ctrl để quét xuất gói, hoặc click vào đây để mở hộp thoại nhập/áp dụng bản sửa JSON)"
          >
            <IconCode width={14} height={14} style={{ color: 'var(--key, #f59e0b)' }} />
          </button>
          <button
            id="remote-qr-btn"
            type="button"
            className="tb-btn-icon remote-qr-chip"
            data-mcp-region="remote_chip"
            aria-label="Điều khiển Điện thoại QR"
            onClick={() => useView.getState().openDialog('remote')}
            title="Quét mã QR để điều khiển ứng dụng bằng Điện thoại qua Wi-Fi (Mobile Remote 3D Touchpad)"
          >
            <IconQrCode width={14} height={14} />
          </button>
          <button
            id="audio-studio-btn"
            type="button"
            className="tb-btn-icon"
            aria-label="Phòng thu Âm thanh"
            onClick={() => useView.getState().openAudioDialog('waveform')}
            title="Mở Studio Âm thanh, Sóng âm & Bàn trộn Mixer (Phím tắt: L / LL)"
          >
            <IconMusic width={14} height={14} />
          </button>
          <button
            id="theme-toggle"
            type="button"
            className="tb-btn-icon"
            aria-label={theme === 'dark' ? 'Đổi sang giao diện Sáng' : 'Đổi sang giao diện Tối'}
            onClick={() => useView.getState().toggleTheme()}
            title={theme === 'dark' ? 'Chuyển sang giao diện Sáng (Light Mode)' : 'Chuyển sang giao diện Tối (Dark Mode)'}
          >
            {theme === 'dark' ? <IconSun width={14} height={14} /> : <IconMoon width={14} height={14} />}
          </button>
          <button
            id="manifest-assets-btn"
            type="button"
            className="tb-btn-icon"
            data-mcp-region="manifest_chip"
            aria-label="Quản lý Manifest Tài nguyên & Chủ đề JSON"
            onClick={() => useView.getState().openDialog('manifest')}
            title="Quản lý động Manifest Tài nguyên (assets/manifest.json), Chủ đề các Xưởng & Khôi phục file xoá tạm (_temp_deleted)"
          >
            <IconAssetManifest width={14} height={14} />
          </button>
          <button
            id="perf-settings-btn"
            type="button"
            className="tb-btn-icon"
            aria-label="Hiệu năng & GPU"
            onClick={() => useView.getState().openDialog('performance')}
            title="Cấu hình Hiệu năng, RAM & VRAM GPU"
          >
            <IconSettings width={14} height={14} />
          </button>
        </ToolCluster>

        <button id="save" type="button" className="tb-btn-save" onClick={() => saveProject(false)} title="Lưu dự án (Ctrl+S)">
          <IconSave width={14} height={14} /> <span className="tb-btn-text">Lưu</span>
        </button>
        <button id="export" type="button" className="btn primary tb-btn-export" onClick={onExport} title="Xuất MP4 (Ctrl+M)">
          <IconExport width={14} height={14} /> <span className="tb-btn-text">Xuất </span>MP4
        </button>
      </div>
    </header>
  )
}
