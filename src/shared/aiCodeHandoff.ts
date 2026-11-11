export interface AiCodeFile {
  path: string
  hash: string
  content: string
}

export interface AiCodeBundle {
  version: 1
  id: string
  files: AiCodeFile[]
  markdown: string
  warnings: string[]
}

export interface AiCodeImportResult {
  files: string[]
  backupPath: string
  applied: boolean
}

export interface AiCodeHandoffApi {
  export: (paths: string[], report: string) => Promise<AiCodeBundle>
  import: (text: string, apply: boolean) => Promise<AiCodeImportResult>
}
