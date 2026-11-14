// Tăng tốc khử giao thoa đảo pixel, quét contour Loop & quét đảo Sprite Cutter.

#[derive(Clone, Copy)]
struct SiblingMeta {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    cx: f64,
    cy: f64,
    hw: f64,
    hh: f64,
    local_min_x: usize,
    local_min_y: usize,
    local_max_x: usize,
    local_max_y: usize,
}

fn collect_overlapping_siblings(
    sibs: &[f32],
    box_x: f64,
    box_y: f64,
    box_w: f64,
    box_h: f64,
    w: usize,
    h: usize,
) -> Vec<SiblingMeta> {
    let mut out = Vec::new();
    for chunk in sibs.chunks_exact(4) {
        let (sx, sy, sw, sh) = (chunk[0] as f64, chunk[1] as f64, chunk[2] as f64, chunk[3] as f64);
        if sw <= 0.0 || sh <= 0.0 {
            continue;
        }
        if !(box_x < sx + sw && box_x + box_w > sx && box_y < sy + sh && box_y + box_h > sy) {
            continue;
        }
        out.push(SiblingMeta {
            x: sx,
            y: sy,
            w: sw,
            h: sh,
            cx: sx + sw * 0.5,
            cy: sy + sh * 0.5,
            hw: (sw * 0.5).max(1.0),
            hh: (sh * 0.5).max(1.0),
            local_min_x: (sx - box_x).floor().max(0.0) as usize,
            local_min_y: (sy - box_y).floor().max(0.0) as usize,
            local_max_x: ((sx + sw - box_x).ceil().min((w - 1) as f64)).max(0.0) as usize,
            local_max_y: ((sy + sh - box_y).ceil().min((h - 1) as f64)).max(0.0) as usize,
        });
    }
    out
}

fn min_sibling_norm_dist(gx: f64, gy: f64, sib_meta: &[SiblingMeta]) -> f64 {
    let mut min_d = f64::INFINITY;
    for meta in sib_meta {
        if gx >= meta.x && gx < meta.x + meta.w && gy >= meta.y && gy < meta.y + meta.h {
            let d = ((gx - meta.cx) / meta.hw).hypot((gy - meta.cy) / meta.hh);
            if d < min_d {
                min_d = d;
            }
        }
    }
    min_d
}

fn classify_contested_pixels(
    rgba: &[u8],
    width: usize,
    height: usize,
    bx: f64,
    by: f64,
    alpha_thresh: u8,
    sib_meta: &[SiblingMeta],
) -> (Vec<u8>, usize) {
    let mut state = vec![0u8; width * height];
    let mut contested = 0usize;
    for y in 0..height {
        let gy = by + y as f64;
        let row_off = y * width;
        for x in 0..width {
            let idx = row_off + x;
            if rgba[idx * 4 + 3] < alpha_thresh {
                continue;
            }
            let gx = bx + x as f64;
            let in_sib = sib_meta.iter().any(|m| {
                x >= m.local_min_x
                    && x <= m.local_max_x
                    && y >= m.local_min_y
                    && y <= m.local_max_y
                    && gx >= m.x
                    && gx < m.x + m.w
                    && gy >= m.y
                    && gy < m.y + m.h
            });
            if in_sib {
                state[idx] = 2;
                contested += 1;
            } else {
                state[idx] = 1;
            }
        }
    }
    (state, contested)
}

fn bfs_disambig_component(
    start: usize,
    width: usize,
    height: usize,
    pixel_state: &[u8],
    visited: &mut [u8],
    queue: &mut Vec<usize>,
) -> bool {
    queue.clear();
    queue.push(start);
    visited[start] = 1;
    let mut head = 0usize;
    let mut has_core = false;
    while head < queue.len() {
        let curr = queue[head];
        head += 1;
        if pixel_state[curr] == 1 {
            has_core = true;
        }
        let cx = curr % width;
        let cy = curr / width;
        if cy > 0 && visited[curr - width] == 0 && pixel_state[curr - width] > 0 {
            visited[curr - width] = 1;
            queue.push(curr - width);
        }
        if cy + 1 < height && visited[curr + width] == 0 && pixel_state[curr + width] > 0 {
            visited[curr + width] = 1;
            queue.push(curr + width);
        }
        if cx > 0 && visited[curr - 1] == 0 && pixel_state[curr - 1] > 0 {
            visited[curr - 1] = 1;
            queue.push(curr - 1);
        }
        if cx + 1 < width && visited[curr + 1] == 0 && pixel_state[curr + 1] > 0 {
            visited[curr + 1] = 1;
            queue.push(curr + 1);
        }
    }
    has_core
}

