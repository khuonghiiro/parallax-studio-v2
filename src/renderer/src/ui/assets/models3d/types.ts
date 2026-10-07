export interface Face3D {
  id: string
  name: string
  /** Relative asset path (e.g. 'house/origami_front.png') or project assetId or data URL */
  assetPath?: string
  assetId?: string
  color?: string
  width: number
  height: number
  position: [number, number, number]
  rotation: [number, number, number] // [rx, ry, rz] in degrees
  scale?: [number, number, number]
  opacity?: number
}

export type PresetType = 'cottage' | 'cube' | 'corner' | 'room'

export interface Model3D {
  id: string
  name: string
  description?: string
  category: 'architecture' | 'props' | 'room' | 'custom'
  thumbnail?: string
  thumbnailDataUrl?: string
  scale: number // overall scaling factor (default 1.0)
  faces: Face3D[]
  createdAt: number
  updatedAt: number
}
