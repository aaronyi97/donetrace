# Revised output - AI coding long task

## Source case

- Case id: `ai-coding-long-task`
- Case title: AI coding long task
- Privacy status: fully synthetic
- Private material: none

## How to use

Read this as the corrected answer after the guard review blocked the first one. It resolves the blocker the guard found.

## Synthetic content

The blocker is resolved: onKeyDown now reorders with the arrow keys and a keyboard test was added that fails on the old stub and passes on the fix.

TaskBoard.tsx (revised output, only the keyboard handler changed):

```tsx
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTask(index, index - 1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTask(index, index + 1);
    }
  }

  // in the list item: onKeyDown={(event) => onKeyDown(event, index)}
```

TaskBoard.test.tsx (added keyboard reorder test). It fails against the old stub in `first-ai-output.md` and passes against this fix.

```tsx
test("arrow keys reorder tasks for keyboard users", () => {
  render(<TaskBoard initialTasks={sample} />);
  const first = screen.getByText("Alpha");
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  const items = screen.getAllByRole("listitem").map((node) => node.textContent);
  expect(items).toEqual(["Bravo", "Alpha"]);
});
```

Verification after the fix: 2 passing (mouse drag reorders tasks; arrow keys reorder tasks for keyboard users).

Guard re-review: blocker resolved. onKeyDown now calls moveTask for ArrowUp/ArrowDown, and the new keyboard test fails against the old stub and passes against the fix. AC2 and AC3 are met. Status: accepted, with visual polish still carried as unverified.

## Review note

Confirm the blocker is actually fixed with evidence: the new behavior exists and a test proves it.

## Next step

Carry remaining unverified work, write the handoff note, then harvest the lesson.

## Why this exists

This artifact makes the case runnable and reviewable. A raw chat can produce a smooth answer, but this file preserves the specific state needed for profile, context, acceptance, guard, handoff, and harvest work.
