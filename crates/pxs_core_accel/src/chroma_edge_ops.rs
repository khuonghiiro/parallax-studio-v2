// Tăng tốc xử lý viền Sprite Cutter: thu thập biên, feather/choke Chamfer, defringe/despill & despeckle.

use crate::chroma_matte_unmix::unmix_pixel_rgb_in_place;

fn collect_boundary_into(
    rgba: &[u8],
    width: usize,
    height: usize,
    alpha_snap: &mut [u8],
    exclude: Option<&[u8]>,
) -> Vec<usize> {
    let total = width * height;
    for p in 0..total {
        alpha_snap[p] = rgba[p * 4 + 3];
    }
    let mut boundary = Vec::with_capacity(((width + height) * 16).min(total));
    if width < 3 || height < 3 {
        return boundary;
    }
    for y in 1..(height - 1) {
        let row_off = y * width;
        for x in 1..(width - 1) {
            let p = row_off + x;
            let a = alpha_snap[p];
            if a == 0 || exclude.is_some_and(|ex| ex[p] != 0) {
                continue;
            }
            let near_clear = a < 250
                || alpha_snap[p - 1] < 185
                || alpha_snap[p + 1] < 185
                || alpha_snap[p - width] < 185
                || alpha_snap[p + width] < 185
                || exclude.is_some_and(|ex| {
                    ex[p - 1] != 0 || ex[p + 1] != 0 || ex[p - width] != 0 || ex[p + width] != 0
                });
            if near_clear {
                boundary.push(p);
            }
        }
    }
    boundary
}

/// Thu thập chỉ số pixel viền (`alpha_snap_out_ptr` lưu bản chụp alpha hiện tại).
#[unsafe(no_mangle)]
pub extern "C" fn rust_collect_boundary_indices(
    rgba_ptr: *const u8,
    w: i32,
    h: i32,
    exclude_ptr: *const u8,
    has_exclude: i32,
    alpha_snap_out_ptr: *mut u8,
    out_indices_ptr: *mut i32,
    max_out: i32,
) -> i32 {
    if rgba_ptr.is_null() || alpha_snap_out_ptr.is_null() || out_indices_ptr.is_null() || w <= 0 || h <= 0 || max_out <= 0 {
        return -1;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, total * 4) };
    let alpha_snap = unsafe { std::slice::from_raw_parts_mut(alpha_snap_out_ptr, total) };
    let exclude = if has_exclude != 0 && !exclude_ptr.is_null() {
        Some(unsafe { std::slice::from_raw_parts(exclude_ptr, total) })
    } else {
        None
    };

    let boundary = collect_boundary_into(rgba, width, height, alpha_snap, exclude);
    if boundary.len() > max_out as usize {
        return -(boundary.len() as i32);
    }
    let out = unsafe { std::slice::from_raw_parts_mut(out_indices_ptr, boundary.len()) };
    for (i, &p) in boundary.iter().enumerate() {
        out[i] = p as i32;
    }
    boundary.len() as i32
}

fn chamfer_dist_2pass(alpha_snap: &[u8], width: usize, height: usize, feather_radius: f64) -> Vec<u16> {
    let total = width * height;
    let max_dist3 = ((feather_radius + 2.0) * 3.0).ceil() as u16;
    let mut dist3 = vec![max_dist3; total];
    for p in 0..total {
        if alpha_snap[p] < 16 {
            dist3[p] = 0;
        }
    }
    for y in 0..height {
        let row = y * width;
        for x in 0..width {
            let p = row + x;
            let mut d = dist3[p];
            if d == 0 {
                continue;
            }
            if x > 0 {
                d = d.min(dist3[p - 1] + 3);
            }
            if y > 0 {
                let up = p - width;
                d = d.min(dist3[up] + 3);
                if x > 0 {
                    d = d.min(dist3[up - 1] + 4);
                }
                if x + 1 < width {
                    d = d.min(dist3[up + 1] + 4);
                }
            }
            dist3[p] = d;
        }
    }
    for y in (0..height).rev() {
        let row = y * width;
        for x in (0..width).rev() {
            let p = row + x;
            let mut d = dist3[p];
            if d == 0 {
                continue;
            }
            if x + 1 < width {
                d = d.min(dist3[p + 1] + 3);
            }
            if y + 1 < height {
                let dn = p + width;
                d = d.min(dist3[dn] + 3);
                if x + 1 < width {
                    d = d.min(dist3[dn + 1] + 4);
                }
                if x > 0 {
                    d = d.min(dist3[dn - 1] + 4);
                }
            }
            dist3[p] = d;
        }
    }
    dist3
}

