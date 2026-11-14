use crate::geodesic_chains::{
    ChainInfo, build_anatomical_chains, build_segment_metas, parse_bones,
};
use crate::geodesic_graph::{
    BoneGeodesicField, BoneSegmentMeta, build_welded_mesh_graph, compute_bone_field,
};
use crate::geom2d::point_to_seg_projection;

#[derive(Clone, Copy)]
struct VertexBoneScore {
    bone_idx: usize,
    chain_idx: usize,
    chain_score_dist: f64,
    d_eff: f64,
    affinity: f64,
}

fn evaluate_vertex_scores(
    v: usize,
    x: f64,
    y: f64,
    metas: &[BoneSegmentMeta],
    fields: &[BoneGeodesicField],
    scores_buf: &mut Vec<VertexBoneScore>,
) {
    scores_buf.clear();
    for (k, m) in metas.iter().enumerate() {
        let f = &fields[k];
        let proj = point_to_seg_projection(x, y, m.hx, m.hy, m.tx, m.ty);
        let mut d_axial = 0.0;
        if !m.pin {
            if proj.raw_t < 0.0 {
                d_axial = -proj.raw_t * m.len;
            } else if proj.raw_t > m.pelvis_reach_mult {
                d_axial = (proj.raw_t - m.pelvis_reach_mult) * m.len;
            }
        }
        let raw_geo = f.geo_dist[v] as f64;
        let true_geo_dist = if raw_geo.is_finite() {
            let (mut px, mut py, mut ed) = (proj.proj_x, proj.proj_y, proj.dist);
            if let Some(ex) = m.extra_seed_seg {
                let p2 = point_to_seg_projection(x, y, ex[0], ex[1], ex[2], ex[3]);
                if p2.dist < ed {
                    (px, py, ed) = (p2.proj_x, p2.proj_y, p2.dist);
                }
            }
            let detour = (raw_geo - ed * 1.06).max(0.0);
            let shift = (f.origin_x[v] as f64 - px).hypot(f.origin_y[v] as f64 - py);
            let ratio = (detour / (ed * 0.35).max(12.0)).min(1.0);
            raw_geo + detour * 1.25 + shift * ratio * 1.35
        } else {
            proj.dist + 1800.0
        };
        let d_eff = true_geo_dist.hypot(1.85 * d_axial);
        let chain_score_dist = true_geo_dist.hypot(2.1 * d_axial);
        let radius = if m.mesh_envelope {
            (m.len * 0.38).max(28.0) * m.strength_mult
        } else {
            (m.len * 0.22 * m.strength_mult).max(12.0)
        };
        let denom = d_eff * d_eff + radius * radius;
        let affinity = (m.strength_mult * m.strength_mult) / (denom * denom);
        scores_buf.push(VertexBoneScore {
            bone_idx: m.bone_idx,
            chain_idx: m.chain_idx,
            chain_score_dist,
            d_eff,
            affinity,
        });
    }
}

fn assign_vertex_influences(
    v: usize,
    scores: &[VertexBoneScore],
    info: &ChainInfo,
    chain_min_buf: &mut [f64],
    out_indices: &mut [i32],
    out_weights: &mut [f32],
) {
    chain_min_buf.fill(f64::INFINITY);
    let (mut best_chain, mut best_chain_dist) = (0usize, f64::INFINITY);
    for s in scores {
        chain_min_buf[s.chain_idx] = chain_min_buf[s.chain_idx].min(s.chain_score_dist);
        if s.chain_score_dist < best_chain_dist {
            best_chain_dist = s.chain_score_dist;
            best_chain = s.chain_idx;
        }
    }

    let (mut min_valid, mut valid_count) = (f64::INFINITY, 0usize);
    for s in scores {
        if s.chain_idx == best_chain {
            min_valid = min_valid.min(s.d_eff);
            valid_count += 1;
        }
    }

    let max_span = (min_valid * 1.9).max(min_valid + 28.0);
    let mut candidates: Vec<VertexBoneScore> = scores
        .iter()
        .copied()
        .filter(|s| s.chain_idx == best_chain && (valid_count == 1 || s.d_eff <= max_span))
        .collect();
    if candidates.is_empty() {
        candidates.extend(scores.iter().copied().filter(|s| s.chain_idx == best_chain));
    }
    candidates.sort_by(|a, b| b.affinity.total_cmp(&a.affinity));
    let top_len = candidates.len().min(3);
    let sum: f64 = candidates[..top_len].iter().map(|c| c.affinity).sum();
    let norm = if sum > 0.0 { sum } else { 1.0 };

    let mut sibling_sep = 1.0_f64;
    let mut parent_tail_bone: Option<usize> = None;
    let p_chain = info.parent_chain_idx[best_chain];
    if p_chain >= 0 && info.child_chains_of_chain[p_chain as usize].len() >= 2 {
        let pc = p_chain as usize;
        let min_sib = info.child_chains_of_chain[pc]
            .iter()
            .filter(|&&sc| sc != best_chain)
            .map(|&sc| chain_min_buf[sc])
            .fold(f64::INFINITY, f64::min);
        if min_sib.is_finite() {
            let diff = (min_sib - best_chain_dist).max(0.0);
            if diff < 28.0 {
                sibling_sep = diff / 28.0;
                parent_tail_bone = info.chains[pc].last().copied();
            }
        }
    }

    let base = v * 4;
    out_indices[base..base + 4].fill(-1);
    out_weights[base..base + 4].fill(0.0);
    for slot in 0..top_len {
        out_indices[base + slot] = candidates[slot].bone_idx as i32;
        out_weights[base + slot] = ((candidates[slot].affinity / norm) * sibling_sep) as f32;
    }
    if let Some(pb) = parent_tail_bone && top_len < 4 {
        out_indices[base + top_len] = pb as i32;
        out_weights[base + top_len] = (1.0 - sibling_sep) as f32;
    }
}

