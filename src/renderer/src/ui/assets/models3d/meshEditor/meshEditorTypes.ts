export type MeshEditorTool =
  | 'select'
  | 'bend'
  | 'twist'
  | 'taper'
  | 'grab'
  | 'inflate'
  | 'smooth'
  | 'crease'
  | 'curve'
  | 'lattice'

export type BrushFalloff = 'smooth' | 'linear' | 'sharp'

export type CurvePreset = 'c-curve' | 's-curve' | 'droop' | 'recurved'

export interface BrushSettings {
  radius: number
  strength: number
  falloff: BrushFalloff
  pinRoot: boolean
  frontFacingOnly: boolean
}

export interface CurveSettings {
  preset: CurvePreset
  numPoints: 3 | 4 | 5
  tension: number
}

export interface LatticeSettings {
  pinnedBottomRow: boolean
  activePointIndex: number | null
}

export interface SimpleDeformSettings {
  bendAngle: number
  bendAxis: 'x' | 'y'
  twistAngle: number
  taperRatio: number
}
