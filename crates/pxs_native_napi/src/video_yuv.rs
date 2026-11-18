// Chuyển đổi khung hình RGBA sang Planar YUV420p (BT.601) 64-bit đa luồng Rayon cho pipeline FFmpeg.

use napi::bindgen_prelude::{AsyncTask, Env, Error, Result, Status, Task, Uint8Array};
use napi_derive::napi;
use pxs_core_accel::convert_rgba_to_yuv420p_slice;
use rayon::prelude::*;

const PARALLEL_PIXEL_THRESHOLD: usize = 64 * 64;
const Y_ROWS_PER_TASK: usize = 32;
const UV_ROWS_PER_TASK: usize = 16;

#[inline(always)]
fn convert_y_row(src_row: &[u8], dst_row: &mut [u8]) {
    for (px, out_y) in src_row.chunks_exact(4).zip(dst_row.iter_mut()) {
        let r = px[0] as i32;
        let g = px[1] as i32;
        let b = px[2] as i32;
        let y_val = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
        *out_y = y_val.clamp(16, 235) as u8;
    }
}

#[inline(always)]
fn convert_uv_row_pair(row0: &[u8], row1: &[u8], dst_u: &mut [u8], dst_v: &mut [u8], half_w: usize) {
    for x2 in 0..half_w {
        let x_orig = x2 * 2;
        let p00 = x_orig * 4;
        let p01 = p00 + 4;
        let p10 = x_orig * 4;
        let p11 = p10 + 4;

        let avg_r = (row0[p00] as i32 + row0[p01] as i32 + row1[p10] as i32 + row1[p11] as i32 + 2) >> 2;
        let avg_g = (row0[p00 + 1] as i32
            + row0[p01 + 1] as i32
            + row1[p10 + 1] as i32
            + row1[p11 + 1] as i32
            + 2)
            >> 2;
        let avg_b = (row0[p00 + 2] as i32
            + row0[p01 + 2] as i32
            + row1[p10 + 2] as i32
            + row1[p11 + 2] as i32
            + 2)
            >> 2;

        let u_val = ((-38 * avg_r - 74 * avg_g + 112 * avg_b + 128) >> 8) + 128;
        let v_val = ((112 * avg_r - 94 * avg_g - 18 * avg_b + 128) >> 8) + 128;

        dst_u[x2] = u_val.clamp(16, 240) as u8;
        dst_v[x2] = v_val.clamp(16, 240) as u8;
    }
}

pub fn convert_rgba_to_yuv420p_parallel(
    rgba: &[u8],
    width: usize,
    height: usize,
    flip_y: bool,
) -> std::result::Result<Vec<u8>, String> {
    if width == 0 || height == 0 || width % 2 != 0 || height % 2 != 0 {
        return Err(format!(
            "Kích thước khung hình YUV420p không hợp lệ ({width}x{height}): cần dương và chẵn"
        ));
    }
    let total_pixels = width
        .checked_mul(height)
        .ok_or_else(|| "Tràn kích thước khung hình".to_string())?;
    let expected_rgba = total_pixels
        .checked_mul(4)
        .ok_or_else(|| "Tràn bộ đệm RGBA".to_string())?;
    if rgba.len() < expected_rgba {
        return Err(format!(
            "Bộ đệm RGBA thiếu dữ liệu: nhận {}, cần {}",
            rgba.len(),
            expected_rgba
        ));
    }

    let expected_yuv = (total_pixels * 3) / 2;
    let mut yuv = vec![0u8; expected_yuv];

    if total_pixels < PARALLEL_PIXEL_THRESHOLD {
        convert_rgba_to_yuv420p_slice(&rgba[..expected_rgba], width, height, flip_y, &mut yuv);
        return Ok(yuv);
    }

    let src = &rgba[..expected_rgba];
    let rgba_stride = width * 4;
    let half_w = width / 2;
    let uv_plane_len = total_pixels / 4;

    let (y_plane, uv_planes) = yuv.split_at_mut(total_pixels);
    let (u_plane, v_plane) = uv_planes.split_at_mut(uv_plane_len);

    rayon::join(
        || {
            y_plane
                .par_chunks_mut(width * Y_ROWS_PER_TASK)
                .enumerate()
                .for_each(|(chunk_idx, dst_band)| {
                    let y_base = chunk_idx * Y_ROWS_PER_TASK;
                    for (local_y, dst_row) in dst_band.chunks_exact_mut(width).enumerate() {
                        let y = y_base + local_y;
                        let src_y = if flip_y { height - 1 - y } else { y };
                        let src_off = src_y * rgba_stride;
                        convert_y_row(&src[src_off..src_off + rgba_stride], dst_row);
                    }
                });
        },
        || {
            u_plane
                .par_chunks_mut(half_w * UV_ROWS_PER_TASK)
                .zip(v_plane.par_chunks_mut(half_w * UV_ROWS_PER_TASK))
                .enumerate()
                .for_each(|(chunk_idx, (u_band, v_band))| {
                    let y2_base = chunk_idx * UV_ROWS_PER_TASK;
                    for (local_y2, (dst_u, dst_v)) in u_band
                        .chunks_exact_mut(half_w)
                        .zip(v_band.chunks_exact_mut(half_w))
                        .enumerate()
                    {
                        let y_top = (y2_base + local_y2) * 2;
                        let sy0 = if flip_y { height - 1 - y_top } else { y_top };
                        let sy1 = if flip_y { height - 2 - y_top } else { y_top + 1 };
                        let off0 = sy0 * rgba_stride;
                        let off1 = sy1 * rgba_stride;
                        convert_uv_row_pair(
                            &src[off0..off0 + rgba_stride],
                            &src[off1..off1 + rgba_stride],
                            dst_u,
                            dst_v,
                            half_w,
                        );
                    }
                });
        },
    );

    Ok(yuv)
}

pub struct RgbaToYuvTask {
    pub rgba: Uint8Array,
    pub width: usize,
    pub height: usize,
    pub flip_y: bool,
}

#[napi]
impl Task for RgbaToYuvTask {
    type Output = Vec<u8>;
    type JsValue = Uint8Array;

    fn compute(&mut self) -> Result<Self::Output> {
        convert_rgba_to_yuv420p_parallel(self.rgba.as_ref(), self.width, self.height, self.flip_y)
            .map_err(|msg| Error::new(Status::InvalidArg, msg))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(Uint8Array::new(output))
    }
}

#[napi(js_name = "napiRgbaToYuv420p")]
pub fn napi_rgba_to_yuv420p(
    rgba: &[u8],
    width: u32,
    height: u32,
    flip_y: Option<bool>,
) -> Result<Uint8Array> {
    let out = convert_rgba_to_yuv420p_parallel(
        rgba,
        width as usize,
        height as usize,
        flip_y.unwrap_or(true),
    )
    .map_err(|msg| Error::new(Status::InvalidArg, msg))?;
    Ok(Uint8Array::new(out))
}

#[napi(js_name = "napiRgbaToYuv420pAsync")]
pub fn napi_rgba_to_yuv420p_async(
    rgba: Uint8Array,
    width: u32,
    height: u32,
    flip_y: Option<bool>,
) -> AsyncTask<RgbaToYuvTask> {
    AsyncTask::new(RgbaToYuvTask {
        rgba,
        width: width as usize,
        height: height as usize,
        flip_y: flip_y.unwrap_or(true),
    })
}
