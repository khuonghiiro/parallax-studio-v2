use std::cmp::Ordering;
use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

/// Bộ băm FNV/Fx tốc độ cao dùng cho chỉ mục không gian trong WASM (tránh kéo SipHash/RandomState nặng).
#[derive(Default)]
pub struct FxHasher64 {
    hash: u64,
}

impl Hasher for FxHasher64 {
    #[inline]
    fn finish(&self) -> u64 {
        self.hash
    }

    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.hash = self.hash.rotate_left(5) ^ (b as u64);
            self.hash = self.hash.wrapping_mul(0x517cc1b727220a95);
        }
    }

    #[inline]
    fn write_u32(&mut self, i: u32) {
        self.hash = (self.hash.rotate_left(5) ^ (i as u64)).wrapping_mul(0x517cc1b727220a95);
    }

    #[inline]
    fn write_i32(&mut self, i: i32) {
        self.write_u32(i as u32);
    }

    #[inline]
    fn write_u64(&mut self, i: u64) {
        self.hash = (self.hash.rotate_left(5) ^ i).wrapping_mul(0x517cc1b727220a95);
    }

    #[inline]
    fn write_usize(&mut self, i: usize) {
        self.write_u64(i as u64);
    }
}

pub type FastMap<K, V> = HashMap<K, V, BuildHasherDefault<FxHasher64>>;

#[derive(Clone, Copy)]
pub struct HeapItem {
    pub dist: f32,
    pub node: usize,
}

impl PartialEq for HeapItem {
    fn eq(&self, other: &Self) -> bool {
        self.dist == other.dist && self.node == other.node
    }
}
impl Eq for HeapItem {}
impl PartialOrd for HeapItem {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for HeapItem {
    fn cmp(&self, other: &Self) -> Ordering {
        other.dist.total_cmp(&self.dist).then_with(|| other.node.cmp(&self.node))
    }
}

pub struct SegProjection {
    pub dist: f64,
    pub proj_x: f64,
    pub proj_y: f64,
    pub raw_t: f64,
}

pub struct CsrGraph {
    pub v_count: usize,
    pub offsets: Vec<usize>,
    pub neighbors: Vec<u32>,
    pub lengths: Vec<f32>,
    pub avg_edge: f64,
}

pub struct AdjBuilder<'a> {
    pub world: &'a [f32],
    pub v_count: usize,
    adj_verts: Vec<Vec<u32>>,
    adj_lens: Vec<Vec<f32>>,
    edge_sum: f64,
    edge_count: usize,
}

impl<'a> AdjBuilder<'a> {
    pub fn new(world: &'a [f32], v_count: usize) -> Self {
        Self {
            world,
            v_count,
            adj_verts: vec![Vec::new(); v_count],
            adj_lens: vec![Vec::new(); v_count],
            edge_sum: 0.0,
            edge_count: 0,
        }
    }

    pub fn add_edge(&mut self, u: usize, v: usize, custom_len: Option<f32>) {
        if u >= self.v_count || v >= self.v_count || u == v {
            return;
        }
        let v_u32 = v as u32;
        if self.adj_verts[u].contains(&v_u32) {
            return;
        }
        let len = custom_len.unwrap_or_else(|| {
            let ux = self.world[u * 2] as f64;
            let uy = self.world[u * 2 + 1] as f64;
            let vx = self.world[v * 2] as f64;
            let vy = self.world[v * 2 + 1] as f64;
            (ux - vx).hypot(uy - vy) as f32
        });
        self.adj_verts[u].push(v_u32);
        self.adj_lens[u].push(len);
        self.adj_verts[v].push(u as u32);
        self.adj_lens[v].push(len);
        self.edge_sum += len as f64;
        self.edge_count += 1;
    }

    pub fn current_avg_edge(&self, fallback: f64) -> f64 {
        if self.edge_count > 0 {
            self.edge_sum / self.edge_count as f64
        } else {
            fallback
        }
    }

    pub fn into_csr(self, avg_edge: f64) -> CsrGraph {
        let total: usize = self.adj_verts.iter().map(|v| v.len()).sum();
        let mut offsets = Vec::with_capacity(self.v_count + 1);
        let mut neighbors = Vec::with_capacity(total);
        let mut lengths = Vec::with_capacity(total);
        let mut cursor = 0usize;
        for i in 0..self.v_count {
            offsets.push(cursor);
            cursor += self.adj_verts[i].len();
            neighbors.extend_from_slice(&self.adj_verts[i]);
            lengths.extend_from_slice(&self.adj_lens[i]);
        }
        offsets.push(cursor);
        CsrGraph {
            v_count: self.v_count,
            offsets,
            neighbors,
            lengths,
            avg_edge,
        }
    }
}

