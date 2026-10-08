#!/usr/bin/env node
/**
 * Parallax Studio V2 — real-time AI & developer CLI controller (`pnpm pxs`).
 *
 * Help, tool catalogue and guide come from the bilingual catalogue (./catalog) — the same
 * source the MCP server uses — so the CLI can never drift from the real tool parameters.
 * Language: --lang en|vi  >  env PARALLAX_MCP_LANG  >  MCP dialog toggle (mcp.json)  >  en.
 *
 *   pnpm pxs --help [--lang vi]
 *   pnpm pxs help append_assembly_model
 *   pnpm pxs guide assembly
 *   pnpm pxs status | inspect
 *   pnpm pxs review --view camera --time 2.5 --out preview.png
 *   pnpm pxs call add_shot '{"name":"Shot 1"}'
 */
import { createConnection } from 'node:net'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import {
  GUIDE,
  GUIDE_TOPICS,
  TOOLS,
  buildShape,
  categoryLabel,
  configPath,
  findTool,
  normalizeLang,
  paramsSummary,
  readConfigFile,
  renderGuide,
  resolveDocsLang,
  toolDescription
} from './catalog/index.mjs'
import { z } from './catalog/shared.mjs'

// ------------------------------------------------------------------ language & messages

const rawArgs = process.argv.slice(2)
const langIdx = rawArgs.indexOf('--lang')
const lang = langIdx >= 0 ? normalizeLang(rawArgs[langIdx + 1]) : resolveDocsLang()
const args = langIdx >= 0 ? rawArgs.filter((_, i) => i !== langIdx && i !== langIdx + 1) : rawArgs

const MSG = {
  notRunning: { en: 'Parallax Studio is not running (or has never been started): config file not found at', vi: 'Parallax Studio chưa được bật (hoặc chưa từng khởi chạy): không tìm thấy file cấu hình tại' },
  startApp: { en: 'Open the app or run "npm run dev" first.', vi: 'Hãy mở ứng dụng hoặc chạy "npm run dev" trước.' },
  timeout: { en: 'Timed out waiting for the app (15s) on', vi: 'Quá thời gian chờ phản hồi từ app (15s) cho lệnh' },
  connectFail: { en: 'Cannot connect to Parallax Studio at', vi: 'Không thể kết nối tới Parallax Studio tại' },
  unknownErr: { en: 'Unknown error from Parallax Studio.', vi: 'Lỗi không xác định từ Parallax Studio.' },
  tool: { en: 'MCP TOOL', vi: 'CÔNG CỤ MCP' },
  group: { en: 'Group', vi: 'Nhóm' },
  desc: { en: 'Description', vi: 'Mô tả' },
  params: { en: 'Parameters', vi: 'Tham số' },
  none: { en: '(none)', vi: '(không có)' },
  example: { en: 'Example', vi: 'Ví dụ gọi' },
  unknownTool: { en: 'Unknown tool', vi: 'Không có công cụ' },
  subtitle: { en: 'Real-time 2.5D scene & 3D assembly control', vi: 'Điều khiển cảnh 2.5D & lắp ráp 3D thời gian thực' },
  commands: { en: 'CLI COMMANDS', vi: 'CÁC LỆNH CLI' },
  catalogue: { en: 'AVAILABLE MCP TOOLS', vi: 'CÔNG CỤ MCP KHẢ DỤNG' },
  docsLang: { en: 'Docs language: English (switch with --lang vi or the toggle in the app MCP dialog)', vi: 'Ngôn ngữ tài liệu: Tiếng Việt (đổi bằng --lang en hoặc công tắc trong dialog MCP của app)' },
  connected: { en: 'Connected to Parallax Studio V2!', vi: 'Kết nối thành công tới Parallax Studio V2!' },
  project: { en: 'Project', vi: 'Dự án' },
  size: { en: 'Size', vi: 'Kích thước' },
  duration: { en: 'Duration', vi: 'Thời lượng' },
  shots: { en: 'Shots', vi: 'Phân cảnh' },
  layers: { en: 'Layers', vi: 'Số layer' },
  error: { en: 'Error', vi: 'Lỗi' },
  rendering: { en: 'Rendering preview', vi: 'Đang render ảnh preview' },
  now: { en: 'current', vi: 'hiện tại' },
  noImage: { en: 'No image data received from the engine.', vi: 'Không nhận được dữ liệu ảnh từ engine.' },
  saved: { en: 'Review image saved', vi: 'Đã xuất ảnh review' },
  viewHint: { en: 'AI agents can open this file with "view_file" to check the frame visually.', vi: 'AI Agent có thể mở file này bằng "view_file" để kiểm tra trực quan.' },
  missingMethod: { en: 'Missing tool name. Example: pnpm pxs call get_project_info', vi: 'Thiếu tên công cụ! Ví dụ: pnpm pxs call get_project_info' },
  badJson: { en: 'Invalid JSON params', vi: 'Lỗi định dạng JSON params' },
  badParams: { en: 'Parameters do not match the tool schema', vi: 'Tham số không khớp schema của công cụ' },
  calling: { en: 'Calling', vi: 'Đang gọi' },
  result: { en: 'Result', vi: 'Kết quả' },
  invalid: { en: 'Unknown command', vi: 'Lệnh không hợp lệ' },
  seeHelp: { en: 'Run "pnpm pxs --help" for the command list.', vi: 'Chạy "pnpm pxs --help" để xem danh sách lệnh.' }
}
const t = (key) => MSG[key][lang]

