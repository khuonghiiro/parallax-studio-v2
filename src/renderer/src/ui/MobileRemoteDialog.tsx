import { useEffect, useRef, useState } from 'react'
import type { RemoteServerStatus } from '@shared/ipc'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import { buildRemoteStateSnapshot, executeRemoteAction } from '../mcp/commands/remoteCommands'
import {
  IconAim,
  IconCamera,
  IconEye,
  IconEyeOff,
  IconKeyframeDiamond,
  IconLayers,
  IconLock,
  IconPause,
  IconPlay,
  IconQrCode,
  IconRedo,
  IconUndo,
  IconUnlock,
  IconX
} from './icons'
import { RemoteQrNetworkCard } from './remote/RemoteQrNetworkCard'

const FALLBACK_STATUS: RemoteServerStatus = {
  listening: true,
  port: 9878,
  token: 'pxs-wifi-lan',
  ips: ['192.168.1.100', '127.0.0.1'],
  primaryIp: '192.168.1.100',
  urls: ['http://192.168.1.100:9878/?t=pxs-wifi-lan', 'http://127.0.0.1:9878/?t=pxs-wifi-lan'],
  url: 'http://192.168.1.100:9878/?t=pxs-wifi-lan',
  connectedDevices: 0,
  lastActiveAt: null,
  lastAction: null
}

type RemoteTab = 'camera' | 'layer' | 'shots'
type CameraPadMode = 'pan' | 'dolly' | 'orbit'
type LayerPadMode = 'xy' | 'xz' | 'rot' | 'scale'

