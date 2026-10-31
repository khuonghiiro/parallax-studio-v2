import type { AssetMeta, Project } from '@shared/types'
import type { RemoteBridgeRequest, RemoteSyncEnvelope } from '@shared/ipc'
import { assetStore } from '../project/assets'
import { useEditor } from '../store/editor'
import { useView } from '../store/view'
import {
  buildRemoteApiUrl,
  computeEffectiveLayout,
  detectBrowserDeviceKind,
  getRemoteBootstrap,
  getRemoteLiveState,
  isRemoteWebClient,
  remoteFetch,
  updateRemoteLiveState
} from './remoteSession'
import { uint8ToBase64 } from './remoteWebApiBridge'

export const SHARED_LIBRARY_KEYS = [
  'pxs.layerComposites',
  'pxs.layerComposites.seeded_version',
  'pxs.layerComposites.deleted',
  'pxs.layerComposites.plantMigration',
  'parallax_models_3d_v2',
  'parallax_hidden_models_3d_v2',
  'pxs.customPublicAssets',
  'pxs.hiddenPublicAssets'
] as const

const REMOTE_UNDO_MERGE_MS = 650

export function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function readSharedLibraries(): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (typeof localStorage === 'undefined') return out
  for (const key of SHARED_LIBRARY_KEYS) {
    try {
      out[key] = localStorage.getItem(key)
    } catch {
      out[key] = null
    }
  }
  return out
}

export function applySharedLibraries(libs?: Record<string, string | null>): void {
  if (!libs || typeof localStorage === 'undefined') return
  let compositesChanged = false
  let modelsChanged = false
  let publicChanged = false

  for (const key of SHARED_LIBRARY_KEYS) {
    if (!(key in libs)) continue
    const incoming = libs[key]
    const current = localStorage.getItem(key)
    if (incoming === current) continue

    try {
      if (incoming === null || incoming === undefined) localStorage.removeItem(key)
      else localStorage.setItem(key, incoming)
    } catch {
      continue
    }

    if (key.startsWith('pxs.layerComposites')) compositesChanged = true
    else if (key.includes('models_3d')) modelsChanged = true
    else if (key.includes('PublicAssets')) publicChanged = true
  }

  if (typeof window !== 'undefined') {
    if (compositesChanged) window.dispatchEvent(new CustomEvent('layerComposites:changed'))
    if (modelsChanged) window.dispatchEvent(new CustomEvent('models3d:changed'))
    if (publicChanged) window.dispatchEvent(new CustomEvent('publicAssets:changed'))
  }
}

let applyingRemoteDepth = 0
let lastRemoteUndoAt = 0
let lastRemoteUndoClient = ''

export function isApplyingRemoteSync(): boolean {
  return applyingRemoteDepth > 0
}

export function applySyncEnvelopeToStores(
  env: RemoteSyncEnvelope,
  opts?: { initialBootstrap?: boolean }
): void {
  applyingRemoteDepth++
  try {
    if (env.libraries) {
      applySharedLibraries(env.libraries)
    }

    if (env.theme === 'dark' || env.theme === 'light') {
      if (useView.getState().theme !== env.theme) {
        useView.getState().set({ theme: env.theme })
      }
    }

    const incomingProj = env.project as Project | undefined
    if (incomingProj && typeof incomingProj === 'object' && Array.isArray(incomingProj.layers)) {
      if (opts?.initialBootstrap) {
        useEditor.getState().loadProject(incomingProj, env.filePath ?? null)
      } else {
        const now = performance.now()
        const merge =
          lastRemoteUndoClient === env.clientId && now - lastRemoteUndoAt < REMOTE_UNDO_MERGE_MS
        lastRemoteUndoClient = env.clientId
        lastRemoteUndoAt = now

        useEditor.setState((s) => ({
          project: incomingProj,
          past: merge ? s.past : [...s.past.slice(-199), s.project],
          future: [],
          dirty: env.dirty ?? true,
          filePath: env.filePath !== undefined ? env.filePath : s.filePath
        }))
      }
    }

    const patch: Record<string, unknown> = {}
    const cur = useEditor.getState()
    if (typeof env.dirty === 'boolean' && opts?.initialBootstrap) patch.dirty = env.dirty
    if (typeof env.loop === 'boolean' && env.loop !== cur.loop) patch.loop = env.loop
    if (typeof env.playing === 'boolean' && env.playing !== cur.playing) patch.playing = env.playing
    if (typeof env.time === 'number' && Number.isFinite(env.time)) {
      const targetPlaying = typeof env.playing === 'boolean' ? env.playing : cur.playing
      if (!targetPlaying || Math.abs(env.time - cur.time) > 0.35 || opts?.initialBootstrap) {
        patch.time = Math.max(0, Math.min(cur.project.comp.duration || 10, env.time))
      }
    }
    if (env.selectedShotId !== undefined && env.selectedShotId !== cur.selectedShotId) {
      patch.selectedShotId = env.selectedShotId
    }
    if (env.selectedLayerId !== undefined && env.selectedLayerId !== cur.selectedLayerId) {
      patch.selectedLayerId = env.selectedLayerId
    }
    if (env.selectedAudioTrackId !== undefined && env.selectedAudioTrackId !== cur.selectedAudioTrackId) {
      patch.selectedAudioTrackId = env.selectedAudioTrackId
    }

    if (Object.keys(patch).length > 0) {
      useEditor.setState(patch)
    }
  } finally {
    applyingRemoteDepth = Math.max(0, applyingRemoteDepth - 1)
  }
}

