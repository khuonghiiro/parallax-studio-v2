---
name: ak:motion-video
description: Produce beat-synced 1080p motion-graphic videos in HyperFrames (HTML + GSAP) with an AI voice-over, Vietnamese karaoke captions, SFX and generated music, in any of ~60 named style profiles (glass keynote, comic, Apple-like cinematic, Swiss, cyberpunk, Nike-like and more) or a per-scene mix of them, with production-grade juicy motion and fast 1:1 / 9:16 editions. Use when the user asks for a launch/release/feature video, motion graphic, animated explainer or promo clip, a restyle, or a square/vertical version of one.
user-invocable: true
argument-hint: "[brief or project] [--poor]"
when_to_use: "Use when asked to make or restyle a motion-graphic/launch/changelog/explainer video with voice-over, captions and music synced to the beat, e.g. 'làm video motion graphic giới thiệu release', 'làm thêm bản phong cách comic', 'làm video phong cách Apple', 'nền Apple, phần UI kiểu Linear, kết kiểu Nike', 'thêm nhạc nền đúng beat', 'render bản nén để đăng social', 'làm thêm bản 9:16 cho Reels', 'resize sang 1:1', 'make this more tasteful'. Not for talking-head editing, AI text-to-video clips (Seedance/Veo) or React/Remotion projects."
category: media
keywords: [motion-graphic, style-profile, style-composition, video, hyperframes, gsap, launch-video, voice-over, captions, karaoke, beat-sync, elevenlabs, gemini-tts, multix, spider-verse, comic, keynote, social-encode, motion-craft, reframe, vertical-video, 9x16, square, creative-direction, tasteful, poor]
license: MIT
metadata:
  author: agentkit
  version: "1.3.0"
  attribution: "Vendored from bestagentkits/motion-video-skill (MIT)"
  upstream: "github.com/bestagentkits/motion-video-skill"
  upstream_sha: "a73702b893a3a5462804b5b844c6080e76f69275"
  imported_at: "2026-09-25"
---

# Motion video

Make a 1920×1080 30 fps motion-graphic video where the scene cuts land on the
music's beats, reveals land on spoken words, and the audio is broadcast-clean.
The workflow is fully scripted: facts → script → multix audio → forced
alignment → beat grid → bar-spliced music → timeline + mix → HTML composition →
lint/check/snapshot → render → remux → social encode → optional 1:1 / 9:16
editions.

## Production bar

Work as an exceptional motion designer delivering a real production piece, not a
demo or prototype. Every scene has a focal point, depth, overlapping
choreography, anticipation and follow-through, micro-motion through its holds,
and a transition that carries into the next scene. The juice (slams, smears,
squash and stretch, impact frames) scales with the base style's energy and never
breaks its constraints. `references/motion-craft.md` holds the principles, the
technique cookbook, the demo tells to replace and a per-scene director's pass.

## Modes

- **Default:** a director subagent on the Opus tier writes the creative
  direction and reviews the draft for taste; an executor subagent on the Sonnet
  tier runs the pipeline and builds the composition from that brief. The main
  session pins the outcome, owns the brief and verifies the result.
- **`--poor`:** one session and no subagents, with lean reads, a compact brief
  and one review round, for the lowest token spend. It never skips a check.

`references/orchestration.md` holds the roles, the brief and review formats,
the delegation packets, the degrade rule for runtimes without per-subagent
model tiers, and what `--poor` trims.

## Styles

Every look is a style profile: a compact motion-design grammar covering
palette, typography, layout, material, texture, camera, transitions, pacing,
beat response, UI choreography, diagrams, character motion, captions and sound.
`references/styles/index.yaml` lists them, one line each. Brand names
such as Apple, Nike, Linear or NVIDIA are aliases that lead to a canonical motion
language (for example Apple-like leads to `cinematic-product-launch`). The output
never uses a brand's logos, fonts or assets.

- **One style:** name it and use that profile as the base, e.g. "comic style"
  gives `comic-multiverse` and "Apple-like" gives `cinematic-product-launch`.
- **Mixed:** keep one base and borrow individual dimensions from other styles
  for particular scenes, e.g. an Apple-like base with Linear-like UI demos,
  blueprint diagrams and a Nike-like finale. `references/style-system.md` holds
  the grammar and the deterministic resolution rules.
  `scripts/resolve-style.py` resolves the mix into a per-scene table.

Three styles also have a detailed reference taken from real work, and their demo
shows the finish to aim for:

