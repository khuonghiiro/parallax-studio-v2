import { ParamSlider } from './WorkflowV2NodeParams'
import type { BboxMotionModel } from './useBboxMotionModel'

export function BboxMotionTimingSection({ model }: { model: BboxMotionModel }) {
  const { compDur, tStart, runDuration, applyBboxPatch } = model
  return (
<div className="vl-subcard" style={{ padding: '6px 7px' }}>
        <ParamSlider
          layout="stacked"
          label="Bắt đầu"
          min={0}
          max={Math.max(0.5, Number((compDur - 0.3).toFixed(1)))}
          step={0.1}
          value={tStart}
          format={(v) => `${v.toFixed(1)}s`}
          onChange={(nextStart) => {
            const cleanStart = Number(Math.max(0, Math.min(compDur - 0.3, nextStart)).toFixed(2))
            const cleanEnd = Number(Math.min(compDur, cleanStart + runDuration).toFixed(2))
            applyBboxPatch({ timeStart: cleanStart, timeEnd: cleanEnd }, 'wf-bbox-tstart')
          }}
        />
        <ParamSlider
          layout="stacked"
          label="Thời lượng"
          min={0.3}
          max={Math.max(1.0, Number((compDur - tStart).toFixed(1)))}
          step={0.1}
          value={runDuration}
          format={(v) => `${v.toFixed(1)}s (${tStart.toFixed(1)}s→${(tStart + v).toFixed(1)}s)`}
          onChange={(nextDur) => {
            const cleanEnd = Number(Math.min(compDur, tStart + Math.max(0.3, nextDur)).toFixed(2))
            applyBboxPatch({ timeStart: tStart, timeEnd: cleanEnd }, 'wf-bbox-dur')
          }}
        />
      </div>
  )
}
