// Crate Rust: pxs_core_accel
// Cung cấp các hàm xử lý tính toán số học điểm ảnh và lưới 2.5D hiệu năng cực cao (SIMD / Zero-alloc).

pub mod chroma_edge_ops;
pub mod chroma_matte_unmix;
pub mod geom2d;
pub mod geodesic_chains;
pub mod geodesic_graph;
pub mod geodesic_skinning;
pub mod island_contour;
pub mod mesh_corridor;
pub mod mesh_modifiers;
pub mod pixel_isolation;
pub mod skin_deform;
pub mod wasm_mem;
pub use chroma_edge_ops::{
    rust_apply_defringe_and_despill, rust_apply_despeckle_and_crumbs,
    rust_apply_feather_and_choke, rust_apply_smooth_edge_feather, rust_collect_boundary_indices,
};
pub use chroma_matte_unmix::{
    rust_analyze_chroma_alpha, rust_batch_unmix_pixels, rust_classify_bg_pixels,
};
pub use geodesic_skinning::{rust_build_geodesic_skin_weights, rust_dominant_bone_per_triangle};
pub use island_contour::{
    rust_disambiguate_region_pixels, rust_scan_contour_flood_boxes, rust_scan_raw_islands,
};
pub use mesh_corridor::rust_compute_mesh_corridor;
pub use mesh_modifiers::{
    rust_apply_bend, rust_apply_brush, rust_apply_curve, rust_apply_depth_profile,
    rust_apply_lattice, rust_apply_timeline_motion, rust_apply_twist,
};
pub use pixel_isolation::{
    rust_box_blur3, rust_compute_chroma_zone, rust_dilate_mask_box, rust_flood_from_border,
    rust_grow_mask_within,
};
pub use skin_deform::{rust_deform_plant_spines, rust_deform_skin, rust_scale_unit_space};
pub use wasm_mem::{
    wasm_scratch_alloc, wasm_scratch_capacity, wasm_scratch_reserve, wasm_scratch_reset,
};

#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BoundingBoxResult {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
    pub found: bool,
}

#[inline(always)]
fn scan_bbox_row_slice(
    row: &[u8],
    fx_start: i32,
    fx_end: i32,
    rect_x: i32,
    alpha_min: u8,
    min_x: &mut i32,
    max_x: &mut i32,
) -> bool {
    let mut row_hit = false;
    let mut fx = fx_start;

    #[cfg(target_arch = "wasm32")]
    {
        use core::arch::wasm32::*;
        let need = u32x4_splat(alpha_min as u32);
        while fx + 4 <= fx_end {
            let px_off = ((rect_x + fx) as usize) * 4;
            let v = unsafe { v128_load(row.as_ptr().add(px_off) as *const v128) };
            let alphas = u32x4_shr(v, 24);
            if v128_any_true(u32x4_ge(alphas, need)) {
                for k in 0..4 {
                    let a = row[px_off + k * 4 + 3];
                    if a >= alpha_min {
                        let cur = fx + k as i32;
                        if cur < *min_x {
                            *min_x = cur;
                        }
                        if cur > *max_x {
                            *max_x = cur;
                        }
                        row_hit = true;
                    }
                }
            }
            fx += 4;
        }
    }

    while fx < fx_end {
        let a = row[((rect_x + fx) as usize) * 4 + 3];
        if a >= alpha_min {
            if fx < *min_x {
                *min_x = fx;
            }
            if fx > *max_x {
                *max_x = fx;
            }
            row_hit = true;
        }
        fx += 1;
    }

    row_hit
}

