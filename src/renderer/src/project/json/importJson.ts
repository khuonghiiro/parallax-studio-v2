import type { AssetMeta, Layer, Project, Shot } from '@shared/types'
import { buildCameraPath, type PathStep } from '../../animation/cameraPath'
import { assetStore } from '../assets'
import { createProject, createShot, migrateProject, shotSpacing } from '../factory'
import { applyModularWorkflowJson, applyShotWorkflowJson } from '../workflowV2ModularApply'
import type { WorkflowShotJson } from '../workflowV2ModularJson'
import { parseDataUrl } from './base64'
import { loadAssetBytesFromDiskOrBuiltIn } from './assetLoader'
import type { DeclarativeProjectSpec, DeclarativeShotSpec } from './schema'
import { buildLayersForShot } from './layerBuilder'
import { isAssetTable, getAssetPathFromEntry, type AssetTable } from './assetTable'

/**
 * Universal JSON Importer:
 * Can parse:
 * 1. Full Parallax Studio Project JSON (with embedded base64 dataUrl or local asset paths).
 * 2. Modular Workflow Bundle / Main JSON (`parallax-workflow-bundle` / `parallax-workflow-main`).
 * 3. High-level Declarative Scene Specification JSON (human-readable, easy to edit).
 */
export async function importProjectFromJson(jsonString: string): Promise<Project> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Invalid JSON: ${String(err)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('JSON root must be an object')
  }

  const rawObj = parsed as Record<string, unknown>
  if (
    rawObj.kind === 'parallax-workflow-bundle' ||
    rawObj.kind === 'parallax-workflow-main' ||
    rawObj.kind === 'parallax-workflow-shot'
  ) {
    const project = createProject({ name: typeof rawObj.name === 'string' ? rawObj.name : 'Parallax Journey' })
    if (Array.isArray(rawObj.assets)) {
      assetStore.clear()
      for (const a of rawObj.assets as (AssetMeta & { dataUrl?: string; assetPath?: string })[]) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
          project.assets.push(a)
        } else if (a.path || a.assetPath) {
          const p = (a.assetPath || a.path || '').replace(/^assets\//, '')
          const file = await loadAssetBytesFromDiskOrBuiltIn(p)
          if (file) {
            const asset = await assetStore.add(a.name, file.mime || a.mime, file.data, a.kind, a)
            asset.meta.assetPath = p
            asset.meta.path = `assets/${p}`
            project.assets.push(asset.meta)
          }
        }
      }
    }
    applyModularWorkflowJson(project, rawObj)
    return structuredClone(project)
  }

  const spec = parsed as DeclarativeProjectSpec

  // Case 1: Full raw Project v2 format
  if (spec.version === 2 && Array.isArray(spec.layers) && Array.isArray(spec.shots) && spec.comp && !spec.shots[0]?.layers) {
    assetStore.clear()
    if (Array.isArray(spec.assets)) {
      for (const a of spec.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
        } else if (a.path || (a as { assetPath?: string }).assetPath) {
          const p = ((a as { assetPath?: string }).assetPath || a.path || '').replace(/^assets\//, '')
          const file = await loadAssetBytesFromDiskOrBuiltIn(p)
          if (file) {
            const asset = await assetStore.add(a.name, file.mime || a.mime, file.data, a.kind, a)
            asset.meta.assetPath = p
            asset.meta.path = `assets/${p}`
          }
        }
      }
    }
    return migrateProject(spec as unknown as Project)
  }

  // Case 2: Declarative Project / Scene Specification
  return buildProjectFromDeclarativeSpec(spec)
}

/**
 * Imports a shot definition from JSON and attaches/updates it on an existing project.
 * Supports:
 * - Standalone `parallax-workflow-shot` JSON (`shot-N.json`)
 * - Raw `parallax-shot` payload (`{ shot, layers, workflowShot, assets }`)
 * - `DeclarativeShotSpec`
 */
