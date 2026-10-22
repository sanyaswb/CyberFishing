# Feature Specification: Radial inventory selector (TK-008)

**Created**: 2026-10-20
**Status**: Implemented v0.45.2; owner refinements through v0.45.17, visual acceptance pending
**Input**: Owner authorized specification and implementation of TK-008, with closed/open references in `docs/references/inventory-selector/`. Detailed acceptance source: root `tasks.md`, TK-008.1–TK-008.5.

## User Scenarios & Testing

### User Story 1 — Choose an inventory section (Priority: P1)

The player uses one bottom-right inventory control to choose equipment, backpack or keepnet.
**Why this priority**: Direct access to the existing inventory is the purpose of the feature.
**Independent Test**: Enable radial mode and open each of the three existing sections.
**Acceptance Scenarios**:
1. Given desktop hover is allowed, entering the central button expands three sectors; passing through gaps retains them; clicking one opens exactly that section once.
2. Given touch or a device without hover, pressing the central button immediately expands the sectors; moving highlights the current sector; releasing in it opens that section once.
3. Given a previously highlighted sector, releasing in the centre, a gap or outside closes without choosing it.
4. Given an already open section, choosing it again does not close the inventory.

### User Story 2 — Compare modes without losing work (Priority: P2)

The owner switches between the existing controls and the radial control during play.
**Why this priority**: The old interface remains available for comparison and compatibility.
**Independent Test**: Switch modes ten times with an editor open and confirm its state and scroll remain.
**Acceptance Scenarios**:
1. Radial is the default on production and development pages (owner v0.45.17); the development switch applies immediately without reload.
2. Switching cancels only the selector interaction and preserves editor, filters, inventory and gameplay state.
3. Export/import/reset use existing overrides; reset restores radial, old override sets without this setting use the default, and invalid selector settings are rejected.

### User Story 3 — Accessible, responsive selection (Priority: P2)

Players can select sections using the keyboard and on narrow or rotated screens.
**Why this priority**: The replacement must remain usable with all supported inputs.
**Independent Test**: Open with Enter/Space, select with the keyboard, cancel with Escape; repeat at 280 and 320 px.
**Acceptance Scenarios**:
1. Opening moves focus to the first section; Tab traverses sections, Escape returns focus and leaving the component closes it.
2. Resize, orientation, loss of capture, blur, screen changes and disposal cancel an unfinished choice.
3. Reduced motion changes state immediately. Hidden controls cannot receive input or focus.

### Edge Cases

- Extra pointers, secondary mouse buttons, synthetic clicks and native image dragging never duplicate selection or trigger the game beneath.
- Release during opening cannot select an invisible sector.
- Hover requires the existing desktop policy; a touch laptop uses the press/move/release flow.
- Safe areas, short landscape and split layouts do not clip the fan or prevent other toolbar actions.
- Below 320 px the shared UI scale applies exactly once; inventory remains four columns and keepnet two.

## Requirements

### Functional Requirements

- **FR-001**: Preserve classic controls and add a live alternative with one authoritative mode setting outside gameplay saves.
- **FR-002**: Match the reference quarter-circle button and three equally spaced rounded annular sectors over 90 degrees. Use game colours and recognizable section illustrations.
- **FR-003**: Animate expansion/retraction, support interruption and reduced motion, and preload all artwork.
- **FR-004**: Keep the desktop fan open throughout its transparent quarter-disc retention area; select only by explicit activation.
- **FR-005**: Touch selection uses the current release position, including rounded boundaries, and never a remembered candidate.
- **FR-006**: Provide named semantic controls, visible focus and the keyboard flow above without another modal focus trap.
- **FR-007**: Preserve inventory content, editor behavior, catch-result flow, state ownership, save format and gameplay output.
- **FR-008**: Repeated opening and mode switching must not accumulate listeners, scheduled work or selection commands.
- **FR-009**: Demonstrate closed/open, each highlight, both modes and reduced motion in the existing component catalogue using production components.
- **FR-010**: The owner can change selector size live in DevTools: 1 standard, 2 medium, 3 large. Scale the whole composition proportionally; constrain it to available screen space. Export/import/reset preserve this setting through existing overrides; default is 1.

### Key Entities