#[inline]
pub fn rotate_point(x: f64, y: f64, angle_deg: f64) -> (f64, f64) {
    let rad = (angle_deg * std::f64::consts::PI) / 180.0;
    let c = rad.cos();
    let s = rad.sin();
    (x * c - y * s, x * s + y * c)
}

#[inline]
pub fn angle_difference_deg(a1: f64, a2: f64) -> f64 {
    let mut diff = ((a1 - a2) % 360.0).abs();
    if diff > 180.0 {
        diff = 360.0 - diff;
    }
    diff
}

#[inline]
pub fn point_to_seg_projection(
    px: f64,
    py: f64,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
) -> SegProjection {
    let dx = bx - ax;
    let dy = by - ay;
    let len2 = dx * dx + dy * dy;
    if len2 < 1e-10 {
        return SegProjection {
            dist: (px - ax).hypot(py - ay),
            proj_x: ax,
            proj_y: ay,
            raw_t: 0.0,
        };
    }
    let raw_t = ((px - ax) * dx + (py - ay) * dy) / len2;
    let clamped_t = raw_t.clamp(0.0, 1.0);
    let proj_x = ax + dx * clamped_t;
    let proj_y = ay + dy * clamped_t;
    SegProjection {
        dist: (px - proj_x).hypot(py - proj_y),
        proj_x,
        proj_y,
        raw_t,
    }
}

#[inline]
pub fn point_to_seg_dist(px: f64, py: f64, ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    point_to_seg_projection(px, py, ax, ay, bx, by).dist
}

#[inline]
pub fn cross_2d(ax: f64, ay: f64, bx: f64, by: f64, cx: f64, cy: f64) -> f64 {
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

#[inline]
pub fn segments_intersect(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
    dx: f64,
    dy: f64,
) -> bool {
    let d1 = cross_2d(cx, cy, dx, dy, ax, ay);
    let d2 = cross_2d(cx, cy, dx, dy, bx, by);
    let d3 = cross_2d(ax, ay, bx, by, cx, cy);
    let d4 = cross_2d(ax, ay, bx, by, dx, dy);
    ((d1 > 0.0 && d2 < 0.0) || (d1 < 0.0 && d2 > 0.0))
        && ((d3 > 0.0 && d4 < 0.0) || (d3 < 0.0 && d4 > 0.0))
}

#[inline]
pub fn point_in_triangle(
    px: f64,
    py: f64,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
) -> bool {
    let c1 = cross_2d(ax, ay, bx, by, px, py);
    let c2 = cross_2d(bx, by, cx, cy, px, py);
    let c3 = cross_2d(cx, cy, ax, ay, px, py);
    let has_neg = c1 < -1e-5 || c2 < -1e-5 || c3 < -1e-5;
    let has_pos = c1 > 1e-5 || c2 > 1e-5 || c3 > 1e-5;
    !(has_neg && has_pos)
}

pub fn segment_triangle_distance(
    px: f64,
    py: f64,
    qx: f64,
    qy: f64,
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    cx: f64,
    cy: f64,
) -> f64 {
    if point_in_triangle(px, py, ax, ay, bx, by, cx, cy)
        || point_in_triangle(qx, qy, ax, ay, bx, by, cx, cy)
        || segments_intersect(px, py, qx, qy, ax, ay, bx, by)
        || segments_intersect(px, py, qx, qy, bx, by, cx, cy)
        || segments_intersect(px, py, qx, qy, cx, cy, ax, ay)
    {
        return 0.0;
    }
    point_to_seg_dist(px, py, ax, ay, bx, by)
        .min(point_to_seg_dist(px, py, bx, by, cx, cy))
        .min(point_to_seg_dist(px, py, cx, cy, ax, ay))
        .min(point_to_seg_dist(qx, qy, ax, ay, bx, by))
        .min(point_to_seg_dist(qx, qy, bx, by, cx, cy))
        .min(point_to_seg_dist(qx, qy, cx, cy, ax, ay))
        .min(point_to_seg_dist(ax, ay, px, py, qx, qy))
        .min(point_to_seg_dist(bx, by, px, py, qx, qy))
        .min(point_to_seg_dist(cx, cy, px, py, qx, qy))
}
