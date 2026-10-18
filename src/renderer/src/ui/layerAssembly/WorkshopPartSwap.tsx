import type { AssembledLayerItem, LayerComposite } from './types'
import { PartSwapDialog, type PartSwapMode } from './PartSwapDialog'
import { usePartAssetCatalog } from './usePartAssetCatalog'
import {
  activateVariant,
  findGroup,
  folderOf,
  layerAssetPath,
  mergeCompositeAssets,
  relatedCandidates,
  replacePartAsset,
  slotVariants,
  type PartAssetCandidate
} from './workshopParts'

export interface WorkshopPartSwapProps {
  composite: LayerComposite
  layerId: string
  initialMode?: 'replace' | 'variant'
  setComposite: (next: LayerComposite) => void
  onSelectLayer: (id: string) => void
  onClose: () => void
}

function variantCandidates(composite: LayerComposite, layer: AssembledLayerItem) {
  return slotVariants(composite, layer.slot).map((v) => ({
    key: v.id,
    path: layerAssetPath(composite, v) || v.imageUrl || '',
    previewUrl: v.imageUrl,
    name: v.variant || v.name,
    active: !v.hidden
  }))
}

/** Hộp thoại Thay thế bộ phận trong Xưởng: đổi biến thể / thay ảnh giữ nguyên vị trí neo. */
export function WorkshopPartSwap({ composite, layerId, initialMode, setComposite, onSelectLayer, onClose }: WorkshopPartSwapProps) {
  const { items: catalog } = usePartAssetCatalog()
  const pool = mergeCompositeAssets(composite.assets, catalog)
  const layer = composite.layers.find((l) => l.id === layerId)
  if (!layer) return null
  const path = layerAssetPath(composite, layer)
  const group = findGroup(composite, layer.partGroupId)
  const onPick = (cand: PartAssetCandidate, mode: PartSwapMode, key?: string) => {
    if (mode === 'activate' && key) {
      setComposite(activateVariant(composite, key))
      onSelectLayer(key)
      return
    }
    const res = replacePartAsset(composite, layerId, cand, mode === 'variant' ? 'variant' : 'replace')
    setComposite(res.composite)
    onSelectLayer(res.layerId)
  }
  return (
    <PartSwapDialog
      scope="workshop"
      partName={layer.name}
      current={{ path: path || undefined, previewUrl: layer.imageUrl, assets: composite.assets }}
      info={[
        ['Nhóm', group?.name ?? 'Chưa gán'],
        ['Khe biến thể', layer.slot ?? 'Chưa có'],
        ['Vị trí giữ nguyên', `X ${Math.round(layer.x)} · Y ${Math.round(layer.y)} · Z ${layer.z}`],
        ['Xương', layer.boneId ?? 'Không gắn']
      ]}
      variants={variantCandidates(composite, layer)}
      related={relatedCandidates(path, layer.slot, pool)}
      all={pool}
      allowVariantMode
      initialMode={initialMode}
      uploadFolder={folderOf(path)}
      onPick={onPick}
      onClose={onClose}
    />
  )
}
