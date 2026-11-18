// Đóng và giải nén gói `.pxs` (PKZIP UTF-8 STORE & DEFLATE) trên bộ nhớ 64-bit đa luồng Rayon.

use std::io::Read;

use flate2::read::DeflateDecoder;
use napi::bindgen_prelude::{AsyncTask, Env, Error, Result, Status, Task, Uint8Array};
use napi_derive::napi;
use pxs_core_accel::{rust_probe_pxs_zip, rust_read_pxs_zip_index};
use rayon::prelude::*;

const LFH_SIG: u32 = 0x0403_4b50;
const CDH_SIG: u32 = 0x0201_4b50;
const EOCD_SIG: u32 = 0x0605_4b50;
const UTF8_FLAG: u16 = 0x0800;

#[napi(object)]
pub struct NativePxsEntryInput {
    pub name: String,
    pub data: Uint8Array,
}

#[napi(object)]
pub struct NativePxsEntryOutput {
    pub name: String,
    pub data: Uint8Array,
}

#[inline]
fn push_u16(out: &mut [u8], off: usize, v: u16) {
    out[off..off + 2].copy_from_slice(&v.to_le_bytes());
}

#[inline]
fn push_u32(out: &mut [u8], off: usize, v: u32) {
    out[off..off + 4].copy_from_slice(&v.to_le_bytes());
}

pub fn pack_pxs_zip_core(entries: &[(&[u8], &[u8])]) -> std::result::Result<Vec<u8>, String> {
    let count = entries.len();
    if count > u16::MAX as usize {
        return Err("Số lượng tệp trong gói .pxs vượt giới hạn ZIP tiêu chuẩn (65535)".to_string());
    }

    let mut total_size = 22u64;
    for &(name, data) in entries {
        let nlen = name.len() as u64;
        let dlen = data.len() as u64;
        if nlen > u16::MAX as u64 {
            return Err("Tên tệp trong gói .pxs quá dài (> 65535 byte)".to_string());
        }
        total_size = total_size
            .checked_add(30 + nlen + dlen + 46 + nlen)
            .ok_or_else(|| "Kích thước gói .pxs vượt giới hạn số học".to_string())?;
    }
    if total_size > u32::MAX as u64 {
        return Err("Kích thước gói .pxs vượt giới hạn ZIP 32-bit".to_string());
    }

    let crcs: Vec<u32> = if count > 1 {
        entries.par_iter().map(|&(_, d)| crc32fast::hash(d)).collect()
    } else {
        entries.iter().map(|&(_, d)| crc32fast::hash(d)).collect()
    };

    let mut out = vec![0u8; total_size as usize];
    let mut local_offs = vec![0u32; count];
    let mut cursor = 0usize;

    for (i, &(name, data)) in entries.iter().enumerate() {
        local_offs[i] = cursor as u32;
        let crc = crcs[i];
        let nlen = name.len() as u16;
        let dlen = data.len() as u32;
        push_u32(&mut out, cursor, LFH_SIG);
        push_u16(&mut out, cursor + 4, 20);
        push_u16(&mut out, cursor + 6, UTF8_FLAG);
        push_u16(&mut out, cursor + 8, 0);
        push_u32(&mut out, cursor + 10, 0);
        push_u32(&mut out, cursor + 14, crc);
        push_u32(&mut out, cursor + 18, dlen);
        push_u32(&mut out, cursor + 22, dlen);
        push_u16(&mut out, cursor + 26, nlen);
        push_u16(&mut out, cursor + 28, 0);
        let name_start = cursor + 30;
        out[name_start..name_start + name.len()].copy_from_slice(name);
        let data_start = name_start + name.len();
        out[data_start..data_start + data.len()].copy_from_slice(data);
        cursor = data_start + data.len();
    }

    let cd_start = cursor;
    for (i, &(name, data)) in entries.iter().enumerate() {
        let dlen = data.len() as u32;
        push_u32(&mut out, cursor, CDH_SIG);
        push_u16(&mut out, cursor + 4, 20);
        push_u16(&mut out, cursor + 6, 20);
        push_u16(&mut out, cursor + 8, UTF8_FLAG);
        push_u16(&mut out, cursor + 10, 0);
        push_u32(&mut out, cursor + 12, 0);
        push_u32(&mut out, cursor + 16, crcs[i]);
        push_u32(&mut out, cursor + 20, dlen);
        push_u32(&mut out, cursor + 24, dlen);
        push_u16(&mut out, cursor + 28, name.len() as u16);
        push_u16(&mut out, cursor + 30, 0);
        push_u16(&mut out, cursor + 32, 0);
        push_u16(&mut out, cursor + 34, 0);
        push_u16(&mut out, cursor + 36, 0);
        push_u32(&mut out, cursor + 38, 0);
        push_u32(&mut out, cursor + 42, local_offs[i]);
        let name_start = cursor + 46;
        out[name_start..name_start + name.len()].copy_from_slice(name);
        cursor = name_start + name.len();
    }

    let cd_size = (cursor - cd_start) as u32;
    push_u32(&mut out, cursor, EOCD_SIG);
    push_u32(&mut out, cursor + 4, 0);
    push_u16(&mut out, cursor + 8, count as u16);
    push_u16(&mut out, cursor + 10, count as u16);
    push_u32(&mut out, cursor + 12, cd_size);
    push_u32(&mut out, cursor + 16, cd_start as u32);
    push_u16(&mut out, cursor + 20, 0);
    Ok(out)
}