fn fill_unreached_from_nearest(
    world: &[f32],
    v_count: usize,
    unreached: &[usize],
    out_indices: &mut [i32],
    out_weights: &mut [f32],
) {
    for &u in unreached {
        let (ux, uy) = (world[u * 2] as f64, world[u * 2 + 1] as f64);
        let (mut best_j, mut best_d) = (None, f64::INFINITY);
        for j in 0..v_count {
            if out_indices[j * 4] < 0 {
                continue;
            }
            let d = (ux - world[j * 2] as f64).hypot(uy - world[j * 2 + 1] as f64);
            if d < best_d {
                best_d = d;
                best_j = Some(j);
            }
        }
        if let Some(j) = best_j {
            for slot in 0..4 {
                out_indices[u * 4 + slot] = out_indices[j * 4 + slot];
                out_weights[u * 4 + slot] = out_weights[j * 4 + slot];
            }
        }
    }
}

pub fn compute_geodesic_skin_weights_slice(
    world: &[f32],
    bones_meta: &[f32],
    indices: &[u32],
    out_indices: &mut [i32],
    out_weights: &mut [f32],
) -> bool {
    let (v_count, bone_count) = (world.len() / 2, bones_meta.len() / 8);
    if v_count == 0
        || bone_count == 0
        || indices.len() < 3
        || out_indices.len() < v_count * 4
        || out_weights.len() < v_count * 4
    {
        return false;
    }

    let bones = parse_bones(bones_meta, bone_count);
    let any_envelope = bones.iter().any(|b| b.mesh_envelope);
    let graph = build_welded_mesh_graph(world, indices);
    let info = build_anatomical_chains(&bones);
    let metas = build_segment_metas(&bones, &info);
    let fields: Vec<BoneGeodesicField> = metas
        .iter()
        .map(|m| compute_bone_field(world, &graph, m))
        .collect();

    let any_finite = (0..v_count).any(|i| fields.iter().any(|f| f.geo_dist[i].is_finite()));
    let mut unreached = Vec::new();
    let mut scores_buf = Vec::with_capacity(bone_count);
    let mut chain_min_buf = vec![f64::INFINITY; info.chains.len()];

    for v in 0..v_count {
        if !fields.iter().any(|f| f.geo_dist[v].is_finite()) && any_finite {
            if any_envelope {
                unreached.push(v);
            }
            out_indices[v * 4..v * 4 + 4].fill(-1);
            out_weights[v * 4..v * 4 + 4].fill(0.0);
            continue;
        }
        evaluate_vertex_scores(
            v,
            world[v * 2] as f64,
            world[v * 2 + 1] as f64,
            &metas,
            &fields,
            &mut scores_buf,
        );
        assign_vertex_influences(
            v,
            &scores_buf,
            &info,
            &mut chain_min_buf,
            out_indices,
            out_weights,
        );
    }

    fill_unreached_from_nearest(world, v_count, &unreached, out_indices, out_weights);
    true
}

/// Tính trọng số uốn trắc địa (Geodesic Skinning) cho toàn bộ đỉnh lưới, xuất tối đa 4 xương/đỉnh.
#[unsafe(no_mangle)]
pub extern "C" fn rust_build_geodesic_skin_weights(
    world_ptr: *const f32,
    v_count: usize,
    bones_meta_ptr: *const f32,
    bone_count: usize,
    indices_ptr: *const u32,
    index_count: usize,
    out_indices_ptr: *mut i32,
    out_weights_ptr: *mut f32,
) -> bool {
    if world_ptr.is_null()
        || bones_meta_ptr.is_null()
        || indices_ptr.is_null()
        || out_indices_ptr.is_null()
        || out_weights_ptr.is_null()
        || v_count == 0
        || bone_count == 0
        || index_count < 3
    {
        return false;
    }
    let world = unsafe { std::slice::from_raw_parts(world_ptr, v_count * 2) };
    let bones_meta = unsafe { std::slice::from_raw_parts(bones_meta_ptr, bone_count * 8) };
    let indices = unsafe { std::slice::from_raw_parts(indices_ptr, index_count) };
    let out_indices = unsafe { std::slice::from_raw_parts_mut(out_indices_ptr, v_count * 4) };
    let out_weights = unsafe { std::slice::from_raw_parts_mut(out_weights_ptr, v_count * 4) };
    compute_geodesic_skin_weights_slice(world, bones_meta, indices, out_indices, out_weights)
}

