use std::f64::consts::PI;

#[inline]
fn normalize3(v: [f64; 3]) -> [f64; 3] {
    let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if len < 1e-6 {
        [0.0, 1.0, 0.0]
    } else {
        [v[0] / len, v[1] / len, v[2] / len]
    }
}

#[inline]
fn cross3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn sample_curve_spine(pts: &[f32], pt_count: usize, t: f64) -> ([f64; 3], [f64; 3], [f64; 3]) {
    let pt = |idx: usize| -> [f64; 3] {
        [pts[idx * 3] as f64, pts[idx * 3 + 1] as f64, pts[idx * 3 + 2] as f64]
    };
    let p = t.clamp(0.0, 0.9999) * ((pt_count - 1) as f64);
    let i = p.floor() as usize;
    let f = p - i as f64;
    let p0 = pt(i.saturating_sub(1));
    let p1 = pt(i);
    let p2 = pt((i + 1).min(pt_count - 1));
    let p3 = pt((i + 2).min(pt_count - 1));
    let f2 = f * f;
    let f3 = f2 * f;

    let mut pos = [0.0_f64; 3];
    let mut tan = [0.0_f64; 3];
    for a in 0..3 {
        let c0 = 2.0 * p1[a];
        let c1 = -p0[a] + p2[a];
        let c2 = 2.0 * p0[a] - 5.0 * p1[a] + 4.0 * p2[a] - p3[a];
        let c3 = -p0[a] + 3.0 * p1[a] - 3.0 * p2[a] + p3[a];
        pos[a] = 0.5 * (c0 + c1 * f + c2 * f2 + c3 * f3);
        tan[a] = 0.5 * (c1 + 2.0 * c2 * f + 3.0 * c3 * f2);
    }
    let tangent = normalize3(tan);
    let ref_up = if tangent[1].abs() < 0.9 { [0.0, 1.0, 0.0] } else { [1.0, 0.0, 0.0] };
    let normal = normalize3(cross3(tangent, ref_up));
    let binormal = normalize3(cross3(normal, tangent));
    (pos, normal, binormal)
}

#[inline]
fn bernstein3(t: f64) -> [f64; 4] {
    let clamped = t.clamp(0.0, 1.0);
    let inv = 1.0 - clamped;
    let inv2 = inv * inv;
    let t2 = clamped * clamped;
    [inv2 * inv, 3.0 * clamped * inv2, 3.0 * t2 * inv, t2 * clamped]
}