/// Tìm bounding box của các pixel đục trong vùng chữ nhật `(rect_x, rect_y, rect_w, rect_h)` của buffer RGBA.
/// Ghi kết quả 5 phần tử `i32` vào `out_i32`: `[min_x, min_y, max_x, max_y, found]` (tọa độ cục bộ `0..rect_w-1`).
/// `inclusive != 0` dùng `alpha >= alpha_threshold`, ngược lại dùng `alpha > alpha_threshold`.
#[unsafe(no_mangle)]
pub extern "C" fn rust_find_opaque_bbox_rect(
    data: *const u8,
    len: usize,
    width: i32,
    height: i32,
    rect_x: i32,
    rect_y: i32,
    rect_w: i32,
    rect_h: i32,
    alpha_threshold: u8,
    inclusive: i32,
    out_i32: *mut i32,
) -> i32 {
    if data.is_null() || out_i32.is_null() || width <= 0 || height <= 0 || rect_w <= 0 || rect_h <= 0
    {
        return 0;
    }

    let expected_len = (width as usize) * (height as usize) * 4;
    if len < expected_len {
        return 0;
    }

    let out = unsafe { std::slice::from_raw_parts_mut(out_i32, 5) };
    if inclusive == 0 && alpha_threshold == 255 {
        out[0] = 0;
        out[1] = 0;
        out[2] = -1;
        out[3] = -1;
        out[4] = 0;
        return 1;
    }

    let alpha_min = if inclusive != 0 {
        alpha_threshold
    } else {
        alpha_threshold.saturating_add(1)
    };

    let fx_start = (-rect_x).max(0);
    let fx_end = rect_w.min(width - rect_x);
    let fy_start = (-rect_y).max(0);
    let fy_end = rect_h.min(height - rect_y);

    if fx_start >= fx_end || fy_start >= fy_end {
        out[0] = 0;
        out[1] = 0;
        out[2] = -1;
        out[3] = -1;
        out[4] = 0;
        return 1;
    }

    let slice = unsafe { std::slice::from_raw_parts(data, expected_len) };
    let row_stride = (width as usize) * 4;
    let mut min_x = rect_w;
    let mut min_y = rect_h;
    let mut max_x = -1;
    let mut max_y = -1;

    for fy in fy_start..fy_end {
        let py = (rect_y + fy) as usize;
        let row = &slice[py * row_stride..(py + 1) * row_stride];
        if scan_bbox_row_slice(row, fx_start, fx_end, rect_x, alpha_min, &mut min_x, &mut max_x) {
            if fy < min_y {
                min_y = fy;
            }
            if fy > max_y {
                max_y = fy;
            }
        }
    }

    let found = max_x >= min_x && max_y >= min_y;
    out[0] = if found { min_x } else { 0 };
    out[1] = if found { min_y } else { 0 };
    out[2] = if found { max_x } else { -1 };
    out[3] = if found { max_y } else { -1 };
    out[4] = if found { 1 } else { 0 };
    1
}

/// Tìm bounding box của các pixel đục trong mảng RGBA (4 bytes / pixel).
/// Tốc độ O(N) quét bộ nhớ liên tục với zero allocation.
#[unsafe(no_mangle)]
pub extern "C" fn rust_find_opaque_bbox(
    data: *const u8,
    len: usize,
    width: i32,
    height: i32,
    alpha_threshold: u8,
    out: *mut BoundingBoxResult,
) -> bool {
    if out.is_null() {
        return false;
    }
    let mut raw = [0i32; 5];
    let ok = rust_find_opaque_bbox_rect(
        data,
        len,
        width,
        height,
        0,
        0,
        width,
        height,
        alpha_threshold,
        0,
        raw.as_mut_ptr(),
    );
    if ok == 0 {
        return false;
    }
    let found = raw[4] != 0;
    unsafe {
        *out = BoundingBoxResult {
            min_x: if found { raw[0] } else { 0 },
            min_y: if found { raw[1] } else { 0 },
            max_x: if found { raw[2] } else { 0 },
            max_y: if found { raw[3] } else { 0 },
            found,
        };
    }
    true
}

/// Khử màu phông xanh (Chroma Key Green Despill) tốc độ cao
#[unsafe(no_mangle)]
pub extern "C" fn rust_chroma_despill(
    data: *mut u8,
    len: usize,
    width: i32,
    height: i32,
    green_factor: f32,
) -> bool {
    if data.is_null() || width <= 0 || height <= 0 {
        return false;
    }

    let total_pixels = (width as usize) * (height as usize);
    let expected_len = total_pixels * 4;
    if len < expected_len {
        return false;
    }

    let slice = unsafe { std::slice::from_raw_parts_mut(data, expected_len) };

    for chunk in slice.chunks_exact_mut(4) {
        let a = chunk[3];
        if a == 0 {
            continue;
        }

        let r = chunk[0] as f32;
        let g = chunk[1] as f32;
        let b = chunk[2] as f32;

        let max_rb = r.max(b);
        if g > max_rb {
            let new_g = max_rb + (g - max_rb) * (1.0 - green_factor).clamp(0.0, 1.0);
            chunk[1] = new_g.round() as u8;
        }
    }

    true
}

