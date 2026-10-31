import type { RemoteConnectedDevice, RemoteDeviceKind, RemoteLayoutProfile } from '@shared/ipc'
import {
  IconDeviceAuto,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDevicePhone,
  IconDeviceTablet,
  IconTouchpadRemote
} from './remoteIcons'

interface RemoteConnectedDevicesCardProps {
  devices: RemoteConnectedDevice[]
  listening: boolean
  activeModeUrl: string
  onOpenLocalPreview?: () => void
}

function renderDeviceIcon(kind: RemoteDeviceKind) {
  switch (kind) {
    case 'phone':
      return <IconDevicePhone width={15} height={15} />
    case 'ipad':
    case 'tablet':
      return <IconDeviceTablet width={15} height={15} />
    case 'laptop':
      return <IconDeviceLaptop width={15} height={15} />
    case 'desktop':
      return <IconDeviceDesktop width={15} height={15} />
    default:
      return <IconDeviceAuto width={15} height={15} />
  }
}

function formatLayoutBadge(layout: RemoteLayoutProfile | undefined, kind: RemoteDeviceKind): string {
  if (layout === 'pad') return 'Touchpad 3D'
  if (layout === 'phone') return 'App Điện thoại'
  if (layout === 'tablet') return 'iPad · Tablet'
  if (layout === 'desktop') return 'Laptop · Desktop'
  if (kind === 'phone') return 'Tự động · Mobile App'
  if (kind === 'ipad' || kind === 'tablet') return 'Tự động · Tablet Studio'
  return 'Tự động · Desktop Studio'
}

const MULTI_DEVICE_CAPABILITIES = [
  {
    id: 'phone',
    title: 'Điện thoại (iPhone / Android)',
    desc: 'Hiển thị trọn vẹn Parallax Studio dạng Mobile App (100dvh, thanh Dock dưới, chụm 2 ngón Zoom/Lia, đầy đủ Xưởng Layer 2.5D, Tạo xương, Animate, Gió, Xưởng 3D, Timeline, Workflow, Xuất MP4).',
    icon: <IconDevicePhone width={15} height={15} />
  },
  {
    id: 'tablet',
    title: 'iPad & Máy tính bảng',
    desc: 'Tự bung bố cục Tablet Studio 2 cột + thanh công cụ cảm ứng đa điểm, tối ưu kéo BBox, điều chỉnh khớp xương IK, vẽ lộ trình Camera và chỉnh sửa node Workflow bằng ngón tay hoặc bút cảm ứng.',
    icon: <IconDeviceTablet width={15} height={15} />
  },
  {
    id: 'desktop',
    title: 'Laptop & Máy tính (Mac / Windows)',
    desc: 'Truyền nguyên không gian Desktop Studio 3 cột + Timeline/Workflow qua trình duyệt LAN mà không cần cài đặt, đồng bộ tài nguyên ảnh/âm thanh/3D và Undo/Redo 2 chiều thời gian thực.',
    icon: <IconDeviceLaptop width={15} height={15} />
  },
  {
    id: 'pad',
    title: 'Chế độ phụ trợ Touchpad 3D (/pad)',
    desc: 'Chuyển nhanh bất kỳ lúc nào từ thanh nổi Remote trên điện thoại khi muốn biến màn hình thành bàn rê xoay Camera 3D & đẩy chiều sâu Z.',
    icon: <IconTouchpadRemote width={15} height={15} />
  }
] as const

export function RemoteConnectedDevicesCard({
  devices,
  listening,
  activeModeUrl
}: RemoteConnectedDevicesCardProps) {
  return (
    <div
      className="remote-devices-card"
      data-mcp-region="remote_devices_list"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Danh sách thiết bị đang kết nối trực tiếp */}
      <div
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: '10px 11px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)' }}>
            Thiết bị đang kết nối ({devices.length})
          </span>
          <span
            style={{
              fontSize: '10.5px',
              fontFamily: 'var(--mono)',
              color: listening ? 'var(--accent-cyan)' : 'var(--text-faint)'
            }}
          >
            {listening ? 'Đồng bộ 2 chiều · SSE Realtime' : 'Server tạm dừng'}
          </span>
        </div>

        {devices.length === 0 ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-2)',
              border: '1px dashed var(--line)',
              fontSize: '11px',
              lineHeight: 1.45,
              color: 'var(--text-dim)'
            }}
          >
            Chưa có thiết bị từ xa nào mở phiên làm việc. Hãy dùng <strong style={{ color: 'var(--text)' }}>Điện thoại, iPad, Máy tính bảng</strong> quét mã QR bên trái hoặc mở đường dẫn{' '}
            <code style={{ color: 'var(--accent-cyan)' }}>{activeModeUrl}</code> trên <strong style={{ color: 'var(--text)' }}>Laptop / PC</strong> cùng mạng Wi-Fi / LAN để thao tác toàn bộ ứng dụng.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {devices.map((dev) => (
              <div
                key={dev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-soft)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      background: 'color-mix(in srgb, var(--accent) 18%, var(--bg-3))',
                      color: 'var(--accent-cyan)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {renderDeviceIcon(dev.kind)}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {dev.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                      {dev.ip}
                      {dev.width && dev.height ? ` · ${dev.width}×${dev.height}` : ''}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '3px 7px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'color-mix(in srgb, var(--ok) 16%, var(--bg-1))',
                    color: 'var(--ok)',
                    border: '1px solid color-mix(in srgb, var(--ok) 35%, var(--line-soft))',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  ● {formatLayoutBadge(dev.layoutProfile, dev.kind)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kiến trúc thích ứng đa thiết bị */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)' }}>
          Tự động biến hình giao diện & đồng bộ đầy đủ 100% màn hình theo thiết bị:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          {MULTI_DEVICE_CAPABILITIES.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-1)',
                border: '1px solid var(--line-soft)'
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line-soft)',
                  color: 'var(--accent-cyan)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1
                }}
              >
                {item.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text)' }}>{item.title}</div>
                <div style={{ fontSize: '10.5px', lineHeight: 1.42, color: 'var(--text-dim)', marginTop: 1 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
