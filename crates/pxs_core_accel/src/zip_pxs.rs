// Đóng và mở gói `.pxs` (chuẩn PKZIP 32-bit UTF-8 STORE/DEFLATE index) với CRC32 kiểm tra toàn vẹn.

use crate::sha256_crc32::crc32_slice;

const LFH_SIG: u32 = 0x0403_4b50;
const CDH_SIG: u32 = 0x0201_4b50;
const EOCD_SIG: u32 = 0x0605_4b50;
const UTF8_FLAG: u16 = 0x0800;

#[inline]
fn read_u16(b: &[u8], off: usize) -> u16 {
    u16::from_le_bytes([b[off], b[off + 1]])
}

#[inline]
fn read_u32(b: &[u8], off: usize) -> u32 {
    u32::from_le_bytes([b[off], b[off + 1], b[off + 2], b[off + 3]])
}

#[inline]
fn push_u16(out: &mut [u8], off: usize, v: u16) {
    out[off..off + 2].copy_from_slice(&v.to_le_bytes());
}

#[inline]
fn push_u32(out: &mut [u8], off: usize, v: u32) {
    out[off..off + 4].copy_from_slice(&v.to_le_bytes());
}

fn find_eocd(zip: &[u8]) -> Option<usize> {
    if zip.len() < 22 {
        return None;
    }
    let min_pos = zip.len().saturating_sub(22 + 65535);
    let mut pos = zip.len() - 22;
    loop {
        if read_u32(zip, pos) == EOCD_SIG {
            let comment_len = read_u16(zip, pos + 20) as usize;
            if pos + 22 + comment_len == zip.len() {
                return Some(pos);
            }
        }
        if pos <= min_pos {
            break;
        }
        pos -= 1;
    }
    None
}

fn write_local_entry(
    out: &mut [u8],
    pos: usize,
    name: &[u8],
    data: &[u8],
    crc: u32,
) -> usize {
    let nlen = name.len() as u16;
    let dlen = data.len() as u32;
    push_u32(out, pos, LFH_SIG);
    push_u16(out, pos + 4, 20);
    push_u16(out, pos + 6, UTF8_FLAG);
    push_u16(out, pos + 8, 0);
    push_u32(out, pos + 10, 0);
    push_u32(out, pos + 14, crc);
    push_u32(out, pos + 18, dlen);
    push_u32(out, pos + 22, dlen);
    push_u16(out, pos + 26, nlen);
    push_u16(out, pos + 28, 0);
    let name_start = pos + 30;
    out[name_start..name_start + name.len()].copy_from_slice(name);
    let data_start = name_start + name.len();
    out[data_start..data_start + data.len()].copy_from_slice(data);
    data_start + data.len()
}

fn write_central_entry(
    out: &mut [u8],
    pos: usize,
    name: &[u8],
    dlen: u32,
    crc: u32,
    local_off: u32,
) -> usize {
    push_u32(out, pos, CDH_SIG);
    push_u16(out, pos + 4, 20);
    push_u16(out, pos + 6, 20);
    push_u16(out, pos + 8, UTF8_FLAG);
    push_u16(out, pos + 10, 0);
    push_u32(out, pos + 12, 0);
    push_u32(out, pos + 16, crc);
    push_u32(out, pos + 20, dlen);
    push_u32(out, pos + 24, dlen);
    push_u16(out, pos + 28, name.len() as u16);
    push_u16(out, pos + 30, 0);
    push_u16(out, pos + 32, 0);
    push_u16(out, pos + 34, 0);
    push_u16(out, pos + 36, 0);
    push_u32(out, pos + 38, 0);
    push_u32(out, pos + 42, local_off);
    let name_start = pos + 46;
    out[name_start..name_start + name.len()].copy_from_slice(name);
    name_start + name.len()
}

