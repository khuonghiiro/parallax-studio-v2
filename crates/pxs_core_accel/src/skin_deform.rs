use std::f64::consts::PI;

#[inline]
fn apply_sagitta_compensation(
    x: &mut f64,
    y: &mut f64,
    wx: f64,
    wy: f64,
    p0x: f64,
    p0y: f64,
    p1x: f64,
    p1y: f64,
    w0: f64,
    w1: f64,
    b1: &[f32],
    rot0: f64,
) {
    let mut d_rot = (b1[8] as f64 - rot0) % 360.0;
    if d_rot > 180.0 {
        d_rot -= 360.0;
    }
    if d_rot < -180.0 {
        d_rot += 360.0;
    }
    let abs_d_rot = d_rot.abs();
    if abs_d_rot <= 0.5 || abs_d_rot >= 179.0 {
        return;
    }
    let dx = p1x - p0x;
    let dy = p1y - p0y;
    let dist = dx.hypot(dy);
    if dist <= 0.5 {
        return;
    }
    let rest_radius = (wx - b1[0] as f64).hypot(wy - b1[1] as f64);
    let cur_radius = (*x - b1[2] as f64).hypot(*y - b1[3] as f64);
    if cur_radius < rest_radius && rest_radius > 1.0 {
        let max_deficit = rest_radius - cur_radius;
        let rad_quarter = (abs_d_rot * PI) / 720.0;
        let h = max_deficit.min(0.5 * dist * rad_quarter.tan());
        let sign = if d_rot > 0.0 { 1.0 } else { -1.0 };
        let nx = (sign * dy) / dist;
        let ny = (-sign * dx) / dist;
        let blend = (4.0 * w0 * w1) / (w0 + w1);
        *x += blend * h * nx;
        *y += blend * h * ny;
    }
}

#[inline]
fn transform_bone_point(wx: f64, wy: f64, b: &[f32]) -> (f64, f64) {
    let dx_rel = (wx - b[0] as f64) * b[6] as f64;
    let dy_rel = (wy - b[1] as f64) * b[7] as f64;
    let c = b[4] as f64;
    let s = b[5] as f64;
    (
        b[2] as f64 + (dx_rel * c - dy_rel * s),
        b[3] as f64 + (dx_rel * s + dy_rel * c),
    )
}

#[allow(clippy::too_many_arguments)]
pub fn deform_skin_slice(
    positions: &[f32],
    out: &mut [f32],
    v_count: usize,
    packed_indices: &[i32],
    packed_weights: &[f32],
    bones_tf: &[f32],
    bone_count: usize,
    meta: &[f32],
    primary_bone_idx: i32,
    cloth_factor: f32,
) {
    let (sx, sy) = (meta[0] as f64, meta[1] as f64);
    let (rest_bx, rest_by) = (meta[2] as f64, meta[3] as f64);
    let (rest_cos, rest_sin) = (meta[4] as f64, meta[5] as f64);
    let (cur_bx, cur_by) = (meta[6] as f64, meta[7] as f64);
    let (inv_cos, inv_sin) = (meta[8] as f64, meta[9] as f64);
    let (inv_sx, inv_sy) = (meta[10] as f64, meta[11] as f64);
    let cf = cloth_factor as f64;
    let has_primary = cf < 0.999 && primary_bone_idx >= 0 && (primary_bone_idx as usize) < bone_count;

    for i in 0..v_count {
        let i3 = i * 3;
        let i4 = i * 4;
        let (px0, py0, pz0) = (positions[i3], positions[i3 + 1], positions[i3 + 2]);
        let px = px0 as f64 * sx;
        let py = -(py0 as f64) * sy;
        let wx = px * rest_cos - py * rest_sin + rest_bx;
        let wy = px * rest_sin + py * rest_cos + rest_by;

        let (prim_x, prim_y) = if has_primary {
            let pb = &bones_tf[(primary_bone_idx as usize) * 9..(primary_bone_idx as usize) * 9 + 9];
            transform_bone_point(wx, wy, pb)
        } else {
            (wx, wy)
        };

        let (mut x, mut y, mut total_w) = (0.0_f64, 0.0_f64, 0.0_f64);
        let (mut p0x, mut p0y, mut p1x, mut p1y) = (0.0, 0.0, 0.0, 0.0);
        let (mut b0_idx, mut b1_idx, mut w0, mut w1) = (-1isize, -1isize, 0.0_f64, 0.0_f64);
        let mut active_slot = 0usize;

        for s in 0..4 {
            let bi = packed_indices[i4 + s];
            if bi < 0 || (bi as usize) >= bone_count {
                continue;
            }
            let b = &bones_tf[(bi as usize) * 9..(bi as usize) * 9 + 9];
            let (mut pt_x, mut pt_y) = transform_bone_point(wx, wy, b);
            if has_primary && bi != primary_bone_idx {
                pt_x = prim_x + (pt_x - prim_x) * cf;
                pt_y = prim_y + (pt_y - prim_y) * cf;
            }
            let w = packed_weights[i4 + s] as f64;
            x += pt_x * w;
            y += pt_y * w;
            total_w += w;
            if active_slot == 0 {
                (p0x, p0y, b0_idx, w0) = (pt_x, pt_y, bi as isize, w);
            } else if active_slot == 1 {
                (p1x, p1y, b1_idx, w1) = (pt_x, pt_y, bi as isize, w);
            }
            active_slot += 1;
        }

        if total_w <= 1e-6 {
            out[i3] = px0;
            out[i3 + 1] = py0;
            out[i3 + 2] = pz0;
            continue;
        }
        if total_w < 0.9999 {
            x += wx * (1.0 - total_w);
            y += wy * (1.0 - total_w);
        } else {
            if total_w < 1.0 {
                x += wx * (1.0 - total_w);
                y += wy * (1.0 - total_w);
            }
            if b0_idx >= 0 && b1_idx >= 0 && w1 > 1e-4 {
                let b0 = &bones_tf[(b0_idx as usize) * 9..(b0_idx as usize) * 9 + 9];
                let b1 = &bones_tf[(b1_idx as usize) * 9..(b1_idx as usize) * 9 + 9];
                apply_sagitta_compensation(
                    &mut x, &mut y, wx, wy, p0x, p0y, p1x, p1y, w0, w1, b1, b0[8] as f64,
                );
            }
        }
        let dx = x - cur_bx;
        let dy = y - cur_by;
        out[i3] = ((dx * inv_cos - dy * inv_sin) * inv_sx) as f32;
        out[i3 + 1] = -(((dx * inv_sin + dy * inv_cos) * inv_sy) as f32);
        out[i3 + 2] = pz0;
    }
}

