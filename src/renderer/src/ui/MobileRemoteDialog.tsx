import { useEffect, useState } from 'react'
import type { RemoteServerStatus } from '@shared/ipc'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { buildRemoteStateSnapshot, executeRemoteAction } from '../mcp/commands/remoteCommands'
import {
  IconKeyframeDiamond,
  IconPause,
  IconPlay,
  IconQrCode,
  IconRedo,
  IconUndo,
  IconX
} from './icons'
import { IconDeviceAuto, IconTouchpadRemote } from './remote/remoteIcons'
import { RemoteQrNetworkCard } from './remote/RemoteQrNetworkCard'
import { RemoteConnectedDevicesCard } from './remote/RemoteConnectedDevicesCard'
import { RemoteLiveTouchpadPanel } from './remote/RemoteLiveTouchpadPanel'

const FALLBACK_STATUS: RemoteServerStatus = {
  listening: true,
  port: 9878,
  token: 'pxs-wifi-lan',
  ips: ['192.168.1.100', '127.0.0.1'],
  primaryIp: '192.168.1.100',
  urls: ['http://192.168.1.100:9878/?t=pxs-wifi-lan', 'http://127.0.0.1:9878/?t=pxs-wifi-lan'],
  url: 'http://192.168.1.100:9878/?t=pxs-wifi-lan',
  connectedDevices: 0,
  devices: [],
  lastActiveAt: null,
  lastAction: null
}

type RemoteRightView = 'devices' | 'touchpad'
type RemoteTab = 'camera' | 'layer' | 'shots'

