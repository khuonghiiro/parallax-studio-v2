import { normalizeCreatureOptions } from './creatureRigCatalog'
import { flipCreatureBuild } from './creatureRigDraft'
import {
  buildButterflyRig,
  buildCrabRig,
  buildInsectRig,
  buildLizardRig,
  buildOctopusRig,
  buildSpiderRig
} from './creatureRigBuildersTop'
import {
  buildBirdRig,
  buildDogRig,
  buildDragonRig,
  buildFishRig,
  buildHorseRig,
  buildSnakeRig
} from './creatureRigBuildersSide'
import type { CreatureRigBuild, CreatureRigOptions, CreatureSpecies } from './creatureRigTypes'

const SIDE_VIEW: ReadonlySet<CreatureSpecies> = new Set(['snake', 'fish', 'bird', 'horse', 'dog', 'dragon'])

/** Sinh khung xương chuẩn cho một loài sinh vật (toạ độ chuẩn hoá quanh gốc 0,0, chưa khớp layer). */
export function buildCreatureRig(species: CreatureSpecies, options: CreatureRigOptions = {}): CreatureRigBuild {
  const o = normalizeCreatureOptions(species, options)
  let build: CreatureRigBuild
  switch (species) {
    case 'spider':
      build = buildSpiderRig(o)
      break
    case 'insect':
      build = buildInsectRig(o)
      break
    case 'crab':
      build = buildCrabRig(o)
      break
    case 'octopus':
      build = buildOctopusRig(o)
      break
    case 'butterfly':
      build = buildButterflyRig()
      break
    case 'lizard':
      build = buildLizardRig(o)
      break
    case 'snake':
      build = buildSnakeRig(o)
      break
    case 'fish':
      build = buildFishRig(o)
      break
    case 'bird':
      build = buildBirdRig(o)
      break
    case 'horse':
      build = buildHorseRig(o)
      break
    case 'dog':
      build = buildDogRig(o)
      break
    case 'dragon':
      build = buildDragonRig(o)
      break
    default:
      throw new Error(`Unknown creature species: ${String(species)}`)
  }
  return SIDE_VIEW.has(species) && o.facing === 'right' ? flipCreatureBuild(build) : build
}

export function isSideViewCreature(species: CreatureSpecies): boolean {
  return SIDE_VIEW.has(species)
}
