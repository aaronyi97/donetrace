# Feedback

Tried the workspace? Tell us what actually happened. This is the main feedback entry point. If you came from the [Dogfood Guide](./DOGFOOD.md), this is where you land.

**How to send it:**

- Open a GitHub issue using the **Dogfood feedback** template (under `.github/ISSUE_TEMPLATE/`), or
- Copy the form below into a new issue / discussion and fill it in.

**One rule, read it first:** report your **experience**, never your **material**. Every field below asks for how it felt or what you noticed — not the task you ran, not the work you reviewed. Do not paste real task content, customer or contact material, tokens or credentials, absolute local paths, private chat logs, or company-internal information into any field. If you want to illustrate something, rewrite it as a synthetic placeholder or describe it in words. We do not collect your private originals — the open method runs entirely on your own machine. Full list: [What NOT to upload](./DOGFOOD.md#what-not-to-upload).

中文（同义）：只反馈体验感受，不要贴真实材料。下面每个字段都只问"感觉如何、注意到什么"，不要把真实任务内容、客户或联系人信息、密钥口令、本机绝对路径、私有对话原文、公司内部信息填进去。要举例就改写成合成占位例子或用文字描述。我们不收集你的私有原文，开源方法在你自己机器上就完整可用。

---

## Feedback form

Copy this block into an issue or discussion and fill it in. Leave a field blank if it does not apply.

```text
1. Which AI tools do you use?
   (e.g. Claude Code / Codex / Cursor / Copilot / Cline / Windsurf / a chat AI — names of TOOLS only)

2. What was your original pain point?
   (context loss / AI claiming false completion / re-explaining background across sessions /
    not knowing which AI is right / something else)
   --> Describe the PAIN, not the task it happened on.

3. Where did the first experience stall, if it did?
   (which step of the 10-minute or 30-minute path, what was unclear or broke)
   --> Describe the STEP and what confused you, not the content you fed in.

4. Which mechanism was the most useful?
   (e.g. dual-guard / handoff / acceptance / harvest / ... — and one line on why)

5. Which mechanism did you NOT understand?
   (which one read as jargon, where you got lost — this is the most useful thing you can tell us)

6. Would you use this on a real workflow?
   (yes / no / maybe — and the one thing that would tip it)
   --> Your YES/NO and the blocker, not a description of the real workflow itself.

7. Would paying to save calibration time be worth it to you?
   (yes / no / not sure — this is just to gauge interest; no numbers, no commitment)

8. Anything else?
   (one thing that surprised you, one thing that annoyed you)

Privacy check:
[ ] Every answer above is about my EXPERIENCE, not my actual task content.
[ ] I included no customer or contact material, tokens, credentials, absolute local paths,
    private chat logs, or company-internal information.
```

---

## What we do with it

- **Confusion is a bug.** If a step stalled or a mechanism read as jargon, that is the kind of report that actually fixes the open system. We would rather hear "I got lost at step 3" than nothing.
- **Interest in paid help is just a signal.** Question 7 only gauges whether tuned-for-you help would be wanted. The open method stays complete and free either way — paid help is calibration / setup / migration / review / pairing, never unlocking the basics. See [docs/FREE_VS_PAID.md](./FREE_VS_PAID.md).
- **We never collect private content.** This project is local-first by design. If a field ever tempts you to paste something private, stop and describe it in words instead — that is always enough for us to act on.
