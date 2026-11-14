// Tăng tốc phân tích alpha chroma, đo nhiễu viền, phân loại nền matte và giải pha màu hàng loạt.

fn measure_border_noise_floor(raw_alpha: &[f32], rgba: &[u8], w: usize, h: usize) -> f32 {
    if w < 8 || h < 8 {
        return 0.0;
    }
    let mut samples: Vec<f32> = Vec::with_capacity(256);
    let step_x = 1usize.max(w / 64);
    let step_y = 1usize.max(h / 64);

    let push_if_bg = |x: usize, y: usize, samples: &mut Vec<f32>| {
        let p = y * w + x;
        if rgba[p * 4 + 3] < 200 {
            return;
        }
        let a = raw_alpha[p];
        if a < 0.16 {
            samples.push(a);
        }
    };

    let insets = [
        ((w - 1) / 2).min(1usize.max(12usize.min((w as f64 * 0.012).floor() as usize))),
        ((w - 1) / 2).min(6usize.max(44usize.min((w as f64 * 0.04).floor() as usize))),
    ];
    for inset in insets {
        let iy = ((h - 1) / 2).min(inset);
        let mut x = inset;
        while x < w - inset {
            push_if_bg(x, iy, &mut samples);
            push_if_bg(x, h - 1 - iy, &mut samples);
            x += step_x;
        }
        let mut y = iy + step_y;
        while y < h - iy - step_y {
            push_if_bg(inset, y, &mut samples);
            push_if_bg(w - 1 - inset, y, &mut samples);
            y += step_y;
        }
        if samples.len() >= 24 {
            break;
        }
    }

    if samples.len() < 8 {
        return 0.0;
    }
    samples.sort_by(|a, b| a.total_cmp(b));
    let idx = (samples.len() - 1).min(((samples.len() as f64) * 0.985).floor() as usize);
    samples[idx].clamp(0.0, 0.11)
}

#[inline(always)]
fn eval_pixel_coverage(
    p: &[f32],
    is_chromatic_key: bool,
    r: f64,
    g: f64,
    b: f64,
    alpha_light: f64,
    alpha_dark: f64,
) -> f64 {
    let max_ad = alpha_light.max(alpha_dark);
    let min_ad = alpha_light.min(alpha_dark);
    let mut alpha_all = (max_ad + min_ad * 0.5).min(1.0);
    let (kr, kg, kb) = (p[0] as f64, p[1] as f64, p[2] as f64);
    let (kcr, kcg, kcb, kc_len_sq) = (p[9] as f64, p[10] as f64, p[11] as f64, p[12] as f64);
    let detail_protection = p[13] as f64;

    if is_chromatic_key {
        let c_mean = (r + g + b) / 3.0;
        let p_chroma = (((r - c_mean) * kcr + (g - c_mean) * kcg + (b - c_mean) * kcb) / kc_len_sq)
            .clamp(0.0, 1.0);
        let alpha_chroma = 1.0 - p_chroma;
        if alpha_chroma > alpha_all {
            alpha_all = alpha_chroma;
        }
        if alpha_light > 0.12 && alpha_dark > 0.18 && p_chroma < 0.25 {
            alpha_all = alpha_all.max((1.0 - p_chroma * 0.35).min(1.0));
        }
    } else if detail_protection > 0.0 {
        let (dr, dg, db) = (r - kr, g - kg, b - kb);
        let mean_d = (dr + dg + db) / 3.0;
        let (cd_r, cd_g, cd_b) = (dr - mean_d, dg - mean_d, db - mean_d);
        let chroma_vec = (cd_r * cd_r + cd_g * cd_g + cd_b * cd_b).sqrt();
        let eff_chroma = (chroma_vec - 2.2).max(0.0);
        let max_pos = 0.0f64.max(dr).max(dg).max(db);
        let max_neg = 0.0f64.max(-dr).max(-dg).max(-db);
        let opp_pol = if max_pos > 1.5 && max_neg > 1.5 {
            max_pos.min(max_neg)
        } else {
            0.0
        };
        if eff_chroma > 0.0 || opp_pol > 0.0 {
            alpha_all = (alpha_all + (eff_chroma / 12.0 + opp_pol / 9.0) * detail_protection).min(1.0);
        }
    }
    alpha_all
}

