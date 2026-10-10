# Update Brand Guidance

Resolve the requested fields and current brand authority from the brief and repository navigation. Reuse known theme, voice, colors, and typography; ask only for a material missing decision. Preserve unrelated identity choices.

## Apply the Change

1. Edit the owning document or token source for the requested fields. Tone-only updates do not require token synchronization.
2. For visual changes, identify generated consumers and the project's generator. The bundled `scripts/sync-brand-to-tokens.cjs` assumes `docs/brand-guidelines.md`, `assets/design-tokens.json`, and `assets/design-tokens.css`; inspect those assumptions before running it from the project root.
3. Inspect its `--dry-run` output and compare affected tokens with current custom values. Use the project's generator or scoped edits if the bundled writer would remove custom tokens. Snapshot affected files before an authorized overwrite.
4. Run only the affected sync, inspect the actual diff, and verify changed values and references. Do not treat extraction output alone as proof that all generated files changed correctly.
5. Report the requested change, actual paths, and checks. Resolve installed design-system or brand-context capabilities only when needed; do not assume plugin-root paths on every runtime.

## Color Presets

If user specifies a preset name, use these defaults:

| Preset | Primary | Secondary | Accent |
|--------|---------|-----------|--------|
| ocean-professional | #3B82F6 Ocean Blue | #F59E0B Golden Amber | #10B981 Emerald |
| electric-creative | #FF6B6B Coral | #9B5DE5 Electric Purple | #00F5D4 Neon Mint |
| forest-calm | #059669 Forest Green | #92400E Warm Brown | #FBBF24 Sunlight |
| midnight-purple | #7C3AED Violet | #EC4899 Pink | #06B6D4 Cyan |
| sunset-warm | #F97316 Orange | #DC2626 Red | #FACC15 Yellow |
