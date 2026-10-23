import type { Animatable, AnimValue } from '@shared/types'
import { frameTolerance, getDraftAnimatable, useEditor, type PropRef } from '../../store/editor'
import { endTimelineRange, startTimelineRange, timelineRangeAt } from '../../animation/timelineRange'

export function TimelineRangeControls({ animation, refp }: { animation: Animatable<AnimValue>; refp: PropRef }) {
  const time = useEditor(s => s.time)
  const { start, end } = timelineRangeAt(animation, time)
  const last = animation.keyframes.at(-1)
  const tolerance = frameTolerance(useEditor.getState().project)
  const jump = (id: string, t: number) => {
    const editor = useEditor.getState()
    editor.setPlaying(false)
    editor.setTime(t)
    editor.selectKey({ ref: refp, keyId: id })
  }
  const create = (boundary: 'start' | 'end') => {
    const editor = useEditor.getState()
    editor.setPlaying(false)
    let id = ''
    editor.update(d => {
      const a = getDraftAnimatable(d, refp)
      if (a) id = (boundary === 'start' ? startTimelineRange : endTimelineRange)(a, time, tolerance).id
    })
    if (id) jump(id, time)
  }
  return <div className="tl-range-controls">
    <button className={`tl-range-start${start && Math.abs(time - start.t) <= tolerance ? ' active' : ''}`}
      title="Đặt đầu đoạn tại đầu phát; bấm lại để chọn và sửa mốc, không xóa"
      onClick={() => start ? jump(start.id, start.t) : create('start')}>
      ◆ Đầu{start ? ` ${start.t.toFixed(2)}s` : ''}</button>
    <button className={`tl-range-end${end && Math.abs(time - end.t) <= tolerance ? ' active' : ''}`}
      disabled={!start || (!end && time <= start.t + tolerance)}
      title="Chuyển đầu phát tới thời gian sau mốc đầu rồi đặt cuối đoạn; bấm lại để sửa"
      onClick={() => end ? jump(end.id, end.t) : create('end')}>
      ◆ Cuối{end ? ` ${end.t.toFixed(2)}s` : ''}</button>
    {end && <button disabled={!!last && time <= last.t + tolerance}
      title="Đặt đầu phát sau mốc cuối rồi thêm đoạn chuyển động tiếp theo"
      onClick={() => create('start')}>+ Đoạn</button>}
  </div>
}
