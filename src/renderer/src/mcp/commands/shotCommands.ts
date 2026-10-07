import { nextShotPosition, SHOT_DIRECTIONS, type ShotDirection } from '../../actions'
import * as factory from '../../project/factory'
import { exportShotToJson, importShotFromJson } from '../../project/jsonFormat'
import { ParamError, ed, proj, type Handler } from '../types'
import { bool, has, num, requireShot, setAnim, str, toPlain, vec3 } from '../params'
import { layerSummary, shotSummary } from '../summaries'

export const shotCommands: Record<string, Handler> = {
  get_shot_info: (p) => {
    const project = proj()
    const s = requireShot(project, str(p, 'shot_id', true))
    const t = num(p, 'time') ?? ed().time
    return { ...shotSummary(s, project, t), shot: toPlain(s), layers: project.layers.filter((l) => l.shotId === s.id).map((l) => layerSummary(l, t)) }
  },

  add_shot: (p) => {
    const project = proj()
    const dir = (str(p, 'direction') ?? 'right') as ShotDirection
    if (!SHOT_DIRECTIONS.some((d) => d.id === dir)) throw new ParamError('"direction" must be right, down or depth')
    const shot = factory.createShot(str(p, 'name') ?? `Cảnh ${project.shots.length + 1}`, vec3(p, 'position') ?? nextShotPosition(project, dir), project.shots.length)
    const rot = vec3(p, 'rotation')
    if (rot) shot.rotation.value = rot
    const color = str(p, 'color')
    if (color) shot.color = color
    const adopt = bool(p, 'adopt_global_layers') ?? false
    ed().update((d) => {
      d.shots.push(shot)
      if (adopt) for (const l of d.layers) if (l.shotId === null) l.shotId = shot.id
    })
    ed().selectShot(shot.id)
    return shotSummary(shot, proj(), ed().time)
  },

  update_shot: (p) => {
    const project = proj()
    const id = requireShot(project, str(p, 'shot_id', true)).id
    ed().update((d) => {
      const s = d.shots.find((x) => x.id === id)!
      if (has(p, 'name')) s.name = str(p, 'name')!
      if (has(p, 'color')) s.color = str(p, 'color')!
      if (has(p, 'visible')) s.visible = bool(p, 'visible')!
      const pos = vec3(p, 'position')
      if (pos) setAnim(s.position, pos, p, project)
      const rot = vec3(p, 'rotation')
      if (rot) setAnim(s.rotation, rot, p, project)
    })
    ed().selectShot(id)
    return shotSummary(requireShot(proj(), id), proj(), ed().time)
  },

  delete_shot: (p) => {
    const id = requireShot(proj(), str(p, 'shot_id', true)).id
    const keep = bool(p, 'keep_layers') ?? false
    ed().update((d) => {
      d.shots = d.shots.filter((s) => s.id !== id)
      if (keep) {
        for (const l of d.layers) if (l.shotId === id) l.shotId = null
      } else {
        d.layers = d.layers.filter((l) => l.shotId !== id)
      }
    })
    if (ed().selectedShotId === id) ed().selectShot(null)
    return { deleted: id, kept_layers: keep }
  },

  import_shot_json: async (p, cmd) => {
    let jsonStr: string
    if (has(p, 'json')) {
      const j = p.json
      jsonStr = typeof j === 'string' ? j : JSON.stringify(j)
    } else if (cmd.file) {
      jsonStr = new TextDecoder('utf-8').decode(cmd.file.data)
    } else {
      throw new ParamError('Provide "json" string/object or "file_path"')
    }
    const res = await importShotFromJson(jsonStr, proj())
    ed().update(() => {}) // trigger render
    return { shot: res.shot.name, layers: res.layers.length }
  },

  export_shot_json: async (p) => {
    const s = requireShot(proj(), str(p, 'shot'))
    const json = await exportShotToJson(proj(), s.id, true)
    return { shot: s.name, json }
  }
}
