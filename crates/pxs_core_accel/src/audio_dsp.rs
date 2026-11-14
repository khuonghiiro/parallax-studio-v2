// Tăng tốc DSP âm thanh bằng Rust WASM: trích xuất peaks, mã hóa WAV PCM16, bộ lọc Biquad EQ, mix clip và lip-sync.

use core::f64::consts::PI;

/// Rút trích `buckets` đỉnh biên độ chuẩn hóa [0..1] từ mảng mẫu đơn kênh.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_extract_audio_peaks(
    samples_ptr: *const f32,
    sample_len: usize,
    buckets: usize,
    sample_stride: usize,
    out_peaks_ptr: *mut f32,
) -> i32 {
    if samples_ptr.is_null() || out_peaks_ptr.is_null() || sample_len == 0 || buckets == 0 {
        return 0;
    }
    let samples = unsafe { core::slice::from_raw_parts(samples_ptr, sample_len) };
    let out = unsafe { core::slice::from_raw_parts_mut(out_peaks_ptr, buckets) };
    let step = (sample_len / buckets).max(1);
    let stride = sample_stride.max(1);

    let mut global_max = 0.0f32;
    for i in 0..buckets {
        let start = i * step;
        let end = (start + step).min(sample_len);
        let mut local_max = 0.0f32;
        let mut j = start;
        while j < end {
            let amp = samples[j].abs();
            if amp > local_max {
                local_max = amp;
            }
            j += stride;
        }
        out[i] = local_max;
        if local_max > global_max {
            global_max = local_max;
        }
    }

    if global_max > 0.0 {
        for v in out.iter_mut() {
            *v /= global_max;
        }
    }
    1
}

#[inline]
fn f32_to_pcm16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0) as f64;
    let scaled = if clamped < 0.0 {
        clamped * 32768.0
    } else {
        clamped * 32767.0
    };
    (scaled.clamp(-32768.0, 32767.0) as i32) as i16
}

fn write_wav_header(
    out: &mut [u8],
    num_channels: u16,
    sample_rate: u32,
    data_size: u32,
) {
    let byte_rate = sample_rate * (num_channels as u32) * 2;
    let block_align = num_channels * 2;
    out[0..4].copy_from_slice(b"RIFF");
    out[4..8].copy_from_slice(&(36 + data_size).to_le_bytes());
    out[8..12].copy_from_slice(b"WAVE");
    out[12..16].copy_from_slice(b"fmt ");
    out[16..20].copy_from_slice(&16u32.to_le_bytes());
    out[20..22].copy_from_slice(&1u16.to_le_bytes());
    out[22..24].copy_from_slice(&num_channels.to_le_bytes());
    out[24..28].copy_from_slice(&sample_rate.to_le_bytes());
    out[28..32].copy_from_slice(&byte_rate.to_le_bytes());
    out[32..34].copy_from_slice(&block_align.to_le_bytes());
    out[34..36].copy_from_slice(&16u16.to_le_bytes());
    out[36..40].copy_from_slice(b"data");
    out[40..44].copy_from_slice(&data_size.to_le_bytes());
}