/// Tính tổng kích thước (byte) của gói `.pxs` STORE cho `count` file. Trả về `0` nếu không hợp lệ/tràn 32-bit.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_calc_pxs_store_zip_size(
    count: usize,
    meta_u32_ptr: *const u32,
) -> u32 {
    if count > u16::MAX as usize {
        return 0;
    }
    if count == 0 {
        return 22;
    }
    if meta_u32_ptr.is_null() {
        return 0;
    }
    let meta = unsafe { core::slice::from_raw_parts(meta_u32_ptr, count * 4) };
    let mut total = 22u64;
    for i in 0..count {
        let nlen = meta[i * 4 + 1] as u64;
        let dlen = meta[i * 4 + 3] as u64;
        if nlen > u16::MAX as u64 {
            return 0;
        }
        total = match total.checked_add(30 + nlen + dlen + 46 + nlen) {
            Some(v) => v,
            None => return 0,
        };
    }
    if total > u32::MAX as u64 {
        0
    } else {
        total as u32
    }
}

/// Đóng gói mảng file thành file ZIP chuẩn (nén STORE, CRC32 chuẩn). Trả số byte đã ghi (`0` nếu lỗi).
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_pack_pxs_store_zip(
    count: usize,
    meta_u32_ptr: *const u32,
    names_ptr: *const u8,
    names_len: usize,
    blob_ptr: *const u8,
    blob_len: usize,
    out_ptr: *mut u8,
    out_cap: usize,
) -> u32 {
    if count > u16::MAX as usize || out_ptr.is_null() {
        return 0;
    }
    let need = unsafe { rust_calc_pxs_store_zip_size(count, meta_u32_ptr) } as usize;
    if need == 0 || out_cap < need {
        return 0;
    }
    let out = unsafe { core::slice::from_raw_parts_mut(out_ptr, need) };
    let meta = if count == 0 {
        &[]
    } else {
        unsafe { core::slice::from_raw_parts(meta_u32_ptr, count * 4) }
    };
    let names = if names_len == 0 || names_ptr.is_null() {
        &[]
    } else {
        unsafe { core::slice::from_raw_parts(names_ptr, names_len) }
    };
    let blobs = if blob_len == 0 || blob_ptr.is_null() {
        &[]
    } else {
        unsafe { core::slice::from_raw_parts(blob_ptr, blob_len) }
    };

    let mut crcs = vec![0u32; count];
    let mut local_offs = vec![0u32; count];
    let mut cursor = 0usize;

    for i in 0..count {
        let noff = meta[i * 4] as usize;
        let nlen = meta[i * 4 + 1] as usize;
        let doff = meta[i * 4 + 2] as usize;
        let dlen = meta[i * 4 + 3] as usize;
        if noff + nlen > names.len() || doff + dlen > blobs.len() {
            return 0;
        }
        let crc = crc32_slice(&blobs[doff..doff + dlen]);
        crcs[i] = crc;
        local_offs[i] = cursor as u32;
        cursor = write_local_entry(
            out,
            cursor,
            &names[noff..noff + nlen],
            &blobs[doff..doff + dlen],
            crc,
        );
    }

    let cd_start = cursor;
    for i in 0..count {
        let noff = meta[i * 4] as usize;
        let nlen = meta[i * 4 + 1] as usize;
        let dlen = meta[i * 4 + 3];
        cursor = write_central_entry(
            out,
            cursor,
            &names[noff..noff + nlen],
            dlen,
            crcs[i],
            local_offs[i],
        );
    }

    let cd_size = (cursor - cd_start) as u32;
    push_u32(out, cursor, EOCD_SIG);
    push_u32(out, cursor + 4, 0);
    push_u16(out, cursor + 8, count as u16);
    push_u16(out, cursor + 10, count as u16);
    push_u32(out, cursor + 12, cd_size);
    push_u32(out, cursor + 16, cd_start as u32);
    push_u16(out, cursor + 20, 0);
    (cursor + 22) as u32
}