- Selector mode: classic or radial, owned by existing runtime configuration.
- Section: existing equipment/backpack/keepnet identity and labels.
- Interaction: temporary expansion, active pointer and candidate; no gameplay data.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All three sections open exactly once for every supported selection flow; cancelled flows open zero sections.
- **SC-002**: Ten consecutive mode switches retain the same inventory/editor state and produce one command per later gesture.
- **SC-003**: Selection remains aligned at 240/280/319/320 px and at desktop hover boundaries 1024/1025 px.
- **SC-004**: Keyboard users can reach every section and cancel; reduced-motion users see no selector travel animation.
- **SC-005**: Save round-trip and game-cycle output remain unchanged; automated checks pass and owner visual acceptance is recorded separately.

## Assumptions

- Sector order from left to top is equipment, backpack, keepnet, as specified in TK-008.
- Initial dimensions used inner radius 1.15D. Owner refinement v0.45.3: a true quarter-disk central button of radius D, derived inner sector radius D + shared gap 0.1D, outer radius 2.1D and rounding 0.06D. All painted boundaries use the same geometry and border treatment; artwork is centred within its painted shape.
- Owner correction v0.45.4: all section artwork keeps its native upright orientation, without rotation. The central inventory symbol is distinct from equipment.
- Hit testing starts only after expansion completes; early release cancels safely.
- Existing optimized backpack and keepnet assets are reused. Reference PNGs remain design sources.
- Owner performs browser visual checks and phone performance acceptance; the agent runs automated checks.
- Owner clarification during implementation: add size presets 1/2/3. Initial scale factors are 1, 1.35 and 1.7; actual displayed size is bounded by the available toolbar space. Resizing cancels an unfinished choice without altering inventory state.

## Owner refinement — 2026-10-20 / v0.45.3

- Replace the square-looking central control with a complete circular quarter arc; use one shared gap between centre/sectors and neighbouring sectors.
- Retain hover when moving upward, through the centre or through inter-sector gaps at any radius. Child hit-region changes and unrelated ancestor classes must not dismiss the menu. Leaving the full retention region, real hiding, layout invalidation or lifecycle cancellation still closes it without selection.
- Highlighting a candidate by mouse, touch hold/move or keyboard focus moves the section outward by 0.12D with existing motion timing. Moving to another candidate smoothly returns the previous section. Release/click selects the current visible translated shape; hovering also retains its original footprint to prevent feedback oscillation. Reduced motion applies the offset immediately.
- The transparent retention envelope includes outward movement and the shared gap. Toolbar reserves this envelope so other actions remain accessible. No delayed opening command or additional animation loop.

## Owner root-cause correction — 2026-10-20 / v0.45.4

The float/depth control, including its invisible closed-panel footprint, overlapped radial selection and blocked
aiming. Fix the overlapping control instead of tracking the cursor globally through another UI target.

- Move depth into the bottom toolbar and reuse the landing-net button size/appearance. On the mobile toolbar
  (available width <=820 logical px), place the float directly above the net with the shared button gap. On wider
  toolbars place it in the bottom action row. Owner refinement v0.45.5: the desktop float is left of all action
  buttons, before chum, independently of the net. Its horizontal slider sits to its left, inside available toolbar
  space, outside the row flow. Neither showing the float nor opening its slider displaces chum or other actions.
- Use min depth at the left and max depth at the right. Preserve the 0.1m step, range, wheel, Home/End/Page and
  callbacks; support Left/Right keys. Closed content has no layout/input/focus footprint. Only visible controls
  shield input; transparent layout containers never become solid hit regions.
- Scene gestures that start on Canvas retain pointer ownership over HUD until release/cancel/blur/dispose.
- Remove the previous global document pointermove selector workaround and coordinate-only internal leave override.
  The selector's own retention surface handles gaps, and a real DOM exit closes it normally. Keep valid lifecycle
  cancellation, native candidate motion and animation-aware selection.
- Keep all artwork upright, including sector equipment/backpack/keepnet and the depth float. Reuse optimized
  float art with native proportions, no image drag or CSS rotation. Catalogue uses the production toolbar grouping.

## Owner shape experiment — 2026-10-20 / v0.45.6

- Closed radial control reuses the ordinary toolbar button's rounded-square frame, border, background and shadow.
  Existing size presets remain available; standard size matches neighbouring controls.
- Opening via allowed desktop hover, touch press or keyboard morphs the upper-left corner into a full quarter
  circle using native border-radius interpolation (`100% 0 0 0` at the open endpoint). The inventory symbol moves
  smoothly from the square centre to the quarter-disk centroid, staying upright. Closing reverses both transitions,
  including when an opening transition is interrupted.
- Shape, symbol and sector reveal share the existing fast motion duration/easing. OS reduced motion and the
  catalogue's reduced-motion state change the shape instantly. Native border geometry receives central pointer
  events; no permanent quarter-disk clip may cut off the closed square's upper-left corner.