fn evaluate_disambig_component(
    rgba: &mut [u8],
    queue: &[usize],
    pixel_state: &[u8],
    has_core: bool,
    width: usize,
    target: (f64, f64, f64, f64, f64, f64),
    pref: f64,
    sib_meta: &[SiblingMeta],
) -> bool {
    let (bx, by, tcx, tcy, thw, thh) = target;
    let mut modified = false;
    if has_core {
        for &p in queue {
            if pixel_state[p] == 2 {
                let (gx, gy) = (bx + (p % width) as f64, by + (p / width) as f64);
                let d_t = ((gx - tcx) / thw).hypot((gy - tcy) / thh);
                if min_sibling_norm_dist(gx, gy, sib_meta) < d_t * 0.75 {
                    rgba[p * 4 + 3] = 0;
                    modified = true;
                }
            }
        }
        return modified;
    }

    let (mut votes_sib, mut votes_target) = (0usize, 0usize);
    for &p in queue {
        let (gx, gy) = (bx + (p % width) as f64, by + (p / width) as f64);
        let d_t = ((gx - tcx) / thw).hypot((gy - tcy) / thh);
        if min_sibling_norm_dist(gx, gy, sib_meta) < d_t * pref {
            votes_sib += 1;
        } else {
            votes_target += 1;
        }
    }
    if votes_sib >= votes_target {
        for &p in queue {
            rgba[p * 4 + 3] = 0;
        }
        return true;
    }
    for &p in queue {
        if pixel_state[p] == 2 {
            let (gx, gy) = (bx + (p % width) as f64, by + (p / width) as f64);
            let d_t = ((gx - tcx) / thw).hypot((gy - tcy) / thh);
            if min_sibling_norm_dist(gx, gy, sib_meta) < d_t * 0.8 {
                rgba[p * 4 + 3] = 0;
                modified = true;
            }
        }
    }
    modified
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_disambiguate_region_pixels(
    rgba_ptr: *mut u8,
    w: i32,
    h: i32,
    box_x: f32,
    box_y: f32,
    box_w: f32,
    box_h: f32,
    sibs_ptr: *const f32,
    sib_count: i32,
    alpha_threshold: u8,
    target_pref: f32,
) -> i32 {
    if rgba_ptr.is_null() || w <= 0 || h <= 0 || sib_count <= 0 || sibs_ptr.is_null() {
        return if rgba_ptr.is_null() || w <= 0 || h <= 0 { -1 } else { 0 };
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let sibs = unsafe { std::slice::from_raw_parts(sibs_ptr, (sib_count as usize) * 4) };
    let (bx, by, bw, bh) = (box_x as f64, box_y as f64, box_w as f64, box_h as f64);
    let sib_meta = collect_overlapping_siblings(sibs, bx, by, bw, bh, width, height);
    if sib_meta.is_empty() {
        return 0;
    }

    let (pixel_state, contested_count) =
        classify_contested_pixels(rgba, width, height, bx, by, alpha_threshold, &sib_meta);
    if contested_count == 0 {
        return 0;
    }

    let target = (bx, by, bx + bw * 0.5, by + bh * 0.5, (bw * 0.5).max(1.0), (bh * 0.5).max(1.0));
    let pref = target_pref as f64;
    let mut visited = vec![0u8; total];
    let mut queue = Vec::with_capacity(contested_count.max(64));
    let mut modified = false;

    for start in 0..total {
        if visited[start] != 0 || pixel_state[start] == 0 {
            continue;
        }
        let has_core = bfs_disambig_component(start, width, height, &pixel_state, &mut visited, &mut queue);
        if evaluate_disambig_component(rgba, &queue, &pixel_state, has_core, width, target, pref, &sib_meta) {
            modified = true;
        }
    }
    if modified { 1 } else { 0 }
}

fn bfs_contour_box(
    start_gx: usize,
    start_gy: usize,
    width: usize,
    height: usize,
    step: usize,
    gw: usize,
    gh: usize,
    rgba: &[u8],
    alpha_thresh: u8,
    visited: &mut [u8],
    queue: &mut Vec<(usize, usize)>,
) -> [i32; 4] {
    queue.clear();
    queue.push((start_gx, start_gy));
    visited[start_gy * gw + start_gx] = 1;
    let px0 = (width - 1).min(start_gx * step);
    let py0 = (height - 1).min(start_gy * step);
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (
        px0 as i32,
        py0 as i32,
        (px0 + step) as i32,
        (py0 + step) as i32,
    );
    let mut head = 0usize;
    while head < queue.len() {
        let (cx, cy) = queue[head];
        head += 1;
        let rx = (width - 1).min(cx * step) as i32;
        let ry = (height - 1).min(cy * step) as i32;
        min_x = min_x.min(rx);
        min_y = min_y.min(ry);
        max_x = max_x.max((width as i32).min(rx + step as i32));
        max_y = max_y.max((height as i32).min(ry + step as i32));
        for ny in cy.saturating_sub(1)..=(cy + 1).min(gh - 1) {
            for nx in cx.saturating_sub(1)..=(cx + 1).min(gw - 1) {
                if nx == cx && ny == cy {
                    continue;
                }
                let n_idx = ny * gw + nx;
                if visited[n_idx] != 0 {
                    continue;
                }
                visited[n_idx] = 1;
                let npx = (width - 1).min(nx * step);
                let npy = (height - 1).min(ny * step);
                if rgba[(npy * width + npx) * 4 + 3] >= alpha_thresh {
                    queue.push((nx, ny));
                }
            }
        }
    }
    [min_x, min_y, max_x, max_y]
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_scan_contour_flood_boxes(
    rgba_ptr: *const u8,
    w: i32,
    h: i32,
    alpha_thresh: u8,
    out_boxes_ptr: *mut i32,
    max_boxes: i32,
) -> i32 {
    if rgba_ptr.is_null() || out_boxes_ptr.is_null() || w <= 0 || h <= 0 || max_boxes <= 0 {
        return -1;
    }
    let (width, height) = (w as usize, h as usize);
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, width * height * 4) };
    let step = if width > 512 || height > 512 { 2 } else { 1 };
    let (gw, gh) = ((width + step - 1) / step, (height + step - 1) / step);
    let mut visited = vec![0u8; gw * gh];
    let mut queue = Vec::with_capacity(256);
    let mut boxes = Vec::new();

    for gy in 0..gh {
        for gx in 0..gw {
            let idx = gy * gw + gx;
            if visited[idx] != 0 {
                continue;
            }
            let px = (width - 1).min(gx * step);
            let py = (height - 1).min(gy * step);
            if rgba[(py * width + px) * 4 + 3] < alpha_thresh {
                visited[idx] = 1;
                continue;
            }
            boxes.push(bfs_contour_box(
                gx, gy, width, height, step, gw, gh, rgba, alpha_thresh, &mut visited, &mut queue,
            ));
        }
    }
    if boxes.len() > max_boxes as usize {
        return -(boxes.len() as i32);
    }
    let out = unsafe { std::slice::from_raw_parts_mut(out_boxes_ptr, boxes.len() * 4) };
    for (i, b) in boxes.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(b);
    }
    boxes.len() as i32
}

