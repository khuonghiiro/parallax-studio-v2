import type { Project } from '@shared/types'
import type { LayerComposite } from '../layerAssembly/types'
import type { Model3D } from './models3d/types'
import { getStoredComposites } from '../layerAssembly/layerAssemblyStorage'
import { getStoredModels3D } from './models3d/models3dStorage'
import { useEditor } from '../../store/editor'

export interface AssetUsageTarget {
  id?: string
  assetId?: string
  name?: string
  fileName?: string
  relativePath?: string
  assetPath?: string
  path?: string
  previewUrl?: string
  kind?: 'image' | 'audio'
  isCustom?: boolean
  scope?: 'public' | 'private'
  size?: number
}

export interface AssetShotUsage {
  shotId: string
  shotName: string
  layerId: string
  layerName: string
  layerType: string
}

export interface AssetCompositeUsage {
  compositeId: string
  compositeName: string
  layerId?: string
  layerName: string
}

export interface AssetModel3DUsage {
  modelId: string
  modelName: string
  faceId?: string
  faceName: string
}

export interface AssetUsageReport {
  target: AssetUsageTarget
  totalUsages: number
  shots: AssetShotUsage[]
  composites: AssetCompositeUsage[]
  models3D: AssetModel3DUsage[]
}

/** Chuẩn hoá đường dẫn để so khớp không phân biệt dấu gạch chéo */
function normPath(p?: string | null): string {
  if (!p) return ''
  return p.replace(/\\/g, '/').toLowerCase().trim()
}

/**
 * Quét toàn bộ hệ thống để tìm tất cả các vị trí đang sử dụng tài nguyên ảnh/âm thanh:
 * 1. Các cảnh (Shots) & Layers trong dự án hiện tại
 * 2. Các mẫu trong Xưởng Lắp Ráp Layer (Layer Composites)
 * 3. Các mô hình trong Thư Viện 3D (3D Models)
 */
