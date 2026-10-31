import type { RemoteDeviceKind, RemoteLayoutProfile } from '@shared/ipc'

export interface RemoteDeviceClassification {
  kind: RemoteDeviceKind
  label: string
}

/**
 * Phân tích Cookie HTTP thành bảng key-value phục vụ xác thực tài nguyên tĩnh & API trên Safari / Chrome / Zalo.
 */
export function parseRemoteCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

/**
 * Chuẩn hóa cấu hình bố cục giao diện từ query URL hoặc client gửi lên.
 */
export function normalizeLayoutProfile(raw?: string | null): RemoteLayoutProfile {
  if (!raw) return 'auto'
  const v = raw.trim().toLowerCase()
  if (v === 'phone' || v === 'mobile') return 'phone'
  if (v === 'tablet' || v === 'ipad') return 'tablet'
  if (v === 'desktop' || v === 'laptop') return 'desktop'
  if (v === 'pad' || v === 'touchpad') return 'pad'
  return 'auto'
}

/**
 * Nhận diện chính xác loại thiết bị kết nối từ xa (Điện thoại, iPad, Máy tính bảng, Laptop, Desktop)
 * dựa trên User-Agent kết hợp kích thước màn hình thực tế và số điểm chạm (iPadOS 13+ gửi UA Macintosh nhưng có multi-touch).
 */
export function classifyRemoteDevice(
  userAgent = '',
  width?: number,
  height?: number,
  maxTouchPoints?: number
): RemoteDeviceClassification {
  const ua = userAgent || ''
  const w = typeof width === 'number' && width > 0 ? width : 0
  const h = typeof height === 'number' && height > 0 ? height : 0
  const shortSide = w > 0 && h > 0 ? Math.min(w, h) : w
  const longSide = w > 0 && h > 0 ? Math.max(w, h) : w
  const touchPts = typeof maxTouchPoints === 'number' ? maxTouchPoints : 0

  // 1. iPad (bao gồm cả iPadOS chế độ Desktop Safari có Macintosh + maxTouchPoints > 1)
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPts > 1)) {
    return { kind: 'ipad', label: 'iPad (iPadOS)' }
  }

  // 2. iPhone / iPod
  if (/iPhone|iPod/i.test(ua)) {
    return { kind: 'phone', label: 'iPhone (iOS)' }
  }

  // 3. Android: phân biệt Điện thoại (có chữ "Mobile") và Máy tính bảng Android (không có "Mobile" hoặc màn rộng)
  if (/Android/i.test(ua)) {
    const isAndroidPhone = /Mobile/i.test(ua) && (shortSide === 0 || shortSide < 600)
    if (isAndroidPhone) {
      return { kind: 'phone', label: 'Điện thoại Android' }
    }
    return { kind: 'tablet', label: 'Máy tính bảng Android' }
  }

  // 4. Các dòng máy tính bảng chuyên dụng khác (Kindle, Silk, PlayBook, Tablet, Surface cảm ứng cỡ vừa)
  if (/Tablet|PlayBook|Silk|Kindle/i.test(ua)) {
    return { kind: 'tablet', label: 'Máy tính bảng' }
  }

  // 5. Các trình duyệt di động khác (Zalo, Opera Mini, Mobile...)
  if (/Mobile|Zalo|FBAN|FBAV|Line\//i.test(ua)) {
    if (shortSide >= 600) {
      return { kind: 'tablet', label: 'Máy tính bảng' }
    }
    return { kind: 'phone', label: 'Điện thoại di động' }
  }

  // 6. Phân loại theo kích thước viewport thực tế khi client gửi heartbeat
  if (w > 0 && h > 0) {
    if (shortSide <= 540 && longSide <= 980 && touchPts > 0) {
      return { kind: 'phone', label: 'Điện thoại cảm ứng' }
    }
    if (touchPts > 1 && shortSide > 540 && longSide <= 1400) {
      return { kind: 'tablet', label: 'Máy tính bảng cảm ứng' }
    }
    if (w <= 680 && touchPts > 0) {
      return { kind: 'phone', label: 'Điện thoại' }
    }
  }

  // 7. Laptop vs Desktop theo hệ điều hành & độ rộng màn hình
  const osLabel = /Macintosh|Mac OS X/i.test(ua)
    ? 'Mac'
    : /Windows/i.test(ua)
      ? 'Windows'
      : /Linux/i.test(ua)
        ? 'Linux'
        : 'PC'

  if (w > 0 && w <= 1680) {
    return { kind: 'laptop', label: osLabel === 'Mac' ? 'MacBook / Laptop' : `Laptop (${osLabel})` }
  }

  if (w > 1680) {
    return { kind: 'desktop', label: `Desktop (${osLabel})` }
  }

  return { kind: 'laptop', label: osLabel === 'Mac' ? 'MacBook / Mac' : `Máy tính (${osLabel})` }
}
