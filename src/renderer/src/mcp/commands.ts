import type { McpCommand } from '@shared/ipc'
import type { Handler, Params } from './types'
import { toPlain } from './params'
import { projectCommands } from './commands/projectCommands'
import { shotCommands } from './commands/shotCommands'
import { layerCommands } from './commands/layerCommands'
import { cameraCommands } from './commands/cameraCommands'
import { audioCommands } from './commands/audioCommands'
import { systemCommands } from './commands/systemCommands'

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
  ...systemCommands
}

/** Run a command by name (also used by execute_script's `api.run`). */
export async function runCommand(method: string, params: Params = {}, cmd?: McpCommand): Promise<unknown> {
  const h = commands[method]
  if (!h) throw new Error(`Unknown method "${method}". Available: ${Object.keys(commands).sort().join(', ')}`)
  return h(params, cmd ?? { reqId: 'local', method, params })
}

export const MCP_COMMANDS = Object.keys(commands)

/** Subscribe to MCP commands from the main process. Returns an unsubscribe function. */
export function initMcp(onActivity?: (method: string, ok: boolean) => void): () => void {
  if (!window.api?.mcp) return () => undefined
  return window.api.mcp.onCommand(async (cmd) => {
    try {
      const result = await runCommand(cmd.method, cmd.params ?? {}, cmd)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: true, result: toPlain(result) })
      onActivity?.(cmd.method, true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.api.mcp.respond({ reqId: cmd.reqId, ok: false, error: msg })
      onActivity?.(cmd.method, false)
    }
  })
}
