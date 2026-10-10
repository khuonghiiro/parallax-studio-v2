# Banner Render and Export Recipes

Use only the selected rendering approach. These CLI/model and platform examples require verification against the installed generation/browser owner. Reuse approved assets and brief; do not perform every alternative or invent screenshot CLI flags.

### Step 2: Research & Art Direction

1. Resolve an installed design capability only for an unresolved art-direction decision.
2. If reference research is needed, use the available browser and selected sources:
   ```
   Navigate to pinterest.com â†’ search "[purpose] banner design [style]"
   Screenshot 3-5 reference pins for art direction inspiration
   ```
3. Select the number of directions requested, using relevant entries from:
   `references/banner-sizes-and-styles.md`

### Step 3: Design & Generate Options

For each art direction option:

1. **Create HTML/CSS banner** using `frontend-design` skill
   - Use exact platform dimensions from size reference
   - Apply safe zone rules (critical content in central 70-80%)
   - Max 2 typefaces, single CTA, 4.5:1 contrast ratio
   - Reuse only applicable brand rules from the actual authority.

2. **Generate missing/requested visual elements** through an installed generation owner

   **a) Search prompt inspiration** (6000+ examples in ai-artist):
   ```bash
   python3 ../ai-artist/scripts/search.py "<banner style keywords>"
   ```

   **b) Example generation request at 2K** (verify support with the installed generation owner):
   ```bash
   npx -y -p @mrgoonie/multix@0.2.0 multix gemini generate \
     --prompt "<banner visual prompt>" --aspect-ratio <platform-ratio> \
     --size 2K --output assets/banners/banner-2k.png
   ```

   **c) Example generation request at 4K** (use only when supported and needed for the output dimensions):
   ```bash
   npx -y -p @mrgoonie/multix@0.2.0 multix gemini generate \
     --prompt "<creative banner prompt>" --aspect-ratio <platform-ratio> \
     --size 4K --output assets/banners/banner-4k.png
   ```

   Select the actual model through the installed generation owner using current provider support and the brief. These commands illustrate resolution requests; they do not select or establish a Standard/Flash or Pro model. Choose resolution for the final placement, then inspect the returned dimensions, detail, composition, and artifacts. Do not infer speed or quality from a model label.

   **Aspect ratios:** `1:1`, `16:9`, `9:16`, `3:4`, `4:3`, `2:3`, `3:2`
   Match to platform - e.g., Twitter header = `3:1` (use `3:2` closest), Instagram story = `9:16`

   **Visual prompt tips** (see the `ai-artist` skill's Nano Banana reference):
   - Be descriptive: style, lighting, mood, composition, color palette
   - Include art direction: "minimalist flat design", "cyberpunk neon", "editorial photography"
   - Specify no-text: "no text, no letters, no words" (text overlaid in HTML step)

3. **Compose final banner** â€” overlay text, CTA, logo on generated visual in HTML/CSS

### Step 4: Export Banners to Images

After designing HTML banners, export each to PNG using `ak:agent-browser`, the runtime's Chrome DevTools MCP tools, or project-native browser tooling:

1. **Serve HTML files** via local server (python http.server or similar)
2. **Screenshot each banner** at exact platform dimensions:
   ```bash
   # Export banner to PNG at exact dimensions
   # capture with ak:agent-browser or the runtime's Chrome DevTools MCP tools \
     --url "http://localhost:8765/banner-01-minimalist.html" \
     --width 1500 --height 500 \
     --output "assets/banners/{campaign}/{variant}-{size}.png"
   ```
3. **Compress when needed** to meet the requested placement's verified file limit; confirm the selected exporter supports the operation:
   ```bash
   # With custom max size threshold
   # capture with ak:agent-browser or the runtime's Chrome DevTools MCP tools \
     --url "http://localhost:8765/banner-02-gradient.html" \
     --width 1500 --height 500 --max-size 3 \
     --output "assets/banners/{campaign}/{variant}-{size}.png"
   ```

**Output path convention** (per `assets-organizing` skill):
```
assets/banners/{campaign}/
â”œâ”€â”€ minimalist-1500x500.png
â”œâ”€â”€ gradient-1500x500.png
â”œâ”€â”€ bold-type-1500x500.png
â”œâ”€â”€ minimalist-1080x1080.png    # if multi-size requested
â””â”€â”€ ...
```

- Use kebab-case for filenames: `{style}-{width}x{height}.{ext}`
- Date prefix for time-sensitive campaigns: `{YYMMDD}-{style}-{size}.png`
- Campaign folder groups all variants together
