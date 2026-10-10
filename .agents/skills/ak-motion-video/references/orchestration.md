# Orchestration: director and executor, or `--poor`

Taste and labour need different models. Creative direction (the concept, the
choreography and "make this more tasteful" notes) is judgment, so it runs on the
strongest tier. Authoring `index.html` and running the pipeline is long,
mechanical work, so it runs on a cheaper, fast tier that follows a written brief.

| Mode | Who does what | Use when |
|---|---|---|
| Default | Controller (the main session) pins the outcome and verifies. **Director** (Opus tier) writes the direction brief and reviews contact sheets. **Executor** (Sonnet tier) runs the pipeline and builds the composition. | every new video or restyle, and "make this more tasteful" on an existing one |
| `--poor` | One session does everything; no subagents; lean reads and one review round | the user wants the lowest token spend |

Partial reworks that change no visuals (new music, re-mix, re-render, social
encode, a quick-fit edition) skip the director in both modes.

## Default mode

### Roles and file ownership

- **Controller** owns step 1 of "How to work", the scaffold (pipeline step 0),
  `data/script.json` (facts and copy), `data/style.json`, `data/direction.md`,
  the plan and the final check against "Done when". It never writes `index.html`.
- **Director** is read-only. It returns text; the controller saves it. It never
  sees `index.html` source: it judges the brief, the timing and the pictures.
- **Executor** owns everything under the project except the controller's files:
  audio, timeline, `index.html`, renders, contact sheets, editions. It reports
  deviations from the brief instead of silently changing direction.

### Flow

1. **Controller:** pin the outcome, scaffold the project (pipeline step 0),
   then collect facts, write `data/script.json` (step 1) and resolve the style
   (`resolve-style.py resolve` for a mix). Scaffolding first keeps the template
   copy from overwriting the script.
2. **Direction (director, before any audio).** The brief names moments by
   spoken word (`W(sid, "word")`) and by drop, not by seconds, so it does not
   need TIMING yet. The director may also return line-level script edits for
   hook, rhythm and punch; the controller applies the ones that keep the facts
   true, then saves the brief as `data/direction.md`.
3. **Build (executor).** Pipeline steps from 2 (audio) to the first draft render
   (`production-pipeline.md`), composition from `data/direction.md` plus the
   contract, then one contact sheet per scene (`motion-craft.md`). It returns
   the sheet paths, the check results and a list of deviations.
4. **Taste review (director), at most two rounds.** Input: `data/direction.md`,
   the sheets, one or two downscaled snapshots of hero moments and the
   deviation list. Output: a verdict of `ship` or `revise` and at most eight
   ranked notes. The controller appends each review to `data/direction.md`; the
   executor applies the notes and re-renders only the scenes they touch.
5. **Finish (executor):** final render, remux, checks, social encode and any
   editions. **Controller:** verify every "Done when" item from the reported
   numbers, and look at one sheet per scene before reporting.

### Direction brief (`data/direction.md`)

```markdown
# Direction: <slug>
Concept: <one sentence: the visual idea that ties the piece together>
Base: <style id> · energy <n> · juice budget <from motion-craft.md>
Locks: palette <tokens> · type <families/weights> · signature untouched
Motif: <a shape, motion or colour that recurs and evolves across scenes>
Rhythm: <per scene: calm | build | drop | breathe, with the drops>
Taste rules: <3–6 things this piece never does>

## <sid> · <scene type> · <role in the rhythm>
- Focal beats: <word or drop> → <where the eye goes>
- Hero moment: <cookbook technique> on W(<sid>, "<word>") or drop <n>
- Entrances: <element> → <verb>, <ease>, <overlap with the lead>
- Depth: <bg / mid / fg>, hold motion <settleCam, drift, sweep>
- Exit: <handoff into the next scene: match-move, whip, wipe, zoom-through>
- Avoid: <scene-specific don'ts>
```

