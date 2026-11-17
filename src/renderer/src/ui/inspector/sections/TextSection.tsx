import type { SubtitlePositionPreset, TextProps } from '@shared/types'
import { toast } from '../../../actions'
import {
  SUBTITLE_STYLE_PRESETS,
  applySubtitleDefaultsToAllNodes,
  computeSubtitlePlacement,
  enforceSpeakerAndSceneContinuity
} from '../../../project/subtitleAndDialogueSync'
import { syncWorkflowV2Graph } from '../../../project/workflowV2Sync'
import { useEditor } from '../../../store/editor'
import { ColorInput, NumberInput, Row, Select, Switch, TextInput } from '../../controls'
import { FONTS, type Setter } from '../types'

const POS_PRESETS: { value: SubtitlePositionPreset; label: string }[] = [
  { value: 'bottom_center', label: '⬇ Đáy giữa màn hình' },
  { value: 'top_center', label: '⬆ Đỉnh giữa màn hình' },
  { value: 'above_speaker', label: '🗣️ Trên đầu nhân vật' },
  { value: 'below_speaker', label: '🧍 Dưới chân nhân vật' },
  { value: 'speech_left', label: '💬 Bên trái nhân vật' },
  { value: 'speech_right', label: '💬 Bên phải nhân vật' },
  { value: 'custom', label: '🎯 Tuỳ chỉnh tọa độ X/Y' }
]

