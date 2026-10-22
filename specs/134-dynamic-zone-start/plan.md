# Implementation plan — spec 134

Existing consumers: LocationMap constructs DynamicZone for both fresh creation and config refresh; ZoneEditorDragController writes authored coordinates through ZoneEditorConfigEdits. GameCompositionRoot supplies the RNG. No new layer or mutable state owner is needed.

1. Restrict continuous travel to dynamic body translation, retaining the current window and region constraints.
2. Sample a legal map-grid start only during fresh map construction; inject a separate bootstrap random source so fixed gameplay seeds do not repeat page starts or advance fishing randomness.
3. Preserve fractional dynamic positions during design-to-map scaling on refresh.
4. Extend the existing deterministic zone-editor check; run config-runtime, game-cycle and Full. Patch version and retain owner visual acceptance separately.

All implementation steps complete. See spec.md for results and owner checks. No obsolete utils consumers or tools were replaced.
