import type { EaseName } from '@shared/types'
import { EASE_LABELS } from '../../animation/easing'
import { getAnimatable, getDraftAnimatable, useEditor, type PropRef } from '../../store/editor'
import { NumberInput, Row, Select } from '../controls'

export function KeyEaseSection({ match }: { match: (ref: PropRef) => boolean }) {
  const sel = useEditor((s) => s.selectedKey)
  const project = useEditor((s) => s.project)
  const update = useEditor((s) => s.update)
  if (!sel || !match(sel.ref)) return null
  const a = getAnimatable(project, sel.ref)
  const key = a?.keyframes.find((k) => k.id === sel.keyId)
  if (!key) return null

  const easeOptions = (Object.keys(EASE_LABELS) as EaseName[]).map((k) => ({
    value: k,
    label: EASE_LABELS[k]
  }))

  return (
    <div className="section">
      <div className="section-title">Keyframe đang chọn</div>
      <Row label="Thời điểm">
        <NumberInput
          value={key.t}
          step={1 / project.comp.fps}
          precision={2}
          min={0}
          max={project.comp.duration}
          suffix="s"
          onChange={(v) =>
            update((d) => {
              const da = getDraftAnimatable(d, sel.ref)
              const k = da?.keyframes.find((x) => x.id === sel.keyId)
              if (da && k) {
                k.t = v
                da.keyframes.sort((x, y) => x.t - y.t)
              }
            }, `keytime-${sel.keyId}`)
          }
        />
      </Row>
      <Row label="Easing">
        <Select
          id="key-ease"
          value={key.ease}
          options={easeOptions}
          onChange={(val) =>
            update((d) => {
              const k = getDraftAnimatable(d, sel.ref)?.keyframes.find((x) => x.id === sel.keyId)
              if (k) k.ease = val as EaseName
            })
          }
        />
      </Row>
    </div>
  )
}