fn smooth_feather_contour_passes(
    rgba: &mut [u8],
    alpha_snap: &mut [u8],
    dist3: &[u16],
    width: usize,
    height: usize,
    feather: f64,
    feather_radius: f64,
    exclude: Option<&[u8]>,
) {
    let total = width * height;
    let passes = if feather >= 8.0 { 2 } else if feather >= 2.0 { 1 } else { 0 };
    let max_band3 = if feather <= 2.0 { 3 } else { ((feather_radius + 1.2) * 3.0).ceil() as u16 };
    for _ in 0..passes {
        for p in 0..total {
            alpha_snap[p] = rgba[p * 4 + 3];
        }
        for y in 1..(height - 1) {
            let row = y * width;
            for x in 1..(width - 1) {
                let p = row + x;
                let d3 = dist3[p];
                if d3 == 0 || d3 > max_band3 || exclude.is_some_and(|ex| ex[p] != 0) {
                    continue;
                }
                let (up, dn) = (p - width, p + width);
                let val = (alpha_snap[p] as u32 * 4
                    + (alpha_snap[p - 1] as u32
                        + alpha_snap[p + 1] as u32
                        + alpha_snap[up] as u32
                        + alpha_snap[dn] as u32)
                        * 2
                    + alpha_snap[up - 1] as u32
                    + alpha_snap[up + 1] as u32
                    + alpha_snap[dn - 1] as u32
                    + alpha_snap[dn + 1] as u32
                    + 8)
                    >> 4;
                rgba[p * 4 + 3] = val as u8;
            }
        }
    }
}

