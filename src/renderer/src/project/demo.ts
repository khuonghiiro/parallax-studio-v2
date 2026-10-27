import type { Project } from '@shared/types'
import demoJson from './demoProject.json'
import threeSceneJson from '../../../../projects/ba-canh-mau-workflow-v2.json'
import { importProjectFromJson } from './jsonFormat'

/**
 * Builds the 3-shot 2.5D animation landscape journey directly from demoProject.json.
 * Anyone can edit demoProject.json directly to tweak shots, text, colors, z-depth, and layers!
 */
export async function buildDemoProject(): Promise<Project> {
  return importProjectFromJson(JSON.stringify(demoJson))
}

/**
 * Builds the 3-scene Workflow V2 project (Cánh Đồng Gió Mùa · Phòng Khách Ấm Áp · Phố Đêm Đèn Đường)
 * directly from `projects/ba-canh-mau-workflow-v2.json`.
 */
export async function buildThreeSceneDemoProject(): Promise<Project> {
  return importProjectFromJson(JSON.stringify(threeSceneJson))
}

export * from './plateGenerators'
export * from './jsonFormat'
