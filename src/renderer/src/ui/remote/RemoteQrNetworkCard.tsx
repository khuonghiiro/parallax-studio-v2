import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { RemoteLayoutProfile, RemoteServerStatus } from '@shared/ipc'
import { IconCheck, IconCopy, IconRefresh, IconSmartphone } from '../icons'
import {
  IconDeviceAuto,
  IconDeviceLaptop,
  IconDevicePhone,
  IconDeviceTablet,
  IconTouchpadRemote
} from './remoteIcons'
import { buildQrSvgPath, encodeQrMatrix } from './qrCodeSvg'

interface RemoteQrNetworkCardProps {
  status: RemoteServerStatus
  onToggleServer: () => void
  onRegenerateToken: () => void
  notice: string | null
  onActiveUrlChange?: (url: string) => void
}

function findBestWifiIpIndex(ips: string[]): number {
  const idx = ips.findIndex(
    (ip) => !ip.startsWith('192.168.56.') && !ip.endsWith('.1') && ip !== '127.0.0.1'
  )
  return idx >= 0 ? idx : 0
}

const QR_LAYOUT_OPTIONS: Array<{
  id: RemoteLayoutProfile
  label: string
  hint: string
  icon: ReactNode
}> = [
  {
    id: 'auto',
    label: 'Tự động',
    hint: 'Mặc định: Tự mở Full App dạng Mobile / iPad / Desktop đúng theo thiết bị quét QR',
    icon: <IconDeviceAuto width={12} height={12} />
  },
  {
    id: 'phone',
    label: 'Điện thoại',
    hint: 'Mở toàn bộ Parallax Studio ở chế độ App Điện thoại (100dvh + Dock cảm ứng)',
    icon: <IconDevicePhone width={12} height={12} />
  },
  {
    id: 'tablet',
    label: 'iPad · Tablet',
    hint: 'Mở toàn bộ Parallax Studio ở bố cục iPad & Máy tính bảng 2 cột cảm ứng',
    icon: <IconDeviceTablet width={12} height={12} />
  },
  {
    id: 'desktop',
    label: 'Laptop · PC',
    hint: 'Mở toàn bộ Parallax Studio giao diện Desktop 3 cột đầy đủ',
    icon: <IconDeviceLaptop width={12} height={12} />
  },
  {
    id: 'pad',
    label: 'Touchpad 3D',
    hint: 'Mở nhanh bàn rê Touchpad xoay Camera 3D & đẩy chiều sâu Z (/pad)',
    icon: <IconTouchpadRemote width={12} height={12} />
  }
]

