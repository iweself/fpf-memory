# Checkpoint Return Template

Use this when a refactor or agent task finishes the probe/evidence phase but should not silently jump into broader rollout.

## Fields

- Objective: the bounded change or question being tested
- Route: the chosen FPF route and why it applies
- Tested candidates: the concrete options that were explored
- Evidence: checks, traces, or repo facts gathered so far
- Burned budget: time or call budget already spent
- Residual budget: what remains before a replan is required
- Recommended next move: the narrow next implementation step
- Commit trigger: the condition that authorizes moving from probe into rollout
- Stop / replan triggers: the conditions that invalidate the current route

## Minimal Skeleton

```md
Objective:
Route:
Tested candidates:
Evidence:
Burned budget:
Residual budget:
Recommended next move:
Commit trigger:
Stop / replan triggers:
```
