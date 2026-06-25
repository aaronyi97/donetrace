## Summary

What changed?

## User-facing path checked

These run under the global `ai-collab` name after `npm install -g ai-collab-open-system`; from a clone, `node bin/ai-collab.js <args>` is the same entry.

- [ ] `ai-collab init --target <dir>`
- [ ] `ai-collab guide`
- [ ] `ai-collab demo`
- [ ] `ai-collab check --workspace <dir>`

## Verification

```bash
npm test
npm run check
npm pack --dry-run
```

## Privacy and honesty

- [ ] No private source material, tokens, email addresses, local personal paths, or customer data are included.
- [ ] Adapter docs are labeled as guidance, not deep integration.
- [ ] Claims match runnable behavior.
- [ ] `--force` or overwrite behavior is protected by tests.
