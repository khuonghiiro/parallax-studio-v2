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
  chooseExportPath(defaultName: string): Promise<string | null>
  exportStart(opts: ExportStartOptions): Promise<{ ok: boolean; error?: string }>
  exportFrame(frame: Uint8Array): Promise<void>
  exportFinish(): Promise<ExportResult>
  exportCancel(): Promise<void>
  revealFile(path: string): Promise<void>
  setTitle(title: string): void
}
