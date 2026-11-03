import type { LoopAnimationPackageJson } from './types'
/** Contract between preload (window.api) and the renderer. */

export interface PickedFile {
  name: string
  path: string
  mime: string
  data: Uint8Array
}

export interface ExportStartOptions {
  width: number
  height: number
  fps: number
  crf: number
  preset: 'ultrafast' | 'veryfast' | 'medium' | 'slow'
  outPath: string
  audio?: { data: Uint8Array; ext: string; offset: number; volume: number; duration: number }
}

export interface ExportResult {
  ok: boolean
  error?: string
  outPath?: string
}

export interface SystemHardwareInfo {
  totalRamMB: number
  freeRamMB: number
  cpuModel: string
  gpuName?: string
  gpuVramMB?: number
  platform: string
}

export type ManifestModuleId = 'builtin' | 'layer_25d' | 'loop_animator' | 'model_3d' | 'audio'
export type ManifestItemStatus = 'active' | 'deleted' | 'hidden'

export interface BuiltInAssetCategory {
  id: string
  folder: string
  title: string
  shortTitle?: string
  icon: string
  iconUrl?: string
  iconText?: string
  accent?: string
  description?: string
  order?: number
  status?: ManifestItemStatus
}

export interface BuiltInAssetItem {
  id: string
  name: string
  fileName: string
  relativePath: string
  folder: string
  category?: string
  ext: string
  mime: string
  kind: 'image' | 'audio'
  size: number
  path: string
  isAnimated?: boolean
  previewUrl?: string
  status?: ManifestItemStatus
  tempPath?: string
  deletedAt?: string
}

export interface ManifestAssetMeta {
  name: string
  category?: string
  status?: ManifestItemStatus
  description?: string
  cols?: number
  rows?: number
  fps?: number
  chroma?: string | null
  tolerance?: number
  duration?: number
  tempPath?: string
  deletedAt?: string
  [key: string]: unknown
}

export interface ManifestSidebarTopic {
  id: string
  title: string
  shortTitle?: string
  icon: string
  iconUrl?: string
  iconText?: string
  accent?: string
  sourceModule?: string
  folderFilter?: string
  order?: number
  status?: ManifestItemStatus
}

export interface ManifestModuleDescriptor {
  id: ManifestModuleId
  title: string
  file: string
  rootFolder: string
  tempFolder: string
  description?: string
}

export interface ManifestModuleData {
  moduleId: ManifestModuleId
  title: string
  description?: string
  file: string
  manifestPath: string
  rawJson: string
  categories: BuiltInAssetCategory[]
  templateCategories?: BuiltInAssetCategory[]
  sidebarAssetTopics?: ManifestSidebarTopic[]
  assets: Record<string, ManifestAssetMeta>
}

export interface ManifestPruneReport {
  removedAssets: string[]
  removedItems: string[]
  removedCategories: string[]
  softDeletedAssets: string[]
  restoredAssets: string[]
  unlisted: string[]
  added: string[]
}

export interface BuiltInCatalogResult {
  categories: BuiltInAssetCategory[]
  items: BuiltInAssetItem[]
  deletedItems?: BuiltInAssetItem[]
  manifestPath: string
  rawJson: string
  tempTrashFolder?: string
  iconsFolder?: string
  iconUrls?: Record<string, string>
  coordinator?: {
    version: string
    tempTrashFolder: string
    iconsFolder: string
    modules: Record<ManifestModuleId, ManifestModuleDescriptor>
  }
  modules?: Record<ManifestModuleId, ManifestModuleData>
}

export interface BuiltInSaveManifestResult {
  ok: boolean
  error?: string
  catalog?: BuiltInCatalogResult
}

export interface Asset3DsCategory {
  id: string
  title: string
  shortTitle?: string
  icon: string
  iconUrl?: string
  iconText?: string
  accent?: string
  description?: string
  order?: number
  status?: ManifestItemStatus
}

export interface Asset3DsCatalogResult {
  categories: Asset3DsCategory[]
  models: any[]
}

