import React, { useEffect, useRef, useState } from 'react'
import { evaluateLoopLayerRhythm } from '../../project/gifHelper'
import { getCachedLoopTemplateSheet } from './loopFrameExtractor'
import { resolveLoopAssetUrl } from './sampleLoops'
import type { LoopAnimationTemplate } from './types'

interface Props {
  template: LoopAnimationTemplate
  isPlaying: boolean
  width?: number
  height?: number
  className?: string
}

type Sheet = Awaited<ReturnType<typeof getCachedLoopTemplateSheet>>

/** Bộ nhớ đệm RAM lưu ảnh PNG tách nền của Frame #1 theo khoá template để hiển thị tức thì và kéo thả mượt mà */
const ghostThumbMemoryCache = new Map<string, string>()

function getTemplateThumbCacheKey(t: LoopAnimationTemplate): string {
  return `${t.id}|${t.imageUrl}|${t.updatedAt ?? 0}|${t.thumbnailFrameIndex ?? 0}|${t.chromaKey.enabled ? 1 : 0}|${t.chromaKey.keyColor}|${t.chromaKey.similarity}|${t.chromaKey.isolationMode ?? 'all'}|${t.chromaKey.shadowMode ?? 'off'}`
}

function nextCursor(
  mode: LoopAnimationTemplate['loopMode'],
  cursor: number,
  total: number,
  dir: { v: 1 | -1 }
): number {
  if (mode === 'random') {
    let next = Math.floor(Math.random() * total)
    if (next === cursor && total > 1) next = (next + 1) % total
    return next
  }
  if (mode === 'ping-pong') {
    let next = cursor + dir.v
    if (next >= total) {
      dir.v = -1
      next = Math.max(0, total - 2)
    } else if (next < 0) {
      dir.v = 1
      next = Math.min(total - 1, 1)
    }
    return next
  }
  return (cursor + 1) % total
}

/**
 * Canvas xem trước mẫu hoạt ảnh lặp: khi dừng chỉ vẽ Frame #1 (đã khử nền),
 * khi chạy thì phát vòng lặp 60fps theo FPS, kiểu lặp và logic Nhịp & Nháy của mẫu.
 * Đi kèm thẻ <img> bóng mờ tách nền để phục vụ tính năng kéo thả mượt mà 100% trong Electron / Chromium.
 */
