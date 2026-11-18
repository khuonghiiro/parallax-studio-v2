import { copyFileSync, existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

export interface LoadDotEnvOptions {
  cwd?: string
  envMap?: NodeJS.ProcessEnv
  override?: boolean
  seedFromExample?: boolean
}

function unquoteValue(rawVal: string): string {
  const trimmed = rawVal.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1)
  }
  // Chỉ cắt chú thích nội dòng khi có khoảng trắng đứng trước dấu '#' (tránh cắt nhầm URL/mã màu)
  const commentIdx = trimmed.search(/\s+#/)
  return (commentIdx >= 0 ? trimmed.slice(0, commentIdx) : trimmed).trim()
}

export function parseDotEnvContent(raw: string): Record<string, string> {
  const clean = raw.replace(/^\uFEFF/, '')
  const result: Record<string, string> = {}

  for (const rawLine of clean.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const body = line.startsWith('export ') ? line.slice(7).trim() : line
    const eqIdx = body.indexOf('=')
    if (eqIdx <= 0) continue

    const key = body.slice(0, eqIdx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue

    const value = unquoteValue(body.slice(eqIdx + 1))
    result[key] = value
  }
  return result
}

function candidateEnvDirectories(cwd: string): string[] {
  const dirs = new Set<string>()
  dirs.add(resolve(cwd))
  if (process.execPath) {
    dirs.add(dirname(process.execPath))
  }
  const procRes = process as NodeJS.Process & { resourcesPath?: string }
  if (procRes.resourcesPath) {
    dirs.add(resolve(procRes.resourcesPath, '..'))
    dirs.add(resolve(procRes.resourcesPath))
  }
  return Array.from(dirs)
}

export function loadAppDotEnv(opts: LoadDotEnvOptions = {}): Record<string, string> {
  const cwd = opts.cwd ?? process.cwd()
  const targetEnv = opts.envMap ?? process.env
  const override = Boolean(opts.override)
  const seedFromExample = opts.seedFromExample !== false

  if (seedFromExample) {
    const rootEnv = join(cwd, '.env')
    const rootExample = join(cwd, '.env.example')
    if (!existsSync(rootEnv) && existsSync(rootExample)) {
      try {
        copyFileSync(rootExample, rootEnv)
      } catch {
        /* Thư mục chỉ đọc — bỏ qua tự tạo .env */
      }
    }
  }

  let envPath: string | null = null
  for (const dir of candidateEnvDirectories(cwd)) {
    const candidate = join(dir, '.env')
    if (existsSync(candidate)) {
      envPath = candidate
      break
    }
  }
  if (!envPath) return {}

  let parsed: Record<string, string> = {}
  try {
    parsed = parseDotEnvContent(readFileSync(envPath, 'utf-8'))
  } catch {
    return {}
  }

  const applied: Record<string, string> = {}
  for (const [key, val] of Object.entries(parsed)) {
    if (val === '') continue
    if (!override && targetEnv[key] !== undefined && targetEnv[key] !== '') {
      continue
    }
    targetEnv[key] = val
    applied[key] = val
  }

  // RAYON_NUM_THREADS=0 nghĩa là tự động bung tối đa nhân CPU -> xoá biến để Rayon tự dò
  if (targetEnv.RAYON_NUM_THREADS !== undefined) {
    const n = Number(targetEnv.RAYON_NUM_THREADS)
    if (!Number.isFinite(n) || n <= 0) {
      delete targetEnv.RAYON_NUM_THREADS
    }
  }

  return applied
}

let bootLoaded = false

export function ensureAppDotEnvLoaded(): void {
  if (bootLoaded) return
  bootLoaded = true
  loadAppDotEnv()
}

ensureAppDotEnvLoaded()
