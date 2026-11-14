use std::collections::BinaryHeap;

use crate::geom2d::{
    AdjBuilder, CsrGraph, FastMap, HeapItem, point_to_seg_dist, segment_triangle_distance,
};

struct PolylineMetrics {
    cum: Vec<f64>,
    total_len: f64,
    dir_x: f64,
    dir_y: f64,
    root_cut_len: f64,
    root_ramp_len: f64,
}

struct SubtreeSeeds {
    active_verts: Vec<usize>,
    barrier_verts: Vec<usize>,
    stroke_verts: Vec<bool>,
    avg_core_edge: f64,
}

#[inline]
fn js_round(x: f64) -> i32 {
    (x + 0.5).floor() as i32
}

fn build_mesh_topology(world: &[f32], indices: &[u32]) -> CsrGraph {
    let v_count = world.len() / 2;
    let mut builder = AdjBuilder::new(world, v_count);
    for tri in indices.chunks_exact(3) {
        let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        builder.add_edge(a, b, None);
        builder.add_edge(b, c, None);
        builder.add_edge(c, a, None);
    }
    let mut buckets: FastMap<(i32, i32), Vec<usize>> =
        FastMap::with_capacity_and_hasher(v_count, Default::default());
    for i in 0..v_count {
        let key = (js_round(world[i * 2] as f64), js_round(world[i * 2 + 1] as f64));
        let b = buckets.entry(key).or_default();
        for &prev in b.iter() {
            let d = (world[i * 2] as f64 - world[prev * 2] as f64)
                .hypot(world[i * 2 + 1] as f64 - world[prev * 2 + 1] as f64);
            if d <= 0.5 {
                builder.add_edge(i, prev, None);
            }
        }
        b.push(i);
    }
    let avg_edge = builder.current_avg_edge(24.0);
    builder.into_csr(avg_edge)
}

fn build_polyline_metrics(poly: &[(f64, f64)]) -> PolylineMetrics {
    let mut cum = Vec::with_capacity(poly.len());
    cum.push(0.0);
    for i in 1..poly.len() {
        cum.push(cum[i - 1] + (poly[i].0 - poly[i - 1].0).hypot(poly[i].1 - poly[i - 1].1));
    }
    let last_cum = *cum.last().unwrap_or(&0.0);
    let total_len = if last_cum > 0.0 { last_cum } else { 1.0 };
    let target = 24.0_f64.min(total_len * 0.25);
    let mut look = 1usize;
    while look < poly.len() - 1 && cum[look] < target {
        look += 1;
    }
    let (dx, dy) = (poly[look].0 - poly[0].0, poly[look].1 - poly[0].1);
    let d_len = dx.hypot(dy);
    let norm = if d_len > 0.0 { d_len } else { 1.0 };
    PolylineMetrics {
        cum,
        total_len,
        dir_x: dx / norm,
        dir_y: dy / norm,
        root_cut_len: (total_len * 0.1).max(4.0).min(16.0),
        root_ramp_len: (total_len * 0.16).max(8.0).min(26.0),
    }
}

