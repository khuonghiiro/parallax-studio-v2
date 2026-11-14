use std::collections::BinaryHeap;

use crate::geom2d::{
    AdjBuilder, CsrGraph, FastMap, HeapItem, point_to_seg_projection,
};

#[derive(Clone)]
pub struct BoneSegmentMeta {
    pub bone_idx: usize,
    pub hx: f64,
    pub hy: f64,
    pub tx: f64,
    pub ty: f64,
    pub dx: f64,
    pub dy: f64,
    pub len: f64,
    pub reach_mult: f64,
    pub pelvis_reach_mult: f64,
    pub strength_mult: f64,
    pub mesh_envelope: bool,
    pub pin: bool,
    pub chain_idx: usize,
    pub core_t_min: f64,
    pub core_t_max: f64,
    pub extra_seed_seg: Option<[f64; 4]>,
}

pub struct BoneGeodesicField {
    pub geo_dist: Vec<f32>,
    pub origin_x: Vec<f32>,
    pub origin_y: Vec<f32>,
}

fn weld_duplicate_vertices(
    builder: &mut AdjBuilder<'_>,
    buckets: &FastMap<(i32, i32), Vec<usize>>,
    cell_size: f64,
) {
    let weld_eps = 0.35_f64;
    for i in 0..builder.v_count {
        let x = builder.world[i * 2] as f64;
        let y = builder.world[i * 2 + 1] as f64;
        let bx = (x / cell_size).floor() as i32;
        let by = (y / cell_size).floor() as i32;
        for dx in -1..=1 {
            for dy in -1..=1 {
                if let Some(b) = buckets.get(&(bx + dx, by + dy)) {
                    for &j in b {
                        if j <= i {
                            continue;
                        }
                        let d = (x - builder.world[j * 2] as f64)
                            .hypot(y - builder.world[j * 2 + 1] as f64);
                        if d <= weld_eps {
                            builder.add_edge(i, j, Some(d as f32));
                        }
                    }
                }
            }
        }
    }
}

fn weld_t_junction_vertices(
    builder: &mut AdjBuilder<'_>,
    indices: &[u32],
    buckets: &FastMap<(i32, i32), Vec<usize>>,
    cell_size: f64,
) {
    let t_junc_eps = 0.65_f64;
    for tri in indices.chunks_exact(3) {
        for e in 0..3 {
            let u = tri[e] as usize;
            let v = tri[(e + 1) % 3] as usize;
            if u >= builder.v_count || v >= builder.v_count {
                continue;
            }
            let (ux, uy) = (builder.world[u * 2] as f64, builder.world[u * 2 + 1] as f64);
            let (vx, vy) = (builder.world[v * 2] as f64, builder.world[v * 2 + 1] as f64);
            let min_bx = ((ux.min(vx) - t_junc_eps) / cell_size).floor() as i32;
            let max_bx = ((ux.max(vx) + t_junc_eps) / cell_size).floor() as i32;
            let min_by = ((uy.min(vy) - t_junc_eps) / cell_size).floor() as i32;
            let max_by = ((uy.max(vy) + t_junc_eps) / cell_size).floor() as i32;
            for bx in min_bx..=max_bx {
                for by in min_by..=max_by {
                    if let Some(b) = buckets.get(&(bx, by)) {
                        for &w in b {
                            if w == u || w == v {
                                continue;
                            }
                            let proj = point_to_seg_projection(
                                builder.world[w * 2] as f64,
                                builder.world[w * 2 + 1] as f64,
                                ux,
                                uy,
                                vx,
                                vy,
                            );
                            if proj.raw_t >= 0.0 && proj.raw_t <= 1.0 && proj.dist <= t_junc_eps {
                                builder.add_edge(u, w, None);
                                builder.add_edge(w, v, None);
                            }
                        }
                    }
                }
            }
        }
    }
}

fn register_tri_edge(
    builder: &mut AdjBuilder<'_>,
    shared_opp: &mut FastMap<u64, usize>,
    u: usize,
    v: usize,
    opp: usize,
) {
    builder.add_edge(u, v, None);
    if u >= builder.v_count || v >= builder.v_count || opp >= builder.v_count {
        return;
    }
    let key = if u < v {
        ((u as u64) << 32) | (v as u64)
    } else {
        ((v as u64) << 32) | (u as u64)
    };
    if let Some(&prev_opp) = shared_opp.get(&key) {
        if prev_opp != opp {
            let (ux, uy) = (builder.world[u * 2] as f64, builder.world[u * 2 + 1] as f64);
            let (vx, vy) = (builder.world[v * 2] as f64, builder.world[v * 2 + 1] as f64);
            let (ox1, oy1) = (
                builder.world[prev_opp * 2] as f64,
                builder.world[prev_opp * 2 + 1] as f64,
            );
            let (ox2, oy2) = (builder.world[opp * 2] as f64, builder.world[opp * 2 + 1] as f64);
            let cross1 = (vx - ux) * (oy1 - uy) - (vy - uy) * (ox1 - ux);
            let cross2 = (vx - ux) * (oy2 - uy) - (vy - uy) * (ox2 - ux);
            let cross3 = (ox2 - ox1) * (uy - oy1) - (oy2 - oy1) * (ux - ox1);
            let cross4 = (ox2 - ox1) * (vy - oy1) - (oy2 - oy1) * (vx - ox1);
            if cross1 * cross2 < -1e-5 && cross3 * cross4 < -1e-5 {
                builder.add_edge(prev_opp, opp, None);
            }
        }
    } else {
        shared_opp.insert(key, opp);
    }
}

