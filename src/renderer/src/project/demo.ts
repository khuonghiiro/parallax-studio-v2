import type { Project } from '@shared/types'
import demoJson from './demoProject.json'
import { importProjectFromJson } from './jsonFormat'

/**
 * Builds the 4-shot 2.5D animation landscape journey directly from demoProject.json.
 * Anyone can edit demoProject.json directly to tweak shots, text, colors, z-depth, and layers!
 */
export async function buildDemoProject(): Promise<Project> {
  return importProjectFromJson(JSON.stringify(demoJson))
}

export * from './plateGenerators'
export * from './jsonFormat'
