import { useEffect, useState } from 'react'
import type { RemoteLayoutProfile } from '@shared/ipc'
import {
  buildRemoteApiUrl,
  getRemoteLiveState,
  isRemoteWebClient,
  setRemoteLayoutProfile,
  subscribeRemoteLiveState,
  type RemoteClientLiveState
} from '../../remote/remoteSession'
import { IconX } from '../icons'
import {
  IconDeviceAuto,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDevicePhone,
  IconDeviceTablet,
  IconFullscreenExpand,
  IconTouchpadRemote
} from './remoteIcons'

const LAYOUT_OPTIONS: { id: RemoteLayoutProfile; label: string; icon: React.ReactNode }[] = [
  { id: 'auto', label: 'Tự động', icon: <IconDeviceAuto size={13} /> },
  { id: 'phone', label: 'Điện thoại', icon: <IconDevicePhone size={13} /> },
  { id: 'tablet', label: 'iPad · Tablet', icon: <IconDeviceTablet size={13} /> },
  { id: 'desktop', label: 'Laptop · PC', icon: <IconDeviceDesktop size={13} /> }
]

export function RemoteClientHud() {
  const [isRemote] = useState(() => isRemoteWebClient())
  const [state, setState] = useState<RemoteClientLiveState>(() => getRemoteLiveState())
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!isRemote) return undefined
    return subscribeRemoteLiveState(setState)
  }, [isRemote])

  if (!isRemote) return null

  const toggleFullscreen = (): void => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined)
    } else {
      document.exitFullscreen?.().catch(() => undefined)
    }
  }

  const deviceIcon =
    state.deviceKind === 'phone' ? (
      <IconDevicePhone size={13} />
    ) : state.deviceKind === 'ipad' || state.deviceKind === 'tablet' ? (
      <IconDeviceTablet size={13} />
    ) : state.deviceKind === 'desktop' ? (
      <IconDeviceDesktop size={13} />
    ) : (
      <IconDeviceLaptop size={13} />
    )

  const effectiveBadge =
    state.effectiveLayout === 'phone'
      ? 'Mobile App'
      : state.effectiveLayout === 'tablet'
        ? 'Tablet UI'
        : 'Desktop UI'

  return (
    <div
      className={`remote-client-hud${expanded ? ' expanded' : ''}`}
      data-mcp-region="remote_client_hud"
    >
      {!expanded ? (
        <button
          type="button"
          className="remote-hud-pill"
          onClick={() => setExpanded(true)}
          title="Cài đặt phiên điều khiển từ xa (Chuyển giao diện Điện thoại / iPad / Desktop, Toàn màn hình)"
        >
          <span
            className={`remote-hud-dot${state.connected ? ' ok' : ' off'}${state.syncing ? ' syncing' : ''}`}
          />
          {deviceIcon}
          <span className="remote-hud-pill-text">{effectiveBadge}</span>
        </button>
      ) : (
        <div className="remote-hud-panel">
          <div className="remote-hud-head">
            <div className="remote-hud-title">
              <span
                className={`remote-hud-dot${state.connected ? ' ok' : ' off'}${state.syncing ? ' syncing' : ''}`}
              />
              <span>
                {state.deviceLabel} · <b>{state.connected ? 'Đồng bộ Realtime' : 'Đang kết nối lại…'}</b>
              </span>
            </div>
            <button
              type="button"
              className="btn icon ghost sm"
              onClick={() => setExpanded(false)}
              title="Thu gọn"
            >
              <IconX size={13} />
            </button>
          </div>

          {state.error && <div className="remote-hud-error">{state.error}</div>}

          <div className="remote-hud-section-label">Chế độ hiển thị giao diện Studio:</div>
          <div className="remote-hud-layout-grid">
            {LAYOUT_OPTIONS.map((opt) => {
              const active = state.layoutProfile === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`remote-hud-layout-btn${active ? ' active' : ''}`}
                  onClick={() => setRemoteLayoutProfile(opt.id)}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>

          <div className="remote-hud-actions">
            <button type="button" className="btn sm ghost" onClick={toggleFullscreen}>
              <IconFullscreenExpand size={13} />
              <span>Toàn màn hình</span>
            </button>
            <a
              className="btn sm ghost"
              href={buildRemoteApiUrl('/pad')}
              style={{ textDecoration: 'none' }}
              title="Chuyển sang bàn rê Touchpad 3D tối giản"
            >
              <IconTouchpadRemote size={13} />
              <span>Touchpad 3D</span>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
