import type { Face3D } from '../../ui/assets/models3d/types'
import { ParamError, type Params } from '../types'
import { has, num, str } from '../params'

/** Validate before any model mutation (also protects execute_script callers). */
export function assemblyMeshPatch(p: Params): Partial<Face3D> {
  const patch: Partial<Face3D> = {}
  for (const [param, key, min, max] of [
    ['grid_res', 'gridRes', 4, 128], ['bend_x', 'bendX', -100, 100],
    ['bend_y', 'bendY', -100, 100], ['depth_intensity', 'depthIntensity', -200, 200]
  ] as const) {
    if (!has(p, param)) continue
    const value = num(p, param)
    if (value === undefined || !Number.isFinite(value) || value < min || value > max || (key === 'gridRes' && !Number.isInteger(value))) {
      throw new ParamError(`${param} must be ${min}..${max}${key === 'gridRes' ? ' (integer)' : ''}`)
    }
    patch[key] = value
    if (key === 'gridRes') { patch.gridCols = undefined; patch.gridRows = undefined }
  }
  if (has(p, 'mesh_mode')) {
    const value = str(p, 'mesh_mode')
    if (value !== 'auto' && value !== 'manual') throw new ParamError('mesh_mode must be auto or manual')
    patch.meshMode = value
  }
  if (has(p, 'depth_profile')) {
    const value = str(p, 'depth_profile')
    if (!['none', 'luminance', 'sphere', 'cylinder', 'slope', 'ridge'].includes(value ?? '')) throw new ParamError('Invalid depth_profile')
    patch.depthProfile = value as Face3D['depthProfile']
  }
  if (has(p, 'bend_region')) {
    const value = str(p, 'bend_region')
    if (!['all', 'bottom', 'top', 'left', 'right', 'curl'].includes(value ?? '')) throw new ParamError('Invalid bend_region')
    patch.bendRegion = value as Face3D['bendRegion']
  }
  if (has(p, 'silhouette_polygon')) {
    const raw = p['silhouette_polygon']
    if (!Array.isArray(raw)) throw new ParamError('silhouette_polygon must be an array of [u, v] points')
    for (const pt of raw) {
      if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
        throw new ParamError('Each point in silhouette_polygon must be [u, v] numbers')
      }
    }
    patch.silhouettePolygon = raw as number[][]
  }
  return patch
}