export function RemoteQrNetworkCard({
  status,
  onToggleServer,
  onRegenerateToken,
  notice,
  onActiveUrlChange
}: RemoteQrNetworkCardProps) {
  const [selectedIpIdx, setSelectedIpIdx] = useState(() => findBestWifiIpIndex(status.ips))
  const [protocol, setProtocol] = useState<'https' | 'http'>('http')
  const [qrMode, setQrMode] = useState<RemoteLayoutProfile>('auto')
  const [customIp, setCustomIp] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSelectedIpIdx(findBestWifiIpIndex(status.ips))
  }, [status.ips.join(',')])

  const selectedHost = useMemo(() => {
    const trimmed = customIp.trim()
    if (trimmed) return trimmed
    return status.ips[selectedIpIdx] ?? status.primaryIp ?? '127.0.0.1'
  }, [customIp, selectedIpIdx, status.ips, status.primaryIp])

  const activeUrl = useMemo(() => {
    const base = `${protocol}://${selectedHost}:${status.port}`
    if (qrMode === 'pad') {
      return `${base}/pad?t=${status.token}`
    }
    if (qrMode === 'auto') {
      return `${base}/?t=${status.token}`
    }
    return `${base}/?t=${status.token}&layout=${qrMode}`
  }, [protocol, selectedHost, status.port, status.token, qrMode])

  useEffect(() => {
    onActiveUrlChange?.(activeUrl)
  }, [activeUrl, onActiveUrlChange])

  const qrSvg = useMemo(() => {
    const matrix = encodeQrMatrix(activeUrl)
    return buildQrSvgPath(matrix, 2)
  }, [activeUrl])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = activeUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section
      className="remote-qr-card"
      data-mcp-region="remote_qr_card"
      style={{
        background: 'var(--bg-0)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }}
    >
      {/* Status Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: status.listening ? 'var(--ok)' : 'var(--danger)',
              boxShadow: status.listening ? '0 0 8px var(--ok)' : undefined
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
            {status.listening ? `Studio LAN sẵn sàng (:${status.port})` : 'Server LAN đang tạm dừng'}
          </span>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            background: status.connectedDevices > 0 ? 'color-mix(in srgb, var(--ok) 18%, var(--bg-2))' : 'var(--bg-2)',
            color: status.connectedDevices > 0 ? 'var(--ok)' : 'var(--text-dim)',
            border: '1px solid var(--line-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <IconSmartphone width={12} height={12} />
          {status.connectedDevices > 0
            ? `${status.connectedDevices} thiết bị đang kết nối`
            : 'Chờ thiết bị quét QR'}
        </span>
      </div>

      {/* Multi-Device Layout Mode Picker (1-Click Chip Grid, <= 5 items, no combobox) */}
      <div
        className="remote-mode-picker"
        data-mcp-region="remote_mode_picker"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}
      >
        <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-dim)' }}>
          Chế độ màn hình truyền sang thiết bị từ xa:
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: 3,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--radius)'
          }}
        >
          {QR_LAYOUT_OPTIONS.map((opt) => {
            const active = qrMode === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                className="btn sm ghost"
                onClick={() => setQrMode(opt.id)}
                title={opt.hint}
                aria-pressed={active}
                style={{
                  flex: '1 1 auto',
                  justifyContent: 'center',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '4px 7px',
                  gap: 4,
                  borderRadius: 'var(--radius-sm)',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--on-accent)' : 'var(--text-dim)',
                  borderColor: active ? 'var(--accent)' : 'transparent'
                }}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Protocol Segmented Switch (HTTP Default for Instant Zero-Cert QR Scan vs HTTPS) */}
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
          onClick={() => setProtocol('http')}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            background: protocol === 'http' ? 'var(--accent)' : 'transparent',
            color: protocol === 'http' ? 'var(--on-accent)' : 'var(--text-dim)',
            borderColor: protocol === 'http' ? 'var(--accent)' : 'transparent'
          }}
        >
          🌐 HTTP Nhanh (Khuyên dùng)
        </button>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => setProtocol('https')}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 8px',
            borderRadius: 'var(--radius-sm)',
            background: protocol === 'https' ? 'var(--accent)' : 'transparent',
            color: protocol === 'https' ? 'var(--on-accent)' : 'var(--text-dim)',
            borderColor: protocol === 'https' ? 'var(--accent)' : 'transparent'
          }}
        >
          🔒 HTTPS (Vượt HTTPS-Only)
        </button>
      </div>

      {/* QR SVG Box */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)'
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: 8,
            borderRadius: 'var(--radius)',
            border: '2px solid var(--accent-cyan)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
            width: 164,
            height: 164,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg
            viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
            width="146"
            height="146"
            shapeRendering="crispEdges"
            aria-label="Mã QR kết nối điều khiển đa thiết bị qua Wi-Fi"
          >
            <rect width={qrSvg.viewBoxSize} height={qrSvg.viewBoxSize} fill="#ffffff" />
            <path d={qrSvg.pathData} fill="#0f172a" />
          </svg>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: '10.5px',
            lineHeight: 1.45,
            color: 'var(--text-dim)',
            textAlign: 'left',
            background: 'var(--bg-2)',
            padding: '6px 9px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line-soft)',
            width: '100%'
          }}
        >
          {protocol === 'https' ? (
            <>
              <strong style={{ color: 'var(--accent-cyan)' }}>Mẹo vượt chặn HTTPS-Only:</strong> Khi quét mã{' '}
              <code>https://</code> và trình duyệt báo chứng chỉ mạng nội bộ, bấm{' '}
              <strong style={{ color: 'var(--text)' }}>Nâng cao (Advanced) → Tiếp tục truy cập {selectedHost}</strong>.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--accent-cyan)' }}>Chế độ HTTP Thường:</strong> Quét bằng{' '}
              <strong style={{ color: 'var(--text)' }}>Camera iPhone / iPad / Zalo</strong> hoặc dán URL lên trình duyệt{' '}
              <strong style={{ color: 'var(--text)' }}>Laptop / PC</strong> để mở ngay toàn bộ Studio.
            </>
          )}
        </div>
      </div>

      {/* IP Selector Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Địa chỉ IPv4 mạng LAN / Wi-Fi:</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent-cyan)' }}>Token: {status.token}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {status.ips.map((ip, idx) => {
            const isSel = !customIp.trim() && idx === selectedIpIdx
            return (
              <button
                key={ip}
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setCustomIp('')
                  setSelectedIpIdx(idx)
                }}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '11px',
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSel ? 'var(--accent)' : 'var(--bg-2)',
                  color: isSel ? 'var(--on-accent)' : 'var(--text)',
                  borderColor: isSel ? 'var(--accent)' : 'var(--line-soft)'
                }}
              >
                {ip}
              </button>
            )
          })}
          <input
            type="text"
            value={customIp}
            onChange={(e) => setCustomIp(e.target.value)}
            placeholder="Hoặc nhập IP Wi-Fi khác…"
            style={{
              flex: '1 1 120px',
              minWidth: 110,
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line)',
              background: 'var(--bg-1)',
              color: 'var(--text)',
              fontFamily: 'var(--mono)'
            }}
          />
        </div>
      </div>

      {/* URL & Actions */}
      <div
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius-sm)',
          padding: '7px 9px',
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          color: 'var(--accent-cyan)',
          wordBreak: 'break-all'
        }}
      >
        {activeUrl}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" className="btn sm primary" onClick={handleCopyUrl} style={{ flex: 1 }}>
          {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
          <span>{copied ? 'Đã chép URL' : 'Sao chép Link'}</span>
        </button>
        <button type="button" className="btn sm" onClick={onRegenerateToken} title="Tạo mã QR mới & vô hiệu hoá phiên cũ">
          <IconRefresh width={13} height={13} />
          <span>Đổi mã QR</span>
        </button>
        <button type="button" className="btn sm" onClick={onToggleServer}>
          {status.listening ? '⏸ Tạm dừng' : '▶ Bật lại'}
        </button>
      </div>

      {notice && (
        <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
          {notice}
        </div>
      )}
    </section>
  )
}
