import { beforeEach, expect, it, vi } from 'vitest'
import { createProject } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { runExport } from '../../export/runExport'
import { projectCommands } from './projectCommands'
const command = { reqId: 'test', method: 'export_video', params: {} }

vi.mock('../../export/runExport', () => ({ isExporting: () => false, runExport: vi.fn() }))

beforeEach(() => {
  useEditor.getState().loadProject(createProject(), null)
  vi.mocked(runExport).mockReset()
})

it.each(['auto', 'rgba', 'yuv420p'])('passes pixel format %s through MCP and reports the negotiated result', async (format) => {
  const outcome = { ok: true, outPath: 'D:/out/test.mp4', frames: 30, seconds: 1, pixelFormat: 'rgba' as const }
  vi.mocked(runExport).mockResolvedValue(outcome)
  const result = await projectCommands.export_video({ out_path: outcome.outPath, pixel_format: format, readback: 'sync' }, command)
  expect(runExport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ pixelFormat: format, readback: 'sync' }))
  expect(result).toEqual(outcome)
})

it('surfaces export errors through MCP', async () => {
  vi.mocked(runExport).mockResolvedValue({ ok: false, error: 'GPU YUV failed', outPath: '', frames: 0, seconds: 0 })
  await expect(projectCommands.export_video({ out_path: 'D:/out/test.mp4' }, command)).rejects.toThrow('GPU YUV failed')
})