export function MobileRemoteDialog() {
  const close = () => useView.getState().openDialog(null)

  const [status, setStatus] = useState<RemoteServerStatus>(FALLBACK_STATUS)
  const [activeTab, setActiveTab] = useState<RemoteTab>('camera')
  const [camMode, setCamMode] = useState<CameraPadMode>('pan')
  const [layerMode, setLayerMode] = useState<LayerPadMode>('xy')
  const [sensitivity, setSensitivity] = useState<number>(1)
  const [notice, setNotice] = useState<string | null>(null)

  // Live subscribe to editor state so the dialog touchpad & readouts update at 60fps
  useEditor((s) => s.project)
  useEditor((s) => s.time)
  useEditor((s) => s.playing)
  useEditor((s) => s.selectedShotId)
  useEditor((s) => s.selectedLayerId)

  const snap = buildRemoteStateSnapshot()

  // Touchpad pointer state
  const padRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0
  })
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const api = (window as unknown as { api?: { remote?: {
      status: () => Promise<RemoteServerStatus>
      onStatus: (cb: (s: RemoteServerStatus) => void) => () => void
    } } }).api?.remote

    if (api?.status) {
      api.status().then(setStatus).catch(() => {})
      return api.onStatus(setStatus)
    }

    // Fallback check against localhost:9878 if preload wasn't reloaded yet
    fetch('http://127.0.0.1:9878/api/ping')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setStatus((prev) => ({ ...prev, listening: true, connectedDevices: d.devices ?? 0 }))
        }
      })
      .catch(() => {})
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
    const api = (window as unknown as { api?: { remote?: { toggle: (en: boolean) => Promise<RemoteServerStatus> } } }).api?.remote
    if (api?.toggle) {
      const next = await api.toggle(!status.listening)
      setStatus(next)
    } else {
      setStatus((s) => ({ ...s, listening: !s.listening }))
    }
  }

  const handleRegenerateToken = async () => {
    const api = (window as unknown as { api?: { remote?: { regenerateToken: () => Promise<RemoteServerStatus> } } }).api?.remote
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

  const onPadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    setCursorPos({
      x: Math.max(16, Math.min(rect.width - 16, e.clientX - rect.left)),
      y: Math.max(16, Math.min(rect.height - 16, e.clientY - rect.top))
    })
  }

  const onPadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = (e.clientX - dragRef.current.lastX) * sensitivity
    const dy = (e.clientY - dragRef.current.lastY) * sensitivity
    dragRef.current.lastX = e.clientX
    dragRef.current.lastY = e.clientY

    const rect = e.currentTarget.getBoundingClientRect()
    setCursorPos({
      x: Math.max(16, Math.min(rect.width - 16, e.clientX - rect.left)),
      y: Math.max(16, Math.min(rect.height - 16, e.clientY - rect.top))
    })

    if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) return

    if (activeTab === 'camera') {
      if (camMode === 'pan') {
        execRemoteAction({ action: 'nudge_camera', mode: 'pan', dx: dx * 2.2, dy: -dy * 2.2 })
      } else if (camMode === 'dolly') {
        execRemoteAction({ action: 'nudge_camera', mode: 'dolly', dx: dx * 2.0, dz: dy * 3.2 })
      } else {
        execRemoteAction({ action: 'nudge_camera', mode: 'orbit', dx: dx * 0.35, dy: -dy * 0.35 })
      }
    } else if (activeTab === 'layer') {
      if (layerMode === 'xy') {
        execRemoteAction({ action: 'nudge_layer', dx: dx * 2.0, dy: -dy * 2.0 })
      } else if (layerMode === 'xz') {
        execRemoteAction({ action: 'nudge_layer', dx: dx * 2.0, dz: dy * 3.0 })
      } else if (layerMode === 'rot') {
        execRemoteAction({ action: 'nudge_layer', drx: dy * 0.4, dry: dx * 0.4 })
      } else {
        execRemoteAction({ action: 'nudge_layer', drz: dx * 0.45, ds: -dy * 0.005 })
      }
    }
  }

  const onPadPointerUp = () => {
    dragRef.current.active = false
    setCursorPos(null)
  }

  const activeLayer = snap.layers.find((l) => l.id === snap.selectedLayerId) ?? snap.layers[0] ?? null
  const [camX, camY, camZ] = snap.camera.position
  const [lyrX, lyrY, lyrZ] = activeLayer?.position ?? [0, 0, 0]
  const [lyrRx, lyrRy, lyrRz] = activeLayer?.rotation ?? [0, 0, 0]
  const lyrScalePct = Math.round((activeLayer?.scale?.[0] ?? 1) * 100)
  const lyrOpacityPct = Math.round((activeLayer?.opacity ?? 1) * 100)

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
          maxWidth: 880,
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
                Điều Khiển Qua Điện Thoại (QR Code & Wi-Fi LAN Remote)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                Quét mã QR bằng điện thoại cùng mạng Wi-Fi để điều khiển Touchpad 3D Camera, Layer X/Y/Z và Timeline thời gian thực
              </p>
            </div>
          </div>
          <button type="button" className="btn icon ghost sm" onClick={close} title="Đóng">
            <IconX width={14} height={14} />
          </button>
        </div>

        {/* Body: 2 Columns */}
        <div
          className="modal-body"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 14,
            padding: '14px 16px',
            maxHeight: '76vh',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}
        >
          {/* LEFT COLUMN: QR Code & Network Info */}
          <RemoteQrNetworkCard
            status={status}
            onToggleServer={handleToggleServer}
            onRegenerateToken={handleRegenerateToken}
            notice={notice}
          />

          {/* RIGHT COLUMN: Live Touchpad & 3D Sliders Controller */}
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

            {/* 1-Click Segmented Mode Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                background: 'var(--bg-1)',
                padding: 4,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--line)'
              }}
            >
              {(
                [
                  { id: 'camera', label: 'Camera 3D', icon: <IconCamera width={13} height={13} /> },
                  { id: 'layer', label: `Layer (${snap.layers.length})`, icon: <IconLayers width={13} height={13} /> },
                  { id: 'shots', label: `Cảnh (${snap.shots.length})`, icon: <IconAim width={13} height={13} /> }
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className="btn sm ghost"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'var(--on-accent)' : 'var(--text-dim)',
                      borderColor: active ? 'var(--accent)' : 'transparent',
                      fontWeight: 600
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Sub-mode Segmented Pills for Camera or Layer */}
            {activeTab === 'camera' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {(
                  [
                    { id: 'pan', label: '✥ Lia X / Y' },
                    { id: 'dolly', label: '🚀 Đẩy Sâu X / Z' },
                    { id: 'orbit', label: '🌐 Xoay Quỹ Đạo' }
                  ] as const
                ).map((m) => {
                  const active = camMode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="btn sm ghost"
                      onClick={() => setCamMode(m.id)}
                      style={{
                        justifyContent: 'center',
                        fontSize: '11px',
                        borderRadius: 'var(--radius-sm)',
                        background: active ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-2))' : 'var(--bg-1)',
                        color: active ? 'var(--accent-cyan)' : 'var(--text-dim)',
                        borderColor: active ? 'var(--accent-cyan)' : 'var(--line-soft)'
                      }}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            )}

            {activeTab === 'layer' && (
              <>
                {/* Layer Selector Chips */}
                <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                  {snap.layers.map((l) => {
                    const isSel = l.id === activeLayer?.id
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className="btn sm ghost"
                        onClick={() => execRemoteAction({ action: 'select_layer', layer_id: l.id })}
                        style={{
                          flexShrink: 0,
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: isSel ? 'var(--accent)' : 'var(--bg-1)',
                          color: isSel ? 'var(--on-accent)' : 'var(--text)',
                          borderColor: isSel ? 'var(--accent)' : 'var(--line-soft)'
                        }}
                      >
                        <span>{l.name}</span>
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {(
                    [
                      { id: 'xy', label: '✥ X / Y' },
                      { id: 'xz', label: '📐 X / Z' },
                      { id: 'rot', label: '🔄 Nghiêng' },
                      { id: 'scale', label: '🔍 Scale' }
                    ] as const
                  ).map((m) => {
                    const active = layerMode === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="btn sm ghost"
                        onClick={() => setLayerMode(m.id)}
                        style={{
                          justifyContent: 'center',
                          fontSize: '11px',
                          padding: '4px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: active ? 'color-mix(in srgb, var(--accent) 22%, var(--bg-2))' : 'var(--bg-1)',
                          color: active ? 'var(--accent-cyan)' : 'var(--text-dim)',
                          borderColor: active ? 'var(--accent-cyan)' : 'var(--line-soft)'
                        }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Interactive 3D Touchpad Surface (for Camera & Layer tabs) */}
            {(activeTab === 'camera' || activeTab === 'layer') && (
              <div
                ref={padRef}
                onPointerDown={onPadPointerDown}
                onPointerMove={onPadPointerMove}
                onPointerUp={onPadPointerUp}
                onPointerCancel={onPadPointerUp}
                style={{
                  position: 'relative',
                  height: 148,
                  borderRadius: 'var(--radius)',
                  border: `1.5px solid ${cursorPos ? 'var(--accent-cyan)' : 'var(--line)'}`,
                  background:
                    'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 16%, var(--bg-1)), var(--bg-1) 74%)',
                  touchAction: 'none',
                  userSelect: 'none',
                  cursor: 'grab',
                  overflow: 'hidden'
                }}
              >
                {/* Crosshair axes */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: 1,
                    background: 'var(--line-soft)',
                    pointerEvents: 'none'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '50%',
                    width: 1,
                    background: 'var(--line-soft)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Top Readout */}
                <div
                  style={{
                    position: 'absolute',
                    top: 7,
                    left: 9,
                    right: 9,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--text-dim)',
                    pointerEvents: 'none'
                  }}
                >
                  <span>
                    {activeTab === 'camera'
                      ? `Touchpad Camera (${camMode.toUpperCase()})`
                      : `Touchpad Layer: ${activeLayer?.name ?? '—'}`}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {activeTab === 'camera'
                      ? `X:${Math.round(camX)} Y:${Math.round(camY)} Z:${Math.round(camZ)}`
                      : `X:${Math.round(lyrX)} Y:${Math.round(lyrY)} Z:${Math.round(lyrZ)}`}
                  </span>
                </div>

                {/* Touch Cursor Puck */}
                <div
                  style={{
                    position: 'absolute',
                    left: cursorPos ? cursorPos.x : '50%',
                    top: cursorPos ? cursorPos.y : '50%',
                    width: 28,
                    height: 28,
                    marginLeft: -14,
                    marginTop: -14,
                    borderRadius: '50%',
                    border: '2px solid var(--accent-cyan)',
                    background: 'color-mix(in srgb, var(--accent) 35%, transparent)',
                    boxShadow: '0 0 12px color-mix(in srgb, var(--accent-cyan) 45%, transparent)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Bottom Readout */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 9,
                    right: 9,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    color: 'var(--text-dim)',
                    pointerEvents: 'none'
                  }}
                >
                  <span>Kéo chuột / vuốt cảm ứng để điều khiển 3D</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>
                    {activeTab === 'camera'
                      ? `FOV: ${snap.camera.fov}°`
                      : `Rot: ${Math.round(lyrRx)}°/${Math.round(lyrRy)}°/${Math.round(lyrRz)}° · ${lyrScalePct}%`}
                  </span>
                </div>
              </div>
            )}

            {/* Sensitivity Selector + Sliders */}
            {activeTab === 'camera' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Độ nhạy cảm ứng (Sensitivity):</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0.5, 1, 2, 4].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="btn sm ghost"
                        onClick={() => setSensitivity(s)}
                        style={{
                          padding: '2px 7px',
                          fontSize: '10.5px',
                          fontFamily: 'var(--mono)',
                          borderRadius: 'var(--radius-sm)',
                          background: sensitivity === s ? 'var(--accent)' : 'var(--bg-1)',
                          color: sensitivity === s ? 'var(--on-accent)' : 'var(--text-dim)',
                          borderColor: sensitivity === s ? 'var(--accent)' : 'var(--line-soft)'
                        }}
                      >
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '11px', color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Độ sâu Camera (Trục Z)</span>
                    <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{Math.round(camZ)}</b>
                  </div>
                  <input
                    type="range"
                    min={-3000}
                    max={3000}
                    step={5}
                    value={Math.round(camZ)}
                    onChange={(e) => execRemoteAction({ action: 'set_camera_transform', z: Number(e.target.value) })}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '11px', color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Góc ống kính (FOV °)</span>
                    <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{snap.camera.fov}°</b>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={110}
                    step={1}
                    value={Math.round(snap.camera.fov)}
                    onChange={(e) => execRemoteAction({ action: 'set_camera_transform', fov: Number(e.target.value) })}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => execRemoteAction({ action: 'reset_camera' })}
                  >
                    🎯 Reset Camera 3D
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'layer' && activeLayer && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '11px', color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Độ sâu Layer 2.5D (Trục Z)</span>
                    <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{Math.round(lyrZ)}</b>
                  </div>
                  <input
                    type="range"
                    min={-1500}
                    max={1500}
                    step={5}
                    value={Math.round(lyrZ)}
                    onChange={(e) => execRemoteAction({ action: 'set_layer_transform', z: Number(e.target.value) })}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '11px', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Scale (%)</span>
                      <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{lyrScalePct}%</b>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={300}
                      step={1}
                      value={lyrScalePct}
                      onChange={(e) => {
                        const s = Number(e.target.value) / 100
                        execRemoteAction({ action: 'set_layer_transform', scale: [s, s, 1] })
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '11px', color: 'var(--text-dim)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Opacity (%)</span>
                      <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{lyrOpacityPct}%</b>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={lyrOpacityPct}
                      onChange={(e) =>
                        execRemoteAction({ action: 'set_layer_transform', opacity: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => execRemoteAction({ action: 'toggle_layer_visible' })}
                  >
                    {activeLayer.visible ? <IconEye width={12} height={12} /> : <IconEyeOff width={12} height={12} />}
                    <span>{activeLayer.visible ? 'Đang hiện' : 'Đang ẩn'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => execRemoteAction({ action: 'toggle_layer_lock' })}
                  >
                    {activeLayer.locked ? <IconLock width={12} height={12} /> : <IconUnlock width={12} height={12} />}
                    <span>{activeLayer.locked ? 'Đang khoá' : 'Mở khoá'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => execRemoteAction({ action: 'reset_layer_transform' })}
                  >
                    ↺ Reset Transform
                  </button>
                </div>
              </div>
            )}

            {/* Shots & Timeline Tab */}
            {activeTab === 'shots' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '11px', color: 'var(--text-dim)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kéo thanh thời gian (Timeline Scrub)</span>
                    <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{snap.time.toFixed(2)}s</b>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={snap.comp.duration}
                    step={0.04}
                    value={snap.time}
                    onChange={(e) => execRemoteAction({ action: 'seek', time: Number(e.target.value) })}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {snap.shots.map((sh) => {
                    const active = sh.id === snap.selectedShotId
                    return (
                      <div
                        key={sh.id}
                        style={{
                          background: active ? 'color-mix(in srgb, var(--accent) 16%, var(--bg-1))' : 'var(--bg-1)',
                          border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--line-soft)'}`,
                          borderRadius: 'var(--radius-sm)',
                          padding: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700 }}>
                          <span>{sh.name}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: 'var(--text-dim)' }}>
                            X:{Math.round(sh.position[0])}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className="btn sm"
                            style={{ flex: 1 }}
                            onClick={() => execRemoteAction({ action: 'select_shot', shot_id: sh.id, fly: false })}
                          >
                            Chọn
                          </button>
                          <button
                            type="button"
                            className="btn sm primary"
                            style={{ flex: 1 }}
                            onClick={() => execRemoteAction({ action: 'select_shot', shot_id: sh.id, fly: true })}
                          >
                            ✈ Bay tới
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            Giao thức HTTP + REST JSON Realtime qua mạng Wi-Fi nội bộ (Zero-Install Mobile Web UI) · Hỗ trợ Undo/Redo (Ctrl+Z)
          </span>
          <button type="button" className="btn" onClick={close}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