export interface ParallaxApi {
  openFiles(kind: 'image' | 'audio'): Promise<PickedFile[]>
  saveProject(data: Uint8Array, suggestedPath?: string): Promise<string | null>
  openProject(): Promise<{ path: string; data: Uint8Array } | null>
  saveJson(content: string, defaultName?: string): Promise<string | null>
  openJson(): Promise<{ path: string; content: string } | null>
  chooseExportPath(defaultName: string): Promise<string | null>
  exportStart(opts: ExportStartOptions): Promise<{ ok: boolean; error?: string }>
  exportFrame(frame: Uint8Array): Promise<void>
  exportFinish(): Promise<ExportResult>
  exportCancel(): Promise<void>
  revealFile(path: string): Promise<void>
  setTitle(title: string): void
  resetZoom?(): void
  getSystemInfo(): Promise<SystemHardwareInfo>
  getBuiltInCatalog(forceRefresh?: boolean): Promise<BuiltInCatalogResult>
  getAssemblyAssets(): Promise<BuiltInAssetItem[]>
  saveBuiltInManifest(jsonContent: string): Promise<BuiltInSaveManifestResult>
  saveModuleManifest?(
    moduleId: ManifestModuleId | 'coordinator',
    jsonContent: string
  ): Promise<BuiltInSaveManifestResult>
  loadBuiltInAssetBytes(relativePath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null>
  openBuiltInFolder(subFolder?: string): Promise<void>
  deleteBuiltInAsset(
    relativePath: string,
    opts?: { permanent?: boolean }
  ): Promise<{ ok: boolean; status?: ManifestItemStatus; tempPath?: string; error?: string; catalog?: BuiltInCatalogResult }>
  restoreBuiltInAsset?(
    relativePath: string
  ): Promise<{ ok: boolean; relPath?: string; error?: string; catalog?: BuiltInCatalogResult }>
  pruneBuiltInManifest?(opts?: {
    keepEmpty?: boolean
    addNew?: boolean
  }): Promise<{ ok: boolean; report?: ManifestPruneReport; error?: string; catalog?: BuiltInCatalogResult }>
  onBuiltInCatalogUpdated?(cb: (catalog: BuiltInCatalogResult) => void): () => void
  importBuiltInAssetFile(opts: {
    name: string
    buffer: Uint8Array
    folder?: string
    title?: string
  }): Promise<{ ok: boolean; relPath?: string; fullPath?: string; item?: BuiltInAssetItem; error?: string }>
  saveLoopAnimationPackage?(opts: {
    folderName: string
    name: string
    category?: string
    jsonContent: string
    frames: Array<{ fileName: string; data: Uint8Array | string }>
    thumbnail?: { fileName: string; data: Uint8Array | string }
  }): Promise<{
    ok: boolean
    folderPath?: string
    relPath?: string
    jsonRelPath?: string
    error?: string
    catalog?: BuiltInCatalogResult
  }>
  loadLoopAnimationPackage?(
    relPathOrJson: string
  ): Promise<{ ok: boolean; data?: LoopAnimationPackageJson; error?: string }>
  asset3ds?: {
    getCatalog(): Promise<Asset3DsCatalogResult>
    list(): Promise<any[]>
    save(model: any): Promise<{ ok: boolean; path?: string; error?: string }>
    delete(id: string): Promise<{ ok: boolean }>
    loadBytes(relPath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null>
    openFolder(): Promise<void>
    saveManifest(jsonContent: string): Promise<{ ok: boolean; error?: string }>
  }
  mcp: McpApi
  remote?: RemoteApi
}

// ------------------------------------------------------------------ MCP bridge

/** A command from an external MCP client, forwarded by the main process. */
export interface McpCommand {
  reqId: string
  method: string
  params: Record<string, unknown>
  /** Files referenced by `file_path` params, read by the main process. */
  file?: PickedFile
}

export interface McpResponse {
  reqId: string
  req?: string
  ok: boolean
  result?: unknown
  error?: string
}

/** Language of the docs the MCP server serves to AI agents ('en' = default, most precise). */
export type McpDocsLang = 'en' | 'vi'

export interface McpStatus {
  listening: boolean
  port: number
  clients: number
  commands: number
  busy?: boolean
  lastMethod: string | null
  lastAt: number | null
  configPath: string
  serverScriptPath?: string
  docsLang: McpDocsLang
  error?: string
}

export interface McpRect {
  x: number
  y: number
  width: number
  height: number
}

export interface McpCaptureOptions {
  width?: number
  format?: 'png' | 'jpeg'
  rect?: McpRect
}

export interface McpCaptureResult {
  mime: string
  data: string
  width: number
  height: number
}

export interface McpApi {
  onCommand(cb: (cmd: McpCommand) => void): () => void
  respond(res: McpResponse): void
  status(): Promise<McpStatus>
  onStatus(cb: (s: McpStatus) => void): () => void
  disconnectAll(): Promise<void>
  toggleListening(enable?: boolean): Promise<McpStatus>
  setDocsLang(lang: McpDocsLang): Promise<McpStatus>
  /** Screenshot of the whole app window (UI, dialogs, workshop) – used by the get_app_screenshot tool. */
  captureWindow(opts?: McpCaptureOptions): Promise<McpCaptureResult>
}

// ------------------------------------------------------------------ Multi-Device Wi-Fi QR Remote Studio

export type RemoteDeviceKind = 'phone' | 'ipad' | 'tablet' | 'laptop' | 'desktop'
export type RemoteLayoutProfile = 'auto' | 'phone' | 'tablet' | 'desktop' | 'pad'

export interface RemoteConnectedDevice {
  id: string
  ip: string
  kind: RemoteDeviceKind
  label: string
  width?: number
  height?: number
  layoutProfile?: RemoteLayoutProfile
  connectedAt: number
  lastActiveAt: number
  lastAction?: string
}

export interface RemoteSyncEnvelope {
  rev: number
  clientId: string
  project?: unknown
  filePath?: string | null
  dirty?: boolean
  time?: number
  playing?: boolean
  loop?: boolean
  selectedShotId?: string | null
  selectedLayerId?: string | null
  selectedAudioTrackId?: string | null
  inspectorTab?: string
  theme?: 'dark' | 'light'
  libraries?: Record<string, string | null>
  assetIds?: string[]
  action?: string
}

export interface RemoteBridgeRequest {
  reqId: string
  kind: 'bootstrap' | 'applySync' | 'getAssetBytes' | 'putAssetBytes'
  payload?: Record<string, unknown>
}

export interface RemoteBridgeResponse {
  reqId: string
  ok: boolean
  result?: unknown
  error?: string
}

export interface RemoteServerStatus {
  listening: boolean
  port: number
  ips: string[]
  primaryIp: string
  token: string
  url: string
  urls: string[]
  connectedDevices: number
  devices?: RemoteConnectedDevice[]
  lastActiveAt: number | null
  lastAction: string | null
  error?: string
}

export interface RemoteApi {
  status(): Promise<RemoteServerStatus>
  onStatus(cb: (s: RemoteServerStatus) => void): () => void
  toggle(enable?: boolean): Promise<RemoteServerStatus>
  regenerateToken(): Promise<RemoteServerStatus>
  onBridgeCall?(cb: (req: RemoteBridgeRequest) => void): () => void
  replyBridgeCall?(res: RemoteBridgeResponse): void
  pushHostBroadcast?(payload: RemoteSyncEnvelope): void
}