export function findAssetUsages(
  target: AssetUsageTarget,
  customProject?: Project | null,
  customComposites?: LayerComposite[] | null,
  customModels?: Model3D[] | null
): AssetUsageReport {
  const shotsUsage: AssetShotUsage[] = []
  const compositesUsage: AssetCompositeUsage[] = []
  const models3DUsage: AssetModel3DUsage[] = []

  const targetId = (target.id || target.assetId)?.trim() || ''
  const targetRel = normPath(target.relativePath || target.assetPath)
  const targetPath = normPath(target.path)
  const targetFile = normPath(target.fileName)
  const targetName = target.name?.trim().toLowerCase() || ''
  const targetUrl = target.previewUrl?.trim() || ''

  // 1. Quét trong Dự án (Shots & Layers)
  let proj: Project | null = customProject || null
  if (!proj && typeof window !== 'undefined') {
    try {
      proj = useEditor.getState().project
    } catch {
      /* ignore */
    }
  }

  if (proj) {
    const shotMap = new Map<string, string>()
    ;(proj.shots || []).forEach((s) => {
      shotMap.set(s.id, s.name || `Cảnh ${s.id}`)
    })

    // Bản đồ asset trong project
    const projAssets = proj.assets || []
    const matchingProjAssetIds = new Set<string>()
    projAssets.forEach((pa) => {
      const pId = pa.id
      const pRel = normPath(pa.assetPath)
      const pPath = normPath(pa.path)
      const pName = pa.name?.toLowerCase().trim() || ''
      if (
        (targetId && pId === targetId) ||
        (targetRel && (pRel === targetRel || pRel.endsWith(targetRel) || targetRel.endsWith(pRel))) ||
        (targetPath && (pPath === targetPath || pPath.endsWith(targetPath) || targetPath.endsWith(pPath))) ||
        (targetFile && (pPath.endsWith(targetFile) || pRel.endsWith(targetFile))) ||
        (targetName && pName === targetName)
      ) {
        matchingProjAssetIds.add(pId)
      }
    })

    ;(proj.layers || []).forEach((l) => {
      const shotName = shotMap.get(l.shotId || '') || 'Cảnh mặc định'
      let matched = false

      if (l.type === 'image') {
        const aid = l.props?.assetId
        if (
          (aid && aid === targetId) ||
          (aid && matchingProjAssetIds.has(aid)) ||
          (aid && targetRel && normPath(aid) === targetRel)
        ) {
          matched = true
        }
      } else if (l.type === 'particles') {
        const tid = (l.props as unknown as Record<string, unknown>)?.textureAssetId as string | undefined
        if (
          (tid && tid === targetId) ||
          (tid && matchingProjAssetIds.has(tid)) ||
          (tid && targetRel && normPath(tid) === targetRel)
        ) {
          matched = true
        }
      }

      if (matched) {
        shotsUsage.push({
          shotId: l.shotId || '',
          shotName,
          layerId: l.id,
          layerName: l.name || 'Layer không tên',
          layerType: l.type
        })
      }
    })

    // Âm thanh
    if (target.kind === 'audio') {
      const mainAudioAid = proj.audio?.assetId
      if (mainAudioAid && (mainAudioAid === targetId || matchingProjAssetIds.has(mainAudioAid))) {
        shotsUsage.push({
          shotId: '',
          shotName: 'Dự án (Nhạc nền)',
          layerId: 'audio-main',
          layerName: 'Nhạc nền chính',
          layerType: 'audio'
        })
      }
      ;(proj.audioTracks || []).forEach((t) => {
        if (t.assetId === targetId || matchingProjAssetIds.has(t.assetId)) {
          shotsUsage.push({
            shotId: '',
            shotName: 'Timeline',
            layerId: t.id,
            layerName: t.name || 'Đoạn âm thanh',
            layerType: 'audio'
          })
        }
      })
    }
  }

  // 2. Quét trong Xưởng Lắp Ráp Layer (Composites)
  const composites = customComposites || getStoredComposites()
  composites.forEach((comp) => {
    ;(comp.layers || []).forEach((l) => {
      const lPath = normPath(l.assetPath)
      const lSrc = ((l as unknown as Record<string, string>).src || l.imageUrl)?.trim() || ''
      const lName = l.name?.toLowerCase().trim() || ''
      const lId = (l as unknown as Record<string, string>).assetId?.trim() || ''

      const isMatch =
        (targetId && lId === targetId) ||
        (targetRel && (lPath === targetRel || lPath.endsWith(targetRel) || targetRel.endsWith(lPath))) ||
        (targetPath && (lPath === targetPath || lPath.endsWith(targetPath) || targetPath.endsWith(lPath))) ||
        (targetFile && lPath.endsWith(targetFile)) ||
        (targetUrl && lSrc === targetUrl) ||
        (targetName && lName === targetName && targetName.length > 2)

      if (isMatch) {
        compositesUsage.push({
          compositeId: comp.id,
          compositeName: comp.name || 'Mẫu layer không tên',
          layerId: l.id,
          layerName: l.name || 'Layer bộ phận'
        })
      }
    })
  })

  // 3. Quét trong Mô hình 3D (Models3D)
  const models = customModels || getStoredModels3D()
  models.forEach((m) => {
    ;(m.faces || []).forEach((f) => {
      const faceRec = f as unknown as Record<string, unknown>
      const fImg = normPath((faceRec.image || f.assetPath) as string)
      const fTex = normPath(faceRec.textureAssetPath as string)
      const fAid = (f.assetId as string)?.trim() || ''

      const isMatch =
        (targetId && fAid === targetId) ||
        (targetRel && (fImg === targetRel || fImg.endsWith(targetRel) || fTex === targetRel || fTex.endsWith(targetRel))) ||
        (targetPath && (fImg === targetPath || fImg.endsWith(targetPath))) ||
        (targetFile && (fImg.endsWith(targetFile) || fTex.endsWith(targetFile))) ||
        (targetUrl && (faceRec.image === targetUrl || faceRec.textureUrl === targetUrl))

      if (isMatch) {
        models3DUsage.push({
          modelId: m.id,
          modelName: m.name || 'Mô hình 3D không tên',
          faceId: f.id as string,
          faceName: (f.name as string) || `Diện mặt #${f.id}`
        })
      }
    })
  })

  return {
    target,
    totalUsages: shotsUsage.length + compositesUsage.length + models3DUsage.length,
    shots: shotsUsage,
    composites: compositesUsage,
    models3D: models3DUsage
  }
}