fn convert_rgba_to_yuv420p_impl(
    rgba: &[u8],
    w: usize,
    h: usize,
    flip_y: bool,
    yuv: &mut [u8],
) {
    let total_pixels = w * h;
    let u_offset = total_pixels;
    let v_offset = total_pixels + (total_pixels / 4);

    // Plane Y: ((66 * R + 129 * G + 25 * B + 128) >> 8) + 16
    for y in 0..h {
        let src_y = if flip_y { h - 1 - y } else { y };
        let src_row = src_y * w * 4;
        let dst_row = y * w;
        for x in 0..w {
            let off = src_row + x * 4;
            let r = rgba[off] as i32;
            let g = rgba[off + 1] as i32;
            let b = rgba[off + 2] as i32;
            let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            yuv[dst_row + x] = y_val.clamp(16, 235) as u8;
        }
    }

    // Plane U và V với subsampling 2x2
    let half_w = w / 2;
    let half_h = h / 2;
    for y2 in 0..half_h {
        let y_top = y2 * 2;
        let sy0 = if flip_y { h - 1 - y_top } else { y_top };
        let sy1 = if flip_y { h - 2 - y_top } else { y_top + 1 };
        let row0 = sy0 * w * 4;
        let row1 = sy1 * w * 4;
        for x2 in 0..half_w {
            let x_orig = x2 * 2;
            let p00 = row0 + x_orig * 4;
            let p01 = p00 + 4;
            let p10 = row1 + x_orig * 4;
            let p11 = p10 + 4;

            let avg_r =
                (rgba[p00] as i32 + rgba[p01] as i32 + rgba[p10] as i32 + rgba[p11] as i32 + 2) >> 2;
            let avg_g = (rgba[p00 + 1] as i32
                + rgba[p01 + 1] as i32
                + rgba[p10 + 1] as i32
                + rgba[p11 + 1] as i32
                + 2)
                >> 2;
            let avg_b = (rgba[p00 + 2] as i32
                + rgba[p01 + 2] as i32
                + rgba[p10 + 2] as i32
                + rgba[p11 + 2] as i32
                + 2)
                >> 2;

            let u_val = ((-38 * avg_r - 74 * avg_g + 112 * avg_b + 128) >> 8) + 128;
            let v_val = ((112 * avg_r - 94 * avg_g - 18 * avg_b + 128) >> 8) + 128;

            let uv_idx = y2 * half_w + x2;
            yuv[u_offset + uv_idx] = u_val.clamp(16, 240) as u8;
            yuv[v_offset + uv_idx] = v_val.clamp(16, 240) as u8;
        }
    }
}

/// Chuyển đổi RGBA sang Planar YUV420p hỗ trợ lật trục Y (`flip_y != 0`) cho buffer `readPixels` từ WebGL.
#[unsafe(no_mangle)]
pub extern "C" fn rust_rgba_to_yuv420p_ex(
    rgba_in: *const u8,
    rgba_len: usize,
    width: i32,
    height: i32,
    flip_y: i32,
    yuv_out: *mut u8,
    yuv_len: usize,
) -> i32 {
    if rgba_in.is_null() || yuv_out.is_null() || width <= 0 || height <= 0 {
        return 0;
    }
    if width % 2 != 0 || height % 2 != 0 {
        return 0;
    }

    let w = width as usize;
    let h = height as usize;
    let total_pixels = w * h;
    let expected_rgba = total_pixels * 4;
    let expected_yuv = (total_pixels * 3) / 2;
    if rgba_len < expected_rgba || yuv_len < expected_yuv {
        return 0;
    }

    let rgba = unsafe { std::slice::from_raw_parts(rgba_in, expected_rgba) };
    let yuv = unsafe { std::slice::from_raw_parts_mut(yuv_out, expected_yuv) };
    convert_rgba_to_yuv420p_impl(rgba, w, h, flip_y != 0, yuv);
    1
}

