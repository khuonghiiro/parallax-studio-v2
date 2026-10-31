import { useState, type ReactNode } from 'react'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { WorkshopRigPanel } from './WorkshopRigPanel'
import { WorkshopAnimationPanel } from './WorkshopAnimationPanel'
import { WorkshopPlantPanel } from './WorkshopPlantPanel'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'
import { SegmentedTabs } from '../primitives'
import {
  IconTabAnimateFilm,
  IconTabBoneRig,
  IconTabLayersStack,
  IconTabWindMotion
} from './LayerWorkshopStudioIcons'

export type WorkshopTab = 'layers' | 'bones' | 'animation' | 'plant'

export function WorkshopRightPanel({
  state,
  playback,
  tab,
  setTab,
  boneId,
  selectBone,
  width = 330,
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

  const rigInfo = state.composite.rig ? ensureRigClips(state.composite.rig).rig : undefined
  const boneCount = rigInfo?.bones.length ?? 0
  const clipCount = rigInfo?.clips?.length ?? 0
  const spineCount = state.composite.plantSpines?.length ?? 0

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
      style={{ width: `${width}px`, minWidth: '250px' }}
    >
      <SegmentedTabs<WorkshopTab>
        variant="underline"
        size="sm"
        adaptiveCompact
        ariaLabel="Chế độ thanh tra Xưởng Layer"
        className="lw-right-segmented-tabs"
        value={tab}
        onChange={(nextTab) => {
          setTab(nextTab)
          setError('')
          playback.setIsPlaying(false)
          playback.setTime(0)
        }}
        items={[
          {
            id: 'layers',
            domId: 'lw-tab-layers',
            label: 'Lớp',
            icon: <IconTabLayersStack width={13} height={13} />,
            badge: state.composite.layers.length || undefined,
            title: 'Danh sách lớp, thuộc tính Z-Depth, Vật lý & Ánh sáng ảo'
          },
          {
            id: 'bones',
            domId: 'lw-tab-bones',
            label: 'Tạo xương',
            icon: <IconTabBoneRig width={13} height={13} />,
            badge: boneCount || undefined,
            badgeTone: boneCount > 0 ? 'cyan' : 'neutral',
            title: 'Tạo xương chuẩn Moho Pro (Chọn S · Vẽ xương A · Vùng uốn T · Thử khớp Z · Flexi-Bind Mesh)'
          },
          {
            id: 'animation',
            domId: 'lw-tab-animation',
            label: 'Animate',
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
        ) : (
          <WorkshopAnimationPanel {...props} playback={playback} setComposite={state.setComposite} />
        )}
      </div>
    </aside>
  )
}
