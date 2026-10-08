import type { AssemblyTemplate, TemplateFaceSpec } from './assemblyTemplateKit'
import type { ImageMeshSlot } from './imageMeshTypes'

export function exactAspect(w: number, h: number): [number, number] {
  let a = Math.round(w), b = Math.round(h)
  while (b) [a, b] = [b, a % b]
  return [Math.round(w / a), Math.round(h / a)]
}

export const SURFACE_SYMMETRY = {
  en: 'No automatic mirror symmetry is assumed. Keep the supplied outline and image-up direction. Match material scale and edge colors on adjoining faces; asymmetric artwork needs a separate image per face.',
  vi: 'Không mặc định đối xứng gương. Giữ đường viền và hướng đỉnh ảnh. Khớp tỷ lệ vật liệu và màu mép giữa các mặt kề nhau; họa tiết khác nhau cần ảnh riêng từng mặt.'
}

/** Alpha silhouettes are specified in normalized image coordinates, origin at top left. */
function silhouette(template: AssemblyTemplate, f: TemplateFaceSpec): number[][] | undefined {
  if (['gable-house', 'shell-two-storey'].includes(template.id) && /mặt trước|mặt sau/i.test(f.name)) {
    const rise = template.id === 'gable-house' ? 260 : 240
    return [[0.5, 0], [1, rise / f.h], [1, 1], [0, 1], [0, rise / f.h]]
  }
  if (template.id === 'pyramid' || (template.id === 'shell-spire-tower' && /mái/i.test(f.name))) return [[0.5, 0], [1, 1], [0, 1]]
  if (template.id === 'tent' && /cửa|vách/i.test(f.name)) return [[0.5, 0], [1, 1], [0, 1]]
  if (template.id === 'shell-shed-roof' && /trái|phải/i.test(f.name)) {
    const low = 140 / 480
    return f.n[0] < 0 ? [[0, low], [1, 0], [1, 1], [0, 1]] : [[0, 0], [1, low], [1, 1], [0, 1]]
  }
  if (template.id === 'shell-hip-roof' && /mái/i.test(f.name)) {
    if (/hông/i.test(f.name)) return [[0.5, 0], [1, 1], [0, 1]]
    // Ridge endpoints x=+-100 in a 740-wide plane.
    return [[270 / 740, 0], [470 / 740, 0], [720 / 740, 1], [20 / 740, 1]]
  }
  return undefined
}

/** Split incompatible canvases instead of stretching one image across unlike faces. */
export function fitRecipeToGeometry(template: AssemblyTemplate, slots: ImageMeshSlot[], faces: TemplateFaceSpec[]) {
  const fitted: ImageMeshSlot[] = []
  const groups = new Map<string, string>()
  const used = new Set<string>()
  const result = faces.map((face) => {
    const source = slots.find((s) => s.id === face.imageSlot)
    if (!source) throw new Error(`Missing image slot for ${template.id}: ${face.name}`)
    const aspect = exactAspect(face.w, face.h)
    const polygon = silhouette(template, face)
    const key = JSON.stringify([source.id, aspect, polygon])
    let id = groups.get(key)
    if (!id) {
      id = used.has(source.id) ? `${source.id}__${aspect.join('x')}_${fitted.length + 1}` : source.id
      used.add(id)
      groups.set(key, id)
      const shape = polygon ? ` Use this exact opaque silhouette polygon in normalized image coordinates (x right, y down): ${JSON.stringify(polygon)}. Everything outside is transparent; no padding.` : ''
      fitted.push({ ...source, id, aspect,
        label: id === source.id ? source.label : `${source.label} · ${face.name}`,
        alphaMode: polygon ? 'cutout' : source.alphaMode,
        silhouettePolygon: polygon,
        prompt: `${source.prompt}${shape}`,
        guidance: `${source.guidance}${polygon ? ` Biên alpha theo đa giác tọa độ ảnh chuẩn hóa (x sang phải, y xuống): ${JSON.stringify(polygon)}; ngoài biên trong suốt, không chừa viền.` : ''}`
      })
    }
    return { ...face, imageSlot: id }
  })
  return { slots: fitted, faces: result }
}
