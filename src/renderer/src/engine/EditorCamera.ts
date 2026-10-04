import * as THREE from 'three'

export type EditorViewKind = 'custom' | 'top' | 'front' | 'left'

const DEG = Math.PI / 180

/**
 * Free "custom view" camera for the 3D editor view (like AE's Custom View / Top / Front / Left).
 * Works in three.js world space. Orbit switches orthographic views back to custom (like AE).
 */
export class EditorCamera {
  kind: EditorViewKind = 'custom'
  readonly target = new THREE.Vector3()
  distance = 9000
  yaw = -35 * DEG
  pitch = 22 * DEG
  private persp = new THREE.PerspectiveCamera(45, 1, 5, 4e6)
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -4e6, 4e6)
  /** Set once the user framed or moved the view, so auto-framing stops. */
  touched = false

  setKind(kind: EditorViewKind): void {
    this.kind = kind
  }

  get isOrtho(): boolean {
    return this.kind !== 'custom'
  }

  /** Returns the camera updated for the given viewport aspect. */
  get(aspect: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    const dir = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    switch (this.kind) {
      case 'top':
        dir.set(0, 1, 0)
        up.set(0, 0, -1)
        break
      case 'front':
        dir.set(0, 0, 1)
        break
      case 'left':
        dir.set(-1, 0, 0)
        break
      default:
        dir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
    }
    if (this.kind === 'custom') {
      const c = this.persp
      c.aspect = aspect
      c.near = Math.max(1, this.distance / 2000)
      c.far = this.distance * 400
      c.position.copy(this.target).addScaledVector(dir, this.distance)
      c.up.copy(up)
      c.lookAt(this.target)
      c.updateProjectionMatrix()
      c.updateMatrixWorld()
      return c
    }
    const c = this.ortho
    const hh = this.distance * Math.tan(22.5 * DEG)
    c.left = -hh * aspect
    c.right = hh * aspect
    c.top = hh
    c.bottom = -hh
    c.position.copy(this.target).addScaledVector(dir, 100000)
    c.up.copy(up)
    c.lookAt(this.target)
    c.updateProjectionMatrix()
    c.updateMatrixWorld()
    return c
  }

  orbit(dxPx: number, dyPx: number): void {
    if (this.kind !== 'custom') {
      // Leaving an orthographic view: continue from an equivalent angle.
      if (this.kind === 'top') {
        this.yaw = 0
        this.pitch = 89 * DEG
      } else if (this.kind === 'front') {
        this.yaw = 0
        this.pitch = 0
      } else {
        this.yaw = -90 * DEG
        this.pitch = 0
      }
      this.kind = 'custom'
    }
    this.yaw -= dxPx * 0.006
    this.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, this.pitch + dyPx * 0.006))
    this.touched = true
  }

  /** Pan by screen pixels (viewport height in px for scale). */
  pan(dxPx: number, dyPx: number, viewportH: number, aspect: number): void {
    const cam = this.get(aspect)
    const unitsPerPx = (2 * this.distance * Math.tan(22.5 * DEG)) / Math.max(1, viewportH)
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    this.target.addScaledVector(right, -dxPx * unitsPerPx).addScaledVector(up, dyPx * unitsPerPx)
    this.touched = true
  }

  zoom(wheelDelta: number): void {
    this.distance = Math.max(50, Math.min(1e6, this.distance * Math.exp(wheelDelta * 0.0012)))
    this.touched = true
  }

  /** Fit a world box in view. */
  frame(box: THREE.Box3, aspect: number): void {
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    this.target.copy(center)
    const radius = Math.max(size.length() / 2, 100)
    const fit = radius / Math.tan(22.5 * DEG) / Math.min(1, aspect)
    this.distance = fit * 1.05
  }
}