/// Ghi file RIFF/WAVE PCM 16-bit vào `out_wav_ptr`. Trả tổng byte đã ghi (`0` nếu lỗi).
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_encode_pcm16_wav(
    ch0_ptr: *const f32,
    ch1_ptr: *const f32,
    num_channels: u32,
    sample_rate: u32,
    frame_len: usize,
    out_wav_ptr: *mut u8,
    out_cap: usize,
) -> u32 {
    let chans = num_channels.clamp(1, 2) as usize;
    let data_size = match frame_len.checked_mul(chans * 2) {
        Some(v) => v,
        None => return 0,
    };
    let total = 44 + data_size;
    if out_wav_ptr.is_null() || out_cap < total || total > u32::MAX as usize {
        return 0;
    }
    if frame_len > 0 && (ch0_ptr.is_null() || (chans == 2 && ch1_ptr.is_null())) {
        return 0;
    }
    let out = unsafe { core::slice::from_raw_parts_mut(out_wav_ptr, total) };
    write_wav_header(out, chans as u16, sample_rate, data_size as u32);
    if frame_len == 0 {
        return 44;
    }

    let c0 = unsafe { core::slice::from_raw_parts(ch0_ptr, frame_len) };
    if chans == 1 {
        for i in 0..frame_len {
            let off = 44 + i * 2;
            out[off..off + 2].copy_from_slice(&f32_to_pcm16(c0[i]).to_le_bytes());
        }
    } else {
        let c1 = unsafe { core::slice::from_raw_parts(ch1_ptr, frame_len) };
        for i in 0..frame_len {
            let off = 44 + i * 4;
            out[off..off + 2].copy_from_slice(&f32_to_pcm16(c0[i]).to_le_bytes());
            out[off + 2..off + 4].copy_from_slice(&f32_to_pcm16(c1[i]).to_le_bytes());
        }
    }
    total as u32
}

fn compute_biquad_coeffs(tone_mode: u32, sr: f64) -> Option<[f64; 5]> {
    let sr = sr.max(8000.0);
    let (b0, b1, b2, a0, a1, a2) = match tone_mode {
        // bass: lowshelf 150Hz +6dB
        1 => {
            let a = 10.0f64.powf(6.0 / 40.0);
            let w0 = 2.0 * PI * 150.0 / sr;
            let (sin_w, cos_w) = w0.sin_cos();
            let alpha = sin_w / 2.0 * (2.0f64).sqrt();
            let sqrt_a2 = 2.0 * a.sqrt() * alpha;
            (
                a * ((a + 1.0) - (a - 1.0) * cos_w + sqrt_a2),
                2.0 * a * ((a - 1.0) - (a + 1.0) * cos_w),
                a * ((a + 1.0) - (a - 1.0) * cos_w - sqrt_a2),
                (a + 1.0) + (a - 1.0) * cos_w + sqrt_a2,
                -2.0 * ((a - 1.0) + (a + 1.0) * cos_w),
                (a + 1.0) + (a - 1.0) * cos_w - sqrt_a2,
            )
        }
        // treble: highshelf 3500Hz +6dB
        2 => {
            let a = 10.0f64.powf(6.0 / 40.0);
            let w0 = 2.0 * PI * 3500.0 / sr;
            let (sin_w, cos_w) = w0.sin_cos();
            let alpha = sin_w / 2.0 * (2.0f64).sqrt();
            let sqrt_a2 = 2.0 * a.sqrt() * alpha;
            (
                a * ((a + 1.0) + (a - 1.0) * cos_w + sqrt_a2),
                -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w),
                a * ((a + 1.0) + (a - 1.0) * cos_w - sqrt_a2),
                (a + 1.0) - (a - 1.0) * cos_w + sqrt_a2,
                2.0 * ((a - 1.0) - (a + 1.0) * cos_w),
                (a + 1.0) - (a - 1.0) * cos_w - sqrt_a2,
            )
        }
        // vocal: peaking 1500Hz Q=1 +4dB
        3 => {
            let a = 10.0f64.powf(4.0 / 40.0);
            let w0 = 2.0 * PI * 1500.0 / sr;
            let (sin_w, cos_w) = w0.sin_cos();
            let alpha = sin_w / 2.0;
            (
                1.0 + alpha * a,
                -2.0 * cos_w,
                1.0 - alpha * a,
                1.0 + alpha / a,
                -2.0 * cos_w,
                1.0 - alpha / a,
            )
        }
        // warm: lowpass 4500Hz Q=0.7071
        4 => {
            let w0 = 2.0 * PI * 4500.0 / sr;
            let (sin_w, cos_w) = w0.sin_cos();
            let alpha = sin_w / (2.0 * core::f64::consts::FRAC_1_SQRT_2);
            (
                (1.0 - cos_w) / 2.0,
                1.0 - cos_w,
                (1.0 - cos_w) / 2.0,
                1.0 + alpha,
                -2.0 * cos_w,
                1.0 - alpha,
            )
        }
        _ => return None,
    };
    Some([b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0])
}

