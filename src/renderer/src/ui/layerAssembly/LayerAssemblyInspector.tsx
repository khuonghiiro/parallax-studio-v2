import { useState } from 'react'
import { WorkshopSelectionPanel } from './WorkshopSelectionPanel'
import type { WorkshopAction } from './workshopActions'
import type { LayerComposite, AssembledLayerItem } from './types'
import { LayerRowItem } from './LayerAssemblyRow'
import { WorkshopLayerProps } from './WorkshopLayerProps'
import { WorkshopPartsPanel } from './WorkshopPartsPanel'
import { WorkshopPartSwap } from './WorkshopPartSwap'
import { findGroup } from './workshopParts'
import { IconLayersStack, IconPlus } from '../icons'
import {
  IconSubTabCloth,
  IconSubTabDepth,
  IconSubTabLayerStack,
  IconSubTabParts,
  IconSubTabTransform
} from './LayerWorkshopStudioIcons'
import '../../styles/layerWorkshopPanels.css'

export type LayerSubTab = 'stack' | 'transform' | 'depth' | 'parts' | 'cloth'

export interface LayerAssemblyInspectorProps {
  composite: LayerComposite
  setComposite: (next: LayerComposite) => void
  selectedLayerId: string | null
  onSelectLayer: (id: string | null, additive?: boolean) => void
  onSetIds: (ids: string[]) => void
  selectedIds: string[]
  onBatchAction: (action: WorkshopAction) => void
  onAllAction: (action: WorkshopAction) => void
  onUpdateLayer: (id: string, patch: Partial<AssembledLayerItem>) => void
  onMoveLayer: (id: string, x: number, y: number) => void
  onAddLayer: () => void
  onDeleteLayer: (id: string) => void
  onDuplicateLayer: (id: string) => void
  onMoveLayerOrder: (id: string, direction: 'up' | 'down') => void
  subTab?: LayerSubTab
  onSelectSubTab?: (subTab: LayerSubTab) => void
}

