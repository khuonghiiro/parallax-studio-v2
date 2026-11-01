import type { LoopFrame, LoopPlaybackConfig } from './types'
import { assetStore, type AnimatedGifData, type GifFrame } from '../../project/assets'
import { useEditor } from '../../store/editor'
import { createImageLayer } from '../../project/factory'
import { toast } from '../../actions'

export interface ApplyLoopToProjectOptions {
  name: string
  sourceCanvas: HTMLCanvasElement
  frames: LoopFrame[]
  playback: LoopPlaybackConfig
  shotId?: string | null
  speed?: number
  position?: [number, number, number]
}

/**
 * Đưa hoạt ảnh lặp trực tiếp vào Dự án thành một ImageLayer động.
 * Động cơ Parallax Studio sẽ tự động phát loop tuần hoàn trong không gian 2.5D!
 */
export async function applyLoopAnimationToProject(
  options: ApplyLoopToProjectOptions
): Promise<string | null> {
  const { name, sourceCanvas, frames, playback, shotId, speed = 1, position } = options

  const enabledFrames = frames.filter((f) => f.enabled)
  if (enabledFrames.length === 0) {
    window.alert('Cần ít nhất 1 khung hình được bật để đưa vào dự án!')
    return null
  }

  const fps = Math.max(1, Math.min(60, playback.fps || 12))
  const baseFrameDur = 1 / fps

  try {
    const gifFrames: GifFrame[] = []
    let totalDuration = 0

    for (let i = 0; i < enabledFrames.length; i++) {
      const f = enabledFrames[i]
      const durSec = baseFrameDur * Math.max(0.1, f.durationMultiplier || 1)

      // Cắt bitmap cho frame này
      const frameCanvas = document.createElement('canvas')
      frameCanvas.width = Math.max(1, f.width)
      frameCanvas.height = Math.max(1, f.height)
      const fctx = frameCanvas.getContext('2d')
      if (fctx) {
        fctx.drawImage(
          sourceCanvas,
          f.x,
          f.y,
          f.width,
          f.height,
          0,
          0,
          f.width,
          f.height
        )
      }

      const bmp = await createImageBitmap(frameCanvas, {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'none'
      })

      gifFrames.push({
        index: i,
        duration: durSec,
        startTime: totalDuration,
        bitmap: bmp
      })

      totalDuration += durSec
    }

    const firstFrame = enabledFrames[0]
    const width = firstFrame.width
    const height = firstFrame.height

    const animatedData: AnimatedGifData = {
      frames: gifFrames,
      totalDuration: Math.max(0.04, totalDuration),
      width,
      height
    }

    // Xuất frame đầu tiên làm thumbnail/preview image binary
    const previewDataUrl = sourceCanvas.toDataURL('image/png')
    const base64Data = previewDataUrl.split(',')[1]
    const binStr = atob(base64Data)
    const binLen = binStr.length
    const bytes = new Uint8Array(binLen)
    for (let i = 0; i < binLen; i++) {
      bytes[i] = binStr.charCodeAt(i)
    }

    const assetName = `${name || 'Loop_Animation'}.png`
    const runtimeAsset = await assetStore.add(assetName, 'image/png', bytes, 'image')

    // Gán dữ liệu hoạt họa thời gian thực vào RuntimeAsset
    runtimeAsset.gif = animatedData
    runtimeAsset.meta.isAnimated = true
    runtimeAsset.meta.frameCount = gifFrames.length
    runtimeAsset.meta.duration = animatedData.totalDuration
    runtimeAsset.meta.width = width
    runtimeAsset.meta.height = height

    // Tạo Layer trong dự án
    let createdLayerId: string | null = null

    useEditor.getState().update((d) => {
      d.assets.push(runtimeAsset.meta)

      const targetShotId = shotId !== undefined ? shotId : useEditor.getState().selectedShotId
      const layer = createImageLayer(runtimeAsset.meta, d.comp, 0, targetShotId || undefined)

      layer.name = name || 'Hoạt ảnh lặp'
      layer.props.loopMode = playback.loopMode
      layer.props.speed = speed
      layer.props.autoPlayPaused = true

      if (position) {
        layer.transform.position.value = [position[0], position[1], position[2]]
      }

      d.layers.unshift(layer)
      createdLayerId = layer.id
    })

    if (createdLayerId) {
      useEditor.getState().selectLayer(createdLayerId)
    }

    toast(`Đã thêm Hoạt ảnh lặp "${name}" (${enabledFrames.length} frames) vào cảnh!`)
    return createdLayerId
  } catch (err) {
    console.error('[loopAnimationExporter] Error creating animated layer:', err)
    window.alert(`Lỗi khi tạo layer hoạt ảnh:\n${String(err)}`)
    return null
  }
}
