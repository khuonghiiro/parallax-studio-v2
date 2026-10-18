import { useMemo, useState } from 'react'
import type { Layer } from '@shared/types'
import { PartSwapDialog } from '../../layerAssembly/PartSwapDialog'
import { PartThumb } from '../../layerAssembly/PartThumb'
import { usePartAssetCatalog } from '../../layerAssembly/usePartAssetCatalog'
import { folderOf, mergeCompositeAssets, relatedCandidates } from '../../layerAssembly/workshopParts'
import {
  findCompositeTemplate,
  listSceneVariants,
  sceneLayerPath,
  sceneSlot,
  swapScenePart,
  type ScenePartCandidate
} from '../../layerAssembly/scenePartSwap'
import { toast } from '../../../actions'
import { IconFaceSwap, IconReplace } from '../../icons'
import '../../../styles/layerWorkshopPanels.css'

const stripPrefix = (name: string) => name.replace(/^\[[^\]]+\]\s*/, '')

async function applySwap(layerId: string, cand: ScenePartCandidate): Promise<void> {
  try {
    await swapScenePart(layerId, cand)
  } catch (err) {
    toast(`Không đổi được bộ phận: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function SlotStrip({ layer, variants, onMore }: { layer: Layer; variants: ScenePartCandidate[]; onMore: () => void }) {
  return (
    <div className="lw-slot-row">
      <div className="lw-slot-name">
        <span><IconFaceSwap width={12} height={12} /> {stripPrefix(layer.name)}</span>
        <span className="lw-count">{variants.length} biến thể</span>
      </div>
      <div className="lw-variant-strip">
        {variants.map((v) => (
          <button key={v.key} type="button" className={`lw-variant${v.active ? ' active' : ''}`} title={`Đổi sang "${v.name}" (giữ nguyên vị trí & keyframe)`}
            onClick={() => void applySwap(layer.id, v)}>
            <PartThumb path={v.path} previewUrl={v.previewUrl} />
            <span className="lw-variant-name">{v.name}</span>
          </button>
        ))}
        <button type="button" className="lw-variant add" onClick={onMore} title="Chọn ảnh khác cùng thư mục nhân vật">
          <span className="lw-variant-plus"><IconReplace width={16} height={16} /></span>
          <span className="lw-variant-name">Khác…</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Đổi nhanh bộ phận / biểu cảm của nhân vật 2.5D trong cảnh: hiện các khe biến thể (VD khuôn mặt) của cả cụm,
 * bấm 1 lần để đổi khóc / cười… trùng khớp vị trí; hoặc mở hộp thoại để chọn ảnh liên quan cùng thư mục.
 */
export function CompositePartSwapSection({ layer, compLayers }: { layer: Layer; compLayers: Layer[] }) {
  const [dialogLayerId, setDialogLayerId] = useState<string | null>(null)
  const template = useMemo(() => findCompositeTemplate(layer.composite?.compositeId), [layer.composite?.compositeId])
  const slotLayers = useMemo(
    () => compLayers.filter((l) => l.type === 'image' && listSceneVariants(l, template).length > 0),
    [compLayers, template]
  )
  const { items: catalog } = usePartAssetCatalog(Boolean(dialogLayerId))
  const dialogLayer = compLayers.find((l) => l.id === dialogLayerId)
  const pool = useMemo(() => mergeCompositeAssets(template?.assets, catalog), [template, catalog])

  return (
    <div className="composite-part-swap" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>Đổi nhanh bộ phận / biểu cảm</span>
        {layer.type === 'image' && (
          <button type="button" className="lw-btn sm" onClick={() => setDialogLayerId(layer.id)} title="Thay ảnh layer đang chọn, giữ nguyên vị trí & keyframe">
            <IconReplace width={12} height={12} /> Thay layer này…
          </button>
        )}
      </div>
      {slotLayers.length === 0 ? (
        <p className="lw-hint" style={{ padding: 0 }}>
          Mẫu chưa có khe biến thể. Mở Xưởng Lắp Ráp Layer → tab Layer → <b>Bộ phận</b> → <b>Tự nhận diện</b> (VD face-normal / face-happy), lưu mẫu rồi chèn lại.
        </p>
      ) : (
        slotLayers.map((l) => <SlotStrip key={l.id} layer={l} variants={listSceneVariants(l, template)} onMore={() => setDialogLayerId(l.id)} />)
      )}
      {dialogLayer && (
        <PartSwapDialog
          scope="scene"
          partName={stripPrefix(dialogLayer.name)}
          current={{ path: sceneLayerPath(dialogLayer, template) || undefined, assets: template?.assets }}
          info={[
            ['Nhân vật', layer.composite?.compositeName ?? '—'],
            ['Khe biến thể', sceneSlot(dialogLayer, template) ?? 'Chưa có'],
            ['Giữ nguyên', 'Vị trí · Keyframe · Motion']
          ]}
          variants={listSceneVariants(dialogLayer, template)}
          related={relatedCandidates(sceneLayerPath(dialogLayer, template), sceneSlot(dialogLayer, template), pool)}
          all={pool}
          uploadFolder={folderOf(sceneLayerPath(dialogLayer, template))}
          onPick={(cand, _mode, key) => applySwap(dialogLayer.id, { ...cand, key: key ?? cand.path, sourceLayerId: key })}
          onClose={() => setDialogLayerId(null)}
        />
      )}
    </div>
  )
}
