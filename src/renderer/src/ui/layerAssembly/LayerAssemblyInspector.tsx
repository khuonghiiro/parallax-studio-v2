import { useState } from 'react'
import { WorkshopSelectionPanel } from './WorkshopSelectionPanel'
import type { WorkshopAction } from './workshopActions'
import type { LayerComposite, AssembledLayerItem } from './types'
import { LayerRowItem } from './LayerAssemblyRow'
import { WorkshopLayerProps } from './WorkshopLayerProps'
import { WorkshopPartsPanel } from './WorkshopPartsPanel'
import { WorkshopPartSwap } from './WorkshopPartSwap'
import { findGroup } from './workshopParts'
import { IconLayersStack, IconPlus, IconPuzzle } from '../icons'
import '../../styles/layerWorkshopPanels.css'

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
}

type LayerSubTab = 'stack' | 'parts'

function LayerStack({ composite, selectedIds, onSelectLayer, onUpdateLayer, onMoveLayerOrder, onAddLayer, onAllAction }: LayerAssemblyInspectorProps) {
  return (
    <section className="lw-layer-stack" data-mcp-region="layer_assembly_layers" aria-label="Xếp chồng layer">
      <div className="lw-pane-head">
        <div className="lw-pane-title"><IconLayersStack width={14} height={14} /> Xếp chồng layer <span className="lw-count">{composite.layers.length}</span></div>
        <button type="button" className="lw-btn sm primary" onClick={onAddLayer} title="Thêm một layer trống vào cụm">
          <IconPlus width={12} height={12} /> Thêm
        </button>
      </div>
      <div className="lw-ztools">
        <span className="lw-ztools-label">Tách Z:</span>
        <button type="button" className="lw-chip" onClick={() => onAllAction('depth-forward')} title="Layer trên cùng là hậu cảnh (Z dương), layer dưới là tiền cảnh (Z âm)">Nền → Trước</button>
        <button type="button" className="lw-chip" onClick={() => onAllAction('depth-reverse')} title="Layer trên cùng là tiền cảnh (Z âm), layer dưới là hậu cảnh (Z dương)">Trước → Nền</button>
        <button type="button" className="lw-chip" onClick={() => onAllAction('flatten')} title="Đưa toàn bộ layer về cùng mặt phẳng Z = 0">Gom về 0</button>
      </div>
      <div className="lw-layer-rows" role="listbox" aria-multiselectable="true" aria-label="Danh sách layer (Ctrl/Shift + bấm để chọn nhiều)">
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
        {composite.layers.length === 0 && <div className="lw-empty">Chưa có layer nào. Chọn ảnh ở cột Tài nguyên bên trái để bắt đầu lắp ráp.</div>}
      </div>
    </section>
  )
}

export function LayerAssemblyInspector(props: LayerAssemblyInspectorProps) {
  const { composite, setComposite, selectedIds, selectedLayerId, onSelectLayer, onSetIds, onBatchAction } = props
  const [sub, setSub] = useState<LayerSubTab>('stack')
  const [swap, setSwap] = useState<{ layerId: string; mode: 'replace' | 'variant' } | null>(null)
  const selectedLayer = composite.layers.find((l) => l.id === selectedLayerId) || null
  const openSwap = (layerId: string, mode: 'replace' | 'variant') => setSwap({ layerId, mode })
  return (
    <div className="lw-layer-tab layer-workshop-inspector">
      <div className="lw-subtabs" role="tablist" aria-label="Chế độ tab Layer">
        <button type="button" role="tab" aria-selected={sub === 'stack'} className={`lw-subtab${sub === 'stack' ? ' active' : ''}`} onClick={() => setSub('stack')}>
          <IconLayersStack width={13} height={13} /> <span>Xếp lớp</span> <span className="lw-count">{composite.layers.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={sub === 'parts'} className={`lw-subtab${sub === 'parts' ? ' active' : ''}`} onClick={() => setSub('parts')}
          title="Bộ phận & biến thể: nhóm liên kết, thay nhanh khuôn mặt / biểu cảm">
          <IconPuzzle width={13} height={13} /> <span>Bộ phận</span> <span className="lw-count">{composite.partGroups?.length ?? 0}</span>
        </button>
      </div>
      {sub === 'stack' ? (
        <LayerStack {...props} />
      ) : (
        <WorkshopPartsPanel composite={composite} setComposite={setComposite} selectedIds={selectedIds} onSelectLayer={onSelectLayer} onSetIds={onSetIds} onOpenSwap={openSwap} />
      )}
      {selectedIds.length > 1 ? (
        <div className="lw-props-panel"><WorkshopSelectionPanel selectedIds={selectedIds} onSelectLayer={onSelectLayer} onBatchAction={onBatchAction} /></div>
      ) : selectedLayer ? (
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
        />
      ) : (
        <div className="lw-props-panel"><div className="lw-empty">Bấm chọn một layer trong danh sách hoặc trên khung nhìn để chỉnh vị trí, chiều sâu, bộ phận và xương.</div></div>
      )}
      {swap && (
        <WorkshopPartSwap composite={composite} layerId={swap.layerId} initialMode={swap.mode} setComposite={setComposite}
          onSelectLayer={(id) => onSelectLayer(id)} onClose={() => setSwap(null)} />
      )}
    </div>
  )
}
