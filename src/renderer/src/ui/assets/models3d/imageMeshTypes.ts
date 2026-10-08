export interface ImageMeshSlot {
  id: string
  label: string
  en: string
  /** Exact canvas aspect ratio, including transparent padding. */
  aspect: [number, number]
  prompt: string
  guidance: string
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
  en: 'Render each slot as a separate orthographic PNG with real alpha, no perspective, no background, no cast shadow, no text or border. Use even diffuse lighting and consistent material/style across slots. Keep the exact canvas aspect ratio and alignment; do not auto-crop. Image top maps to local +Y, right to local +X. Transparent holes are removed by the alpha mesh. A single photo cannot reveal hidden surfaces: supply separate views or generate missing parts.',
  vi: 'Mỗi bộ phận là một PNG riêng có alpha thật, nhìn vuông góc, không phối cảnh, không nền, bóng đổ, chữ hay khung. Ánh sáng tán xạ đều, vật liệu và phong cách đồng nhất. Giữ đúng tỷ lệ canvas và vị trí, không tự cắt sát ảnh. Đỉnh ảnh là +Y cục bộ, bên phải là +X. Mesh bám alpha sẽ bỏ vùng trong suốt. Một ảnh không thể cung cấp mặt khuất: cần ảnh riêng hoặc tạo thêm bộ phận còn thiếu.'
}
