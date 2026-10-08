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

export interface BuiltInAssetCategory {
  id: string
  folder: string
  title: string
  icon: string
  description?: string
  order?: number
}

export interface BuiltInAssetItem {
  id: string
  name: string
  fileName: string
  relativePath: string
  folder: string
  ext: string
  mime: string
  kind: 'image' | 'audio'
  size: number
  path: string
  isAnimated?: boolean
  previewUrl?: string
}

export interface BuiltInCatalogResult {
  categories: BuiltInAssetCategory[]
  items: BuiltInAssetItem[]
  manifestPath: string
  rawJson: string
}

export interface BuiltInSaveManifestResult {
  ok: boolean
  error?: string
  catalog?: BuiltInCatalogResult
}

export interface Asset3DsCategory {
  id: string
  title: string
  icon: string
  description?: string
  order?: number
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
  getSystemInfo(): Promise<SystemHardwareInfo>
  getBuiltInCatalog(): Promise<BuiltInCatalogResult>
  getAssemblyAssets(): Promise<BuiltInAssetItem[]>
  saveBuiltInManifest(jsonContent: string): Promise<BuiltInSaveManifestResult>
  loadBuiltInAssetBytes(relativePath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null>
  openBuiltInFolder(subFolder?: string): Promise<void>
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
  lastMethod: string | null
  lastAt: number | null
  configPath: string
  serverScriptPath?: string
  docsLang: McpDocsLang
  error?: string
}

export interface McpCaptureOptions {
  width?: number
  format?: 'png' | 'jpeg'
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

