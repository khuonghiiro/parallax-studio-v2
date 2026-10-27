# Commit workflow

Perform a simple commit directly; use a git specialist only when it adds useful isolation or handles a complex history change.

1. Inspect `git status --short`, the worktree diff and already-staged diff. Identify which paths belong to the authorized change; preserve unrelated staged work.
2. Review those paths for real credentials, private material, generated noise and unintended behavior. A keyword match alone is not a secret. If a real secret is present, stop the commit and report its location with the value redacted.
3. Stage the specific authorized paths with `git add -- <paths>`, then inspect `git diff --cached`. Do not use blanket staging or reset another contributor's index changes.
4. Group commits by coherent behavior and repository conventions, not file-count thresholds. Documentation uses `docs` where appropriate; agent configuration paths have no special type restriction. Reference related issues when the repository requires it.
5. Run required checks (`pnpm verify`, unit tests). **Parallax Studio V2 rule:** If the live Electron app is running (TCP 9877), capture a full-screen app screenshot (`pnpm pxs review --view app`) to visually confirm there is no black screen, blank canvas, or error toast before committing. Commit with `git commit -m "type(scope): description"` in accented Vietnamese. Verify the resulting commit and remaining status. Never bypass hooks.
6. Push only when requested, using the repository's permitted branch and ordinary push, after confirming the full-screen visual verification passes cleanly. Report the actual command result.
