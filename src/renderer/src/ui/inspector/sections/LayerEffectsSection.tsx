import type { AppliedLayerEffect, Keyframe, Layer, AnimValue } from '@shared/types'
import { useEditor } from '../../../store/editor'
import { Switch } from '../../controls'
import { IconPlay, IconSparkles, IconTrash } from '../../icons'
import { openFxPresetMenu } from '../../timeline/FxPresetMenu'
import { deleteLayerEffect, toggleLayerEffect } from '../../timeline/timelineEffects'
import { renderFxIcon } from '../../timeline/fxIcons'
import type { Setter } from '../types'

interface LayerEffectsSectionProps {
  layer: Layer
  set: Setter
}

export function LayerEffectsSection({ layer, set }: LayerEffectsSectionProps) {
  const setTime = useEditor((s) => s.setTime)
  const time = useEditor((s) => s.time)

  const appliedList: (AppliedLayerEffect & { savedKeyframes?: Keyframe<AnimValue>[] })[] =
    (layer.appliedEffects as any) ?? []

  // Standalone Glow detection (if not in appliedList)
  const hasGlowInList = appliedList.some((fx) => fx.category === 'glow')
  const showStandaloneGlow = !hasGlowInList && !!layer.glow

  // Legacy/Manual keyframe fallback detection
  const hasOpacityWithoutFx =
    layer.transform.opacity.keyframes.length > 0 &&
    !appliedList.some((fx) => fx.targetProp === 'opacity' && fx.enabled)

  const hasPosWithoutFx =
    layer.transform.position.keyframes.length > 0 &&
    !appliedList.some((fx) => fx.targetProp === 'position' && fx.enabled)

  const hasScaleWithoutFx =
    layer.transform.scale.keyframes.length > 0 &&
    !appliedList.some((fx) => fx.targetProp === 'scale' && fx.enabled)

  const hasMotion = !!(layer.motion && layer.motion.type !== 'none')

  const totalCount =
    appliedList.length +
    (showStandaloneGlow ? 1 : 0) +
    (hasOpacityWithoutFx ? 1 : 0) +
    (hasPosWithoutFx ? 1 : 0) +
    (hasScaleWithoutFx ? 1 : 0) +
    (hasMotion ? 1 : 0)

  // Actions for AppliedLayerEffect items
  const toggleAppliedEffect = (fxId: string, on: boolean) => {
    set((l) => {
      toggleLayerEffect(l as Layer, fxId, on)
    })
  }

  const deleteAppliedEffect = (fxId: string) => {
    set((l) => {
      deleteLayerEffect(l as Layer, fxId)
    })
  }

  // Standalone Glow actions
  const toggleStandaloneGlow = (on: boolean) => {
    set((l) => {
      if (l.glow) l.glow.enabled = on
    })
  }

  const deleteStandaloneGlow = () => {
    set((l) => {
      delete l.glow
    })
  }

  // Legacy fallback clear actions
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
          <span>Danh Sách Hiệu Ứng ({totalCount})</span>
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

      {totalCount === 0 ? (
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
          {/* 1. Explicitly recorded applied effects */}
          {appliedList.map((fx) => {
            const isOff = !fx.enabled
            return (
              <div
                key={fx.id}
                className={`layer-fx-card${isOff ? ' is-disabled' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 9px',
                  background: isOff ? 'var(--bg-1)' : 'var(--bg-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isOff ? 'var(--line-soft)' : 'var(--line)'}`,
                  gap: 8,
                  opacity: isOff ? 0.48 : 1,
                  filter: isOff ? 'grayscale(1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      display: 'grid',
                      placeItems: 'center',
                      background: isOff ? 'var(--bg-2)' : 'var(--bg-1)',
                      borderRadius: '50%',
                      border: `1px solid ${isOff ? 'var(--line-soft)' : 'var(--line)'}`,
                      flexShrink: 0
                    }}
                  >
                    {renderFxIcon(fx.presetId, 13, isOff ? 'var(--text-faint)' : undefined)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: isOff ? 'var(--text-faint)' : 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <span style={{ textDecoration: isOff ? 'line-through' : 'none' }}>
                        {fx.name}
                      </span>
                      {isOff && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 'normal' }}>
                          (Đã tắt)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                      @ {fx.startTime.toFixed(2)}s · {fx.duration ? `${fx.duration.toFixed(1)}s` : 'Suốt layer'}
                      {fx.count ? (
                        <span>
                          {' · '}
                          {fx.presetId === 'shake'
                            ? `${fx.count} lần rung`
                            : fx.presetId === 'popIn'
                            ? `${fx.count} lần nảy`
                            : fx.presetId === 'pulse'
                            ? `${fx.count} nhịp đập`
                            : `${fx.count} lần`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="mini"
                    title="Nhảy Playhead đến mốc hiệu ứng"
                    onClick={() => setTime(fx.startTime)}
                    style={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      color: isOff ? 'var(--text-faint)' : 'var(--text-dim)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <IconPlay width={10} height={10} />
                  </button>
                  <Switch on={fx.enabled} onChange={(v) => toggleAppliedEffect(fx.id, v)} id={`fx-sw-${fx.id}`} />
                  <button
                    type="button"
                    className="mini"
                    title={`Xoá hiệu ứng "${fx.name}"`}
                    onClick={() => deleteAppliedEffect(fx.id)}
                    style={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-faint)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <IconTrash width={12} height={12} />
                  </button>
                </div>
              </div>
            )
          })}

          {/* 2. Standalone Neon Glow Effect (if not in appliedList) */}
          {showStandaloneGlow && layer.glow && (() => {
            const isGlowOff = !layer.glow.enabled
            return (
              <div
                className={`layer-fx-card${isGlowOff ? ' is-disabled' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 9px',
                  background: isGlowOff ? 'var(--bg-1)' : 'var(--bg-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isGlowOff ? 'var(--line-soft)' : 'var(--line)'}`,
                  gap: 8,
                  opacity: isGlowOff ? 0.48 : 1,
                  filter: isGlowOff ? 'grayscale(1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      display: 'grid',
                      placeItems: 'center',
                      background: isGlowOff ? 'var(--bg-2)' : 'var(--bg-1)',
                      borderRadius: '50%',
                      border: `1px solid ${isGlowOff ? 'var(--line-soft)' : 'var(--line)'}`,
                      flexShrink: 0
                    }}
                  >
                    {renderFxIcon('glow', 13, isGlowOff ? 'var(--text-faint)' : undefined)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: isGlowOff ? 'var(--text-faint)' : 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <span style={{ textDecoration: isGlowOff ? 'line-through' : 'none' }}>
                        Viền Neon ({layer.glow.animated === 'breathe' ? 'Thở' : layer.glow.animated === 'blink' ? 'Chớp' : layer.glow.animated === 'flicker' ? 'Flicker' : 'Tĩnh'})
                      </span>
                      {isGlowOff && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 'normal' }}>
                          (Đã tắt)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                      @ {(layer.glow.startTime ?? 0).toFixed(2)}s · {layer.glow.duration ? `${layer.glow.duration.toFixed(1)}s` : 'Suốt layer'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="mini"
                    title="Nhảy Playhead đến mốc bắt đầu"
                    onClick={() => setTime(layer.glow?.startTime ?? 0)}
                    style={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      color: isGlowOff ? 'var(--text-faint)' : 'var(--text-dim)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <IconPlay width={10} height={10} />
                  </button>
                  <Switch on={!!layer.glow.enabled} onChange={toggleStandaloneGlow} id="fx-switch-glow" />
                  <button
                    type="button"
                    className="mini"
                    title="Xoá hiệu ứng Viền Neon"
                    onClick={deleteStandaloneGlow}
                    style={{
                      width: 22,
                      height: 22,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-faint)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <IconTrash width={12} height={12} />
                  </button>
                </div>
              </div>
            )
          })()}

          {/* 3. Legacy Opacity Keyframes */}
          {hasOpacityWithoutFx && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bg-1)',
                    borderRadius: '50%',
                    border: '1px solid var(--line-soft)',
                    flexShrink: 0
                  }}
                >
                  {renderFxIcon('breathe', 13)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Độ mờ ({layer.transform.opacity.keyframes.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {layer.transform.opacity.keyframes[0].t.toFixed(2)}s → {layer.transform.opacity.keyframes[layer.transform.opacity.keyframes.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(layer.transform.opacity.keyframes[0].t)}
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

          {/* 4. Legacy Position Keyframes */}
          {hasPosWithoutFx && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bg-1)',
                    borderRadius: '50%',
                    border: '1px solid var(--line-soft)',
                    flexShrink: 0
                  }}
                >
                  {renderFxIcon('shake', 13)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Vị trí ({layer.transform.position.keyframes.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {layer.transform.position.keyframes[0].t.toFixed(2)}s → {layer.transform.position.keyframes[layer.transform.position.keyframes.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(layer.transform.position.keyframes[0].t)}
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

          {/* 5. Legacy Scale Keyframes */}
          {hasScaleWithoutFx && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bg-1)',
                    borderRadius: '50%',
                    border: '1px solid var(--line-soft)',
                    flexShrink: 0
                  }}
                >
                  {renderFxIcon('pulse', 13)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Kích thước ({layer.transform.scale.keyframes.length} keyframes)
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    @ {layer.transform.scale.keyframes[0].t.toFixed(2)}s → {layer.transform.scale.keyframes[layer.transform.scale.keyframes.length - 1].t.toFixed(2)}s
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="mini"
                  title="Nhảy Playhead đến keyframe đầu tiên"
                  onClick={() => setTime(layer.transform.scale.keyframes[0].t)}
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

          {/* 6. Motion (Drift / Sway) */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--bg-1)',
                    borderRadius: '50%',
                    border: '1px solid var(--line-soft)',
                    flexShrink: 0
                  }}
                >
                  🍃
                </span>
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