/// Biến dạng lưới theo xương 2D/2.5D với Linear Blend Skinning + bù trừ thể tích Sagitta.
#[unsafe(no_mangle)]
pub extern "C" fn rust_deform_skin(
    positions_ptr: *const f32,
    out_ptr: *mut f32,
    v_count: usize,
    packed_indices_ptr: *const i32,
    packed_weights_ptr: *const f32,
    bones_tf_ptr: *const f32,
    bone_count: usize,
    binding_meta_ptr: *const f32,
    primary_bone_idx: i32,
    cloth_factor: f32,
) -> bool {
    if positions_ptr.is_null()
        || out_ptr.is_null()
        || packed_indices_ptr.is_null()
        || packed_weights_ptr.is_null()
        || bones_tf_ptr.is_null()
        || binding_meta_ptr.is_null()
        || v_count == 0
        || bone_count == 0
    {
        return false;
    }
    let positions = unsafe { std::slice::from_raw_parts(positions_ptr, v_count * 3) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, v_count * 3) };
    let packed_indices = unsafe { std::slice::from_raw_parts(packed_indices_ptr, v_count * 4) };
    let packed_weights = unsafe { std::slice::from_raw_parts(packed_weights_ptr, v_count * 4) };
    let bones_tf = unsafe { std::slice::from_raw_parts(bones_tf_ptr, bone_count * 9) };
    let meta = unsafe { std::slice::from_raw_parts(binding_meta_ptr, 12) };
    deform_skin_slice(
        positions, out, v_count, packed_indices, packed_weights,
        bones_tf, bone_count, meta, primary_bone_idx, cloth_factor,
    );
    true
}