/// Xác định chỉ số xương chủ quản cho từng tam giác từ cặp trọng số đỉnh phẳng (4 xương/đỉnh).
#[unsafe(no_mangle)]
pub extern "C" fn rust_dominant_bone_per_triangle(
    indices_ptr: *const u32,
    index_count: usize,
    vert_bone_indices_ptr: *const i32,
    vert_bone_weights_ptr: *const f32,
    v_count: usize,
    out_tri_bone_ptr: *mut i32,
) -> bool {
    if indices_ptr.is_null()
        || vert_bone_indices_ptr.is_null()
        || vert_bone_weights_ptr.is_null()
        || out_tri_bone_ptr.is_null()
        || index_count < 3
        || v_count == 0
    {
        return false;
    }
    let indices = unsafe { std::slice::from_raw_parts(indices_ptr, index_count) };
    let vb_idx = unsafe { std::slice::from_raw_parts(vert_bone_indices_ptr, v_count * 4) };
    let vb_w = unsafe { std::slice::from_raw_parts(vert_bone_weights_ptr, v_count * 4) };
    let tri_count = index_count / 3;
    let out = unsafe { std::slice::from_raw_parts_mut(out_tri_bone_ptr, tri_count) };

    for t in 0..tri_count {
        let mut acc: [(i32, f64); 12] = [(-1, 0.0); 12];
        let mut acc_len = 0usize;
        for corner in 0..3 {
            let v = indices[t * 3 + corner] as usize;
            if v >= v_count {
                continue;
            }
            for slot in 0..4 {
                let bi = vb_idx[v * 4 + slot];
                if bi < 0 {
                    continue;
                }
                let w = vb_w[v * 4 + slot] as f64;
                if let Some(pos) = acc[..acc_len].iter().position(|x| x.0 == bi) {
                    acc[pos].1 += w;
                } else if acc_len < 12 {
                    acc[acc_len] = (bi, w);
                    acc_len += 1;
                }
            }
        }
        let mut best_id = -1i32;
        let mut best_w = 0.0_f64;
        for &(bi, w) in &acc[..acc_len] {
            if w > best_w {
                best_w = w;
                best_id = bi;
            }
        }
        out[t] = best_id;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_geodesic_v_shape_and_trouser_partition() {
        let world: [f32; 20] = [
            -4.0, 0.0, 4.0, 0.0, -26.0, -50.0, -20.0, -50.0, -52.0, -100.0, -44.0, -100.0,
            20.0, -50.0, 26.0, -50.0, 44.0, -100.0, 52.0, -100.0,
        ];
        let indices: [u32; 24] = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 0, 1, 6, 1, 7, 6, 6, 7, 8, 7, 9, 8];
        let bones_meta: [f32; 16] = [
            0.0, 0.0, 111.0, -115.6, 1.0, 1.0, 0.0, -1.0,
            0.0, 0.0, 111.0, -64.4, 1.0, 1.0, 0.0, -1.0,
        ];
        let (mut out_idx, mut out_w) = (vec![-1i32; 40], vec![0.0f32; 40]);
        assert!(compute_geodesic_skin_weights_slice(&world, &bones_meta, &indices, &mut out_idx, &mut out_w));
        assert_eq!(out_idx[4 * 4], 0);
        assert_eq!(out_idx[8 * 4], 1);
        assert!(out_w[4 * 4] > 0.99);
        assert!(out_w[8 * 4] > 0.99);

        let mut dom = vec![-1i32; 8];
        assert!(rust_dominant_bone_per_triangle(indices.as_ptr(), 24, out_idx.as_ptr(), out_w.as_ptr(), 10, dom.as_mut_ptr()));
        assert_eq!(dom[2], 0);
        assert_eq!(dom[6], 1);
    }

    #[test]
    fn test_geodesic_mesh_envelope_island_and_parent_fork() {
        let world: [f32; 16] = [
            -4.0, -60.0, 4.0, -60.0, -4.0, 0.0, 4.0, 0.0,
            -30.0, 80.0, 30.0, 80.0,
            -38.0, 75.0, -34.0, 85.0,
        ];
        let indices: [u32; 12] = [0, 1, 2, 1, 3, 2, 2, 3, 4, 2, 3, 5];
        let bones_meta: [f32; 24] = [
            0.0, -60.0, 60.0, 90.0, 1.0, 1.0, 2.0, -1.0,
            -2.0, 0.0, 85.0, 108.0, 1.0, 1.0, 2.0, 0.0,
            2.0, 0.0, 85.0, 72.0, 1.0, 1.0, 2.0, 0.0,
        ];
        let (mut out_idx, mut out_w) = (vec![-1i32; 32], vec![0.0f32; 32]);
        assert!(compute_geodesic_skin_weights_slice(&world, &bones_meta, &indices, &mut out_idx, &mut out_w));
        assert!(out_idx[2 * 4] >= 0);
        assert_eq!(out_idx[6 * 4], 1);
        assert!(out_w[6 * 4] > 0.5);
    }
}
