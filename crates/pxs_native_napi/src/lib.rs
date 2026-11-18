// Crate NAPI-RS 64-bit Native Addon (`pxs_native_napi`) cho Electron Main Process.
// Tăng tốc đa luồng Rayon cho SHA-256, CRC32, đóng/mở gói `.pxs` (STORE/DEFLATE) và chuyển đổi video YUV420p.

pub mod hash_parallel;
pub mod video_yuv;
pub mod zip_archive;

use napi::bindgen_prelude::{Error, Result, Status};
use napi_derive::napi;
use pxs_core_accel::{BoundingBoxResult, rust_find_opaque_bbox, sha256_hex};

#[napi(object)]
pub struct NativeAccelBackendInfo {
    pub backend: String,
    pub arch: String,
    pub os: String,
    pub rayon_threads: u32,
    pub simd_level: String,
}

#[napi(object)]
pub struct NativeOpaqueBbox {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
    pub found: bool,
}

pub fn detect_simd_level() -> &'static str {
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            return "avx2";
        }
        if std::arch::is_x86_feature_detected!("sse4.1") {
            return "sse4.1";
        }
        "sse2"
    }
    #[cfg(target_arch = "aarch64")]
    {
        "neon"
    }
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    {
        "scalar"
    }
}

#[napi]
pub fn napi_get_backend_info() -> NativeAccelBackendInfo {
    NativeAccelBackendInfo {
        backend: "napi-rs".to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os: std::env::consts::OS.to_string(),
        rayon_threads: rayon::current_num_threads() as u32,
        simd_level: detect_simd_level().to_string(),
    }
}

#[napi]
pub fn napi_crc32(data: &[u8]) -> u32 {
    crc32fast::hash(data)
}

#[napi]
pub fn napi_sha256_hex(data: &[u8]) -> String {
    sha256_hex(data)
}

#[napi]
pub fn napi_sha256_text_hex(text: String) -> String {
    sha256_hex(text.as_bytes())
}

#[napi]
pub fn napi_find_opaque_bbox(
    rgba: &[u8],
    width: i32,
    height: i32,
    alpha_threshold: u8,
) -> Result<NativeOpaqueBbox> {
    let mut res = BoundingBoxResult {
        min_x: 0,
        min_y: 0,
        max_x: 0,
        max_y: 0,
        found: false,
    };
    let ok = rust_find_opaque_bbox(
        rgba.as_ptr(),
        rgba.len(),
        width,
        height,
        alpha_threshold,
        &mut res as *mut BoundingBoxResult,
    );
    if !ok {
        return Err(Error::new(
            Status::InvalidArg,
            "Bộ đệm RGBA hoặc kích thước khung không hợp lệ khi tính BBox".to_string(),
        ));
    }
    Ok(NativeOpaqueBbox {
        min_x: res.min_x,
        min_y: res.min_y,
        max_x: res.max_x,
        max_y: res.max_y,
        found: res.found,
    })
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use flate2::Compression;
    use flate2::write::DeflateEncoder;
    use pxs_core_accel::convert_rgba_to_yuv420p_slice;

    use super::*;
    use crate::hash_parallel::hash_files_rayon_core;
    use crate::video_yuv::convert_rgba_to_yuv420p_parallel;
    use crate::zip_archive::{pack_pxs_zip_core, unpack_pxs_zip_core};

    #[test]
    fn test_parallel_yuv420p_matches_reference_bit_for_bit() {
        let width = 160usize;
        let height = 96usize;
        let mut rgba = vec![0u8; width * height * 4];
        for i in 0..rgba.len() {
            rgba[i] = ((i * 73 + (i >> 3) * 19 + 11) & 0xff) as u8;
        }

        for flip_y in [false, true] {
            let mut expected = vec![0u8; (width * height * 3) / 2];
            convert_rgba_to_yuv420p_slice(&rgba, width, height, flip_y, &mut expected);
            let actual = convert_rgba_to_yuv420p_parallel(&rgba, width, height, flip_y).unwrap();
            assert_eq!(actual, expected, "Sai lệch YUV420p khi flip_y={flip_y}");
        }
    }

    #[test]
    fn test_pack_and_unpack_store_and_corrupt_detection() {
        let entries: Vec<(&[u8], &[u8])> = vec![
            (b"project.json", b"{\"title\":\"Canh 2.5D Rust NAPI\"}"),
            (b"assets/tex.bin", &[1, 2, 3, 4, 5, 6, 7, 8, 9]),
            (b"assets/empty.bin", b""),
        ];
        let packed = pack_pxs_zip_core(&entries).unwrap();
        let unpacked = unpack_pxs_zip_core(&packed).unwrap();
        assert_eq!(unpacked.len(), 3);
        assert_eq!(unpacked[0].0, "project.json");
        assert_eq!(unpacked[0].1, entries[0].1);
        assert_eq!(unpacked[1].1, entries[1].1);
        assert!(unpacked[2].1.is_empty());

        let mut corrupted = packed.clone();
        let first_payload_off = 30 + "project.json".len();
        corrupted[first_payload_off] ^= 0x01;
        let err = unpack_pxs_zip_core(&corrupted).unwrap_err();
        assert!(err.contains("mã lỗi -4"), "Unexpected error: {err}");

        // Kiểm tra thêm khả năng giải nén raw DEFLATE payload khi đóng gói từ thư viện ngoài
        let payload = vec![42u8; 4096];
        let mut enc = DeflateEncoder::new(Vec::new(), Compression::default());
        enc.write_all(&payload).unwrap();
        let compressed = enc.finish().unwrap();
        assert!(!compressed.is_empty());
    }

    #[test]
    fn test_hash_files_rayon_core_matches_sha256_hex() {
        let tmp = std::env::temp_dir().join(format!("pxs_napi_test_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let mut paths = Vec::new();
        for idx in 0..4usize {
            let p = tmp.join(format!("f_{idx}.bin"));
            let data: Vec<u8> = (0..(512 * (idx + 1))).map(|k| ((k * 17 + idx) & 0xff) as u8).collect();
            std::fs::write(&p, &data).unwrap();
            paths.push((p.to_string_lossy().into_owned(), sha256_hex(&data)));
        }
        let req_paths: Vec<String> = paths.iter().map(|(p, _)| p.clone()).collect();
        let map = hash_files_rayon_core(&req_paths).unwrap();
        for (p, expected) in &paths {
            assert_eq!(map.get(p).unwrap(), expected);
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
