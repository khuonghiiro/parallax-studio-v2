import { num, str, bool } from '../params'
import { ParamError, type Handler } from '../types'
import { captureAiInspectorSnapshot } from '../../ui/inspector/aiUiInspectorScanner'
import { exportSnapshotCode } from '../../ui/inspector/aiCodeHandoffClient'

export const aiCodeCommands: Record<string, Handler> = {
  export_ui_code: async (p) => {
    const rect = { left: num(p, 'left') ?? 0, top: num(p, 'top') ?? 0, width: num(p, 'width') ?? 0, height: num(p, 'height') ?? 0 }
    if (rect.width <= 0 || rect.height <= 0) throw new ParamError('Vùng quét phải có kích thước dương.')
    const snapshot = captureAiInspectorSnapshot(rect, Infinity)
    const bundle = await exportSnapshotCode(snapshot)
    if (bool(p, 'show') === true) window.dispatchEvent(new CustomEvent('pxs:ai-code-bundle', { detail: { ...bundle, snapshot } }))
    return { bundleId: bundle.id, files: bundle.files.map((f) => f.path), warnings: bundle.warnings, markdown: bundle.markdown }
  },
  import_ui_code: async (p) => {
    if (!window.api?.aiCode) throw new ParamError('Xuất/nhập code chỉ dùng trên app phát triển cục bộ.')
    const reply = str(p, 'reply')
    if (!reply) throw new ParamError('Thiếu JSON bản sửa.')
    return window.api.aiCode.import(reply, bool(p, 'apply') ?? false)
  },
  revert_ui_code: async (p) => {
    if (!window.api?.aiCode) throw new ParamError('Xuất/nhập code chỉ dùng trên app phát triển cục bộ.')
    const backupPath = str(p, 'backupPath')
    if (!backupPath) throw new ParamError('Thiếu backupPath để hoàn tác.')
    return window.api.aiCode.revert(backupPath)
  }
}
