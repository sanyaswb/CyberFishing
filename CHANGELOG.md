# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.45.20 - Production Project Structure

- Generate project-structure.txt only from the index.html production release closure: reachable modules, linked styles, shipped assets and vendor licences. Reuse release file selection with explicit page roots; omit DEV pages/code, tools, tests, docs and repository metadata. Regenerate the tree from current tracked working files and retain the existing Pages release behavior.

## v0.45.19 - Behavior-First Utils

- Organize all checks by responsibility under utils/checks and document UTILS_RULES.md. Remove 233 visual/duplicate implementation assertions while retaining all functional simulations, architecture/safety guards and the game-cycle baseline. Reduce Quick from 38 to 12 scenarios; one final Full run includes its subsets. Keep stable check IDs, update consumers and reject duplicate/unregistered nested check files.

## v0.45.18 - Concise Changelog History

- Keep only the latest ten releases in CHANGELOG.md. Move older complete entries into the owner-specified CHANGELOG_ARCHIVE.md, merge identical versions without duplicates and retain numeric descending version order. Document the retention policy in development rules.

## v0.45.17 - Equipped Rod and Default Radial Selector

- Enable the radial selector by default in production and DEV, retaining the explicit classic override. Its equipment sector follows the equipped rod thumbnail through the existing inventory change source, reusing toolbar artwork cropping without rotation. Use the SVG for an empty/unillustrated rod or a failed load; reject stale preload results and release the subscription on disposal. Reuse the production composition in the catalogue.

## v0.45.16 - Stable Leftward Float Expansion

- Keep a permanent flexible depth slot to the left of toolbar actions. Anchor the float button at its right edge and expand the shared slider frame left to the same screen inset as the rightmost action, without shifting or rewrapping neighbours. Remove the 200px panel cap; the version badge shares the free slot and yields while it is open. Retain smooth width/reveal, reduced motion and cached drag geometry.

## v0.45.15 - Smooth Unified Float Control

- Restore the ordinary toolbar background, border and rounded corners around one shared float/slider container. Expand its width over the shared normal motion duration while the horizontal slider fades and reveals inside the frame; keep reduced motion instant. Ignore drag starts while the container is moving so cached slider coordinates stay correct. Remove the superseded shared bait-pill frame after checking its consumers.

## v0.45.14 - Responsive Bottom Toolbar

- Keep a permanent reserve for the open radial fan, so buttons to its left stay in place on open/close. Use native row wrapping when the row is full, hide the version badge at compact toolbar widths, and fit the horizontal float panel in normal flow. The open float and slider share one pill frame reused from the bait switcher. Remove competing badge/upward-placement calculations, global layout events and duplicate resize handlers from the float and selector composition.

## v0.45.12 - Accurate Toolbar Free Space Allocation and Coordinated Upward Transfer

- Rework toolbar free space calculation: elements transfer upward only when all free space in the bottom row has been completely exhausted and there is nowhere left to compress or shift.
- Implement unified 4-stage allocation for both float depth selector and radial inventory selector:
  1. Ample space: Full version badge + bottom controls fit comfortably without transfer.
  2. Tight space: Version badge compresses to a 1:1 square ratio, keeping controls in the bottom row.
  3. Space tightens further: Version badge disappears to free its space, and open float panel narrows from 200px down to 20% (40px) while staying in the bottom row.
  4. Space exhausted: Control shifts upward to the second row only when bottom space is < 40px (float) or cannot fit the selector footprint.
- When a control moves to the upper row, bottom row space is freed, dynamically restoring the version badge (full or 1:1 square) if space permits.
- Remove obsolete static 380px container query in favor of dynamic visible-button space measurement.
- Synchronize depth selector open/close and inventory selector upward adjustments via coordinated toolbar layout events.

## v0.45.11 - Adaptive Toolbar Overflow and Upward Layouts

- Hide version badge whenever space is insufficient for other elements (e.g. open float panel or radial selector), and keep it at minimum 1:1 square ratio when visible.
- When the open float section lacks space in the bottom toolbar, it narrows down to 20% (40px); below 20% it shifts upward into the upper row and stretches across 100% of the available width.
- When radial selector mode is enabled and buttons to the left cannot fit due to the reserved space, the selector button shifts upward into the upper row to clear bottom toolbar space.
- Ensure UI elements never overflow container bounds by rearranging into upper rows and relying on proportional UI scaling below 320px baseline.

## v0.45.9 - Radial Bottom-Right Corner and Open Size

- Preserve the large upper-left arc and round only the bottom-right small corner when the radial button opens. Restore independent initial/open sizes in DevTools, default 1 -> 3, whole-composition scaling, final-open pointer geometry and reduced motion. The open toolbar makes room for the fan and moves adjacent actions aside.
