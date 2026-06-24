# Privacy Boundary

This workspace is local-first. It does not call external AI APIs by default, upload user content, scan the whole disk, or install hooks without consent.

## Public-safe material

- Generic architecture
- Generic prompts
- Generic templates
- Thin tool adapters
- Synthetic examples
- Setup docs
- Known limitations

## Forbidden public material

- Real private governance contents
- Knowledge-base source material copied from a private system
- Real personal profile
- Actual client material
- Raw private conversations
- Non-public automation or routing details
- Internal calibration metrics, scoring configuration, or account-specific habits
- Local machine paths
- Tokens, keys, cookies, and credentials
- Unredacted screenshots

## Redaction standard

Before publishing an example, ask:

```text
Could a stranger infer the owner's private system, identity, clients, files, habits, or operational routes from this?
```

If yes, rewrite it as a synthetic example.
