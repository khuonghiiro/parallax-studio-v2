import type { LookSettings, Project } from '@shared/types'
import { referenceDistance } from '../../animation/math'
import { setCompDuration, isInternalSourcePath } from '../../actions'
import { isExporting, runExport } from '../../export/runExport'
import { assetStore } from '../../project/assets'
import * as factory from '../../project/factory'
import { deserializeProject, serializeProject } from '../../project/serialize'
import {
  exportProjectToJson,
  exportProjectToDeclarativeJson,
  exportProjectToModularBundleJson,
  importProjectFromJson
} from '../../project/jsonFormat'
import { buildMainWorkflowJson } from '../../project/workflowV2Engine'
import { addAudioTrackToProject, getProjectAudioTracks, syncProjectAudio } from '../../project/audioTracks'
import { ParamError, ed, proj, type Handler } from '../types'
import { bool, has, num, str } from '../params'
import { cameraSummary, layerSummary, shotSummary } from '../summaries'

export const projectCommands: Record<string, Handler> = {
  get_project_info: () => {
    const project = proj()
    const t = ed().time
    const s = ed()
    const mainWf = buildMainWorkflowJson(project)
    return {
      name: project.comp.name,
      composition: project.comp,
      time: t,
      file_path: s.filePath,
      dirty: s.dirty,
      can_undo: s.past.length > 0,
      selected: { layer_id: s.selectedLayerId, shot_id: s.selectedShotId },
      reference_distance: Math.round(referenceDistance(project.comp)),
      shot_spacing: factory.shotSpacing(project.comp),
      shots: project.shots.map((sh) => shotSummary(sh, project, t)),
      layers: project.layers.map((l) => layerSummary(l, t)),
      camera: cameraSummary(project, t),
      look: project.look,
      audio: project.audio && { ...project.audio, name: assetStore.get(project.audio.assetId)?.meta.name },
      audio_tracks: getProjectAudioTracks(project).map((tr) => ({
        id: tr.id,
        name: tr.name,
        assetId: tr.assetId,
        offset: tr.offset,
        volume: tr.volume,
        duration: tr.duration ?? assetStore.get(tr.assetId)?.meta.duration,
        muted: !!tr.muted,
        loop: !!tr.loop
      })),
      assets: project.assets.map((a) => ({ id: a.id, name: a.name, kind: a.kind, width: a.width, height: a.height, duration: a.duration })),
      modular_json: {
        main_file: 'main.json',
        shot_files: mainWf.route.map((r) => ({ shot_id: r.shotId, name: r.name, file: r.file, time_range: [r.timeStart, r.timeEnd] }))
      },
      workflow: project.workflow
        ? {
            id: project.workflow.id,
            name: project.workflow.name,
            presetId: project.workflow.presetId,
            nodes: project.workflow.nodes.length,
            edges: project.workflow.edges.length
          }
        : undefined
    }
  },

  new_project: (p) => {
    assetStore.clear()
    const comp: Partial<Project['comp']> = {}
    for (const k of ['name', 'background'] as const) if (has(p, k)) comp[k] = str(p, k)!
    for (const k of ['width', 'height', 'fps', 'duration'] as const) if (has(p, k)) comp[k] = num(p, k)!
    ed().loadProject(factory.createProject(comp), null)
    return { ok: true, composition: proj().comp }
  },

  set_composition: (p) => {
    ed().update((d) => {
      if (has(p, 'name')) d.comp.name = str(p, 'name')!
      if (has(p, 'background')) d.comp.background = str(p, 'background')!
      if (has(p, 'width')) d.comp.width = Math.max(16, Math.round(num(p, 'width')!))
      if (has(p, 'height')) d.comp.height = Math.max(16, Math.round(num(p, 'height')!))
      if (has(p, 'fps')) d.comp.fps = Math.max(1, Math.min(120, num(p, 'fps')!))
      if (has(p, 'duration')) setCompDuration(d as Project, num(p, 'duration')!)
    })
    return proj().comp
  },

  save_project: async (p) => {
    const path = str(p, 'path') ?? ed().filePath
    if (!path) throw new ParamError('Missing "path" (absolute path ending in .pxs)')
    if (isInternalSourcePath(path)) {
      throw new ParamError('Cannot overwrite internal source or demo files with save_project')
    }
    const data = await serializeProject(proj())
    const saved = await window.api.saveProject(data, path)
    if (!saved) throw new Error('Save failed')
    ed().markSaved(saved)
    return { path: saved, bytes: data.byteLength }
  },

  open_project: async (_p, cmd) => {
    if (!cmd.file) throw new ParamError('Missing "file_path"')
    let project: Project
    if (cmd.file.path.endsWith('.json')) {
      const text = new TextDecoder('utf-8').decode(cmd.file.data)
      project = await importProjectFromJson(text)
    } else {
      project = await deserializeProject(cmd.file.data)
    }
    const safePath = isInternalSourcePath(cmd.file.path) ? null : cmd.file.path
    ed().loadProject(project, safePath)
    return { path: cmd.file.path, shots: project.shots.length, layers: project.layers.length }
  },

  import_project_json: async (p, cmd) => {
    let jsonStr: string
    if (has(p, 'json')) {
      const j = p.json
      jsonStr = typeof j === 'string' ? j : JSON.stringify(j)
    } else if (cmd.file) {
      jsonStr = new TextDecoder('utf-8').decode(cmd.file.data)
    } else {
      throw new ParamError('Provide "json" string/object or "file_path"')
    }
    const project = await importProjectFromJson(jsonStr)
    const safePath = isInternalSourcePath(cmd.file?.path) ? null : (cmd.file?.path ?? null)
    ed().loadProject(project, safePath)
    return {
      name: project.comp.name,
      shots: project.shots.length,
      layers: project.layers.length,
      duration: project.comp.duration
    }
  },

  export_project_json: async (p) => {
    const format = str(p, 'format')
    const pretty = bool(p, 'pretty') ?? true
    let json: string
    if (format === 'modular') {
      json = exportProjectToModularBundleJson(proj(), pretty)
    } else if (format === 'declarative') {
      json = await exportProjectToDeclarativeJson(proj(), pretty)
    } else {
      json = await exportProjectToJson(proj(), pretty)
    }
    return { json, format: format || 'raw', shots: proj().shots.length, layers: proj().layers.length }
  },

  set_project_asset_alias: async (p) => {
    const alias = str(p, 'alias', true)
    const path = str(p, 'path', true)
    ed().update((d) => {
      const existing = d.assets.find((a) => a.name === alias || a.assetPath === path)
      if (existing) {
        existing.assetPath = path
        existing.path = `assets/${path.replace(/^assets\//, '')}`
      } else {
        d.assets.push({
          id: `asset-${Date.now().toString(36)}`,
          name: alias,
          path: `assets/${path.replace(/^assets\//, '')}`,
          assetPath: path.replace(/^assets\//, ''),
          mime: 'image/png',
          kind: 'image'
        })
      }
    })
    return { ok: true, alias, path }
  },

  replace_project_asset_path: async (p) => {
    const oldPath = str(p, 'old_path', true).replace(/^assets\//, '')
    const newPath = str(p, 'new_path', true).replace(/^assets\//, '')
    let replacedAssets = 0
    ed().update((d) => {
      for (const a of d.assets) {
        if (a.assetPath === oldPath || a.path?.endsWith(oldPath)) {
          a.assetPath = newPath
          a.path = `assets/${newPath}`
          replacedAssets++
        }
      }
    })
    return { ok: true, oldPath, newPath, replacedAssets }
  },

  get_project_asset_aliases: () => {
    const p = proj()
    const aliases: Record<string, string> = {}
    for (const a of p.assets) {
      aliases[a.name] = a.assetPath || a.path || a.name
    }
    return { count: Object.keys(aliases).length, aliases }
  },

  undo: () => {
    ed().undo()
    return { can_undo: ed().past.length > 0, can_redo: ed().future.length > 0 }
  },

  redo: () => {
    ed().redo()
    return { can_undo: ed().past.length > 0, can_redo: ed().future.length > 0 }
  },

  set_look: (p) => {
    const keys: (keyof LookSettings)[] = ['fogEnabled', 'fogColor', 'fogNear', 'fogFar', 'vignette', 'grain', 'exposure', 'contrast', 'saturation']
    const alias: Record<string, keyof LookSettings> = { fog_enabled: 'fogEnabled', fog_color: 'fogColor', fog_near: 'fogNear', fog_far: 'fogFar' }
    ed().update((d) => {
      for (const [k, v] of Object.entries(p)) {
        const key = (alias[k] ?? k) as keyof LookSettings
        if (!keys.includes(key)) continue
        const cur = d.look[key]
        if (typeof cur !== typeof v) throw new ParamError(`"${k}" must be a ${typeof cur}`)
        ;(d.look as unknown as Record<string, unknown>)[key] = v
      }
    })
    return proj().look
  },

  set_audio: async (p, cmd) => {
    if (bool(p, 'remove')) {
      ed().update((d) => {
        d.audio = null
        d.audioTracks = []
      })
      return { audio: null, tracks: [] }
    }
    if (cmd.file) {
      if (!cmd.file.mime.startsWith('audio/')) throw new ParamError(`Not an audio file: ${cmd.file.name}`)
      const asset = await assetStore.add(cmd.file.name, cmd.file.mime, cmd.file.data, 'audio')
      ed().update((d) => {
        if (!d.assets.some((a) => a.id === asset.meta.id)) {
          d.assets.push(asset.meta)
        }
        addAudioTrackToProject(d as Project, asset.meta.id, asset.meta.name, num(p, 'offset') ?? 0)
      })
    }
    const curProj = proj()
    if (!curProj.audio && (!curProj.audioTracks || curProj.audioTracks.length === 0)) {
      throw new ParamError('No audio track: provide "file_path"')
    }
    ed().update((d) => {
      const tracks = getProjectAudioTracks(d as Project)
      if (tracks.length > 0) {
        if (has(p, 'offset')) tracks[0].offset = num(p, 'offset')!
        if (has(p, 'volume')) tracks[0].volume = Math.max(0, Math.min(1, num(p, 'volume')!))
      }
      syncProjectAudio(d as Project)
    })
    const a = proj().audio!
    return {
      ...a,
      duration: assetStore.get(a.assetId)?.meta.duration,
      tracks: getProjectAudioTracks(proj())
    }
  },

  export_video: async (p) => {
    const outPath = str(p, 'out_path', true)
    if (isExporting()) throw new Error('Another export is already running')
    const preset = str(p, 'preset') as 'ultrafast' | 'veryfast' | 'medium' | 'slow' | undefined
    const res = await runExport(proj(), {
      outPath,
      height: num(p, 'height'),
      fps: num(p, 'fps'),
      crf: num(p, 'crf'),
      preset,
      withAudio: bool(p, 'with_audio'),
      start: num(p, 'start'),
      end: num(p, 'end')
    })
    if (!res.ok) throw new Error(res.error ?? (res.cancelled ? 'Export cancelled' : 'Export failed'))
    return res
  }
}