fn bfs_raw_island(
    start: usize,
    sx: usize,
    sy: usize,
    width: usize,
    height: usize,
    rgba: &[u8],
    visited: &mut [u8],
    queue: &mut Vec<usize>,
) -> (usize, usize, usize, usize, usize) {
    let (mut min_x, mut max_x, mut min_y, mut max_y) = (sx, sx, sy, sy);
    queue.clear();
    queue.push(start);
    visited[start] = 1;
    let mut head = 0usize;
    while head < queue.len() {
        let curr = queue[head];
        head += 1;
        let (cx, cy) = (curr % width, curr / width);
        min_x = min_x.min(cx);
        max_x = max_x.max(cx);
        min_y = min_y.min(cy);
        max_y = max_y.max(cy);
        if cy > 0 && visited[curr - width] == 0 && rgba[(curr - width) * 4 + 3] >= 12 {
            visited[curr - width] = 1;
            queue.push(curr - width);
        }
        if cy + 1 < height && visited[curr + width] == 0 && rgba[(curr + width) * 4 + 3] >= 12 {
            visited[curr + width] = 1;
            queue.push(curr + width);
        }
        if cx > 0 && visited[curr - 1] == 0 && rgba[(curr - 1) * 4 + 3] >= 12 {
            visited[curr - 1] = 1;
            queue.push(curr - 1);
        }
        if cx + 1 < width && visited[curr + 1] == 0 && rgba[(curr + 1) * 4 + 3] >= 12 {
            visited[curr + 1] = 1;
            queue.push(curr + 1);
        }
    }
    (min_x, max_x, min_y, max_y, queue.len())
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_scan_raw_islands(
    rgba_ptr: *const u8,
    w: i32,
    h: i32,
    coord_scale: f32,
    out_i32_ptr: *mut i32,
    max_islands: i32,
) -> i32 {
    if rgba_ptr.is_null() || out_i32_ptr.is_null() || w <= 0 || h <= 0 || max_islands <= 0 {
        return -1;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, total * 4) };
    let mut visited = vec![0u8; total];
    let mut queue = Vec::with_capacity(256);
    let mut islands = Vec::new();
    let out_scale = if coord_scale > 0.0 { coord_scale as f64 } else { 1.0 };
    let area_scale = out_scale * out_scale;

    for sy in (0..height).step_by(2) {
        let row_off = sy * width;
        for sx in (0..width).step_by(2) {
            let idx = row_off + sx;
            if visited[idx] != 0 || rgba[idx * 4 + 3] < 12 {
                continue;
            }
            let (min_x, max_x, min_y, max_y, area) =
                bfs_raw_island(idx, sx, sy, width, height, rgba, &mut visited, &mut queue);
            if area >= 2 {
                let (px0, py0) = (min_x.saturating_sub(2), min_y.saturating_sub(2));
                let (px1, py1) = ((width - 1).min(max_x + 2), (height - 1).min(max_y + 2));
                islands.push([
                    (px0 as f64 * out_scale).round() as i32,
                    (py0 as f64 * out_scale).round() as i32,
                    4.max(((px1 - px0 + 1) as f64 * out_scale).round() as i32),
                    4.max(((py1 - py0 + 1) as f64 * out_scale).round() as i32),
                    (area as f64 * area_scale).round() as i32,
                ]);
            }
        }
    }
    if islands.len() > max_islands as usize {
        return -(islands.len() as i32);
    }
    let out = unsafe { std::slice::from_raw_parts_mut(out_i32_ptr, islands.len() * 5) };
    for (i, isl) in islands.iter().enumerate() {
        out[i * 5..i * 5 + 5].copy_from_slice(isl);
    }
    islands.len() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_contour_and_raw_islands() {
        let (w, h) = (20i32, 20i32);
        let mut rgba = vec![0u8; (w * h * 4) as usize];
        for y in 2..=6 {
            for x in 2..=6 {
                rgba[((y * w + x) * 4 + 3) as usize] = 255;
            }
        }
        for y in 12..=16 {
            for x in 12..=16 {
                rgba[((y * w + x) * 4 + 3) as usize] = 255;
            }
        }
        let mut cboxes = vec![0i32; 32];
        assert_eq!(rust_scan_contour_flood_boxes(rgba.as_ptr(), w, h, 24, cboxes.as_mut_ptr(), 8), 2);
        let mut islands = vec![0i32; 40];
        assert_eq!(rust_scan_raw_islands(rgba.as_ptr(), w, h, 2.0, islands.as_mut_ptr(), 8), 2);
        assert_eq!(islands[0], 0);
        assert_eq!(islands[4], 25 * 4);
    }
}
