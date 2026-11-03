/**
 * Chuyển chuỗi tiếng Việt có dấu thành chuỗi không dấu chuẩn (slug / snake_case).
 * Ví dụ: "Ánh Lửa Cháy 16F!" -> "anh_lua_chay_16f"
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/**
 * Chuyển chuỗi thành định dạng thư mục / slug không dấu chữ thường nối bằng dấu gạch dưới (_).
 * Ví dụ: "Ánh lửa cháy" -> "anh_lua_chay"
 */
export function toUnaccentedSnakeCase(str: string, fallback = 'loop_anim'): string {
  if (!str || !str.trim()) {
    return `${fallback}_${Date.now().toString(36)}`
  }
  const unaccented = removeVietnameseTones(str.trim()).toLowerCase()
  const cleaned = unaccented
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || `${fallback}_${Date.now().toString(36)}`
}
