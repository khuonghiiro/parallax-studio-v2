use crate::geom2d::{angle_difference_deg, point_to_seg_projection, rotate_point};
use crate::geodesic_graph::BoneSegmentMeta;

#[derive(Clone)]
pub struct BoneInput {
    pub x: f64,
    pub y: f64,
    pub length: f64,
    pub angle: f64,
    pub strength: f64,
    pub influence_reach: f64,
    pub parent_joint_head: bool,
    pub mesh_envelope: bool,
    pub pin: bool,
    pub parent_idx: Option<usize>,
}

pub struct ChainInfo {
    pub chains: Vec<Vec<usize>>,
    pub parent_chain_idx: Vec<isize>,
    pub bone_to_chain_idx: Vec<usize>,
    pub child_chains_of_chain: Vec<Vec<usize>>,
}

pub fn parse_bones(meta: &[f32], bone_count: usize) -> Vec<BoneInput> {
    (0..bone_count)
        .map(|i| {
            let b = &meta[i * 8..i * 8 + 8];
            let flags = b[6] as u32;
            let p_raw = b[7];
            let parent_idx = if p_raw >= 0.0 && (p_raw as usize) < bone_count && (p_raw as usize) != i {
                Some(p_raw as usize)
            } else {
                None
            };
            BoneInput {
                x: b[0] as f64,
                y: b[1] as f64,
                length: b[2] as f64,
                angle: b[3] as f64,
                strength: b[4] as f64,
                influence_reach: b[5] as f64,
                parent_joint_head: (flags & 1) != 0,
                mesh_envelope: (flags & 2) != 0,
                pin: (flags & 4) != 0,
                parent_idx,
            }
        })
        .collect()
}

fn is_continuation(parent: &BoneInput, child: &BoneInput) -> bool {
    if child.parent_joint_head {
        return false;
    }
    let (dx, dy) = rotate_point(parent.length, 0.0, parent.angle);
    if (child.x - (parent.x + dx)).hypot(child.y - (parent.y + dy)) > 18.0 {
        return false;
    }
    angle_difference_deg(parent.angle, child.angle) <= 105.0
}

pub fn build_anatomical_chains(bones: &[BoneInput]) -> ChainInfo {
    let n = bones.len();
    let mut children = vec![Vec::new(); n];
    for (i, b) in bones.iter().enumerate() {
        if let Some(p) = b.parent_idx {
            children[p].push(i);
        }
    }

    let mut chains = Vec::new();
    let mut bone_to_chain_idx = vec![0usize; n];
    for i in 0..n {
        let is_start = match bones[i].parent_idx {
            None => true,
            Some(p) => children[p].len() > 1 || !is_continuation(&bones[p], &bones[i]),
        };
        if !is_start {
            continue;
        }
        let c_idx = chains.len();
        let mut chain = vec![i];
        bone_to_chain_idx[i] = c_idx;
        let mut cur = i;
        while children[cur].len() == 1 {
            let next = children[cur][0];
            if !is_continuation(&bones[cur], &bones[next]) {
                break;
            }
            cur = next;
            chain.push(cur);
            bone_to_chain_idx[cur] = c_idx;
        }
        chains.push(chain);
    }

    if chains.is_empty() {
        for i in 0..n {
            bone_to_chain_idx[i] = i;
            chains.push(vec![i]);
        }
    }

    let mut parent_chain_idx = vec![-1isize; chains.len()];
    let mut child_chains_of_chain = vec![Vec::new(); chains.len()];
    for (c, chain) in chains.iter().enumerate() {
        if let Some(p) = bones[chain[0]].parent_idx {
            let pc = bone_to_chain_idx[p];
            parent_chain_idx[c] = pc as isize;
            child_chains_of_chain[pc].push(c);
        }
    }

    ChainInfo { chains, parent_chain_idx, bone_to_chain_idx, child_chains_of_chain }
}

fn compute_pelvis_fork_seed(
    ep: (f64, f64, f64, f64),
    reach_mult: f64,
    bones: &[BoneInput],
    info: &ChainInfo,
    kids: &[usize],
) -> (f64, Option<[f64; 4]>) {
    let (mut sx, mut sy, mut cdx, mut cdy) = (0.0, 0.0, 0.0, 0.0);
    let mut max_t = reach_mult;
    for &cc in kids {
        let fb = &bones[info.chains[cc][0]];
        let (ex, ey) = rotate_point(fb.length, 0.0, fb.angle);
        sx += fb.x;
        sy += fb.y;
        cdx += ex * 0.2;
        cdy += ey * 0.2;
        let p = point_to_seg_projection(fb.x + ex * 0.2, fb.y + ey * 0.2, ep.0, ep.1, ep.2, ep.3);
        max_t = max_t.max(p.raw_t);
    }
    let n = kids.len() as f64;
    let extra = [ep.2, ep.3, sx / n + cdx / n, sy / n + cdy / n];
    (max_t.max(reach_mult).min(2.0), Some(extra))
}

pub fn build_segment_metas(bones: &[BoneInput], info: &ChainInfo) -> Vec<BoneSegmentMeta> {
    let endpoints: Vec<(f64, f64, f64, f64, f64, f64, usize)> = bones
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let (dx, dy) = rotate_point(b.length, 0.0, b.angle);
            (b.x, b.y, b.x + dx, b.y + dy, dx, dy, info.bone_to_chain_idx[i])
        })
        .collect();

    bones
        .iter()
        .enumerate()
        .map(|(idx, b)| {
            let (hx, hy, tx, ty, dx, dy, c_idx) = endpoints[idx];
            let len = b.length.max(1.0);
            let chain = &info.chains[c_idx];
            let (is_head, is_tail) = (chain[0] == idx, chain[chain.len() - 1] == idx);
            let reach_mult = b.influence_reach.clamp(0.5, 3.0);

            let mut head_near = is_head && info.parent_chain_idx[c_idx] >= 0;
            let mut tail_near = false;
            if info.chains.len() > 1 {
                for &(ohx, ohy, otx, oty, _, _, oc) in &endpoints {
                    if oc == c_idx {
                        continue;
                    }
                    if is_head && point_to_seg_projection(hx, hy, ohx, ohy, otx, oty).dist <= 32.0 {
                        head_near = true;
                    }
                    if is_tail
                        && info.child_chains_of_chain[c_idx].len() <= 1
                        && point_to_seg_projection(tx, ty, ohx, ohy, otx, oty).dist <= 32.0
                    {
                        tail_near = true;
                    }
                }
            }

            let kids = &info.child_chains_of_chain[c_idx];
            let (pelvis_reach_mult, extra_seed_seg) = if is_tail && kids.len() >= 2 {
                compute_pelvis_fork_seed((hx, hy, tx, ty), reach_mult, bones, info, kids)
            } else {
                (reach_mult, None)
            };

            BoneSegmentMeta {
                bone_idx: idx,
                hx,
                hy,
                tx,
                ty,
                dx,
                dy,
                len,
                reach_mult,
                pelvis_reach_mult,
                strength_mult: b.strength.max(0.15),
                mesh_envelope: b.mesh_envelope,
                pin: b.pin,
                chain_idx: c_idx,
                core_t_min: if head_near && !b.pin { 0.28 } else { 0.0 },
                core_t_max: if tail_near { 0.72 } else { 1.0 },
                extra_seed_seg,
            }
        })
        .collect()
}
