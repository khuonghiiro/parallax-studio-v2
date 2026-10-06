import type { Layer } from '@shared/types'
import { useEditor } from '../../../store/editor'
import { Switch } from '../../controls'
import { IconPlay, IconSparkles, IconTrash } from '../../icons'
import { openFxPresetMenu } from '../../timeline/FxPresetMenu'
import type { Setter } from '../types'

interface LayerEffectsSectionProps {
  layer: Layer
  set: Setter
}

export function LayerEffectsSection({ layer, set }: LayerEffectsSectionProps) {
  const setTime = useEditor((s) => s.setTime)
  const time = useEditor((s) => s.time)

  // 1. Neon Glow Effect
  const hasGlow = !!layer.glow
  const glow = layer.glow

  // 2. Opacity keyframes (Blink, Fade, Breathe, etc.)
  const opacityKeys = layer.transform.opacity.keyframes
  const hasOpacityFx = opacityKeys.length > 0

  // 3. Position keyframes (Shake, Move, etc.)
  const posKeys = layer.transform.position.keyframes
  const hasPosFx = posKeys.length > 0

  // 4. Scale keyframes (Pop-In, Pulse, etc.)
  const scaleKeys = layer.transform.scale.keyframes
  const hasScaleFx = scaleKeys.length > 0

  // 5. Motion (Drift, Sway, etc.)
  const hasMotion = !!(layer.motion && layer.motion.type !== 'none')

  const totalEffects =
    (hasGlow ? 1 : 0) +
    (hasOpacityFx ? 1 : 0) +
    (hasPosFx ? 1 : 0) +
    (hasScaleFx ? 1 : 0) +
    (hasMotion ? 1 : 0)

  // Actions
  const toggleGlow = (on: boolean) => {
    set((l) => {
      if (l.glow) l.glow.enabled = on
    })
  }

  const deleteGlow = () => {
    set((l) => {
      delete l.glow
    })
  }

  const clearOpacityFx = () => {
    set((l) => {
      l.transform.opacity.keyframes = []
      l.transform.opacity.value = 1
    })
  }

  const clearPosFx = () => {
    set((l) => {
      l.transform.position.keyframes = []
    })
  }

  const clearScaleFx = () => {
    set((l) => {
      l.transform.scale.keyframes = []
      l.transform.scale.value = [1, 1, 1]
    })
  }

  const clearMotion = () => {
    set((l) => {
      if (l.motion) l.motion.type = 'none'
    })
  }

  const handleAddEffect = () => {
    openFxPresetMenu({
      x: Math.max(16, window.innerWidth * 0.5 - 280),
      y: Math.max(16, window.innerHeight * 0.5 - 230),
      targetTime: time,
      layerName: layer.name,
      from: 'button'
    })
  }

  return (
    <div className="section layer-effects-section">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconSparkles width={13} height={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>Danh Sách Hiệu Ứng ({totalEffects})</span>
        </span>
        <button
          type="button"
          className="btn sm ghost"
          style={{ fontSize: 11, padding: '2px 7px', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
          onClick={handleAddEffect}
          title="Thêm hiệu ứng mới vào layer tại Playhead"
        >
          + Thêm
        </button>
      </div>

      {totalEffects === 0 ? (
        <div
          style={{
            padding: '12px 10px',
            textAlign: 'center',
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--line)'
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--text-dim)' }}>
            Chưa có hiệu ứng nào trên layer này.
          </p>
          <button
            type="button"
            className="btn primary sm"
            style={{ fontSize: 11, padding: '4px 12px' }}
            onClick={handleAddEffect}
          >
            <IconSparkles width={12} height={12} />
            <span>Thêm hiệu ứng ngay</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* 1. Neon Glow Effect */}
          {hasGlow && glow && (
            <div
              className="layer-fx-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 9px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: glow.color || '#3dd6f5',
                    boxShadow: `0 0 6px ${glow.color || '#3dd6f5'}`,
                    flexShrink: 0
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Viền Neon ({glow.animated === 'breathe' ? 'Thở' : glow.animated === 'blink' ? 'Chớp' : glow.animated === 'flicker' ? 'Flicker' : 'Tĩnh'})
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {(glow.startTime ?? 0).toFixed(2)}s · {glow.duration ? `${glow.duration.toFixed(1)}s` : 'Suốt layer'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến mốc bắt đầu"
                  onClick={() => setTime(glow.startTime ?? 0)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconPlay width={10} height={10} />
                </button>
                <Switch on={!!glow.enabled} onChange={toggleGlow} id="fx-switch-glow" />
                <button
                  type="button"
                  className="mini"
                  title="Xoá hiệu ứng Viền Neon"
                  onClick={deleteGlow}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            </div>
          )}

          {/* 2. Opacity Effect (Blink, Fade, Breathe) */}
          {hasOpacityFx && (
            <div
              className="layer-fx-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 9px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>🌓</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Độ mờ / Chớp tắt ({opacityKeys.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {opacityKeys[0].t.toFixed(2)}s → {opacityKeys[opacityKeys.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(opacityKeys[0].t)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconPlay width={10} height={10} />
                </button>
                <button
                  type="button"
                  className="mini"
                  title="Xoá toàn bộ keyframes Độ mờ này"
                  onClick={clearOpacityFx}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            </div>
          )}

          {/* 3. Position Effect (Shake / Motion) */}
          {hasPosFx && (
            <div
              className="layer-fx-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 9px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>📳</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Vị trí / Rung chấn ({posKeys.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {posKeys[0].t.toFixed(2)}s → {posKeys[posKeys.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(posKeys[0].t)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconPlay width={10} height={10} />
                </button>
                <button
                  type="button"
                  className="mini"
                  title="Xoá toàn bộ keyframes Vị trí này"
                  onClick={clearPosFx}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            </div>
          )}

          {/* 4. Scale Effect (Pop-in, Pulse) */}
          {hasScaleFx && (
            <div
              className="layer-fx-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 9px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>💥</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Kích thước / Nảy ({scaleKeys.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {scaleKeys[0].t.toFixed(2)}s → {scaleKeys[scaleKeys.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(scaleKeys[0].t)}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconPlay width={10} height={10} />
                </button>
                <button
                  type="button"
                  className="mini"
                  title="Xoá toàn bộ keyframes Kích thước này"
                  onClick={clearScaleFx}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            </div>
          )}

          {/* 5. Automatic Motion (Drift / Sway) */}
          {hasMotion && (
            <div
              className="layer-fx-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 9px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>🍃</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Chuyển động: {layer.motion?.type}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    Tốc độ: {layer.motion?.speed ?? 1}x
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Tắt chuyển động tự động"
                  onClick={clearMotion}
                  style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', color: 'var(--text-faint)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <IconTrash width={12} height={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
