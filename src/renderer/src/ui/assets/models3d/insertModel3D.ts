import { nanoid } from 'nanoid'
import type { Model3D } from './types'
import { useEditor } from '../../../store/editor'
import { importBuiltInAsset } from '../../../actions'
import { assetStore } from '../../../project/assets'
import { createImageLayer, createSolidLayer } from '../../../project/factory'
import type { BuiltInAssetItem } from '@shared/ipc'
import type { AssetMeta, ImageLayer, SolidLayer, Vec3 } from '@shared/types'
import { faceToMeshDefinition } from '@renderer/engine/imageMesh/legacyAdapter'

export interface InsertModelOptions {
  model: Model3D
  globalScale?: number
  positionOffset?: [number, number, number]
  targetShotId?: string | null
}

export async function insertModel3DToScene({
  model,
  globalScale = 1.0,
  positionOffset = [0, 0, 0],
  targetShotId
}: InsertModelOptions): Promise<string[]> {
  const state = useEditor.getState()
  const shotId = targetShotId ?? state.selectedShotId ?? state.project.shots[0]?.id ?? null
  const comp = state.project.comp
  const combinedScale = model.scale * globalScale
  const instanceId = 'm3d-' + nanoid(8)

  // Load built-in catalog to resolve relative asset paths
  let builtInItems: BuiltInAssetItem[] = []
  try {
    if (typeof window !== 'undefined' && window.api?.getBuiltInCatalog) {
      const cat = await window.api.getBuiltInCatalog()
      builtInItems = cat.items || []
    }
  } catch (e) {
    console.warn('[insertModel3D] Could not fetch built-in catalog:', e)
  }

  const createdLayerIds: string[] = []
  const layersToAdd: (ImageLayer | SolidLayer)[] = []

  for (let i = 0; i < model.faces.length; i++) {
    const face = model.faces[i]
    if (face.hidden) continue
    const layerName = `[${model.name.split('(')[0].trim()}] ${face.name}`

    // Compute scaled placement relative to positionOffset
    const posX = (face.position[0] * combinedScale) + positionOffset[0]
    const posY = (face.position[1] * combinedScale) + positionOffset[1]
    const posZ = (face.position[2] * combinedScale) + positionOffset[2]

    let added = false

    if (face.assetPath) {
      // Find asset in project assets first
      const curProjectAssets = useEditor.getState().project.assets
      let projectAsset: AssetMeta | undefined = curProjectAssets.find(
        (a) => a.path?.endsWith(face.assetPath!) || a.name === face.name
      )

      // Try loading from asset-3ds if path references asset-3ds
      if (!projectAsset && (face.assetPath.includes('asset-3ds') || face.assetPath.includes('tudor_cottage'))) {
        try {
          if (window.api?.asset3ds?.loadBytes) {
            const cleanPath = face.assetPath.replace(/^asset-3ds[\\/]/, '')
            const file = await window.api.asset3ds.loadBytes(cleanPath)
            if (file) {
              const addedAsset = await assetStore.add(file.name, file.mime, file.data, 'image')
              useEditor.getState().update((p) => {
                if (!p.assets.some((a) => a.id === addedAsset.meta.id)) {
                  p.assets.push(addedAsset.meta)
                }
              })
              projectAsset = addedAsset.meta
            }
          }
        } catch (err) {
          console.warn('[insertModel3D] Error loading asset-3ds bytes:', err)
        }
      }

      // Try loading from built-in assets if path references assembly_3d or house
      if (!projectAsset && window.api?.loadBuiltInAssetBytes) {
        try {
          const file =
            (await window.api.loadBuiltInAssetBytes(face.assetPath)) ||
            (await window.api.loadBuiltInAssetBytes(`assembly_3d/${face.assetPath.replace(/^assembly_3d[\\/]/, '')}`))
          if (file) {
            const addedAsset = await assetStore.add(file.name, file.mime, file.data, 'image')
            useEditor.getState().update((p) => {
              if (!p.assets.some((a) => a.id === addedAsset.meta.id)) {
                p.assets.push(addedAsset.meta)
              }
            })
            projectAsset = addedAsset.meta
          }
        } catch (err) {
          console.warn('[insertModel3D] Error loading built-in bytes:', err)
        }
      }

      // Fallback: Find in built-in items
      if (!projectAsset) {
        const cleanBuiltIn = face.assetPath.replace(/^asset-3ds[\\/]/, '')
        const builtIn = builtInItems.find(
          (b) =>
            b.relativePath === face.assetPath ||
            b.relativePath === cleanBuiltIn ||
            `${b.folder}/${b.fileName}` === face.assetPath
        )
        if (builtIn) {
          const importedId = await importBuiltInAsset(builtIn, false)
          if (importedId) {
            projectAsset = useEditor.getState().project.assets.find((a) => a.id === importedId)
          }
        }
      }

      if (projectAsset) {
        const imageLayer: ImageLayer = createImageLayer(projectAsset, comp, posZ)
        imageLayer.name = layerName
        imageLayer.shotId = shotId
        imageLayer.autoScale = false
        imageLayer.transform.position.value = [posX, posY, posZ]
        imageLayer.transform.rotation.value = face.rotation
        imageLayer.transform.scale.value = [combinedScale, combinedScale, combinedScale]
        if (face.width && face.height) {
          imageLayer.props.width = face.width
          imageLayer.props.height = face.height
        }
        const meshDef = faceToMeshDefinition(face)
        imageLayer.mesh = meshDef
        imageLayer.model3d = {
          instanceId,
          modelId: model.id,
          modelName: model.name,
          faceId: face.id,
          initialScale: model.scale,
          globalScale: combinedScale,
          basePosition: face.position,
          centerPosition: positionOffset,
          baseSize: [face.width, face.height],
          mesh: meshDef
        }

        layersToAdd.push(imageLayer)
        createdLayerIds.push(imageLayer.id)
        added = true
      }
    }

    if (!added) {
      // Fallback: Add Solid Layer with color
      const solidLayer: SolidLayer = createSolidLayer(comp)
      solidLayer.name = layerName
      solidLayer.shotId = shotId
      solidLayer.autoScale = false
      solidLayer.props.color = face.color || '#8b7bff'
      solidLayer.props.width = face.width
      solidLayer.props.height = face.height
      solidLayer.transform.position.value = [posX, posY, posZ]
      solidLayer.transform.rotation.value = face.rotation
      solidLayer.transform.scale.value = [combinedScale, combinedScale, combinedScale]
      const meshDef = faceToMeshDefinition(face)
      solidLayer.mesh = meshDef
      solidLayer.model3d = {
        instanceId,
        modelId: model.id,
        modelName: model.name,
        faceId: face.id,
        initialScale: model.scale,
        globalScale: combinedScale,
        basePosition: face.position,
        centerPosition: positionOffset,
        baseSize: [face.width, face.height],
        mesh: meshDef
      }

      layersToAdd.push(solidLayer)
      createdLayerIds.push(solidLayer.id)
    }
  }

  if (layersToAdd.length > 0) {
    useEditor.getState().update((p) => {
      p.layers.unshift(...layersToAdd)
    })
  }

  if (createdLayerIds.length > 0) {
    useEditor.getState().selectLayer(createdLayerIds[0])
  }

  return createdLayerIds
}

