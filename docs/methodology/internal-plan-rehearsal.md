# Internal plan proposal rehearsal

This local-only mode lets the Marathoner owner run a saved runner profile
through the deterministic initial-plan generator before the draft methodology
has received independent review. It exists to make the product internally
testable, not to move the external-participant release gate.

Start the mode with:

```sh
npm run dev:plan-rehearsal
```

After signing into the development environment, finish and save the runner
profile. The signed-in home then shows **Internal draft plan rehearsal**. Choose
an explicit plan start date and truthfully answer the two rehearsal-only
confirmations. Those confirmations and the generated proposal stay in memory;
they are not written to Firebase.

The surface can:

- map the current saved profile into the plan-generation input contract;
- run the exact hash-pinned draft packet through the deterministic generator;
- show incomplete, invalid, unsupported, or generated results; and
- render a generated proposal as read-only and inactive.

It cannot approve, activate, or persist a plan. Ordinary development,
production web, iOS development, and iOS beta builds do not include this
surface or the draft packet. The distributable build commands scan their output
and fail if either appears.

Independent methodology review remains required before the rules or generated
plans can be used by real-world participants. Reviewer changes can be applied
to the pinned packet and exercised through this same rehearsal flow before any
participant-facing activation is authorized.