- Sector geometry, gaps, retention, release selection, toolbar footprint and gameplay remain unchanged. Remove
  the superseded central SVG/polygon generation after checking its consumers; no tool or fixture becomes obsolete.

## Owner correction after undo — 2026-10-20 / v0.45.9

- Keep the closed shared rounded-square shape. When open, preserve the large upper-left circular arc and round
  only the bottom-right small corner; upper-right and lower-left corners stay sharp. Native border-radius uses
  `100% 0 var(--ui-radius-panel) 0`. This supersedes the rejected all-small-corners-rounded variant.
- Restore independent live DevTools enums: initial `CONFIG.ui.inventorySelector.size=1` and expanded
  `openSize=3` by default, each using presets 1/2/3 (1/1.35/1.7). Scale button, artwork and sectors together,
  anchored at bottom right. Closing reverses the animation. Equal-size and shrinking combinations work too.
- Owner permits toolbar reflow: the closed control occupies its button slot; opening makes room for the final
  fan, moving adjacent actions left. Limits still fit the available UI surface, including below-320 scaling.
- The layout root takes its final open slot immediately while its inner visual stage animates. Measure the root
  once after expansion and gate pointer selection until the reveal/scale duration ends. Reduced motion changes
  instantly; config edits cancel stale gestures. No per-move layout reads, global hover workaround or new loop.
- Validate/export/import/reset both sizes through the existing config owner. Older scalar overrides without
  openSize use default 3. Gameplay/save semantics and sector geometry remain unchanged.

## Owner responsive toolbar correction — 2026-10-20 / v0.45.14

- Supersede moving neighbours on radial expansion: permanently reserve the open fan's footprint to the left,
  using the existing unit/open-scale/retention data in CSS. Closed and open total inline footprints are identical.
- Keep bottom controls reachable at narrow widths. Use native reverse row wrapping, with overflow rows above
  bottom actions and consistent bottom alignment. Leave height for an action row when capping the fan on short
  screens. Preserve the one UI-surface scale below 320px.
- Hide the version badge at <=820 logical toolbar px so it cannot force controls offscreen. Wider layouts keep
  the normal shrinking label. Remove the square/hidden badge stages and competing layout code from depth and
  selector composition; no global layout events, sibling enumeration, badge-width cache or upward-position hacks.
- The float remains the leftmost action. Its horizontal panel expands in normal flow after the icon, using a
  toolbar-owned width capped at 200px and at least 40px. Reserve room for the float/chum/net row; overflow wraps
  above instead of overlapping controls or the radial fan. Closed panel stays hidden/inert and transparent gaps
  remain transparent to game input. Resize cancels stale depth capture.
- Keep automated checks focused on existing input, config, geometry and lifecycle contracts. Owner performs
  visual acceptance of narrow/wide layouts, both phone orientations and the expanded float; add no visual snapshots.
- Commit and publish only selector-related changes. G-095 and unrelated untracked assets/helpers stay local.
- Owner follow-up: the expanded float icon/button and horizontal slider share one outer pill, styled like the
  bait auto-switch container. Reuse the `ui-control-pill` frame in auto-switch.css for both consumers; remove
  the inner button/panel frames while open. The closed float keeps the standard toolbar appearance.

## Owner float style and reveal correction — 2026-10-20 / v0.45.15

- Supersede the bait-switch pill style. Keep one common float/button and slider container with the same border,
  background, corner radius and shadow as ordinary toolbar buttons. Reuse the appearance through
  `game-toolbar-frame`; internal controls paint no second outer frame. Closed dimensions remain one toolbar slot.
- Expand/contract the frame width smoothly over the existing normal motion duration (280ms); fade and reveal
  the horizontal panel with matching timing. Repeated toggles reverse the native width transition. Reduced
  motion changes width and content instantly. Keep current responsive widths, reserve and wrapping.
- Never cache slider coordinates during the width transition. Ignore drag starts while its native width
  transition is running, then keep the existing single track measurement for an accepted drag. Keyboard/wheel,
  range, capture/cancel, outside dismissal and saves remain unchanged. No timers or extra animation loop.
- Add only one short regression for the important input contract: moving bounds are not cached, settled slider
  accepts a drag. Remove the now single-use pill mix and return the bait switch to its original style owner.

## Owner stationary float correction — 2026-10-20 / v0.45.16

