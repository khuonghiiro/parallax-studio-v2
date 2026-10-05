import * as THREE from 'three'
import type { Project } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { evaluateCamera, type EvaluatedScene } from './evaluateScene'
import { DEG, depthToThree } from './spatial'

export interface ScreenLabel {
  kind: 'shot' | 'camera' | 'cam-target'
  id: string
  text: string
  color: string
  /** Device pixels, relative to the viewport's top-left corner. */
  x: number
  y: number
}

export interface HelperLayerInfo {
  /** Plane → world matrix (unit plane). */
  matrix: THREE.Matrix4
  resident: boolean
  color: string
  pickable: boolean
}

export interface HelperOptions {
  selectedId?: string | null
  selectedShotId?: string | null
  showPath?: boolean
}

const BOX_EDGES = [
  [0, 1], [1, 3], [3, 2], [2, 0],
  [4, 5], [5, 7], [7, 6], [6, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
]
const PLANE_CORNERS: [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5]
]
const CAMERA_COLOR = new THREE.Color('#3dd6f5')
const PATH_COLOR = new THREE.Color('#ffc24b')

/**
 * Gizmos for the After-Effects-style 3D view: layer outlines, shot boxes, the active
 * camera (frustum pyramid + target line), its flight path with keyframe dots and a grid.
 * Geometry is rebuilt per frame (cheap: a few thousand vertices at most).
 */
export class EditorHelpers {
  readonly scene = new THREE.Scene()
  private layerLines: THREE.LineSegments
  private shotLines: THREE.LineSegments
  private camLines: THREE.LineSegments
  private path: THREE.Line
  private keyPoints: THREE.Points
  private grid: THREE.GridHelper | null = null
  private gridKey = ''

