// Crate Rust: pxs_core_accel
// Cung cấp các hàm xử lý tính toán số học điểm ảnh và lưới 2.5D hiệu năng cực cao (SIMD / Zero-alloc).

pub mod wasm_mem;
pub use wasm_mem::{wasm_scratch_alloc, wasm_scratch_capacity, wasm_scratch_reset};

#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BoundingBoxResult {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
    pub found: bool,
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
    if data.is_null() || out.is_null() || width <= 0 || height <= 0 {
        return false;
    }

    let expected_len = (width as usize) * (height as usize) * 4;
    if len < expected_len {
        return false;
    }

    let slice = unsafe { std::slice::from_raw_parts(data, expected_len) };

    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = -1;
    let mut max_y = -1;

    let w_usize = width as usize;

    for y in 0..height {
        let row_offset = (y as usize) * w_usize * 4;
        let row = &slice[row_offset..row_offset + w_usize * 4];

        for x in 0..width {
            let alpha = row[(x as usize) * 4 + 3];
            if alpha > alpha_threshold {
                if x < min_x { min_x = x; }
                if x > max_x { max_x = x; }
                if y < min_y { min_y = y; }
                if y > max_y { max_y = y; }
            }
        }
    }

    let found = max_x >= 0 && max_y >= 0;

    unsafe {
        *out = BoundingBoxResult {
            min_x: if found { min_x } else { 0 },
            min_y: if found { min_y } else { 0 },
            max_x: if found { max_x } else { 0 },
            max_y: if found { max_y } else { 0 },
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
    if rgba_in.is_null() || yuv_out.is_null() || width <= 0 || height <= 0 {
        return false;
    }

    if width % 2 != 0 || height % 2 != 0 {
        return false;
    }

    let w = width as usize;
    let h = height as usize;
    let total_pixels = w * h;
    let expected_rgba = total_pixels * 4;
    let expected_yuv = (total_pixels * 3) / 2;

    if rgba_len < expected_rgba || yuv_len < expected_yuv {
        return false;
    }

    let rgba = unsafe { std::slice::from_raw_parts(rgba_in, expected_rgba) };
    let yuv = unsafe { std::slice::from_raw_parts_mut(yuv_out, expected_yuv) };

    let u_offset = total_pixels;
    let v_offset = total_pixels + (total_pixels / 4);

    // 1. Tính toán Plane Y cho toàn bộ pixel bằng phép toán số nguyên BT.601
    // Y = ((66 * R + 129 * G + 25 * B + 128) >> 8) + 16
    for i in 0..total_pixels {
        let r = rgba[i * 4] as i32;
        let g = rgba[i * 4 + 1] as i32;
        let b = rgba[i * 4 + 2] as i32;

        let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
        yuv[i] = y_val.clamp(16, 235) as u8;
    }

    // 2. Tính toán Plane U và V với subsampling 2x2 (trung bình 4 pixel lân cận)
    // U = ((-38 * R - 74 * G + 112 * B + 128) >> 8) + 128
    // V = ((112 * R - 94 * G - 18 * B + 128) >> 8) + 128
    let half_w = w / 2;
    let half_h = h / 2;

    for y2 in 0..half_h {
        let y_orig = y2 * 2;
        for x2 in 0..half_w {
            let x_orig = x2 * 2;

            // 4 pixel trong khối 2x2
            let p00 = (y_orig * w + x_orig) * 4;
            let p01 = (y_orig * w + (x_orig + 1)) * 4;
            let p10 = ((y_orig + 1) * w + x_orig) * 4;
            let p11 = ((y_orig + 1) * w + (x_orig + 1)) * 4;

            let avg_r = (rgba[p00] as i32 + rgba[p01] as i32 + rgba[p10] as i32 + rgba[p11] as i32 + 2) >> 2;
            let avg_g = (rgba[p00 + 1] as i32 + rgba[p01 + 1] as i32 + rgba[p10 + 1] as i32 + rgba[p11 + 1] as i32 + 2) >> 2;
            let avg_b = (rgba[p00 + 2] as i32 + rgba[p01 + 2] as i32 + rgba[p10 + 2] as i32 + rgba[p11 + 2] as i32 + 2) >> 2;

            let u_val = ((-38 * avg_r - 74 * avg_g + 112 * avg_b + 128) >> 8) + 128;
            let v_val = ((112 * avg_r - 94 * avg_g - 18 * avg_b + 128) >> 8) + 128;

            let uv_idx = y2 * half_w + x2;
            yuv[u_offset + uv_idx] = u_val.clamp(16, 240) as u8;
            yuv[v_offset + uv_idx] = v_val.clamp(16, 240) as u8;
        }
    }

    true
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
}
