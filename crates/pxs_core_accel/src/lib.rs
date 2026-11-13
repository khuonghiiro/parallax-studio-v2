// Crate Rust: pxs_core_accel
// Cung cấp các hàm xử lý tính toán số học điểm ảnh hiệu năng cực cao (SIMD / Zero-alloc).

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

#[cfg(test)]
mod tests {
    use super::*;

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