/// Phân tích độ phủ toàn ảnh và đo nhiễu viền.
/// `params_ptr`: 14 `f32` `[kr, kg, kb, invPosR, invPosG, invPosB, invNegR, invNegG, invNegB, kcr, kcg, kcb, kcLenSq, detailProtection]`.
/// `flags`: bit 0 = isChromaticKey, bits 1..2 = shadowType (`0=auto, 1=light, 2=dark`).
#[unsafe(no_mangle)]
pub extern "C" fn rust_analyze_chroma_alpha(
    rgba_ptr: *const u8,
    w: i32,
    h: i32,
    params_ptr: *const f32,
    flags: u32,
    raw_alpha_out_ptr: *mut f32,
    dir_alpha_out_ptr: *mut f32,
    is_light_out_ptr: *mut u8,
    noise_out_ptr: *mut f32,
) -> i32 {
    if rgba_ptr.is_null()
        || params_ptr.is_null()
        || raw_alpha_out_ptr.is_null()
        || dir_alpha_out_ptr.is_null()
        || is_light_out_ptr.is_null()
        || noise_out_ptr.is_null()
        || w <= 0
        || h <= 0
    {
        return 0;
    }
    let (width, height) = (w as usize, h as usize);
    let total = width * height;
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, total * 4) };
    let params = unsafe { std::slice::from_raw_parts(params_ptr, 14) };
    let raw_alpha = unsafe { std::slice::from_raw_parts_mut(raw_alpha_out_ptr, total) };
    let dir_alpha = unsafe { std::slice::from_raw_parts_mut(dir_alpha_out_ptr, total) };
    let is_light = unsafe { std::slice::from_raw_parts_mut(is_light_out_ptr, total) };

    let is_chromatic = (flags & 1) != 0;
    let shadow_type = (flags >> 1) & 3;
    let (kr, kg, kb) = (params[0] as f64, params[1] as f64, params[2] as f64);
    let (ipr, ipg, ipb) = (params[3] as f64, params[4] as f64, params[5] as f64);
    let (inr, ing, inb) = (params[6] as f64, params[7] as f64, params[8] as f64);

    for p in 0..total {
        let idx = p * 4;
        if rgba[idx + 3] < 15 {
            raw_alpha[p] = 0.0;
            dir_alpha[p] = 0.0;
            is_light[p] = 0;
            continue;
        }
        let (r, g, b) = (rgba[idx] as f64, rgba[idx + 1] as f64, rgba[idx + 2] as f64);
        let alpha_light = ((r - kr).max(0.0) * ipr)
            .max((g - kg).max(0.0) * ipg)
            .max((b - kb).max(0.0) * ipb);
        let alpha_dark = ((kr - r).max(0.0) * inr)
            .max((kg - g).max(0.0) * ing)
            .max((kb - b).max(0.0) * inb);
        let alpha_all = eval_pixel_coverage(params, is_chromatic, r, g, b, alpha_light, alpha_dark);

        raw_alpha[p] = alpha_all as f32;
        is_light[p] = if alpha_light >= alpha_dark { 1 } else { 0 };
        dir_alpha[p] = match shadow_type {
            1 => if alpha_light >= alpha_dark * 0.5 { alpha_light as f32 } else { 0.0 },
            2 => if alpha_dark > alpha_light { alpha_dark as f32 } else { 0.0 },
            _ => alpha_all as f32,
        };
    }

    unsafe {
        *noise_out_ptr = measure_border_noise_floor(raw_alpha, rgba, width, height);
    }
    1
}

