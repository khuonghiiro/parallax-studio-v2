# next — Show and Execute Next Step

Surface the smartest next action and execute it.

## When to Use

User wants to continue working on a playbook — the primary day-to-day command.

## Process

1. **Resolve Playbook**
   - If `[name]` given: load that playbook's manifest via `scripts/manifest.cjs read <slug>`.
   - If no name: scan `data/playbooks/` for active playbooks. If exactly one → use it. If multiple → list all with progress, ask user to pick.
   - If none exist → suggest `/ak:play create`.

2. **Evaluate Graph** — run `scripts/graph.cjs evaluate <slug>`. Returns step statuses, ready steps, blocked steps, stale steps.

3. **Pull Goal Metrics** — run `scripts/goals.cjs pull <slug>`. Fetches latest values from configured API sources (GA4, GSC, Stripe via `scripts/metrics-bridge.cjs`). Falls back to manual input if no API configured.

4. **Generate Smart Suggestions** — run `scripts/smart-suggest.cjs <slug>`. Analyzes:
   - Biggest goal gaps (furthest from target)
   - Which ready steps impact lagging metrics
   - Priority = gap size x step readiness x expected impact

5. **Display Dashboard**
   - Goal progress: metric name, current/target, trend arrow, percentage.
   - Smart suggestions: ranked list with reasoning.
   - Ready steps: all steps with dependencies satisfied.

6. **Execute Selection**
   - If a single ready step is within the requested continuation scope, show its details and proceed. Preserve an explicit human-decision gate; ask only for a missing decision or unapproved external effect.
   - If multiple ready → show all, let user pick one or select parallel batch.
   - If none ready → show what's blocking each pending step. Suggest unblock actions.

7. **Run Step** — verify the mapped command/skill/agent is installed, then invoke it. Pass step context (playbook inputs, previous step outputs, relevant learnings from manifest).

8. **Inject Learnings** — before execution, load matching learnings from manifest. Apply as constraints to the agent/skill invocation.

9. **Capture Output** — save generated artifacts to `data/playbooks/{slug}/{step-output-dir}/`.

10. **Update Manifest** — verify output artifacts and required gates, then run `scripts/manifest.cjs update <slug>`:
    - Set step status to `completed` (or `gate-pending` if step has a gate).
    - Record output file paths, completion timestamp.
    - Mark downstream steps whose inputs are now satisfied.

## Error Handling

- Playbook not found → list available playbooks.
- Step execution fails → record the error and completed evidence; reconcile uncertain publication/account effects before a retry.
- API metrics unavailable → skip goal display, proceed with step execution.
- Context overflow risk → output continuation guide per SKILL.md protocol.