### Taste review notes

```markdown
## Review <n>: revise | ship
Keep: <what already works; the executor must not lose it>
1. [<sid> @ <s>] <what reads as demo or clumsy> → <the change, as a cookbook recipe or an exact ease/duration/offset>
2. ...
```

Notes are concrete and ranked by visual impact. "Make it more premium" is not a
note; "s02 @ 5.9: the 40% lands flat; slam on W(s02, "faster") and push the
camera 1.00 → 1.04 through the hold" is.

### Delegation

Give each subagent a packet with paths, not the conversation. The skill
directory is `<skill>` and the project is `<project>`.

```text
delegate_agent capability(subagent_type="ui-ux-designer", model="opus",
  description="Motion video creative direction",
  prompt="You are the creative director of a production motion-graphic video. Read <skill>/references/motion-craft.md, the base profile <skill>/references/styles/profiles/<id>.yaml and, for a reference style, its style-*.md. Inputs: <project>/data/script.json, the resolved per-scene style table (below), outcome: <audience, duration, ending>. Return only the direction brief in the format below, then optional line-level script edits that keep every fact. Do not write files. <brief format> <style table>")

delegate_agent capability(subagent_type="fullstack-developer", model="sonnet",
  description="Build motion video",
  prompt="Build the video in <project> with the skill at <skill>. The project is scaffolded and data/script.json is final. Follow <skill>/references/production-pipeline.md from step 2 to the draft render, and author index.html from <skill>/assets/templates/index-skeleton.html, <skill>/references/composition-contract.md and <project>/data/direction.md. Do not edit data/script.json, data/style.json or data/direction.md. Finish with a draft render and one contact sheet per scene. Return: sheet paths, lint/check results, build-timeline warnings, and deviations from the brief with the reason for each.")
```

A taste review reuses the director packet with the sheets, snapshots and
deviation list in place of the script, and asks for review notes only. A fix
round reuses the executor packet with the notes and the scenes to re-render.

### Model tiers and degrade

Per-subagent model tiers are preferred, not required:
- The runtime can assign tiers: director on Opus, executor on Sonnet. An
  agent definition can pin its own model; when the runtime may ignore the
  per-call tier, confirm which tier the executor ran on, or tell the user it
  may run on the director's tier.
- Subagents work but inherit one model: keep the roles and the files. Tell the
  user in one sentence that direction and execution run on the same model.
- No subagent dispatch: run the roles one after another in this session.
  Still save `data/direction.md` before building, and still review sheets
  against it.

Output from the cheaper tier is checked, not trusted: the controller reads the
reported numbers and looks at the sheets, and the director reviews every scene
at least once.

## `--poor` mode

One session, no director or executor subagents, and every step kept to the
fewest tokens that still meet "Done when". The session model is whatever the
user runs; the skill does not switch it.

- **Direction:** write a compact brief into the plan: the concept line, the
  taste rules and one line per scene (hero technique and exit). Skip the full
  per-scene template.
- **Reads:** the base profile, the contract sections you are using, and the
  technique cookbook and director's pass of `motion-craft.md`. Read reference
  style files only for the scene types you build. Read `index.html` back by
  line range or search, not whole.
- **Composition:** reuse the skeleton helpers and the reference demo's
  choreography for repeated scene types instead of inventing new ones.
- **Review:** one draft render and one contact sheet for the whole video
  (`fps=2,scale=240:-1,tile=8x<rows>`), one fix round, snapshots only where the
  sheet shows a problem. Run the director's pass once as a self-check.
- **Audio:** one music generation; fix drop timing by splicing bars
  (`audio-and-beat-sync.md`), not by regenerating.
- **Editions:** re-layout only when the user will publish the edition;
  otherwise the ffmpeg quick fit from `reframe.md`, and say which one you used.

`--poor` never skips lint, check, the audio checks or the final ffprobe,
loudness and blackdetect checks.