fn inflate_deflate_entry(
    raw_slice: &[u8],
    uncomp_size: usize,
    expected_crc: u32,
    name: &str,
) -> std::result::Result<Vec<u8>, String> {
    let mut decoder = DeflateDecoder::new(raw_slice);
    let mut inflated = Vec::with_capacity(uncomp_size);
    decoder
        .read_to_end(&mut inflated)
        .map_err(|e| format!("Giải nén DEFLATE lỗi tại {name}: {e}"))?;
    if inflated.len() != uncomp_size {
        return Err(format!("Kích thước giải nén DEFLATE không khớp tại {name}"));
    }
    if crc32fast::hash(&inflated) != expected_crc {
        return Err(format!("Sai checksum CRC32 tại {name}"));
    }
    Ok(inflated)
}

pub fn unpack_pxs_zip_core(
    zip_bytes: &[u8],
) -> std::result::Result<Vec<(String, Vec<u8>)>, String> {
    if zip_bytes.len() < 22 {
        return Err("Tệp .pxs không hợp lệ (quá nhỏ)".to_string());
    }

    let mut pair = [0u32; 2];
    let ok_probe = unsafe {
        rust_probe_pxs_zip(zip_bytes.as_ptr(), zip_bytes.len(), pair.as_mut_ptr())
    };
    if ok_probe != 1 {
        return Err(format!("Header ZIP .pxs không hợp lệ (mã {ok_probe})"));
    }

    let count = pair[0] as usize;
    let names_len = pair[1] as usize;
    if count == 0 {
        return Ok(Vec::new());
    }

    let mut meta = vec![0u32; count * 7];
    let mut names_buf = vec![0u8; names_len];
    let read_count = unsafe {
        rust_read_pxs_zip_index(
            zip_bytes.as_ptr(),
            zip_bytes.len(),
            meta.as_mut_ptr(),
            count,
            if names_len > 0 { names_buf.as_mut_ptr() } else { core::ptr::null_mut() },
            names_len,
        )
    };
    if read_count < 0 {
        return Err(format!("Không thể đọc chỉ mục .pxs (mã lỗi {read_count})"));
    }

    let n = read_count as usize;
    (0..n)
        .into_par_iter()
        .map(|i| {
            let b = i * 7;
            let name_off = meta[b] as usize;
            let name_len = meta[b + 1] as usize;
            let data_off = meta[b + 2] as usize;
            let comp_size = meta[b + 3] as usize;
            let uncomp_size = meta[b + 4] as usize;
            let method = meta[b + 5];
            let expected_crc = meta[b + 6];

            let name = String::from_utf8_lossy(&names_buf[name_off..name_off + name_len]).into_owned();
            let raw_slice = &zip_bytes[data_off..data_off + comp_size];
            match method {
                0 => Ok((name, raw_slice.to_vec())),
                8 => {
                    let inflated = inflate_deflate_entry(raw_slice, uncomp_size, expected_crc, &name)?;
                    Ok((name, inflated))
                }
                _ => Err(format!("Phương thức nén ZIP không được hỗ trợ ({method}) tại {name}")),
            }
        })
        .collect()
}

pub struct PackPxsTask {
    pub owned_entries: Vec<(Vec<u8>, Vec<u8>)>,
}

#[napi]
impl Task for PackPxsTask {
    type Output = Vec<u8>;
    type JsValue = Uint8Array;

    fn compute(&mut self) -> Result<Self::Output> {
        let refs: Vec<(&[u8], &[u8])> = self
            .owned_entries
            .iter()
            .map(|(n, d)| (n.as_slice(), d.as_slice()))
            .collect();
        pack_pxs_zip_core(&refs).map_err(|msg| Error::new(Status::GenericFailure, msg))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(Uint8Array::new(output))
    }
}

#[napi]
pub fn napi_pack_pxs_zip(entries: Vec<NativePxsEntryInput>) -> Result<Uint8Array> {
    let refs: Vec<(&[u8], &[u8])> = entries
        .iter()
        .map(|e| (e.name.as_bytes(), e.data.as_ref()))
        .collect();
    let out = pack_pxs_zip_core(&refs).map_err(|msg| Error::new(Status::GenericFailure, msg))?;
    Ok(Uint8Array::new(out))
}

#[napi]
pub fn napi_pack_pxs_zip_async(entries: Vec<NativePxsEntryInput>) -> AsyncTask<PackPxsTask> {
    let owned_entries = entries
        .into_iter()
        .map(|e| (e.name.into_bytes(), e.data.to_vec()))
        .collect();
    AsyncTask::new(PackPxsTask { owned_entries })
}

#[napi]
pub fn napi_unpack_pxs_zip(zip_bytes: &[u8]) -> Result<Vec<NativePxsEntryOutput>> {
    let items = unpack_pxs_zip_core(zip_bytes).map_err(|msg| Error::new(Status::GenericFailure, msg))?;
    Ok(items
        .into_iter()
        .map(|(name, data)| NativePxsEntryOutput {
            name,
            data: Uint8Array::new(data),
        })
        .collect())
}