#[allow(clippy::too_many_arguments)]
pub fn deform_plant_spines_slice(
    positions: &[f32],
    out: &mut [f32],
    v_count: usize,
    world: Option<&[f32]>,
    proj: &[f32],
    frames: &[f32],
    frame_offsets: &[u32],
    spine_count: usize,
    meta: &[f32],
) {
    let (sx, sy, bx, by) = (meta[0] as f64, meta[1] as f64, meta[2] as f64, meta[3] as f64);
    let (rot_cos, rot_sin) = (meta[4] as f64, meta[5] as f64);
    let (inv_cos, inv_sin) = (rot_cos, -rot_sin);
    let (inv_sx, inv_sy) = (meta[6] as f64, meta[7] as f64);
    let deg_to_rad = PI / 180.0;

    for i in 0..v_count {
        let i3 = i * 3;
        let (px0, py0, pz0) = (positions[i3], positions[i3 + 1], positions[i3 + 2]);
        let (wx, wy) = if let Some(w) = world {
            (w[i * 2] as f64, w[i * 2 + 1] as f64)
        } else {
            let px = px0 as f64 * sx;
            let py = -(py0 as f64) * sy;
            (px * rot_cos - py * rot_sin + bx, px * rot_sin + py * rot_cos + by)
        };

        let (mut dx, mut dy) = (0.0_f64, 0.0_f64);
        for k in 0..spine_count {
            let o = (k * v_count + i) * 5;
            let seg_f = proj[o];
            if seg_f < 0.0 {
                continue;
            }
            let start = frame_offsets[k] as usize;
            let end = frame_offsets[k + 1] as usize;
            let sample_len = end.saturating_sub(start);
            if sample_len < 2 {
                continue;
            }
            let seg = (seg_f as usize).min(sample_len - 2);
            let s0 = (start + seg) * 6;
            let s1 = (start + seg + 1) * 6;
            let s_last = (end - 1) * 6;

            let t = proj[o + 1] as f64;
            let tc = t.clamp(0.0, 1.0);
            let angle = frames[s0 + 4] as f64 + (frames[s1 + 4] as f64 - frames[s0 + 4] as f64) * tc;
            let angle_rad = angle * deg_to_rad;
            let (a_cos, a_sin) = (angle_rad.cos(), angle_rad.sin());

            let mut base_x = frames[s0 + 2] as f64 + (frames[s1 + 2] as f64 - frames[s0 + 2] as f64) * tc;
            let mut base_y = frames[s0 + 3] as f64 + (frames[s1 + 3] as f64 - frames[s0 + 3] as f64) * tc;
            if t > 1.0 {
                let tip_scale = (1.0 + frames[s_last + 5] as f64).max(0.1);
                let ex = (frames[s1] as f64 - frames[s0] as f64) * (t - 1.0) * tip_scale;
                let ey = (frames[s1 + 1] as f64 - frames[s0 + 1] as f64) * (t - 1.0) * tip_scale;
                base_x += ex * a_cos - ey * a_sin;
                base_y += ex * a_sin + ey * a_cos;
            }
            let seg_stretch = (frames[s0 + 5] as f64 + frames[s1 + 5] as f64) * 0.5;
            let lateral_scale = (1.0 - seg_stretch * 0.35).clamp(0.4, 1.8);
            let ox = proj[o + 2] as f64 * lateral_scale;
            let oy = proj[o + 3] as f64 * lateral_scale;
            let off_x = ox * a_cos - oy * a_sin;
            let off_y = ox * a_sin + oy * a_cos;
            let w = proj[o + 4] as f64;
            dx += (base_x + off_x - wx) * w;
            dy += (base_y + off_y - wy) * w;
        }

        if dx == 0.0 && dy == 0.0 {
            out[i3] = px0;
            out[i3 + 1] = py0;
            out[i3 + 2] = pz0;
            continue;
        }
        let lx = wx + dx - bx;
        let ly = wy + dy - by;
        out[i3] = ((lx * inv_cos - ly * inv_sin) * inv_sx) as f32;
        out[i3 + 1] = -(((lx * inv_sin + ly * inv_cos) * inv_sy) as f32);
        out[i3 + 2] = pz0;
    }
}

/// Biến dạng lưới theo các xương motion cành cây/lá (PlantSpine).
#[unsafe(no_mangle)]
pub extern "C" fn rust_deform_plant_spines(
    positions_ptr: *const f32,
    out_ptr: *mut f32,
    v_count: usize,
    world_ptr: *const f32,
    use_cached_world: u32,
    proj_ptr: *const f32,
    frames_ptr: *const f32,
    frame_offsets_ptr: *const u32,
    spine_count: usize,
    binding_meta_ptr: *const f32,
) -> bool {
    if positions_ptr.is_null()
        || out_ptr.is_null()
        || proj_ptr.is_null()
        || frames_ptr.is_null()
        || frame_offsets_ptr.is_null()
        || binding_meta_ptr.is_null()
        || v_count == 0
        || spine_count == 0
    {
        return false;
    }
    if use_cached_world != 0 && world_ptr.is_null() {
        return false;
    }
    let positions = unsafe { std::slice::from_raw_parts(positions_ptr, v_count * 3) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, v_count * 3) };
    let world = if use_cached_world != 0 {
        Some(unsafe { std::slice::from_raw_parts(world_ptr, v_count * 2) })
    } else {
        None
    };
    let proj = unsafe { std::slice::from_raw_parts(proj_ptr, spine_count * v_count * 5) };
    let frame_offsets = unsafe { std::slice::from_raw_parts(frame_offsets_ptr, spine_count + 1) };
    let total_samples = frame_offsets[spine_count] as usize;
    let frames = unsafe { std::slice::from_raw_parts(frames_ptr, total_samples * 6) };
    let meta = unsafe { std::slice::from_raw_parts(binding_meta_ptr, 8) };
    deform_plant_spines_slice(
        positions, out, v_count, world, proj, frames, frame_offsets, spine_count, meta,
    );
    true
}

