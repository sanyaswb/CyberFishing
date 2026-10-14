# House time of day reuses the location composition

Owner instruction: 2026-10-14 — the House day/evening/night images change less smoothly than on the test location;
reuse the location logic instead of separate House code. Backlog G-036.

## Finding

Both scenes already share `backgroundTimeBlend` (the 17–21 and 5–9 crossfade formula). The differences were:

- the location draws every frame from the game loop; the House recomputed opacity only on its 1 s refresh, so each
  refresh jumped by `timeScale × 1 s` (240 → 4 game minutes = 3.3 % of a two-hour crossfade; ×5 DEV rate → 17 %);
- the location composes one opaque base phase plus at most one translucent phase (the branch table in
  `WorldRenderFrameBuilder`); the House always painted day plus two stacked layers.

## Decision

- `game/presentation/time/time_of_day_layers.js` (`timeOfDayLayers`) is the one base/overlay composition. The
  location frame builder and `HouseView` both call it with a reused output object; the frame builder's 60-line
  branch table is gone and produces the same layer records.
- `HouseView` writes `--house-day/evening/night` only when a value changes. The first reading appears at once; later
  readings blend with a linear CSS transition lasting one refresh (`timeBlendMs`, composed from
  `CONFIG.liveBait.displayTickMs`). The compositor interpolates between refreshes: no extra timer, frame loop or
  extra presenter work (DESIGN_RULES §13). `prefers-reduced-motion` keeps the stepped refresh.
- `house__background--day` joins the existing evening/night modifiers.

Not changed: the blend formula, clock, refresh cadence, art paths and the game-cycle baseline.

## Verification

`house-check`: the location builder and the House produce the same layers for 0/0, .5/0, 1/0, 1/.25 and 1/1; the
first House reading has no transition, later ones do; an unchanged reading writes no CSS property; the blend lasts
one refresh. Architecture 4/4, Quick 25/25, Full 51/51; game-cycle unchanged. No browser/visual testing by Claude:
the owner performs visual acceptance.

## Follow-up proposals (not implemented)

- Room art is 2752×1536 JPEG, about 3 MB per phase (≈ 47 MB for five levels), while the test location uses
  ~200 KB WebP. Converting the House art (owner's converter in `utils`) would cut decode/GPU cost on phones.
- Preload a new level's three phases through the location's `ImageAssetProvider` before swapping, so a level change
  never shows mixed-level phases.
