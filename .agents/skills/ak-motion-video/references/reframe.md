# Reframe: 1:1 and 9:16 editions

A square or vertical edition reuses everything the 16:9 master already paid
for: voice-over, alignment, music arrangement, TIMING, mix and captions. Only
the frame size and the layout change, so an edition costs one CSS block and one
render, not a new project.

| Ratio | Frame | Typical target |
|---|---|---|
| `16x9` (master) | 1920×1080 | YouTube, X, website |
| `1x1` | 1080×1080 | feed posts, LinkedIn |
| `9x16` | 1080×1920 | Reels, TikTok, Shorts, Stories |

## Pick the route

| Route | Cost | Result | Use when |
|---|---|---|---|
| **Re-layout** (`reframe.py`) | one CSS block per ratio and a render | text and UI sized and placed for the frame | anything that will be published |
| **Quick fit** (ffmpeg only) | one command, no authoring | 16:9 picture inside a blurred fill, or a centre crop | previews, internal review, or when the user accepts small text |

Default to re-layout for publishing. Offer the quick fit when speed matters
more than finish, and say which one you used.

## Re-layout

### 1. Keep the master ratio-aware (cheap when done from the start)

The skeleton already does most of this; keep it that way while authoring:
- Size frames from `--W`/`--H` (`#root`, `.layer`), never literal 1920/1080.
- Put layout in CSS classes, not inline styles or JS. Tween with relative
  values (`xPercent`, `yPercent`, `scale`) instead of pixel offsets tied to
  1920 px.
- Lay scenes out with flex or grid inside a stage, so most of them reflow
  without overrides.
- Keep captions and the signature on their CSS variables (`--cap-w`,
  `--cap-bottom`, `--cap-size`); the skeleton sets values for each ratio.

### 2. Write the ratio overrides in the master

Add `html[data-ratio="9x16"] ...` (or `"1x1"`) rules to the master's `<style>`.
Only override what breaks, scene by scene:
- **Side-by-side becomes stacked.** Two-column feature layouts turn into a
  column: `flex-direction: column`, the visual on top and the text below.
- **Type scales to the width.** In 9:16 headlines are ~80–96 px across a
  900 px measure; in 1:1 ~72–88 px.
- **Safe areas.** Vertical social apps cover the top ~220 px and bottom
  ~420 px, plus ~140 px on the right edge. Keep text and faces inside
  1080×1280 starting at y=220. Captions go to `--cap-bottom: 440px`.
- **Wide content.** Tables, timelines and diagrams wider than the frame become
  vertical, lose columns, or scale down with one hero element enlarged.
- Transitions that move along x (whip, smear) can stay; check that their
  travel distance uses `--W` or `xPercent`.

### 3. Generate the edition

```bash
python <skill>/scripts/reframe.py . --ratio 9x16     # writes ../<slug>-9x16/
python <skill>/scripts/reframe.py . --ratio 1x1      # writes ../<slug>-1x1/
```

The script copies `index.html` with the new root size, viewport, `data-ratio`
and `--W`/`--H`, copies `hyperframes.json`, and hard-links `assets/` and
`compositions/` (copies when hard links are unavailable), so it takes no extra
disk and seconds to run. Sub-compositions under `compositions/` are not
rewritten or checked: size them from `--W`/`--H` too. A hard-linked file is the
master's file, so editing it inside the edition changes the master. Its warnings point to what still needs attention: a missing
`data-ratio` block, a layout that ignores `--W`/`--H`, or the line numbers of
remaining 1920/1080/960/540 pixel values. Read those lines instead of the
whole file.

The edition directory is derived output. Never edit it: change the master and
run the script again, which replaces the edition. The script refuses to write
into a directory it did not create, and the master's TIMING must already be
injected.

### 4. Validate and render inside the edition

```bash
cd ../<slug>-9x16
npx --yes hyperframes@0.8.77 lint
npx --yes hyperframes@0.8.77 check
npx --yes hyperframes@0.8.77 snapshot --at <one busy moment per scene> --describe false
npx --yes hyperframes@0.8.77 render -q high -f 30 --strict -o ../<slug>/renders/<slug>-9x16-raw.mp4
ffmpeg -y -i ../<slug>/renders/<slug>-9x16-raw.mp4 -i ./assets/audio/mix.m4a -map 0:v:0 -map 1:a:0 -c copy -movflags +faststart ../<slug>/renders/<slug>-9x16.mp4
```

Write renders into the master's `renders/`: the edition directory is replaced
on every run of the script, so anything saved inside it is lost. The
`../<slug>/renders` path assumes the default edition location next to the
master; with `--out`, use the master's absolute `renders/` path.

Downscale snapshots before viewing them, or check a contact sheet
(`motion-craft.md`). The remux, loudness and blackdetect checks are the same as
for the master (`production-pipeline.md` step 8), with the edition's frame size
in the ffprobe check. The social encode is step 9 unchanged.

## Quick fit (ffmpeg only)

From the finished master, with no authoring:

```bash
# 9:16: master centred on a blurred, darkened fill of itself
ffmpeg -y -i renders/<slug>.mp4 -filter_complex \
  "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.12[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
  -map "[v]" -map 0:a -c:v libx264 -crf 20 -preset slow -c:a copy -movflags +faststart renders/<slug>-9x16-fit.mp4

# 1:1: centre crop (only when every scene keeps its content inside the middle 1080 px)
ffmpeg -y -i renders/<slug>.mp4 -vf "crop=ih:ih:(iw-ih)/2:0,format=yuv420p" \
  -map 0:v -map 0:a -c:v libx264 -crf 20 -preset slow -c:a copy -movflags +faststart renders/<slug>-1x1-crop.mp4
```

The fit version keeps everything but shows text at 56% of its size; the crop
cuts anything outside the centre column, including the caption edges and the
signature. Say so when you deliver either one.