/// Áp dụng bộ lọc Biquad EQ trực tiếp trên buffer `samples_ptr`.
/// `tone_mode`: `0=normal`, `1=bass`, `2=treble`, `3=vocal`, `4=warm`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_apply_tone_biquad_in_place(
    samples_ptr: *mut f32,
    len: usize,
    sample_rate: f32,
    tone_mode: u32,
) -> i32 {
    if samples_ptr.is_null() {
        return 0;
    }
    if len == 0 || tone_mode == 0 {
        return 1;
    }
    let Some([b0, b1, b2, a1, a2]) = compute_biquad_coeffs(tone_mode, sample_rate as f64) else {
        return 1;
    };
    let samples = unsafe { core::slice::from_raw_parts_mut(samples_ptr, len) };
    let (mut z1, mut z2) = (0.0f64, 0.0f64);
    for s in samples.iter_mut() {
        let x = *s as f64;
        let y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        *s = y as f32;
    }
    1
}

/// Trộn tuyến tính một clip đơn kênh vào buffer đích theo tốc độ phát `step_per_out_frame` và `gain`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_mix_audio_clip_f32(
    src_ptr: *const f32,
    src_len: usize,
    dst_ptr: *mut f32,
    dst_len: usize,
    dst_start: usize,
    src_start_sample: f64,
    step_per_out_frame: f64,
    gain: f32,
    max_out_frames: usize,
) -> usize {
    if src_ptr.is_null()
        || dst_ptr.is_null()
        || src_len == 0
        || dst_start >= dst_len
        || step_per_out_frame <= 0.0
    {
        return 0;
    }
    let src = unsafe { core::slice::from_raw_parts(src_ptr, src_len) };
    let dst = unsafe { core::slice::from_raw_parts_mut(dst_ptr, dst_len) };
    let limit = max_out_frames.min(dst_len - dst_start);
    let mut mixed = 0usize;

    for k in 0..limit {
        let pos = src_start_sample + (k as f64) * step_per_out_frame;
        if pos < 0.0 {
            continue;
        }
        let idx = pos as usize;
        if idx >= src_len {
            break;
        }
        let s0 = src[idx];
        let s1 = if idx + 1 < src_len { src[idx + 1] } else { s0 };
        let frac = (pos - idx as f64) as f32;
        dst[dst_start + k] += (s0 + (s1 - s0) * frac) * gain;
        mixed += 1;
    }
    mixed
}