// ------------------------------------------------------------------ HOST BRIDGE (Electron Main Window)

type HostWin = { __pxsRemoteHostCleanup?: () => void }

export function initHostRemoteBridge(): () => void {
  if (typeof window === 'undefined' || isRemoteWebClient()) return () => undefined
  const remoteApi = window.api?.remote
  if (!remoteApi?.onBridgeCall || !remoteApi?.replyBridgeCall) return () => undefined

  const w = window as unknown as HostWin
  w.__pxsRemoteHostCleanup?.()

  let lastSentProject = useEditor.getState().project
  let lastSentTime = useEditor.getState().time
  let lastSentPlaying = useEditor.getState().playing
  let lastSentShot = useEditor.getState().selectedShotId
  let lastSentLayer = useEditor.getState().selectedLayerId
  let lastSentAudio = useEditor.getState().selectedAudioTrackId
  let lastSentTheme = useView.getState().theme
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null
  let pendingProjectPush = false
  let pendingLibPush = false

  const flushHostBroadcast = (): void => {
    broadcastTimer = null
    if (isApplyingRemoteSync()) return
    const ed = useEditor.getState()
    const vw = useView.getState()

    const projChanged = pendingProjectPush || ed.project !== lastSentProject
    const playingChanged = ed.playing !== lastSentPlaying
    const timeChanged = !ed.playing && Math.abs(ed.time - lastSentTime) > 0.002
    const selChanged =
      ed.selectedShotId !== lastSentShot ||
      ed.selectedLayerId !== lastSentLayer ||
      ed.selectedAudioTrackId !== lastSentAudio
    const themeChanged = vw.theme !== lastSentTheme

    if (!projChanged && !playingChanged && !timeChanged && !selChanged && !themeChanged && !pendingLibPush) {
      return
    }

    lastSentProject = ed.project
    lastSentTime = ed.time
    lastSentPlaying = ed.playing
    lastSentShot = ed.selectedShotId
    lastSentLayer = ed.selectedLayerId
    lastSentAudio = ed.selectedAudioTrackId
    lastSentTheme = vw.theme

    const env: RemoteSyncEnvelope = {
      rev: 0,
      clientId: 'host',
      ...(projChanged ? { project: ed.project, filePath: ed.filePath, dirty: ed.dirty } : {}),
      ...(timeChanged || playingChanged ? { time: ed.time, playing: ed.playing, loop: ed.loop } : {}),
      ...(selChanged
        ? {
            selectedShotId: ed.selectedShotId,
            selectedLayerId: ed.selectedLayerId,
            selectedAudioTrackId: ed.selectedAudioTrackId
          }
        : {}),
      ...(themeChanged ? { theme: vw.theme } : {}),
      ...(pendingLibPush ? { libraries: readSharedLibraries() } : {})
    }
    pendingProjectPush = false
    pendingLibPush = false
    remoteApi.pushHostBroadcast?.(env)
  }

  const scheduleHostBroadcast = (opts?: { project?: boolean; libs?: boolean }): void => {
    if (isApplyingRemoteSync()) return
    if (opts?.project) pendingProjectPush = true
    if (opts?.libs) pendingLibPush = true
    if (!broadcastTimer) {
      broadcastTimer = setTimeout(flushHostBroadcast, 55)
    }
  }

  const unsubBridge = remoteApi.onBridgeCall(async (req: RemoteBridgeRequest) => {
    try {
      if (req.kind === 'bootstrap') {
        const ed = useEditor.getState()
        const vw = useView.getState()
        remoteApi.replyBridgeCall!({
          reqId: req.reqId,
          ok: true,
          result: {
            project: ed.project,
            filePath: ed.filePath,
            dirty: ed.dirty,
            time: ed.time,
            playing: ed.playing,
            loop: ed.loop,
            selectedShotId: ed.selectedShotId,
            selectedLayerId: ed.selectedLayerId,
            selectedAudioTrackId: ed.selectedAudioTrackId,
            theme: vw.theme,
            libraries: readSharedLibraries(),
            assets: assetStore.all().map((a) => a.meta)
          }
        })
        return
      }

      if (req.kind === 'getAssetBytes') {
        const id = String(req.payload?.id || '')
        const runtime = assetStore.get(id)
        const bytes = runtime ? await assetStore.getBytes(id) : undefined
        if (!runtime || !bytes) {
          remoteApi.replyBridgeCall!({ reqId: req.reqId, ok: true, result: { found: false } })
          return
        }
        remoteApi.replyBridgeCall!({
          reqId: req.reqId,
          ok: true,
          result: {
            found: true,
            name: runtime.meta.name,
            mime: runtime.meta.mime,
            kind: runtime.meta.kind,
            base64: uint8ToBase64(bytes)
          }
        })
        return
      }

      if (req.kind === 'putAssetBytes') {
        const p = req.payload || {}
        const id = String(p.id || '')
        if (id && !assetStore.get(id) && typeof p.base64 === 'string') {
          applyingRemoteDepth++
          try {
            const bytes = base64ToUint8(p.base64)
            const kind = p.kind === 'audio' ? 'audio' : 'image'
            const meta: AssetMeta = {
              id,
              name: String(p.name || id),
              kind,
              mime: String(p.mime || (kind === 'audio' ? 'audio/mpeg' : 'image/png')),
              width: typeof p.width === 'number' ? p.width : undefined,
              height: typeof p.height === 'number' ? p.height : undefined
            }
            await assetStore.add(meta.name, meta.mime, bytes, kind, meta)
          } finally {
            applyingRemoteDepth = Math.max(0, applyingRemoteDepth - 1)
          }
        }
        remoteApi.replyBridgeCall!({ reqId: req.reqId, ok: true, result: { ok: true } })
        return
      }

      if (req.kind === 'applySync') {
        const env = (req.payload || {}) as unknown as RemoteSyncEnvelope
        applySyncEnvelopeToStores(env)
        const ed = useEditor.getState()
        lastSentProject = ed.project
        lastSentTime = ed.time
        lastSentPlaying = ed.playing
        lastSentShot = ed.selectedShotId
        lastSentLayer = ed.selectedLayerId
        lastSentAudio = ed.selectedAudioTrackId
        lastSentTheme = useView.getState().theme
        remoteApi.replyBridgeCall!({ reqId: req.reqId, ok: true, result: { ok: true } })
        return
      }

      remoteApi.replyBridgeCall!({ reqId: req.reqId, ok: false, error: `Unknown bridge call` })
    } catch (err) {
      remoteApi.replyBridgeCall!({
        reqId: req.reqId,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  })

  const unsubEditor = useEditor.subscribe((s, prev) => {
    if (isApplyingRemoteSync()) return
    if (s.project !== prev.project) {
      scheduleHostBroadcast({ project: true })
    } else if (
      s.playing !== prev.playing ||
      (!s.playing && Math.abs(s.time - prev.time) > 0.002) ||
      s.selectedShotId !== prev.selectedShotId ||
      s.selectedLayerId !== prev.selectedLayerId ||
      s.selectedAudioTrackId !== prev.selectedAudioTrackId
    ) {
      scheduleHostBroadcast()
    }
  })

  const unsubView = useView.subscribe((s, prev) => {
    if (!isApplyingRemoteSync() && s.theme !== prev.theme) {
      scheduleHostBroadcast()
    }
  })

  const onLibChanged = (): void => scheduleHostBroadcast({ libs: true })
  window.addEventListener('layerComposites:changed', onLibChanged)
  window.addEventListener('models3d:changed', onLibChanged)
  window.addEventListener('publicAssets:changed', onLibChanged)

  const cleanup = (): void => {
    if (broadcastTimer) clearTimeout(broadcastTimer)
    unsubBridge()
    unsubEditor()
    unsubView()
    window.removeEventListener('layerComposites:changed', onLibChanged)
    window.removeEventListener('models3d:changed', onLibChanged)
    window.removeEventListener('publicAssets:changed', onLibChanged)
  }
  w.__pxsRemoteHostCleanup = cleanup
  return cleanup
}

// ------------------------------------------------------------------ REMOTE BROWSER CLIENT SYNC

export async function bootstrapAndSyncRemoteClient(): Promise<() => void> {
  const boot = getRemoteBootstrap()
  if (!boot) return () => undefined

  const knownAssetIds = new Set<string>()
  const inFlightDownloads = new Map<string, Promise<void>>()

  const downloadAssetIfNeeded = async (meta: AssetMeta): Promise<void> => {
    if (!meta?.id || assetStore.get(meta.id)) {
      if (meta?.id) knownAssetIds.add(meta.id)
      return
    }
    const existingTask = inFlightDownloads.get(meta.id)
    if (existingTask) return existingTask

    const task = (async () => {
      try {
        knownAssetIds.add(meta.id)
        const resp = await remoteFetch(`/api/remote/asset/${encodeURIComponent(meta.id)}`)
        if (!resp.ok) return
        const bytes = new Uint8Array(await resp.arrayBuffer())
        await assetStore.add(meta.name, meta.mime, bytes, meta.kind, { ...meta })
      } catch (err) {
        console.warn('[RemoteSync] Asset download failed:', meta.id, err)
      } finally {
        inFlightDownloads.delete(meta.id)
      }
    })()

    inFlightDownloads.set(meta.id, task)
    return task
  }

  const ensureAllAssetsForProject = async (metas: AssetMeta[] = []): Promise<void> => {
    const queue = metas.filter((m) => m && m.id && !assetStore.get(m.id))
    const concurrency = 4
    let idx = 0
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (idx < queue.length) {
        const next = queue[idx++]
        if (next) await downloadAssetIfNeeded(next)
      }
    })
    await Promise.all(workers)
  }

  const uploadPendingLocalAssets = async (): Promise<void> => {
    const all = assetStore.all()
    for (const a of all) {
      if (knownAssetIds.has(a.meta.id)) continue
      knownAssetIds.add(a.meta.id)
      const bytes = await assetStore.getBytes(a.meta.id)
      if (!bytes) continue
      await remoteFetch(`/api/remote/asset/${encodeURIComponent(a.meta.id)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Asset-Name': encodeURIComponent(a.meta.name),
          'X-Asset-Mime': a.meta.mime,
          'X-Asset-Kind': a.meta.kind,
          ...(a.meta.width ? { 'X-Asset-Width': String(a.meta.width) } : {}),
          ...(a.meta.height ? { 'X-Asset-Height': String(a.meta.height) } : {})
        },
        body: bytes as unknown as BodyInit
      })
    }
  }

  // 1. Nạp toàn bộ trạng thái dự án + thư viện + tài nguyên ảnh/âm thanh từ Host PC
  updateRemoteLiveState({ syncing: true, error: null })
  const live = getRemoteLiveState()
  const bootUrl = buildRemoteApiUrl('/api/remote/bootstrap', {
    clientId: boot.clientId,
    w: window.innerWidth,
    h: window.innerHeight,
    tp: navigator.maxTouchPoints || 0,
    layout: live.layoutProfile
  })

  const resp = await remoteFetch(bootUrl)
  if (!resp.ok) {
    const msg = `Không kết nối được phiên Remote (${resp.status})`
    updateRemoteLiveState({ connected: false, syncing: false, error: msg })
    throw new Error(msg)
  }

  const data = (await resp.json()) as {
    ok: boolean
    clientId: string
    rev: number
    device?: { kind?: string; label?: string }
    snapshot: RemoteSyncEnvelope & { assets?: AssetMeta[]; project?: Project }
  }

  let localRev = data.rev || 1
  const snap = data.snapshot
  const initialAssets = snap.assets ?? snap.project?.assets ?? []
  await ensureAllAssetsForProject(initialAssets)
  applySyncEnvelopeToStores({ ...snap, rev: localRev, clientId: 'host' }, { initialBootstrap: true })

  // Chuyển tab mặc định thông minh khi mở trên Điện thoại (Timeline sẵn sàng dưới, Viewer trên)
  const detectedKind = detectBrowserDeviceKind()
  const effLayout = computeEffectiveLayout(getRemoteLiveState().layoutProfile, detectedKind)
  if (effLayout === 'phone') {
    useView.setState({ mobileTab: 'timeline' })
  }

  updateRemoteLiveState({
    connected: true,
    syncing: false,
    lastSyncAt: Date.now(),
    error: null
  })

  // 2. Kết nối kênh SSE thời gian thực nhận mọi thay đổi từ Host và các thiết bị khác
  const sseUrl = buildRemoteApiUrl('/api/remote/events', { clientId: boot.clientId })
  const es = new EventSource(sseUrl)

  es.addEventListener('connected', () => {
    updateRemoteLiveState({ connected: true, error: null })
  })

  es.addEventListener('asset', (ev) => {
    try {
      const meta = JSON.parse((ev as MessageEvent).data) as AssetMeta & { clientId?: string }
      if (meta.clientId === boot.clientId) return
      void downloadAssetIfNeeded(meta)
    } catch {
      /* ignore */
    }
  })

  es.addEventListener('sync', (ev) => {
    try {
      const env = JSON.parse((ev as MessageEvent).data) as RemoteSyncEnvelope
      if (env.clientId === boot.clientId) return
      if (env.rev && env.rev < localRev) return
      localRev = Math.max(localRev, env.rev || localRev)
      const proj = env.project as Project | undefined
      if (proj?.assets?.length) {
        void ensureAllAssetsForProject(proj.assets).then(() => {
          applySyncEnvelopeToStores(env)
          updateRemoteLiveState({ lastSyncAt: Date.now(), connected: true })
        })
      } else {
        applySyncEnvelopeToStores(env)
        updateRemoteLiveState({ lastSyncAt: Date.now(), connected: true })
      }
    } catch {
      /* ignore */
    }
  })

  es.addEventListener('auth_expired', () => {
    updateRemoteLiveState({ connected: false, error: 'Mã QR đã được đổi mới trên máy chủ' })
    es.close()
  })

  es.onerror = () => {
    updateRemoteLiveState({ connected: false })
  }

  // 3. Đẩy thay đổi hai chiều từ Điện thoại / iPad / Laptop về Host PC & các thiết bị khác
  let lastPushedProject = useEditor.getState().project
  let lastPushedTime = useEditor.getState().time
  let lastPushedPlaying = useEditor.getState().playing
  let lastPushedShot = useEditor.getState().selectedShotId
  let lastPushedLayer = useEditor.getState().selectedLayerId
  let lastPushedAudio = useEditor.getState().selectedAudioTrackId
  let lastPushedTheme = useView.getState().theme
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let pushInFlight = false
  let pushQueued = false
  let pendingProject = false
  let pendingLibs = false

  const executePush = async (): Promise<void> => {
    if (pushInFlight) {
      pushQueued = true
      return
    }
    if (isApplyingRemoteSync()) return

    const ed = useEditor.getState()
    const vw = useView.getState()

    const projChanged = pendingProject || ed.project !== lastPushedProject
    const playingChanged = ed.playing !== lastPushedPlaying
    const timeChanged = !ed.playing && Math.abs(ed.time - lastPushedTime) > 0.002
    const selChanged =
      ed.selectedShotId !== lastPushedShot ||
      ed.selectedLayerId !== lastPushedLayer ||
      ed.selectedAudioTrackId !== lastPushedAudio
    const themeChanged = vw.theme !== lastPushedTheme

    if (!projChanged && !playingChanged && !timeChanged && !selChanged && !themeChanged && !pendingLibs) {
      return
    }

    pushInFlight = true
    updateRemoteLiveState({ syncing: true })
    try {
      await uploadPendingLocalAssets()

      lastPushedProject = ed.project
      lastPushedTime = ed.time
      lastPushedPlaying = ed.playing
      lastPushedShot = ed.selectedShotId
      lastPushedLayer = ed.selectedLayerId
      lastPushedAudio = ed.selectedAudioTrackId
      lastPushedTheme = vw.theme

      const payload: RemoteSyncEnvelope = {
        rev: localRev,
        clientId: boot.clientId,
        ...(projChanged ? { project: ed.project, filePath: ed.filePath, dirty: ed.dirty } : {}),
        ...(timeChanged || playingChanged ? { time: ed.time, playing: ed.playing, loop: ed.loop } : {}),
        ...(selChanged
          ? {
              selectedShotId: ed.selectedShotId,
              selectedLayerId: ed.selectedLayerId,
              selectedAudioTrackId: ed.selectedAudioTrackId
            }
          : {}),
        ...(themeChanged ? { theme: vw.theme } : {}),
        ...(pendingLibs ? { libraries: readSharedLibraries() } : {}),
        action: projChanged ? 'edit_project' : playingChanged ? 'playback' : timeChanged ? 'scrub' : 'select'
      }
      pendingProject = false
      pendingLibs = false

      const syncResp = await remoteFetch('/api/remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (syncResp.ok) {
        const resJson = (await syncResp.json()) as { rev?: number }
        if (resJson.rev) localRev = Math.max(localRev, resJson.rev)
        updateRemoteLiveState({ connected: true, syncing: false, lastSyncAt: Date.now(), error: null })
      } else {
        updateRemoteLiveState({ syncing: false })
      }
    } catch {
      updateRemoteLiveState({ syncing: false })
    } finally {
      pushInFlight = false
      if (pushQueued) {
        pushQueued = false
        schedulePush()
      }
    }
  }

  const schedulePush = (opts?: { project?: boolean; libs?: boolean }): void => {
    if (isApplyingRemoteSync()) return
    if (opts?.project) pendingProject = true
    if (opts?.libs) pendingLibs = true
    if (!pushTimer) {
      pushTimer = setTimeout(() => {
        pushTimer = null
        void executePush()
      }, 50)
    }
  }

  const unsubEditor = useEditor.subscribe((s, prev) => {
    if (isApplyingRemoteSync()) return
    if (s.project !== prev.project) {
      schedulePush({ project: true })
    } else if (
      s.playing !== prev.playing ||
      (!s.playing && Math.abs(s.time - prev.time) > 0.002) ||
      s.selectedShotId !== prev.selectedShotId ||
      s.selectedLayerId !== prev.selectedLayerId ||
      s.selectedAudioTrackId !== prev.selectedAudioTrackId
    ) {
      schedulePush()
    }
  })

  const unsubView = useView.subscribe((s, prev) => {
    if (!isApplyingRemoteSync() && s.theme !== prev.theme) {
      schedulePush()
    }
  })

  const unsubAssets = assetStore.subscribe(() => {
    if (!isApplyingRemoteSync()) {
      void uploadPendingLocalAssets()
    }
  })

  const onLibChanged = (): void => schedulePush({ libs: true })
  window.addEventListener('layerComposites:changed', onLibChanged)
  window.addEventListener('models3d:changed', onLibChanged)
  window.addEventListener('publicAssets:changed', onLibChanged)

  // 4. Heartbeat cập nhật kích thước màn hình & xoay ngang/dọc của thiết bị
  const sendHeartbeat = (): void => {
    const st = getRemoteLiveState()
    const eff = computeEffectiveLayout(st.layoutProfile, st.deviceKind)
    if (eff !== st.effectiveLayout) {
      document.documentElement.setAttribute('data-remote-effective', eff)
      updateRemoteLiveState({ effectiveLayout: eff })
    }
    remoteFetch('/api/remote/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: boot.clientId,
        width: window.innerWidth,
        height: window.innerHeight,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        layoutProfile: st.layoutProfile
      })
    }).catch(() => undefined)
  }

  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  const onResize = (): void => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(sendHeartbeat, 250)
  }
  window.addEventListener('resize', onResize)
  const hbInterval = window.setInterval(sendHeartbeat, 12_000)
  sendHeartbeat()

  return () => {
    es.close()
    if (pushTimer) clearTimeout(pushTimer)
    if (resizeTimer) clearTimeout(resizeTimer)
    window.clearInterval(hbInterval)
    unsubEditor()
    unsubView()
    unsubAssets()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('layerComposites:changed', onLibChanged)
    window.removeEventListener('models3d:changed', onLibChanged)
    window.removeEventListener('publicAssets:changed', onLibChanged)
  }
}