export function TextSection({ props, set }: { props: TextProps; set: Setter }) {
  const project = useEditor((s) => s.project)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const editorUpdate = useEditor((s) => s.update)

  const p = (fn: (tp: TextProps) => void, key?: string): void =>
    set((l) => {
      if (l.type === 'text') fn(l.props)
    }, key)

  const candidateSpeakers = project.layers.filter(
    (l) => l.id !== selectedLayerId && l.type === 'image' && (!l.composite || l.composite.isRoot)
  )

  const handleApplyToAllSubtitles = (): void => {
    let updated = 0
    let skipped = 0
    editorUpdate((d) => {
      const res = applySubtitleDefaultsToAllNodes(d, {
        fontFamily: props.fontFamily,
        fontSize: props.fontSize,
        fontWeight: props.fontWeight,
        color: props.color,
        strokeColor: props.strokeColor ?? '#0a3d6e',
        strokeWidth: props.strokeWidth ?? 6,
        glowColor: props.glowColor,
        boxColor: props.boxColor ?? '',
        boxOpacity: props.boxOpacity ?? 0,
        align: props.align ?? 'center',
        positionPreset: props.subtitlePositionPreset ?? 'bottom_center',
        offsetX: props.subtitleOffsetX ?? 0,
        offsetY: props.subtitleOffsetY ?? -390
      })
      updated = res.updatedCount
      skipped = res.skippedProtectedCount
      d.workflow = syncWorkflowV2Graph(d, d.workflow)
    }, 'text-section-apply-all-sub')
    toast(
      skipped > 0
        ? `💬 Đã áp dụng cấu hình cho ${updated} Vietsub (Đã bảo vệ ${skipped} node khoá đặc biệt 🔒)`
        : `💬 Đã áp dụng cấu hình cho toàn bộ ${updated} Vietsub!`
    )
  }

  return (
    <div className="section" data-mcp-region="inspector_text_section">
      <div className="section-title">Văn bản &amp; Phụ đề Vietsub</div>
      <TextInput id="text-content" multiline value={props.text} onCommit={(v) => p((t) => void (t.text = v), 'text')} />
      <div style={{ height: 6 }} />
      <Row label="Gắn nhân vật">
        <Select
          value={props.speakerLayerId ?? ''}
          options={[
            { value: '', label: '— Phụ đề chung (Không gắn riêng) —' },
            ...candidateSpeakers.map((sp) => ({ value: sp.id, label: `🗣️ ${sp.name}` }))
          ]}
          onChange={(val) => {
            const spId = String(val) || undefined
            editorUpdate((d) => {
              const cur = d.layers.find((l) => l.id === selectedLayerId)
              if (!cur || cur.type !== 'text') return
              cur.props.speakerLayerId = spId
              cur.props.isSubtitleCue = true
              const spLayer = spId ? d.layers.find((l) => l.id === spId) : undefined
              if (spLayer && cur.props.holdSpeakerTiming !== false) {
                enforceSpeakerAndSceneContinuity(d, spLayer, cur.inPoint, cur.outPoint)
              }
              d.workflow = syncWorkflowV2Graph(d, d.workflow)
            }, 'text-speaker-bind')
          }}
        />
      </Row>
      <Row label="Mẫu Vietsub">
        <Select
          value={props.subtitleStylePreset ?? 'lugia_cyan'}
          options={SUBTITLE_STYLE_PRESETS.map((pr) => ({ value: pr.id, label: pr.label }))}
          onChange={(val) => {
            const pr = SUBTITLE_STYLE_PRESETS.find((x) => x.id === String(val))
            if (!pr) return
            p((t) => {
              t.subtitleStylePreset = pr.id
              t.fontFamily = pr.config.fontFamily
              t.fontSize = pr.config.fontSize
              t.fontWeight = pr.config.fontWeight
              t.color = pr.config.color
              t.strokeColor = pr.config.strokeColor
              t.strokeWidth = pr.config.strokeWidth
              t.glowColor = pr.config.glowColor
              t.boxColor = pr.config.boxColor
              t.boxOpacity = pr.config.boxOpacity
              t.align = pr.config.align
              t.subtitlePositionPreset = pr.config.positionPreset
              t.subtitleOffsetX = pr.config.offsetX
              t.subtitleOffsetY = pr.config.offsetY
              if (pr.preserveByDefault !== undefined) t.preserveCustomSettings = pr.preserveByDefault
            }, 'text-preset')
          }}
        />
      </Row>
      <Row label="Font">
        <Select
          value={props.fontFamily}
          options={FONTS.map((f) => ({ value: f, label: f }))}
          onChange={(val) => p((t) => void (t.fontFamily = String(val)))}
        />
      </Row>
      <Row label="Cỡ / Độ đậm">
        <NumberInput axis="px" value={props.fontSize} min={6} max={600} step={1} precision={0} onChange={(v, k) => p((t) => void (t.fontSize = v), k)} />
        <Select
          value={props.fontWeight}
          options={[400, 500, 600, 700, 800, 900].map((w) => ({
            value: w,
            label: `${w}`
          }))}
          onChange={(val) => p((t) => void (t.fontWeight = Number(val)))}
        />
      </Row>
      <Row label="Màu chữ / Viền">
        <ColorInput value={props.color} onChange={(v, k) => p((t) => void (t.color = v), k)} />
        <ColorInput value={props.strokeColor ?? '#0a3d6e'} onChange={(v, k) => p((t) => void (t.strokeColor = v), k)} />
        <NumberInput axis="viền" value={props.strokeWidth ?? 0} min={0} max={24} step={1} precision={0} onChange={(v, k) => p((t) => void (t.strokeWidth = v), k)} />
      </Row>
      <Row label="Nền / Độ đậm">
        <ColorInput
          value={props.boxColor || '#090d16'}
          onChange={(v, k) =>
            p((t) => {
              t.boxColor = v
              if ((t.boxOpacity ?? 0) < 0.1) t.boxOpacity = 0.78
            }, k)
          }
        />
        <NumberInput
          axis="%"
          value={Math.round((props.boxOpacity ?? (props.boxColor ? 0.78 : 0)) * 100)}
          min={0}
          max={100}
          step={5}
          precision={0}
          onChange={(v, k) =>
            p((t) => {
              t.boxOpacity = Number((v / 100).toFixed(2))
              if (v <= 0) t.boxColor = ''
              else if (!t.boxColor) t.boxColor = '#090d16'
            }, k)
          }
        />
      </Row>
      <Row label="Vị trí màn hình">
        <Select
          value={props.subtitlePositionPreset ?? 'bottom_center'}
          options={POS_PRESETS}
          onChange={(val) => {
            const posPreset = val as SubtitlePositionPreset
            editorUpdate((d) => {
              const cur = d.layers.find((l) => l.id === selectedLayerId)
              if (!cur || cur.type !== 'text') return
              cur.props.subtitlePositionPreset = posPreset
              const defY = posPreset === 'bottom_center' ? -390 : posPreset === 'top_center' ? 360 : posPreset === 'above_speaker' ? 190 : posPreset === 'below_speaker' ? -230 : 80
              cur.props.subtitleOffsetY = defY
              const sp = cur.props.speakerLayerId ? d.layers.find((l) => l.id === cur.props.speakerLayerId) : undefined
              const pl = computeSubtitlePlacement(d, sp, posPreset, cur.props.subtitleOffsetX ?? 0, defY, cur.inPoint)
              cur.transform.position.value = [...pl.position]
            }, 'text-pos-preset')
          }}
        />
      </Row>
      <Row label="Khoá đặc biệt 🔒">
        <Switch
          on={Boolean(props.preserveCustomSettings)}
          onChange={(v) => p((t) => void (t.preserveCustomSettings = v))}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {props.preserveCustomSettings ? 'Không nhận Apply All' : 'Nhận cấu hình chung'}
        </span>
      </Row>
      <Row label="Giữ hình theo thoại">
        <Switch
          on={props.holdSpeakerTiming !== false}
          onChange={(v) => p((t) => void (t.holdSpeakerTiming = v))}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Chưa nói xong không nhảy hình
        </span>
      </Row>
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          id="inspector-subtitle-apply-all-btn"
          className="btn primary sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleApplyToAllSubtitles}
          title="Áp dụng Font, Cỡ, Màu, Viền, Nền và Vị trí của phụ đề này cho toàn bộ Vietsub trong dự án (Tự động bỏ qua các node có bật Khoá đặc biệt 🔒)"
        >
          ⚡ Áp dụng cấu hình cho TOÀN BỘ Vietsub
        </button>
      </div>
    </div>
  )
}
