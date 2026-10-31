import React from 'react'
import { deleteSelectedAudioTrack, deleteSelectedLayer, duplicateSelectedLayer } from '../../actions'
import { keyAt } from '../../animation/keyframes'
import { frameTolerance, getAnimatable, useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import {
  IconCamera,
  IconCopy,
  IconCube,
  IconExport,
  IconEye,
  IconKeyframeDiamond,
  IconLayerAssembly,
  IconMusic,
  IconPlus,
  IconPropPosition,
  IconSliders,
  IconSparkles,
  IconStepBack,
  IconStopwatch,
  IconTrash,
  IconWand
} from '../icons'
import { requestOpenLayerAssembly } from '../layerAssembly/layerAssemblyBridge'
import { activeTimelineRef, toggleTimelineKey } from '../timeline/timelineKeyEditing'

export type MobileQuickSheetMode = 'transform' | 'timing' | 'camera' | 'add' | null

export interface MobileActionStripProps {
  sheetMode: MobileQuickSheetMode
  onToggleSheet: (mode: Exclude<MobileQuickSheetMode, null>) => void
  onOpenLogicPicker: () => void
}

export const MobileActionStrip: React.FC<MobileActionStripProps> = ({
  sheetMode,
  onToggleSheet,
  onOpenLogicPicker
}) => {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)
  const selectedAudioTrackId = useEditor((s) => s.selectedAudioTrackId)
  const selectedLayer = selectedLayerId
    ? project.layers.find((l) => l.id === selectedLayerId) ?? null
    : null

  const tol = frameTolerance(project)
  const ref = activeTimelineRef()
  const anim = ref ? getAnimatable(project, ref) : undefined
  const hasKeyHere = Boolean(anim && keyAt(anim, time, tol))

  const toggleVisibility = (): void => {
    if (!selectedLayer) return
    const instId = selectedLayer.composite?.instanceId
    const nextVis = selectedLayer.visible === false
    useEditor.getState().update((draft) => {
      for (const l of draft.layers) {
        if (l.id === selectedLayer.id || (instId && l.composite?.instanceId === instId)) {
          l.visible = nextVis
        }
      }
    })
  }

  const openInspectorDetail = (): void => {
    useEditor.getState().setInspectorTab('layer')
    const v = useView.getState()
    v.setRightCollapsed(false)
    v.setMobileTab('right')
  }

  const open3DLibrary = (): void => {
    const v = useView.getState()
    v.setLeftCollapsed(false)
    v.setLeftTab('assets')
    v.setAssetSubTab('3d')
    v.setMobileTab('left')
  }

  if (selectedLayer) {
    return (
      <div className="cc-action-strip is-layer-context" data-mcp-region="mobile_action_strip">
        <button
          type="button"
          className="cc-act-btn back-pill"
          onClick={() => {
            useEditor.getState().selectLayer(null)
          }}
          title="Bỏ chọn layer để về thanh công cụ cảnh chính"
        >
          <IconStepBack width={16} height={16} />
          <span>Bỏ chọn</span>
        </button>

        <button
          type="button"
          className={`cc-act-btn${sheetMode === 'transform' ? ' active' : ''}`}
          onClick={() => onToggleSheet('transform')}
        >
          <IconPropPosition width={16} height={16} />
          <span>Vị trí & Z</span>
        </button>

        <button
          type="button"
          className={`cc-act-btn${hasKeyHere ? ' key-active' : ''}`}
          onClick={() => {
            const cur = activeTimelineRef()
            if (cur) toggleTimelineKey(cur)
          }}
        >
          <IconKeyframeDiamond width={16} height={16} />
          <span>{hasKeyHere ? 'Xoá Mốc' : '+Đặt Mốc'}</span>
        </button>

        <button
          type="button"
          className="cc-act-btn accent-logic"
          onClick={onOpenLogicPicker}
        >
          <IconWand width={16} height={16} />
          <span>+Logic/FX</span>
        </button>

        <button
          type="button"
          className={`cc-act-btn${sheetMode === 'timing' ? ' active' : ''}`}
          onClick={() => onToggleSheet('timing')}
        >
          <IconStopwatch width={16} height={16} />
          <span>Cắt & Nhịp</span>
        </button>

        <button
          type="button"
          className="cc-act-btn"
          onClick={() =>
            requestOpenLayerAssembly(selectedLayer.composite?.compositeId)
          }
        >
          <IconLayerAssembly width={16} height={16} />
          <span>{selectedLayer.composite ? 'Rig & Bộ phận' : 'Xưởng 2.5D'}</span>
        </button>

        <button
          type="button"
          className="cc-act-btn"
          onClick={openInspectorDetail}
        >
          <IconSliders width={16} height={16} />
          <span>Chi tiết</span>
        </button>

        <button
          type="button"
          className={`cc-act-btn${selectedLayer.visible === false ? ' muted' : ''}`}
          onClick={toggleVisibility}
        >
          <IconEye width={16} height={16} />
          <span>{selectedLayer.visible === false ? 'Đang ẩn' : 'Ẩn/Hiện'}</span>
        </button>

        <button
          type="button"
          className="cc-act-btn"
          onClick={() => duplicateSelectedLayer()}
        >
          <IconCopy width={16} height={16} />
          <span>Nhân bản</span>
        </button>

        <button
          type="button"
          className="cc-act-btn danger"
          onClick={() => deleteSelectedLayer()}
        >
          <IconTrash width={16} height={16} />
          <span>Xoá</span>
        </button>
      </div>
    )
  }

  return (
    <div className="cc-action-strip" data-mcp-region="mobile_action_strip">
      <button
        type="button"
        className={`cc-act-btn primary-add${sheetMode === 'add' ? ' active' : ''}`}
        onClick={() => onToggleSheet('add')}
      >
        <IconPlus width={16} height={16} />
        <span>Thêm Layer</span>
      </button>

      <button
        type="button"
        className={`cc-act-btn${sheetMode === 'camera' ? ' active' : ''}`}
        onClick={() => onToggleSheet('camera')}
      >
        <IconCamera width={16} height={16} />
        <span>Cảnh & Cam</span>
      </button>

      <button
        type="button"
        className="cc-act-btn accent-logic"
        onClick={onOpenLogicPicker}
      >
        <IconSparkles width={16} height={16} />
        <span>Kho Logic</span>
      </button>

      <button
        type="button"
        className="cc-act-btn"
        onClick={() => useView.getState().openAudioDialog('waveform')}
      >
        <IconMusic width={16} height={16} />
        <span>Âm thanh</span>
      </button>

      <button
        type="button"
        className="cc-act-btn"
        onClick={() => requestOpenLayerAssembly()}
      >
        <IconLayerAssembly width={16} height={16} />
        <span>Xưởng 2.5D</span>
      </button>

      <button
        type="button"
        className="cc-act-btn"
        onClick={open3DLibrary}
      >
        <IconCube width={16} height={16} />
        <span>Kho 3D</span>
      </button>

      {selectedAudioTrackId && (
        <button
          type="button"
          className="cc-act-btn danger"
          onClick={() => deleteSelectedAudioTrack()}
        >
          <IconTrash width={16} height={16} />
          <span>Xoá Audio</span>
        </button>
      )}

      <button
        type="button"
        className="cc-act-btn"
        onClick={() => useView.getState().openDialog('export')}
      >
        <IconExport width={16} height={16} />
        <span>Xuất MP4</span>
      </button>
    </div>
  )
}
