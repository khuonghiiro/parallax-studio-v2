import { useEffect, useState } from 'react'
import type { BuiltInAssetItem } from '@shared/ipc'
import { assetStore } from '../../project/assets'

class AudioPreviewManager {
  private currentId: string | null = null
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private listeners = new Set<(id: string | null) => void>()

  getCurrentId(): string | null {
    return this.currentId
  }

  subscribe(fn: (id: string | null) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.currentId)
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
      this.audio.src = ''
      this.audio = null
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.currentId = null
    this.notify()
  }

  async playBlob(id: string, blob: Blob): Promise<void> {
    if (this.currentId === id) {
      this.stop()
      return
    }
    this.stop()

    try {
      this.objectUrl = URL.createObjectURL(blob)
      const el = new Audio(this.objectUrl)
      this.audio = el
      this.currentId = id
      this.notify()

      el.onended = () => {
        this.stop()
      }
      el.onerror = () => {
        this.stop()
      }
      await el.play()
    } catch (err) {
      console.warn('[AudioPreviewManager] Play failed:', err)
      this.stop()
    }
  }

  async toggleProjectAsset(assetId: string): Promise<void> {
    if (this.currentId === assetId) {
      this.stop()
      return
    }
    const asset = assetStore.get(assetId)
    if (!asset || asset.meta.kind !== 'audio') return
    await this.playBlob(assetId, asset.blob)
  }

  async toggleBuiltInAsset(item: BuiltInAssetItem): Promise<void> {
    if (this.currentId === item.id) {
      this.stop()
      return
    }
    if (item.kind !== 'audio') return

    // If pre-existing previewUrl
    if (item.previewUrl) {
      this.stop()
      const el = new Audio(item.previewUrl)
      this.audio = el
      this.currentId = item.id
      this.notify()
      el.onended = () => this.stop()
      el.onerror = () => this.stop()
      await el.play().catch(() => this.stop())
      return
    }

    // Load bytes via main IPC
    const file = await window.api.loadBuiltInAssetBytes(item.relativePath)
    if (!file) return
    const blob = new Blob([file.data], { type: file.mime || 'audio/mpeg' })
    await this.playBlob(item.id, blob)
  }
}

export const audioPreview = new AudioPreviewManager()

export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(audioPreview.getCurrentId())

  useEffect(() => {
    return audioPreview.subscribe(setPlayingId)
  }, [])

  return {
    playingId,
    toggleProjectAsset: (id: string) => audioPreview.toggleProjectAsset(id),
    toggleBuiltInAsset: (item: BuiltInAssetItem) => audioPreview.toggleBuiltInAsset(item),
    stop: () => audioPreview.stop()
  }
}
