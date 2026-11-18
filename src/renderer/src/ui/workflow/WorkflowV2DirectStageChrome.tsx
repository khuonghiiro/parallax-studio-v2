import React from 'react'
import type { Layer } from '@shared/types'
import { getClusterPartShortName } from '../../project/workflowV2Engine'
import type { ProjectedLayer2D, ShotStageBox } from '../viewer/animateCamera/animateCameraMath'
import type { CameraWaypointItem } from '../viewer/animateCamera/animateCameraRouteLogic'

export interface DirectStageHeaderBarProps {
  open: boolean
  isSubtitleNode: boolean
  customStageH: number | null
  stageZoomBoost: number
  clusterCount: number
  isClusterLockNode: boolean
  level: string
  useClusterBbox: boolean
  activeLayerObj?: Layer
  onToggleOpen: () => void
  onSetCustomStageH: (h: number | null) => void
  onSetStageZoomBoost: React.Dispatch<React.SetStateAction<number>>
  onToggleScopeOverride: () => void
}

export const DirectStageHeaderBar: React.FC<DirectStageHeaderBarProps> = ({
  open,
  isSubtitleNode,
  customStageH,
  stageZoomBoost,
  clusterCount,
  isClusterLockNode,
  level,
  useClusterBbox,
  activeLayerObj,
  onToggleOpen,
  onSetCustomStageH,
  onSetStageZoomBoost,
  onToggleScopeOverride
}) => (
  <div className="wf-v2-direct-stage-bar" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <button
      type="button"
      className={`wf-v2-direct-toggle-btn${open ? ' active' : ''}`}
      style={{ flex: '1 1 auto', minWidth: 0 }}
      aria-expanded={open}
      onClick={onToggleOpen}
      title={open ? 'Ẩn khung chỉnh sửa trực tiếp BBox 2D' : 'Hiện khung chỉnh sửa trực tiếp BBox 2D như trên Camera 2D'}
    >
      <span>{open ? '▾' : '▸'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isSubtitleNode ? 'Khung chỉnh Vị trí Vietsub' : 'Khung chỉnh BBox'}
      </span>
    </button>
    {open && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <button
          type="button"
          className={`wf-v2-direct-btn${customStageH === null && stageZoomBoost === 1 ? ' accent' : ''}`}
          style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
          title="Tự động dãn khung 2D vừa khít toàn bộ chiều ngang bảng"
          onClick={() => {
            onSetCustomStageH(null)
            onSetStageZoomBoost(1)
            try {
              localStorage.removeItem('pxs:wf-stage-h')
            } catch {
              /* ignore */
            }
          }}
        >
          ↔ Khít
        </button>
        <button
          type="button"
          className={`wf-v2-direct-btn${customStageH && customStageH >= 280 ? ' accent' : ''}`}
          style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
          title="Mở rộng chiều cao khung BBox 2D để dễ kéo & vẽ đường đi"
          onClick={() => {
            const nextH = customStageH && customStageH >= 280 ? null : 300
            onSetCustomStageH(nextH)
            try {
              if (nextH) localStorage.setItem('pxs:wf-stage-h', String(nextH))
              else localStorage.removeItem('pxs:wf-stage-h')
            } catch {
              /* ignore */
            }
          }}
        >
          ↕ Cao
        </button>
        <button
          type="button"
          className={`wf-v2-direct-btn${stageZoomBoost > 1 ? ' accent' : ''}`}
          style={{ height: 22, padding: '0 6px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
          title="Phóng to khung cảnh 2D (100% -> 125% -> 150%) để chỉnh BBox chi tiết"
          onClick={() => onSetStageZoomBoost((z) => (z < 1.2 ? 1.25 : z < 1.45 ? 1.5 : 1))}
        >
          🔍 {Math.round(stageZoomBoost * 100)}%
        </button>
      </div>
    )}
    {open && clusterCount > 1 && !isClusterLockNode && level === 'layer' && (
      <button
        type="button"
        className="wf-v2-direct-btn"
        style={{ height: 22, padding: '0 7px', flexShrink: 0 }}
        title="Chuyển nhanh chế độ kéo BBox giữa Riêng mảnh đang chọn và Toàn bộ Cụm"
        onClick={onToggleScopeOverride}
      >
        {useClusterBbox ? '🔒 BBox Cụm' : `🎯 Riêng: ${activeLayerObj ? getClusterPartShortName(activeLayerObj) : 'Mảnh'}`}
      </button>
    )}
  </div>
)

export interface DirectStageFooterBarProps {
  isMotionNode: boolean
  isSubtitleNode: boolean
  isCamNode: boolean
  useClusterBbox: boolean
  selectedProjLayer?: ProjectedLayer2D
  coordRefLayer?: Layer
  activeWaypoint?: CameraWaypointItem
  shotBox: ShotStageBox
  onCenterLayer: () => void
  onResetLayerScale: () => void
  onAimCameraAtLayer: () => void
  onResetCameraWaypoint: (scale: number) => void
}

export const DirectStageFooterBar: React.FC<DirectStageFooterBarProps> = ({
  isMotionNode,
  isSubtitleNode,
  isCamNode,
  useClusterBbox,
  selectedProjLayer,
  coordRefLayer,
  activeWaypoint,
  shotBox,
  onCenterLayer,
  onResetLayerScale,
  onAimCameraAtLayer,
  onResetCameraWaypoint
}) => {
  if (!isMotionNode && !isSubtitleNode && selectedProjLayer && coordRefLayer) {
    return (
      <div className="wf-v2-direct-footer">
        <span className="wf-v2-direct-coords">
          {useClusterBbox ? 'Cụm ' : ''}X <b>{Math.round(coordRefLayer.transform.position.value?.[0] ?? 0)}</b> · Y{' '}
          <b>{Math.round(coordRefLayer.transform.position.value?.[1] ?? 0)}</b> · Z{' '}
          <b>{Math.round(coordRefLayer.transform.position.value?.[2] ?? 0)}</b> · Cỡ{' '}
          <b>{Math.round(Math.abs(coordRefLayer.transform.scale.value?.[0] ?? 1) * 100)}%</b>
        </span>
        <div className="wf-v2-direct-actions">
          <button type="button" className="wf-v2-direct-btn" onClick={onCenterLayer} title="Đặt vị trí BBox về chính giữa khung cảnh (X=0, Y=0)">
            ⊡ Giữa khung
          </button>
          <button type="button" className="wf-v2-direct-btn" onClick={onResetLayerScale} title="Đặt lại tỷ lệ BBox chuẩn">
            ↺ Chuẩn cỡ
          </button>
          <button type="button" className="wf-v2-direct-btn accent" onClick={onAimCameraAtLayer} title="Lia khung Camera đang chọn vào đúng BBox này">
            🎯 Ngắm Cam
          </button>
        </div>
      </div>
    )
  }

  if (isCamNode && activeWaypoint) {
    return (
      <div className="wf-v2-direct-footer">
        <span className="wf-v2-direct-coords">
          BBox Cam <b>#{activeWaypoint.displayLabel}</b> · Tâm{' '}
          <b>
            ({Math.round(activeWaypoint.stageX - shotBox.stageX)}, {Math.round(activeWaypoint.stageY - shotBox.stageY)})
          </b>{' '}
          · Zoom <b>{activeWaypoint.zoomPct}%</b>
        </span>
        <div className="wf-v2-direct-actions">
          <button type="button" className="wf-v2-direct-btn" onClick={() => onResetCameraWaypoint(1)} title="Căn BBox Camera về chuẩn 100% giữa cảnh">
            ⊡ Chuẩn 100%
          </button>
          <button type="button" className="wf-v2-direct-btn accent" onClick={() => onResetCameraWaypoint(0.667)} title="Thu hẹp BBox Camera để đẩy cận 150%">
            🔍 Đẩy cận 150%
          </button>
        </div>
      </div>
    )
  }

  return null
}