export async function importShotFromJson(
  jsonString: string,
  targetProject: Project
): Promise<{ shot: Shot; layers: Layer[] }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Invalid JSON: ${String(err)}`)
  }

  const rawObj = parsed as Record<string, unknown>
  if (rawObj.kind === 'parallax-workflow-shot') {
    const res = applyShotWorkflowJson(targetProject, rawObj as unknown as WorkflowShotJson)
    const shot =
      targetProject.shots.find((s) => s.id === res.targetShotId) ??
      targetProject.shots[targetProject.shots.length - 1] ??
      createShot('Cảnh 1', [0, 0, 0], 0)
    const layers = targetProject.layers.filter((l) => l.shotId === shot.id)
    return { shot, layers }
  }

  const payload = parsed as {
    shot?: Shot
    layers?: Layer[]
    workflowShot?: WorkflowShotJson
    assets?: (AssetMeta & { dataUrl?: string })[]
  }
  if (payload.shot && Array.isArray(payload.layers)) {
    if (Array.isArray(payload.assets)) {
      for (const a of payload.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
          if (!targetProject.assets.some((ex) => ex.id === a.id)) {
            targetProject.assets.push(a)
          }
        } else if (a.path || (a as { assetPath?: string }).assetPath) {
          const p = ((a as { assetPath?: string }).assetPath || a.path || '').replace(/^assets\//, '')
          const file = await loadAssetBytesFromDiskOrBuiltIn(p)
          if (file) {
            const asset = await assetStore.add(a.name, file.mime || a.mime, file.data, a.kind, a)
            asset.meta.assetPath = p
            asset.meta.path = `assets/${p}`
            if (!targetProject.assets.some((ex) => ex.id === asset.meta.id)) {
              targetProject.assets.push(asset.meta)
            }
          }
        }
      }
    }
    const shot = payload.shot
    const existingShotIdx = targetProject.shots.findIndex((s) => s.id === shot.id)
    if (existingShotIdx >= 0) {
      targetProject.shots[existingShotIdx] = shot
      targetProject.layers = targetProject.layers.filter((l) => l.shotId !== shot.id)
    } else {
      targetProject.shots.push(shot)
    }
    for (const l of payload.layers) {
      l.shotId = shot.id
      targetProject.layers.push(l)
    }
    if (payload.workflowShot) {
      applyShotWorkflowJson(targetProject, payload.workflowShot, shot.id)
    }
    return { shot, layers: payload.layers }
  }

  // If passed as a DeclarativeShotSpec
  const shotSpec = parsed as DeclarativeShotSpec & { logic?: WorkflowShotJson['logic'] }
  if (shotSpec.name) {
    const shotIndex = targetProject.shots.length
    const spacing = shotSpacing(targetProject.comp)
    const shot = createShot(shotSpec.name, shotSpec.position ?? [shotIndex * spacing, 0, 0], shotIndex)
    targetProject.shots.push(shot)

    const shotAssetTable: AssetTable = isAssetTable(shotSpec.assets) ? shotSpec.assets : {}
    for (const [alias, entry] of Object.entries(shotAssetTable)) {
      const p = getAssetPathFromEntry(entry)
      if (!p) continue
      if (p.startsWith('data:')) {
        const { mime, data } = parseDataUrl(p)
        const asset = await assetStore.add(alias, mime, data, 'image')
        targetProject.assets.push(asset.meta)
      } else {
        const clean = p.replace(/^assets\//, '')
        const file = await loadAssetBytesFromDiskOrBuiltIn(clean)
        if (file) {
          const asset = await assetStore.add(alias, file.mime, file.data, 'image')
          asset.meta.assetPath = clean
          asset.meta.path = `assets/${clean}`
          targetProject.assets.push(asset.meta)
        }
      }
    }

    const layers = await buildLayersForShot(shotSpec, shot, targetProject, shotAssetTable)
    targetProject.layers.push(...layers)
    if (Array.isArray(shotSpec.logic) && shotSpec.logic.length > 0) {
      applyShotWorkflowJson(
        targetProject,
        {
          kind: 'parallax-workflow-shot',
          version: 2,
          file: `shots/shot-${shotIndex + 1}.json`,
          mainFile: 'main.json',
          shot: {
            id: shot.id,
            index: shotIndex + 1,
            name: shot.name,
            color: shot.color,
            visible: true,
            position: shot.position.value,
            rotation: shot.rotation.value,
            timeStart: 0,
            timeEnd: targetProject.comp.duration
          },
          links: { prevShotId: null, prevShotFile: null, nextShotId: null, nextShotFile: null, cameraInEdgeId: null, cameraOutEdgeId: null },
          camera: { nodeId: `v2-camera-${shot.id}`, enabled: true, preset: 'dollyIn', enableDof: false, timeStart: 0, timeEnd: targetProject.comp.duration },
          groups: [],
          layers: [],
          logic: shotSpec.logic,
          graph: { nodes: [], edges: [] }
        },
        shot.id
      )
    }
    return { shot, layers }
  }

  throw new Error('JSON does not contain a recognized shot definition')
}

export async function buildProjectFromDeclarativeSpec(spec: DeclarativeProjectSpec): Promise<Project> {
  assetStore.clear()

  const project = createProject({
    name: spec.name ?? 'Parallax Journey',
    ...spec.comp
  })
  const comp = project.comp
  const spacing = shotSpacing(comp)

  if (spec.look) {
    project.look = { ...project.look, ...spec.look }
  }

  if (spec.workflow) {
    project.workflow = spec.workflow
  }

  if (spec.camera) {
    if (spec.camera.fov !== undefined) project.camera.fov.value = spec.camera.fov
    if (spec.camera.shakeAmount !== undefined) project.camera.shakeAmount = spec.camera.shakeAmount
    if (spec.camera.shakeSpeed !== undefined) project.camera.shakeSpeed = spec.camera.shakeSpeed
    if (spec.camera.dofEnabled !== undefined) project.camera.dofEnabled = spec.camera.dofEnabled
  }

  // Pre-load assets from AssetTable dictionary (human & AI friendly)
  const rawTable = spec.assetTable || (isAssetTable(spec.assets) ? spec.assets : undefined)
  const projectAssetTable: AssetTable = rawTable || {}

  for (const [alias, entry] of Object.entries(projectAssetTable)) {
    const p = getAssetPathFromEntry(entry)
    if (!p) continue
    if (p.startsWith('data:')) {
      const { mime, data } = parseDataUrl(p)
      const asset = await assetStore.add(alias, mime, data, 'image')
      project.assets.push(asset.meta)
    } else {
      const clean = p.replace(/^assets\//, '')
      const file = await loadAssetBytesFromDiskOrBuiltIn(clean)
      if (file) {
        const asset = await assetStore.add(alias, file.mime, file.data, 'image')
        asset.meta.assetPath = clean
        asset.meta.path = `assets/${clean}`
        project.assets.push(asset.meta)
      }
    }
  }

  // Pre-load any explicitly provided dataUrl or path assets in array form
  if (Array.isArray(spec.assets)) {
    for (const a of spec.assets) {
      if (a.dataUrl) {
        const { mime, data } = parseDataUrl(a.dataUrl)
        await assetStore.add(a.name, mime, data, a.kind, a)
        project.assets.push(a)
      } else if (a.path || (a as { assetPath?: string }).assetPath) {
        const p = ((a as { assetPath?: string }).assetPath || a.path || '').replace(/^assets\//, '')
        const file = await loadAssetBytesFromDiskOrBuiltIn(p)
        if (file) {
          const asset = await assetStore.add(a.name, file.mime || a.mime, file.data, a.kind, a)
          asset.meta.assetPath = p
          asset.meta.path = `assets/${p}`
          project.assets.push(asset.meta)
        }
      }
    }
  }

  const shotSpecs = spec.shots ?? []
  for (let i = 0; i < shotSpecs.length; i++) {
    const sSpec = shotSpecs[i] as DeclarativeShotSpec & { logic?: WorkflowShotJson['logic'] }
    const pos = sSpec.position ?? [i * spacing, 0, 0]
    const shot = createShot(sSpec.name, pos, i)
    project.shots.push(shot)

    const layers = await buildLayersForShot(sSpec, shot, project, projectAssetTable)
    project.layers.push(...layers)
    if (Array.isArray(sSpec.logic) && sSpec.logic.length > 0) {
      applyShotWorkflowJson(
        project,
        {
          kind: 'parallax-workflow-shot',
          version: 2,
          file: `shots/shot-${i + 1}.json`,
          mainFile: 'main.json',
          shot: {
            id: shot.id,
            index: i + 1,
            name: shot.name,
            color: shot.color,
            visible: true,
            position: shot.position.value,
            rotation: shot.rotation.value,
            timeStart: 0,
            timeEnd: project.comp.duration
          },
          links: { prevShotId: null, prevShotFile: null, nextShotId: null, nextShotFile: null, cameraInEdgeId: null, cameraOutEdgeId: null },
          camera: { nodeId: `v2-camera-${shot.id}`, enabled: true, preset: 'dollyIn', enableDof: false, timeStart: 0, timeEnd: project.comp.duration },
          groups: [],
          layers: [],
          logic: sSpec.logic,
          graph: { nodes: [], edges: [] }
        },
        shot.id
      )
    }
  }

  // Build camera tour if specified
  if (spec.camera?.tour && spec.camera.tour.length > 0) {
    const steps: PathStep[] = []
    for (const step of spec.camera.tour) {
      const shot = project.shots.find((s) => s.name === step.shot)
      if (!shot) continue
      steps.push({
        shotId: shot.id,
        hold: step.hold ?? 3.0,
        type: step.type ?? 'arc',
        transition: step.transition ?? 2.5
      })
    }

    if (steps.length > 0) {
      const end = buildCameraPath(project, steps, { pushIn: 0.42 })
      project.comp.duration = Math.round(end * comp.fps) / comp.fps
      for (const l of project.layers) l.outPoint = project.comp.duration
    }
  }

  return structuredClone(project)
}
