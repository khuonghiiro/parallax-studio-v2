import * as THREE from 'three'
import type { LayerRig } from '@shared/layerRig'
import type { AssembledLayerItem } from './types'
import type { BoneTransform } from '../../engine/layerRig'

export interface Sync3DBonesOptions {
  group: THREE.Group
  rig?: LayerRig
  transforms?: Map<string, BoneTransform>
  layers: AssembledLayerItem[]
  selectedBoneId?: string | null
  hoveredBoneId?: string | null
  zExaggeration: number
  visible: boolean
}

/**
 * Tạo Group chứa khung xương 3D trong Three.js
 */
export function create3DBonesGroup(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'skeleton-3d-root'
  return group
}

/**
 * Dọn dẹp tài nguyên hình học và vật liệu của Group khung xương 3D
 */
export function dispose3DBonesGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).geometry) {
      ;(obj as THREE.Mesh).geometry.dispose()
    }
    if ((obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose())
      } else {
        mat.dispose()
      }
    }
  })
  while (group.children.length > 0) {
    group.remove(group.children[0])
  }
}

/**
 * Đồng bộ hóa toàn bộ khớp và thân xương 3D theo biến đổi thời gian thực
 */
export function update3DBonesGroup({
  group,
  rig,
  transforms,
  layers,
  selectedBoneId,
  hoveredBoneId,
  zExaggeration,
  visible
}: Sync3DBonesOptions): void {
  group.visible = visible
  if (!visible || !rig || !rig.bones.length || !transforms) {
    return
  }

  // Dọn dẹp frame cũ để tái tạo khớp và xương chính xác theo transform
  dispose3DBonesGroup(group)

  // Bản đồ độ sâu Z của từng xương dựa trên layer gắn với nó
  const boneDepthMap = new Map<string, number>()
  layers.forEach((layer) => {
    if (layer.boneId) {
      boneDepthMap.set(layer.boneId, -layer.z * zExaggeration + 1.2)
    }
  })

  // 1. Vẽ các đường quan hệ cha-con (Relationship Lines)
  const relPoints: THREE.Vector3[] = []
  rig.bones.forEach((bone) => {
    if (!bone.parentId) return
    const parent = rig.bones.find((b) => b.id === bone.parentId)
    if (!parent) return
    const parentTf = transforms.get(parent.id)
    const childTf = transforms.get(bone.id)
    if (!parentTf || !childTf) return

    const parentRad = ((parent.angle + parentTf.rotation) * Math.PI) / 180
    const ptx = parentTf.x + Math.cos(parentRad) * parent.length
    const pty = -(parentTf.y + Math.sin(parentRad) * parent.length)
    const ptz = boneDepthMap.get(parent.id) ?? 0

    const chx = childTf.x
    const chy = -childTf.y
    const chz = boneDepthMap.get(bone.id) ?? 0

    if (Math.hypot(ptx - chx, pty - chy) > 3) {
      relPoints.push(new THREE.Vector3(ptx, pty, ptz), new THREE.Vector3(chx, chy, chz))
    }
  })

  if (relPoints.length > 0) {
    const relGeom = new THREE.BufferGeometry().setFromPoints(relPoints)
    const relMat = new THREE.LineDashedMaterial({
      color: 0x94a3b8,
      dashSize: 6,
      gapSize: 4,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    })
    const relLines = new THREE.LineSegments(relGeom, relMat)
    relLines.computeLineDistances()
    relLines.renderOrder = 5000
    group.add(relLines)
  }

  // 2. Vẽ từng xương bát diện 3D và 2 khớp nối Head/Tail
  rig.bones.forEach((bone) => {
    const tf = transforms.get(bone.id)
    if (!tf) return

    const isSelected = bone.id === selectedBoneId
    const isHovered = !isSelected && bone.id === hoveredBoneId
    const zPos = boneDepthMap.get(bone.id) ?? 0

    const angle = bone.angle + tf.rotation
    const rad = (angle * Math.PI) / 180
    const ux = Math.cos(rad)
    const uy = Math.sin(rad)
    const nx = -uy
    const ny = ux

    const L = bone.length
    const hx = tf.x
    const hy = -tf.y
    const tx = hx + ux * L
    const ty = hy - uy * L

    // Khớp gốc Head (Pivot Sphere)
    const headGeom = new THREE.SphereGeometry(isSelected ? 8 : (isHovered ? 7.5 : 6), 16, 16)
    const headMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x00e5ff : (isHovered ? 0x38bdf8 : 0xffb703),
      depthTest: false
    })
    const headMesh = new THREE.Mesh(headGeom, headMat)
    headMesh.position.set(hx, hy, zPos)
    headMesh.renderOrder = 5003
    headMesh.userData = { type: 'bone', boneId: bone.id, part: 'head' }
    group.add(headMesh)

    // Khớp ngọn Tail (Tip Sphere)
    const tailGeom = new THREE.SphereGeometry(isSelected ? 6 : (isHovered ? 5.5 : 4.5), 14, 14)
    const tailMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x00e5ff : (isHovered ? 0x38bdf8 : 0xfb8500),
      depthTest: false
    })
    const tailMesh = new THREE.Mesh(tailGeom, tailMat)
    tailMesh.position.set(tx, ty, zPos)
    tailMesh.renderOrder = 5003
    tailMesh.userData = { type: 'bone', boneId: bone.id, part: 'tail' }
    group.add(tailMesh)

    // Thân xương 3D bát diện (Octahedral Bone Mesh & Wireframe)
    const waistFrac = 0.22
    const waistW = Math.max(6, Math.min(18, L * 0.16))
    const wx = hx + ux * (L * waistFrac)
    const wy = hy - uy * (L * waistFrac)

    const w1 = new THREE.Vector3(wx + nx * waistW, wy - ny * waistW, zPos)
    const w2 = new THREE.Vector3(wx - nx * waistW, wy + ny * waistW, zPos)
    const w3 = new THREE.Vector3(wx, wy, zPos + waistW)
    const w4 = new THREE.Vector3(wx, wy, zPos - waistW)

    const headV = new THREE.Vector3(hx, hy, zPos)
    const tailV = new THREE.Vector3(tx, ty, zPos)

    // 1. Thân bát diện bán trong suốt 3D (Solid Octahedral Faces)
    const facePositions = new Float32Array([
      // 4 mặt trên (từ Head tới thắt lưng)
      hx, hy, zPos,  w1.x, w1.y, w1.z,  w3.x, w3.y, w3.z,
      hx, hy, zPos,  w3.x, w3.y, w3.z,  w2.x, w2.y, w2.z,
      hx, hy, zPos,  w2.x, w2.y, w2.z,  w4.x, w4.y, w4.z,
      hx, hy, zPos,  w4.x, w4.y, w4.z,  w1.x, w1.y, w1.z,
      // 4 mặt dưới (từ Tail tới thắt lưng)
      tx, ty, zPos,  w3.x, w3.y, w3.z,  w1.x, w1.y, w1.z,
      tx, ty, zPos,  w2.x, w2.y, w2.z,  w3.x, w3.y, w3.z,
      tx, ty, zPos,  w4.x, w4.y, w4.z,  w2.x, w2.y, w2.z,
      tx, ty, zPos,  w1.x, w1.y, w1.z,  w4.x, w4.y, w4.z
    ])
    const solidGeom = new THREE.BufferGeometry()
    solidGeom.setAttribute('position', new THREE.BufferAttribute(facePositions, 3))
    solidGeom.computeVertexNormals()

    const solidMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x00e5ff : (isHovered ? 0x38bdf8 : 0x0284c7),
      transparent: true,
      opacity: isSelected ? 0.45 : (isHovered ? 0.42 : 0.28),
      side: THREE.DoubleSide,
      depthTest: false
    })
    const solidMesh = new THREE.Mesh(solidGeom, solidMat)
    solidMesh.renderOrder = 5001
    solidMesh.userData = { type: 'bone', boneId: bone.id, part: 'body' }
    group.add(solidMesh)

    // 2. Khung viền sắc nét bao quanh thân xương
    const bonePoints = [
      // 4 cạnh từ head tới thắt lưng
      headV, w1, headV, w2, headV, w3, headV, w4,
      // 4 cạnh vòng quanh thắt lưng
      w1, w3, w3, w2, w2, w4, w4, w1,
      // 4 cạnh từ thắt lưng tới tail
      w1, tailV, w2, tailV, w3, tailV, w4, tailV,
      // Trục dọc xương
      headV, tailV
    ]

    const boneGeom = new THREE.BufferGeometry().setFromPoints(bonePoints)
    const boneMat = new THREE.LineBasicMaterial({
      color: isSelected ? 0x00e5ff : (isHovered ? 0x38bdf8 : 0xffffff),
      transparent: true,
      opacity: isSelected ? 1.0 : (isHovered ? 0.95 : 0.85),
      depthTest: false
    })
    const boneLines = new THREE.LineSegments(boneGeom, boneMat)
    boneLines.renderOrder = 5002
    boneLines.userData = { type: 'bone', boneId: bone.id, part: 'wire' }
    group.add(boneLines)
  })
}
