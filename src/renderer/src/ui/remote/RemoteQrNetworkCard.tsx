import { useMemo, useState } from 'react'
import type { RemoteServerStatus } from '@shared/ipc'
import { IconCheck, IconCopy, IconRefresh, IconSmartphone } from '../icons'
import { buildQrSvgPath, encodeQrMatrix } from './qrCodeSvg'

interface RemoteQrNetworkCardProps {
  status: RemoteServerStatus
  onToggleServer: () => void
  onRegenerateToken: () => void
  notice: string | null
}

export function RemoteQrNetworkCard({
  status,
  onToggleServer,
  onRegenerateToken,
  notice
}: RemoteQrNetworkCardProps) {
  const [selectedIpIdx, setSelectedIpIdx] = useState(0)
  const [customIp, setCustomIp] = useState('')
  const [copied, setCopied] = useState(false)

  const activeUrl = useMemo(() => {
    const trimmed = customIp.trim()
    if (trimmed) {
      return `http://${trimmed}:${status.port}/?t=${status.token}`
    }
    const candidate = status.urls[selectedIpIdx] ?? status.url
    return candidate || `http://127.0.0.1:${status.port}/?t=${status.token}`
  }, [customIp, selectedIpIdx, status])

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
        gap: 10
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
            {status.listening ? `Wi-Fi Server sẵn sàng (:${status.port})` : 'Server LAN đang tạm dừng'}
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
          {status.connectedDevices > 0 ? `${status.connectedDevices} điện thoại đang kết nối` : 'Chờ điện thoại quét QR'}
        </span>
      </div>

      {/* QR SVG Box */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 10px',
          background: 'var(--bg-1)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)'
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: 10,
            borderRadius: 'var(--radius)',
            border: '2px solid var(--accent-cyan)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
            width: 184,
            height: 184,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg
            viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
            width="164"
            height="164"
            shapeRendering="crispEdges"
            aria-label="Mã QR kết nối điều khiển qua Wi-Fi"
          >
            <rect width={qrSvg.viewBoxSize} height={qrSvg.viewBoxSize} fill="#ffffff" />
            <path d={qrSvg.pathData} fill="#0f172a" />
          </svg>
        </div>
        <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>
          Đưa Camera điện thoại (iOS / Android) hoặc Zalo vào mã QR để mở bộ điều khiển
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
