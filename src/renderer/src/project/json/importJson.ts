import type { AssetMeta, Layer, Project, Shot } from '@shared/types'
import { buildCameraPath, type PathStep } from '../../animation/cameraPath'
import { referenceDistance } from '../../animation/math'
import { assetStore } from '../assets'
import { createProject, createShot, migrateProject, shotSpacing } from '../factory'
import { parseDataUrl } from './base64'
import { loadAssetBytesFromDiskOrBuiltIn } from './assetLoader'
import type { DeclarativeProjectSpec, DeclarativeShotSpec } from './schema'
import { buildLayersForShot } from './layerBuilder'

/**
 * Universal JSON Importer:
 * Can parse BOTH:
 * 1. Full Parallax Studio Project JSON (with embedded base64 dataUrl or local asset paths).
 * 2. High-level Declarative Scene Specification JSON (human-readable, easy to edit).
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

  const spec = parsed as DeclarativeProjectSpec

  // Case 1: Full raw Project v2 format
  if (spec.version === 2 && Array.isArray(spec.layers) && Array.isArray(spec.shots) && spec.comp && !spec.shots[0]?.layers) {
    assetStore.clear()
    if (Array.isArray(spec.assets)) {
      for (const a of spec.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
        } else if (a.path || (a as any).assetPath) {
          const p = ((a as any).assetPath || a.path || '').replace(/^assets\//, '')
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
 * Imports a shot definition from JSON and attaches it to an existing project.
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

  const payload = parsed as { shot?: Shot; layers?: Layer[]; assets?: (AssetMeta & { dataUrl?: string })[] }
  if (payload.shot && Array.isArray(payload.layers)) {
    if (Array.isArray(payload.assets)) {
      for (const a of payload.assets) {
        if (a.dataUrl) {
          const { mime, data } = parseDataUrl(a.dataUrl)
          await assetStore.add(a.name, mime, data, a.kind, a)
          if (!targetProject.assets.some((ex) => ex.id === a.id)) {
            targetProject.assets.push(a)
          }
        } else if (a.path || (a as any).assetPath) {
          const p = ((a as any).assetPath || a.path || '').replace(/^assets\//, '')
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
    targetProject.shots.push(shot)
    for (const l of payload.layers) {
      l.shotId = shot.id
      targetProject.layers.push(l)
    }
    return { shot, layers: payload.layers }
  }

  // If passed as a DeclarativeShotSpec
  const shotSpec = parsed as DeclarativeShotSpec
  if (shotSpec.name) {
    const shotIndex = targetProject.shots.length
    const spacing = shotSpacing(targetProject.comp)
    const shot = createShot(shotSpec.name, shotSpec.position ?? [shotIndex * spacing, 0, 0], shotIndex)
    targetProject.shots.push(shot)

    const layers = await buildLayersForShot(shotSpec, shot, targetProject)
    targetProject.layers.push(...layers)
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

  if (spec.camera) {
    if (spec.camera.fov !== undefined) project.camera.fov.value = spec.camera.fov
    if (spec.camera.shakeAmount !== undefined) project.camera.shakeAmount = spec.camera.shakeAmount
    if (spec.camera.shakeSpeed !== undefined) project.camera.shakeSpeed = spec.camera.shakeSpeed
    if (spec.camera.dofEnabled !== undefined) project.camera.dofEnabled = spec.camera.dofEnabled
  }

  // Pre-load any explicitly provided dataUrl or path assets
  if (Array.isArray(spec.assets)) {
    for (const a of spec.assets) {
      if (a.dataUrl) {
        const { mime, data } = parseDataUrl(a.dataUrl)
        await assetStore.add(a.name, mime, data, a.kind, a)
        project.assets.push(a)
      } else if (a.path || (a as any).assetPath) {
        const p = ((a as any).assetPath || a.path || '').replace(/^assets\//, '')
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
    const sSpec = shotSpecs[i]
    const pos = sSpec.position ?? [i * spacing, 0, 0]
    const shot = createShot(sSpec.name, pos, i)
    project.shots.push(shot)

    const layers = await buildLayersForShot(sSpec, shot, project)
    project.layers.push(...layers)
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
      const end = buildCameraPath(project, steps, { pushIn: 0.14 })
      project.comp.duration = Math.round(end * comp.fps) / comp.fps
      for (const l of project.layers) l.outPoint = project.comp.duration
    }
  }

  return structuredClone(project)
}
