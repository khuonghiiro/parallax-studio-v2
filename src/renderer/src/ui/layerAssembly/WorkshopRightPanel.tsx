import { cloneElement, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { IconLoopAnimate } from '../icons'
import { SegmentedTabs } from '../primitives'
import {
  IconSubTabAnimClips,
  IconSubTabAnimPhysics,
  IconSubTabAnimPose,
  IconSubTabAutoRig,
  IconSubTabBoneBuild,
  IconSubTabBoneTree,
  IconSubTabCloth,
  IconSubTabDepth,
  IconSubTabLayerStack,
  IconSubTabLoopPlay,
  IconSubTabLoopRhythm,
  IconSubTabLoopTemplate,
  IconSubTabMeshBind,
  IconSubTabParts,
  IconSubTabPlantAdd,
  IconSubTabPlantHarmony,
  IconSubTabPlantList,
  IconSubTabTransform,
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
import {
  useWorkshopSubTab,
  type LayerSubTab,
  type RigSubTab,
  type AnimInspectorSubTab,
  type WindPanelSubTab,
  type LoopSubTab
} from './workshopSubTabStore'
import type { useLayerWorkshop } from './useLayerWorkshop'
import type { useWorkshopPlayback } from './useWorkshopPlayback'
import { applyRigAction, ensureRigClips, type RigAction } from './workshopRig'
import { WorkshopTabPlayBar } from './WorkshopTabPlayBar'
import { useEditor } from '../../store/editor'
import '../../styles/layerWorkshopInspectorPolish.css'

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

  // Chuẩn hoá tab: tab plant tự động ánh xạ vào animation
  const effectiveTab = tab === 'plant' ? 'animation' : tab

  // Trạng thái sub-tab con đồng bộ store (hỗ trợ cả UI lẫn MCP điều khiển)
  const [layerSubTab, setLayerSubTab] = useWorkshopSubTab('layers')
  const [rigSubTab, setRigSubTab] = useWorkshopSubTab('bones')
  const [animSubTab, setAnimSubTab] = useWorkshopSubTab('animation')
  const [plantSubTab, setPlantSubTab] = useWorkshopSubTab('plant')
  const [loopSubTab, setLoopSubTab] = useWorkshopSubTab('loop')

  const run = (action: RigAction) => {
    try {
      state.setComposite((c) => applyRigAction(c, action))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loopActions = useWorkshopLoopActions(state, playback, setTab)
  const projectFps = useEditor((s) => s.project.comp.fps) || 30

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

  // Danh sách các tab dọc icon đặc trưng cho từng phân khu logic
  const subTabs = useMemo(() => {
    switch (effectiveTab) {
      case 'layers':
        return [
          {
            id: 'stack' as const,
            label: 'Xếp lớp',
            icon: <IconSubTabLayerStack width={16} height={16} />,
            badge: state.composite.layers.length || undefined,
            title: 'Danh sách các lớp layer (Ctrl/Shift chọn nhiều, đảo thứ tự, ẩn/khoá, tách Z nhanh)'
          },
          {
            id: 'transform' as const,
            label: 'Biến đổi',
            icon: <IconSubTabTransform width={16} height={16} />,
            title: 'Biến đổi 2.5D (Vị trí X/Y, Tỷ lệ Scale, Lật ngang/dọc, Độ mờ Opacity, Xoay 3D X/Y/Z)'
          },
          {
            id: 'depth' as const,
            label: 'Chiều sâu',
            icon: <IconSubTabDepth width={16} height={16} />,
            title: 'Chiều sâu Z (Slider Z -500px..+800px, 5 nấc preset Tiền cảnh, Cận cảnh, Trọng tâm, Hậu cảnh, Nền xa)'
          },
          {
            id: 'parts' as const,
            label: 'Bộ phận',
            icon: <IconSubTabParts width={16} height={16} />,
            badge: state.composite.partGroups?.length || undefined,
            title: 'Bộ phận & Biến thể (Nhóm liên kết, Điểm neo nhóm, Bộ biến thể, Hoán đổi ảnh)'
          },
          {
            id: 'cloth' as const,
            label: 'Xương/Vải',
            icon: <IconSubTabCloth width={16} height={16} />,
            badge: selectedLayer?.isCloth ? 'Vải' : (selectedLayer?.boneId ? 'Xương' : undefined),
            title: 'Khung xương & Nhãn vải (Gắn layer vào xương, Uốn mềm Mesh 2D, Nhãn vải đung đưa theo chân/tay)'
          }
        ]
      case 'bones':
        return [
          {
            id: 'hierarchy' as const,
            label: 'Cây xương',
            icon: <IconSubTabBoneTree width={16} height={16} />,
            badge: boneCount || undefined,
            badgeTone: boneCount > 0 ? ('cyan' as const) : ('neutral' as const),
            title: `Cây phân cấp xương cha-con (${boneCount} xương), chọn xương, độ dài & góc xoay`
          },
          {
            id: 'build' as const,
            label: 'Dựng xương',
            icon: <IconSubTabBoneBuild width={16} height={16} />,
            title: 'Dựng kết cấu xương thủ công (Vẽ chuỗi xương, đối xứng gương L⇄R, giới hạn góc khớp)'
          },
          {
            id: 'binding' as const,
            label: 'Gắn Mesh',
            icon: <IconSubTabMeshBind width={16} height={16} />,
            title: 'Gắn Mesh & Bộ phận (Flexi-Bind uốn mềm theo bán kính xương, gắn từng mảnh layer vào khớp)'
          },
          {
            id: 'autorig' as const,
            label: 'Tự động',
            icon: <IconSubTabAutoRig width={16} height={16} />,
            title: 'Tự động hoá khung xương (Thư viện 12 loài sinh vật, Mixamo người 2D, Smart Rig 2.5D, Mẫu chi)'
          }
        ]
      case 'animation':
        return [
          {
            id: 'pose' as const,
            label: 'Dáng & Key',
            icon: <IconSubTabAnimPose width={16} height={16} />,
            title: 'Tạo dáng & Keyframe (Bẻ khớp trực tiếp IK/FK, Auto-Key, Dope Sheet, Onion Skin)'
          },
          {
            id: 'clips' as const,
            label: 'Hành động',
            icon: <IconSubTabAnimClips width={16} height={16} />,
            badge: clipCount || undefined,
            title: `Hành động & Clips (${clipCount} clip: quản lý động tác, Mixamo retargeting, thư viện mẫu)`
          },
          {
            id: 'plant' as const,
            label: 'Gió tóc/áo',
            icon: <IconTabWindMotion width={16} height={16} />,
            badge: spineCount || undefined,
            title: `Chuyển động gió & Uốn tóc/vải/cây (${spineCount} trục sống uốn: tóc, tà áo, ruy băng, cành lá)`
          },
          {
            id: 'physics' as const,
            label: 'Vật lý',
            icon: <IconSubTabAnimPhysics width={16} height={16} />,
            title: 'Vật lý & Rung lắc (Secondary Motion lò xo đàn hồi, nhịp đập, Parallax 2.5D, chiều sâu xương)'
          }
        ]

      case 'loop':
        return [
          {
            id: 'template' as const,
            label: 'Mẫu Loop',
            icon: <IconSubTabLoopTemplate width={16} height={16} />,
            badge: loopCount || undefined,
            title: 'Mẫu hoạt ảnh (Gán mẫu từ kho Loop, xem trước hoạt ảnh, tách nền chroma)'
          },
          {
            id: 'playback' as const,
            label: 'Phát lặp',
            icon: <IconSubTabLoopPlay width={16} height={16} />,
            title: 'Phát lặp & Tốc độ (Chế độ lặp: Vòng / Đảo chiều / 1 lần / Ngẫu nhiên, Tốc độ, FPS, Độ lệch giờ)'
          },
          {
            id: 'rhythm' as const,
            label: 'Nhịp & đèn',
            icon: <IconSubTabLoopRhythm width={16} height={16} />,
            title: 'Nhịp điệu & Ánh sáng ảo (Nháy mờ, nhịp scale, chớp beat, đèn chiếu ảo Virtual Light)'
          }
        ]
    }
  }, [tab, state.composite, boneCount, clipCount, spineCount, loopCount, selectedLayer])

  const currentSubTabId =
    effectiveTab === 'layers'
      ? layerSubTab
      : effectiveTab === 'bones'
        ? rigSubTab
        : effectiveTab === 'animation'
          ? animSubTab
          : loopSubTab

  const handleSelectSubTab = (id: string) => {
    if (effectiveTab === 'layers') setLayerSubTab(id as LayerSubTab)
    else if (effectiveTab === 'bones') setRigSubTab(id as RigSubTab)
    else if (effectiveTab === 'animation') setAnimSubTab(id as AnimInspectorSubTab)
    else setLoopSubTab(id as LoopSubTab)
  }

  return (
    <aside
      className="lw-right-column lw-right"
      data-mcp-region="layer_assembly_inspector"
      style={width !== undefined ? { width: `${width}px`, minWidth: '270px' } : undefined}
    >
      <SegmentedTabs<WorkshopTab>
        variant="segmented"
        size="sm"
        ariaLabel="Chế độ thanh tra Xưởng Layer"
        className="lw-right-segmented-tabs"
        value={effectiveTab}
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
            label: 'Anim & Gió',
            icon: <IconTabAnimateFilm width={13} height={13} />,
            badge: (clipCount + spineCount) || undefined,
            badgeTone: 'accent',
            title: 'Diễn hoạt chuyển động xương & Gió uốn tóc/áo/cây (Tạo dáng, Clips, Sống gió uốn & Vật lý)'
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

      {/* Dải tab ngang con (Horizontal Sub-Tabs cấp 2) với màu và style phân cấp rõ nét */}
      <nav
        className="lw-right-subtabs"
        role="tablist"
        aria-orientation="horizontal"
        aria-label={`Phân khu ${effectiveTab}`}
      >
        {subTabs.map((st) => {
          const isActive = currentSubTabId === st.id
          return (
            <button
              key={st.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`lw-htab-btn${isActive ? ' active' : ''}`}
              onClick={() => handleSelectSubTab(st.id)}
              title={`${st.label} · ${st.title}`}
              aria-label={st.label}
              data-mcp-subtab={st.id}
            >
              <span className="lw-htab-icon">
                {st.icon}
                {st.badge !== undefined && (
                  <span
                    className={`lw-htab-badge${typeof st.badge === 'string' ? ' tone-accent' : ''}`}
                  >
                    {st.badge}
                  </span>
                )}
              </span>
              <span className="lw-htab-label">{st.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Thanh phát riêng cho tab Anim & Gió / Loop: bật tắt hành động tương ứng ở mọi phân khu */}
      {(effectiveTab === 'animation' || effectiveTab === 'loop') && (
        <WorkshopTabPlayBar
          mode={effectiveTab}
          playback={playback}
          rig={rigInfo}
          fps={rigInfo?.fps || projectFps}
          loopCount={loopCount}
          onToggleRigLoop={() => run({ action: 'settings', loop: !rigInfo?.loop })}
        />
      )}

      {/* Nội dung tương ứng của phân khu đang chọn */}
      <div
        className="lw-right-content lw-htab-content"
        role="tabpanel"
        id={`lw-panel-${effectiveTab}`}
        aria-labelledby={`lw-tab-${effectiveTab}`}
      >
          {effectiveTab === 'layers' ? (
            children && typeof children === 'object' && 'props' in children ? (
              cloneElement(children as ReactElement<any>, {
                subTab: layerSubTab,
                onSelectSubTab: setLayerSubTab
              })
            ) : (
              children
            )
          ) : effectiveTab === 'bones' ? (
            <WorkshopRigPanel
              {...props}
              subTab={rigSubTab}
              onChangeSubTab={setRigSubTab}
            />
          ) : (effectiveTab === 'animation' && animSubTab === 'plant') ? (
            <WorkshopPlantPanel
              composite={state.composite}
              setComposite={state.setComposite}
              selectedIds={state.selection}
              onSelectLayer={state.select}
              isPlaying={playback.isPlaying}
              onTogglePlay={playback.toggle}
              subTab={plantSubTab}
              onChangeSubTab={setPlantSubTab}
            />
          ) : effectiveTab === 'loop' ? (
            <WorkshopLoopLogicPanel
              selectedLayer={selectedLayer}
              isPlaying={playback.isPlaying}
              onTogglePlaying={playback.toggle}
              onUpdateLayer={state.update}
              onBindLoopTemplate={loopActions.bindLoopTemplate}
              subTab={loopSubTab}
              onChangeSubTab={setLoopSubTab}
            />
          ) : (
            <WorkshopAnimationPanel
              {...props}
              playback={playback}
              setComposite={state.setComposite}
              subTab={animSubTab}
              onChangeSubTab={setAnimSubTab}
            />
          )}
      </div>
    </aside>
  )
}
