import { effectStackCommands } from './commands/effectStackCommands'
import { proceduralMotionCommands } from './commands/proceduralMotionCommands'
import type { McpCommand } from '@shared/ipc'
import type { Handler, Params } from './types'
import { toPlain } from './params'
import { projectCommands } from './commands/projectCommands'
import { shotCommands } from './commands/shotCommands'
import { layerCommands } from './commands/layerCommands'
import { cameraCommands } from './commands/cameraCommands'
import { audioCommands } from './commands/audioCommands'
import { assemblyCommands } from './commands/assemblyCommands'
import { layerAssemblyCommands } from './commands/layerAssemblyCommands'
import { layerAssemblyTemplateCommands } from './commands/layerAssemblyTemplateCommands'
import { motionCommands } from './commands/motionCommands'
import { systemCommands } from './commands/systemCommands'
import { uiCommands } from './commands/uiCommands'

/**
 * Commands an external AI can run through the MCP bridge.
 *
 * Every mutation goes through `useEditor.update()`, so AI edits show up live in the UI
 * and can be undone with Ctrl+Z like any manual edit. Parameter names are snake_case
 * (MCP convention); coordinates use the project convention (x right, y up, z depth).
 */
const commands: Record<string, Handler> = {
  list_commands: () => Object.keys(commands).sort(),
  ...projectCommands,
  ...shotCommands,
  ...layerCommands,
  ...cameraCommands,
  ...audioCommands,
  ...assemblyCommands,
  ...layerAssemblyCommands,
  ...layerAssemblyTemplateCommands,
  ...motionCommands,
  ...proceduralMotionCommands,
  ...effectStackCommands,
  ...systemCommands,
  ...uiCommands
}

/** Run a command by name (also used by execute_script's `api.run`). */
export async function runCommand(method: string, params: Params = {}, cmd?: McpCommand): Promise<unknown> {
  const h = commands[method]
  if (!h) throw new Error(`Unknown method "${method}". Available: ${Object.keys(commands).sort().join(', ')}`)
  return h(params, cmd ?? { reqId: 'local', method, params })
}

export const MCP_COMMANDS = Object.keys(commands)

import { useView } from '../store/view'

let aiTimer: any = null
let isManuallyLocked = false

export function setManualAiLock(locked: boolean, reason?: string, timeoutMs = 10000): void {
  isManuallyLocked = locked
  if (aiTimer) clearTimeout(aiTimer)
  if (locked) {
    useView.getState().setAiControl(true, true, reason || 'AI đang khoá UI để thực hiện tác vụ…')
    aiTimer = setTimeout(() => {
      isManuallyLocked = false
      useView.getState().unlockAi()
    }, Math.max(1000, Math.min(60000, timeoutMs)))
  } else {
    useView.getState().unlockAi()
  }
}

/**
 * Các lệnh chỉ đọc (query/inspect) hoặc chụp ảnh màn hình.
 * Tuyệt đối không bật viền neon hay badge HUD để ảnh chụp không bị dính viền neon và không gây xao nhãng khi AI chỉ đọc thông tin.
 */
const SILENT_MCP_COMMANDS = new Set([
  'get_app_screenshot',
  'get_viewport_screenshot',
  'get_assembly_screenshot',
  'get_project_info',
  'get_shot_info',
  'get_layer_info',
  'get_layer_motion',
  'list_layer_fx',
  'get_camera_info',
  'get_memory_stats',
  'get_audio_info',
  'get_assembly_state',
  'get_layer_assembly_state',
  'list_commands',
  'list_models3d',
  'get_model3d',
  'list_assembly_templates',
  'list_layer_composites',
  'get_layer_composite',
  'get_assembly_template',
  'get_ai_guide',
  'get_ui_state',
  'export_project_json',
  'export_shot_json'
])

type McpWin = { __pxsMcpUnsub?: () => void }

/** Subscribe to MCP commands from the main process. Returns an unsubscribe function. */
export function initMcp(onActivity?: (method: string, ok: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.api?.mcp) return () => undefined
  const w = window as unknown as McpWin
  w.__pxsMcpUnsub?.()
  const unsub = window.api.mcp.onCommand(async (cmd) => {
    const isSilent = SILENT_MCP_COMMANDS.has(cmd.method)
    if (!isManuallyLocked && !isSilent) {
      if (aiTimer) clearTimeout(aiTimer)
      useView.getState().setAiControl(true, true, `AI đang thao tác: ${cmd.method}`)
    }
    try {
      const result = await runCommand(cmd.method, cmd.params ?? {}, cmd)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: true, result: toPlain(result) })
      onActivity?.(cmd.method, true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: false, error: msg })
      onActivity?.(cmd.method, false)
    } finally {
      if (!isManuallyLocked && !isSilent) {
        if (aiTimer) clearTimeout(aiTimer)
        aiTimer = setTimeout(() => {
          if (!isManuallyLocked) {
            useView.getState().unlockAi()
          }
        }, 800)
      }
    }
  })
  w.__pxsMcpUnsub = unsub
  return () => {
    unsub()
    if (w.__pxsMcpUnsub === unsub) w.__pxsMcpUnsub = undefined
  }
}

if (typeof window !== 'undefined' && (window as unknown as McpWin).__pxsMcpUnsub) {
  initMcp()
}