/**
 * Rescales all faces of an assembled 3D model instance in the scene.
 * Called from the Right Column (LayerInspector) when the user adjusts the 3D model's global scale.
 */
export function rescaleModel3DInstance(
  instanceId: string,
  newGlobalScale: number,
  newCenter?: Vec3
): void {
  useEditor.getState().update((p) => {
    const relatedLayers = p.layers.filter((l) => l.model3d?.instanceId === instanceId)
    if (relatedLayers.length === 0) return

    for (const l of relatedLayers) {
      if (!l.model3d) continue
      const basePos = l.model3d.basePosition
      const center = newCenter ?? l.model3d.centerPosition ?? [0, 0, 0]
      const scale = newGlobalScale

      // Update position: center + basePos * scale
      l.transform.position.value = [
        center[0] + (basePos[0] * scale),
        center[1] + (basePos[1] * scale),
        center[2] + (basePos[2] * scale)
      ]
      l.transform.scale.value = [scale, scale, scale]
      l.model3d.globalScale = scale
      if (newCenter) l.model3d.centerPosition = newCenter

      if (l.type === 'solid' && l.model3d.baseSize) {
        l.props.width = l.model3d.baseSize[0]
        l.props.height = l.model3d.baseSize[1]
      }
    }
  })
}

/**
 * Dịch chuyển toàn bộ các mặt của mô hình 3D trong phân cảnh một đoạn delta [dx, dy, dz].
 */
export function translateModel3DInstance(
  instanceId: string,
  delta: Vec3
): void {
  useEditor.getState().update((p) => {
    const relatedLayers = p.layers.filter((l) => l.model3d?.instanceId === instanceId)
    if (relatedLayers.length === 0) return

    for (const l of relatedLayers) {
      if (!l.model3d) continue
      const curPos = l.transform.position.value
      l.transform.position.value = [
        curPos[0] + delta[0],
        curPos[1] + delta[1],
        curPos[2] + delta[2]
      ]
      if (l.model3d.centerPosition) {
        l.model3d.centerPosition = [
          l.model3d.centerPosition[0] + delta[0],
          l.model3d.centerPosition[1] + delta[1],
          l.model3d.centerPosition[2] + delta[2]
        ]
      }
    }
  })
}

/**
 * Xoay toàn bộ các mặt của mô hình 3D quanh tâm mô hình theo trục axis một góc deltaDeg.
 */
export function rotateModel3DInstance(
  instanceId: string,
  axis: 0 | 1 | 2,
  deltaDeg: number,
  center?: Vec3
): void {
  useEditor.getState().update((p) => {
    const relatedLayers = p.layers.filter((l) => l.model3d?.instanceId === instanceId)
    if (relatedLayers.length === 0) return

    const rad = (deltaDeg * Math.PI) / 180
    const cosA = Math.cos(rad)
    const sinA = Math.sin(rad)
    const c = center ?? relatedLayers[0].model3d?.centerPosition ?? [0, 0, 0]

    for (const l of relatedLayers) {
      if (!l.model3d) continue
      const pos = l.transform.position.value
      // Dời về gốc tọa độ tâm
      const rx = pos[0] - c[0]
      const ry = pos[1] - c[1]
      const rz = pos[2] - c[2]

      let nx = rx
      let ny = ry
      let nz = rz

      if (axis === 0) {
        ny = ry * cosA - rz * sinA
        nz = ry * sinA + rz * cosA
      } else if (axis === 1) {
        nx = rx * cosA + rz * sinA
        nz = -rx * sinA + rz * cosA
      } else {
        nx = rx * cosA - ry * sinA
        ny = rx * sinA + ry * cosA
      }

      l.transform.position.value = [c[0] + nx, c[1] + ny, c[2] + nz]

      // Cập nhật rotation của layer
      const rot = [...l.transform.rotation.value] as Vec3
      rot[axis] = (rot[axis] + deltaDeg) % 360
      l.transform.rotation.value = rot
    }
  })
}
