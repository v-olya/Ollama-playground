# Assistant Collaboration Policy

This repository uses an explicit assistant policy to make human intent the primary guardrail when code behavior or intent would change.

Scope
- Applies to all edits proposed or made by automated assistants (including CI bots) that modify repository code.
- Especially relevant for edits that change the behaviour or public contract of server-side code, API routes, persistent storage, or other cross-cutting logic.

Core rule
- The assistant MUST NOT change the intended behaviour of any code without explicit human confirmation. "Intended behaviour" means any change that affects what the code does (inputs/outputs, side effects, API shape, data formats, or user-visible UI behaviour).

How the assistant must behave (required)
1. Propose-first: For any change that may alter behaviour, the assistant must produce a clear change proposal (summary + patch) but must not apply edits directly to shared branches.
2. Explain intent: Each proposal must include a short contract: inputs, outputs, error modes, and the exact behavioural change being made.
3. Ask for permission: The assistant must ask for explicit permission before applying the change. The user must reply with an affirmative phrase containing the word "apply" (for example: "apply server change").
4. Non-destructive defaults: When possible, the assistant should implement changes in a backward-compatible way (feature flags, non-breaking `_debug` fields, or opt-in endpoints) and include tests.
5. Dev-only diagnostics: For debugging, the assistant should add non-invasive, dev-only endpoints or logs rather than changing production parsing or API contracts.

Change proposal template (assistant MUST use when intent changes)
- Title: short one-line summary
- Motivation: why the change is needed
- Inputs: the data the change receives
- Outputs: the new/changed data the change returns
- Risk/compatibility: what could break and how the change avoids breaking consumers
- Patch: an attached diff or branch name

Approval workflow (recommended)
- Assistant posts the proposal and waits for the user's explicit approval.
- On approval, the assistant should create a branch and a PR (or apply the change only on an agreed branch) and run tests/CI before merging.

Enforcement note
- This file is a human-readable collaboration policy. It is not a replacement for branch protection, CODEOWNERS, or hooks; use those controls for stronger enforcement.

If you want me to follow a stricter enforcement plan (CODEOWNERS, pre-commit hooks, branch protection), tell me and I will prepare the files/PRs.

Example yes/approval phrase
- "apply server change"
- "apply patch on branch X"

Contact / questions
- If the assistant ever deviates from this policy, tell me exactly which change you want reverted or confined to a branch and I will prepare the revert/PR.

---
Last updated: 2025-11-11
