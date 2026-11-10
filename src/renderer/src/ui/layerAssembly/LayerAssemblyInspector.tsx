import { useMemo, useState } from 'react'
import { WorkshopSelectionPanel } from './WorkshopSelectionPanel'
import type { WorkshopAction } from './workshopActions'
import type { LayerComposite, AssembledLayerItem } from './types'
import { LayerRowItem } from './LayerAssemblyRow'
import { WorkshopLayerProps } from './WorkshopLayerProps'
import { WorkshopPartsPanel } from './WorkshopPartsPanel'
import { WorkshopPartSwap } from './WorkshopPartSwap'
import { findGroup } from './workshopParts'
import { analyzeCutoutParts } from './workshopCutoutRig'
import {
  autoScanAndBindClothRegionsForComposite,
  detectGarmentCoversLegs
} from './workshopClothScanner'
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
  setComposite,
  selectedIds,
  onSelectLayer,
  onUpdateLayer,
  onMoveLayerOrder,
  onAddLayer,
  onAllAction
}: LayerAssemblyInspectorProps & {
  selectedLayer: AssembledLayerItem | null
}) {
  const cutoutParts = useMemo(() => analyzeCutoutParts(composite.layers), [composite.layers])
  const garmentInfo = useMemo(
    () => detectGarmentCoversLegs(composite.layers, composite.rig?.bones ?? []),
    [composite.layers, composite.rig?.bones]
  )
  const roleLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of cutoutParts) {
      const isRobe = garmentInfo.robeLayers.some((r) => r.id === p.layer.id)
      map.set(p.layer.id, isRobe ? 'Thân áo dài (che chân)' : p.roleLabel)
    }
    return map
  }, [cutoutParts, garmentInfo.robeLayers])

  const handleAutoSemanticNames = () => {
    const nextLayers = composite.layers.map((l, idx) => {
      const roleLabel = roleLabelById.get(l.id)
      if (!roleLabel) return l
      const sizeMatch = (l.name || '').match(/\(\d+\s*[×x*]\s*\d+\)/)
      const sizeSuffix = sizeMatch ? ` ${sizeMatch[0]}` : ''
      const isGeneric = /^mảnh\s*#?\d+/i.test((l.name || '').trim())
      if (!isGeneric && !l.name.startsWith(roleLabel)) return l
      return {
        ...l,
        name: `${roleLabel} #${idx + 1}${sizeSuffix}`
      }
    })
    setComposite({ ...composite, layers: nextLayers })
  }

  return (
    <section className="lw-layer-stack" data-mcp-region="layer_assembly_layers" aria-label="Xếp chồng layer">
      <div className="lw-pane-head">
        <div className="lw-pane-title">
          <IconLayersStack width={14} height={14} /> Xếp chồng layer{' '}
          <span className="lw-count">{composite.layers.length}</span>
        </div>
        <div className="lw-pane-head-actions">
          <button
            type="button"
            className="lw-btn sm ghost lw-ai-name-btn"
            onClick={handleAutoSemanticNames}
            disabled={composite.layers.length === 0}
            title="Tự động điền tên bộ phận gợi ý (Thân áo dài, Chân trái, Cánh tay...) cho các mảnh để AI hiểu rõ giải phẫu nhân vật"
            aria-label="Đặt tên gợi ý AI cho các mảnh"
          >
            🏷️ Tên AI
          </button>
          <button
            type="button"
            className="lw-btn sm primary"
            onClick={onAddLayer}
            title="Thêm một layer trống vào cụm"
          >
            <IconPlus width={12} height={12} /> Thêm
          </button>
        </div>
      </div>
      <div className="lw-ztools" role="group" aria-label="Tách chiều sâu Z nhanh">
        <span className="lw-ztools-label">Tách Z</span>
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
            roleLabel={roleLabelById.get(layer.id)}
            assets={composite.assets}
            onSelect={(additive) => onSelectLayer(layer.id, additive)}
            onRename={(newName) => onUpdateLayer(layer.id, { name: newName })}
            onToggleHide={() => onUpdateLayer(layer.id, { hidden: !layer.hidden })}
            onToggleLock={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
            onMoveUp={() => onMoveLayerOrder(layer.id, 'up')}
            onMoveDown={() => onMoveLayerOrder(layer.id, 'down')}
          />
        ))}
        {composite.layers.length === 0 && (
          <div className="lw-subtab-empty">
            <div className="lw-subtab-empty-icon">
              <IconSubTabLayerStack width={24} height={24} />
            </div>
            <div className="lw-subtab-empty-title">Chưa có layer nào</div>
            <div className="lw-subtab-empty-desc">
              Chọn ảnh ở cột Tài nguyên bên trái hoặc bấm <strong>Thêm</strong> để bắt đầu lắp ráp.
            </div>
          </div>
        )}
      </div>
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
                <div className="lw-props-panel">
                  <div className="lw-prop-section">
                    <div className="lw-prop-head">
                      <span className="lw-prop-title">
                        <IconSubTabCloth width={13} height={13} />
                        Quét vùng vải &amp; Áo dài uốn theo chân
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0, lineHeight: 1.45 }}>
                      Quét tự động các mảnh Áo dài / Trường bào / Váy che khuất chân để gắn xương đùi uốn vải vật lý khi bước đi và giữ chân không lòi đè lên áo:
                    </p>
                    <button
                      type="button"
                      className="lw-btn primary block"
                      onClick={() => {
                        const res = autoScanAndBindClothRegionsForComposite(composite)
                        setComposite(res.composite)
                        const robe = detectGarmentCoversLegs(
                          res.composite.layers,
                          res.composite.rig?.bones ?? []
                        ).robeLayers[0]
                        if (robe) onSelectLayer(robe.id)
                      }}
                    >
                      🔍 Quét &amp; Gắn Vùng Vải Uốn Theo Chân/Tay
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                        Hoặc chọn nhanh một mảnh để cấu hình Xương &amp; Vải:
                      </span>
                      <div className="lw-chip-row">
                        {composite.layers.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className="lw-chip"
                            onClick={() => onSelectLayer(l.id)}
                          >
                            {l.isCloth ? '👗 ' : ''}
                            {l.name}
                          </button>
                        ))}
                      </div>
                    </div>
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
