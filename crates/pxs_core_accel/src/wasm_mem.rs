use std::cell::RefCell;

struct ScratchArena {
    buf: Vec<u128>,
    offset: usize,
}

impl ScratchArena {
    fn new() -> Self {
        Self {
            buf: Vec::new(),
            offset: 0,
        }
    }

    fn reset(&mut self) {
        self.offset = 0;
    }

    fn capacity_bytes(&self) -> usize {
        self.buf.len() * std::mem::size_of::<u128>()
    }

    fn reserve_bytes(&mut self, total_bytes: usize) {
        if total_bytes > self.capacity_bytes() {
            let needed_blocks = total_bytes.div_ceil(std::mem::size_of::<u128>());
            let next_blocks = needed_blocks.max(self.buf.len().saturating_mul(2)).max(256);
            self.buf.resize(next_blocks, 0);
        }
    }

    fn alloc(&mut self, byte_len: usize, align: usize) -> *mut u8 {
        let eff_align = if align == 0 {
            16
        } else {
            align.max(16).next_power_of_two()
        };
        let size = byte_len.max(1);
        let needed_bytes = self.offset.saturating_add(eff_align).saturating_add(size);

        if needed_bytes > self.capacity_bytes() {
            let needed_blocks = needed_bytes.div_ceil(std::mem::size_of::<u128>());
            let next_blocks = needed_blocks.max(self.buf.len().saturating_mul(2)).max(256);
            self.buf.resize(next_blocks, 0);
        }

        let base = self.buf.as_mut_ptr() as usize;
        let mask = eff_align - 1;
        let aligned = (base + self.offset + mask) & !mask;
        self.offset = (aligned - base) + size;
        aligned as *mut u8
    }
}

thread_local! {
    static SCRATCH: RefCell<ScratchArena> = RefCell::new(ScratchArena::new());
}

/// Đặt lại con trỏ cấp phát về 0 ở đầu mỗi lượt gọi mà giữ nguyên dung lượng đã cấp phát.
#[unsafe(no_mangle)]
pub extern "C" fn wasm_scratch_reset() {
    SCRATCH.with(|cell| cell.borrow_mut().reset());
}

/// Dự trữ đủ tổng dung lượng scratch trước khi cấp phát hàng loạt slot (ngăn di dời địa chỉ `Vec` giữa batch).
#[unsafe(no_mangle)]
pub extern "C" fn wasm_scratch_reserve(total_bytes: usize) {
    SCRATCH.with(|cell| cell.borrow_mut().reserve_bytes(total_bytes));
}

/// Cấp phát vùng nhớ đệm căn chỉnh bội số 16 byte cho SIMD128 từ linear memory.
#[unsafe(no_mangle)]
pub extern "C" fn wasm_scratch_alloc(byte_len: usize, align: usize) -> *mut u8 {
    SCRATCH.with(|cell| cell.borrow_mut().alloc(byte_len, align))
}

/// Trả về tổng dung lượng byte hiện có của bộ nhớ đệm scratch.
#[unsafe(no_mangle)]
pub extern "C" fn wasm_scratch_capacity() -> usize {
    SCRATCH.with(|cell| cell.borrow().capacity_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scratch_alloc_alignment_and_reuse() {
        wasm_scratch_reset();
        wasm_scratch_reserve(32 + 12 + 32 + 9600);
        let p1 = wasm_scratch_alloc(12, 4);
        assert!(!p1.is_null());
        assert_eq!((p1 as usize) % 16, 0);

        let cap_before = wasm_scratch_capacity();
        let p2 = wasm_scratch_alloc(9600, 16);
        assert_eq!((p2 as usize) % 16, 0);
        assert!(p2 as usize >= p1 as usize + 12);
        // Sau reserve trước batch, cấp phát slot lớn không làm di dời hay resize lại Vec
        assert_eq!(wasm_scratch_capacity(), cap_before);

        wasm_scratch_reset();
        let p3 = wasm_scratch_alloc(12, 4);
        assert_eq!(p3, p1);
        assert_eq!(wasm_scratch_capacity(), cap_before);

        let p_large = wasm_scratch_alloc(64 * 1024, 32);
        assert_eq!((p_large as usize) % 32, 0);
        assert!(wasm_scratch_capacity() >= 64 * 1024);
    }
}
