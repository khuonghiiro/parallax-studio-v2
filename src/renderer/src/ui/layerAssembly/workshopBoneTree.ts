import type { LayerBone } from '@shared/layerRig'

export interface BoneTreeRow {
  bone: LayerBone
  depth: number
  childCount: number
  collapsed: boolean
}

/**
 * Sắp xếp xương theo cây phân cấp duyệt sâu (DFS) giống Bone List của Moho: con nằm ngay dưới cha,
 * nhánh đã thu gọn thì ẩn toàn bộ hậu duệ. Khi có từ khoá lọc → hiện các xương khớp tên kèm chuỗi xương cha.
 */
export function buildBoneTreeRows(bones: LayerBone[], collapsed: ReadonlySet<string>, filter = ''): BoneTreeRow[] {
  const ids = new Set(bones.map((b) => b.id))
  const children = new Map<string, LayerBone[]>()
  const roots: LayerBone[] = []
  for (const b of bones) {
    if (b.parentId && ids.has(b.parentId) && b.parentId !== b.id) {
      const list = children.get(b.parentId) ?? []
      list.push(b)
      children.set(b.parentId, list)
    } else {
      roots.push(b)
    }
  }
  const keyword = filter.trim().toLowerCase()
  const visibleByFilter = keyword ? collectFilterMatches(bones, keyword) : null
  const rows: BoneTreeRow[] = []
  const visited = new Set<string>()
  const walk = (bone: LayerBone, depth: number) => {
    if (visited.has(bone.id)) return
    visited.add(bone.id)
    const kids = children.get(bone.id) ?? []
    const isCollapsed = !visibleByFilter && collapsed.has(bone.id) && kids.length > 0
    if (!visibleByFilter || visibleByFilter.has(bone.id)) {
      rows.push({ bone, depth, childCount: kids.length, collapsed: isCollapsed })
    }
    if (isCollapsed) return markHidden(kids)
    for (const kid of kids) walk(kid, depth + 1)
  }
  const markHidden = (list: LayerBone[]): void => {
    for (const kid of list) {
      if (visited.has(kid.id)) continue
      visited.add(kid.id)
      markHidden(children.get(kid.id) ?? [])
    }
  }
  for (const root of roots) walk(root, 0)
  // Xương lạc (chu trình cha-con lỗi) vẫn hiện để người dùng sửa được.
  for (const b of bones) if (!visited.has(b.id)) walk(b, 0)
  return rows
}

function collectFilterMatches(bones: LayerBone[], keyword: string): Set<string> {
  const byId = new Map(bones.map((b) => [b.id, b]))
  const out = new Set<string>()
  for (const b of bones) {
    if (!`${b.name} ${b.id}`.toLowerCase().includes(keyword)) continue
    let cur: LayerBone | undefined = b
    while (cur && !out.has(cur.id)) {
      out.add(cur.id)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
  }
  return out
}

/** Danh sách ID tổ tiên của một xương (để tự mở nhánh khi chọn xương trên sân khấu). */
export function boneAncestorIds(bones: LayerBone[], boneId: string | null): string[] {
  if (!boneId) return []
  const byId = new Map(bones.map((b) => [b.id, b]))
  const out: string[] = []
  let cur = byId.get(boneId)?.parentId
  while (cur && !out.includes(cur)) {
    out.push(cur)
    cur = byId.get(cur)?.parentId
  }
  return out
}
