---
name: ak:git
description: "Git operations with Vietnamese commit format and session-driven branch lifecycle. Commits each completed logic immediately, pushes once per completed prompt, verifies chat identity, and reuses the previous branch only on explicit continuation."
user-invocable: true
when_to_use: "Invoke for commits, PRs, stacked PRs, branch hygiene, or release git steps."
category: workflow
keywords: [git, commits, staging, PR, merge, merge-pr, stack, stacked-prs, ci]
argument-hint: "cm|cp|pr|merge|merge-pr|stack [args]"
metadata:
  author: agentkit
  version: "1.2.3"
---

# Git Operations

## Default (No Arguments)

If invoked without arguments, use `ask_user capability` to present available git operations:

| Operation | Description |
|-----------|-------------|
| `cm` | Stage files & create commits |
| `cp` | Stage files, create commits and push |
| `pr` | Create Pull Request |
| `merge` | Merge branches |
| `merge-pr` | Merge a GitHub PR + watch CI to green |
| `stack` | Drive GitHub native Stacked PRs (`gh stack`) |

Present as options via `ask_user capability` with header "Git Operation", question "What would you like to do?".

Execute simple scoped operations directly when supported. Delegate only when isolation
or coordination benefits the task and delegation is permitted. Load context-engineering
only for an actual context/budget problem.

**IMPORTANT:**
- Lead with the outcome. Keep reports short by being selective, not by compressing the writing into fragments or arrow chains; write complete sentences.
- Pass these rules to subagents.

## Arguments
- `cm`: Stage files & create commits
- `cp`: Stage files, create commits and push
- `pr`: Create Pull Request [to-branch] [from-branch]
  - `to-branch`: Target branch (default: master)
  - `from-branch`: Source branch (default: current branch)
- `merge`: Merge [to-branch] [from-branch]
  - `to-branch`: Target branch (default: master)
  - `from-branch`: Source branch (default: current branch)
- `merge-pr`: Merge PR [pr-ref] via `gh`, then watch post-merge CI until green and verify
  - `pr-ref`: PR number or URL (required)
  - Readiness-gated: refuses on conflicts, red CI, or `CHANGES_REQUESTED`; uses `--auto` when checks are pending
- `stack`: Drive GitHub native Stacked PRs through the `gh stack` extension
  - Lifecycle: `init` → `add` → `submit --auto` → `sync`/`rebase` → `merge`
  - Guardrail: history-rewriting and multi-PR merge steps are user-gated; force-push stays scoped to stack branches
  - See `references/workflow-stacked-prs.md` for the full command surface and exit-code stop conditions

## Quick Reference

| Task | Reference |
|------|-----------|
| Commit | `references/workflow-commit.md` |
| Push | `references/workflow-push.md` |
| Pull Request | `references/workflow-pr.md` |
| Merge | `references/workflow-merge.md` |
| Merge PR | `references/workflow-merge-pr.md` |
| Stacked PRs | `references/workflow-stacked-prs.md` |
| Standards | `references/commit-standards.md` |
| Safety | `references/safety-protocols.md` |
| Branches | `references/branch-management.md` |
| GitHub CLI | `references/gh-cli-guide.md` |

## Mandatory Session Workflow

Read `references/branch-management.md` before branch, commit, or push decisions.

Mỗi session dùng một nhánh; mỗi logic trong một prompt phải hoàn tất, kiểm tra và commit riêng ngay trước khi làm logic kế tiếp; chỉ push một lần khi hoàn tất toàn bộ prompt. Xác minh ID/lịch sử chat trước khi đổi nhánh: prompt mới, đổi ngày hoặc nén ngữ cảnh không tạo session mới. Chat mới: merge nhánh session cũ vào `master` bằng `--no-ff`, kiểm tra và push `master`, rồi tạo nhánh mới; ngoại lệ người dùng yêu cầu “xử lý tiếp/làm tiếp/continue” thì giữ đúng nhánh cũ. Không đoán nhánh khi thiếu bằng chứng, không tự merge cuối prompt; bảo toàn thay đổi ngoài phạm vi. Tuân thủ quality gates và định dạng commit tiếng Việt tại `AGENTS.md` mục 2.2 và `.agents/skills/ak-git/references/branch-management.md`.

## Core Workflow

### Step 1: Stage + Analyze
```bash
git status --short
git diff -- <authorized-paths>
git add -- <authorized-paths>
git diff --cached --stat
git diff --cached --name-only
```

### Step 2: Security Check
Scan for secrets before commit:
```bash
git diff --cached | grep -iE "(api[_-]?key|token|password|secret|credential)"
```
**If secrets found:** STOP, warn user, suggest `.gitignore`.

### Step 3: Split Decision

**NOTE:**
- Search for related issues on GitHub and add to body.
- Choose commit type/scope from repository policy and actual change, including skill/docs edits. Preserve unrelated staged changes; verify staged scope before committing.

Commit boundaries follow complete user logic, not file count or type. Commit each verified logic before starting the next; include its supporting tests/docs. Do not defer all commits until the prompt ends.

### Step 4: Commit
```bash
git commit -m "[loại] (phạm vi): mô tả tiếng Việt có dấu"
# Ví dụ: git commit -m "[sửa lỗi] (layer): sửa lỗi vị trí @import trong photoStudio.css"
```

## Output Format
```
✓ staged: N files (+X/-Y lines)
✓ security: passed
✓ commit: HASH [loại] (scope): description
✓ pushed: yes/no
```

## Error Handling

| Error | Action |
|-------|--------|
| Secrets detected | Block commit, show files |
| No changes | Exit cleanly |
| Push rejected | Suggest `git pull --rebase` |
| Merge conflicts | Suggest manual resolution |

## References

- `references/workflow-commit.md` - Commit workflow with split logic
- `references/workflow-push.md` - Push workflow with error handling
- `references/workflow-pr.md` - PR creation with remote diff analysis
- `references/workflow-merge.md` - Branch merge workflow
- `references/workflow-merge-pr.md` - PR merge with post-merge CI watch and verification
- `references/workflow-stacked-prs.md` - GitHub native Stacked PRs via `gh stack` (lifecycle + safety)
- `references/commit-standards.md` - Conventional commit format rules
- `references/safety-protocols.md` - Secret detection, branch protection
- `references/branch-management.md` - Naming, lifecycle, strategies
- `references/gh-cli-guide.md` - GitHub CLI commands reference
