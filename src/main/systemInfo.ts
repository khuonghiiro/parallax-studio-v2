import os from 'os'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { SystemHardwareInfo } from '@shared/ipc'

const execAsync = promisify(exec)
let cachedInfo: SystemHardwareInfo | null = null

export async function getSystemHardwareInfo(): Promise<SystemHardwareInfo> {
  if (cachedInfo) return cachedInfo

  const totalRamMB = Math.round(os.totalmem() / (1024 * 1024))
  const freeRamMB = Math.round(os.freemem() / (1024 * 1024))
  const cpuModel = os.cpus()[0]?.model || 'Unknown CPU'
  let gpuName = 'Unknown GPU'
  let gpuVramMB: number | undefined

  if (process.platform === 'win32') {
    try {
      // 1. Try registry for exact 64-bit VRAM size (qwMemorySize)
      const regCmd =
        'powershell -NoProfile -Command "Get-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\000*\' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc } | Select-Object DriverDesc, \'HardwareInformation.qwMemorySize\' | ConvertTo-Json"'
      const { stdout } = await execAsync(regCmd, { timeout: 3500 })
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout.trim())
        const item = Array.isArray(parsed) ? parsed.find((p) => p['HardwareInformation.qwMemorySize']) || parsed[0] : parsed
        if (item?.DriverDesc) gpuName = item.DriverDesc
        const rawBytes = item?.['HardwareInformation.qwMemorySize']
        if (typeof rawBytes === 'number' && rawBytes > 0) {
          gpuVramMB = Math.round(rawBytes / (1024 * 1024))
        }
      }
    } catch {
      // fallback
    }

    if (!gpuVramMB || gpuName === 'Unknown GPU') {
      try {
        const wmiCmd =
          'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json"'
        const { stdout } = await execAsync(wmiCmd, { timeout: 3500 })
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout.trim())
          const item = Array.isArray(parsed) ? parsed[0] : parsed
          if (item?.Name && gpuName === 'Unknown GPU') gpuName = item.Name
          if (item?.AdapterRAM && !gpuVramMB) {
            gpuVramMB = Math.round(Number(item.AdapterRAM) / (1024 * 1024))
          }
        }
      } catch {
        // fallback
      }
    }
  }

  // Fallback to electron GPU info if still missing
  if (gpuName === 'Unknown GPU') {
    try {
      const g = await app.getGPUInfo('basic')
      const aux = (g as Record<string, any>)?.auxAttributes?.glRenderer
      if (aux) gpuName = aux
    } catch {
      // ignore
    }
  }

  cachedInfo = {
    totalRamMB,
    freeRamMB,
    cpuModel,
    gpuName,
    gpuVramMB,
    platform: process.platform
  }
  return cachedInfo
}
