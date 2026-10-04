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

export interface McpStatus {
  listening: boolean
  port: number
  clients: number
  commands: number
  lastMethod: string | null
  lastAt: number | null
  configPath: string
  error?: string
}

export interface McpApi {
  onCommand(cb: (cmd: McpCommand) => void): () => void
  respond(res: McpResponse): void
  status(): Promise<McpStatus>
  onStatus(cb: (s: McpStatus) => void): () => void
}

