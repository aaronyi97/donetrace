# Modes

Modes state what kind of work is happening now. A mode is a boundary, not a personality.

Use one mode at a time: shape, execute, review, handoff, or harvest.

Each mode card below is a full spec, not a one-liner. It states six things so a tool always knows the edges of the current mode: the entry condition that lets you start, the actions allowed, the actions forbidden, the output format, the exit condition that ends the mode, and how it hands off to the other modes. The forbidden line and the handoff line are what keep modes from blurring into one another.

## The loop between modes

Shape comes first when the request is still fuzzy: it turns a rough intent into a signable thin contract before anything is built, so execute starts from a boundary instead of a guess. Then the core loop runs. Execute produces, then review challenges what execute produced; a rejection sends it back to execute, a pass moves it toward handoff or close. Handoff carries state across a session or tool boundary so the receiver re-enters execute cleanly. Harvest runs at a seam or close to lift reusable learning, then returns to whatever mode was active. Naming each entry and exit explicitly is what stops "shape" from sliding into design, "review" from quietly editing, or "execute" from drifting past its task.