pub fn build_welded_mesh_graph(world: &[f32], indices: &[u32]) -> CsrGraph {
    let v_count = world.len() / 2;
    let mut builder = AdjBuilder::new(world, v_count);
    let mut shared_opp = FastMap::with_capacity_and_hasher(indices.len(), Default::default());

    for tri in indices.chunks_exact(3) {
        let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        register_tri_edge(&mut builder, &mut shared_opp, a, b, c);
        register_tri_edge(&mut builder, &mut shared_opp, b, c, a);
        register_tri_edge(&mut builder, &mut shared_opp, c, a, b);
    }

    // Tính avg_edge trước khi hàn các đỉnh trùng / T-junction (giữ đúng thứ tự bản TS)
    let avg_edge = builder.current_avg_edge(16.0);

    let cell_size = 16.0_f64;
    let mut buckets: FastMap<(i32, i32), Vec<usize>> =
        FastMap::with_capacity_and_hasher(v_count, Default::default());
    for i in 0..v_count {
        let bx = ((world[i * 2] as f64) / cell_size).floor() as i32;
        let by = ((world[i * 2 + 1] as f64) / cell_size).floor() as i32;
        buckets.entry((bx, by)).or_default().push(i);
    }
    weld_duplicate_vertices(&mut builder, &buckets, cell_size);
    weld_t_junction_vertices(&mut builder, indices, &buckets, cell_size);

    builder.into_csr(avg_edge)
}

struct SeedCandidateSummary {
    min_vertex_dist: f64,
    has_head_seed: bool,
    has_tail_seed: bool,
    min_head_dist: f64,
    closest_head_vert: Option<usize>,
    closest_head_px: f64,
    closest_head_py: f64,
    min_tail_dist: f64,
    closest_tail_vert: Option<usize>,
    closest_tail_px: f64,
    closest_tail_py: f64,
}

fn apply_fallback_seeds(
    world: &[f32],
    v_count: usize,
    meta: &BoneSegmentMeta,
    seed_seg: [f64; 4],
    sum: &SeedCandidateSummary,
    geo_dist: &mut [f32],
    origin_x: &mut [f32],
    origin_y: &mut [f32],
    queue: &mut Vec<usize>,
) {
    let max_fallback = 64.0_f64.max(meta.len * 0.75);
    if queue.is_empty() && v_count > 0 && sum.min_vertex_dist <= max_fallback {
        let fallback_r = sum.min_vertex_dist * 1.35 + 8.0;
        for v in 0..v_count {
            let proj = point_to_seg_projection(
                world[v * 2] as f64,
                world[v * 2 + 1] as f64,
                seed_seg[0],
                seed_seg[1],
                seed_seg[2],
                seed_seg[3],
            );
            if proj.dist <= fallback_r {
                geo_dist[v] = proj.dist as f32;
                origin_x[v] = proj.proj_x as f32;
                origin_y[v] = proj.proj_y as f32;
                queue.push(v);
            }
        }
        return;
    }
    if !sum.has_head_seed
        && let Some(hv) = sum.closest_head_vert
        && sum.min_head_dist <= max_fallback
    {
        if !geo_dist[hv].is_finite() {
            queue.push(hv);
        }
        geo_dist[hv] = sum.min_head_dist as f32;
        origin_x[hv] = sum.closest_head_px as f32;
        origin_y[hv] = sum.closest_head_py as f32;
    }
    if !sum.has_tail_seed
        && let Some(tv) = sum.closest_tail_vert
        && sum.min_tail_dist <= max_fallback
    {
        if !geo_dist[tv].is_finite() {
            queue.push(tv);
        }
        geo_dist[tv] = sum.min_tail_dist as f32;
        origin_x[tv] = sum.closest_tail_px as f32;
        origin_y[tv] = sum.closest_tail_py as f32;
    }
}

