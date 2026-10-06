import { useCallback, useState } from 'react'
import type { Layer, Vec3 } from '@shared/types'
import { setValueAt } from '../../../animation/keyframes'
import { referenceDistance } from '../../../animation/math'
import { assetStore } from '../../../project/assets'
import { frameTolerance, useEditor } from '../../../store/editor'
import { NumberInput, Row, Slider, Switch } from '../../controls'
import { AssetReplaceModal } from '../AssetReplaceModal'
import type { Setter } from '../types'

export function ImageSection({ layer, set }: { layer: Layer & { type: 'image' }; set: Setter }) {
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const handleCloseModal = useCallback(() => setShowReplaceModal(false), [])
  const comp = useEditor((s) => s.project.comp)
  const time = useEditor((s) => s.time)
  const tol = useEditor((s) => frameTolerance(s.project))
  const asset = assetStore.get(layer.props.assetId)
  const setScale = (k: number): void =>
    set((l) => setValueAt(l.transform.scale, time, [k, k, 1] as Vec3, tol))
  const matchComp = (): void => {
    useEditor.getState().update((d) => {
      d.comp.width = layer.props.width
      d.comp.height = layer.props.height
      const refD = referenceDistance(d.comp)
      d.camera.position.value = [0, 0, -refD]
      d.camera.target.value = [0, 0, 0]
      d.camera.focusDistance.value = Math.round(refD)
    })
  }
  return (
    <div className="section">
      <div className="section-title">Ảnh</div>
      <Row label="Nguồn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
          <span
            className="hint-text"
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={`${asset?.meta.name ?? '—'} · ${layer.props.width}×${layer.props.height}`}
          >
            {asset?.meta.name ?? '—'} · {layer.props.width}×{layer.props.height}
          </span>
          <button
            type="button"
            className="btn sm accent"
            style={{ flexShrink: 0, padding: '2px 8px', fontSize: 11 }}
            title="Đổi nguồn ảnh khác cho layer này (giữ nguyên vị trí 3D, keyframes, độ sâu Z)"
            onClick={() => setShowReplaceModal(true)}
          >
            Đổi ảnh...
          </button>
        </div>
      </Row>
      <Row label="Kích thước">
        <button className="btn sm" title="Phủ kín khung hình" onClick={() => setScale(Math.max(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Phủ khung
        </button>
        <button className="btn sm" title="Thu vừa lọt vào khung hình" onClick={() => setScale(Math.min(comp.width / layer.props.width, comp.height / layer.props.height))}>
          Vừa khung
        </button>
        <button className="btn sm" title="Giữ nguyên 100% kích thước pixel gốc" onClick={() => setScale(1)}>
          100%
        </button>
        <button className="btn sm" title="Đổi kích thước khung hình (Composition) bằng đúng kích thước ảnh này" onClick={matchComp}>
          Khớp khung
        </button>
      </Row>
      <Row label="Lặp texture" title="Lặp lại ảnh theo chiều rộng (X) và chiều sâu (Y) khi làm mặt đất/sàn">
        <NumberInput
          axis="x"
          value={layer.props.repeat?.[0] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[0] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
        <NumberInput
          axis="y"
          value={layer.props.repeat?.[1] ?? 1}
          min={1}
          max={64}
          step={1}
          precision={0}
          onChange={(v) =>
            set((l) => {
              if (l.type === 'image') {
                const rep = l.props.repeat ? [...l.props.repeat] : [1, 1]
                rep[1] = v
                l.props.repeat = rep as [number, number]
              }
            })
          }
        />
      </Row>
      {(asset?.meta.isAnimated || asset?.gif) && (
        <>
          <div style={{ height: 6 }} />
          <div className="section-title" style={{ marginTop: 8 }}>
            🎞 Hoạt họa GIF / WebP động
            <span className="spacer" />
            <span className="badge-count">
              {asset?.meta.frameCount ?? asset?.gif?.frames.length ?? 0} frames
            </span>
          </div>
          <Row label="Tốc độ phát">
            <Slider
              value={layer.props.speed ?? 1}
              min={0.1}
              max={4}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.speed = v
                })
              }
            />
          </Row>
          <Row label="Kiểu lặp">
            <select
              className="select sm"
              value={layer.props.loopMode ?? 'loop'}
              onChange={(e) =>
                set((l) => {
                  if (l.type === 'image') l.props.loopMode = e.target.value as 'loop' | 'ping-pong' | 'once'
                })
              }
            >
              <option value="loop">Lặp vô tận (Loop)</option>
              <option value="ping-pong">Lặp đảo chiều (Ping-Pong)</option>
              <option value="once">Chạy 1 lần (Play Once)</option>
            </select>
          </Row>
          <Row label="Lệch thời gian">
            <Slider
              value={layer.props.timeOffset ?? 0}
              min={0}
              max={Math.max(1, asset?.meta.duration ?? asset?.gif?.totalDuration ?? 3)}
              step={0.05}
              format={(v) => `${v.toFixed(2)}s`}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.timeOffset = v
                })
              }
            />
          </Row>
          <Row label="Chạy khi dừng" title="Tự động lặp hoạt họa GIF trong khung nhìn 3D ngay cả khi timeline đang tạm dừng">
            <Switch
              on={layer.props.autoPlayPaused !== false}
              onChange={(v) =>
                set((l) => {
                  if (l.type === 'image') l.props.autoPlayPaused = v
                })
              }
            />
          </Row>
        </>
      )}
      {showReplaceModal && (
        <AssetReplaceModal
          layerId={layer.id}
          currentAssetId={layer.props.assetId}
          layerName={layer.name}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
