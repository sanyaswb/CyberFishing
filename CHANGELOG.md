# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.45.27 - Authoritative Node.js TypeScript Backend Architecture

- Formulate architecture rules for authoritative Node.js TypeScript backend, client-server separation (60 FPS Vanilla client without heavy frameworks), and post-v1.0.0 client TypeScript migration roadmap in DEVELOPMENT_RULES.md and docs/architecture.md.

## v0.45.26 - Radial Selector Native-Size Artwork and Open Border

- Match the open central button's border width with the visible border of the expanded sectors (`calc(0.025 * var(--inventory-selector-drawing-unit))`), keeping uniform border thickness across expansion and presets.
- Radial selector draws at its largest preset and scales down, preserving its frame and hit geometry; finished highlight animations release their effect to CSS.

## v0.45.24 - Depth Labels Below Centred Rail

- Return depth min/max labels below the stripe, vertically centred between its lower edge and the container bottom. Keep the rail and thumb at the frame midpoint, the 200px panel cap and existing input behavior.

## v0.45.23 - Bounded Centred Depth Slider

- Cap the depth slider panel at 200 logical pixels while keeping its fixed right anchor, narrow-width fit and smooth left expansion. Put min/max labels above the vertically centred stripe and thumb, with the current-value bubble clear of the labels. Preserve input, permanent toolbar reserve and reduced motion.

## v0.45.22 - Guarded Clock Night Cycle

- Require DEV timeAccelerationEnabled for both clock actions in the location and House; disable/cancel pending activation when off and restore passive production clocks (G-096).
- Keep a partial dusk/night blend in the evening step, so elapsed time after 19:00 advances to 00:00 before returning to day. Cover night environment, House, reload, live flag changes and input cancellation in existing deterministic checks (G-097).

## v0.45.21 - Pending Acceptance Cleanup

- Remove completed TK-001–TK-008 specifications and implementation history from tasks.md; retain only nine outstanding owner acceptance scenarios, updated for the current radial selector and toolbar behavior.

## v0.45.20 - Production Project Structure

- Generate project-structure.txt only from the index.html production release closure: reachable modules, linked styles, shipped assets and vendor licences. Reuse release file selection with explicit page roots; omit DEV pages/code, tools, tests, docs and repository metadata. Regenerate the tree from current tracked working files and retain the existing Pages release behavior.

## v0.45.19 - Behavior-First Utils

- Organize all checks by responsibility under utils/checks and document UTILS_RULES.md. Remove 233 visual/duplicate implementation assertions while retaining all functional simulations, architecture/safety guards and the game-cycle baseline. Reduce Quick from 39 to 12 scenarios; one final Full run includes its subsets. Keep stable check IDs, update consumers and reject duplicate/unregistered nested check files.

## v0.45.18 - Concise Changelog History

- Keep only the latest ten releases in CHANGELOG.md. Move older complete entries into the owner-specified CHANGELOG_ARCHIVE.md, merge identical versions without duplicates and retain numeric descending version order. Document the retention policy in development rules.

## v0.45.17 - Equipped Rod and Default Radial Selector

- Enable the radial selector by default in production and DEV, retaining the explicit classic override. Its equipment sector follows the equipped rod thumbnail through the existing inventory change source, reusing toolbar artwork cropping without rotation. Use the SVG for an empty/unillustrated rod or a failed load; reject stale preload results and release the subscription on disposal. Reuse the production composition in the catalogue.