function LayerStack({
  composite,
  selectedIds,
  selectedLayer,
  onSelectLayer,
  onUpdateLayer,
  onMoveLayerOrder,
  onAddLayer,
  onAllAction,
  onSelectSubTab
}: LayerAssemblyInspectorProps & {
  selectedLayer: AssembledLayerItem | null
}) {
  return (
    <section className="lw-layer-stack" data-mcp-region="layer_assembly_layers" aria-label="Xếp chồng layer">
      <div className="lw-pane-head">
        <div className="lw-pane-title">
          <IconLayersStack width={14} height={14} /> Xếp chồng layer{' '}
          <span className="lw-count">{composite.layers.length}</span>
        </div>
        <button
          type="button"
          className="lw-btn sm primary"
          onClick={onAddLayer}
          title="Thêm một layer trống vào cụm"
        >
          <IconPlus width={12} height={12} /> Thêm
        </button>
      </div>
      <div className="lw-ztools">
        <span className="lw-ztools-label">Tách Z:</span>
        <button
          type="button"
          className="lw-chip"
          onClick={() => onAllAction('depth-forward')}
          title="Layer trên cùng là hậu cảnh (Z dương), layer dưới là tiền cảnh (Z âm)"
        >
          Nền → Trước
        </button>
        <button
          type="button"
          className="lw-chip"
          onClick={() => onAllAction('depth-reverse')}
          title="Layer trên cùng là tiền cảnh (Z âm), layer dưới là hậu cảnh (Z dương)"
        >
          Trước → Nền
        </button>
        <button
          type="button"
          className="lw-chip"
          onClick={() => onAllAction('flatten')}
          title="Đưa toàn bộ layer về cùng mặt phẳng Z = 0"
        >
          Gom về 0
        </button>
      </div>
      <div
        className="lw-layer-rows"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Danh sách layer (Ctrl/Shift + bấm để chọn nhiều)"
      >
        {composite.layers.map((layer, idx) => (
          <LayerRowItem
            key={layer.id}
            layer={layer}
            index={idx}
            totalCount={composite.layers.length}
            isSelected={selectedIds.includes(layer.id)}
            partKind={findGroup(composite, layer.partGroupId)?.kind}
            assets={composite.assets}
            onSelect={(additive) => onSelectLayer(layer.id, additive)}
            onToggleHide={() => onUpdateLayer(layer.id, { hidden: !layer.hidden })}
            onToggleLock={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
            onMoveUp={() => onMoveLayerOrder(layer.id, 'up')}
            onMoveDown={() => onMoveLayerOrder(layer.id, 'down')}
          />
        ))}
        {composite.layers.length === 0 && (
          <div className="lw-empty">
            Chưa có layer nào. Chọn ảnh ở cột Tài nguyên bên trái để bắt đầu lắp ráp.
          </div>
        )}
      </div>

      {selectedLayer && (
        <div className="lw-stack-quick-sel">
          <span className="lw-stack-quick-name">Đang chọn: {selectedLayer.name}</span>
          <div className="lw-stack-quick-actions">
            <button
              type="button"
              className="lw-chip"
              onClick={() => onSelectSubTab?.('transform')}
              title="Mở tab Biến đổi 2.5D (Vị trí, Scale, Lật, Xoay)"
            >
              Biến đổi →
            </button>
            <button
              type="button"
              className="lw-chip"
              onClick={() => onSelectSubTab?.('depth')}
              title="Mở tab Chiều sâu Z & Không gian 2.5D"
            >
              Chiều sâu →
            </button>
            <button
              type="button"
              className="lw-chip"
              onClick={() => onSelectSubTab?.('cloth')}
              title="Mở tab Gắn Xương & Nhãn Vải mềm"
            >
              Xương/Vải →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function LayerAssemblyInspector(props: LayerAssemblyInspectorProps) {
  const {
    composite,
    setComposite,
    selectedIds,
    selectedLayerId,
    onSelectLayer,
    onSetIds,
    onBatchAction,
    subTab: controlledSubTab,
    onSelectSubTab
  } = props

  const [internalSub, setInternalSub] = useState<LayerSubTab>('stack')
  const sub = controlledSubTab ?? internalSub
  const setSub = onSelectSubTab ?? setInternalSub

  const [swap, setSwap] = useState<{ layerId: string; mode: 'replace' | 'variant' } | null>(null)
  const selectedLayer = composite.layers.find((l) => l.id === selectedLayerId) || null
  const openSwap = (layerId: string, mode: 'replace' | 'variant') => setSwap({ layerId, mode })

  return (
    <div className="lw-layer-tab layer-workshop-inspector">
      {selectedIds.length > 1 ? (
        <div className="lw-props-panel">
          <WorkshopSelectionPanel
            selectedIds={selectedIds}
            onSelectLayer={onSelectLayer}
            onBatchAction={onBatchAction}
          />
        </div>
      ) : (
        <>
          {sub === 'stack' && (
            <LayerStack
              {...props}
              selectedLayer={selectedLayer}
              onSelectSubTab={setSub}
            />
          )}

          {sub === 'transform' && (
            <>
              <div className="lw-vtab-pane-header">
                <span className="lw-vtab-pane-title">
                  <IconSubTabTransform width={13} height={13} />
                  Biến đổi toạ độ &amp; 2.5D
                </span>
                {selectedLayer && (
                  <span className="lw-vtab-pane-hint">{selectedLayer.name}</span>
                )}
              </div>
              {selectedLayer ? (
                <WorkshopLayerProps
                  composite={composite}
                  layer={selectedLayer}
                  setComposite={setComposite}
                  onUpdateLayer={props.onUpdateLayer}
                  onMoveLayer={props.onMoveLayer}
                  onDuplicate={props.onDuplicateLayer}
                  onDelete={props.onDeleteLayer}
                  onSelectLayer={(id) => onSelectLayer(id)}
                  onOpenSwap={openSwap}
                  section="transform"
                />
              ) : (
                <div className="lw-subtab-empty">
                  <div className="lw-subtab-empty-icon">
                    <IconSubTabTransform width={24} height={24} />
                  </div>
                  <div className="lw-subtab-empty-title">Biến đổi 2.5D</div>
                  <div className="lw-subtab-empty-desc">
                    Chọn một layer trong danh sách hoặc bấm trực tiếp trên khung nhìn để chỉnh vị trí, tỷ lệ scale, lật và xoay 3D.
                  </div>
                </div>
              )}
            </>
          )}

          {sub === 'depth' && (
            <>
              <div className="lw-vtab-pane-header">
                <span className="lw-vtab-pane-title">
                  <IconSubTabDepth width={13} height={13} />
                  Chiều sâu Z &amp; Phối cảnh 2.5D
                </span>
                {selectedLayer && (
                  <span className="lw-vtab-pane-hint">{selectedLayer.name}</span>
                )}
              </div>
              {selectedLayer ? (
                <WorkshopLayerProps
                  composite={composite}
                  layer={selectedLayer}
                  setComposite={setComposite}
                  onUpdateLayer={props.onUpdateLayer}
                  onMoveLayer={props.onMoveLayer}
                  onDuplicate={props.onDuplicateLayer}
                  onDelete={props.onDeleteLayer}
                  onSelectLayer={(id) => onSelectLayer(id)}
                  onOpenSwap={openSwap}
                  section="depth"
                />
              ) : (
                <div className="lw-subtab-empty">
                  <div className="lw-subtab-empty-icon">
                    <IconSubTabDepth width={24} height={24} />
                  </div>
                  <div className="lw-subtab-empty-title">Chiều sâu Z</div>
                  <div className="lw-subtab-empty-desc">
                    Chọn một layer để căn chỉnh khoảng cách xa gần tới camera (Z: -500px đến +800px) theo các tầng tiền/hậu cảnh.
                  </div>
                </div>
              )}
            </>
          )}

          {sub === 'parts' && (
            <>
              <div className="lw-vtab-pane-header">
                <span className="lw-vtab-pane-title">
                  <IconSubTabParts width={13} height={13} />
                  Bộ phận &amp; Hoán đổi biến thể
                </span>
                <span className="lw-vtab-pane-hint">
                  {composite.partGroups?.length ?? 0} nhóm
                </span>
              </div>
              <WorkshopPartsPanel
                composite={composite}
                setComposite={setComposite}
                selectedIds={selectedIds}
                onSelectLayer={onSelectLayer}
                onSetIds={onSetIds}
                onOpenSwap={openSwap}
              />
              {selectedLayer && (
                <WorkshopLayerProps
                  composite={composite}
                  layer={selectedLayer}
                  setComposite={setComposite}
                  onUpdateLayer={props.onUpdateLayer}
                  onMoveLayer={props.onMoveLayer}
                  onDuplicate={props.onDuplicateLayer}
                  onDelete={props.onDeleteLayer}
                  onSelectLayer={(id) => onSelectLayer(id)}
                  onOpenSwap={openSwap}
                  section="parts"
                />
              )}
            </>
          )}

          {sub === 'cloth' && (
            <>
              <div className="lw-vtab-pane-header">
                <span className="lw-vtab-pane-title">
                  <IconSubTabCloth width={13} height={13} />
                  Khung Xương &amp; Nhãn Vải Mềm
                </span>
                {selectedLayer && (
                  <span className="lw-vtab-pane-hint">{selectedLayer.name}</span>
                )}
              </div>
              {selectedLayer ? (
                <WorkshopLayerProps
                  composite={composite}
                  layer={selectedLayer}
                  setComposite={setComposite}
                  onUpdateLayer={props.onUpdateLayer}
                  onMoveLayer={props.onMoveLayer}
                  onDuplicate={props.onDuplicateLayer}
                  onDelete={props.onDeleteLayer}
                  onSelectLayer={(id) => onSelectLayer(id)}
                  onOpenSwap={openSwap}
                  section="cloth"
                />
              ) : (
                <div className="lw-subtab-empty">
                  <div className="lw-subtab-empty-icon">
                    <IconSubTabCloth width={24} height={24} />
                  </div>
                  <div className="lw-subtab-empty-title">Khung xương &amp; Nhãn vải</div>
                  <div className="lw-subtab-empty-desc">
                    Chọn một layer để gắn vào xương, chọn uốn mềm Mesh 2D hoặc bật nhãn Vải đung đưa theo bước chân/tay.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {swap && (
        <WorkshopPartSwap
          composite={composite}
          layerId={swap.layerId}
          initialMode={swap.mode}
          setComposite={setComposite}
          onSelectLayer={(id) => onSelectLayer(id)}
          onClose={() => setSwap(null)}
        />
      )}
    </div>
  )
}
