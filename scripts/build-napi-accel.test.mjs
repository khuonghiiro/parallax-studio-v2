import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { promoteStagedAddonFile } from '../src/main/pxsNapiBinding'
import {
  deployCompiledAddon,
  promotePendingAddon,
  resolveNodeAddonFileName,
  resolveStagedAddonFileName
} from './build-napi-accel.mjs'

describe('build-napi-accel Windows EBUSY lock staging & startup promotion', () => {
  it('preserves .node extension on staged file so Node dlopen can load it directly', () => {
    const addonName = resolveNodeAddonFileName('win32', 'x64')
    expect(addonName).toBe('pxs_native_napi.win32-x64.node')
    expect(resolveStagedAddonFileName(addonName)).toBe('pxs_native_napi.win32-x64.next.node')
  })

  it('stages *.next.node when Electron holds EBUSY lock, then promotes on next startup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pxs-napi-stage-'))
    try {
      const addonName = 'pxs_native_napi.win32-x64.node'
      const dylibPath = join(dir, 'pxs_native_napi.dll')
      const outDir = join(dir, 'native')

      // 1. Lần build đầu tiên: ghi thẳng thành công ra .node
      writeFileSync(dylibPath, Buffer.from([1, 2, 3, 4]))
      const first = deployCompiledAddon({ dylibPath, outDir, addonName })
      expect(first.status).toBe('updated')
      expect(existsSync(join(outDir, addonName))).toBe(true)

      // 2. Build lại cùng nội dung byte: bỏ qua ghi thừa
      const same = deployCompiledAddon({ dylibPath, outDir, addonName })
      expect(same.status).toBe('unchanged')

      // 3. Có bản Rust mới nhưng Electron đang khoá file .node (EBUSY trên Windows)
      writeFileSync(dylibPath, Buffer.from([9, 8, 7, 6, 5]))
      const lockedCopy = (src, dest) => {
        if (dest.endsWith(addonName) && !dest.endsWith('.next.node')) {
          const err = new Error('resource busy or locked')
          err.code = 'EBUSY'
          throw err
        }
        writeFileSync(dest, readFileSync(src))
      }

      const staged = deployCompiledAddon({
        dylibPath,
        outDir,
        addonName,
        copyFileImpl: lockedCopy
      })
      expect(staged.status).toBe('staged')
      expect(staged.path.endsWith('.next.node')).toBe(true)
      expect(Array.from(readFileSync(join(outDir, addonName)))).toEqual([1, 2, 3, 4])
      expect(Array.from(readFileSync(staged.path))).toEqual([9, 8, 7, 6, 5])

      // 4. Khi file gốc vẫn khoá mà tiến trình thứ 2 khởi động -> trả đường dẫn *.next.node (đuôi .node hợp lệ)
      const fallbackWhileLocked = promoteStagedAddonFile(join(outDir, addonName), lockedCopy)
      expect(fallbackWhileLocked).toBe(staged.path)
      expect(fallbackWhileLocked.endsWith('.node')).toBe(true)

      // 5. Khi Electron cũ đã đóng (nhả khoá) -> promote nâng cấp đè sang .node và dọn sạch *.next.node
      const promoted = promotePendingAddon({ outDir, addonName })
      expect(promoted.promoted).toBe(true)
      expect(Array.from(readFileSync(join(outDir, addonName)))).toEqual([9, 8, 7, 6, 5])
      expect(existsSync(staged.path)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