/// Kiểm tra header ZIP & đếm số entry + tổng độ dài tên (`out_pair_u32_ptr[0..2]`).
/// Trả `1` nếu hợp lệ, mã `<= 0` nếu hỏng hoặc ZIP64.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_probe_pxs_zip(
    zip_ptr: *const u8,
    zip_len: usize,
    out_pair_u32_ptr: *mut u32,
) -> i32 {
    if zip_ptr.is_null() || out_pair_u32_ptr.is_null() || zip_len < 22 {
        return 0;
    }
    let zip = unsafe { core::slice::from_raw_parts(zip_ptr, zip_len) };
    let Some(eocd) = find_eocd(zip) else {
        return -1;
    };
    let count = read_u16(zip, eocd + 10) as usize;
    let cd_size = read_u32(zip, eocd + 12) as usize;
    let cd_off = read_u32(zip, eocd + 16) as usize;
    if count == 0xFFFF || cd_size == 0xFFFF_FFFF || cd_off == 0xFFFF_FFFF {
        return -2;
    }
    if cd_off + cd_size > eocd {
        return -1;
    }
    let mut cur = cd_off;
    let mut names_bytes = 0u32;
    for _ in 0..count {
        if cur + 46 > cd_off + cd_size || read_u32(zip, cur) != CDH_SIG {
            return -1;
        }
        let nlen = read_u16(zip, cur + 28) as usize;
        let elen = read_u16(zip, cur + 30) as usize;
        let clen = read_u16(zip, cur + 32) as usize;
        if cur + 46 + nlen + elen + clen > cd_off + cd_size {
            return -1;
        }
        names_bytes = match names_bytes.checked_add(nlen as u32) {
            Some(v) => v,
            None => return -2,
        };
        cur += 46 + nlen + elen + clen;
    }
    let out = unsafe { core::slice::from_raw_parts_mut(out_pair_u32_ptr, 2) };
    out[0] = count as u32;
    out[1] = names_bytes;
    1
}

