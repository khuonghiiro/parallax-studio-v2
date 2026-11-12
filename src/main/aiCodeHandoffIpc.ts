import type { AiCodeTarget } from '../shared/aiCodeHandoff'
import { app, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { existsSync } from 'fs'

let handoffService: import('./aiCodeHandoffService').AiCodeHandoffService | null = null

async function getHandoffService(root: string) {
  if (!handoffService) {
    const { AiCodeHandoffService } = await import('./aiCodeHandoffService')
    handoffService = new AiCodeHandoffService(root, join(app.getPath('userData'), 'ai-code-handoffs'))
  }
  return handoffService
}

export function registerAiCodeHandoffIpc(): void {
  const root = resolve(app.getAppPath())
  const check = (event: Electron.IpcMainInvokeEvent) => {
    if (app.isPackaged || !existsSync(join(root, 'AGENTS.md'))) {
      throw new Error('Xuất/nhập mã nguồn chỉ dùng trong bản phát triển có repository.')
    }
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Chỉ cửa sổ chính được truy cập mã nguồn.')
    const expected = process.env.ELECTRON_RENDERER_URL
    if (!expected || new URL(event.senderFrame.url).origin !== new URL(expected).origin) {
      throw new Error('Nguồn yêu cầu không hợp lệ.')
    }
  }
  ipcMain.handle('aiCode:export', async (event, paths: AiCodeTarget[], report: string) => {
    check(event)
    const service = await getHandoffService(root)
    return service.export(paths, report)
  })
  ipcMain.handle('aiCode:import', async (event, text: string, apply: boolean) => {
    check(event)
    if (typeof apply !== 'boolean') throw new Error('Thiếu chế độ kiểm tra/áp dụng.')
    const service = await getHandoffService(root)
    return service.import(text, apply)
  })
}