/// Đánh giá hàng loạt khung khẩu hình miệng từ buffer peaks theo `params_f64[0..17]`:
/// `[start_time, offset, rate, trim_in, asset_dur, effective_dur, track_dur, vol_clamped, threshold, intensity, fps, base_sx, base_sy, base_sz, base_px, base_py, base_pz]`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_eval_lipsync_frames(
    peaks_ptr: *const f32,
    peaks_len: usize,
    params_f64_ptr: *const f64,
    frame_count: usize,
    out_scales_ptr: *mut f64,
    out_positions_ptr: *mut f64,
) -> usize {
    if params_f64_ptr.is_null()
        || out_scales_ptr.is_null()
        || out_positions_ptr.is_null()
        || frame_count == 0
    {
        return 0;
    }
    let p = unsafe { core::slice::from_raw_parts(params_f64_ptr, 17) };
    let peaks = if peaks_len == 0 || peaks_ptr.is_null() {
        &[]
    } else {
        unsafe { core::slice::from_raw_parts(peaks_ptr, peaks_len) }
    };
    let out_s = unsafe { core::slice::from_raw_parts_mut(out_scales_ptr, frame_count * 3) };
    let out_p = unsafe { core::slice::from_raw_parts_mut(out_positions_ptr, frame_count * 3) };

    let step = 1.0 / p[10].max(1.0);
    let mut t = p[0];
    for i in 0..frame_count {
        let mut amp = 0.0f64;
        if !peaks.is_empty() && t >= p[1] && (p[6] <= 0.0 || t <= p[1] + p[6]) {
            let local_t = (t - p[1]) * p[2] + p[3];
            if local_t >= 0.0 && (p[4] <= 0.0 || local_t <= p[4]) {
                let ratio = (local_t / p[5].max(1e-6)).clamp(0.0, 1.0);
                let idx = ((ratio * (peaks.len() as f64)).floor() as usize).min(peaks.len() - 1);
                amp = ((peaks[idx] as f64) * p[7]).clamp(0.0, 1.0);
            }
        }
        let eff = if amp < p[8] { 0.0 } else { amp };
        let b = i * 3;
        out_s[b] = p[11] * (1.0 + eff * 0.18 * p[9]);
        out_s[b + 1] = p[12] * (1.0 + eff * 0.7 * p[9]);
        out_s[b + 2] = p[13];
        out_p[b] = p[14];
        out_p[b + 1] = p[15] - eff * 8.0 * p[9];
        out_p[b + 2] = p[16];
        t += step;
    }
    frame_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_peaks_and_wav_encoding() {
        let samples = [0.0f32, 0.2, -0.5, 0.1, 0.25, -1.0, 0.5, 0.0];
        let mut peaks = [0.0f32; 2];
        let ok = unsafe {
            rust_extract_audio_peaks(samples.as_ptr(), samples.len(), 2, 1, peaks.as_mut_ptr())
        };
        assert_eq!(ok, 1);
        assert!((peaks[0] - 0.5).abs() < 1e-6);
        assert!((peaks[1] - 1.0).abs() < 1e-6);

        let mut wav = vec![0u8; 44 + 8];
        let c0 = [0.0f32, 1.0];
        let c1 = [-1.0f32, 0.5];
        let written = unsafe {
            rust_encode_pcm16_wav(c0.as_ptr(), c1.as_ptr(), 2, 44100, 2, wav.as_mut_ptr(), wav.len())
        };
        assert_eq!(written, 52);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(i16::from_le_bytes([wav[46], wav[47]]), -32768);
        assert_eq!(i16::from_le_bytes([wav[48], wav[49]]), 32767);
    }

    #[test]
    fn test_tone_biquad_mix_and_lipsync() {
        let mut buf: Vec<f32> = (0..128).map(|i| ((i as f32) * 0.2).sin() * 0.5).collect();
        let before = buf[64];
        assert_eq!(
            unsafe { rust_apply_tone_biquad_in_place(buf.as_mut_ptr(), buf.len(), 44100.0, 1) },
            1
        );
        assert!((buf[64] - before).abs() > 1e-3);

        let src = [1.0f32, 0.0, -1.0, 0.0];
        let mut dst = [0.0f32; 4];
        let mixed = unsafe {
            rust_mix_audio_clip_f32(
                src.as_ptr(),
                src.len(),
                dst.as_mut_ptr(),
                dst.len(),
                0,
                0.0,
                0.5,
                0.5,
                4,
            )
        };
        assert_eq!(mixed, 4);
        assert!((dst[1] - 0.25).abs() < 1e-6);

        let peaks = [0.0f32, 1.0];
        let params = [
            0.0, 0.0, 1.0, 0.0, 2.0, 2.0, 2.0, 1.0, 0.04, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 10.0, 0.0,
        ];
        let mut scales = [0.0f64; 6];
        let mut pos = [0.0f64; 6];
        let count = unsafe {
            rust_eval_lipsync_frames(
                peaks.as_ptr(),
                peaks.len(),
                params.as_ptr(),
                2,
                scales.as_mut_ptr(),
                pos.as_mut_ptr(),
            )
        };
        assert_eq!(count, 2);
        assert!((scales[4] - 1.7).abs() < 1e-9);
        assert!((pos[4] - 2.0).abs() < 1e-9);
    }
}
