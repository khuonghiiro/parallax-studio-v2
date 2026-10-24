import React, { useMemo } from 'react'
import { IconMusic, IconPause, IconPlay } from '../icons'

interface AudioCardPreviewProps {
  name: string
  categoryHint?: string
  isPlaying: boolean
  onTogglePlay: (e: React.MouseEvent) => void
}

type AudioVisualTone = 'music' | 'ambient' | 'sfx' | 'voice'

function detectAudioTone(name: string, categoryHint?: string): AudioVisualTone {
  const s = `${name} ${categoryHint || ''}`.toLowerCase()
  if (s.includes('giọng') || s.includes('thoại') || s.includes('voice') || s.includes('vocal')) {
    return 'voice'
  }
  if (
    s.includes('vút') ||
    s.includes('chuyển') ||
    s.includes('sfx') ||
    s.includes('hiệu ứng') ||
    s.includes('bước') ||
    s.includes('nổ') ||
    s.includes('whoosh') ||
    s.includes('hit')
  ) {
    return 'sfx'
  }
  if (
    s.includes('gió') ||
    s.includes('mưa') ||
    s.includes('đêm') ||
    s.includes('rừng') ||
    s.includes('suối') ||
    s.includes('chuông') ||
    s.includes('ambient') ||
    s.includes('thiên nhiên')
  ) {
    return 'ambient'
  }
  return 'music'
}

export function AudioCardPreview({
  name,
  categoryHint,
  isPlaying,
  onTogglePlay
}: AudioCardPreviewProps) {
  const tone = useMemo(() => detectAudioTone(name, categoryHint), [name, categoryHint])

  // Sinh dải vạch sóng âm đặc trưng theo tên bài để mỗi item có hình dáng sóng âm riêng
  const bars = useMemo(() => {
    let seed = 0
    for (let i = 0; i < name.length; i++) {
      seed = (seed * 31 + name.charCodeAt(i)) >>> 0
    }
    const count = 19
    const out: number[] = []
    for (let i = 0; i < count; i++) {
      const centerDist = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2)
      const envelope = 1 - centerDist * 0.55
      const waveA = Math.sin((i + (seed % 7)) * 0.85) * 0.5 + 0.5
      const waveB = Math.cos((i * 1.4) + ((seed >> 3) % 11)) * 0.5 + 0.5
      const h = Math.max(0.18, Math.min(0.95, (waveA * 0.6 + waveB * 0.4) * envelope))
      out.push(h)
    }
    return out
  }, [name])

  return (
    <div className={`audio-card-inner tone-${tone}${isPlaying ? ' is-playing' : ''}`}>
      {/* Hình nền đồ họa sóng âm & đĩa nhạc Studio */}
      <svg
        className="audio-card-backdrop-svg"
        viewBox="0 0 160 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Lưới studio mảnh */}
        <line x1="0" y1="50" x2="160" y2="50" className="audio-svg-baseline" />
        <line x1="0" y1="26" x2="160" y2="26" className="audio-svg-gridline" />
        <line x1="0" y1="74" x2="160" y2="74" className="audio-svg-gridline" />

        {/* Vòng hào quang âm học đồng tâm */}
        <circle cx="80" cy="46" r="34" className="audio-svg-ring outer" />
        <circle cx="80" cy="46" r="22" className="audio-svg-ring inner" />

        {/* Đường cong sóng hài nền */}
        <path
          d="M 0 50 Q 20 26, 40 50 T 80 50 T 120 50 T 160 50"
          className="audio-svg-sine"
        />

        {/* Dãy thanh phổ Equalizer đối xứng */}
        {bars.map((amp, idx) => {
          const barW = 4.2
          const gap = 3.2
          const totalW = bars.length * barW + (bars.length - 1) * gap
          const startX = (160 - totalW) / 2
          const x = startX + idx * (barW + gap)
          const h = Math.round(amp * 54)
          const y = Math.round(46 - h / 2)
          return (
            <rect
              key={idx}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              className="audio-svg-bar"
              style={{ animationDelay: `${(idx % 6) * 0.12}s` }}
            />
          )
        })}
      </svg>

      {/* Biểu tượng nốt nhạc trang trí góc phải trên khi chưa hover */}
      <span className="audio-card-motif-icon" aria-hidden="true">
        <IconMusic width={14} height={14} />
      </span>

      {/* Nút Play/Pause nổi bật khi hover hoặc đang phát */}
      <button
        type="button"
        className={`btn sm icon audio-preview-btn${isPlaying ? ' active' : ''}`}
        title={isPlaying ? 'Dừng nghe thử' : 'Nghe thử âm thanh này'}
        onClick={onTogglePlay}
      >
        {isPlaying ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
      </button>
    </div>
  )
}