- Float opening must never change the width reserved in toolbar flow, move the float button, shift right-hand actions or trigger another wrap. Reserve the same flexible left slot in both states, with enough width for the minimum horizontal slider; responsive wrapping happens only when viewport/configuration/visible actions change.
- Anchor the ordinary shared float frame at the slot's right edge; keep its button on the right and expand/contract left over the existing normal motion duration. At full expansion the frame reaches the toolbar's left edge, using the same injected screen/safe-area inset as the rightmost action. Remove the former 200px cap.
- Share that free slot with the version badge so its label cannot consume the slider's left reach. Hide the badge without changing geometry while depth is open; keep the compact-width badge rule and restore it on close. Hidden depth and transparent reserve must never block scene input.
- Production, DEV and catalogue inject the same depth mount. Keep the settled-coordinate drag guard, single cached rect, range/step, keyboard/wheel and reduced-motion behavior. No layout measurement, observer, timer or frame loop added.
- Owner performs visual acceptance on index/dev, classic/radial, phone portrait/landscape and desktop. Keep tests short and focused on mount/input/lifecycle contracts; no screenshots.

## Owner equipped rod/default refinement — 2026-10-20 / v0.45.17

- Enable CONFIG.ui.inventorySelector.radialEnabled by default in production and DEV. Reset and imports without a mode use radial; explicit false overrides still select classic. Preserve independent sizes 1 -> 3, all interactions and gameplay saves.
- Show the currently equipped rod in the equipment sector, using its existing optimized thumbnail and crop metadata through the shared toolbar artwork style. Keep artwork upright and the central inventory symbol distinct. Without an equipped rod or usable artwork, show the existing equipment SVG.
- Read the authoritative PlayerInventory equipment model and subscribe once to inventory changes through bootstrap. Update after equipment changes, including while inventory is closed; unchanged art retains its node and causes no preload request. Preload before display, fall back on failure, and reject late results after replacement, removal or disposal. Release the subscription with the selector.
- Catalogue uses the same production composition with an injected existing bamboo-rod fixture. Add only focused default-mode, live-artwork, node/cache, stale-load and lifecycle assertions; owner performs browser/phone visual acceptance.
- Cleanup: no tools, helpers, fixtures, vendor files, scripts or dependencies become obsolete. Reuse existing WebP files; no new generated artwork or runtime asset source.

## Owner depth width and alignment correction — 2026-10-20 / v0.45.23–v0.45.24

- Supersede the unbounded left expansion from v0.45.16: cap the slider panel at 200 logical px, plus the
  ordinary float-button width and shared gap for the complete frame. Shrink to available slot width on
  narrow layouts; retain the fixed right anchor, permanent flow reserve and native width transition.
- Owner follow-up v0.45.24: place the minimum/maximum labels below the stripe, centred vertically between
  its lower edge and the frame's inner bottom edge. Keep the track's full-height interaction area and centre
  the stripe and marker at exactly half the frame height. Labels use the lower space without shifting the
  track or intercepting input; the current-value bubble stays above the frame.
- Keep mouse/touch/keyboard depth selection, cached settled coordinates, resize cancellation, shared
  frame, reduced motion and production/DEV/catalog reuse. No JavaScript layout logic or new visual tests.
- Owner checks index/dev, narrow/wide, portrait/landscape, open/close with radial/classic and reduced motion.
  No tools, fixtures or dependencies become obsolete.

## Owner radial selector open border width correction — 2026-10-20 / v0.45.25

- Match the open central button's border width with the visible border of the expanded sectors (`calc(0.025 * var(--inventory-selector-drawing-unit))`).
- The central button transitions its border width alongside its border-radius over the shared fast duration, preventing the border from expanding to 3.4px when scaled by the open factor. Instant change in reduced motion.
- Owner checks: index/dev/ui-catalog, radial selector open/close, size presets 1/2/3.

## Owner selector sharpness correction — 2026-10-20 / v0.45.26

- Draw the composition at the larger closed/open preset size. Animate between the existing normalized
  closed/open scales, both <=1, instead of enlarging a layer drawn at the small closed size. Preserve actual
  bounds, toolbar reservation, sector geometry, timing, central frame appearance and open border matching.
- Let CSS own the highlighted sector's final translation. Outward native animations have no filling effect
  after completion; retain visible-offset hit testing during motion and at finished/null timing, cancellation,
  reduced motion and disposal. Add no observer, frame loop, per-move layout read or image reload.
- Remove the unused expansion-ratio CSS property and its obsolete assertion. Extend the existing mouse/touch
  release scenario to cover completed native movement as well as mid-animation selection. No tools or assets
  are replaced, and no gameplay/save/baseline change is expected.
