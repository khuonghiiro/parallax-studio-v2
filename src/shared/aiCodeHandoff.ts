export interface AiCodeTarget { path: string; line: number; classes?: string[]; selectors?: string[] }
export interface AiCodeSnippet {
  id: string
  start: number
  end: number
  startLine: number
  content: string
  context?: string
}
export interface AiCodeFile {
  path: string
  hash: string
  content: string
  snippets?: AiCodeSnippet[]
}

export interface AiCodeBundle {
  version: 1 | 2
  id: string
  files: Omit<AiCodeFile, 'content'>[]
  markdown: string
  warnings: string[]
}

export interface AiCodeImportResult {
  files: string[]
  backupPath: string
  applied: boolean
}

export interface AiCodeHandoffApi {
  export: (targets: AiCodeTarget[], report: string) => Promise<AiCodeBundle>
  import: (text: string, apply: boolean) => Promise<AiCodeImportResult>
}