const CLI_COMMANDS = [
  ['pnpm pxs status', { en: 'Check the connection and app state', vi: 'Kiểm tra kết nối và trạng thái app' }],
  ['pnpm pxs inspect', { en: 'Dump the whole project as JSON', vi: 'Xuất toàn bộ cấu trúc dự án (JSON)' }],
  ['pnpm pxs review [--view camera|3d|app]', { en: 'Render the viewport (or the whole app window with "app") to a PNG file', vi: 'Chụp ảnh review cảnh (hoặc toàn cửa sổ app với "app") ra file PNG' }],
  ["pnpm pxs call <tool> '<json>'", { en: 'Call any MCP tool (params validated first)', vi: 'Gọi bất kỳ công cụ MCP nào (kiểm tra tham số trước)' }],
  ['pnpm pxs help <tool>', { en: 'Details and parameters of one tool', vi: 'Chi tiết và tham số của một công cụ' }],
  [`pnpm pxs guide [${GUIDE_TOPICS.join('|')}]`, { en: 'Read the AI guide', vi: 'Đọc hướng dẫn AI' }],
  ['--lang en|vi', { en: 'Docs language for this run', vi: 'Ngôn ngữ tài liệu cho lần chạy này' }]
]

// ------------------------------------------------------------------ connection

function readConfig() {
  const cfg = readConfigFile()
  if (!cfg) throw new Error(`[PXS CLI] ${t('notRunning')}\n  ${configPath()}\n👉 ${t('startApp')}`)
  return { host: '127.0.0.1', port: Number(process.env.PARALLAX_MCP_PORT) || cfg.port || 9877, token: process.env.PARALLAX_MCP_TOKEN || cfg.token }
}

function sendCommand(method, params = {}) {
  const cfg = readConfig()
  return new Promise((resolvePromise, rejectPromise) => {
    const sock = createConnection({ host: cfg.host, port: cfg.port })
    sock.setEncoding('utf8')
    let buffer = ''
    const reqId = Date.now()
    const timeout = setTimeout(() => {
      sock.destroy()
      rejectPromise(new Error(`[PXS CLI] ${t('timeout')} "${method}".`))
    }, 15000)
    sock.once('connect', () => sock.write(JSON.stringify({ id: reqId, token: cfg.token, method, params }) + '\n'))
    sock.on('data', (chunk) => {
      buffer += chunk
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        let res
        try {
          res = JSON.parse(line)
        } catch {
          continue
        }
        if (res.id !== reqId && res.id !== null) continue
        clearTimeout(timeout)
        sock.destroy()
        if (res.ok) resolvePromise(res.result)
        else rejectPromise(new Error(res.error || t('unknownErr')))
        return
      }
    })
    sock.on('error', (err) => {
      clearTimeout(timeout)
      rejectPromise(new Error(`[PXS CLI] ${t('connectFail')} 127.0.0.1:${cfg.port}: ${err.message}`))
    })
  })
}

/** Relative paths are resolved against the CLI's cwd (the app runs elsewhere). */
function absPaths(params) {
  const out = { ...params }
  for (const k of ['file_path', 'out_path', 'path']) if (typeof out[k] === 'string' && out[k] && !isAbsolute(out[k])) out[k] = resolve(out[k])
  return out
}

