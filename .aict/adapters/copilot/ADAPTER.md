# GitHub Copilot Adapter

Use repository instructions and prompt files to apply the shared workflow.

## Shared contract pointer

Read `../SHARED_CORE_CONTRACT.md` before acting. This adapter is intentionally thin so the profile, context, acceptance, guard, handoff, and harvest rules do not drift.

## How to use

1. Attach or paste `../SHARED_CORE_CONTRACT.md`.
2. Attach the layer file you need, such as `../../context/TEMPLATE.md`.
3. Attach the current context package or synthetic case.
4. Ask GitHub Copilot to return the required artifact shape.

## Minimal instruction

```text
Use the local AI collaboration workspace. Follow SHARED_CORE_CONTRACT.md. For this task, use profile, context, acceptance, guard, handoff, and harvest as explicit files. Do not invent hidden memory. Label assumptions and unverified claims.
Follow the coaching layer in SHARED_CORE_CONTRACT.md: proactively remind me at key collaboration moments (defining done, reviewing completion claims, handoff, harvest, profile updates), restrained by default.
```

## What this adapter must not do

- It must not duplicate the full core contract.
- It must not create a separate rule system.
- It must not upload private material.
- It must not overwrite user files silently.
