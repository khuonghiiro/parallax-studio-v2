import {
  type AttachmentBand,
  type ContentBounds,
  type BackSidePolicy,
  type SilhouettePolicy,
  type ReusePolicy,
  type MaterialGroup,
  type ImageMeshSlotContract,
  IMAGE_CONTRACT_SCHEMA_VERSION
} from '@shared/imageMeshContract'

export {
  type AttachmentBand,
  type ContentBounds,
  type BackSidePolicy,
  type SilhouettePolicy,
  type ReusePolicy,
  type MaterialGroup,
  type ImageMeshSlotContract,
  IMAGE_CONTRACT_SCHEMA_VERSION
}

export interface ImageMeshSlot extends Partial<ImageMeshSlotContract> {
  id: string
  label: string
  en: string
  /** Exact canvas aspect ratio [widthRatio, heightRatio], including transparent padding. */
  aspect: [number, number]
  prompt: string
  guidance: string
  alphaMode: 'cutout' | 'opaque'
  symmetry: { en: string; vi: string }
  /** Normalized image coordinates: x right, y down. Outside is transparent. */
  silhouettePolygon?: number[][]
}

export interface ImageMeshVariant {
  id: string
  label: string
  en: string
  scale: [number, number, number]
  bend: number
}

export interface ImageMeshRecipe {
  slots: ImageMeshSlot[]
  variants: ImageMeshVariant[]
}

export const IMAGE_RENDER_RULES = {
  en: 'Render one separate flat orthographic PNG per slot, not a complete 3D object, collage or sprite sheet. No perspective, surrounding scene, cast shadow, baked highlights, text or border. Use even diffuse lighting and consistent material/style across slots. Follow each slot alpha rule: cutout parts have transparent surroundings; solid surfaces fill the canvas. Keep the exact canvas aspect ratio and alignment; do not auto-crop. Image top maps to face local +Y, right to local +X; face up/normal specify assembly orientation. The app adds curvature and relief: do not draw a bent or foreshortened part. Repeated faces use the identical image with geometry rotations, without automatic image mirroring. Different artwork per face requires set_assembly_face_image after applying the template.',
  vi: 'Mỗi slot là một PNG phẳng nhìn vuông góc riêng, không vẽ cả mô hình 3D, ảnh ghép hoặc sprite sheet. Không phối cảnh, cảnh nền, bóng đổ, bóng sáng vẽ sẵn, chữ hoặc khung. Ánh sáng tán xạ đều, vật liệu/phong cách đồng nhất. Theo alpha từng slot: phần cắt viền có nền trong suốt; bề mặt kín phủ đầy canvas. Giữ tỷ lệ và vị trí, không tự cắt sát ảnh. Đỉnh ảnh là +Y, bên phải là +X cục bộ của mặt; up/normal chỉ hướng trong mô hình. App tự uốn và tạo độ nổi: không vẽ phần đã cong hoặc bị thu ngắn phối cảnh. Các mặt lặp dùng cùng ảnh và xoay hình học, không tự lật gương ảnh. Muốn ảnh riêng từng mặt, dùng set_assembly_face_image sau khi áp mẫu.'
}