| Style id | Detailed reference | Public demo | Feel |
|---|---|---|---|
| `comic-multiverse` | `references/style-comic-spiderverse.md` | [Dewee v3.34 comic edition](https://x.com/goon_nguyen/status/2103332658151555231), the 151 s social encode | loud, playful, hand-made |
| `glass-keynote` | `references/style-glass-keynote.md` | the 144 s edition of the same release | premium, calm, clear |
| `cinematic-product-launch` | `references/style-cinematic-product-launch.md` | none yet; rules distilled from a published premium product-video framework | minimal, exclusive, continuous |

The working projects of those editions are not bundled, because the generated
voice-over, music and SFX are large and provider-licensed. Build every new video
from `assets/templates/index-skeleton.html` plus the resolved style.

## Scope

This skill handles:
- New videos in any of the styles, restyles of an existing video as a separate project,
  and partial reworks (new music, re-timed drops, re-mix, re-render, social encode).
- Audio through the `multix` CLI: Gemini TTS voice, ElevenLabs SFX, ElevenLabs
  Music composition plans, ElevenLabs forced alignment.

This skill does NOT handle:
- Generative text-to-video footage (use `ak:video` or `multix`
  Seedance/Veo directly).
- React/Remotion compositions or generic HyperFrames questions (use `ak:hyperframes` or
  `ak:remotion`).
- Publishing to social accounts: produce the file and let the user post it.

## How to work

1. Pin the outcome before touching files: topic and sources, style (a base
   from `references/styles/index.yaml`, plus layers only if the brief asks for
   different looks in different parts; record them in `data/style.json`, and
   lock the base's palette and BPM band), duration, voice language (English VO +
   Vietnamese captions by default), ending, signature. Ask only if the style or
   the facts source is unknown. Pick the mode (`references/orchestration.md`):
   by default get the direction brief before any audio is generated.
2. Create `assets/videos/<slug>/` (never overwrite a finished edition) and a plan
   under `plans/` following the repo convention. Copy the templates from
   `assets/templates/` of this skill: `scripts/*.mjs`, `data/*.example.json`
   (rename to `.json`; `style.json` is optional for a single style), `hyperframes.json`, `index-skeleton.html` as
   `index.html`, plus `scripts/fit-beat-grid.py`.
3. Follow `references/production-pipeline.md` step by step. Each step writes a
   file the next one reads, so do not reorder them.
4. Get the music right with `references/audio-and-beat-sync.md`: fit the grid,
   splice bars so the drops land where the script needs them, verify the splice,
   and measure the voice/music balance.
5. Build `index.html` with `references/composition-contract.md` and the base
   profile, starting from `assets/templates/index-skeleton.html`. With layers,
   run `python scripts/resolve-style.py resolve data/style.json --script data/script.json`,
   paste its per-scene table into the plan, and take each dimension from the
   style the table names. Composition never changes the contract, timing, mix or
   render checks. When a
   scene type repeats (stats, diagrams, charts, terminal, graph, outro), follow
   the demo's choreography for that scene instead of inventing a new one.
   Choreograph with `references/motion-craft.md`, run its director's pass on
   every scene, and review motion on draft contact sheets before the final render.
6. For square or vertical editions, follow `references/reframe.md`: add
   `html[data-ratio]` overrides in the master, run `scripts/reframe.py`, then
   validate and render inside the edition. Audio and timing are reused as-is.
7. Finish only when every check in "Done when" passes; report measured numbers,
   not impressions.

Keep credentials inside multix's own config. Never print API keys or copy them
into project files, plans or reports.

## Done when

- `hyperframes lint` and `check` pass; snapshots of every scene were reviewed.
- Every scene passed the director's pass in `references/motion-craft.md`.
- Each requested 1:1 / 9:16 edition passes the same lint, check, ffprobe (its
  frame size), loudness and blackdetect checks.
- `verify-arrangement.py` reports every segment within ±2 ms and
  `measure-mix-balance.py` shows the music ~4–6 dB under speech.
- ffprobe: 1920×1080, 30 fps, expected duration, AAC 48 kHz stereo;
  ebur128 ≈ −14 LUFS with peak ≤ −1 dBFS; blackdetect finds nothing outside fades.
- `build-timeline` printed no clip/overlap/missing-word warnings.
- On-screen facts trace to the sources collected in step 1.

## Resources

- `references/production-pipeline.md`: every command from scaffold to social
  encode and studio preview, plus the rebuild table.
- `references/audio-and-beat-sync.md`: voice, SFX cues, music plans,
  bar-splice arrangement, anchors, mix numbers and the ducking pitfall.
- `references/composition-contract.md`: TIMING shape, helpers, determinism,
  scene windows, captions, mascot, renderer limits, signature.
- `references/orchestration.md`: director (Opus tier) and executor (Sonnet
  tier) roles, brief and review formats, delegation packets, tier degrade, `--poor`.
- `references/motion-craft.md`: production bar, juice budget by energy,
  principles, technique cookbook, demo tells, director's pass, contact-sheet review.
- `references/reframe.md`: 1:1 and 9:16 editions by re-layout or quick ffmpeg fit.
- `references/style-system.md`: dimensions, scene types, composition spec,
  resolution rules, brand-alias policy, and how to add a style.
- `references/styles/index.yaml`, generated: one entry per style.
  `references/styles/profiles/<id>.yaml` holds each full profile.
- `references/style-glass-keynote.md` / `references/style-comic-spiderverse.md` /
  `references/style-cinematic-product-launch.md`: detailed tokens, layers,
  components and caption look for the three reference styles. The cinematic one
  adds the brand lock, BPM-by-mood bands and the SFX subtraction audit.
- `scripts/resolve-style.py find|resolve|validate|index`: look up a style from
  words, resolve a composition into per-scene sources, and validate the catalog.
  Needs PyYAML.
- `scripts/reframe.py <project> --ratio 1x1|9x16 [--out dir]`: writes a
  square or vertical edition next to the master (hard-linked assets) and warns
  about layout that still assumes 1920×1080. Standard library only.
- `scripts/fit-beat-grid.py <music> [--min-bpm N --max-bpm N]`: BPM, BEAT0 and a
  per-bar kick/energy table.
- `scripts/verify-arrangement.py <project> [--tolerance-ms 2]`: splice lag per
  segment; exits 1 on drift.
- `scripts/measure-mix-balance.py <project>`: music under speech vs in gaps,
  from `build-timeline.mjs --stems`.
- `scripts/tests/`: `test_style_system.py` needs PyYAML; `test_audio_tools.py`
  needs ffmpeg, numpy and scipy; `test_reframe.py` needs nothing else. Run them with `python -m pytest scripts/tests`.
- `assets/templates/`: project scripts (`generate-audio-assets`,
  `align-voiceover`, `arrange-music`, `build-timeline`), example data files and
  the composition skeleton.