export function MobileRemoteDialog() {
  const close = () => useView.getState().openDialog(null)

  const [status, setStatus] = useState<RemoteServerStatus>(FALLBACK_STATUS)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [rightView, setRightView] = useState<RemoteRightView>('devices')
  const [activeTab, setActiveTab] = useState<RemoteTab>('camera')
  const [activeModeUrl, setActiveModeUrl] = useState<string>(FALLBACK_STATUS.url)
  const [notice, setNotice] = useState<string | null>(null)

  // Live subscribe to editor state so the dialog touchpad & readouts update at 60fps
  useEditor((s) => s.project)
  useEditor((s) => s.time)
  useEditor((s) => s.playing)
  useEditor((s) => s.selectedShotId)
  useEditor((s) => s.selectedLayerId)

  const snap = buildRemoteStateSnapshot()
  const rawDevices = (status as unknown as { devices?: RemoteServerStatus['devices'] }).devices
  const devices = Array.isArray(rawDevices) ? rawDevices : []
  const isLegacyMainServer = statusLoaded && status.listening && !Array.isArray(rawDevices)

  useEffect(() => {
    const api = (window as unknown as {
      api?: {
        remote?: {
          status: () => Promise<RemoteServerStatus>
          onStatus: (cb: (s: RemoteServerStatus) => void) => () => void
        }
      }
    }).api?.remote

    if (api?.status) {
      api
        .status()
        .then((s) => {
          setStatus(s)
          setStatusLoaded(true)
        })
        .catch(() => {})
      return api.onStatus((s) => {
        setStatus(s)
        setStatusLoaded(true)
      })
    }
    return undefined
  }, [])

  const execRemoteAction = (payload: Record<string, unknown>) => {
    try {
      executeRemoteAction(payload)
    } catch (err) {
      setNotice((err as Error).message)
    }
  }

  const handleToggleServer = async () => {
    const api = (window as unknown as {
      api?: { remote?: { toggle: (en: boolean) => Promise<RemoteServerStatus> } }
    }).api?.remote
    if (api?.toggle) {
      const next = await api.toggle(!status.listening)
      setStatus(next)
    } else {
      setStatus((s) => ({ ...s, listening: !s.listening }))
    }
  }

  const handleRegenerateToken = async () => {
    const api = (window as unknown as {
      api?: { remote?: { regenerateToken: () => Promise<RemoteServerStatus> } }
    }).api?.remote
    if (api?.regenerateToken) {
      const next = await api.regenerateToken()
      setStatus(next)
      setNotice('Đã tạo mã khóa bảo mật mới cho QR Code')
      setTimeout(() => setNotice(null), 2200)
    } else {
      const rand = Math.random().toString(16).slice(2, 14)
      setStatus((s) => ({
        ...s,
        token: rand,
        urls: s.ips.map((ip) => `http://${ip}:${s.port}/?t=${rand}`),
        url: `http://${s.ips[0] ?? '127.0.0.1'}:${s.port}/?t=${rand}`
      }))
    }
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal wide remote-modal"
        data-mcp-region="remote_dialog"
        data-mcp-dialog
        data-ai-surface="dialog"
        data-ai-surface-label="Điều khiển Đa thiết bị QR & Wi-Fi LAN"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-head modal-head-row">
          <div className="modal-head-title-group">
            <span className="modal-head-badge">
              <IconQrCode width={15} height={15} />
            </span>
            <div>
              <h2 id="remote-dialog-title">
                Điều Khiển Đa Thiết Bị Qua QR &amp; Wi-Fi LAN (Điện thoại · iPad · Tablet · Laptop · PC)
              </h2>
              <p>
                Truyền trực tiếp toàn bộ Parallax Studio thích ứng đúng chuẩn App Điện thoại, iPad/Tablet hoặc Desktop qua mạng LAN với đồng bộ 2 chiều thời gian thực
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm modal-close-btn" aria-label="Đóng hộp thoại QR Remote" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        {isLegacyMainServer && (
          <div role="status" className="remote-legacy-banner">
            <strong>
              ⚡ Cần khởi động lại `pnpm dev` 1 lần để nạp Máy chủ Full App Đa Thiết Bị trên cổng :{status.port}
            </strong>
            <span>
              Tiến trình nền Electron đang mở từ phiên trước vẫn đang chạy máy chủ Touchpad rút gọn cũ trong bộ nhớ. Hãy nhấn{' '}
              <code>Ctrl + C</code> rồi chạy lại <code>pnpm dev</code> trên terminal để nhận toàn bộ giao diện App Mobile / Tablet / Desktop.
            </span>
          </div>
        )}

        {/* Body: 2 Columns */}
        <div className="modal-body remote-modal-body">
          {/* LEFT COLUMN: QR Code, Layout Mode Picker & Network Info */}
          <RemoteQrNetworkCard
            status={status}
            onToggleServer={handleToggleServer}
            onRegenerateToken={handleRegenerateToken}
            notice={notice}
            onActiveUrlChange={setActiveModeUrl}
          />

          {/* RIGHT COLUMN: Connected Multi-Device Studio Manager & Live Touchpad */}
          <section className="remote-touchpad-card" data-mcp-region="remote_touchpad_card">
            {/* Top Transport Bar */}
            <div className="remote-transport-bar">
              <div className="remote-transport-btns">
                <button
                  type="button"
                  className="btn sm primary"
                  onClick={() => execRemoteAction({ action: 'toggle_play' })}
                  title="Phát / Tạm dừng Timeline"
                >
                  {snap.playing ? <IconPause width={12} height={12} /> : <IconPlay width={12} height={12} />}
                  <span>{snap.playing ? 'Dừng' : 'Phát'}</span>
                </button>
                <button
                  type="button"
                  className="btn sm success"
                  onClick={() =>
                    execRemoteAction({
                      action: 'keyframe',
                      target_kind: activeTab === 'camera' ? 'camera' : 'layer'
                    })
                  }
                  title="Đặt Keyframe tại thời điểm hiện tại"
                >
                  <IconKeyframeDiamond width={12} height={12} />
                  <span>Đặt Key</span>
                </button>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  aria-label="Hoàn tác từ xa"
                  disabled={!snap.canUndo}
                  onClick={() => execRemoteAction({ action: 'undo' })}
                  title="Hoàn tác (Undo)"
                >
                  <IconUndo width={13} height={13} />
                </button>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  aria-label="Làm lại từ xa"
                  disabled={!snap.canRedo}
                  onClick={() => execRemoteAction({ action: 'redo' })}
                  title="Làm lại (Redo)"
                >
                  <IconRedo width={13} height={13} />
                </button>
              </div>

              <span className="remote-timecode-pill">
                {snap.time.toFixed(2)}s / {snap.comp.duration.toFixed(1)}s
              </span>
            </div>

            {/* 1-Click Child Sub-Tabs: Multi-Device Sessions vs Live Touchpad 3D */}
            <div className="remote-right-subtabs wf-v2-seg-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={rightView === 'devices'}
                className={`wf-v2-seg-tab${rightView === 'devices' ? ' active' : ''}`}
                onClick={() => setRightView('devices')}
              >
                <IconDeviceAuto width={13} height={13} />
                <span>Thiết bị &amp; Đa màn hình ({devices.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightView === 'touchpad'}
                className={`wf-v2-seg-tab${rightView === 'touchpad' ? ' active' : ''}`}
                onClick={() => setRightView('touchpad')}
              >
                <IconTouchpadRemote width={13} height={13} />
                <span>Bàn rê Touchpad 3D</span>
              </button>
            </div>

            {rightView === 'devices' ? (
              <RemoteConnectedDevicesCard
                devices={devices}
                listening={status.listening}
                activeModeUrl={activeModeUrl}
              />
            ) : (
              <RemoteLiveTouchpadPanel
                snap={snap}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                execRemoteAction={execRemoteAction}
              />
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="modal-foot modal-foot-between">
          <span className="modal-foot-meta">
            Đồng bộ toàn bộ Studio (SSE + REST + Asset Binary Bridge) qua Wi-Fi LAN · Tự thích ứng Điện thoại, iPad, Tablet, Laptop &amp; PC
          </span>
          <button type="button" className="btn primary" onClick={close}>
            Hoàn tất &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
