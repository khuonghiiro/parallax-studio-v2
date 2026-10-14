import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite, LayerMotionSettings } from '../types'

export type LayerTemplateCategory = 'all' | 'character' | 'animal' | 'nature' | 'prop' | 'architecture'

export type LayerAgeGroup =
  | 'child'
  | 'youth'
  | 'adult'
  | 'middleaged'
  | 'elderly'
  | 'quadruped'
  | 'aquatic'
  | 'avian'
  | 'plant'
  | 'decor'

export interface LayerTemplateSlot {
  id: string
  name: string
  nameEn: string
  role: string
  atlasCell?: number // 1..25 matching 5x5 atlas grid
  boneId?: string
  bindingMode?: 'rigid' | 'soft'
  defaultTransform: {
    x: number
    y: number
    z: number
    scale: number
    rotation: number
    opacity?: number
    hidden?: boolean
  }
  defaultMotion?: LayerMotionSettings
  suggestedAsset?: string
  description: string
}

export interface LayerPromptGuide {
  systemPrompt: string
  cellLayout: string[]
  userGuide: string
  negativePrompt?: string
  aspectRatio?: string
  recommendedResolution?: string
}

export interface LayerAssemblyTemplate {
  id: string
  name: string
  nameEn: string
  category: 'character' | 'animal' | 'nature' | 'prop' | 'architecture'
  ageGroup?: LayerAgeGroup
  description: string
  descriptionEn: string
  width: number
  height: number
  slots: LayerTemplateSlot[]
  bones: LayerBone[]
  clips: AnimationClip[]
  activeClipId: string
  promptGuide: LayerPromptGuide
  buildComposite: (images?: Record<string, string>, nameOverride?: string) => LayerComposite
}
