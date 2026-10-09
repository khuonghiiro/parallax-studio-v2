import { IconPlay, IconPause } from '../icons'

export interface LayerAssemblyTransportBarProps {
  duration?: number
  isPlaying: boolean
  onTogglePlay: () => void
  time: number
  onSeekTime: (t: number) => void
  onResetView?: () => void
  zoomPercent?: number
}

export function LayerAssemblyTransportBar({
  isPlaying,
  onTogglePlay,
  time,
  onSeekTime,
  onResetView,
  zoomPercent,
  duration = 4
}: LayerAssemblyTransportBarProps) {
  return (
    <div
      className="layer-workshop-transport-bar"
      style={{
        position: 'absolute',
        bottom: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'color-mix(in srgb, var(--bg-1) 85%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--line-soft)',
        borderRadius: '8px',
        padding: '5px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 50,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)'
      }}
    >
      <button
        type="button"
        className="btn sm icon"
        onClick={onTogglePlay}
        style={{ width: '28px', height: '28px' }}
        title={isPlaying ? 'Tạm dừng xem trước hoạt ảnh (Phím Space)' : 'Phát xem trước hoạt ảnh (Phím Space)'}
      >
        {isPlaying ? <IconPause width={14} height={14} /> : <IconPlay width={14} height={14} />}
      </button>

      <span style={{ fontSize: '11px', color: 'var(--text)', minWidth: '40px', fontFamily: 'monospace', fontWeight: 600 }}>
        {time.toFixed(2)}s
      </span>

      <input
        type="range"
        min="0"
        max={duration}
        step="0.05"
        value={Math.min(time, duration)}
        onChange={(e) => onSeekTime(Number(e.target.value))}
        style={{ width: '140px', accentColor: 'var(--accent)' }}
        title={`Tua mốc thời gian chuyển động (0s - ${duration}s)`}
      />

      {onResetView && typeof zoomPercent === 'number' && (
        <>
          <div style={{ width: '1px', height: '18px', background: 'var(--line-soft)' }} />
          <button
            type="button"
            className="btn sm"
            onClick={onResetView}
            title="Đặt lại tỉ lệ 100% và căn giữa"
            style={{ fontSize: '10.5px', padding: '2px 8px' }}
          >
            {zoomPercent}%
          </button>
        </>
      )}
    </div>
  )
}
