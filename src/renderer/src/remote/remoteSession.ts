import type { RemoteDeviceKind, RemoteLayoutProfile } from '@shared/ipc'

export interface RemoteClientBootstrap {
  token: string
  clientId: string
  deviceKind: RemoteDeviceKind
  deviceLabel: string
  layoutProfile: RemoteLayoutProfile
  serverPort: number
}

export type EffectiveFormFactor = 'phone' | 'tablet' | 'desktop'

export interface RemoteClientLiveState {
  connected: boolean
  syncing: boolean
  deviceKind: RemoteDeviceKind
  deviceLabel: string
  layoutProfile: RemoteLayoutProfile
  effectiveLayout: EffectiveFormFactor
  lastSyncAt: number | null
  error: string | null
}

type Listener = (state: RemoteClientLiveState) => void

const LAYOUT_PREF_KEY = 'pxs:remote-layout-profile'

let cachedBootstrap: RemoteClientBootstrap | null | undefined
const listeners = new Set<Listener>()

let liveState: RemoteClientLiveState = {
  connected: false,
  syncing: false,
  deviceKind: 'phone',
  deviceLabel: 'Thiết bị từ xa',
  layoutProfile: 'auto',
  effectiveLayout: 'phone',
  lastSyncAt: null,
  error: null
}

export function getRemoteBootstrap(): RemoteClientBootstrap | null {
  if (cachedBootstrap !== undefined) return cachedBootstrap
  if (typeof window === 'undefined') {
    cachedBootstrap = null
    return null
  }

  const injected = (window as unknown as { __PXS_REMOTE_BOOTSTRAP__?: RemoteClientBootstrap }).__PXS_REMOTE_BOOTSTRAP__
  if (injected && injected.token) {
    cachedBootstrap = injected
    return cachedBootstrap
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('t') || params.get('token')
    const isExplicitRemote = params.get('pxs_remote') === '1' || (Boolean(token) && !(window as unknown as { api?: unknown }).api)
    if (isExplicitRemote && token) {
      cachedBootstrap = {
        token,
        clientId: `web-${Math.random().toString(36).slice(2, 10)}`,
        deviceKind: detectBrowserDeviceKind(),
        deviceLabel: 'Trình duyệt từ xa',
        layoutProfile: (params.get('layout') as RemoteLayoutProfile) || 'auto',
        serverPort: Number(window.location.port) || 9878
      }
      return cachedBootstrap
    }
  } catch {
    /* ignore */
  }

  cachedBootstrap = null
  return null
}

/** Chỉ trả về true khi đang chạy trong trình duyệt thiết bị điều khiển từ xa qua QR / LAN */
export function isRemoteWebClient(): boolean {
  return getRemoteBootstrap() !== null
}

export function detectBrowserDeviceKind(): RemoteDeviceKind {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'laptop'
  const ua = navigator.userAgent || ''
  const tp = navigator.maxTouchPoints || 0
  const w = window.innerWidth || 1280
  const h = window.innerHeight || 800
  const shortSide = Math.min(w, h)

  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && tp > 1)) return 'ipad'
  if (/iPhone|iPod/i.test(ua)) return 'phone'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) && shortSide < 600 ? 'phone' : 'tablet'
  if (/Tablet|PlayBook|Silk|Kindle/i.test(ua)) return 'tablet'
  if (tp > 0 && shortSide <= 540) return 'phone'
  if (tp > 1 && shortSide <= 900 && Math.max(w, h) <= 1400) return 'tablet'
  return w > 1680 ? 'desktop' : 'laptop'
}

export function computeEffectiveLayout(profile: RemoteLayoutProfile, kind: RemoteDeviceKind): EffectiveFormFactor {
  if (profile === 'phone') return 'phone'
  if (profile === 'tablet') return 'tablet'
  if (profile === 'desktop') return 'desktop'

  if (kind === 'phone') return 'phone'
  if (kind === 'ipad' || kind === 'tablet') return 'tablet'

  if (typeof window !== 'undefined') {
    const w = window.innerWidth || 1280
    const h = window.innerHeight || 800
    if (w <= 768 || (h <= 520 && w <= 960)) return 'phone'
    if (w <= 1120) return 'tablet'
  }
  return 'desktop'
}

export function getRemoteLiveState(): RemoteClientLiveState {
  return liveState
}

export function subscribeRemoteLiveState(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function updateRemoteLiveState(patch: Partial<RemoteClientLiveState>): void {
  liveState = { ...liveState, ...patch }
  listeners.forEach((l) => l(liveState))
}

export function initRemoteClientLayout(): RemoteLayoutProfile {
  const boot = getRemoteBootstrap()
  if (!boot || typeof document === 'undefined') return 'auto'

  let profile: RemoteLayoutProfile = boot.layoutProfile || 'auto'
  if (profile === 'auto') {
    try {
      const saved = localStorage.getItem(LAYOUT_PREF_KEY) as RemoteLayoutProfile | null
      if (saved === 'phone' || saved === 'tablet' || saved === 'desktop' || saved === 'auto') {
        profile = saved
      }
    } catch {
      /* ignore */
    }
  }

  const detectedKind = detectBrowserDeviceKind()
  const effectiveKind = boot.deviceKind === 'laptop' && detectedKind === 'ipad' ? 'ipad' : detectedKind
  updateRemoteLiveState({
    deviceKind: effectiveKind,
    deviceLabel: effectiveKind === 'ipad' ? 'iPad (iPadOS)' : boot.deviceLabel
  })
  setRemoteLayoutProfile(profile, false)
  return profile
}

export function setRemoteLayoutProfile(profile: RemoteLayoutProfile, persist = true): void {
  if (typeof document === 'undefined') return
  const kind = liveState.deviceKind || detectBrowserDeviceKind()
  const effective = computeEffectiveLayout(profile, kind)

  document.documentElement.setAttribute('data-remote-client', 'true')
  document.documentElement.setAttribute('data-remote-layout', profile)
  document.documentElement.setAttribute('data-remote-effective', effective)

  if (persist) {
    try {
      localStorage.setItem(LAYOUT_PREF_KEY, profile)
    } catch {
      /* ignore */
    }
  }

  updateRemoteLiveState({ layoutProfile: profile, effectiveLayout: effective })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('resize'))
  }
}

export function buildRemoteApiUrl(pathname: string, extraQuery?: Record<string, string | number | undefined>): string {
  const boot = getRemoteBootstrap()
  const u = new URL(pathname, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:9878')
  if (boot?.token) u.searchParams.set('t', boot.token)
  if (extraQuery) {
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v))
    }
  }
  return u.pathname + u.search
}

export async function remoteFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const boot = getRemoteBootstrap()
  const headers = new Headers(init.headers || {})
  if (boot?.token) headers.set('X-Remote-Token', boot.token)
  if (boot?.clientId) headers.set('X-Remote-Client-Id', boot.clientId)
  return fetch(buildRemoteApiUrl(pathname), { ...init, headers })
}
