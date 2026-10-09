/**
 * Image Mesh Definition Schema
 *
 * Fully serializable JSON structure defining a 2.5D/3D organic deformable mesh.
 * Stores rest domain, UVs, ordered modifier stack, motion config and material bindings.
 * Never contains THREE.js objects or executable functions.
 */

export const IMAGE_MESH_DEFINITION_VERSION = 1

export type ModifierType =
  | 'bend'
  | 'twist'
  | 'taper'
  | 'curve'
  | 'lattice'
  | 'sculpt'
  | 'depthProfile'

export interface BaseSurface {
  width: number
  height: number
  /** Number of grid subdivisions [cols, rows] (e.g. [32, 48]) */
  subdivisions: [number, number]
  /** Rest domain bounds [uMin, vMin, uMax, vMax] (0..1) */
  restUVBounds: [number, number, number, number]
}

export interface BendModifier {
  type: 'bend'
  id: string
  enabled: boolean
  axis: 'x' | 'y'
  /** Curvature intensity (-100..100) */
  intensity: number
  region?: 'all' | 'bottom' | 'top' | 'left' | 'right' | 'curl'
  /** Exact cylindrical arc coverage angle in degrees (e.g. 180° for half-cylinder, 90° for quarter) */
  arcAngle?: number
  /** Taper ratio (0..1) from base to tip */
  taperRatio?: number
  /** Lateral curve displacement (-100..100) */
  lateral?: number
}

export interface TwistModifier {
  type: 'twist'
  id: string
  enabled: boolean
  /** Twist angle in degrees around longitudinal axis */
  angle: number
  /** Center of twist along length (0..1) */
  center?: number
  /** Falloff exponent */
  falloff?: number
}

export interface CurveControlPoint {
  /** Normalized position [x, y, z] along rest spine */
  position: [number, number, number]
  /** Tangent vector [dx, dy, dz] */
  tangent?: [number, number, number]
}

export interface CurveModifier {
  type: 'curve'
  id: string
  enabled: boolean
  /** 3 to 5 spine control points from root to tip */
  controlPoints: CurveControlPoint[]
}

export interface LatticeModifier {
  type: 'lattice'
  id: string
  enabled: boolean
  /** Lattice resolution [nx, ny, nz] (typically [4, 4, 1] or [4, 4, 4]) */
  dimensions: [number, number, number]
  /** Offset vectors [dx, dy, dz] for each lattice control point */
  offsets: [number, number, number][]
}

export interface SculptStrokeSample {
  uv: [number, number]
  pressure: number
  radius: number
  mode: 'inflate' | 'deflate' | 'grab' | 'smooth'
  direction?: [number, number, number]
}

export interface SculptModifier {
  type: 'sculpt'
  id: string
  enabled: boolean
  strokes: SculptStrokeSample[]
}

export interface DepthProfileModifier {
  type: 'depthProfile'
  id: string
  enabled: boolean
  profile: 'none' | 'ridge' | 'sphere' | 'slope' | 'cylinder' | 'luminance'
  intensity: number // -200..200
  invert?: boolean
}

export type ImageMeshModifier =
  | BendModifier
  | TwistModifier
  | CurveModifier
  | LatticeModifier
  | SculptModifier
  | DepthProfileModifier

export interface MeshMotionConfig {
  type: 'none' | 'wind' | 'wave' | 'breathe' | 'wiggle'
  speed: number
  amplitude: number
  direction: 'both' | 'horizontal' | 'vertical' | 'depthZ'
  anchor: 'bottom' | 'top' | 'left' | 'center' | 'all'
  pinnedUVs?: [number, number][]
}

export interface MaterialBindings {
  frontAssetId?: string
  frontAssetPath?: string
  backAssetId?: string
  backAssetPath?: string
  alphaCutoff?: number
  doubleSided?: boolean
  color?: string
}

export interface ImageMeshDefinition {
  version: number
  id: string
  name: string
  surface: BaseSurface
  /** Anchor / Root pivot in UV space [u, v] (v up) */
  anchorUV: [number, number]
  /** Tip / Apex in UV space [u, v] (v up) */
  tipUV?: [number, number]
  /** Target silhouette polygon in UV space [u, v] */
  silhouettePolygon?: number[][]
  /** Ordered stack of geometric modifiers evaluated in sequence */
  modifiers: ImageMeshModifier[]
  /** Procedural timeline motion */
  motion?: MeshMotionConfig
  /** Material & texture properties */
  materials: MaterialBindings
}
