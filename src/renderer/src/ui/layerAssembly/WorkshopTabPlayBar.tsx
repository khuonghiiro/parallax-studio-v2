import type { LayerRig } from '@shared/layerRig'
import { IconPause, IconPlay, IconSkipStart, IconLoop, IconBone } from '../icons'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { setWorkshopPlayLink, useWorkshopPlayLink } from './workshopPlayLinkStore'

interface Props {
  mode: 'animation' | 'loop'
  playback: ReturnType<typeof useWorkshopPlayback>
  rig?: LayerRig
  fps: number
  loopCount: number
  onToggleRigLoop: () => void
}

/**
 * Thanh phát riêng của tab Anim & Gió / Loop (đặt ngay dưới dải tab con, áp dụng cho mọi phân khu):
 * - Anim & Gió: Phát / Dừng hành động xương, về F0, frame hiện tại, tốc độ, lặp vòng clip.
 * - Loop: Phát / Dừng hoạt ảnh Loop, công tắc "Kèm hành động xương" để khung xương + layer chạy cùng nhau.
 */
export function WorkshopTabPlayBar({ mode, playback, rig, fps, loopCount, onToggleRigLoop }: Props) {
  const link = useWorkshopPlayLink()
  const clip = rig?.clips?.find((c) => c.id === rig.activeClipId) ?? rig?.clips?.[0]
  const frame = Math.round(playback.time * fps)
  const totalFrames = Math.max(1, Math.round((rig?.duration ?? 0) * fps))
  const playing = playback.isPlaying
  const playLabel = mode === 'animation' ? (playing ? 'Dừng hành động' : 'Phát hành động') : playing ? 'Dừng Loop' : 'Phát Loop'
  const hasRig = Boolean(rig?.bones.length)

  return (
    <div className={`lw-tab-playbar mode-${mode}`} data-mcp-region="layer_assembly_tab_playbar" role="toolbar" aria-label={mode === 'animation' ? 'Điều khiển phát hành động' : 'Điều khiển phát Loop'}>
      <button type="button" className={`lw-tab-play-btn${playing ? ' is-playing' : ''}`} onClick={playback.toggle} title={playLabel} aria-pressed={playing}>
        {playing ? <IconPause width={13} height={13} /> : <IconPlay width={13} height={13} />}
        <span>{playLabel}</span>
        {mode === 'loop' && loopCount > 0 && <em>{loopCount}</em>}
      </button>
      <button
        type="button"
        className="lw-tab-play-icon"
        onClick={() => {
          playback.setIsPlaying(false)
          playback.setTime(0)
        }}
        title="Dừng & về Frame 0"
        aria-label="Dừng và về Frame 0"
      >
        <IconSkipStart width={13} height={13} />
      </button>

      {mode === 'animation' ? (
        <span className="lw-tab-play-readout" title={clip ? `Clip đang diễn: ${clip.name}` : 'Chưa có clip'}>
          <strong>F{frame}</strong>/{totalFrames}
          {clip && <span className="lw-tab-play-clip">{clip.name}</span>}
        </span>
      ) : (
        <button
          type="button"
          className={`lw-tab-play-link${link.loopRigAction && hasRig ? ' is-on' : ''}`}
          disabled={!hasRig}
          onClick={() => setWorkshopPlayLink({ loopRigAction: !link.loopRigAction })}
          aria-pressed={link.loopRigAction}
          title={
            hasRig
              ? link.loopRigAction
                ? `Đang kèm hành động "${clip?.name ?? 'clip'}": khung xương và layer chạy cùng Loop · bấm để chỉ chạy Loop`
                : 'Chỉ chạy hoạt ảnh Loop, nhân vật đứng yên · bấm để kèm hành động xương'
              : 'Mẫu chưa có khung xương'
          }
        >
          <IconBone width={12} height={12} />
          <span>{link.loopRigAction && hasRig ? 'Kèm hành động' : 'Chỉ Loop'}</span>
        </button>
      )}

      <span className="lw-tab-play-spacer" />
      <button type="button" className={`lw-tab-play-icon is-text${playback.speed !== 1 ? ' is-on' : ''}`} onClick={playback.cycleSpeed} title={`Tốc độ phát ${playback.speed}× (0.5× · 1× · 1.5× · 2×)`}>
        {playback.speed}×
      </button>
      {mode === 'animation' && (
        <button type="button" className={`lw-tab-play-icon${rig?.loop ? ' is-on' : ''}`} onClick={onToggleRigLoop} disabled={!hasRig} aria-pressed={Boolean(rig?.loop)} title={rig?.loop ? 'Đang lặp vòng clip · bấm để phát 1 lần' : 'Phát 1 lần · bấm để lặp vòng'}>
          <IconLoop width={13} height={13} />
        </button>
      )}
    </div>
  )
}