  constructor() {
    const lineMat = (depthTest: boolean, opacity: number): THREE.LineBasicMaterial =>
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthTest, depthWrite: false })
    this.layerLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(true, 0.85))
    this.shotLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(false, 0.75))
    this.camLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(false, 1))
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: PATH_COLOR, transparent: true, opacity: 0.8, depthTest: false }))
    this.keyPoints = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: PATH_COLOR, size: 7, sizeAttenuation: false, depthTest: false })
    )
    for (const o of [this.layerLines, this.shotLines, this.path, this.keyPoints, this.camLines]) {
      o.frustumCulled = false
      o.renderOrder = 10
      this.scene.add(o)
    }
  }

  private static setGeometry(obj: THREE.Line | THREE.Points, positions: number[], colors?: number[]): void {
    const old = obj.geometry
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    obj.geometry = g
    old.dispose()
  }

  update(project: Project, ev: EvaluatedScene, activeCam: THREE.PerspectiveCamera, layers: Map<string, HelperLayerInfo>, opts: HelperOptions): void {
    const tmp = new THREE.Vector3()
    const col = new THREE.Color()

    // ---- layer outlines
    const lp: number[] = []
    const lc: number[] = []
    for (const el of ev.layers) {
      const info = layers.get(el.layer.id)
      if (!info || !el.active) continue
      const sel = el.layer.id === opts.selectedId
      col.set(sel ? '#ffffff' : info.resident ? info.color : '#4a5168')
      if (!sel) col.multiplyScalar(info.resident ? 0.75 : 1)
      const pts = PLANE_CORNERS.map(([x, y]) => tmp.set(x, y, 0).applyMatrix4(info.matrix).toArray())
      for (let i = 0; i < 4; i++) {
        lp.push(...pts[i], ...pts[(i + 1) % 4])
        lc.push(col.r, col.g, col.b, col.r, col.g, col.b)
      }
    }
    EditorHelpers.setGeometry(this.layerLines, lp, lc)

    // ---- shot boxes
    const sp: number[] = []
    const sc: number[] = []
    for (const s of ev.shots) {
      if (!s.shot.visible || s.bounds.isEmpty()) continue
      const b = s.bounds
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [
        i & 1 ? b.max.x : b.min.x,
        i & 2 ? b.max.y : b.min.y,
        i & 4 ? b.max.z : b.min.z
      ])
      col.set(s.shot.color)
      if (s.shot.id !== opts.selectedShotId) col.multiplyScalar(0.55)
      for (const [a, c] of BOX_EDGES) {
        sp.push(...corners[a], ...corners[c])
        sc.push(col.r, col.g, col.b, col.r, col.g, col.b)
      }
    }
    EditorHelpers.setGeometry(this.shotLines, sp, sc)

    // ---- active camera gizmo
    const cp: number[] = []
    const cc: number[] = []
    const push = (a: THREE.Vector3, b: THREE.Vector3, c = CAMERA_COLOR): void => {
      cp.push(a.x, a.y, a.z, b.x, b.y, b.z)
      cc.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    const apex = activeCam.position.clone()
    const target = depthToThree(ev.camera.target)
    const d = Math.max(200, Math.min(apex.distanceTo(target), referenceDistance(project.comp)))
    const hh = d * Math.tan((activeCam.fov * DEG) / 2)
    const hw = hh * (project.comp.width / project.comp.height)
    const q = activeCam.quaternion
    const corner = (x: number, y: number): THREE.Vector3 => new THREE.Vector3(x * hw, y * hh, -d).applyQuaternion(q).add(apex)
    const cs = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]
    for (let i = 0; i < 4; i++) {
      push(apex, cs[i])
      push(cs[i], cs[(i + 1) % 4])
    }
    const upA = corner(-0.3, 1.08)
    const upB = corner(0.3, 1.08)
    const upC = corner(0, 1.35)
    push(upA, upB)
    push(upB, upC)
    push(upC, upA)
    push(apex, target, PATH_COLOR)
    EditorHelpers.setGeometry(this.camLines, cp, cc)

    // ---- camera path + keyframes
    const showPath = opts.showPath !== false && project.camera.position.keyframes.length > 0
    this.path.visible = showPath
    this.keyPoints.visible = showPath
    if (showPath) {
      const dur = project.comp.duration
      const n = Math.max(2, Math.min(800, Math.round(dur * 24)))
      const pp: number[] = []
      for (let i = 0; i <= n; i++) {
        const p = depthToThree(evaluateCamera(project, (dur * i) / n).position, tmp)
        pp.push(p.x, p.y, p.z)
      }
      EditorHelpers.setGeometry(this.path, pp)
      const kp: number[] = []
      for (const k of project.camera.position.keyframes) {
        const p = depthToThree(evaluate(project.camera.position, k.t), tmp)
        kp.push(p.x, p.y, p.z)
      }
      EditorHelpers.setGeometry(this.keyPoints, kp)
    }

    // ---- grid under everything
    const world = new THREE.Box3()
    for (const s of ev.shots) if (s.shot.visible) world.union(s.bounds)
    for (const el of ev.layers) if (!el.shot && el.active) world.union(el.bounds)
    world.expandByPoint(apex)
    if (!world.isEmpty()) {
      const size = world.getSize(new THREE.Vector3())
      const step = 500
      const extent = Math.ceil((Math.max(size.x, size.z) * 1.3) / (step * 2)) * step * 2
      const center = world.getCenter(new THREE.Vector3())
      const y = world.min.y - 40
      const key = `${extent}`
      if (key !== this.gridKey) {
        if (this.grid) {
          this.scene.remove(this.grid)
          this.grid.geometry.dispose()
          ;(this.grid.material as THREE.Material).dispose()
        }
        const div = Math.min(240, Math.round(extent / step))
        this.grid = new THREE.GridHelper(extent, div, 0x2c3350, 0x161a26)
        const m = this.grid.material as THREE.Material
        m.transparent = true
        m.opacity = 0.9
        m.depthWrite = false
        this.grid.renderOrder = -1
        this.scene.add(this.grid)
        this.gridKey = key
      }
      this.grid!.position.set(Math.round(center.x / step) * step, y, Math.round(center.z / step) * step)
    }
  }

  /** Screen-space anchors for HTML labels (shot names, camera). */
  labels(ev: EvaluatedScene, cam: THREE.Camera, activeCam: THREE.PerspectiveCamera, vpW: number, vpH: number): ScreenLabel[] {
    const out: ScreenLabel[] = []
    const v = new THREE.Vector3()
    const toScreen = (p: THREE.Vector3): [number, number] | null => {
      v.copy(p).project(cam)
      if (v.z < -1 || v.z > 1) return null
      return [((v.x + 1) / 2) * vpW, ((1 - v.y) / 2) * vpH]
    }
    for (const s of ev.shots) {
      if (!s.shot.visible || s.bounds.isEmpty()) continue
      const b = s.bounds
      const s2 = toScreen(new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2))
      if (s2) out.push({ kind: 'shot', id: s.shot.id, text: s.shot.name, color: s.shot.color, x: s2[0], y: s2[1] })
    }
    const c = toScreen(activeCam.position)
    if (c) out.push({ kind: 'camera', id: 'camera', text: '📷 Camera', color: '#3dd6f5', x: c[0], y: c[1] })
    const tg = toScreen(depthToThree(ev.camera.target, new THREE.Vector3()))
    if (tg) out.push({ kind: 'cam-target', id: 'cam-target', text: '🎯 Điểm nhìn', color: '#f5a623', x: tg[0], y: tg[1] })
    return out
  }

  dispose(): void {
    for (const o of [this.layerLines, this.shotLines, this.camLines, this.path, this.keyPoints]) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
    if (this.grid) {
      this.grid.geometry.dispose()
      ;(this.grid.material as THREE.Material).dispose()
    }
  }
}