/// Đọc chỉ mục toàn bộ entry (STORE kiểm tra luôn CRC32; DEFLATE trả offset nén để tầng Host giải nén).
/// Mỗi entry ghi 7 u32: `[name_off, name_len, data_off, comp_size, uncomp_size, method, crc32]`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_read_pxs_zip_index(
    zip_ptr: *const u8,
    zip_len: usize,
    out_meta_u32_ptr: *mut u32,
    max_entries: usize,
    out_names_ptr: *mut u8,
    max_names_len: usize,
) -> i32 {
    if zip_ptr.is_null() || zip_len < 22 {
        return 0;
    }
    let zip = unsafe { core::slice::from_raw_parts(zip_ptr, zip_len) };
    let Some(eocd) = find_eocd(zip) else {
        return -1;
    };
    let count = read_u16(zip, eocd + 10) as usize;
    let cd_size = read_u32(zip, eocd + 12) as usize;
    let cd_off = read_u32(zip, eocd + 16) as usize;
    if count > max_entries || cd_off + cd_size > eocd {
        return -2;
    }
    if count == 0 {
        return 0;
    }
    if out_meta_u32_ptr.is_null() {
        return -2;
    }
    let out_meta = unsafe { core::slice::from_raw_parts_mut(out_meta_u32_ptr, count * 7) };
    let out_names = if max_names_len == 0 || out_names_ptr.is_null() {
        &mut []
    } else {
        unsafe { core::slice::from_raw_parts_mut(out_names_ptr, max_names_len) }
    };

    let mut cur = cd_off;
    let mut name_cursor = 0usize;
    for i in 0..count {
        if cur + 46 > cd_off + cd_size || read_u32(zip, cur) != CDH_SIG {
            return -1;
        }
        let method = read_u16(zip, cur + 10);
        if method != 0 && method != 8 {
            return -3;
        }
        let crc = read_u32(zip, cur + 16);
        let comp = read_u32(zip, cur + 20) as usize;
        let uncomp = read_u32(zip, cur + 24) as usize;
        let nlen = read_u16(zip, cur + 28) as usize;
        let elen = read_u16(zip, cur + 30) as usize;
        let clen = read_u16(zip, cur + 32) as usize;
        let lfh_off = read_u32(zip, cur + 42) as usize;
        if cur + 46 + nlen + elen + clen > cd_off + cd_size || name_cursor + nlen > out_names.len() {
            return -2;
        }
        if lfh_off + 30 > cd_off || read_u32(zip, lfh_off) != LFH_SIG {
            return -1;
        }
        let lfh_nlen = read_u16(zip, lfh_off + 26) as usize;
        let lfh_elen = read_u16(zip, lfh_off + 28) as usize;
        let data_off = lfh_off + 30 + lfh_nlen + lfh_elen;
        if data_off + comp > cd_off {
            return -1;
        }
        if method == 0 && (comp != uncomp || crc32_slice(&zip[data_off..data_off + comp]) != crc) {
            return -4;
        }
        out_names[name_cursor..name_cursor + nlen]
            .copy_from_slice(&zip[cur + 46..cur + 46 + nlen]);
        let base = i * 7;
        out_meta[base] = name_cursor as u32;
        out_meta[base + 1] = nlen as u32;
        out_meta[base + 2] = data_off as u32;
        out_meta[base + 3] = comp as u32;
        out_meta[base + 4] = uncomp as u32;
        out_meta[base + 5] = method as u32;
        out_meta[base + 6] = crc;
        name_cursor += nlen;
        cur += 46 + nlen + elen + clen;
    }
    count as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_and_read_pxs_store_zip_and_detect_corruption() {
        let files: [(&[u8], &[u8]); 3] = [
            (b"project.json", b"{\"name\":\"Canh Test\"}"),
            (b"assets/hero.png", &[137, 80, 78, 71, 13, 10, 26, 10, 0, 255]),
            (b"assets/empty.bin", b""),
        ];
        let mut names = Vec::new();
        let mut blobs = Vec::new();
        let mut in_meta = Vec::new();
        for (n, d) in files {
            in_meta.push(names.len() as u32);
            in_meta.push(n.len() as u32);
            in_meta.push(blobs.len() as u32);
            in_meta.push(d.len() as u32);
            names.extend_from_slice(n);
            blobs.extend_from_slice(d);
        }

        let need = unsafe { rust_calc_pxs_store_zip_size(3, in_meta.as_ptr()) } as usize;
        assert!(need > 100);
        let mut zip = vec![0u8; need];
        let written = unsafe {
            rust_pack_pxs_store_zip(
                3,
                in_meta.as_ptr(),
                names.as_ptr(),
                names.len(),
                blobs.as_ptr(),
                blobs.len(),
                zip.as_mut_ptr(),
                zip.len(),
            )
        };
        assert_eq!(written as usize, need);

        let mut pair = [0u32; 2];
        assert_eq!(unsafe { rust_probe_pxs_zip(zip.as_ptr(), zip.len(), pair.as_mut_ptr()) }, 1);
        assert_eq!(pair[0], 3);
        assert_eq!(pair[1] as usize, names.len());

        let mut out_meta = vec![0u32; 21];
        let mut out_names = vec![0u8; names.len()];
        let count = unsafe {
            rust_read_pxs_zip_index(
                zip.as_ptr(),
                zip.len(),
                out_meta.as_mut_ptr(),
                3,
                out_names.as_mut_ptr(),
                out_names.len(),
            )
        };
        assert_eq!(count, 3);
        for (i, (n, d)) in files.iter().enumerate() {
            let b = i * 7;
            let no = out_meta[b] as usize;
            let nl = out_meta[b + 1] as usize;
            let doff = out_meta[b + 2] as usize;
            let comp = out_meta[b + 3] as usize;
            assert_eq!(&out_names[no..no + nl], *n);
            assert_eq!(&zip[doff..doff + comp], *d);
        }

        let first_data = out_meta[2] as usize;
        zip[first_data] ^= 0x01;
        let bad = unsafe {
            rust_read_pxs_zip_index(
                zip.as_ptr(),
                zip.len(),
                out_meta.as_mut_ptr(),
                3,
                out_names.as_mut_ptr(),
                out_names.len(),
            )
        };
        assert_eq!(bad, -4);
    }
}
