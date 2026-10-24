import * as THREE from 'three'
import type { Project } from '@shared/types'
import { evaluate } from '../animation/keyframes'
import { referenceDistance } from '../animation/math'
import { evaluateCamera, type EvaluatedLayer, type EvaluatedScene } from './evaluateScene'
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
  theme?: 'dark' | 'light'
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

/** Vẽ Gizmo 3D cho Nguồn sáng ảo 2.5D (kèm tia Z-Reach) và Phễu Chiều Sâu Hang Động (Cave Depth Portal). */
function appendLayerLightAndPortalGizmos(
  el: EvaluatedLayer,
  matrix: THREE.Matrix4,
  lp: number[],
  lc: number[],
  tmp: THREE.Vector3
): void {
  const pushSeg = (a: number[], b: number[], r: number, g: number, bl: number): void => {
    lp.push(a[0], a[1], a[2], b[0], b[1], b[2])
    lc.push(r, g, bl, r, g, bl)
  }

  // 1. Gizmo 3D cho Nguồn sáng ảo 2.5D
  const vl = el.layer.virtualLight
  if (vl?.enabled && vl.kind !== 'none' && (vl.intensity ?? 0) > 0.01) {
    const lCol = new THREE.Color(vl.color || '#ff9d3b')
    const offU = el.vlightOffsetUV?.[0] ?? 0
    const offV = el.vlightOffsetUV?.[1] ?? 0
    const u0 = Math.max(-0.48, Math.min(0.48, (vl.originUV?.[0] ?? 0.5) - 0.5 + offU))
    const v0 = Math.max(-0.48, Math.min(0.48, (vl.originUV?.[1] ?? 0.5) - 0.5 + offV))
    const worldW = Math.max(64, el.size[0] * Math.abs(el.scale[0]))
    const worldH = Math.max(64, el.size[1] * Math.abs(el.scale[1]))
    const rNormX = Math.min(4.5, Math.max(0.14, (vl.radius || 320) / worldW)) * 0.5
    const rNormY = Math.min(4.5, Math.max(0.14, (vl.radius || 320) / worldH)) * 0.5
    const coneDeg = vl.coneAngleDeg ?? 360
    const beamRad = ((vl.beamAngleDeg ?? 0) * Math.PI) / 180
    const beamCurv = Math.max(-0.8, Math.min(1.0, vl.beamCurvature ?? 0))
    const origPt = tmp.set(u0, v0, 0.01).applyMatrix4(matrix).toArray()

    // Tâm đèn hình thoi nhỏ + trục lan tỏa độ sâu Z (±zReach)
    const dSz = 0.028
    const dLeft = tmp.set(u0 - dSz, v0, 0.01).applyMatrix4(matrix).toArray()
    const dRight = tmp.set(u0 + dSz, v0, 0.01).applyMatrix4(matrix).toArray()
    const dTop = tmp.set(u0, v0 + dSz, 0.01).applyMatrix4(matrix).toArray()
    const dBot = tmp.set(u0, v0 - dSz, 0.01).applyMatrix4(matrix).toArray()
    pushSeg(dLeft, dRight, 1, 0.96, 0.82)
    pushSeg(dBot, dTop, 1, 0.96, 0.82)

    const zReach = Math.max(40, vl.zReach ?? 1500)
    const zFront = tmp.set(u0, v0, zReach).applyMatrix4(matrix).toArray()
    const zBack = tmp.set(u0, v0, -zReach).applyMatrix4(matrix).toArray()
    pushSeg(zFront, zBack, lCol.r * 0.75, lCol.g * 0.75, lCol.b * 0.75)

    if (coneDeg < 350) {
      const halfRad = (Math.max(12, coneDeg) * 0.5 * Math.PI) / 180
      const startA = beamRad - halfRad
      const endA = beamRad + halfRad
      const edgeSegs = 8
      for (const side of [-1, 1]) {
        let prevPt = origPt
        for (let i = 1; i <= edgeSegs; i++) {
          const f = i / edgeSegs
          const bowF = Math.max(0.18, Math.pow(f, Math.max(0.35, 1 - beamCurv * 0.6)))
          const a = beamRad + side * halfRad * (bowF / Math.max(0.08, f))
          const nextPt = tmp
            .set(u0 + Math.cos(a) * rNormX * f, v0 + Math.sin(a) * rNormY * f, 0.01)
            .applyMatrix4(matrix)
            .toArray()
          pushSeg(prevPt, nextPt, lCol.r, lCol.g, lCol.b)
          prevPt = nextPt
        }
      }
      const segs = 14
      for (let s = 0; s < segs; s++) {
        const a0 = startA + ((endA - startA) * s) / segs
        const a1 = startA + ((endA - startA) * (s + 1)) / segs
        const p0 = tmp.set(u0 + Math.cos(a0) * rNormX, v0 + Math.sin(a0) * rNormY, 0.01).applyMatrix4(matrix).toArray()
        const p1 = tmp.set(u0 + Math.cos(a1) * rNormX, v0 + Math.sin(a1) * rNormY, 0.01).applyMatrix4(matrix).toArray()
        pushSeg(p0, p1, lCol.r, lCol.g, lCol.b)
      }
      const tip = tmp.set(u0 + Math.cos(beamRad) * rNormX * 1.08, v0 + Math.sin(beamRad) * rNormY * 1.08, 0.01).applyMatrix4(matrix).toArray()
      pushSeg(origPt, tip, 1, 0.96, 0.8)
    } else {
      const segs = 20
      for (let s = 0; s < segs; s++) {
        const a0 = (s / segs) * Math.PI * 2
        const a1 = ((s + 1) / segs) * Math.PI * 2
        const p0 = tmp.set(u0 + Math.cos(a0) * rNormX, v0 + Math.sin(a0) * rNormY, 0.01).applyMatrix4(matrix).toArray()
        const p1 = tmp.set(u0 + Math.cos(a1) * rNormX, v0 + Math.sin(a1) * rNormY, 0.01).applyMatrix4(matrix).toArray()
        pushSeg(p0, p1, lCol.r, lCol.g, lCol.b)
      }
    }
  }

  // 2. Gizmo 3D cho Lối Vào Hang Động & Phễu Độ Sâu 2.5D (Cave Depth Portal)
  const portal = el.layer.physics?.depthPortal
  if (portal?.enabled) {
    const cu = (portal.centerUV?.[0] ?? 0.5) - 0.5
    const cv = (portal.centerUV?.[1] ?? 0.45) - 0.5
    const rx = Array.isArray(portal.radiusUV) ? portal.radiusUV[0] : (portal.radiusUV ?? 0.35)
    const ry = Array.isArray(portal.radiusUV) ? portal.radiusUV[1] : (portal.radiusUV ?? 0.35)
    const minSc = Math.max(0.15, Math.min(0.92, portal.minScale ?? 0.38))
    const pullZ = -Math.max(40, portal.depthPullZ ?? 120)
    const segs = 16
    const isArch = (portal.archShape ?? 'arch') === 'arch'

    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2
      const a1 = ((s + 1) / segs) * Math.PI * 2
      const sin0 = Math.sin(a0)
      const sin1 = Math.sin(a1)
      const arch0 = isArch ? 1 - Math.max(-0.5, Math.min(0.5, sin0)) * 0.14 : 1
      const arch1 = isArch ? 1 - Math.max(-0.5, Math.min(0.5, sin1)) * 0.14 : 1
      const x0 = cu + Math.cos(a0) * rx * arch0
      const y0 = cv + sin0 * ry
      const x1 = cu + Math.cos(a1) * rx * arch1
      const y1 = cv + sin1 * ry

      const f0 = tmp.set(x0, y0, 0.01).applyMatrix4(matrix).toArray()
      const f1 = tmp.set(x1, y1, 0.01).applyMatrix4(matrix).toArray()
      pushSeg(f0, f1, 0.22, 0.74, 0.97)

      const bx0 = cu + (x0 - cu) * minSc
      const by0 = cv + (y0 - cv) * minSc
      const bx1 = cu + (x1 - cu) * minSc
      const by1 = cv + (y1 - cv) * minSc
      const b0 = tmp.set(bx0, by0, pullZ).applyMatrix4(matrix).toArray()
      const b1 = tmp.set(bx1, by1, pullZ).applyMatrix4(matrix).toArray()
      pushSeg(b0, b1, 0.51, 0.55, 0.97)

      if (s % 4 === 0) {
        pushSeg(f0, b0, 0.36, 0.65, 0.97)
      }
    }
  }
}

