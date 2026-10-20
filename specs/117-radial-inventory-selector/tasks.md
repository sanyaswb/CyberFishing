# TK-008 implementation tasks

- [x] T001 Inspect consumers, record boundaries and add behavior-preserving shortcut visibility seams.
- [x] T002 Add focused failing checks for geometry, release selection, hover retention, keyboard and lifecycle.
- [x] T003 Implement shared rounded geometry, production renderer/config/labels and component CSS.
- [x] T004 Implement browser controller with capture, cancellation, motion readiness and cached coordinates.
- [x] T005 Compose live classic/radial switching, config validation/metadata, preload and inventory visibility, including live size presets 1/2/3.
- [x] T006 Add catalogue scenarios using production components and extend focused regression coverage.
- [x] T007 Run focused + Architecture + Quick + Full, save/game-cycle checks, cleanup audit; update documentation, patch version and changelog.
- [ ] T008 Owner visual and phone performance acceptance (owner-run; pending delivery).
- [x] T009 Owner refinements v0.45.3 / G-092: true quarter-disk central SVG, shared gap, coordinate hover retention, selective ancestor invalidation and native outward feedback with animation-aware release geometry; focused regressions added.
- [x] T010 Owner correction v0.45.4 / G-093: remove the float control's invisible hit wall; share the bottom float/net group, horizontal slider, mobile placement and upright images. Remove global hover tracking and obsolete catalogue placement; preserve Canvas pointer ownership and add focused regressions. Final suite evidence follows below.
- [x] T011 Owner placement refinement v0.45.5: desktop float precedes all action buttons; its slider stays outside row flow so chum does not move. Preserve mobile stacking and the shared gap.
- [x] T012 Owner shape experiment v0.45.6: shared rounded-square central button morphs into a quarter disk and moves its upright icon on hover/touch/keyboard opening; reverse on close, respect reduced motion, remove superseded central SVG and clip.
- [x] T013 Owner correction v0.45.9 after undo: keep the large upper-left arc and round only bottom-right; restore independent initial size 1 / open size 3, whole-stage scaling and owner-approved toolbar reflow. Cache final open geometry once, preserve reduced motion and config cancellation.
- [x] T014 Owner responsive refinement v0.45.14: permanent reserve, native reverse wrapping, compact badge hidden, inline horizontal float panel; remove competing placement code/events. Reuse focused input/config checks and leave visual acceptance to owner.
- [x] T015 Owner follow-up: reuse the bait switcher's pill frame for the open float/button and horizontal slider, with one outer frame and no duplicated inner frames. Existing focused input and UI contracts remain the verification scope.

## Evidence

- v0.45.9: after the owner's undo, the default-open-size regression failed (undefined versus 3), then passed after restoration. Checks cover 1->3 / 2->3 / 3->1 / 2->2 at 240/280/319/320/820/1280 with and without reduced motion, 120 moves without layout reads, mouse clicks at final open bounds, live cancellation and independent export/import/reset. Focused selector/config checks, Architecture 4/4, Quick 39/39 and Full 65/65 passed. The unused single-scale setter was removed; no tools, fixtures or dependencies became obsolete. Visual and phone performance acceptance remain owner-run; no browser visual check performed.
- v0.45.6 shape experiment: focused check failed before implementation because the central button did not reuse the toolbar frame; it now passes shared-frame reuse, no permanent central clip and one retained icon without a duplicate SVG background. Architecture 4/4, Quick 38/38 and Full 64/64 passed. Existing mouse/touch/keyboard, reduced-motion, size, release/capture and disposal checks remain green. Browser visual and phone performance acceptance pending, owner-run.
- v0.45.5 placement refinement: focused shared UI contracts passed; Architecture 4/4, Quick 38/38 and Full 64/64 passed. CSS-only container ordering replaces the desktop row expansion; no tools, fixtures or dependencies made obsolete. Visual acceptance remains owner-run.
- Initial selector check failed because the new geometry module did not exist; it now passes.
- Behavior-preserving shortcut seams passed inventory UI before radial integration; existing keepnet/game-cycle pass.
- Architecture 4/4; Quick 38/38; Full 64/64, including inventory integration, save round-trip, game-cycle, config/schema, DEV links, UI catalogue/components, assets and CSS.
- Repeated for v0.45.3: Architecture 4/4, Quick 38/38, Full 64/64. Focused tests now also cover internal DOM leave, document hover tracking, unrelated/unchanged ancestor mutations, true hide/layout cancellation, outward animation for mouse/touch, halfway visible vs future geometry, and animation cancellation on disposal.
- v0.45.4: Quick 38/38 and Full 64/64 passed. New red-before-green checks cover horizontal orientation, transparent depth hit ownership and equipped-aim Canvas capture. UI surface tests cover horizontal ratios at 240/280/319/320/820/1025, one cached rect across 120 drag moves, extra-pointer rejection and release on close. UI component checks verify shared float/net parent, hidden/inert panel, retained optimized image and disposal. Prior global hover-tracking checks were updated to test the component's own retention and real DOM exits.
- The sandbox blocked the existing service-artifacts junction fixture (EPERM); the unchanged Quick and Full suites both passed outside the sandbox.
- Baselines and save format unchanged. No visual browser check performed; owner acceptance remains separate.
- Cleanup audit: no tools, helpers, fixtures, vendor files, package scripts or dependencies were made obsolete. The classic path remains live; nothing removed for convenience.
