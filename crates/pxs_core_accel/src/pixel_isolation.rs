// Tăng tốc tách vùng nền ngoài, làm mịn hộp 3x3 và giãn nở mặt nạ bằng Rust WASM.

#[unsafe(no_mangle)]
pub extern "C" fn rust_box_blur3(
    src_ptr: *const f32,
    dst_ptr: *mut f32,
    w: i32,
    h: i32,
) -> i32 {
    if src_ptr.is_null() || dst_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let width = w as usize;
    let height = h as usize;
    let total = width * height;
    let src = unsafe { std::slice::from_raw_parts(src_ptr, total) };
    let out = unsafe { std::slice::from_raw_parts_mut(dst_ptr, total) };
    let mut tmp = vec![0.0f32; total];
    box_blur3_slice(src, &mut tmp, out, width, height);
    1
}

fn box_blur3_slice(src: &[f32], tmp: &mut [f32], out: &mut [f32], width: usize, height: usize) {
    for y in 0..height {
        let row = y * width;
        for x in 0..width {
            let l = src[row + if x > 0 { x - 1 } else { x }] as f64;
            let c = src[row + x] as f64;
            let r = src[row + if x + 1 < width { x + 1 } else { x }] as f64;
            tmp[row + x] = ((l + c + r) / 3.0) as f32;
        }
    }
    for y in 0..height {
        let up = (if y > 0 { y - 1 } else { y }) * width;
        let dn = (if y + 1 < height { y + 1 } else { y }) * width;
        let row = y * width;
        for x in 0..width {
            let v = (tmp[up + x] as f64 + tmp[row + x] as f64 + tmp[dn + x] as f64) / 3.0;
            out[row + x] = v as f32;
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_flood_from_border(
    passable_ptr: *const u8,
    seed_ptr: *const u8,
    out_ptr: *mut u8,
    w: i32,
    h: i32,
) -> i32 {
    if passable_ptr.is_null() || out_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let width = w as usize;
    let height = h as usize;
    let total = width * height;
    let passable = unsafe { std::slice::from_raw_parts(passable_ptr, total) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, total) };
    let seed = if seed_ptr.is_null() {
        None
    } else {
        Some(unsafe { std::slice::from_raw_parts(seed_ptr, total) })
    };
    flood_from_border_slice(passable, seed, out, width, height);
    1
}

#[inline(always)]
fn push_passable(p: usize, passable: &[u8], queue: &mut Vec<usize>, out: &mut [u8]) {
    if passable[p] != 0 && out[p] == 0 {
        out[p] = 1;
        queue.push(p);
    }
}

fn ray_seed_passable_edges(
    passable: &[u8],
    queue: &mut Vec<usize>,
    out: &mut [u8],
    width: usize,
    height: usize,
) {
    let step = 1usize.max(width.min(height) / 120);
    let mut x = 0;
    while x < width {
        for y in 0..height {
            let p = y * width + x;
            if passable[p] != 0 {
                push_passable(p, passable, queue, out);
                break;
            }
        }
        for y in (0..height).rev() {
            let p = y * width + x;
            if passable[p] != 0 {
                push_passable(p, passable, queue, out);
                break;
            }
        }
        x += step;
    }
    let mut y = 0;
    while y < height {
        for x_col in 0..width {
            let p = y * width + x_col;
            if passable[p] != 0 {
                push_passable(p, passable, queue, out);
                break;
            }
        }
        for x_col in (0..width).rev() {
            let p = y * width + x_col;
            if passable[p] != 0 {
                push_passable(p, passable, queue, out);
                break;
            }
        }
        y += step;
    }
}

fn flood_from_border_slice(
    passable: &[u8],
    seed: Option<&[u8]>,
    out: &mut [u8],
    width: usize,
    height: usize,
) {
    let total = width * height;
    out.fill(0);
    if total == 0 {
        return;
    }
    let mut queue: Vec<usize> = Vec::with_capacity((total / 4).max(64));
    for x in 0..width {
        push_passable(x, passable, &mut queue, out);
        push_passable((height - 1) * width + x, passable, &mut queue, out);
    }
    for y in 1..height.saturating_sub(1) {
        push_passable(y * width, passable, &mut queue, out);
        push_passable(y * width + (width - 1), passable, &mut queue, out);
    }
    if let Some(s) = seed {
        for p in 0..total {
            if s[p] != 0 {
                push_passable(p, passable, &mut queue, out);
            }
        }
    }
    if queue.is_empty() {
        ray_seed_passable_edges(passable, &mut queue, out, width, height);
    }

    let mut head = 0usize;
    while head < queue.len() {
        let curr = queue[head];
        head += 1;
        let cx = curr % width;
        if cx > 0 {
            push_passable(curr - 1, passable, &mut queue, out);
        }
        if cx + 1 < width {
            push_passable(curr + 1, passable, &mut queue, out);
        }
        if curr >= width {
            push_passable(curr - width, passable, &mut queue, out);
        }
        if curr + width < total {
            push_passable(curr + width, passable, &mut queue, out);
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_grow_mask_within(
    mask_ptr: *mut u8,
    allowed_ptr: *const u8,
    w: i32,
    h: i32,
    steps: i32,
) -> i32 {
    if mask_ptr.is_null() || allowed_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    if steps <= 0 {
        return 1;
    }
    let width = w as usize;
    let height = h as usize;
    let total = width * height;
    let mask = unsafe { std::slice::from_raw_parts_mut(mask_ptr, total) };
    let allowed = unsafe { std::slice::from_raw_parts(allowed_ptr, total) };
    grow_mask_within_slice(mask, allowed, width, height, steps as usize);
    1
}

fn grow_mask_within_slice(
    mask: &mut [u8],
    allowed: &[u8],
    width: usize,
    height: usize,
    steps: usize,
) {
    let total = width * height;
    let mut snap = vec![0u8; total];
    for _ in 0..steps {
        snap.copy_from_slice(mask);
        for p in 0..total {
            if mask[p] != 0 || allowed[p] == 0 {
                continue;
            }
            let x = p % width;
            if (x > 0 && snap[p - 1] != 0)
                || (x + 1 < width && snap[p + 1] != 0)
                || (p >= width && snap[p - width] != 0)
                || (p + width < total && snap[p + width] != 0)
            {
                mask[p] = 1;
            }
        }
    }
}

fn scan_dilate_axis_line(src: &[u8], dst: &mut [u8], start: usize, step: usize, count: usize, r: usize) {
    let mut dist = r + 1;
    for i in 0..count {
        let idx = start + i * step;
        dist = if src[idx] != 0 { 0 } else { dist + 1 };
        if dist <= r {
            dst[idx] = 1;
        }
    }
    dist = r + 1;
    for i in (0..count).rev() {
        let idx = start + i * step;
        dist = if src[idx] != 0 { 0 } else { dist + 1 };
        if dist <= r {
            dst[idx] = 1;
        }
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_dilate_mask_box(
    mask_ptr: *const u8,
    out_ptr: *mut u8,
    w: i32,
    h: i32,
    radius: i32,
) -> i32 {
    if mask_ptr.is_null() || out_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let width = w as usize;
    let height = h as usize;
    let total = width * height;
    let mask = unsafe { std::slice::from_raw_parts(mask_ptr, total) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, total) };
    if radius <= 0 {
        out.copy_from_slice(mask);
        return 1;
    }
    let r = radius as usize;
    let mut horiz = vec![0u8; total];
    out.fill(0);
    for y in 0..height {
        scan_dilate_axis_line(mask, &mut horiz, y * width, 1, width, r);
    }
    for x in 0..width {
        scan_dilate_axis_line(&horiz, out, x, width, height, r);
    }
    1
}

/// Pipeline trọn gói tính vùng tách nền ngoài (`computeChromaZone`).
#[unsafe(no_mangle)]
pub extern "C" fn rust_compute_chroma_zone(
    rgba_ptr: *const u8,
    raw_alpha_ptr: *const f32,
    w: i32,
    h: i32,
    key_flags: u32,
    wall: f32,
    solid_cut: f32,
    band: i32,
    zone_out_ptr: *mut u8,
) -> i32 {
    if rgba_ptr.is_null() || raw_alpha_ptr.is_null() || zone_out_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let width = w as usize;
    let height = h as usize;
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, total * 4) };
    let raw_alpha = unsafe { std::slice::from_raw_parts(raw_alpha_ptr, total) };
    let zone = unsafe { std::slice::from_raw_parts_mut(zone_out_ptr, total) };

    let mut blurred: Vec<f32>;
    let eff_alpha: &[f32] = if wall < 0.3 {
        let mut tmp = vec![0.0f32; total];
        blurred = vec![0.0f32; total];
        box_blur3_slice(raw_alpha, &mut tmp, &mut blurred, width, height);
        &blurred
    } else {
        raw_alpha
    };

    let (legacy, is_g, is_b, is_m) = (
        (key_flags & 1) != 0,
        (key_flags & 2) != 0,
        (key_flags & 4) != 0,
        (key_flags & 8) != 0,
    );
    let mut passable = vec![0u8; total];
    let mut soft = vec![0u8; total];
    let mut seed = vec![0u8; total];

    for p in 0..total {
        let idx = p * 4;
        let clear = rgba[idx + 3] < 15;
        if clear || eff_alpha[p] < wall {
            passable[p] = 1;
        }
        if clear || eff_alpha[p] < solid_cut {
            soft[p] = 1;
        }
        let hit = if legacy {
            clear
                || raw_alpha[p] < 0.08
                || (is_g && rgba[idx + 1] as i32 - (rgba[idx] as i32).max(rgba[idx + 2] as i32) >= 42)
                || (is_b && rgba[idx + 2] as i32 - (rgba[idx] as i32).max(rgba[idx + 1] as i32) >= 42)
                || (is_m && (rgba[idx] as i32).min(rgba[idx + 2] as i32) - rgba[idx + 1] as i32 >= 42)
        } else {
            clear
        };
        if hit {
            seed[p] = 1;
        }
    }

    flood_from_border_slice(&passable, Some(&seed), zone, width, height);
    if band > 0 {
        grow_mask_within_slice(zone, &soft, width, height, band as usize);
    }
    for p in 0..total {
        if soft[p] == 0 {
            zone[p] = 1;
        }
    }
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flood_grow_and_dilate() {
        let (w, h) = (5usize, 5usize);
        let mut passable = vec![1u8; w * h];
        for y in 1..=3 {
            for x in 1..=3 {
                if !(x == 2 && y == 2) {
                    passable[y * w + x] = 0;
                }
            }
        }
        let mut out = vec![0u8; w * h];
        assert_eq!(rust_flood_from_border(passable.as_ptr(), std::ptr::null(), out.as_mut_ptr(), 5, 5), 1);
        assert_eq!(out[2 * w + 2], 0);
        assert_eq!(out[0], 1);

        let mut dilated = vec![0u8; w * h];
        let mut center = vec![0u8; w * h];
        center[2 * w + 2] = 1;
        assert_eq!(rust_dilate_mask_box(center.as_ptr(), dilated.as_mut_ptr(), 5, 5, 1), 1);
        assert_eq!(dilated[1 * w + 1], 1);
        assert_eq!(dilated[3 * w + 3], 1);
        assert_eq!(dilated[0], 0);
    }
}