fn project_on_polyline(px: f64, py: f64, poly: &[(f64, f64)], m: &PolylineMetrics) -> (f64, f64) {
    let (mut best_dist, mut best_arc) = (f64::INFINITY, 0.0);
    for s in 0..(poly.len() - 1) {
        let ((ax, ay), (bx, by)) = (poly[s], poly[s + 1]);
        let (dx, dy) = (bx - ax, by - ay);
        let len2 = dx * dx + dy * dy;
        let t = if len2 > 1e-10 {
            (((px - ax) * dx + (py - ay) * dy) / len2).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let d = (px - (ax + dx * t)).hypot(py - (ay + dy * t));
        if d < best_dist {
            best_dist = d;
            best_arc = m.cum[s] + t * (m.cum[s + 1] - m.cum[s]);
        }
    }
    (best_dist, best_arc)
}

fn classify_stroke_seeds(
    world: &[f32],
    poly: &[(f64, f64)],
    metrics: &PolylineMetrics,
    stroke_verts: Vec<bool>,
    avg_core_edge: f64,
) -> Option<SubtreeSeeds> {
    let (mut active_verts, mut barrier_verts) = (Vec::new(), Vec::new());
    for (v, &is_s) in stroke_verts.iter().enumerate() {
        if !is_s {
            continue;
        }
        let (vx, vy) = (world[v * 2] as f64, world[v * 2 + 1] as f64);
        let (dist, arc) = project_on_polyline(vx, vy, poly, metrics);
        let along0 = (vx - poly[0].0) * metrics.dir_x + (vy - poly[0].1) * metrics.dir_y;
        if arc <= metrics.root_cut_len || along0 <= 2.0 || (arc <= metrics.root_ramp_len && dist > 10.0) {
            barrier_verts.push(v);
        } else {
            active_verts.push(v);
        }
    }
    if active_verts.is_empty() {
        barrier_verts.retain(|&v| {
            let along0 = (world[v * 2] as f64 - poly[0].0) * metrics.dir_x
                + (world[v * 2 + 1] as f64 - poly[0].1) * metrics.dir_y;
            if along0 > 0.0 {
                active_verts.push(v);
                false
            } else {
                true
            }
        });
    }
    if active_verts.is_empty() {
        return None;
    }
    Some(SubtreeSeeds { active_verts, barrier_verts, stroke_verts, avg_core_edge })
}

fn find_subtree_seeds(
    world: &[f32],
    indices: &[u32],
    poly: &[(f64, f64)],
    topo: &CsrGraph,
    metrics: &PolylineMetrics,
    seg_min: &mut [i16],
    seg_max: &mut [i16],
) -> Option<SubtreeSeeds> {
    let v_count = topo.v_count;
    let hit_eps = (topo.avg_edge * 0.16).max(3.0);
    seg_min.fill(32767);
    seg_max.fill(-1);
    let mut stroke_verts = vec![false; v_count];
    let (mut core_sum, mut core_cnt) = (0.0_f64, 0usize);
    let (mut best_tri, mut best_dist, mut best_seg) = (None::<usize>, f64::INFINITY, 0i16);

    for (t_idx, tri) in indices.chunks_exact(3).enumerate() {
        let (a, b, c) = (tri[0] as usize, tri[1] as usize, tri[2] as usize);
        if a >= v_count || b >= v_count || c >= v_count {
            continue;
        }
        let (ax, ay) = (world[a * 2] as f64, world[a * 2 + 1] as f64);
        let (bx, by) = (world[b * 2] as f64, world[b * 2 + 1] as f64);
        let (cx, cy) = (world[c * 2] as f64, world[c * 2 + 1] as f64);
        let tri_perim = (ax - bx).hypot(ay - by) + (bx - cx).hypot(by - cy) + (cx - ax).hypot(cy - ay);
        let (mut hit, mut t_min, mut t_max) = (false, 32767i16, -1i16);

        for s in 0..(poly.len() - 1) {
            let (p, q) = (poly[s], poly[s + 1]);
            let px = if s == 0 { p.0 + (q.0 - p.0) * 0.05 } else { p.0 };
            let py = if s == 0 { p.1 + (q.1 - p.1) * 0.05 } else { p.1 };
            let d = segment_triangle_distance(px, py, q.0, q.1, ax, ay, bx, by, cx, cy);
            if d < best_dist {
                (best_dist, best_tri, best_seg) = (d, Some(t_idx * 3), s as i16);
            }
            if d <= hit_eps {
                hit = true;
                t_min = t_min.min(s as i16);
                t_max = t_max.max(s as i16);
            }
        }
        if hit {
            let max_vd = ((tri_perim / 3.0) * 0.65).clamp(12.0, 18.0);
            for v in [a, b, c] {
                let (dist, arc) = project_on_polyline(world[v * 2] as f64, world[v * 2 + 1] as f64, poly, metrics);
                let allowed = if arc <= metrics.root_ramp_len { max_vd.min(10.0) } else { max_vd };
                if dist <= allowed {
                    stroke_verts[v] = true;
                    seg_min[v] = seg_min[v].min(t_min);
                    seg_max[v] = seg_max[v].max(t_max);
                }
            }
            core_sum += tri_perim;
            core_cnt += 3;
        }
    }

    if !stroke_verts.iter().any(|&x| x) {
        let bt = best_tri?;
        if best_dist > (topo.avg_edge * 1.25).max(28.0) {
            return None;
        }
        for k in 0..3 {
            let v = indices[bt + k] as usize;
            stroke_verts[v] = true;
            seg_min[v] = best_seg;
            seg_max[v] = best_seg;
        }
    }

    let avg_core_edge = if core_cnt > 0 { core_sum / core_cnt as f64 } else { topo.avg_edge };
    classify_stroke_seeds(world, poly, metrics, stroke_verts, avg_core_edge)
}

fn propagate_dijkstra(
    world: &[f32],
    topo: &CsrGraph,
    poly: &[(f64, f64)],
    metrics: &PolylineMetrics,
    seeds: &SubtreeSeeds,
    max_geo_dist: f64,
    root_zone_radius: f64,
    geo_dist: &mut [f32],
    owner: &mut [i8],
    seg_min: &mut [i16],
    seg_max: &mut [i16],
) {
    let mut visited = vec![false; topo.v_count];
    let mut heap = BinaryHeap::with_capacity(seeds.active_verts.len() * 2);
    for &v in &seeds.barrier_verts {
        geo_dist[v] = 0.0;
        owner[v] = -1;
        visited[v] = true;
    }
    for &v in &seeds.active_verts {
        geo_dist[v] = 0.0;
        owner[v] = 1;
        heap.push(HeapItem { dist: 0.0, node: v });
    }

    while let Some(HeapItem { dist: _, node: u }) = heap.pop() {
        if visited[u] {
            continue;
        }
        visited[u] = true;
        let du = geo_dist[u] as f64;
        if du >= max_geo_dist {
            continue;
        }
        for idx in topo.offsets[u]..topo.offsets[u + 1] {
            let v = topo.neighbors[idx] as usize;
            if visited[v] {
                continue;
            }
            let (vx, vy) = (world[v * 2] as f64, world[v * 2 + 1] as f64);
            let dist_p0 = (vx - poly[0].0).hypot(vy - poly[0].1);
            let v_along = (vx - poly[0].0) * metrics.dir_x + (vy - poly[0].1) * metrics.dir_y;
            if dist_p0 <= root_zone_radius || v_along <= 2.0 {
                if v_along <= 2.0 {
                    continue;
                }
                let (dist_v, arc_v) = project_on_polyline(vx, vy, poly, metrics);
                if arc_v <= metrics.root_cut_len || (arc_v <= metrics.root_ramp_len && dist_v > 10.0) {
                    continue;
                }
            }
            let nd = du + topo.lengths[idx] as f64;
            if nd <= max_geo_dist && (nd as f32) < geo_dist[v] {
                geo_dist[v] = nd as f32;
                owner[v] = 1;
                seg_min[v] = seg_min[u];
                seg_max[v] = seg_max[u];
                heap.push(HeapItem { dist: nd as f32, node: v });
            }
        }
    }
}

fn finalize_corridor_weights(
    world: &[f32],
    topo: &CsrGraph,
    poly: &[(f64, f64)],
    metrics: &PolylineMetrics,
    seeds: &SubtreeSeeds,
    has_explicit_reach: bool,
    max_geo_dist: f64,
    root_zone_radius: f64,
    geo_dist: &[f32],
    owner: &[i8],
    seg_min: &mut [i16],
    seg_max: &mut [i16],
    out_weights: &mut [f32],
) {
    let core_band = 18.0_f64.max(seeds.avg_core_edge * 2.2) as f32;
    for _pass in 0..2 {
        for u in 0..topo.v_count {
            if owner[u] != 1 || geo_dist[u] > core_band {
                continue;
            }
            for idx in topo.offsets[u]..topo.offsets[u + 1] {
                let v = topo.neighbors[idx] as usize;
                if owner[v] == 1 {
                    seg_min[u] = seg_min[u].min(seg_min[v]);
                    seg_max[u] = seg_max[u].max(seg_max[v]);
                }
            }
        }
    }

    out_weights.fill(0.0);
    let last_seg = (poly.len() - 2) as isize;
    for i in 0..topo.v_count {
        let (x, y) = (world[i * 2] as f64, world[i * 2 + 1] as f64);
        if owner[i] != 1 {
            if seeds.stroke_verts[i] {
                let along0 = (x - poly[0].0) * metrics.dir_x + (y - poly[0].1) * metrics.dir_y;
                let (dist, arc) = project_on_polyline(x, y, poly, metrics);
                if along0 > 0.0 && arc > 0.0 && dist <= 18.0_f64.max(seeds.avg_core_edge * 0.85) {
                    let t = (arc / metrics.root_ramp_len).min(1.0);
                    out_weights[i] = (t * t * (3.0 - 2.0 * t)) as f32;
                }
            }
            continue;
        }
        let gd = geo_dist[i] as f64;
        let mut root_factor = 1.0_f64;
        if (x - poly[0].0).hypot(y - poly[0].1) <= root_zone_radius && gd <= seeds.avg_core_edge * 2.0 {
            let (_, arc) = project_on_polyline(x, y, poly, metrics);
            if arc < metrics.root_ramp_len {
                let t = (arc / metrics.root_ramp_len).clamp(0.0, 1.0);
                root_factor = t * t * (3.0 - 2.0 * t);
            }
        }
        if !has_explicit_reach || gd == 0.0 {
            out_weights[i] = root_factor as f32;
            continue;
        }
        let lo = (seg_min[i] as isize - 2).clamp(0, last_seg) as usize;
        let hi = (seg_max[i] as isize + 2).clamp(0, last_seg) as usize;
        let perp = (lo..=hi)
            .map(|s| point_to_seg_dist(x, y, poly[s].0, poly[s].1, poly[s + 1].0, poly[s + 1].1))
            .fold(f64::INFINITY, f64::min);
        let eff_dist = gd.max(perp);
        if eff_dist < max_geo_dist {
            let k = (1.0 - eff_dist / max_geo_dist).clamp(0.0, 1.0);
            out_weights[i] = (k * k * (3.0 - 2.0 * k) * root_factor) as f32;
        }
    }
}

pub fn compute_mesh_corridor_slice(
    world: &[f32],
    indices: &[u32],
    poly_raw: &[f32],
    reach: f32,
    out_weights: &mut [f32],
    out_geo_dist: &mut [f32],
    out_seg_min: &mut [i16],
    out_seg_max: &mut [i16],
) -> Option<f32> {
    let v_count = world.len() / 2;
    let poly_count = poly_raw.len() / 2;
    if v_count == 0 || indices.len() < 3 || poly_count < 2 {
        return None;
    }
    let poly: Vec<(f64, f64)> = (0..poly_count)
        .map(|i| (poly_raw[i * 2] as f64, poly_raw[i * 2 + 1] as f64))
        .collect();
    let topo = build_mesh_topology(world, indices);
    let metrics = build_polyline_metrics(&poly);
    let seeds = find_subtree_seeds(world, indices, &poly, &topo, &metrics, out_seg_min, out_seg_max)?;

    out_geo_dist.fill(f32::INFINITY);
    let mut owner = vec![0i8; v_count];
    let has_explicit_reach = reach > 0.0;
    let max_geo_dist = if has_explicit_reach {
        reach as f64
    } else {
        (seeds.avg_core_edge * 12.0).max(metrics.total_len * 2.5)
    };
    let root_zone_radius = 32.0_f64.max(metrics.root_ramp_len * 1.5).max(seeds.avg_core_edge * 2.4);

    propagate_dijkstra(
        world, &topo, &poly, &metrics, &seeds, max_geo_dist, root_zone_radius,
        out_geo_dist, &mut owner, out_seg_min, out_seg_max,
    );
    finalize_corridor_weights(
        world, &topo, &poly, &metrics, &seeds, has_explicit_reach, max_geo_dist, root_zone_radius,
        out_geo_dist, &owner, out_seg_min, out_seg_max, out_weights,
    );
    Some(seeds.avg_core_edge as f32)
}

/// Tính hành lang nhánh con (Mesh Corridor) dọc theo xương/nét vẽ trên lưới tam giác.
#[unsafe(no_mangle)]
pub extern "C" fn rust_compute_mesh_corridor(
    world_ptr: *const f32,
    v_count: usize,
    indices_ptr: *const u32,
    index_count: usize,
    poly_pts_ptr: *const f32,
    poly_count: usize,
    reach: f32,
    out_weights_ptr: *mut f32,
    out_geo_dist_ptr: *mut f32,
    out_seg_min_ptr: *mut i16,
    out_seg_max_ptr: *mut i16,
    out_avg_core_edge_ptr: *mut f32,
) -> bool {
    if world_ptr.is_null()
        || indices_ptr.is_null()
        || poly_pts_ptr.is_null()
        || out_weights_ptr.is_null()
        || out_geo_dist_ptr.is_null()
        || out_seg_min_ptr.is_null()
        || out_seg_max_ptr.is_null()
        || out_avg_core_edge_ptr.is_null()
        || v_count == 0
        || index_count < 3
        || poly_count < 2
    {
        return false;
    }
    let world = unsafe { std::slice::from_raw_parts(world_ptr, v_count * 2) };
    let indices = unsafe { std::slice::from_raw_parts(indices_ptr, index_count) };
    let poly_raw = unsafe { std::slice::from_raw_parts(poly_pts_ptr, poly_count * 2) };
    let out_weights = unsafe { std::slice::from_raw_parts_mut(out_weights_ptr, v_count) };
    let out_geo_dist = unsafe { std::slice::from_raw_parts_mut(out_geo_dist_ptr, v_count) };
    let out_seg_min = unsafe { std::slice::from_raw_parts_mut(out_seg_min_ptr, v_count) };
    let out_seg_max = unsafe { std::slice::from_raw_parts_mut(out_seg_max_ptr, v_count) };
    let Some(avg_core) = compute_mesh_corridor_slice(
        world, indices, poly_raw, reach, out_weights, out_geo_dist, out_seg_min, out_seg_max,
    ) else {
        return false;
    };
    unsafe { *out_avg_core_edge_ptr = avg_core; }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_corridor_isolates_subtree_and_blocks_trunk() {
        let world: [f32; 24] = [
            -5.0, 100.0, 5.0, 100.0, -5.0, 0.0, 5.0, 0.0,
            -40.0, -40.0, -32.0, -40.0, -80.0, -80.0, -72.0, -80.0,
            32.0, -40.0, 40.0, -40.0, 72.0, -80.0, 80.0, -80.0,
        ];
        let indices: [u32; 30] = [
            0, 1, 2, 1, 3, 2,
            2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6,
            2, 3, 8, 3, 9, 8, 8, 9, 10, 9, 11, 10,
        ];
        let poly: [f32; 6] = [-4.0, 0.0, -36.0, -40.0, -76.0, -80.0];
        let (mut w, mut gd) = (vec![0.0f32; 12], vec![0.0f32; 12]);
        let (mut smin, mut smax) = (vec![0i16; 12], vec![0i16; 12]);
        let avg = compute_mesh_corridor_slice(&world, &indices, &poly, 0.0, &mut w, &mut gd, &mut smin, &mut smax);
        assert!(avg.is_some());
        assert!(w[6] > 0.99);
        assert!(w[7] > 0.99);
        assert_eq!(w[0], 0.0);
        assert_eq!(w[1], 0.0);
        assert_eq!(w[10], 0.0);
        assert_eq!(w[11], 0.0);
    }
}
