r"""
Slice Action 2.5D Donghua sprite atlases (#00FF00 green screen) and backgrounds into
clean transparent PNG parts aligned 1:1 with Parallax Studio FK rig bones, then
render multi-pose FK verification sheets into D:\_tmp\verify_*_poses.png.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS_DIR = Path(
    r"C:\Users\Admin\.gemini\antigravity\brain\f35b2092-9302-4e5e-a555-cb71a26a8c21"
)
OUT_BASE = ROOT / "assets" / "scenes-action-25d"
TMP_OUT = Path(r"D:\_tmp")


def load_img(name: str) -> Image.Image:
    return Image.open(ARTIFACTS_DIR / name).convert("RGBA")


def remove_chroma_green(
    rgba_img: Image.Image,
    *,
    is_glow_vfx: bool = False,
    despill_strength: float = 1.0,
) -> Image.Image:
    """
    Remove pure #00FF00 chroma key background cleanly while preserving dark ink
    outlines, bright white highlights, blue/cyan energy, amber feathers and crimson.
    """
    arr = np.asarray(rgba_img, dtype=np.float32) / 255.0
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    max_rb = np.maximum(r, b)
    eg = g - max_rb

    if is_glow_vfx:
        greenness = np.clip((eg - 0.015) / 0.16, 0.0, 1.0)
        rb_bright = np.clip((r + b) * 0.72, 0.0, 1.0)
        alpha = np.clip(np.maximum(1.0 - greenness, rb_bright * (1.0 - greenness * 0.75)), 0.0, 1.0)
        # Kill faint JPEG green box noise around glow sprites
        faint_box = (eg > 0.025) & (rb_bright < 0.22)
        alpha = np.where(faint_box, 0.0, alpha)
        g_clean = np.where(eg > 0.005, np.minimum(g, max_rb * 0.92), g)
    else:
        alpha = np.clip(1.0 - (eg - 0.06) / 0.30, 0.0, 1.0)
        pure_bg = (eg > 0.24) & (max_rb < 0.25)
        alpha = np.where(pure_bg, 0.0, alpha)

        spill_mask = eg > 0.02
        g_cap = max_rb + (0.015 * (1.0 - despill_strength))
        g_clean = np.where(spill_mask, np.minimum(g, np.maximum(g_cap, max_rb * 0.96)), g)

        aa_mask = (alpha > 0.02) & (alpha < 0.92) & (eg > 0.02)
        scale = np.where(aa_mask, np.clip(alpha, 0.25, 1.0), 1.0)
        r = np.where(aa_mask, np.clip(r / scale, 0.0, 1.0), r)
        b = np.where(aa_mask, np.clip(b / scale, 0.0, 1.0), b)
        g_clean = np.where(aa_mask, np.minimum(g_clean, np.maximum(r, b)), g_clean)

    out = np.stack([r, g_clean, b, alpha], axis=-1)
    out = np.clip(np.round(out * 255.0), 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGBA")


def crop_cell(img: Image.Image, row: int, col: int, rows: int, cols: int, inset: int = 6) -> Image.Image:
    w, h = img.size
    x0 = int(round(col * w / cols)) + inset
    y0 = int(round(row * h / rows)) + inset
    x1 = int(round((col + 1) * w / cols)) - inset
    y1 = int(round((row + 1) * h / rows)) - inset
    return img.crop((x0, y0, x1, y1))


def tight_crop(img: Image.Image, alpha_thresh: int = 14, pad: int = 4) -> Image.Image:
    arr = np.asarray(img)
    mask = arr[..., 3] >= alpha_thresh
    if not np.any(mask):
        return img
    ys, xs = np.where(mask)
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + 1 + pad)
    y1 = min(arr.shape[0], int(ys.max()) + 1 + pad)
    cropped = img.crop((x0, y0, x1, y1))
    c_arr = np.asarray(cropped).copy()
    c_arr[c_arr[..., 3] < 8] = 0
    return Image.fromarray(c_arr, mode="RGBA")


def resize_to_height(img: Image.Image, target_h: int) -> Image.Image:
    w, h = img.size
    target_w = max(8, int(round(w * (target_h / max(1, h)))))
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)


def resize_to_width(img: Image.Image, target_w: int) -> Image.Image:
    w, h = img.size
    target_h = max(8, int(round(h * (target_w / max(1, w)))))
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)


def resize_by_scale(img: Image.Image, scale: float) -> Image.Image:
    w, h = img.size
    return img.resize(
        (max(8, int(round(w * scale))), max(8, int(round(h * scale)))),
        Image.Resampling.LANCZOS,
    )


def mask_polygon_transparent(img: Image.Image, poly_norm: List[Tuple[float, float]], feather: float = 1.2) -> Image.Image:
    w, h = img.size
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    pts = [(x * w, y * h) for (x, y) in poly_norm]
    draw.polygon(pts, fill=0)
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather))
    arr = np.asarray(img).copy()
    m_arr = np.asarray(mask, dtype=np.float32) / 255.0
    arr[..., 3] = np.clip(np.round(arr[..., 3].astype(np.float32) * m_arr), 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")


def apply_rounded_cap_mask(img: Image.Image, *, top_cap: bool = False, bottom_cap: bool = False, cap_frac: float = 0.12) -> Image.Image:
    w, h = img.size
    arr = np.asarray(img).copy()
    alpha = arr[..., 3].astype(np.float32)
    cap_px = max(6, int(round(h * cap_frac)))
    if top_cap:
        yy = np.arange(cap_px, dtype=np.float32)[:, None]
        xx = np.arange(w, dtype=np.float32)[None, :]
        cx = w * 0.5
        rx = max(4.0, w * 0.54)
        dist_norm = ((xx - cx) / rx) ** 2 + ((cap_px - yy) / cap_px) ** 2
        inside = np.clip(1.38 - dist_norm * 0.75, 0.0, 1.0)
        alpha[:cap_px, :] *= inside
    if bottom_cap:
        yy = np.arange(cap_px, dtype=np.float32)[:, None]
        xx = np.arange(w, dtype=np.float32)[None, :]
        cx = w * 0.5
        rx = max(4.0, w * 0.54)
        dist_norm = ((xx - cx) / rx) ** 2 + (yy / cap_px) ** 2
        inside = np.clip(1.38 - dist_norm * 0.75, 0.0, 1.0)
        alpha[h - cap_px :, :] *= inside
    arr[..., 3] = np.clip(np.round(alpha), 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")


def split_limb_vertical(
    img: Image.Image,
    split_ratio: float,
    overlap_ratio: float = 0.09,
    taper_cap: bool = True,
) -> Tuple[Image.Image, Image.Image]:
    w, h = img.size
    y_split = int(round(h * split_ratio))
    ov = max(8, int(round(h * overlap_ratio)))
    upper = img.crop((0, 0, w, min(h, y_split + ov)))
    lower = img.crop((0, max(0, y_split - ov), w, h))
    if taper_cap:
        upper = apply_rounded_cap_mask(upper, bottom_cap=True, cap_frac=0.14)
        lower = apply_rounded_cap_mask(lower, top_cap=True, cap_frac=0.12)
    return tight_crop(upper, pad=2), tight_crop(lower, pad=2)


def tint_far_limb(img: Image.Image, factor: float = 0.88) -> Image.Image:
    arr = np.asarray(img).copy()
    rgb = arr[..., :3].astype(np.float32) * factor
    arr[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")


@dataclass
class BoneSpec:
    id: str
    x: float
    y: float
    length: float
    angle: float
    parentId: Optional[str] = None


def rotate_pt(x: float, y: float, angle_deg: float) -> Tuple[float, float]:
    rad = math.radians(angle_deg)
    c, s = math.cos(rad), math.sin(rad)
    return x * c - y * s, x * s + y * c


def eval_fk(
    bones: List[BoneSpec],
    pose: Dict[str, Tuple[float, float, float]],
) -> Dict[str, Tuple[float, float, float, float, float]]:
    by_id = {b.id: b for b in bones}
    res: Dict[str, Tuple[float, float, float, float, float]] = {}

    def visit(bid: str):
        if bid in res:
            return res[bid]
        b = by_id[bid]
        dx, dy, drot = pose.get(bid, (0.0, 0.0, 0.0))
        if b.parentId and b.parentId in by_id:
            px, py, prot, _, _ = visit(b.parentId)
            pb = by_id[b.parentId]
            rx, ry = rotate_pt(b.x + dx - pb.x, b.y + dy - pb.y, prot)
            wx, wy = px + rx, py + ry
            wrot = prot + drot
        else:
            px, py = rotate_pt(b.x + dx, b.y + dy, 0.0)
            wx, wy = px, py
            wrot = drot
        ox, oy = rotate_pt(b.x, b.y, wrot)
        res[bid] = (wx, wy, wrot, wx - ox, wy - oy)
        return res[bid]

    for b in bones:
        visit(b.id)
    return res


def checker_canvas(size: Tuple[int, int]) -> Image.Image:
    W, H = size
    bg = Image.new("RGBA", (W, H), (58, 66, 78, 255))
    tile = 24
    bg_arr = np.asarray(bg).copy()
    yy = np.arange(H)[:, None] // tile
    xx = np.arange(W)[None, :] // tile
    alt = ((xx + yy) % 2) == 0
    bg_arr[alt] = [70, 79, 92, 255]
    return Image.fromarray(bg_arr, mode="RGBA")


def compose_pose_canvas(
    parts: List[dict],
    bones: List[BoneSpec],
    pose: Dict[str, Tuple[float, float, float]],
    canvas_size: Tuple[int, int] = (720, 900),
    origin_px: Tuple[int, int] = (360, 460),
    title: str = "",
) -> Image.Image:
    ox, oy = origin_px
    canvas = checker_canvas(canvas_size)
    tfs = eval_fk(bones, pose)
    draw_list = []
    for p in parts:
        if p.get("hidden"):
            continue
        bid = p["boneId"]
        wx, wy, wrot, tx, ty = tfs[bid]
        rx, ry = rotate_pt(p["x"], p["y"], wrot)
        cx = rx + tx + ox
        cy = ry + ty + oy
        rot = p.get("rotation", 0.0) + wrot
        draw_list.append((p["z"], cx, cy, rot, p["img"]))

    draw_list.sort(key=lambda item: item[0])
    for _, cx, cy, rot, sprite in draw_list:
        rotated = sprite.rotate(-rot, resample=Image.Resampling.BICUBIC, expand=True)
        rw, rh = rotated.size
        canvas.alpha_composite(rotated, (int(round(cx - rw * 0.5)), int(round(cy - rh * 0.5))))

    d = ImageDraw.Draw(canvas)
    for b in bones:
        wx, wy, wrot, _, _ = tfs[b.id]
        rad = math.radians(b.angle + wrot)
        tx_end = wx + math.cos(rad) * b.length
        ty_end = wy + math.sin(rad) * b.length
        d.line([(wx + ox, wy + oy), (tx_end + ox, ty_end + oy)], fill=(0, 235, 255, 190), width=2)
        d.ellipse([(wx + ox - 4, wy + oy - 4), (wx + ox + 4, wy + oy + 4)], fill=(255, 210, 40, 230), outline=(15, 23, 42, 255))

    if title:
        d.rectangle([(8, 8), (8 + len(title) * 8 + 16, 32)], fill=(15, 23, 42, 210))
        d.text((16, 14), title, fill=(241, 245, 249, 255))
    return canvas


def place_by_joint(
    bone: BoneSpec,
    img: Image.Image,
    jx_frac: float,
    jy_frac: float,
    z: float,
    name: str,
    rotation: float = 0.0,
    slot: Optional[str] = None,
    variant: Optional[str] = None,
    hidden: bool = False,
) -> dict:
    w, h = img.size
    lx = bone.x + (0.5 - jx_frac) * w
    ly = bone.y + (0.5 - jy_frac) * h
    return {
        "name": name,
        "boneId": bone.id,
        "x": round(lx, 1),
        "y": round(ly, 1),
        "z": z,
        "rotation": rotation,
        "img": img,
        "w": w,
        "h": h,
        **({"slot": slot} if slot else {}),
        **({"variant": variant} if variant else {}),
        **({"hidden": True} if hidden else {}),
    }


def save_pose_sheet(panels: List[Image.Image], out_path: Path) -> None:
    w, h = panels[0].size
    sheet = Image.new("RGBA", (w * len(panels), h), (30, 35, 44, 255))
    for i, pnl in enumerate(panels):
        sheet.paste(pnl, (i * w, 0))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"[verify] Saved {out_path} ({sheet.size[0]}x{sheet.size[1]})")


# ---------------------------------------------------------------------------
# 1. Sword Hunter 2.5D (hero/)
# ---------------------------------------------------------------------------

def build_hero() -> None:
    out_dir = OUT_BASE / "hero"
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = load_img("raw_atlas_sword_hunter_25d_1794659119488.jpg")

    def clean_cell(r: int, c: int) -> Image.Image:
        return tight_crop(remove_chroma_green(crop_cell(atlas, r, c, 4, 4, inset=6)))

    head_calm = resize_to_height(clean_cell(0, 0), 218)
    head_shout = resize_to_height(clean_cell(0, 1), 220)
    torso = resize_to_height(clean_cell(0, 2), 184)
    # Slightly fuller pelvis fauld belt so torso silver waist sits cleanly above it
    pelvis = resize_to_height(clean_cell(0, 3), 144)
    cape = resize_to_height(clean_cell(1, 0), 336)
    arm_r = resize_to_height(clean_cell(1, 1), 160)
    forearm_r = resize_to_height(clean_cell(1, 2), 168)

    arm_l_raw = clean_cell(1, 3)
    aw, ah = arm_l_raw.size
    arm_l_cut = tight_crop(arm_l_raw.crop((0, 0, aw, int(round(ah * 0.61)))), pad=2)
    arm_l_cut = apply_rounded_cap_mask(arm_l_cut, bottom_cap=True, cap_frac=0.14)
    # Slightly broader shoulder cap (+8%) so it seals torso open armhole in both Rest & Slash
    arm_l = arm_l_cut.resize(
        (max(8, int(round(arm_l_cut.size[0] * (166 / arm_l_cut.size[1]) * 1.12))), 166),
        Image.Resampling.LANCZOS,
    )

    forearm_l = resize_to_height(apply_rounded_cap_mask(clean_cell(2, 0), top_cap=True, cap_frac=0.08), 312)
    thigh_l = resize_to_height(clean_cell(2, 1), 186)
    shin_l = resize_to_height(clean_cell(2, 2), 208)
    thigh_r = tint_far_limb(resize_to_height(clean_cell(2, 3), 184), 0.90)
    shin_r = tint_far_limb(resize_to_height(clean_cell(3, 0), 206), 0.90)

    for fname, im in [
        ("head-calm.png", head_calm),
        ("head-shout.png", head_shout),
        ("torso.png", torso),
        ("pelvis.png", pelvis),
        ("cape.png", cape),
        ("arm-l.png", arm_l),
        ("forearm-l.png", forearm_l),
        ("arm-r.png", arm_r),
        ("forearm-r.png", forearm_r),
        ("thigh-l.png", thigh_l),
        ("shin-l.png", shin_l),
        ("thigh-r.png", thigh_r),
        ("shin-r.png", shin_r),
    ]:
        im.save(out_dir / fname)
        print(f"  [hero] {fname}: {im.size[0]}x{im.size[1]}")

    bones = [
        BoneSpec("bone-pelvis", 0, 52, 86, -90),
        BoneSpec("bone-torso", 0, -34, 146, -85, "bone-pelvis"),
        BoneSpec("bone-head", 14, -180, 118, -88, "bone-torso"),
        # Pull near shoulder inside armhole center (-39, -130) & seat cap higher so Combat Slash seals oval cleanly
        BoneSpec("bone-arm-l", -39, -130, 128, 86, "bone-torso"),
        BoneSpec("bone-forearm-l", -30, -2, 120, 74, "bone-arm-l"),
        BoneSpec("bone-arm-r", 42, -144, 130, 90, "bone-torso"),
        BoneSpec("bone-forearm-r", 42, -14, 120, 90, "bone-arm-r"),
        BoneSpec("bone-thigh-l", -20, 62, 154, 92, "bone-pelvis"),
        BoneSpec("bone-shin-l", -25, 216, 178, 90, "bone-thigh-l"),
        BoneSpec("bone-thigh-r", 26, 62, 154, 90, "bone-pelvis"),
        BoneSpec("bone-shin-r", 26, 216, 178, 90, "bone-thigh-r"),
    ]
    bmap = {b.id: b for b in bones}

    parts = [
        place_by_joint(bmap["bone-torso"], cape, 0.50, 0.12, -34, "cape"),
        place_by_joint(bmap["bone-arm-r"], arm_r, 0.45, 0.12, -26, "arm-r"),
        place_by_joint(bmap["bone-forearm-r"], forearm_r, 0.44, 0.10, -24, "forearm-r"),
        place_by_joint(bmap["bone-thigh-r"], thigh_r, 0.48, 0.12, -20, "thigh-r"),
        place_by_joint(bmap["bone-shin-r"], shin_r, 0.36, 0.10, -18, "shin-r"),
        place_by_joint(bmap["bone-thigh-l"], thigh_l, 0.48, 0.12, -8, "thigh-l"),
        place_by_joint(bmap["bone-shin-l"], shin_l, 0.36, 0.10, -6, "shin-l"),
        place_by_joint(bmap["bone-torso"], torso, 0.48, 0.84, 2, "torso"),
        place_by_joint(bmap["bone-pelvis"], pelvis, 0.48, 0.42, 4, "pelvis"),
        place_by_joint(bmap["bone-head"], head_calm, 0.60, 0.85, 10, "head-calm", slot="expression", variant="calm"),
        place_by_joint(bmap["bone-head"], head_shout, 0.60, 0.85, 10, "head-shout", slot="expression", variant="shout", hidden=True),
        place_by_joint(bmap["bone-arm-l"], arm_l, 0.44, 0.21, 16, "arm-l"),
        place_by_joint(bmap["bone-forearm-l"], forearm_l, 0.25, 0.11, 22, "forearm-l"),
    ]
    for p in parts:
        print(f"    layer {p['name']}: x={p['x']}, y={p['y']}, z={p['z']}, size={p['w']}x{p['h']}")

    p_rest = {}
    p_walk = {
        "bone-pelvis": (0, -4, 1),
        "bone-torso": (0, 0, 3),
        "bone-head": (0, 0, -2),
        "bone-thigh-l": (0, 0, -26),
        "bone-shin-l": (0, 0, 8),
        "bone-thigh-r": (0, 0, 26),
        "bone-shin-r": (0, 0, 28),
        "bone-arm-l": (0, 0, 24),
        "bone-forearm-l": (0, 0, -22),
        "bone-arm-r": (0, 0, -26),
        "bone-forearm-r": (0, 0, -18),
    }
    p_slash = {
        "bone-pelvis": (10, 8, -2),
        "bone-torso": (0, 0, 20),
        "bone-head": (0, 0, -10),
        "bone-arm-l": (0, 0, -92),
        "bone-forearm-l": (0, 0, -42),
        "bone-arm-r": (0, 0, 42),
        "bone-forearm-r": (0, 0, 22),
        "bone-thigh-l": (0, 0, -34),
        "bone-shin-l": (0, 0, 34),
        "bone-thigh-r": (0, 0, 30),
        "bone-shin-r": (0, 0, 10),
    }
    save_pose_sheet(
        [
            compose_pose_canvas(parts, bones, p_rest, (680, 900), (320, 440), "Hero: Rest"),
            compose_pose_canvas(parts, bones, p_walk, (680, 900), (320, 440), "Hero: Walk Stride"),
            compose_pose_canvas(parts, bones, p_slash, (680, 900), (320, 440), "Hero: Combat Slash"),
        ],
        TMP_OUT / "verify_hero_poses.png",
    )


# ---------------------------------------------------------------------------
# 2. Spirit Wolf 2.5D (wolf/)
# ---------------------------------------------------------------------------

def build_wolf() -> None:
    out_dir = OUT_BASE / "wolf"
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = load_img("raw_atlas_spirit_wolf_25d_1794659108419.jpg")

    def clean_cell(r: int, c: int) -> Image.Image:
        return tight_crop(remove_chroma_green(crop_cell(atlas, r, c, 4, 4, inset=6)))

    head_raw = clean_cell(0, 0)
    # Preserve 100% of black nose tip & upper fangs while erasing only the protruding lower jaw & chin
    head_top = mask_polygon_transparent(
        head_raw,
        [
            (0.54, 0.72),
            (0.72, 0.68),
            (0.88, 0.65),
            (1.01, 0.63),
            (1.01, 1.02),
            (0.54, 1.02),
        ],
        feather=1.0,
    )
    head = resize_to_width(tight_crop(head_top), 204)
    jaw = resize_to_width(clean_cell(0, 1), 120)
    torso = resize_to_width(clean_cell(0, 2), 210)
    pelvis = resize_to_width(clean_cell(0, 3), 216)

    fl_th, fl_sh = split_limb_vertical(clean_cell(1, 0), 0.45, overlap_ratio=0.09)
    fr_th, fr_sh = split_limb_vertical(clean_cell(1, 2), 0.45, overlap_ratio=0.09)
    bl_th, bl_sh = split_limb_vertical(clean_cell(2, 0), 0.54, overlap_ratio=0.09)
    br_th, br_sh = split_limb_vertical(clean_cell(2, 2), 0.54, overlap_ratio=0.09)

    scale_leg = 112.0 / max(1, fl_th.size[1])
    leg_fl_thigh = resize_by_scale(fl_th, scale_leg)
    leg_fl_shin = resize_by_scale(fl_sh, scale_leg)
    leg_fr_thigh = tint_far_limb(resize_by_scale(fr_th, scale_leg), 0.88)
    leg_fr_shin = tint_far_limb(resize_by_scale(fr_sh, scale_leg), 0.88)

    scale_hind = 120.0 / max(1, bl_th.size[1])
    leg_bl_thigh = resize_by_scale(bl_th, scale_hind)
    leg_bl_shin = resize_by_scale(bl_sh, scale_hind)
    leg_br_thigh = tint_far_limb(resize_by_scale(br_th, scale_hind), 0.88)
    leg_br_shin = tint_far_limb(resize_by_scale(br_sh, scale_hind), 0.88)

    tail = resize_to_width(clean_cell(3, 0).transpose(Image.Transpose.FLIP_LEFT_RIGHT), 138)
    tail_tip = resize_to_width(clean_cell(3, 1).transpose(Image.Transpose.FLIP_LEFT_RIGHT), 128)

    for fname, im in [
        ("head.png", head),
        ("jaw.png", jaw),
        ("torso.png", torso),
        ("pelvis.png", pelvis),
        ("tail.png", tail),
        ("tail-tip.png", tail_tip),
        ("leg-fl-thigh.png", leg_fl_thigh),
        ("leg-fl-shin.png", leg_fl_shin),
        ("leg-fr-thigh.png", leg_fr_thigh),
        ("leg-fr-shin.png", leg_fr_shin),
        ("leg-bl-thigh.png", leg_bl_thigh),
        ("leg-bl-shin.png", leg_bl_shin),
        ("leg-br-thigh.png", leg_br_thigh),
        ("leg-br-shin.png", leg_br_shin),
    ]:
        im.save(out_dir / fname)
        print(f"  [wolf] {fname}: {im.size[0]}x{im.size[1]}")

    bones = [
        BoneSpec("bone-pelvis", -84, 16, 96, 0),
        BoneSpec("bone-torso", 12, 12, 108, -4, "bone-pelvis"),
        BoneSpec("bone-neck", 104, -14, 52, -48, "bone-torso"),
        # Pull head deeper into chest mane & seat jaw condyle directly under cheek ruff
        BoneSpec("bone-head", 128, -44, 92, 8, "bone-neck"),
        BoneSpec("bone-jaw", 136, -24, 60, 14, "bone-head"),
        # Connect tail & tail-tip flush along the U-curve of mirrored tail
        BoneSpec("bone-tail", -136, -6, 92, 165, "bone-pelvis"),
        BoneSpec("bone-tail-tip", -232, 10, 84, 142, "bone-tail"),
        BoneSpec("bone-leg-fl-thigh", 86, 26, 96, 86, "bone-torso"),
        BoneSpec("bone-leg-fl-shin", 92, 122, 98, 92, "bone-leg-fl-thigh"),
        BoneSpec("bone-leg-fr-thigh", 60, 26, 96, 94, "bone-torso"),
        BoneSpec("bone-leg-fr-shin", 54, 122, 98, 90, "bone-leg-fr-thigh"),
        BoneSpec("bone-leg-bl-thigh", -68, 26, 102, 98, "bone-pelvis"),
        BoneSpec("bone-leg-bl-shin", -82, 128, 94, 82, "bone-leg-bl-thigh"),
        BoneSpec("bone-leg-br-thigh", -94, 26, 102, 102, "bone-pelvis"),
        BoneSpec("bone-leg-br-shin", -112, 128, 94, 82, "bone-leg-br-thigh"),
    ]
    bmap = {b.id: b for b in bones}

    parts = [
        place_by_joint(bmap["bone-leg-fr-thigh"], leg_fr_thigh, 0.50, 0.16, -24, "leg-fr-thigh"),
        place_by_joint(bmap["bone-leg-fr-shin"], leg_fr_shin, 0.34, 0.12, -22, "leg-fr-shin"),
        place_by_joint(bmap["bone-leg-br-thigh"], leg_br_thigh, 0.45, 0.16, -20, "leg-br-thigh"),
        place_by_joint(bmap["bone-leg-br-shin"], leg_br_shin, 0.38, 0.12, -18, "leg-br-shin"),
        place_by_joint(bmap["bone-tail-tip"], tail_tip, 0.90, 0.72, -14, "tail-tip"),
        place_by_joint(bmap["bone-tail"], tail, 0.90, 0.34, -12, "tail"),
        place_by_joint(bmap["bone-pelvis"], pelvis, 0.44, 0.38, 0, "pelvis"),
        place_by_joint(bmap["bone-torso"], torso, 0.46, 0.54, 6, "torso"),
        # Put jaw behind head cheek ruff (z=10 vs head z=14), tilted -10 deg closed-ish at rest
        place_by_joint(bmap["bone-jaw"], jaw, 0.20, 0.28, 10, "jaw", rotation=-10.0),
        place_by_joint(bmap["bone-head"], head, 0.32, 0.70, 14, "head"),
        place_by_joint(bmap["bone-leg-fl-thigh"], leg_fl_thigh, 0.50, 0.16, 16, "leg-fl-thigh"),
        place_by_joint(bmap["bone-leg-fl-shin"], leg_fl_shin, 0.34, 0.12, 18, "leg-fl-shin"),
        place_by_joint(bmap["bone-leg-bl-thigh"], leg_bl_thigh, 0.45, 0.16, 20, "leg-bl-thigh"),
        place_by_joint(bmap["bone-leg-bl-shin"], leg_bl_shin, 0.38, 0.12, 22, "leg-bl-shin"),
    ]
    for p in parts:
        print(f"    layer {p['name']}: x={p['x']}, y={p['y']}, z={p['z']}, size={p['w']}x{p['h']}")

    p_rest = {}
    p_walk = {
        "bone-pelvis": (0, -4, -2),
        "bone-torso": (0, 0, 4),
        "bone-head": (0, 0, 4),
        "bone-jaw": (0, 0, 10),
        "bone-leg-fl-thigh": (0, 0, -28),
        "bone-leg-fl-shin": (0, 0, 24),
        "bone-leg-fr-thigh": (0, 0, 24),
        "bone-leg-fr-shin": (0, 0, 12),
        "bone-leg-bl-thigh": (0, 0, 26),
        "bone-leg-bl-shin": (0, 0, -14),
        "bone-leg-br-thigh": (0, 0, -24),
        "bone-leg-br-shin": (0, 0, 20),
        "bone-tail": (0, 0, -12),
    }
    p_gallop = {
        "bone-pelvis": (6, -16, 10),
        "bone-torso": (0, 0, -14),
        "bone-head": (0, 0, 10),
        "bone-jaw": (0, 0, 22),
        "bone-leg-fl-thigh": (0, 0, -46),
        "bone-leg-fl-shin": (0, 0, -14),
        "bone-leg-fr-thigh": (0, 0, -34),
        "bone-leg-fr-shin": (0, 0, -10),
        "bone-leg-bl-thigh": (0, 0, 40),
        "bone-leg-bl-shin": (0, 0, 24),
        "bone-leg-br-thigh": (0, 0, 32),
        "bone-leg-br-shin": (0, 0, 20),
        "bone-tail": (0, 0, 20),
        "bone-tail-tip": (0, 0, 22),
    }
    save_pose_sheet(
        [
            compose_pose_canvas(parts, bones, p_rest, (700, 560), (350, 290), "Spirit Wolf: Rest"),
            compose_pose_canvas(parts, bones, p_walk, (700, 560), (350, 290), "Spirit Wolf: Walk"),
            compose_pose_canvas(parts, bones, p_gallop, (700, 560), (350, 290), "Spirit Wolf: Gallop Pounce"),
        ],
        TMP_OUT / "verify_wolf_poses.png",
    )


# ---------------------------------------------------------------------------
# 3. Shadow Monster 2.5D (monster/)
# ---------------------------------------------------------------------------

def build_monster() -> None:
    out_dir = OUT_BASE / "monster"
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = load_img("raw_atlas_shadow_monster_25d_1794659135676.jpg")

    def clean_cell(r: int, c: int) -> Image.Image:
        return tight_crop(remove_chroma_green(crop_cell(atlas, r, c, 4, 4, inset=6)))

    # Mirror cell (0,0) horizontally so horned skull & glowing red eyes glare LEFT (-X)!
    head_flipped = clean_cell(0, 0).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # Keep full upper fangs, snout & back neck; cleanly erase only the lower mandible along mouth line
    head_top = mask_polygon_transparent(
        head_flipped,
        [
            (-0.02, 0.51),
            (0.22, 0.56),
            (0.42, 0.68),
            (0.46, 0.84),
            (0.46, 1.02),
            (-0.02, 1.02),
        ],
        feather=1.2,
    )
    head = resize_to_height(tight_crop(head_top), 204)
    jaw = resize_to_width(clean_cell(0, 1), 112)
    torso = resize_to_height(clean_cell(0, 2), 240)
    pelvis = resize_to_width(clean_cell(0, 3), 196)

    al_raw, fal_raw = split_limb_vertical(clean_cell(1, 1), 0.39, overlap_ratio=0.07)
    arm_l = tint_far_limb(resize_to_height(al_raw, 140), 0.88)
    forearm_l = tint_far_limb(resize_to_height(fal_raw, 188), 0.88)

    # Keep FULL intact pauldron & bicep from (1,2) top 0..55% (no flat horizontal slice across top!)
    ar_cell = clean_cell(1, 2)
    arm_r_crop = tight_crop(ar_cell.crop((0, 0, ar_cell.size[0], int(round(ar_cell.size[1] * 0.55)))), pad=2)
    arm_r = resize_to_height(apply_rounded_cap_mask(arm_r_crop, bottom_cap=True, cap_frac=0.16), 174)

    far_cell = clean_cell(1, 3)
    forearm_r_crop = tight_crop(far_cell.crop((0, int(round(far_cell.size[1] * 0.28)), far_cell.size[0], far_cell.size[1])), pad=2)
    forearm_r = resize_to_height(apply_rounded_cap_mask(forearm_r_crop, top_cap=True, cap_frac=0.12), 210)

    leg_l_flipped = clean_cell(2, 1).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    leg_r_flipped = clean_cell(2, 3).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    th_l_raw, sh_l_raw = split_limb_vertical(leg_l_flipped, 0.50, overlap_ratio=0.09)
    th_r_raw, sh_r_raw = split_limb_vertical(leg_r_flipped, 0.50, overlap_ratio=0.09)

    scale_mleg = 158.0 / max(1, th_r_raw.size[1])
    thigh_l = tint_far_limb(resize_by_scale(th_l_raw, scale_mleg), 0.88)
    shin_l = tint_far_limb(resize_by_scale(sh_l_raw, scale_mleg), 0.88)
    thigh_r = resize_by_scale(th_r_raw, scale_mleg)
    shin_r = resize_by_scale(sh_r_raw, scale_mleg)

    tail = resize_to_width(clean_cell(3, 0), 178)
    tail_tip = resize_to_width(clean_cell(3, 1), 176)

    for fname, im in [
        ("head.png", head),
        ("jaw.png", jaw),
        ("torso.png", torso),
        ("pelvis.png", pelvis),
        ("arm-l.png", arm_l),
        ("forearm-l.png", forearm_l),
        ("arm-r.png", arm_r),
        ("forearm-r.png", forearm_r),
        ("thigh-l.png", thigh_l),
        ("shin-l.png", shin_l),
        ("thigh-r.png", thigh_r),
        ("shin-r.png", shin_r),
        ("tail.png", tail),
        ("tail-tip.png", tail_tip),
    ]:
        im.save(out_dir / fname)
        print(f"  [monster] {fname}: {im.size[0]}x{im.size[1]}")

    bones = [
        BoneSpec("bone-pelvis", 0, 70, 58, -95),
        # Start torso pivot deeper inside waist (0, 14) so spine flexes cleanly behind pelvis belt with zero gap!
        BoneSpec("bone-torso", -4, 14, 158, -102, "bone-pelvis"),
        BoneSpec("bone-head", -34, -142, 108, 174, "bone-torso"),
        BoneSpec("bone-jaw", -32, -118, 80, 172, "bone-head"),
        # Mount near armored pauldron concentric over torso's right shoulder
        BoneSpec("bone-arm-r", 48, -148, 118, 114, "bone-torso"),
        BoneSpec("bone-forearm-r", 2, -32, 136, 140, "bone-arm-r"),
        # Far arm shoulder & elbow aligned cleanly
        BoneSpec("bone-arm-l", -64, -138, 110, 104, "bone-torso"),
        BoneSpec("bone-forearm-l", -86, -32, 130, 138, "bone-arm-l"),
        BoneSpec("bone-thigh-r", 42, 82, 132, 114, "bone-pelvis"),
        BoneSpec("bone-shin-r", -16, 200, 144, 72, "bone-thigh-r"),
        BoneSpec("bone-thigh-l", -44, 82, 132, 118, "bone-pelvis"),
        BoneSpec("bone-shin-l", -104, 200, 144, 74, "bone-thigh-l"),
        BoneSpec("bone-tail", 52, 54, 124, 26, "bone-pelvis"),
        BoneSpec("bone-tail-tip", 162, 108, 112, -10, "bone-tail"),
    ]
    bmap = {b.id: b for b in bones}

    parts = [
        place_by_joint(bmap["bone-arm-l"], arm_l, 0.62, 0.14, -26, "arm-l"),
        place_by_joint(bmap["bone-forearm-l"], forearm_l, 0.62, 0.12, -24, "forearm-l"),
        place_by_joint(bmap["bone-thigh-l"], thigh_l, 0.68, 0.14, -18, "thigh-l"),
        place_by_joint(bmap["bone-shin-l"], shin_l, 0.42, 0.12, -16, "shin-l"),
        place_by_joint(bmap["bone-tail"], tail, 0.16, 0.24, -14, "tail"),
        place_by_joint(bmap["bone-tail-tip"], tail_tip, 0.12, 0.30, -12, "tail-tip"),
        place_by_joint(bmap["bone-thigh-r"], thigh_r, 0.68, 0.14, -6, "thigh-r"),
        place_by_joint(bmap["bone-shin-r"], shin_r, 0.42, 0.12, -4, "shin-r"),
        place_by_joint(bmap["bone-torso"], torso, 0.48, 0.88, 4, "torso"),
        place_by_joint(bmap["bone-pelvis"], pelvis, 0.48, 0.50, 8, "pelvis"),
        place_by_joint(bmap["bone-jaw"], jaw, 0.82, 0.26, 11, "jaw", rotation=4.0),
        place_by_joint(bmap["bone-head"], head, 0.56, 0.82, 14, "head"),
        place_by_joint(bmap["bone-arm-r"], arm_r, 0.50, 0.28, 18, "arm-r"),
        place_by_joint(bmap["bone-forearm-r"], forearm_r, 0.28, 0.12, 22, "forearm-r"),
    ]
    for p in parts:
        print(f"    layer {p['name']}: x={p['x']}, y={p['y']}, z={p['z']}, size={p['w']}x{p['h']}")

    p_rest = {}
    p_roar = {
        "bone-pelvis": (6, -8, 10),
        "bone-torso": (0, 0, 22),
        "bone-head": (0, 0, 24),
        "bone-jaw": (0, 0, -28),
        "bone-arm-r": (0, 0, 56),
        "bone-forearm-r": (0, 0, 26),
        "bone-arm-l": (0, 0, 44),
        "bone-forearm-l": (0, 0, 20),
        "bone-tail": (0, 0, 24),
    }
    p_pounce = {
        "bone-pelvis": (-16, 6, -12),
        "bone-torso": (0, 0, -24),
        "bone-head": (0, 0, 10),
        "bone-jaw": (0, 0, -22),
        "bone-arm-r": (0, 0, 86),
        "bone-forearm-r": (0, 0, -22),
        "bone-arm-l": (0, 0, 62),
        "bone-forearm-l": (0, 0, -18),
        "bone-thigh-r": (0, 0, -24),
        "bone-thigh-l": (0, 0, 20),
        "bone-tail": (0, 0, -22),
    }
    save_pose_sheet(
        [
            compose_pose_canvas(parts, bones, p_rest, (760, 760), (380, 390), "Monster: Rest"),
            compose_pose_canvas(parts, bones, p_roar, (760, 760), (380, 390), "Monster: Roar"),
            compose_pose_canvas(parts, bones, p_pounce, (760, 760), (380, 390), "Monster: Claw Pounce"),
        ],
        TMP_OUT / "verify_monster_poses.png",
    )


# ---------------------------------------------------------------------------
# 4. Spirit Eagle 2.5D (eagle/)
# ---------------------------------------------------------------------------

def build_eagle() -> None:
    out_dir = OUT_BASE / "eagle"
    out_dir.mkdir(parents=True, exist_ok=True)
    atlas = load_img("raw_atlas_spirit_eagle_25d_1794659158313.jpg")

    def clean_cell(r: int, c: int) -> Image.Image:
        return tight_crop(remove_chroma_green(crop_cell(atlas, r, c, 2, 2, inset=8)))

    bird_body = resize_to_width(clean_cell(0, 0), 340)
    wing_l = resize_to_width(clean_cell(0, 1), 355)
    wing_r = resize_to_width(clean_cell(1, 0), 325)

    for fname, im in [("bird-body.png", bird_body), ("wing-l.png", wing_l), ("wing-r.png", wing_r)]:
        im.save(out_dir / fname)
        print(f"  [eagle] {fname}: {im.size[0]}x{im.size[1]}")

    bones = [
        BoneSpec("bone-bird-body", 0, 12, 145, -36),
        BoneSpec("bone-bird-head", 112, -88, 65, 10, "bone-bird-body"),
        # Slightly higher shoulder mount so downstroke keeps golden cap tucked into breast
        BoneSpec("bone-bird-wing-l", -8, -28, 165, -38, "bone-bird-body"),
        BoneSpec("bone-bird-wing-r", 16, -38, 155, -38, "bone-bird-body"),
    ]
    bmap = {b.id: b for b in bones}
    parts = [
        place_by_joint(bmap["bone-bird-wing-r"], wing_r, 0.16, 0.74, -14, "wing-r"),
        place_by_joint(bmap["bone-bird-body"], bird_body, 0.50, 0.52, 0, "bird-body"),
        place_by_joint(bmap["bone-bird-wing-l"], wing_l, 0.16, 0.72, 14, "wing-l"),
    ]
    for p in parts:
        print(f"    layer {p['name']}: x={p['x']}, y={p['y']}, z={p['z']}, size={p['w']}x{p['h']}")

    p_rest = {}
    p_up = {"bone-bird-body": (0, -8, -4), "bone-bird-wing-l": (0, 0, -34), "bone-bird-wing-r": (0, 0, -26)}
    p_down = {"bone-bird-body": (0, 8, 6), "bone-bird-wing-l": (0, 0, 36), "bone-bird-wing-r": (0, 0, 28)}
    save_pose_sheet(
        [
            compose_pose_canvas(parts, bones, p_rest, (640, 560), (290, 310), "Eagle: Rest"),
            compose_pose_canvas(parts, bones, p_up, (640, 560), (290, 310), "Eagle: Upstroke"),
            compose_pose_canvas(parts, bones, p_down, (640, 560), (290, 310), "Eagle: Downstroke"),
        ],
        TMP_OUT / "verify_eagle_poses.png",
    )


# ---------------------------------------------------------------------------
# 5. Backgrounds & Props/VFX (env/) + VFX sheet verification
# ---------------------------------------------------------------------------

def build_env() -> None:
    out_dir = OUT_BASE / "env"
    out_dir.mkdir(parents=True, exist_ok=True)

    bg_map = {
        "bg_act_s1_misty_pass_1794659088744.jpg": "bg_s1_misty_pass.png",
        "bg_act_s2_sealed_courtyard_1794659104569.jpg": "bg_s2_sealed_courtyard.png",
        "bg_act_s3_crimson_arena_1794659131706.jpg": "bg_s3_crimson_arena.png",
    }
    for src_name, dst_name in bg_map.items():
        bg = Image.open(ARTIFACTS_DIR / src_name).convert("RGBA")
        bg_hd = bg.resize((1920, 1080), Image.Resampling.LANCZOS)
        bg_hd.save(out_dir / dst_name)
        print(f"  [env] {dst_name}: 1920x1080")

    vfx_atlas = load_img("raw_atlas_props_vfx_25d_v2_1794659169471.jpg")
    fg_pillar = resize_to_height(tight_crop(remove_chroma_green(crop_cell(vfx_atlas, 0, 0, 2, 2, inset=8))), 680)
    sword_crescent = resize_to_width(tight_crop(remove_chroma_green(crop_cell(vfx_atlas, 0, 1, 2, 2, inset=8), is_glow_vfx=True)), 580)
    roar_wave = resize_to_width(tight_crop(remove_chroma_green(crop_cell(vfx_atlas, 1, 0, 2, 2, inset=8), is_glow_vfx=True)), 520)
    impact_burst = resize_to_width(tight_crop(remove_chroma_green(crop_cell(vfx_atlas, 1, 1, 2, 2, inset=8), is_glow_vfx=True)), 500)

    items = [
        ("fg-ruin-pillar.png", fg_pillar),
        ("vfx-sword-crescent.png", sword_crescent),
        ("vfx-roar-shockwave.png", roar_wave),
        ("vfx-impact-burst.png", impact_burst),
    ]
    for fname, im in items:
        im.save(out_dir / fname)
        print(f"  [env] {fname}: {im.size[0]}x{im.size[1]}")

    # Render a 2x2 verification sheet on slate checker to catch any green fringe on VFX
    cw, ch = 560, 440
    sheet = checker_canvas((cw * 2, ch * 2))
    d = ImageDraw.Draw(sheet)
    for idx, (fname, im) in enumerate(items):
        gx, gy = (idx % 2) * cw, (idx // 2) * ch
        preview = im.copy()
        preview.thumbnail((cw - 40, ch - 60), Image.Resampling.LANCZOS)
        px = gx + (cw - preview.size[0]) // 2
        py = gy + 40 + (ch - 50 - preview.size[1]) // 2
        sheet.alpha_composite(preview, (px, py))
        d.rectangle([(gx + 8, gy + 8), (gx + len(fname) * 8 + 20, gy + 32)], fill=(15, 23, 42, 210))
        d.text((gx + 14, gy + 14), fname, fill=(241, 245, 249, 255))
    sheet.save(TMP_OUT / "verify_env_vfx.png")
    print(f"[verify] Saved {TMP_OUT / 'verify_env_vfx.png'} ({sheet.size[0]}x{sheet.size[1]})")


if __name__ == "__main__":
    print("=== Slicing Action 2.5D Atlases ===")
    build_hero()
    build_wolf()
    build_monster()
    build_eagle()
    build_env()
    print("=== DONE ===")