export const LoopCardPreviewCanvas = React.memo(function LoopCardPreviewCanvas({
  template,
  isPlaying,
  width = 180,
  height = 140,
  className = 'loop-card-preview-canvas'
}: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sheetRef = useRef<Sheet>(null)
  const [sheetVersion, setSheetVersion] = useState(0)
  const cacheKey = getTemplateThumbCacheKey(template)
  const [ghostThumbUrl, setGhostThumbUrl] = useState<string | null>(
    () => ghostThumbMemoryCache.get(cacheKey) || template.renderedFrames?.[0] || template.thumbUrl || null
  )

  useEffect(() => {
    let cancelled = false
    const cached = ghostThumbMemoryCache.get(cacheKey) || template.renderedFrames?.[0] || template.thumbUrl
    const isPkgThumbUrl = Boolean(template.imageUrl && /thumbnail\.(png|webp|jpe?g)$/i.test(template.imageUrl))

    if (cached) {
      setGhostThumbUrl(cached)
    } else if (isPkgThumbUrl && template.imageUrl) {
      void resolveLoopAssetUrl(template.imageUrl).then((resolved) => {
        if (cancelled) return
        const url = resolved || template.imageUrl
        ghostThumbMemoryCache.set(cacheKey, url)
        setGhostThumbUrl(url)
      })
    }

    // Nếu thẻ đang ở trạng thái tĩnh (!isPlaying) và đã có ảnh thu nhỏ (thumbnail.png hoặc thumbUrl),
    // KHÔNG giải mã toàn bộ 16 frame 4K ngay lúc mount danh sách để chống đơ UI.
    if (!isPlaying && (cached || isPkgThumbUrl) && !sheetRef.current) {
      return () => {
        cancelled = true
      }
    }

    void getCachedLoopTemplateSheet(template).then((sheet) => {
      if (cancelled) return
      sheetRef.current = sheet
      setSheetVersion((v) => v + 1)
      if (sheet && sheet.frames.length > 0) {
        if (ghostThumbMemoryCache.has(cacheKey)) {
          setGhostThumbUrl(ghostThumbMemoryCache.get(cacheKey)!)
          return
        }
        try {
          const rawThumbIdx = sheet.packageJson?.thumbnailFrameIndex ?? template.thumbnailFrameIndex ?? 0
          const thumbIdx = Math.max(0, Math.min(sheet.frames.length - 1, rawThumbIdx))
          const f0 = sheet.frames[thumbIdx] ?? sheet.frames[0]
          if (f0) {
            const thumbScale = Math.min(1, 256 / Math.max(1, f0.width, f0.height))
            const tw = Math.max(1, Math.round(f0.width * thumbScale))
            const th = Math.max(1, Math.round(f0.height * thumbScale))
            const c = document.createElement('canvas')
            c.width = tw
            c.height = th
            const ctx = c.getContext('2d')
            if (ctx) {
              ctx.drawImage(sheet.canvas, f0.x, f0.y, f0.width, f0.height, 0, 0, tw, th)
              const dataUrl = c.toDataURL('image/png')
              ghostThumbMemoryCache.set(cacheKey, dataUrl)
              setGhostThumbUrl(dataUrl)
            }
          }
        } catch {
          /* ignore */
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [cacheKey, template, isPlaying])

  useEffect(() => {
    const canvas = canvasRef.current
    const sheet = sheetRef.current
    if (!canvas || !sheet || sheet.frames.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const cw = canvas.width
    const ch = canvas.height
    const rhythm = template.rhythm
    const hasRhythm = Boolean(rhythm && rhythm.rhythmMode !== 'none')

    const drawFrameAt = (frameIdx: number, nowSec: number): void => {
      const f = sheet.frames[frameIdx] ?? sheet.frames[0]
      if (!f) return
      ctx.clearRect(0, 0, cw, ch)
      const fx =
        isPlaying && hasRhythm && rhythm
          ? evaluateLoopLayerRhythm(
              {
                loopRhythmMode: rhythm.rhythmMode,
                loopRhythmRateHz: rhythm.rhythmRateHz,
                loopRhythmIntensity: rhythm.rhythmIntensity,
                loopMinOpacity: rhythm.minOpacity,
                loopScaleBeatPct: rhythm.scaleBeatPct,
                speed: template.speed ?? 1
              },
              nowSec,
              0
            )
          : { opacityMultiplier: 1, scaleMultiplier: 1 }
      const pad = Math.round(Math.min(cw, ch) * 0.07)
      const base = Math.min((cw - pad * 2) / Math.max(1, f.width), (ch - pad * 2) / Math.max(1, f.height))
      const scale = base * fx.scaleMultiplier
      const dw = Math.max(1, Math.round(f.width * scale))
      const dh = Math.max(1, Math.round(f.height * scale))
      const dx = Math.round((cw - dw) * 0.5 + (f.offsetX || 0) * scale)
      const dy = Math.round((ch - dh) * 0.5 + (f.offsetY || 0) * scale)
      ctx.save()
      ctx.globalAlpha = fx.opacityMultiplier
      ctx.drawImage(sheet.canvas, f.x, f.y, f.width, f.height, dx, dy, dw, dh)
      ctx.restore()
    }

    const rawThumbIdx = sheet.packageJson?.thumbnailFrameIndex ?? template.thumbnailFrameIndex ?? 0
    const thumbIdx = Math.max(0, Math.min(sheet.frames.length - 1, rawThumbIdx))
    if (!isPlaying || sheet.frames.length <= 1) {
      drawFrameAt(thumbIdx, 0)
      return
    }

    let rafId = 0
    let cursor = 0
    const dir: { v: 1 | -1 } = { v: 1 }
    let lastSwitch = performance.now()
    const total = sheet.frames.length
    const fps = Math.max(1, (template.fps || 12) * (template.speed || 1))
    drawFrameAt(0, lastSwitch / 1000)

    const tick = (now: number): void => {
      const intervalMs = (1000 / fps) * (sheet.frames[cursor]?.durationRatio || 1)
      if (now - lastSwitch >= intervalMs) {
        lastSwitch = now
        cursor = nextCursor(template.loopMode, cursor, total, dir)
        drawFrameAt(cursor, now / 1000)
      } else if (hasRhythm) {
        drawFrameAt(cursor, now / 1000)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, sheetVersion, template.fps, template.speed, template.loopMode, template.rhythm])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={className}
        style={{ visibility: !isPlaying && ghostThumbUrl ? 'hidden' : 'visible' }}
      />
      {ghostThumbUrl && (
        <img
          src={ghostThumbUrl}
          alt={template.name}
          className="loop-card-ghost-img"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            padding: '6px',
            objectFit: 'contain',
            opacity: isPlaying ? 0.001 : 1
          }}
        />
      )}
    </div>
  )
})