#[inline(always)]
fn eval_chroma_matte_pixel(
    mp: &[f32],
    mode: u32,
    chromatic: bool,
    r: f64,
    g: f64,
    b: f64,
    source_alpha: u8,
) -> u8 {
    if source_alpha == 0 {
        return 0;
    }
    let (kr, kg, kb) = (mp[0] as f64, mp[1] as f64, mp[2] as f64);
    let mut distance = if mode == 0 {
        let (dr, dg, db) = (r - kr, g - kg, b - kb);
        (dr * dr + dg * dg + db * db).sqrt()
    } else {
        let green = mode == 1;
        let keyed = if green { g } else { b };
        let other_b = if green { b } else { g };
        let ch_d = keyed - if green { kg } else { kb };
        let oa_d = r - kr;
        let ob_d = other_b - if green { kb } else { kg };
        let raw_dist = (ch_d * ch_d * 0.48 + oa_d * oa_d * 0.28 + ob_d * ob_d * 0.24).sqrt();
        let dom = keyed - r.max(other_b);
        let dom_match = (dom.min(mp[3] as f64) - 8.0).max(0.0);
        (raw_dist - dom_match * 0.22).max(0.0)
    };

    if chromatic {
        let c_mean = (r + g + b) / 3.0;
        let p_chroma = (((r - c_mean) * mp[5] as f64
            + (g - c_mean) * mp[6] as f64
            + (b - c_mean) * mp[7] as f64)
            / mp[8] as f64)
            .clamp(0.0, 1.0);
        if p_chroma > 0.08 {
            let chroma_dist = ((1.0 - p_chroma * mp[9] as f64) * 200.0).max(0.0);
            if chroma_dist < distance {
                distance = chroma_dist;
            }
        }
    } else if mp[10] > 0.0 {
        let (dr, dg, db) = (r - kr, g - kg, b - kb);
        let mean_d = (dr + dg + db) / 3.0;
        let (cd_r, cd_g, cd_b) = (dr - mean_d, dg - mean_d, db - mean_d);
        let eff_c = ((cd_r * cd_r + cd_g * cd_g + cd_b * cd_b).sqrt() - 2.2).max(0.0);
        let max_p = 0.0f64.max(dr).max(dg).max(db);
        let max_n = 0.0f64.max(-dr).max(-dg).max(-db);
        let opp = if max_p > 1.5 && max_n > 1.5 { max_p.min(max_n) } else { 0.0 };
        let k_mean = mp[4] as f64;
        let head_boost = if (185.0..=238.0).contains(&k_mean) && mean_d > 5.0 {
            ((mean_d - 5.0) / 18.0f64.max(255.0 - k_mean)) * 45.0
        } else if (17.0..=70.0).contains(&k_mean) && -mean_d > 5.0 {
            ((-mean_d - 5.0) / 18.0f64.max(k_mean)) * 45.0
        } else {
            0.0
        };
        distance += (eff_c * 4.2 + opp * 2.8 + head_boost) * mp[10] as f64;
    }

    let hard_thresh = mp[11] as f64;
    let trans_w = mp[12] as f64;
    if distance <= hard_thresh {
        return 0;
    }
    if distance >= hard_thresh + trans_w {
        return source_alpha;
    }
    let t = ((distance - hard_thresh) / trans_w).clamp(0.0, 1.0);
    let smooth = t * t * (3.0 - 2.0 * t);
    ((source_alpha as f64) * smooth).round() as u8
}