/// Áp dụng uốn cong (Bend / Arc / Taper / Lateral) tại chỗ.
/// `axis_code`: 0='x', 1='y'. `region_code`: 0='all', 1='bottom', 2='top', 3='left', 4='right', 5='curl'.
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_bend(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    width: f32,
    _height: f32,
    axis_code: u32,
    intensity: f32,
    arc_angle: f32,
    taper_ratio: f32,
    lateral: f32,
    region_code: u32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || count == 0 {
        return false;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let (w, inten, arc) = (width as f64, intensity as f64, arc_angle as f64);
    let (taper, lat) = (taper_ratio as f64, lateral as f64);

    for i in 0..count {
        let idx = i * 3;
        let (u, v) = (uvs[i * 2] as f64, uvs[i * 2 + 1] as f64);
        if (taper - 1.0).abs() > 0.0 {
            pos[idx] = ((pos[idx] as f64) * (1.0 - (1.0 - taper) * v)) as f32;
        }
        if arc > 0.0 {
            let rad = ((u - 0.5) * arc * PI) / 180.0;
            let r = w / ((arc * PI) / 180.0);
            pos[idx] = (r * rad.sin()) as f32;
            pos[idx + 2] = ((pos[idx + 2] as f64) + r * (1.0 - rad.cos())) as f32;
        } else if axis_code == 0 && inten != 0.0 {
            let nu = (u - 0.5) * 2.0;
            pos[idx + 2] = ((pos[idx + 2] as f64) - inten * 0.25 * (1.0 - nu * nu)) as f32;
        }
        if axis_code == 1 && inten != 0.0 {
            let factor = match region_code {
                1 => (1.0 - v) * (1.0 - v),
                2 => {
                    let s = ((v - 0.5) * 2.0).max(0.0);
                    s * s
                }
                _ => v * v,
            };
            pos[idx + 2] = ((pos[idx + 2] as f64) + inten * 0.3 * factor) as f32;
        }
        if lat != 0.0 {
            let delta = if region_code == 5 {
                (v * PI * 2.0).sin() * lat * 0.2
            } else {
                v * v * lat * 0.25
            };
            pos[idx] = ((pos[idx] as f64) + delta) as f32;
        }
    }
    true
}

/// Áp dụng xoắn dọc (Twist) quanh trục tung tâm.
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_twist(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    angle_deg: f32,
    center: f32,
    falloff: f32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || count == 0 {
        return false;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let angle_rad = (angle_deg as f64 * PI) / 180.0;
    let (ctr, fo) = (center as f64, falloff as f64);

    for i in 0..count {
        let idx = i * 3;
        let v = uvs[i * 2 + 1] as f64;
        let factor = ((v - ctr).abs() * 2.0).powf(fo);
        let sign = if v >= ctr { 1.0 } else { -1.0 };
        let twist = sign * angle_rad * factor;
        let (x, z) = (pos[idx] as f64, pos[idx + 2] as f64);
        let (c, s) = (twist.cos(), twist.sin());
        pos[idx] = (x * c - z * s) as f32;
        pos[idx + 2] = (x * s + z * c) as f32;
    }
    true
}

/// Áp dụng biên dạng nổi 2.5D (`profile_code`: 0=none, 1=ridge, 2=sphere, 3=cylinder, 4=slope, 5=luminance).
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_depth_profile(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    profile_code: u32,
    intensity: f32,
    invert: u32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || count == 0 {
        return false;
    }
    if profile_code == 0 || intensity == 0.0 {
        return true;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let sign = if invert != 0 { -1.0_f64 } else { 1.0_f64 };
    let scale = (intensity as f64 / 100.0) * 20.0 * sign;

    for i in 0..count {
        let idx = i * 3;
        let (u, v) = (uvs[i * 2] as f64, uvs[i * 2 + 1] as f64);
        let depth = match profile_code {
            1 => {
                let d = (u - 0.5).abs() * 2.0;
                (1.0 - d * d).max(0.0)
            }
            2 => {
                let (dx, dy) = ((u - 0.5) * 2.0, (v - 0.5) * 2.0);
                let r2 = dx * dx + dy * dy;
                if r2 < 1.0 { (1.0 - r2).sqrt() } else { 0.0 }
            }
            3 => {
                let dx = (u - 0.5) * 2.0;
                if dx.abs() < 1.0 { (1.0 - dx * dx).sqrt() } else { 0.0 }
            }
            4 => v,
            _ => 0.0,
        };
        pos[idx + 2] = ((pos[idx + 2] as f64) + depth * scale) as f32;
    }
    true
}

/// Uốn lưới dọc đường cong Catmull-Rom 3D.
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_curve(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    local_pts_ptr: *const f32,
    pt_count: usize,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || local_pts_ptr.is_null() || count == 0 {
        return false;
    }
    if pt_count < 2 {
        return true;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let pts = unsafe { std::slice::from_raw_parts(local_pts_ptr, pt_count * 3) };

    for i in 0..count {
        let idx = i * 3;
        let v = uvs[i * 2 + 1] as f64;
        let (lx, lz) = (pos[idx] as f64, pos[idx + 2] as f64);
        let (sp, n, b) = sample_curve_spine(pts, pt_count, v);
        pos[idx] = (sp[0] + n[0] * lx + b[0] * lz) as f32;
        pos[idx + 1] = (sp[1] + n[1] * lx + b[1] * lz) as f32;
        pos[idx + 2] = (sp[2] + n[2] * lx + b[2] * lz) as f32;
    }
    true
}

/// Biến dạng lưới tự do (FFD) 4×4 bằng đa thức Bernstein bậc 3.
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_lattice(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    offsets_ptr: *const f32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || offsets_ptr.is_null() || count == 0 {
        return false;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let offsets = unsafe { std::slice::from_raw_parts(offsets_ptr, 48) };

    for k in 0..count {
        let idx = k * 3;
        let bu = bernstein3(uvs[k * 2] as f64);
        let bv = bernstein3(uvs[k * 2 + 1] as f64);
        let (mut dx, mut dy, mut dz) = (0.0_f64, 0.0_f64, 0.0_f64);
        for j in 0..4 {
            let wv = bv[j];
            for i in 0..4 {
                let w = bu[i] * wv;
                let base = (j * 4 + i) * 3;
                dx += w * offsets[base] as f64;
                dy += w * offsets[base + 1] as f64;
                dz += w * offsets[base + 2] as f64;
            }
        }
        pos[idx] = ((pos[idx] as f64) + dx) as f32;
        pos[idx + 1] = ((pos[idx + 1] as f64) + dy) as f32;
        pos[idx + 2] = ((pos[idx + 2] as f64) + dz) as f32;
    }
    true
}

/// Điêu khắc mềm theo từng nét cọ (`mode_code`: 0=inflate, 1=deflate, 2=grab, 3=smooth).
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_brush(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    strokes_ptr: *const f32,
    stroke_count: usize,
    width: f32,
    height: f32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || count == 0 {
        return false;
    }
    if stroke_count == 0 || strokes_ptr.is_null() {
        return true;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let strokes = unsafe { std::slice::from_raw_parts(strokes_ptr, stroke_count * 8) };
    let aspect = (height as f64) / (width as f64).max(1.0);

    for s in 0..stroke_count {
        let st = &strokes[s * 8..s * 8 + 8];
        let (tu, tv, pressure, radius) = (st[0] as f64, st[1] as f64, st[2] as f64, st[3] as f64);
        let r2 = radius * radius;
        if r2 <= 0.0 {
            continue;
        }
        let mode = st[4] as u32;
        let (dx, dy, dz) = (st[5] as f64, st[6] as f64, st[7] as f64);
        for i in 0..count {
            let idx = i * 3;
            let (u, v) = (uvs[i * 2] as f64, uvs[i * 2 + 1] as f64);
            if v <= 0.01 {
                continue;
            }
            let du = u - tu;
            let dv = (v - tv) * aspect;
            let dist2 = du * du + dv * dv;
            if dist2 >= r2 {
                continue;
            }
            let falloff = 1.0 - dist2 / r2;
            let w = falloff * falloff * pressure;
            match mode {
                0 => pos[idx + 2] = ((pos[idx + 2] as f64) + w * 15.0) as f32,
                1 => pos[idx + 2] = ((pos[idx + 2] as f64) - w * 15.0) as f32,
                2 => {
                    pos[idx] = ((pos[idx] as f64) + w * dx) as f32;
                    pos[idx + 1] = ((pos[idx + 1] as f64) + w * dy) as f32;
                    pos[idx + 2] = ((pos[idx + 2] as f64) + w * dz) as f32;
                }
                3 => pos[idx + 2] = ((pos[idx + 2] as f64) * (1.0 - w * 0.5)) as f32,
                _ => {}
            }
        }
    }
    true
}

/// Chuyển động thủ tục theo timeline (`motion_code`: 0=none, 1=wind, 2=wave, 3=breathe, 4=wiggle;
/// `dir_code`: 0=horizontal, 1=depthZ, 2=both, 3=vertical).
#[unsafe(no_mangle)]
pub extern "C" fn rust_apply_timeline_motion(
    pos_ptr: *mut f32,
    uvs_ptr: *const f32,
    count: usize,
    motion_code: u32,
    dir_code: u32,
    speed: f32,
    amplitude: f32,
    time: f32,
) -> bool {
    if pos_ptr.is_null() || uvs_ptr.is_null() || count == 0 {
        return false;
    }
    if motion_code == 0 || amplitude == 0.0 {
        return true;
    }
    let pos = unsafe { std::slice::from_raw_parts_mut(pos_ptr, count * 3) };
    let uvs = unsafe { std::slice::from_raw_parts(uvs_ptr, count * 2) };
    let amp = amplitude as f64;
    let phase = (time as f64) * (speed as f64) * PI * 2.0;

    for i in 0..count {
        let idx = i * 3;
        let (u, v) = (uvs[i * 2] as f64, uvs[i * 2 + 1] as f64);
        let weight = v * v;
        let wave = match motion_code {
            1 => (phase + u * 4.0).sin() * amp * weight,
            2 => (phase + v * 6.0).sin() * amp * weight,
            3 => phase.sin() * (amp * 0.5) * weight,
            4 => ((phase * 1.7).sin() + (phase * 2.3 + u * 3.0).cos()) * (amp * 0.5) * weight,
            _ => 0.0,
        };
        if dir_code == 0 || dir_code == 2 {
            pos[idx] = ((pos[idx] as f64) + wave * 0.5) as f32;
        }
        if dir_code == 1 || dir_code == 2 {
            pos[idx + 2] = ((pos[idx + 2] as f64) + wave) as f32;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bend_twist_and_brush_root_protection() {
        let mut pos = [10.0_f32, -40.0, 0.0, 10.0, 40.0, 0.0];
        let uvs = [0.5_f32, 0.0, 0.5, 0.8];
        assert!(rust_apply_bend(pos.as_mut_ptr(), uvs.as_ptr(), 2, 100.0, 100.0, 1, 20.0, 0.0, 0.5, 0.0, 0));
        // Đỉnh gốc v=0 không taper và không Z-offset
        assert_eq!(pos[0], 10.0);
        assert_eq!(pos[2], 0.0);
        // Đỉnh v=0.8 có taper & bendZ
        assert!((pos[3] - 6.0).abs() < 1e-4);
        assert!(pos[5] > 1.0);

        let stroke = [0.5_f32, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0];
        let z0_before = pos[2];
        assert!(rust_apply_brush(pos.as_mut_ptr(), uvs.as_ptr(), 2, stroke.as_ptr(), 1, 100.0, 100.0));
        // v <= 0.01 được bảo vệ tuyệt đối
        assert_eq!(pos[2], z0_before);
    }
}
