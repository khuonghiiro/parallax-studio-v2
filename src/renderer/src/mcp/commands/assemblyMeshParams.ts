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
  return patch
}
