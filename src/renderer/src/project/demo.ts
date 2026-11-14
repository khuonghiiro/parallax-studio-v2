import { repairDonghuaTiming } from './donghuaDemoBuilder'
import { repairThreeSceneTiming } from './demoTiming'
import type { Project } from '@shared/types'
import demoJson from './demoProject.json'
import threeSceneJson from '../../../../projects/ba-canh-mau-workflow-v2.json'
import donghuaJson from '../../../../projects/demo-2-son-thuy-kiem-hiep.json'
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
  return repairThreeSceneTiming(await importProjectFromJson(JSON.stringify(threeSceneJson)))
}

/**
 * Builds Demo #2: "Vân Sơn Kiếm Khúc — Hoạt Ảnh Quốc Phong 2.5D"
 * with alpha-matte cutout artwork & chained atomic Workflow V2 nodes.
 */
export async function buildDonghuaDemoProject(): Promise<Project> {
  return repairDonghuaTiming(await importProjectFromJson(JSON.stringify(donghuaJson)))
}

export * from './plateGenerators'
export * from './jsonFormat'
