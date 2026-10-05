export * from './plates/canvas'
export * from './plates/treePrimitives'
export * from './plates/landscapePrimitives'
export * from './plates/dayPlates'
export * from './plates/eveningPlates'

import {
  drawSunnySky,
  drawDistantMountains,
  drawRollingGreenHills,
  drawRiverAndMeadowFloor,
  drawMidgroundTrees,
  drawForegroundRiverbankFraming,
  drawPastelSky,
  drawPurpleMountainPeaks,
  drawRollingHillsAndHedges,
  drawCenterIslandPond,
  drawIslandPondTrees,
  drawForegroundBroadleafFraming
} from './plates/dayPlates'

import {
  drawSlopingPastureAndPine,
  drawLagoonAndShore,
  drawMidgroundBoulderClusters,
  drawForegroundLagoonFraming,
  drawSunsetSky,
  drawTwilightMountains,
  drawTwilightRiverFloor,
  drawTwilightTrees,
  drawTwilightForegroundFraming,
  drawDriftingMistPlate,
  drawDriftingMountainClouds,
  drawDriftingTwilightMist
} from './plates/eveningPlates'

/** Registry of all available procedural vector background generators. */
export const PLATE_GENERATORS: Record<string, () => HTMLCanvasElement> = {
  sunny_sky: drawSunnySky,
  distant_mountains: drawDistantMountains,
  rolling_green_hills: drawRollingGreenHills,
  river_and_meadow_floor: drawRiverAndMeadowFloor,
  midground_trees: drawMidgroundTrees,
  foreground_riverbank_framing: drawForegroundRiverbankFraming,
  pastel_sky: drawPastelSky,
  purple_mountain_peaks: drawPurpleMountainPeaks,
  rolling_hills_and_hedges: drawRollingHillsAndHedges,
  center_island_pond: drawCenterIslandPond,
  island_pond_trees: drawIslandPondTrees,
  foreground_broadleaf_framing: drawForegroundBroadleafFraming,
  sloping_pasture_and_pine: drawSlopingPastureAndPine,
  lagoon_and_shore: drawLagoonAndShore,
  midground_boulder_clusters: drawMidgroundBoulderClusters,
  foreground_lagoon_framing: drawForegroundLagoonFraming,
  sunset_sky: drawSunsetSky,
  twilight_mountains: drawTwilightMountains,
  twilight_river_floor: drawTwilightRiverFloor,
  twilight_trees: drawTwilightTrees,
  twilight_foreground_framing: drawTwilightForegroundFraming,
  drifting_low_mist: drawDriftingMistPlate,
  drifting_mountain_clouds: drawDriftingMountainClouds,
  drifting_twilight_mist: drawDriftingTwilightMist
}
