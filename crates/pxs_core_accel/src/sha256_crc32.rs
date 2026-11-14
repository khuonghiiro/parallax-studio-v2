// Băm SHA-256 (FIPS 180-4) và CRC32 (IEEE 802.3) thuần Rust `std` dùng chung cho Main & Renderer WASM.

const CRC32_TABLE: [u32; 256] = {
    let mut table = [0u32; 256];
    let mut i = 0usize;
    while i < 256 {
        let mut c = i as u32;
        let mut k = 0usize;
        while k < 8 {
            c = if (c & 1) != 0 {
                0xEDB8_8320 ^ (c >> 1)
            } else {
                c >> 1
            };
            k += 1;
        }
        table[i] = c;
        i += 1;
    }
    table
};

const SHA256_INIT: [u32; 8] = [
    0x6a09_e667,
    0xbb67_ae85,
    0x3c6e_f372,
    0xa54f_f53a,
    0x510e_527f,
    0x9b05_688c,
    0x1f83_d9ab,
    0x5be0_cd19,
];

const SHA256_K: [u32; 64] = [
    0x428a_2f98, 0x7137_4491, 0xb5c0_fbcf, 0xe9b5_dba5, 0x3956_c25b, 0x59f1_11f1, 0x923f_82a4,
    0xab1c_5ed5, 0xd807_aa98, 0x1283_5b01, 0x2431_85be, 0x550c_7dc3, 0x72be_5d74, 0x80de_b1fe,
    0x9bdc_06a7, 0xc19b_f174, 0xe49b_69c1, 0xefbe_4786, 0x0fc1_9dc6, 0x240c_a1cc, 0x2de9_2c6f,
    0x4a74_84aa, 0x5cb0_a9dc, 0x76f9_88da, 0x983e_5152, 0xa831_c66d, 0xb003_27c8, 0xbf59_7fc7,
    0xc6e0_0bf3, 0xd5a7_9147, 0x06ca_6351, 0x1429_2967, 0x27b7_0a85, 0x2e1b_2138, 0x4d2c_6dfc,
    0x5338_0d13, 0x650a_7354, 0x766a_0abb, 0x81c2_c92e, 0x9272_2c85, 0xa2bf_e8a1, 0xa81a_664b,
    0xc24b_8b70, 0xc76c_51a3, 0xd192_e819, 0xd699_0624, 0xf40e_3585, 0x106a_a070, 0x19a4_c116,
    0x1e37_6c08, 0x2748_774c, 0x34b0_bcb5, 0x391c_0cb3, 0x4ed8_aa4a, 0x5b9c_ca4f, 0x682e_6ff3,
    0x748f_82ee, 0x78a5_636f, 0x84c8_7814, 0x8cc7_0208, 0x90be_fffa, 0xa450_6ceb, 0xbef9_a3f7,
    0xc671_78f2,
];

#[inline]
pub(crate) fn crc32_slice(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &b in data {
        crc = CRC32_TABLE[((crc ^ b as u32) & 0xFF) as usize] ^ (crc >> 8);
    }
    crc ^ 0xFFFF_FFFF
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_crc32(data_ptr: *const u8, len: usize) -> u32 {
    if len == 0 || data_ptr.is_null() {
        return 0;
    }
    let slice = unsafe { core::slice::from_raw_parts(data_ptr, len) };
    crc32_slice(slice)
}

#[inline]
fn sha256_compress(state: &mut [u32; 8], block: &[u8]) {
    let mut w = [0u32; 64];
    for i in 0..16 {
        let j = i * 4;
        w[i] = u32::from_be_bytes([block[j], block[j + 1], block[j + 2], block[j + 3]]);
    }
    for i in 16..64 {
        let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
        let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16]
            .wrapping_add(s0)
            .wrapping_add(w[i - 7])
            .wrapping_add(s1);
    }

    let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = *state;
    for i in 0..64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let temp1 = h
            .wrapping_add(s1)
            .wrapping_add(ch)
            .wrapping_add(SHA256_K[i])
            .wrapping_add(w[i]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = s0.wrapping_add(maj);

        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(temp1);
        d = c;
        c = b;
        b = a;
        a = temp1.wrapping_add(temp2);
    }

    let delta = [a, b, c, d, e, f, g, h];
    for i in 0..8 {
        state[i] = state[i].wrapping_add(delta[i]);
    }
}

pub(crate) fn sha256_bytes(data: &[u8]) -> [u8; 32] {
    let mut state = SHA256_INIT;
    let mut off = 0usize;
    while off + 64 <= data.len() {
        sha256_compress(&mut state, &data[off..off + 64]);
        off += 64;
    }

    let rem = data.len() - off;
    let mut tail = [0u8; 128];
    tail[..rem].copy_from_slice(&data[off..]);
    tail[rem] = 0x80;

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let block_count = if rem < 56 { 1usize } else { 2usize };
    let len_off = block_count * 64 - 8;
    tail[len_off..len_off + 8].copy_from_slice(&bit_len.to_be_bytes());

    sha256_compress(&mut state, &tail[..64]);
    if block_count == 2 {
        sha256_compress(&mut state, &tail[64..128]);
    }

    let mut out = [0u8; 32];
    for i in 0..8 {
        out[i * 4..i * 4 + 4].copy_from_slice(&state[i].to_be_bytes());
    }
    out
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_sha256(
    data_ptr: *const u8,
    len: usize,
    out32_ptr: *mut u8,
) -> i32 {
    if out32_ptr.is_null() {
        return 0;
    }
    let slice = if len == 0 || data_ptr.is_null() {
        if len > 0 {
            return 0;
        }
        &[]
    } else {
        unsafe { core::slice::from_raw_parts(data_ptr, len) }
    };
    let digest = sha256_bytes(slice);
    let out = unsafe { core::slice::from_raw_parts_mut(out32_ptr, 32) };
    out.copy_from_slice(&digest);
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    fn to_hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    }

    #[test]
    fn test_sha256_nist_vectors_and_crc32() {
        assert_eq!(
            to_hex(&sha256_bytes(b"")),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            to_hex(&sha256_bytes(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            to_hex(&sha256_bytes(
                b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
            )),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
        assert_eq!(crc32_slice(b"123456789"), 0xCBF4_3926);
    }
}