/// Chuẩn hoá toạ độ đỉnh sang không gian đơn vị `[-0.5, 0.5]` bằng WASM SIMD128 (4 đỉnh / bước).
#[unsafe(no_mangle)]
pub extern "C" fn rust_scale_unit_space(
    pos_in_ptr: *const f32,
    pos_out_ptr: *mut f32,
    v_count: usize,
    inv_w: f32,
    inv_h: f32,
) -> bool {
    if pos_in_ptr.is_null() || pos_out_ptr.is_null() || v_count == 0 {
        return false;
    }
    let mut i = 0usize;
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    unsafe {
        use core::arch::wasm32::{f32x4, f32x4_mul, v128};
        let m0 = f32x4(inv_w, inv_h, inv_w, inv_w);
        let m1 = f32x4(inv_h, inv_w, inv_w, inv_h);
        let m2 = f32x4(inv_w, inv_w, inv_h, inv_w);
        while i + 4 <= v_count {
            let base = i * 3;
            let v0 = core::ptr::read_unaligned(pos_in_ptr.add(base) as *const v128);
            let v1 = core::ptr::read_unaligned(pos_in_ptr.add(base + 4) as *const v128);
            let v2 = core::ptr::read_unaligned(pos_in_ptr.add(base + 8) as *const v128);
            core::ptr::write_unaligned(pos_out_ptr.add(base) as *mut v128, f32x4_mul(v0, m0));
            core::ptr::write_unaligned(pos_out_ptr.add(base + 4) as *mut v128, f32x4_mul(v1, m1));
            core::ptr::write_unaligned(pos_out_ptr.add(base + 8) as *mut v128, f32x4_mul(v2, m2));
            i += 4;
        }
    }
    while i < v_count {
        let base = i * 3;
        unsafe {
            *pos_out_ptr.add(base) = *pos_in_ptr.add(base) * inv_w;
            *pos_out_ptr.add(base + 1) = *pos_in_ptr.add(base + 1) * inv_h;
            *pos_out_ptr.add(base + 2) = *pos_in_ptr.add(base + 2) * inv_w;
        }
        i += 1;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skin_90deg_knee_bend_preserves_volume() {
        let pos = [12.0_f32, -50.0, 0.0];
        let mut out = [0.0_f32; 3];
        let p_idx = [0i32, 1, -1, -1];
        let p_w = [0.5_f32, 0.5, 0.0, 0.0];
        let r0 = 0.0_f64;
        let r1 = (-90.0_f64 * PI) / 180.0;
        let bones_tf: [f32; 18] = [
            0.0, 0.0, 0.0, 0.0, r0.cos() as f32, r0.sin() as f32, 1.0, 1.0, 0.0,
            0.0, 50.0, 0.0, 50.0, r1.cos() as f32, r1.sin() as f32, 1.0, 1.0, -90.0,
        ];
        let meta = [1.0_f32, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0];
        deform_skin_slice(&pos, &mut out, 1, &p_idx, &p_w, &bones_tf, 2, &meta, 0, 1.0);
        let radius = (out[0] as f64).hypot(out[1] as f64 + 50.0);
        assert!(radius > 11.0 && radius <= 13.0, "radius={radius}");
    }

    #[test]
    fn test_scale_unit_space_odd_count() {
        let mut buf: Vec<f32> = (0..21).map(|i| (i + 1) as f32).collect();
        let copy = buf.clone();
        assert!(rust_scale_unit_space(copy.as_ptr(), buf.as_mut_ptr(), 7, 0.01, 0.005));
        for i in 0..7 {
            assert!((buf[i * 3] - copy[i * 3] * 0.01).abs() < 1e-6);
            assert!((buf[i * 3 + 1] - copy[i * 3 + 1] * 0.005).abs() < 1e-6);
            assert!((buf[i * 3 + 2] - copy[i * 3 + 2] * 0.01).abs() < 1e-6);
        }
    }
}