/// Phân loại pixel nền + matte alpha.
/// `mp_ptr`: 13 `f32` `[kr, kg, kb, keyDominance, kMean, kcr, kcg, kcb, kcLenSq, tolFactor, detailProtection, hardThreshold, transitionWidth]`.
/// `mode_flags`: `(mode & 3) | (chromatic ? 4 : 0)`.
#[unsafe(no_mangle)]
pub extern "C" fn rust_classify_bg_pixels(
    rgba_ptr: *const u8,
    total_pixels: i32,
    mp_ptr: *const f32,
    mode_flags: u32,
    precomputed_ptr: *const u8,
    has_precomputed: i32,
    is_bg_out_ptr: *mut u8,
    shadow_alpha_out_ptr: *mut u8,
) -> i32 {
    if rgba_ptr.is_null()
        || mp_ptr.is_null()
        || is_bg_out_ptr.is_null()
        || shadow_alpha_out_ptr.is_null()
        || total_pixels <= 0
    {
        return 0;
    }
    let total = total_pixels as usize;
    let rgba = unsafe { std::slice::from_raw_parts(rgba_ptr, total * 4) };
    let mp = unsafe { std::slice::from_raw_parts(mp_ptr, 13) };
    let is_bg = unsafe { std::slice::from_raw_parts_mut(is_bg_out_ptr, total) };
    let shadow_alpha = unsafe { std::slice::from_raw_parts_mut(shadow_alpha_out_ptr, total) };
    let pre = if has_precomputed != 0 && !precomputed_ptr.is_null() {
        Some(unsafe { std::slice::from_raw_parts(precomputed_ptr, total) })
    } else {
        None
    };

    let mode = mode_flags & 3;
    let chromatic = (mode_flags & 4) != 0;

    for p in 0..total {
        let idx = p * 4;
        let a = rgba[idx + 3];
        if a < 15 {
            is_bg[p] = 1;
            shadow_alpha[p] = 0;
            continue;
        }
        let matte_a = match pre {
            Some(buf) => buf[p],
            None => eval_chroma_matte_pixel(
                mp,
                mode,
                chromatic,
                rgba[idx] as f64,
                rgba[idx + 1] as f64,
                rgba[idx + 2] as f64,
                a,
            ),
        };
        if matte_a < a {
            is_bg[p] = 1;
            shadow_alpha[p] = matte_a;
        } else {
            is_bg[p] = 0;
            shadow_alpha[p] = 255;
        }
    }
    1
}

#[inline(always)]
pub(crate) fn unmix_pixel_rgb_in_place(
    rgba: &mut [u8],
    idx: usize,
    kr: f64,
    kg: f64,
    kb: f64,
    a_all: f64,
    is_light_glow: bool,
    is_green: bool,
    is_blue: bool,
    is_magenta: bool,
    eff_out_alpha: f64,
) {
    let (r, g, b) = (rgba[idx] as f64, rgba[idx + 1] as f64, rgba[idx + 2] as f64);
    let is_dark_key = kr < 35.0 && kg < 35.0 && kb < 35.0;
    let is_additive = is_dark_key || (is_light_glow && kr < 75.0 && kg < 75.0 && kb < 75.0);
    let a_unmix = if is_additive {
        a_all.max(eff_out_alpha).clamp(0.08, 1.0)
    } else {
        a_all.clamp(0.07, 1.0)
    };
    let inv_a = 1.0 / a_unmix;
    let mut rf = (kr + (r - kr) * inv_a).clamp(0.0, 255.0);
    let mut gf = (kg + (g - kg) * inv_a).clamp(0.0, 255.0);
    let mut bf = (kb + (b - kb) * inv_a).clamp(0.0, 255.0);

    if is_green {
        gf = gf.min(rf.max(bf) * 1.02 + 2.0);
    } else if is_blue {
        bf = bf.min(rf.max(gf) * 1.02 + 2.0);
    } else if is_magenta {
        if is_light_glow && r > 180.0 && b > 180.0 && g > 40.0 {
            let a_rb = a_unmix.max(0.28);
            let rb_diff = r - b - (kr - kb) * (1.0 - a_unmix);
            rf = if rb_diff >= 0.0 { 255.0 } else { (255.0 + rb_diff / a_rb).clamp(0.0, 255.0) };
            bf = if rb_diff <= 0.0 { 255.0 } else { (255.0 - rb_diff / a_rb).clamp(0.0, 255.0) };
            gf = gf.min(rf.max(bf));
        } else if rf > gf + 4.0 && bf > gf + 4.0 {
            let mag_ex = rf.min(bf) - gf;
            rf = gf.max(rf - mag_ex * 0.95);
            bf = gf.max(bf - mag_ex * 0.95);
        }
    }
    rgba[idx] = rf.round() as u8;
    rgba[idx + 1] = gf.round() as u8;
    rgba[idx + 2] = bf.round() as u8;
}

