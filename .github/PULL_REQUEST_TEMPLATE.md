## Summary

What changed?

## User-facing path checked

Before publish these run as `node bin/ai-collab.js <args>` from a clone; the global `ai-collab` name works after publish.

- [ ] `node bin/ai-collab.js init --target <dir>`
- [ ] `node bin/ai-collab.js guide`
- [ ] `node bin/ai-collab.js demo`
- [ ] `node bin/ai-collab.js check --workspace <dir>`

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
