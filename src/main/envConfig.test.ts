import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { loadAppDotEnv, parseDotEnvContent } from './envConfig'

describe('envConfig (.env parser & loader)', () => {
  it('parses comments, quotes, URLs with #, and export prefixes cleanly', () => {
    const raw = [
      '# Cấu hình mẫu',
      'PARALLAX_ANGLE=d3d11on12 # chọn backend GPU',
      'ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/#fast',
      'FFMPEG_BIN="C:\\\\Tools\\\\ffmpeg\\\\bin\\\\ffmpeg.exe"',
      "CUSTOM_LABEL='Parallax 2.5D #1'",
      'export PARALLAX_MCP_PORT=9888',
      'EMPTY_KEY='
    ].join('\n')

    const parsed = parseDotEnvContent(raw)
    expect(parsed).toEqual({
      PARALLAX_ANGLE: 'd3d11on12',
      ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/#fast',
      FFMPEG_BIN: 'C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe',
      CUSTOM_LABEL: 'Parallax 2.5D #1',
      PARALLAX_MCP_PORT: '9888',
      EMPTY_KEY: ''
    })
  })

  it('auto-seeds .env from .env.example, preserves explicit env vars, and normalizes RAYON_NUM_THREADS=0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-dotenv-'))
    try {
      writeFileSync(
        join(dir, '.env.example'),
        ['PXS_DISABLE_NAPI=0', 'RAYON_NUM_THREADS=0', 'PARALLAX_MCP_PORT=9899', 'FFMPEG_BIN='].join('\n'),
        'utf-8'
      )

      const fakeEnv: NodeJS.ProcessEnv = { PARALLAX_MCP_PORT: '9901' }
      loadAppDotEnv({ cwd: dir, envMap: fakeEnv })

      // Đã tự tạo file .env từ .env.example
      expect(existsSync(join(dir, '.env'))).toBe(true)
      expect(readFileSync(join(dir, '.env'), 'utf-8')).toContain('PXS_DISABLE_NAPI=0')

      // Không ghi đè biến đã truyền sẵn từ môi trường ngoài
      expect(fakeEnv.PARALLAX_MCP_PORT).toBe('9901')
      expect(fakeEnv.PXS_DISABLE_NAPI).toBe('0')
      // RAYON_NUM_THREADS=0 được xoá để Rayon tự nhận toàn bộ luồng CPU
      expect(fakeEnv.RAYON_NUM_THREADS).toBeUndefined()
      expect(fakeEnv.FFMPEG_BIN).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