- Owner checks index/dev/catalog: opening, settled hover, outward selection of rod/backpack/keepnet, preset
  combinations 1->3 / 3->1 / equal sizes, below-320 scaling and reduced motion. Visual sharpness is owner-checked.

## TK-014 startup correction (v0.45.37)

- Root cause: the composition treated pending artwork as classic mode through `loaded && radialEnabled`,
  then switched controls after asynchronous preload. The inventory mount itself does not wait to paint.
- Distinguish pending/ready/failed preload. Pending radial hides classic shortcuts and keeps radial inert;
  ready activates radial. Explicit classic is available immediately; a real preload failure restores it.
  Keep the existing awaited readiness port and dynamic overrides, with no timer, frame loop or CSS workaround.
- Extend the existing selector scenario with deferred resolution/rejection: no transient classic controls,
  mode changes during preload, successful readiness, failure fallback, disposal before late success/failure.
- Owner: cold reload index/dev in portrait/landscape; compare radial and persisted classic mode, then toggle
  in DEV. No agent browser visual check. No tool, helper, fixture or dependency becomes obsolete.

## TK-031 mobile depth row (v0.46.5)

- At <=820 logical toolbar px, radial selector has a dedicated upper row; float/depth remains the first
  action on the left of appearing chum/net controls in the lower row. Wide layouts keep the current row.
- `GameToolbar` owns a transparent selector mount; production/DEV inject it into GameCompositionRoot,
  and catalog uses that same mount. The host alone becomes a full-width final item in wrap-reverse flow.
  The selector root never stretches, preserving cached pointer geometry. Classic/hidden selectors reserve
  no row. Shared depth expansion, 200px panel cap, safe areas and below-320 scaling remain owned as before.
- Extend existing startup input checks for the distinct mount; retain selector gesture/depth control and
  disposal checks. Owner checks mobile portrait/landscape, 280/320/820 px, chum/net appearing, slider
  expansion, classic/radial, wide layouts and reduced motion. No agent visual check or new helper/asset/tool.

## TK-032/033 selector appearance (2026-10-22, v0.46.6)

- Record each owner development task in root tasks.md before implementation (persistent rule in AGENTS.md).
- Remove the highlighted sectors' separate yellow `--ui-focus-color` stroke and thicker 0.09 width.
  Use the main toolbar's shared normal/hover/active background tokens and accent border, retaining the
  ordinary sector stroke width. Keyboard focus uses the toolbar's info color and stays visible.
- Replace only the inventory symbol in the existing sprite with four symmetric outlined squares;
  outer corners are slightly softer. Preserve the symbol id/viewBox, central button size and movement.
  Archive the suitcase's original geometry in asset-sources/ui/archive/inventory-suitcase-v0.46.5.svg,
  never under runtime assets. Other section/pager symbols and gameplay actions remain unchanged.
- Reuse existing selector gesture and CSS/asset/architecture checks; no pixel/color/shape assertions.
  Owner checks index/dev/catalog, hover/touch/keyboard focus, all sectors, closed/open presets and
  reduced motion. No agent visual check, bitmap generation, replacement tool/helper or extra frame work.

## TK-034 centred compact fan (2026-10-22, v0.46.7)

- Owner: at <=820 logical toolbar px the selector moves to the bottom centre and its petals are symmetric;
  net right of it without a reserve, depth further right; equal sides where possible, depth always right
  (3 actions: chum | selector | net, depth; 2: net | selector | depth; 1: selector | action). The open fan
  covers its neighbours, which fade and take no input. Owner decisions: fixed right side, depth track opens
  rightwards to the edge, both fan shapes with a DevTools switch (`compactShape`: `half` default, `arc`),
  wider toolbars unchanged.
- One geometry class per layout (corner/half/arc): origin share of the central box, angle range, radii;
  shared gap/rounding/highlight. Corner output is the former geometry. Retention is a polygon around the
  arc down to the central box; extent sizes the compact slot.
- The toolbar gains a dock (fixed anchoring + width container) so the row itself becomes a symmetric grid
  by width; placement is CSS-only via `:has()`. The host names the compact layout through a custom property
  read once per opening; outside presses are consumed only while the compact fan is open.
- Checks extend inventory-selector: mirror symmetry, petal/gap/central hit tests for both shapes, compact
  selection at 240/320/820 px and all size pairs, layout switch back to corner, outside-press consumption,
  live shape switch with export/import/reset and invalid shape rejection. No visual assertions; owner checks
  appearance. No tool, helper, fixture or dependency becomes obsolete.
