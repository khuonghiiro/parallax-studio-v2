import { afterEach, expect, it, vi } from 'vitest'
import { aiCodeCommands } from './aiCodeCommands'
import type { McpCommand } from '@shared/ipc'

afterEach(() => vi.unstubAllGlobals())
it('defaults import to preview and forwards explicit apply', async () => {
  const importCode = vi.fn().mockResolvedValue({ files: ['a'], applied: false })
  vi.stubGlobal('window', { api: { aiCode: { import: importCode } } })
  await aiCodeCommands.import_ui_code({ reply: '{}' }, {} as McpCommand)
  expect(importCode).toHaveBeenLastCalledWith('{}', false)
  await aiCodeCommands.import_ui_code({ reply: '{}', apply: true }, {} as McpCommand)
  expect(importCode).toHaveBeenLastCalledWith('{}', true)
})
it('rejects invalid scan dimensions before touching the DOM', async () => {
  await expect(aiCodeCommands.export_ui_code({ left: 0, top: 0, width: -1, height: 10 }, {} as McpCommand)).rejects.toThrow()
})