pub(crate) fn apply_smooth_edge_feather_slice(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    feather: f64,
    alpha_snap: &mut [u8],
    exclude: Option<&[u8]>,
) {
    if feather <= 0.0 || width < 3 || height < 3 {
        return;
    }
    let total = width * height;
    for p in 0..total {
        alpha_snap[p] = rgba[p * 4 + 3];
    }
    let feather_radius = if feather <= 2.0 { 0.95 } else { 0.95 + (feather - 2.0) * 0.19 };
    let dist3 = chamfer_dist_2pass(alpha_snap, width, height, feather_radius);
    let inv_r = 1.0 / feather_radius;
    for p in 0..total {
        let orig_a = alpha_snap[p];
        if orig_a == 0 || exclude.is_some_and(|ex| ex[p] != 0) {
            continue;
        }
        let d = (dist3[p] as f64) / 3.0;
        if d <= feather_radius {
            let t = (d * inv_r).clamp(0.0, 1.0);
            let smooth = t * t * (3.0 - 2.0 * t);
            rgba[p * 4 + 3] = orig_a.min(((orig_a as f64) * smooth).round() as u8);
        }
    }
    smooth_feather_contour_passes(rgba, alpha_snap, &dist3, width, height, feather, feather_radius, exclude);
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_smooth_edge_feather(
    rgba_ptr: *mut u8,
    w: i32,
    h: i32,
    feather: f32,
    alpha_snap_ptr: *mut u8,
    exclude_ptr: *const u8,
    has_exclude: i32,
) -> i32 {
    if rgba_ptr.is_null() || alpha_snap_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let alpha_snap = unsafe { std::slice::from_raw_parts_mut(alpha_snap_ptr, total) };
    let exclude = if has_exclude != 0 && !exclude_ptr.is_null() {
        Some(unsafe { std::slice::from_raw_parts(exclude_ptr, total) })
    } else {
        None
    };
    apply_smooth_edge_feather_slice(rgba, width, height, feather as f64, alpha_snap, exclude);
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_feather_and_choke(
    rgba_ptr: *mut u8,
    w: i32,
    h: i32,
    feather: f32,
    edge_choke: f32,
    alpha_snap_ptr: *mut u8,
    exclude_ptr: *const u8,
    has_exclude: i32,
) -> i32 {
    if rgba_ptr.is_null() || alpha_snap_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let alpha_snap = unsafe { std::slice::from_raw_parts_mut(alpha_snap_ptr, total) };
    let exclude = if has_exclude != 0 && !exclude_ptr.is_null() {
        Some(unsafe { std::slice::from_raw_parts(exclude_ptr, total) })
    } else {
        None
    };

    if edge_choke > 0.0 {
        let choke_steps = 8.min(edge_choke.round() as i32);
        for _ in 0..choke_steps {
            let boundary = collect_boundary_into(rgba, width, height, alpha_snap, exclude);
            for p in boundary {
                if alpha_snap[p - 1] < 20
                    || alpha_snap[p + 1] < 20
                    || alpha_snap[p - width] < 20
                    || alpha_snap[p + width] < 20
                {
                    rgba[p * 4 + 3] = 0;
                } else if alpha_snap[p - width - 1] < 20
                    || alpha_snap[p - width + 1] < 20
                    || alpha_snap[p + width - 1] < 20
                    || alpha_snap[p + width + 1] < 20
                {
                    rgba[p * 4 + 3] = ((alpha_snap[p] as f64) * 0.35).round() as u8;
                }
            }
        }
    }
    if feather > 0.0 {
        apply_smooth_edge_feather_slice(rgba, width, height, feather as f64, alpha_snap, exclude);
    }
    1
}

#[inline(always)]
fn clamp_pixel_fringe_spill(
    rgba: &mut [u8],
    idx: usize,
    strength: f64,
    is_green_fringe: bool,
    is_blue_fringe: bool,
) -> u8 {
    let mut a = rgba[idx + 3];
    let (r, g, b) = (rgba[idx] as f64, rgba[idx + 1] as f64, rgba[idx + 2] as f64);
    if is_green_fringe {
        let rb_max = r.max(b);
        let rb_avg = (r + b) * 0.5;
        if g > rb_avg {
            let target_g = rb_max * (1.0 - strength * 0.45) + rb_avg * (strength * 0.45);
            rgba[idx + 1] = (g - (g - target_g) * (strength * 1.3).min(1.0)).round() as u8;
            let spill = rgba[idx + 1] as f64 - rb_max;
            if spill > 10.0 {
                a = (a as f64 - spill * strength * 1.6).round().max(0.0) as u8;
                rgba[idx + 3] = a;
            }
        }
    } else if is_blue_fringe {
        let rg_max = r.max(g);
        let rg_avg = (r + g) * 0.5;
        if b > rg_avg {
            let target_b = rg_max * (1.0 - strength * 0.45) + rg_avg * (strength * 0.45);
            rgba[idx + 2] = (b - (b - target_b) * (strength * 1.3).min(1.0)).round() as u8;
            let spill = rgba[idx + 2] as f64 - rg_max;
            if spill > 10.0 {
                a = (a as f64 - spill * strength * 1.6).round().max(0.0) as u8;
                rgba[idx + 3] = a;
            }
        }
    }
    a
}

#[inline(always)]
fn pull_interior_color(
    rgba: &mut [u8],
    alpha_snap: &[u8],
    width: usize,
    height: usize,
    p: usize,
    strength: f64,
    fringe: (f64, f64, f64),
    max_fringe_dist_sq: f64,
) {
    let idx = p * 4;
    let (r, g, b, a) = (rgba[idx] as f64, rgba[idx + 1] as f64, rgba[idx + 2] as f64, rgba[idx + 3] as f64);
    let (dr, dg, db) = (r - fringe.0, g - fringe.1, b - fringe.2);
    let dist_sq = dr * dr + dg * dg + db * db;
    if dist_sq >= max_fringe_dist_sq {
        return;
    }
    let (cx, cy) = (p % width, p / width);
    let (mut best_r, mut best_g, mut best_b, mut best_score) = (r, g, b, dist_sq);
    for ny in cy.saturating_sub(3)..=(height - 1).min(cy + 3) {
        let row = ny * width;
        for nx in cx.saturating_sub(3)..=(width - 1).min(cx + 3) {
            let np = row + nx;
            if alpha_snap[np] < 215 {
                continue;
            }
            let ni = np * 4;
            let (nr, ng, nb) = (rgba[ni] as f64, rgba[ni + 1] as f64, rgba[ni + 2] as f64);
            let nd_sq = (nr - fringe.0).powi(2) + (ng - fringe.1).powi(2) + (nb - fringe.2).powi(2);
            if nd_sq > best_score {
                best_score = nd_sq;
                best_r = nr;
                best_g = ng;
                best_b = nb;
            }
        }
    }
    let closeness = 1.0 - (dist_sq / max_fringe_dist_sq).sqrt();
    let pull = (closeness * strength * 1.35).min(1.0);
    if best_score > dist_sq + 200.0 {
        rgba[idx] = (r + (best_r - r) * pull).round() as u8;
        rgba[idx + 1] = (g + (best_g - g) * pull).round() as u8;
        rgba[idx + 2] = (b + (best_b - b) * pull).round() as u8;
    }
    if closeness > 0.45 {
        rgba[idx + 3] = (a * (1.0 - closeness * strength * 1.15).max(0.0)).round() as u8;
    }
}

/// Khử viền & khử ám màu mép (`applyDefringeAndDespill`).
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_defringe_and_despill(
    rgba_ptr: *mut u8,
    w: i32,
    h: i32,
    params_ptr: *const f32,
    flags: u32,
    alpha_snap_ptr: *mut u8,
    exclude_ptr: *const u8,
    has_exclude: i32,
    raw_alpha_ptr: *const f32,
    is_light_ptr: *const u8,
    has_analysis: i32,
    zone_ptr: *const u8,
    has_zone: i32,
) -> i32 {
    if rgba_ptr.is_null() || params_ptr.is_null() || alpha_snap_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let params = unsafe { std::slice::from_raw_parts(params_ptr, 7) };
    let alpha_snap = unsafe { std::slice::from_raw_parts_mut(alpha_snap_ptr, total) };
    let exclude = (has_exclude != 0 && !exclude_ptr.is_null())
        .then(|| unsafe { std::slice::from_raw_parts(exclude_ptr, total) });
    let analysis = (has_analysis != 0 && !raw_alpha_ptr.is_null() && !is_light_ptr.is_null())
        .then(|| unsafe {
            (
                std::slice::from_raw_parts(raw_alpha_ptr, total),
                std::slice::from_raw_parts(is_light_ptr, total),
            )
        });
    let zone = (has_zone != 0 && !zone_ptr.is_null())
        .then(|| unsafe { std::slice::from_raw_parts(zone_ptr, total) });

    let (strength, fringe, key) = (
        params[0] as f64,
        (params[1] as f64, params[2] as f64, params[3] as f64),
        (params[4] as f64, params[5] as f64, params[6] as f64),
    );
    let (is_gf, is_bf, is_gk, is_bk, is_mk) = (
        (flags & 1) != 0,
        (flags & 2) != 0,
        (flags & 4) != 0,
        (flags & 8) != 0,
        (flags & 16) != 0,
    );
    let is_chrom = is_gk || is_bk || is_mk;
    let max_fringe_dist_sq = (55.0 + strength * 175.0).powi(2);

    for p in collect_boundary_into(rgba, width, height, alpha_snap, exclude) {
        if zone.is_some_and(|z| z[p] == 0) {
            continue;
        }
        let idx = p * 4;
        let a = rgba[idx + 3];
        if a == 0 {
            continue;
        }
        if let Some((raw_a, is_l)) = analysis {
            let ra = raw_a[p] as f64;
            if ra < 0.96 && (is_chrom || a < 250) {
                unmix_pixel_rgb_in_place(
                    rgba, idx, key.0, key.1, key.2, ra, is_l[p] == 1, is_gk, is_bk, is_mk, a as f64 / 255.0,
                );
            }
        }
        if clamp_pixel_fringe_spill(rgba, idx, strength, is_gf, is_bf) > 0 {
            pull_interior_color(rgba, alpha_snap, width, height, p, strength, fringe, max_fringe_dist_sq);
        }
    }
    1
}

fn filter_despeckle_islands(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    despeckle_size: i32,
    keep_largest: bool,
    has_exclude: bool,
) {
    let total = width * height;
    let min_alpha = if has_exclude { 10u8 } else { 20u8 };
    let mut visited = vec![0u8; total];
    let mut queue = Vec::with_capacity(total);
    let mut meta: Vec<(usize, usize, usize)> = Vec::new();
    let (mut max_len, mut max_idx) = (0usize, usize::MAX);

    for p in 0..total {
        if visited[p] != 0 || rgba[p * 4 + 3] <= min_alpha {
            continue;
        }
        let s = queue.len();
        let mut head = s;
        queue.push(p);
        visited[p] = 1;
        let mut dark_count = 0usize;
        while head < queue.len() {
            let curr = queue[head];
            head += 1;
            let ci = curr * 4;
            let lum = rgba[ci] as f64 * 0.299 + rgba[ci + 1] as f64 * 0.587 + rgba[ci + 2] as f64 * 0.114;
            if lum < 95.0 && rgba[ci + 3] > 90 {
                dark_count += 1;
            }
            let cx = curr % width;
            let nbs = [
                (cx > 0).then(|| curr - 1),
                (cx + 1 < width).then(|| curr + 1),
                (curr >= width).then(|| curr - width),
                (curr + width < total).then(|| curr + width),
            ];
            for nb in nbs.into_iter().flatten() {
                if visited[nb] == 0 && rgba[nb * 4 + 3] > min_alpha {
                    visited[nb] = 1;
                    queue.push(nb);
                }
            }
        }
        let len = queue.len() - s;
        let i_idx = meta.len();
        meta.push((s, queue.len(), dark_count));
        if len > max_len {
            max_len = len;
            max_idx = i_idx;
        }
    }

    let min_area = (despeckle_size.max(0) as usize) * 4;
    let allow_shadow = !has_exclude || total >= 4096;
    for (i, &(s, e, dark)) in meta.iter().enumerate() {
        let len = e - s;
        let drop_small = despeckle_size > 0
            && len <= min_area
            && allow_shadow
            && dark < 3usize.max(((len as f64) * 0.25) as usize);
        if (keep_largest && i != max_idx) || drop_small {
            for &px in &queue[s..e] {
                rgba[px * 4 + 3] = 0;
            }
        }
    }
}

/// Lọc vụn trắng sát biên & xoá đảo rác (`applyDespeckleAndWhiteCrumbs`).
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_despeckle_and_crumbs(
    rgba_ptr: *mut u8,
    w: i32,
    h: i32,
    white_sens: f32,
    despeckle_size: i32,
    keep_largest: i32,
    alpha_snap_ptr: *mut u8,
    exclude_ptr: *const u8,
    has_exclude: i32,
) -> i32 {
    if rgba_ptr.is_null() || alpha_snap_ptr.is_null() || w <= 0 || h <= 0 {
        return 0;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let alpha_snap = unsafe { std::slice::from_raw_parts_mut(alpha_snap_ptr, total) };
    let exclude = (has_exclude != 0 && !exclude_ptr.is_null())
        .then(|| unsafe { std::slice::from_raw_parts(exclude_ptr, total) });

    if white_sens > 0.0 {
        let sens = (white_sens as f64) / 100.0;
        let min_lum = 105.0f64.max(235.0 - sens * 115.0);
        let max_spread = 16.0 + sens * 58.0;
        for p in collect_boundary_into(rgba, width, height, alpha_snap, exclude) {
            let idx = p * 4;
            let (r, g, b) = (rgba[idx] as f64, rgba[idx + 1] as f64, rgba[idx + 2] as f64);
            let lum = r * 0.299 + g * 0.587 + b * 0.114;
            if lum >= 85.0 && lum >= min_lum && (r.max(g).max(b) - r.min(g).min(b)) <= max_spread {
                rgba[idx + 3] = 0;
            }
        }
    }

    if despeckle_size > 0 || keep_largest != 0 {
        filter_despeckle_islands(rgba, width, height, despeckle_size, keep_largest != 0, exclude.is_some());
    }
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_feather_and_despeckle() {
        let (w, h) = (8i32, 8i32);
        let mut rgba = vec![0u8; (w * h * 4) as usize];
        for y in 2..=5 {
            for x in 2..=5 {
                let i = ((y * w + x) * 4) as usize;
                rgba[i] = 200;
                rgba[i + 1] = 200;
                rgba[i + 2] = 200;
                rgba[i + 3] = 255;
            }
        }
        rgba[3] = 255;
        rgba[0] = 240;
        rgba[1] = 240;
        rgba[2] = 240;
        let mut snap = vec![0u8; (w * h) as usize];
        assert_eq!(
            rust_apply_despeckle_and_crumbs(rgba.as_mut_ptr(), w, h, 0.0, 1, 0, snap.as_mut_ptr(), std::ptr::null(), 0),
            1
        );
        assert_eq!(rgba[3], 0);
        assert_eq!(rgba[((3 * w + 3) * 4 + 3) as usize], 255);
    }
}
