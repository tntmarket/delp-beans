---
name: land
description: >-
  Land Delp Beans changes only when the user explicitly requests landing or
  pushing them, including through Land Changes. Do not invoke for review,
  preparation, passing checks, or skill installation alone.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Land Delp Beans changes

Use this workflow only for an explicit landing request. The request that invoked
this skill already authorizes landing; do not ask the user to confirm the same
request again.

## Project workflow

- The remote is `origin` at
  `https://github.com/tntmarket/delp-beans.git`; the configured default branch
  is `main`.
- At setup, the remote had no branch refs or commits. The app consists of
  `README.md`, `app.js`, `index.html`, and `styles.css`. The initial landing
  also includes this skill at `.agents/skills/land/SKILL.md`.
- The README says the app opens directly in a browser and has no build step
  (`README.md:5-7`). There is no configured package manager, test suite, CI
  workflow, contribution guide, PR template, changelog policy, signing policy,
  or review requirement at setup. Recheck the current repository and remote
  settings on every run; these findings can change.
- The user chose automatic conflict resolution when the intended result is
  clear. Preserve unrelated changes; stop and ask when intent is ambiguous or
  the resolution could discard unrelated work.

## Landing steps

1. Inspect the worktree and destination before changing Git state:
   - Run `git status --short --branch`, `git remote -v`, and
     `git ls-remote --heads origin`.
   - Confirm `origin` still targets the Delp Beans repository and identify its
     current default branch and any existing commits. Use the authenticated
     GitHub CLI without printing authentication output, for example:
     `gh repo view tntmarket/delp-beans --json defaultBranchRef,visibility`.
   - Read current `AGENTS.md`/`AGENT.md`, contribution docs, workflow files,
     PR templates, and other landing instructions. Check branch rules,
     repository rulesets, required reviews, and required checks. Do not infer
     that the absence of CI at setup means checks are optional forever.
   - Confirm the requested changes and identify unrelated staged, unstaged, or
     untracked files. Do not reset, clean, or stage unrelated work.
2. Verify requirements before landing:
   - Run `node --check app.js` for the browser JavaScript
     (`app.js`; the README documents that there is no build step at
     `README.md:5-7`).
   - Run `git diff --check` and, after staging only the intended files,
     `git diff --cached --check`.
   - Apply any current repository-specific tests, reviews, signing, licensing,
     documentation, changelog, or submission requirements, including their
     stated exceptions. Obtain required human-authored text from the user
     rather than composing it on their behalf.
   - Verify every required CI/status check for the exact commit being landed
     has passed. Pending, failed, missing, or unverifiable required checks are
     blockers; starting a check is not a pass.
3. Choose the landing path from current destination rules:
   - For the initial empty-repository landing, if `main` is still the default
     branch and has no remote commits or protection rules, stage only
     `README.md`, `app.js`, `index.html`, `styles.css`, and
     `.agents/skills/land/SKILL.md`, review `git diff --cached`, commit with a
     concise message such as `Add initial Delp Beans app`, and push with
     `git push -u origin main`. These commands target the initial app files and
     project skill described in `README.md:11-21` and
     `.agents/skills/land/SKILL.md`.
   - If the remote now has commits, fetch and base the work on the current
     default branch before committing. Never overwrite remote work or force
     push.
   - For later requests, land directly on the default branch only when current
     repository policy allows it and the user requested that path. If rules
     require a pull request, review, merge queue, or a particular merge
     strategy, follow those requirements and verify their checks before
     merging. If the required path, strategy, or permission cannot be
     established, stop and report the blocker instead of bypassing policy.
4. Use non-interactive Git commands (for example,
   `GIT_EDITOR=true git commit -m "Add initial Delp Beans app"`). If a conflict
   is clearly resolvable, resolve it while preserving unrelated work and rerun
   all affected checks. If intent is unclear, stop and ask the user.
5. Verify landing at the destination:
   - Confirm the target branch points to the landed commit, for example by
     comparing `git rev-parse HEAD` with the `main` hash from
     `git ls-remote origin refs/heads/main`.
   - Confirm required checks and any required review/merge state for that
     exact commit. Do not report success for a local commit, a pushed topic
     branch, pending CI, or an unmerged PR.
   - Report the short commit SHA, target branch, verified checks, and any
     verified change/CI URLs. If blocked, state that the changes have not
     landed and explain why.

When running in a subthread, use `report_subthread_status` to report the
verified landing outcome to the parent. Use `success` only after confirming
the change reached its intended destination; use `failure` for an unsuccessful
attempt or genuine blocker. Otherwise, report directly in the conversation.
