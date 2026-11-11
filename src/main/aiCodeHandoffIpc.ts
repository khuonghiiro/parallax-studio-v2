import type { AiCodeTarget } from '../shared/aiCodeHandoff'
import { app, ipcMain } from 'electron'
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { AiCodeHandoffService } from './aiCodeHandoffService'

export function registerAiCodeHandoffIpc(): void {
  const root = resolve(app.getAppPath())
  const service = new AiCodeHandoffService(root, join(app.getPath('userData'), 'ai-code-handoffs'))
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
  ipcMain.handle('aiCode:export', (event, paths: AiCodeTarget[], report: string) => {
    check(event)
    return service.export(paths, report)
  })
  ipcMain.handle('aiCode:import', (event, text: string, apply: boolean) => {
    check(event)
    if (typeof apply !== 'boolean') throw new Error('Thiếu chế độ kiểm tra/áp dụng.')
    return service.import(text, apply)
  })
}