const fail = (msg) => {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

// ------------------------------------------------------------------ help & guide

function printToolHelp(tool) {
  const bar = '='.repeat(64)
  const params = paramsSummary(tool, lang)
  console.log(`\n${bar}\n  ${t('tool')}: ${tool.name}\n${bar}`)
  console.log(`${t('group')}:  ${categoryLabel(tool.cat, lang)}`)
  console.log(`${t('desc')}:  ${toolDescription(tool, lang)}`)
  console.log(`${t('params')}:${params.length ? '\n' + params.map((p) => `  • ${p}`).join('\n') : ` ${t('none')}`}`)
  console.log(`${t('example')}:  pnpm pxs call ${tool.name}${tool.example ? ` '${tool.example}'` : ''}\n${bar}\n`)
}

function printOverview() {
  console.log(`\nPARALLAX STUDIO V2 — AI & DEVELOPER CLI\n${t('subtitle')}\n${t('docsLang')}\n`)
  console.log(renderGuide(lang, 'coordinates'))
  console.log(`\n## ${t('commands')}`)
  for (const [cmd, desc] of CLI_COMMANDS) console.log(`  ${cmd.padEnd(44)} ${desc[lang]}`)
  console.log(`\n## ${t('catalogue')} (${TOOLS.length})`)
  for (const cat of Object.keys(GUIDE.categories)) {
    const list = TOOLS.filter((tool) => tool.cat === cat)
    if (!list.length) continue
    console.log(`\n── ${categoryLabel(cat, lang)} ──`)
    for (const tool of list) console.log(`  • ${tool.name.padEnd(26)} ${toolDescription(tool, lang).split('. ')[0]}`)
  }
  console.log(`\n${renderGuide(lang, 'workflow')}\n\n${renderGuide(lang, 'assembly')}\n`)
}

function cmdHelp(name) {
  if (!name) return printOverview()
  const tool = findTool(name)
  if (!tool) fail(`${t('unknownTool')} "${name}". ${t('seeHelp')}`)
  printToolHelp(tool)
}

function cmdGuide(topic = 'all') {
  try {
    console.log(renderGuide(lang, topic))
  } catch (err) {
    fail(err.message)
  }
}

// ------------------------------------------------------------------ app commands

async function cmdStatus() {
  const res = await sendCommand('get_project_info')
  const comp = res.composition || res.project?.comp || {}
  const shots = res.shots || res.project?.shots || []
  const layers = res.layers || res.project?.layers || []
  console.log(`\n✓ [PXS CLI] ${t('connected')}`)
  console.log(`  ${t('project').padEnd(12)} ${res.name || comp.name || 'Untitled'}`)
  console.log(`  ${t('size').padEnd(12)} ${comp.width || 1920}x${comp.height || 1080} @ ${comp.fps || 30} fps`)
  console.log(`  ${t('duration').padEnd(12)} ${comp.duration || 0}s`)
  console.log(`  ${t('shots').padEnd(12)} ${shots.length}`)
  console.log(`  ${t('layers').padEnd(12)} ${layers.length}\n`)
}

async function cmdReview(opts) {
  let view = 'camera'
  let time
  let outPath = 'artifacts/review_viewport.png'
  for (let i = 0; i < opts.length; i++) {
    if (opts[i] === '--view' && opts[i + 1]) view = opts[++i]
    else if (opts[i] === '--time' && opts[i + 1]) time = parseFloat(opts[++i])
    else if (opts[i] === '--out' && opts[i + 1]) outPath = opts[++i]
  }
  console.log(`⏳ ${t('rendering')} (view: ${view}, time: ${time ?? t('now')})...`)
  const res =
    view === 'app'
      ? await sendCommand('get_app_screenshot', { format: 'png' })
      : await sendCommand('get_viewport_screenshot', { view, time, width: 960, format: 'png' })
  if (!res?.data) throw new Error(t('noImage'))
  const absOut = isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath)
  mkdirSync(join(absOut, '..'), { recursive: true })
  writeFileSync(absOut, Buffer.from(res.data, 'base64'))
  const when = typeof res.time === 'number' ? `, t=${res.time.toFixed(2)}s` : ''
  console.log(`✓ ${t('saved')}: ${absOut} (${res.width}x${res.height}${when})\n👉 ${t('viewHint')}`)
}

function parseParams(arg) {
  if (!arg) return {}
  try {
    if (arg.startsWith('@') || (arg.endsWith('.json') && existsSync(arg))) return JSON.parse(readFileSync(arg.replace(/^@/, ''), 'utf-8'))
    try {
      return JSON.parse(arg)
    } catch {
      return Function(`return (${arg})`)()
    }
  } catch (e) {
    return fail(`${t('badJson')}: ${e.message}`)
  }
}

async function cmdCall(method, paramsArg) {
  if (!method) fail(t('missingMethod'))
  const params = parseParams(paramsArg)
  const tool = findTool(method)
  if (tool) {
    const check = z.object(buildShape(tool, lang)).safeParse(params)
    if (!check.success) fail(`${t('badParams')} "${method}":\n${check.error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')}`)
    if (tool.local) return cmdGuide(params.topic)
  }
  console.log(`⏳ ${t('calling')} "${method}"...`)
  const res = await sendCommand(method, absPaths(params))
  console.log(`✓ ${t('result')}:\n${JSON.stringify(res, null, 2)}`)
}

// ------------------------------------------------------------------ main

async function main() {
  const [action = '--help', ...rest] = args
  switch (action) {
    case 'help':
    case '--help':
    case '-h':
      return cmdHelp(rest[0])
    case 'guide':
      return cmdGuide(rest[0])
    case 'status':
      return cmdStatus()
    case 'inspect':
      return console.log(JSON.stringify(await sendCommand('get_project_info'), null, 2))
    case 'review':
    case 'screenshot':
      return cmdReview(rest)
    case 'call':
      return cmdCall(rest[0], rest[1])
    default:
      console.log(`${t('invalid')}: "${action}". ${t('seeHelp')}`)
  }
}

main().catch((err) => fail(`${t('error')}: ${err.message}`))
