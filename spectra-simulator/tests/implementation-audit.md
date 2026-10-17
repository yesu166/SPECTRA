# SPECTRA implementation audit

Audit date: 2026-10-17
Scope: repository source inspection on the feature branch; CI must confirm runtime/build behaviour.

| Blueprint module / check | Before this change | Current status |
|---|---|---|
| M0 — repository audit | React state loop mixed with simulation generation; no explicit public/internal boundary | **Documented; partial** |
| Simulation core | Generation and movement helpers existed, but the React component drove the tick loop | **Refactor in progress** |
| Ground truth vs trainee view | UI components received truth-bearing contact objects | **M1 addressed at application API level** |
| Seeded variation | Core observations were deterministic by seed; variant button used Math.random() | **Variant generation now uses an explicit PRNG; verify by CI** |
| Event log | Bounded UI timeline, no evidence IDs or stable event schema for scoring | **Not yet complete** |
| Scoring / rule tree | Not implemented | **Missing** |
| Evidence-linked AAR / replay | Timeline and JSON export existed; no evidence jumps or synchronized seek | **Not yet complete** |
| Persistence / instructor overrides | Browser-local sessions existed; no score override model | **Partial / missing overrides** |
| Truth-leak regression | No test | **Added to simulation facade tests** |

## Important boundary note

The new internal core keeps true track objects out of React component props and trainee session exports. Because this is a browser application, code shipped to the browser is inspectable; this is an architectural separation, not a security boundary against a determined user. Do not describe it as cryptographic concealment. A future instructor mode should request a separate truth/replay payload explicitly and must not pass that payload into the trainee view.

## Next milestones

1. Finish and verify the observation-only UI wiring in CI.
2. Add typed action events and evidence references.
3. Implement scenario decision rules and explainable scoring over recorded events.
4. Build AAR event seeking before improving 3D presentation.
5. Add deterministic golden logs, outage tests, and offline/performance checks.