/// Chuyển đổi màu sắc RGBA sang Planar YUV420p tốc độ cao với thuật toán BT.601 tối ưu integer math.
/// Định dạng: Plane Y (width * height), sau đó Plane U ((width/2) * (height/2)), sau đó Plane V.
/// Kích thước buffer yuv_out tối thiểu: (width * height * 3) / 2.
#[unsafe(no_mangle)]
pub extern "C" fn rust_rgba_to_yuv420p(
    rgba_in: *const u8,
    rgba_len: usize,
    width: i32,
    height: i32,
    yuv_out: *mut u8,
    yuv_len: usize,
) -> bool {
    rust_rgba_to_yuv420p_ex(rgba_in, rgba_len, width, height, 0, yuv_out, yuv_len) != 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgba_to_yuv420p() {
        let width = 2;
        let height = 2;
        let rgba = vec![
            255, 0, 0, 255,   // Đỏ
            0, 255, 0, 255,   // Xanh lá
            0, 0, 255, 255,   // Xanh lam
            255, 255, 255, 255, // Trắng
        ];
        let mut yuv = vec![0u8; (width * height * 3) / 2];

        let ok = rust_rgba_to_yuv420p(
            rgba.as_ptr(),
            rgba.len(),
            width as i32,
            height as i32,
            yuv.as_mut_ptr(),
            yuv.len(),
        );

        assert!(ok);
        // Kiểm tra Y > 0 và tồn tại U, V hợp lệ trong dải video
        assert!(yuv[0] >= 16);
        assert!(yuv[4] >= 16 && yuv[4] <= 240); // U
        assert!(yuv[5] >= 16 && yuv[5] <= 240); // V
    }

    #[test]
    fn test_find_opaque_bbox() {
        let width = 10;
        let height = 10;
        let mut data = vec![0u8; (width * height * 4) as usize];

        // Đặt 2 pixel đục tại (2, 3) và (7, 8)
        let idx1 = ((3 * width + 2) * 4 + 3) as usize;
        let idx2 = ((8 * width + 7) * 4 + 3) as usize;
        data[idx1] = 255;
        data[idx2] = 200;

        let mut res = BoundingBoxResult {
            min_x: 0, min_y: 0, max_x: 0, max_y: 0, found: false,
        };

        let ok = rust_find_opaque_bbox(
            data.as_ptr(),
            data.len(),
            width,
            height,
            10,
            &mut res as *mut _,
        );

        assert!(ok);
        assert!(res.found);
        assert_eq!(res.min_x, 2);
        assert_eq!(res.min_y, 3);
        assert_eq!(res.max_x, 7);
        assert_eq!(res.max_y, 8);
    }

    #[test]
    fn test_find_opaque_bbox_rect_inclusive_and_subrect() {
        let w = 12;
        let h = 10;
        let mut data = vec![0u8; (w * h * 4) as usize];
        // Pixel tại (1, 1) alpha = 255 (ngoài sub-rect)
        data[((1 * w + 1) * 4 + 3) as usize] = 255;
        // Pixel tại (4, 3) alpha = 20 (bằng ngưỡng)
        data[((3 * w + 4) * 4 + 3) as usize] = 20;
        // Pixel tại (7, 6) alpha = 21 (lớn hơn ngưỡng)
        data[((6 * w + 7) * 4 + 3) as usize] = 21;

        let mut out_exc = [0i32; 5];
        let ok1 = rust_find_opaque_bbox_rect(
            data.as_ptr(),
            data.len(),
            w,
            h,
            3,
            2,
            6,
            6,
            20,
            0,
            out_exc.as_mut_ptr(),
        );
        assert_eq!(ok1, 1);
        assert_eq!(out_exc, [4, 4, 4, 4, 1]);

        let mut out_inc = [0i32; 5];
        let ok2 = rust_find_opaque_bbox_rect(
            data.as_ptr(),
            data.len(),
            w,
            h,
            3,
            2,
            6,
            6,
            20,
            1,
            out_inc.as_mut_ptr(),
        );
        assert_eq!(ok2, 1);
        assert_eq!(out_inc, [1, 1, 4, 4, 1]);
    }

    #[test]
    fn test_rgba_to_yuv420p_flip_y() {
        let w = 2;
        let h = 2;
        // Bottom-up: hàng 0 (đáy) là trắng (255,255,255), hàng 1 (đỉnh) là đen (0,0,0)
        let rgba = vec![
            255, 255, 255, 255, 255, 255, 255, 255,
            0, 0, 0, 255, 0, 0, 0, 255,
        ];
        let mut yuv = vec![0u8; 6];
        let ok = rust_rgba_to_yuv420p_ex(
            rgba.as_ptr(),
            rgba.len(),
            w,
            h,
            1,
            yuv.as_mut_ptr(),
            yuv.len(),
        );
        assert_eq!(ok, 1);
        // Sau flip_y: hàng đỉnh là đen (Y=16), hàng đáy là trắng (Y=235)
        assert_eq!(yuv[0], 16);
        assert_eq!(yuv[1], 16);
        assert_eq!(yuv[2], 235);
        assert_eq!(yuv[3], 235);
    }
}
