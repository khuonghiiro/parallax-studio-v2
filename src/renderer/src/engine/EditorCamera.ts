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
  distance = 1850
  yaw = -16 * DEG
  pitch = 10 * DEG
  private persp = new THREE.PerspectiveCamera(45, 1, 5, 4e6)
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -4e6, 4e6)
  /** Set once the user framed or moved the view, so auto-framing stops. */
  touched = false

  setKind(kind: EditorViewKind): void {
    this.kind = kind
  }

  get isOrtho(): boolean {
    return this.kind === 'top' || this.kind === 'left'
  }

  /** Returns the camera updated for the given viewport aspect. */
  get(aspect: number): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    if (
      !Number.isFinite(this.target.x) ||
      !Number.isFinite(this.target.y) ||
      !Number.isFinite(this.target.z)
    ) {
      this.target.set(0, 0, 0)
    }
    if (!Number.isFinite(this.distance) || this.distance <= 0) {
      this.distance = 1850
    }
    if (!Number.isFinite(this.yaw)) this.yaw = -16 * DEG
    if (!Number.isFinite(this.pitch)) this.pitch = 10 * DEG
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
        dir.set(
          Math.sin(this.yaw) * Math.cos(this.pitch),
          Math.sin(this.pitch),
          Math.cos(this.yaw) * Math.cos(this.pitch)
        )
    }
    // Use PerspectiveCamera for both 'custom' (3D tự do) and 'front' (Trước) so 2.5D autoScale layers match Camera & Cam 2D proportions
    if (this.kind === 'custom' || this.kind === 'front') {
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

  zoom(wheelDelta: number, ndcX = 0, ndcY = 0, aspect = 1): void {
    const prevDist = this.distance
    const nextDist = Math.max(50, Math.min(1e6, prevDist * Math.exp(wheelDelta * 0.0012)))
    if (Math.abs(nextDist - prevDist) > 1e-3 && (Math.abs(ndcX) > 1e-3 || Math.abs(ndcY) > 1e-3)) {
      const cam = this.get(aspect)
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
      const deltaH = (prevDist - nextDist) * Math.tan(22.5 * DEG)
      this.target
        .addScaledVector(right, ndcX * deltaH * aspect)
        .addScaledVector(up, ndcY * deltaH)
    }
    this.distance = nextDist
    this.touched = true
  }

  /**
   * Căn khung chuẩn 2.5D lấy tâm tại mặt phẳng tiêu điểm (Z = 0) của Phân cảnh đang chọn
   * để tỷ lệ phối cảnh của các layer autoScale trong 3D tự do khớp đồng bộ với Camera và Cam 2D.
   */
  frameShotFocal(focalCenter: THREE.Vector3, compWidth: number, compHeight: number, aspect: number): void {
    this.target.copy(focalCenter)
    const refD = compHeight / 2 / Math.tan(22.5 * DEG)
    const compAspect = compWidth / Math.max(1, compHeight)
    const aspectScale = aspect < compAspect ? compAspect / Math.max(0.45, aspect) : 1
    this.distance = Math.round(refD * 1.28 * aspectScale)
    if (this.kind === 'custom') {
      this.yaw = -16 * DEG
      this.pitch = 10 * DEG
    }
  }

  /** Fit a world box in view with balanced 2.5D stage framing. */
  frame(box: THREE.Box3, aspect: number): void {
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    if (
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y) ||
      !Number.isFinite(center.z) ||
      !Number.isFinite(size.x) ||
      !Number.isFinite(size.y) ||
      !Number.isFinite(size.z)
    ) {
      this.target.set(0, 0, 0)
      this.distance = 1850
      return
    }
    // Ưu tiên đặt tâm xoay gần mặt phẳng tiêu điểm (Z ~ 0..-200) thay vì bị kéo tuốt ra Z=-1600 bởi Bầu trời autoScale
    this.target.set(center.x, center.y, Math.max(-240, box.max.z - Math.min(320, size.z * 0.15)))
    const effectiveW = Math.min(size.x, 2200)
    const effectiveH = Math.min(size.y, 1300)
    const radius = Math.max(Math.hypot(effectiveW, effectiveH) / 2, 180)
    const fit = radius / Math.tan(22.5 * DEG) / Math.min(1, Math.max(0.55, aspect))
    this.distance = Math.min(2600, Math.max(900, fit * 0.92))
  }
}
