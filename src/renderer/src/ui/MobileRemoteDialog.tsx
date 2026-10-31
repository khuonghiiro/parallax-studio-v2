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
        role="dialog"
        aria-labelledby="remote-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 920,
          width: '94vw',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconQrCode width={18} height={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <h2 id="remote-dialog-title" style={{ fontSize: '14px', margin: 0 }}>
                Điều Khiển Đa Thiết Bị Qua QR & Wi-Fi LAN (Điện thoại · iPad · Tablet · Laptop · PC)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                Truyền trực tiếp toàn bộ Parallax Studio thích ứng đúng chuẩn App Điện thoại, iPad/Tablet hoặc Desktop qua mạng LAN với đồng bộ 2 chiều thời gian thực
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        {isLegacyMainServer && (
          <div
            role="status"
            style={{
              margin: '10px 16px 0',
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              background: 'color-mix(in srgb, var(--warn) 14%, var(--bg-2))',
              border: '1px solid color-mix(in srgb, var(--warn) 55%, var(--line))',
              color: 'var(--text)',
              fontSize: '11.5px',
              lineHeight: 1.45,
              display: 'flex',
              flexDirection: 'column',
              gap: 3
            }}
          >
            <strong style={{ color: 'var(--warn)', fontSize: '12px' }}>
              ⚡ Cần khởi động lại `pnpm dev` 1 lần để nạp Máy chủ Full App Đa Thiết Bị trên cổng :{status.port}
            </strong>
            <span style={{ color: 'var(--text-dim)' }}>
              Tiến trình nền Electron đang mở từ phiên trước vẫn đang chạy máy chủ Touchpad rút gọn cũ trong bộ nhớ nên điện thoại quét QR chỉ nhận giao diện Touchpad. Hãy nhấn{' '}
              <code style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>Ctrl + C</code> rồi chạy lại{' '}
              <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--mono)' }}>pnpm dev</code> trên terminal — ngay sau đó điện thoại / iPad / Laptop quét QR sẽ nhận toàn bộ giao diện App Mobile / Tablet / Desktop.
            </span>
          </div>
        )}

        {/* Body: 2 Columns */}
        <div
          className="modal-body remote-modal-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 14,
            padding: '14px 16px',
            maxHeight: '78vh',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}
        >
          {/* LEFT COLUMN: QR Code, Layout Mode Picker & Network Info */}
          <RemoteQrNetworkCard
            status={status}
            onToggleServer={handleToggleServer}
            onRegenerateToken={handleRegenerateToken}
            notice={notice}
            onActiveUrlChange={setActiveModeUrl}
          />

          {/* RIGHT COLUMN: Connected Multi-Device Studio Manager & Live Touchpad */}
          <section
            className="remote-touchpad-card"
            data-mcp-region="remote_touchpad_card"
            style={{
              background: 'var(--bg-0)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            {/* Top Transport Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
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
                  className="btn sm"
                  onClick={() =>
                    execRemoteAction({
                      action: 'keyframe',
                      target_kind: activeTab === 'camera' ? 'camera' : 'layer'
                    })
                  }
                  style={{
                    background: 'var(--key)',
                    color: 'var(--on-key)',
                    borderColor: 'var(--key)',
                    fontWeight: 700
                  }}
                  title="Đặt Keyframe tại thời điểm hiện tại"
                >
                  <IconKeyframeDiamond width={12} height={12} />
                  <span>Đặt Key</span>
                </button>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  disabled={!snap.canUndo}
                  onClick={() => execRemoteAction({ action: 'undo' })}
                  title="Hoàn tác (Undo)"
                >
                  <IconUndo width={13} height={13} />
                </button>
                <button
                  type="button"
                  className="btn sm icon ghost"
                  disabled={!snap.canRedo}
                  onClick={() => execRemoteAction({ action: 'redo' })}
                  title="Làm lại (Redo)"
                >
                  <IconRedo width={13} height={13} />
                </button>
              </div>

              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: 'var(--accent-cyan)',
                  background: 'var(--bg-1)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line-soft)'
                }}
              >
                {snap.time.toFixed(2)}s / {snap.comp.duration.toFixed(1)}s
              </span>
            </div>

            {/* 1-Click Right Panel Segmented Switch: Multi-Device Sessions vs Live Touchpad 3D */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 4,
                padding: 3,
                background: 'var(--bg-2)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--radius)'
              }}
            >
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setRightView('devices')}
                style={{
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: rightView === 'devices' ? 'var(--accent)' : 'transparent',
                  color: rightView === 'devices' ? 'var(--on-accent)' : 'var(--text-dim)',
                  borderColor: rightView === 'devices' ? 'var(--accent)' : 'transparent'
                }}
              >
                <IconDeviceAuto width={13} height={13} />
                <span>Thiết bị & Đa màn hình ({devices.length})</span>
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setRightView('touchpad')}
                style={{
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: rightView === 'touchpad' ? 'var(--accent)' : 'transparent',
                  color: rightView === 'touchpad' ? 'var(--on-accent)' : 'var(--text-dim)',
                  borderColor: rightView === 'touchpad' ? 'var(--accent)' : 'transparent'
                }}
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
        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Đồng bộ toàn bộ Studio (SSE + REST + Asset Binary Bridge) qua Wi-Fi LAN · Tự thích ứng Điện thoại, iPad, Tablet, Laptop & PC · Hỗ trợ Undo/Redo (Ctrl+Z)
          </span>
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
