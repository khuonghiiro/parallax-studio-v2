import { formatTimecode, snapToFrame } from '../../animation/math'
import {
  IconLoop,
  IconPause,
  IconPlay,
  IconSkipEnd,
  IconSkipStart,
  IconStepBack,
  IconStepFwd
} from '../icons'

export interface TimelineTransportProps {
  time: number
  fps: number
  duration: number
  playing: boolean
  loop: boolean
  setTime: (t: number) => void
  setPlaying: (playing: boolean) => void
  setLoop: (loop: boolean) => void
}

export function TimelineTransport({
  time,
  fps,
  duration,
  playing,
  loop,
  setTime,
  setPlaying,
  setLoop
}: TimelineTransportProps) {
  return (
    <div className="transport">
      <button
        id="tl-start"
        className="btn ghost icon"
        title="Về đầu (Home)"
        onClick={() => setTime(0)}
      >
        <IconSkipStart />
      </button>
      <button
        id="tl-prev"
        className="btn ghost icon"
        title="Lùi 1 frame (←)"
        onClick={() => setTime(snapToFrame(time - 1 / fps, fps))}
      >
        <IconStepBack />
      </button>
      <button
        id="tl-play"
        className="btn primary icon"
        title="Phát / Dừng (Space)"
        onClick={() => {
          if (!playing && time >= duration - 1e-3) setTime(0)
          setPlaying(!playing)
        }}
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <button
        id="tl-next"
        className="btn ghost icon"
        title="Tiến 1 frame (→)"
        onClick={() => setTime(snapToFrame(time + 1 / fps, fps))}
      >
        <IconStepFwd />
      </button>
      <button
        id="tl-end"
        className="btn ghost icon"
        title="Về cuối (End)"
        onClick={() => setTime(duration)}
      >
        <IconSkipEnd />
      </button>
      <button
        id="tl-loop"
        className={`btn ghost icon${loop ? ' active' : ''}`}
        title="Lặp lại"
        onClick={() => setLoop(!loop)}
      >
        <IconLoop />
      </button>
      <div className="timecode">
        {formatTimecode(time, fps)}
        <small>
          {Math.round(time * fps)} / {Math.round(duration * fps)}f
        </small>
      </div>
      <span style={{ flex: 1 }} />
      <span className="hint-text">
        Kéo ◆ để đổi thời điểm · Double-click ◆ để nhảy tới · Del để xoá
      </span>
    </div>
  )
}
