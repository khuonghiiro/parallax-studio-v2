import { describe, expect, it } from 'vitest'
import { createImageLayer, createProject, createShot } from './factory'
import { syncWorkflowV2Graph } from './workflowV2Sync'
import { moveTimelineLayers } from './timelineTiming'
import { retimeTimelineIntervals } from './timelineIntervals'
import {
  createTimeGroup,
  layerNodeIdOf,
  linkToTimeGroup,
  listTimeGroups,
  resolveTimeTargets,
  setTimeGroupRange,
  shiftTimeGroup,
  timeGroupOfLayer,
  unlinkFromTimeGroup
} from './workflowTimeGroups'

function fixture() {
  const project = createProject()
  project.comp.duration = 20
  const shot = createShot('Cảnh A')
  project.shots = [shot]
  project.layers = ['a', 'b', 'c'].map((id, i) => {
    const layer = createImageLayer({ id: `asset-${id}`, name: id, kind: 'image', mime: 'image/png', width: 100, height: 100 }, project.comp, 0, shot.id)
    layer.id = id
    layer.inPoint = 2; layer.outPoint = 6
    layer.transform.opacity.keyframes = [{ id: `k-${i}`, t: 2, value: 0, ease: 'linear' }, { id: `e-${i}`, t: 6, value: 1, ease: 'linear' }]
    return layer
  })
  project.workflow = syncWorkflowV2Graph(project)
  return project
}

const range = (p: ReturnType<typeof fixture>, i: number) => [p.layers[i].inPoint, p.layers[i].outPoint]

describe('nhóm Time chung (Time group)', () => {
  it('gom nhiều Layer vào một Time và sửa một lần cho cả nhóm, keyframe dời theo', () => {
    const project = fixture()
    const group = createTimeGroup(project, resolveTimeTargets(project, [], ['a', 'b']))
    expect(group.params?.timeStart).toBe(2)
    expect(group.params?.timeEnd).toBe(6)
    expect(listTimeGroups(project)[0].layerIds.sort()).toEqual(['a', 'b'])
    setTimeGroupRange(project, group.id, 5, 9)
    expect(range(project, 0)).toEqual([5, 9])
    expect(range(project, 1)).toEqual([5, 9])
    expect(range(project, 2)).toEqual([2, 6])
    expect(project.layers[0].transform.opacity.keyframes.map(k => k.t)).toEqual([5, 9])
  })

  it('Timeline dời 1 Layer trong nhóm là dời cả nhóm; Alt (detach) chỉ dời riêng và tách khỏi nhóm', () => {
    const project = fixture()
    const group = createTimeGroup(project, resolveTimeTargets(project, [], ['a', 'b']))
    moveTimelineLayers(project, ['a'], 3)
    expect(range(project, 0)).toEqual([5, 9])
    expect(range(project, 1)).toEqual([5, 9])
    expect(project.workflow!.nodes.find(n => n.id === group.id)!.params?.timeStart).toBe(5)
    moveTimelineLayers(project, ['b'], 2, 'shift', { detachLinked: true })
    expect(range(project, 1)).toEqual([7, 11])
    expect(range(project, 0)).toEqual([5, 9])
    expect(timeGroupOfLayer(project, 'b')).toBeUndefined()
    expect(timeGroupOfLayer(project, 'a')?.id).toBe(group.id)
  })

  it('cắt IN/OUT một Layer trong nhóm chỉnh khoảng của cả nhóm', () => {
    const project = fixture()
    const group = createTimeGroup(project, resolveTimeTargets(project, [], ['a', 'c']))
    retimeTimelineIntervals(project, [{ kind: 'layer', layerId: 'c' }], 'out', 8)
    expect(range(project, 0)).toEqual([2, 8])
    expect(range(project, 2)).toEqual([2, 8])
    expect(project.workflow!.nodes.find(n => n.id === group.id)!.params?.timeEnd).toBe(8)
  })

  it('tách khỏi nhóm trả lại khoảng riêng; dời nhóm bị kẹp trong thời lượng dự án', () => {
    const project = fixture()
    const group = createTimeGroup(project, resolveTimeTargets(project, [], ['a']), { start: 1, end: 4 })
    expect(range(project, 0)).toEqual([1, 4])
    expect(shiftTimeGroup(project, group.id, 100)).toBe(16)
    expect(range(project, 0)).toEqual([17, 20])
    expect(unlinkFromTimeGroup(project, [layerNodeIdOf('a')])).toBe(1)
    expect(timeGroupOfLayer(project, 'a')).toBeUndefined()
    expect(() => setTimeGroupRange(project, group.id, 5, 30)).toThrow()
  })

  it('giữ dây Time sau khi đồ thị được suy ra lại và nối thêm Node sau khi tạo nhóm', () => {
    const project = fixture()
    const group = createTimeGroup(project, resolveTimeTargets(project, [], ['a']))
    project.workflow = syncWorkflowV2Graph(project, project.workflow)
    expect(linkToTimeGroup(project, group.id, resolveTimeTargets(project, [layerNodeIdOf('c')]))).toBe(1)
    project.workflow = syncWorkflowV2Graph(project, project.workflow)
    expect(listTimeGroups(project)[0].layerIds.sort()).toEqual(['a', 'c'])
  })

  it('mốc lộ trình Camera ăn theo Time: tới mốc lúc bắt đầu và bước kéo dài tới lúc kết thúc', () => {
    const project = fixture()
    project.camera.position.keyframes = [0, 4, 8].map((t, i) => ({ id: `p-${t}`, t, value: [i * 120, 0, -900] as [number, number, number], ease: 'easeInOut' as const }))
    project.camera.target.keyframes = [0, 4, 8].map((t, i) => ({ id: `t-${t}`, t, value: [i * 120, 0, 0] as [number, number, number], ease: 'easeInOut' as const }))
    project.workflow = syncWorkflowV2Graph(project, project.workflow)
    const waypoint = project.workflow.nodes.find(n => n.params?.isCameraWaypoint && n.params.waypointIndex === 1)
    expect(waypoint).toBeTruthy()
    const group = createTimeGroup(project, [...resolveTimeTargets(project, [], ['a']), waypoint!], { start: 5, end: 10 })
    const times = project.camera.position.keyframes.map(k => k.t)
    expect(times).toContain(5)
    expect(times).toContain(10)
    expect(range(project, 0)).toEqual([5, 10])
    setTimeGroupRange(project, group.id, 3, 7)
    const after = project.camera.position.keyframes.map(k => k.t).sort((x, y) => x - y)
    expect(after).toEqual([0, 3, 7])
  })
})