fn seed_bone_vertices(
    world: &[f32],
    v_count: usize,
    avg_edge: f64,
    meta: &BoneSegmentMeta,
    geo_dist: &mut [f32],
    origin_x: &mut [f32],
    origin_y: &mut [f32],
) -> Vec<usize> {
    let seed_hx = meta.hx + meta.dx * meta.core_t_min;
    let seed_hy = meta.hy + meta.dy * meta.core_t_min;
    let seed_tx = meta.hx + meta.dx * meta.core_t_max;
    let seed_ty = meta.hy + meta.dy * meta.core_t_max;
    let seed_radius = (avg_edge * 0.65).clamp(8.0, 18.0);
    let mut queue = Vec::new();
    let mut sum = SeedCandidateSummary {
        min_vertex_dist: f64::INFINITY,
        has_head_seed: false,
        has_tail_seed: false,
        min_head_dist: f64::INFINITY,
        closest_head_vert: None,
        closest_head_px: seed_hx,
        closest_head_py: seed_hy,
        min_tail_dist: f64::INFINITY,
        closest_tail_vert: None,
        closest_tail_px: seed_tx,
        closest_tail_py: seed_ty,
    };

    for v in 0..v_count {
        let (vx, vy) = (world[v * 2] as f64, world[v * 2 + 1] as f64);
        let core_proj = point_to_seg_projection(vx, vy, seed_hx, seed_hy, seed_tx, seed_ty);
        let (mut proj_dist, mut proj_x, mut proj_y) =
            (core_proj.dist, core_proj.proj_x, core_proj.proj_y);
        if let Some(ex) = meta.extra_seed_seg {
            let p2 = point_to_seg_projection(vx, vy, ex[0], ex[1], ex[2], ex[3]);
            if p2.dist < proj_dist {
                (proj_dist, proj_x, proj_y) = (p2.dist, p2.proj_x, p2.proj_y);
            }
        }
        sum.min_vertex_dist = sum.min_vertex_dist.min(proj_dist);
        if core_proj.raw_t <= 0.65 && core_proj.dist < sum.min_head_dist {
            sum.min_head_dist = core_proj.dist;
            sum.closest_head_vert = Some(v);
            sum.closest_head_px = core_proj.proj_x;
            sum.closest_head_py = core_proj.proj_y;
        }
        if core_proj.raw_t >= 0.35 && core_proj.dist < sum.min_tail_dist {
            sum.min_tail_dist = core_proj.dist;
            sum.closest_tail_vert = Some(v);
            sum.closest_tail_px = core_proj.proj_x;
            sum.closest_tail_py = core_proj.proj_y;
        }
        if proj_dist <= seed_radius {
            geo_dist[v] = proj_dist as f32;
            origin_x[v] = proj_x as f32;
            origin_y[v] = proj_y as f32;
            queue.push(v);
            if core_proj.raw_t <= 0.55 {
                sum.has_head_seed = true;
            }
            if core_proj.raw_t >= 0.45 {
                sum.has_tail_seed = true;
            }
        }
    }

    apply_fallback_seeds(
        world,
        v_count,
        meta,
        [seed_hx, seed_hy, seed_tx, seed_ty],
        &sum,
        geo_dist,
        origin_x,
        origin_y,
        &mut queue,
    );
    queue
}

pub fn compute_bone_field(
    world: &[f32],
    graph: &CsrGraph,
    meta: &BoneSegmentMeta,
) -> BoneGeodesicField {
    let v_count = graph.v_count;
    let mut geo_dist = vec![f32::INFINITY; v_count];
    let mut origin_x = vec![0.0_f32; v_count];
    let mut origin_y = vec![0.0_f32; v_count];
    let mut visited = vec![false; v_count];

    let seeds = seed_bone_vertices(
        world,
        v_count,
        graph.avg_edge,
        meta,
        &mut geo_dist,
        &mut origin_x,
        &mut origin_y,
    );

    let mut heap = BinaryHeap::with_capacity(seeds.len().max(16));
    for v in seeds {
        heap.push(HeapItem { dist: geo_dist[v], node: v });
    }

    while let Some(HeapItem { dist: _, node: u }) = heap.pop() {
        if visited[u] {
            continue;
        }
        visited[u] = true;
        let du = geo_dist[u];
        let (ox, oy) = (origin_x[u], origin_y[u]);
        for idx in graph.offsets[u]..graph.offsets[u + 1] {
            let v = graph.neighbors[idx] as usize;
            if visited[v] {
                continue;
            }
            let nd = du + graph.lengths[idx];
            if nd < geo_dist[v] {
                geo_dist[v] = nd;
                origin_x[v] = ox;
                origin_y[v] = oy;
                heap.push(HeapItem { dist: nd, node: v });
            }
        }
    }

    BoneGeodesicField { geo_dist, origin_x, origin_y }
}