/**
 * Gizmos for the After-Effects-style 3D view: layer outlines, shot frustum boxes, the active
 * camera (frustum pyramid + target line), its flight path with keyframe dots and a grid.
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
    this.shotLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(false, 0.58))
    this.camLines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat(false, 0.92))
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

    // ---- layer outlines & 2.5D light/cave gizmos
    const lp: number[] = []
    const lc: number[] = []
    const selLayer = opts.selectedId ? ev.layers.find((l) => l.layer.id === opts.selectedId) : undefined
    const selModelInstanceId = selLayer?.layer.model3d?.instanceId
    const selCompInstanceId = selLayer?.layer.composite?.lockedGroup ? selLayer?.layer.composite?.instanceId : undefined

    for (const el of ev.layers) {
      const info = layers.get(el.layer.id)
      if (!info || !el.active) continue
      const isSelModel = !!(selModelInstanceId && el.layer.model3d?.instanceId === selModelInstanceId)
      const isSelComp = !!(selCompInstanceId && el.layer.composite?.instanceId === selCompInstanceId)
      const sel = el.layer.id === opts.selectedId || isSelModel || isSelComp
      col.set(sel ? '#ffffff' : info.resident ? info.color : '#4a5168')
      if (!sel) col.multiplyScalar(info.resident ? 0.75 : 1)
      const pts = PLANE_CORNERS.map(([x, y]) => tmp.set(x, y, 0).applyMatrix4(info.matrix).toArray())
      for (let i = 0; i < 4; i++) {
        lp.push(...pts[i], ...pts[(i + 1) % 4])
        lc.push(col.r, col.g, col.b, col.r, col.g, col.b)
      }
      appendLayerLightAndPortalGizmos(el, info.matrix, lp, lc, tmp)
    }
    EditorHelpers.setGeometry(this.layerLines, lp, lc)

    // ---- shot frustum boxes (ôm sát mặt phẳng tiền cảnh & hậu cảnh thực tế của phân cảnh 2.5D)
    const sp: number[] = []
    const sc: number[] = []
    for (const s of ev.shots) {
      if (!s.shot.visible || s.bounds.isEmpty()) continue
      const b = s.bounds
      const shotLayers = ev.layers.filter(
        (l) => l.active && l.shot?.shot.id === s.shot.id && l.layer.type !== 'particles' && l.rotation[0] > -60
      )
      const frontBox = new THREE.Box3()
      const backBox = new THREE.Box3()
      if (shotLayers.length >= 2) {
        const sortedByZ = [...shotLayers].sort((a, c) => a.position[2] - c.position[2])
        const frontCount = Math.max(1, Math.ceil(sortedByZ.length * 0.35))
        for (let i = 0; i < frontCount; i++) frontBox.union(sortedByZ[i].bounds)
        const backCount = Math.max(1, Math.ceil(sortedByZ.length * 0.35))
        for (let i = sortedByZ.length - backCount; i < sortedByZ.length; i++) backBox.union(sortedByZ[i].bounds)
      }
      const fb = !frontBox.isEmpty() ? frontBox : b
      const bb = !backBox.isEmpty() ? backBox : b

      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const isFront = Boolean(i & 4)
        const ref = isFront ? fb : bb
        return [
          i & 1 ? ref.max.x : ref.min.x,
          i & 2 ? ref.max.y : ref.min.y,
          isFront ? b.max.z : b.min.z
        ]
      })
      col.set(s.shot.color)
      if (s.shot.id !== opts.selectedShotId) col.multiplyScalar(0.5)
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
      const isLight = opts.theme === 'light'
      const key = `${extent}:${isLight ? 'light' : 'dark'}`
      if (key !== this.gridKey) {
        if (this.grid) {
          this.scene.remove(this.grid)
          this.grid.geometry.dispose()
          ;(this.grid.material as THREE.Material).dispose()
        }
        const div = Math.min(240, Math.round(extent / step))
        const centerColor = isLight ? 0x94a3b8 : 0x2c3350
        const gridColor = isLight ? 0xcbd5e1 : 0x161a26
        this.grid = new THREE.GridHelper(extent, div, centerColor, gridColor)
        const m = this.grid.material as THREE.Material
        m.transparent = true
        m.opacity = isLight ? 0.75 : 0.9
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
    const placedShotLabels: ScreenLabel[] = []
    for (const s of ev.shots) {
      if (!s.shot.visible || s.bounds.isEmpty()) continue
      const anchor3D = depthToThree([
        s.position[0],
        s.position[1] + 580,
        s.position[2]
      ])
      const s2 = toScreen(anchor3D)
      if (!s2 || s2[0] < 24 || s2[0] > vpW - 24 || s2[1] < 8 || s2[1] > vpH - 24) continue
      if (placedShotLabels.some((p) => Math.abs(p.x - s2[0]) < 120 && Math.abs(p.y - s2[1]) < 26)) {
        continue
      }
      const lbl: ScreenLabel = {
        kind: 'shot',
        id: s.shot.id,
        text: s.shot.name,
        color: s.shot.color,
        x: s2[0],
        y: Math.max(18, s2[1] - 6)
      }
      placedShotLabels.push(lbl)
      out.push(lbl)
    }
    const c = toScreen(activeCam.position)
    if (c) {
      out.push({
        kind: 'camera',
        id: 'camera',
        text: '📷 Camera',
        color: '#3dd6f5',
        x: Math.max(48, c[0] - 42),
        y: Math.max(24, c[1] - 28)
      })
    }
    const tg = toScreen(depthToThree(ev.camera.target, new THREE.Vector3()))
    if (tg) {
      out.push({
        kind: 'cam-target',
        id: 'cam-target',
        text: '🎯 Điểm nhìn',
        color: '#f5a623',
        x: Math.min(vpW - 56, tg[0] + 44),
        y: Math.min(vpH - 36, tg[1] + 54)
      })
    }
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
