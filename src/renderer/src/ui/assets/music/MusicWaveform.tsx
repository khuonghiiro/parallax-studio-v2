import { useRef, useEffect, useCallback, useState } from 'react'
import { formatAudioDuration } from '../MusicPanel'

interface MusicWaveformProps {
  peaks: Float32Array
  duration: number
  playbackTime: number
  isPlaying: boolean
  onSeek: (time: number) => void
  theme?: string
  height?: number
}

export function MusicWaveform({
  peaks,
  duration,
  playbackTime,
  isPlaying,
  onSeek,
  theme = 'dark',
  height = 36
}: MusicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Vẽ sóng âm lên Canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const width = Math.max(10, Math.floor(rect.width))
    const h = height

    // Tối ưu độ sắc nét trên màn hình Retina/High-DPI
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = h * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, h)

    const isLight = theme === 'light'
    const progress = duration > 0 ? Math.min(1, Math.max(0, playbackTime / duration)) : 0
    const progressX = Math.round(progress * width)

    // Nếu chưa có dữ liệu peaks (đang nạp hoặc file rỗng), vẽ các vạch placeholder giả lập tinh tế
    const peakCount = peaks.length
    const hasRealPeaks = peakCount > 0

    const barWidth = 2
    const barGap = 1
    const totalStep = barWidth + barGap
    const barCount = Math.floor(width / totalStep)

    for (let i = 0; i < barCount; i++) {
      const x = i * totalStep
      let amp = 0.3

      if (hasRealPeaks) {
        const peakIdx = Math.floor((i / barCount) * peakCount)
        amp = peaks[peakIdx] || 0.05
      } else {
        // Subtle rhythmic ambient waves
        amp = 0.15 + 0.25 * Math.sin(i * 0.3) * Math.cos(i * 0.15)
      }

      // Giới hạn chiều cao sóng âm
      const barHeight = Math.max(3, Math.round(amp * (h - 6)))
      const y = Math.round((h - barHeight) / 2)

      const isPlayed = x <= progressX

      if (isPlayed) {
        ctx.fillStyle = isLight ? '#0369a1' : '#38bdf8'
      } else {
        ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.28)' : 'rgba(255, 255, 255, 0.32)'
      }

      ctx.beginPath()
      // Vẽ góc bo tròn nhẹ cho vạch sóng âm
      const rx = barWidth / 2
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, rx) : ctx.fillRect(x, y, barWidth, barHeight)
      ctx.fill()
    }

    // Đường baseline mờ ở giữa
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(width, h / 2)
    ctx.stroke()

    // Kim phát (Playhead)
    if (progressX > 0 && progressX < width) {
      ctx.strokeStyle = isLight ? '#1d4ed8' : '#facc15'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(progressX, 1)
      ctx.lineTo(progressX, h - 1)
      ctx.stroke()

      // Đỉnh kim phát hình tam giác nhỏ
      ctx.fillStyle = isLight ? '#2563eb' : '#facc15'
      ctx.beginPath()
      ctx.moveTo(progressX - 3, 0)
      ctx.lineTo(progressX + 3, 0)
      ctx.lineTo(progressX, 4)
      ctx.closePath()
      ctx.fill()
    }
  }, [peaks, duration, playbackTime, theme, height])

  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  // Xử lý thay đổi kích thước cửa sổ
  useEffect(() => {
    const handleResize = () => drawWaveform()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWaveform])

  // Tính thời gian từ tọa độ chuột
  const getTimeFromPointer = (e: React.PointerEvent<HTMLDivElement>): number => {
    const container = containerRef.current
    if (!container || duration <= 0) return 0
    const rect = container.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true)
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const targetTime = getTimeFromPointer(e)
    onSeek(targetTime)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const targetTime = getTimeFromPointer(e)
    setHoverTime(targetTime)
    if (isDragging) {
      onSeek(targetTime)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      const el = e.currentTarget
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId)
      }
    }
  }

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverTime(null)
    }
  }

  const curSec = isPlaying ? playbackTime : hoverTime !== null ? hoverTime : 0

  return (
    <div
      ref={containerRef}
      className={`music-waveform-box${isPlaying ? ' playing' : ''}${isDragging ? ' dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      title="Click hoặc kéo trên sóng âm để tua vị trí phát"
    >
      <canvas ref={canvasRef} className="music-waveform-canvas" />

      {/* Thời gian hiển thị ở góc sóng âm */}
      <div className="music-waveform-overlay-time">
        <span className="cur">{formatAudioDuration(curSec)}</span>
        <span className="sep">/</span>
        <span className="total">{formatAudioDuration(duration)}</span>
      </div>

      {hoverTime !== null && !isDragging && (
        <div
          className="music-waveform-hover-tag"
          style={{
            left: `${Math.min(92, Math.max(8, (hoverTime / (duration || 1)) * 100))}%`
          }}
        >
          {formatAudioDuration(hoverTime)}
        </div>
      )}
    </div>
  )
}
