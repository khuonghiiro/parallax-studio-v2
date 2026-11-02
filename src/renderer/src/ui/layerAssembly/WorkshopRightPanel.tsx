import { useState, type ReactNode } from 'react'
import { IconLoopAnimate } from '../icons'
import { SegmentedTabs } from '../primitives'
import {
  IconTabAnimateFilm,
  IconTabBoneRig,
  IconTabLayersStack,
  IconTabWindMotion
} from './LayerWorkshopStudioIcons'
import { WorkshopAnimationPanel } from './WorkshopAnimationPanel'
import { WorkshopLoopLogicPanel } from './WorkshopLoopLogicPanel'
import { useWorkshopLoopActions } from './useWorkshopLoopActions'
import { WorkshopPlantPanel } from './WorkshopPlantPanel'
import { WorkshopRigPanel } from './WorkshopRigPanel'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'

export type WorkshopTab = 'layers' | 'bones' | 'animation' | 'plant' | 'loop'

export function WorkshopRightPanel({
  state,
  playback,
  tab,
  setTab,
  boneId,
  selectBone,
  width,
  children
}: {
  state: ReturnType<typeof useLayerWorkshop>
  playback: ReturnType<typeof useWorkshopPlayback>
  tab: WorkshopTab
  setTab: (tab: WorkshopTab) => void
  boneId: string | null
  selectBone: (id: string | null) => void
  width?: number
  children: ReactNode
}) {
  const [error, setError] = useState('')
  const run = (action: RigAction) => {
    try {
      state.setComposite((c) => applyRigAction(c, action))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loopActions = useWorkshopLoopActions(state, playback, setTab)

  const rigInfo = state.composite.rig ? ensureRigClips(state.composite.rig).rig : undefined
  const boneCount = rigInfo?.bones.length ?? 0
  const clipCount = rigInfo?.clips?.length ?? 0
  const spineCount = state.composite.plantSpines?.length ?? 0
  const loopCount = state.composite.layers.filter((l) => l.loopConfig?.enabled).length
  const selectedLayer =
    state.composite.layers.find((l) => l.id === state.selectedLayerId) ?? null

  const props = {
    composite: state.composite,
    selectedIds: state.selection,
    selectedLayerId: state.selectedLayerId,
    selectLayer: state.select,
    boneId,
    selectBone,
    run
  }

  return (
    <aside
      className="lw-right-column lw-right"
      data-mcp-region="layer_assembly_inspector"
      style={width !== undefined ? { width: `${width}px`, minWidth: '250px' } : undefined}
    >
      <SegmentedTabs<WorkshopTab>
        variant="segmented"
        size="sm"
        ariaLabel="Chế độ thanh tra Xưởng Layer"
        className="lw-right-segmented-tabs"
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab)
          setError('')
          if (nextTab !== 'loop') {
            playback.setIsPlaying(false)
            playback.setTime(0)
          }
        }}
        items={[
          {
            id: 'layers',
            domId: 'lw-tab-layers',
            label: 'Lớp',
            icon: <IconTabLayersStack width={13} height={13} />,
            badge: state.composite.layers.length || undefined,
            title: 'Danh sách lớp, Bộ phận & Thay thế, Biến đổi 2.5D, Chiều sâu Z & Khung xương'
          },
          {
            id: 'bones',
            domId: 'lw-tab-bones',
            label: 'Xương',
            icon: <IconTabBoneRig width={13} height={13} />,
            badge: boneCount || undefined,
            badgeTone: boneCount > 0 ? 'cyan' : 'neutral',
            title: 'Tạo xương chuẩn Moho Pro (Chọn S · Vẽ xương A · Vùng uốn T · Thử khớp Z · Flexi-Bind Mesh)'
          },
          {
            id: 'animation',
            domId: 'lw-tab-animation',
            label: 'Anim',
            icon: <IconTabAnimateFilm width={13} height={13} />,
            badge: clipCount > 0 && boneCount > 0 ? clipCount : undefined,
            badgeTone: 'accent',
            title: 'Diễn hoạt chuẩn Moho & Adobe Animate (Auto-Key, Dope Sheet Tween Spans, IK, Onion Skin)'
          },
          {
            id: 'plant',
            domId: 'lw-tab-plant',
            label: 'Gió',
            icon: <IconTabWindMotion width={13} height={13} />,
            badge: spineCount || undefined,
            title: 'Vẽ đường sống lá / cành cây đung đưa tự nhiên theo gió'
          },
          {
            id: 'loop',
            domId: 'lw-tab-loop',
            label: 'Loop',
            icon: <IconLoopAnimate width={13} height={13} />,
            badge: loopCount || undefined,
            badgeTone: loopCount > 0 ? 'accent' : 'neutral',
            title: 'Cấu hình Logic Hoạt ảnh Lặp (Loop Animate), Tốc độ, Kiểu lặp & Nhịp Nháy sáng trong Xưởng 2.5D'
          }
        ]}
      />
      {error && (
        <div className="lw-error" role="alert">
          {error}
        </div>
      )}
      <div className="lw-right-content" role="tabpanel" id={`lw-panel-${tab}`} aria-labelledby={`lw-tab-${tab}`}>
        {tab === 'layers' ? (
          children
        ) : tab === 'bones' ? (
          <WorkshopRigPanel {...props} />
        ) : tab === 'plant' ? (
          <WorkshopPlantPanel
            composite={state.composite}
            setComposite={state.setComposite}
            selectedIds={state.selection}
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.toggle}
          />
        ) : tab === 'loop' ? (
          <WorkshopLoopLogicPanel
            selectedLayer={selectedLayer}
            isPlaying={playback.isPlaying}
            onTogglePlaying={playback.toggle}
            onUpdateLayer={state.update}
            onBindLoopTemplate={loopActions.bindLoopTemplate}
          />
        ) : (
          <WorkshopAnimationPanel {...props} playback={playback} setComposite={state.setComposite} />
        )}
      </div>
    </aside>
  )
}
