import type { AssemblyTemplate } from './assemblyTemplateKit'
import {
  LEAF_TEMPLATE,
  PLANTER_TEMPLATE,
  HIGHRISE_TEMPLATE,
  RAILING_TEMPLATE,
  leafSlot,
  LEAF_POLYGON
} from './templates/imageMeshPlantParts'
import {
  FLOWER_TEMPLATE,
  petalSlot,
  flowerCenterSlot,
  flowerVariants,
  FLOWER_PETAL_POLYGON,
  FLOWER_CENTER_POLYGON,
  flowerFaces
} from './templates/imageMeshFlowers'
import {
  TRUMPET_FLOWER_TEMPLATE,
  CALLA_LILY_TEMPLATE,
  trumpetPetalSlot,
  stamenSlot,
  spatheSlot,
  spadixSlot,
  stemSlot,
  trumpetVariants,
  callaVariants,
  TRUMPET_PETAL_POLYGON,
  TRUMPET_STAMEN_POLYGON,
  CALLA_SPATHE_POLYGON,
  CALLA_SPADIX_POLYGON,
  trumpetFlowerFaces,
  callaLilyFaces
} from './templates/imageMeshLilies'
import {
  GRASS_BILLBOARD_TEMPLATE,
  GRASS_RADIAL_TEMPLATE,
  grassSlot,
  grassBladeSlot,
  grassClumpVariants,
  GRASS_BLADES,
  radialGrassFaces,
  GRASS_BLADE_UPRIGHT_POLYGON
} from './templates/imageMeshGrass'
import { STEM_POLYGON, CALYX_POLYGON } from './templates/templateCommon'

export const GRASS_BLADE_POLYGON = GRASS_BLADE_UPRIGHT_POLYGON

export {
  LEAF_TEMPLATE,
  FLOWER_TEMPLATE,
  TRUMPET_FLOWER_TEMPLATE,
  CALLA_LILY_TEMPLATE,
  PLANTER_TEMPLATE,
  HIGHRISE_TEMPLATE,
  RAILING_TEMPLATE,
  GRASS_BILLBOARD_TEMPLATE,
  GRASS_RADIAL_TEMPLATE,
  leafSlot,
  petalSlot,
  flowerCenterSlot,
  trumpetPetalSlot,
  stamenSlot,
  spatheSlot,
  spadixSlot,
  stemSlot,
  grassSlot,
  grassBladeSlot,
  flowerVariants,
  trumpetVariants,
  callaVariants,
  grassClumpVariants,
  LEAF_POLYGON,
  STEM_POLYGON,
  CALYX_POLYGON,
  FLOWER_PETAL_POLYGON,
  FLOWER_CENTER_POLYGON,
  TRUMPET_PETAL_POLYGON,
  TRUMPET_STAMEN_POLYGON,
  CALLA_SPATHE_POLYGON,
  CALLA_SPADIX_POLYGON,
  GRASS_BLADES,
  flowerFaces,
  trumpetFlowerFaces,
  callaLilyFaces,
  radialGrassFaces
}

export const IMAGE_MESH_TEMPLATES: AssemblyTemplate[] = [
  LEAF_TEMPLATE,
  FLOWER_TEMPLATE,
  TRUMPET_FLOWER_TEMPLATE,
  CALLA_LILY_TEMPLATE,
  PLANTER_TEMPLATE,
  HIGHRISE_TEMPLATE,
  RAILING_TEMPLATE,
  GRASS_BILLBOARD_TEMPLATE,
  GRASS_RADIAL_TEMPLATE
]