/// Giải pha màu nền hàng loạt cho vòng lặp cuối của `processAdvancedChromaPixelData`.
#[unsafe(no_mangle)]
pub extern "C" fn rust_batch_unmix_pixels(
    rgba_ptr: *mut u8,
    raw_alpha_ptr: *const f32,
    is_light_ptr: *const u8,
    zone_ptr: *const u8,
    total_pixels: i32,
    kr: f32,
    kg: f32,
    kb: f32,
    key_flags: u32,
) -> i32 {
    if rgba_ptr.is_null()
        || raw_alpha_ptr.is_null()
        || is_light_ptr.is_null()
        || zone_ptr.is_null()
        || total_pixels <= 0
    {
        return 0;
    }
    let total = total_pixels as usize;
    let rgba = unsafe { std::slice::from_raw_parts_mut(rgba_ptr, total * 4) };
    let raw_alpha = unsafe { std::slice::from_raw_parts(raw_alpha_ptr, total) };
    let is_light = unsafe { std::slice::from_raw_parts(is_light_ptr, total) };
    let zone = unsafe { std::slice::from_raw_parts(zone_ptr, total) };

    let (is_g, is_b, is_m) = (
        (key_flags & 1) != 0,
        (key_flags & 2) != 0,
        (key_flags & 4) != 0,
    );
    let is_chromatic = is_g || is_b || is_m;

    for p in 0..total {
        let out_a = rgba[p * 4 + 3];
        let ra = raw_alpha[p] as f64;
        if zone[p] != 0 && ra < 0.98 && out_a > 0 && (is_chromatic || out_a < 250) {
            unmix_pixel_rgb_in_place(
                rgba,
                p * 4,
                kr as f64,
                kg as f64,
                kb as f64,
                ra,
                is_light[p] == 1,
                is_g,
                is_b,
                is_m,
                out_a as f64 / 255.0,
            );
        }
    }
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_and_batch_unmix() {
        let mut rgba = vec![
            0, 220, 75, 255, // nền xanh lá thuần
            200, 100, 80, 255, // vật thể đỏ ấm
        ];
        // Params khớp resolveEffectiveKeyRgb phông xanh lá
        let mp = [0.0f32, 219.0, 78.0, 141.0, 99.0, -99.0, 120.0, -21.0, 24642.0, 1.0, 0.75, 45.0, 14.0];
        let mut is_bg = [0u8; 2];
        let mut sh = [0u8; 2];
        assert_eq!(
            rust_classify_bg_pixels(
                rgba.as_ptr(),
                2,
                mp.as_ptr(),
                1 | 4,
                std::ptr::null(),
                0,
                is_bg.as_mut_ptr(),
                sh.as_mut_ptr()
            ),
            1
        );
        assert_eq!(is_bg, [1, 0]);
        assert_eq!(sh[0], 0);

        // Kiểm tra batch unmix không lỗi
        let raw_a = [0.0f32, 0.99];
        let is_l = [0u8, 0];
        let zone = [1u8, 1];
        assert_eq!(
            rust_batch_unmix_pixels(
                rgba.as_mut_ptr(),
                raw_a.as_ptr(),
                is_l.as_ptr(),
                zone.as_ptr(),
                2,
                0.0,
                219.0,
                78.0,
                1
            ),
            1
        );
    }
}
