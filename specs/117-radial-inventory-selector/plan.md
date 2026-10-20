# Implementation plan

Native ESM, DOM/SVG and existing CSS; no dependencies or game-loop changes.

## Inspected owners and boundaries

InventoryUI creates/mounts its backpack shortcut and exposes openSection/onVisibilityChange. KeepnetSectionView owns its shortcut and the catch-result path. Add narrow shortcut visibility methods; one composed selector mode binding controls them without rebuilding either view. This behavior-preserving preparation precedes adding radial behavior.

Presentation owns InventorySelectorRenderer, InventorySelectorGeometry, config/labels and inventory-selector.css. Geometry constructs the same rounded polygon for SVG, clipping and hit tests. Browser InventorySelectorController owns pointer capture, keyboard, cached coordinate transforms and lifecycle. Bootstrap composes these, preloads existing art, binds injected configuration and visibility, and releases subscriptions. Production never imports DEV.

Runtime CONFIG.ui.inventorySelector.radialEnabled defaults false; existing override flow and metadata expose the switch. Schema validates the setting. Selector mode does not enter saves. Classic callbacks retain toggleSection; radial uses openSection.

Owner added CONFIG.ui.inventorySelector.size (1/2/3), default 1. DevTools uses an explicit three-choice control; renderer receives an injected preset scale (1/1.35/1.7) and toolbar caps it to the available logical width/height. Live changes cancel selection and only update a component custom property. Schema rejects other values. Both selector settings reset to their defaults when importing an older set without them.

Toolbar owns placement and reserves the fan's horizontal footprint so other actions remain reachable. The shared UI surface owns scaling, safe areas and hover policy. No per-frame measurements or second animation loop. Opening readiness uses the actual computed motion duration and reduced-motion policy.

The catalogue composes the production renderer/controller and existing classic inventory controls, with a small scenario owner. No alternative selection implementation.

## Validation

Owner refinement v0.45.3: central SVG outline uses the same rounded polygon serialization and border as sectors;
the inner radius derives from centralRadius + gap. The browser controller animates candidate translation with a
native Animation handle and samples only its computed progress for visible-geometry release tests. Original
footprints also anchor highlighting to avoid oscillation. Retention includes motion and padding; toolbar reserves
that envelope. v0.45.4 removes global pointer tracking and the coordinate-only leave override after the owner
identified the overlapping depth hit region. The selector's own retention handles internal routes. The ancestor
observer ignores unchanged attributes/unrelated decoration and only cancels on hidden/inert/display/visibility/
opacity or an actual changed central rect. These reads happen on genuine ancestor changes, not pointer movement.

Focused geometry/controller/mode/config tests plus existing inventory, integration, keepnet, UI components/catalogue, config schema/runtime, DEV links, assets and CSS checks. Run Architecture, Quick and Full; retain game-cycle/save baselines. Owner handles visual browser checks and phone performance in both orientations.

## Cleanup audit

Classic controls remain live and must not be removed. No tool is replaced; inspect consumers before deleting any generated fixtures or helper. Generated artifacts stay under utils/tmp or utils/generated and are cleaned before delivery.

v0.45.3 cleanup: no tools, fixtures, vendor assets, scripts or dependencies became obsolete. No new generated
files are retained. Architecture 4/4, Quick 38/38 and Full 64/64 passed; phone/browser visual acceptance pending.

## v0.45.4 depth/input boundary

`DepthSelector` previously combined a tall flow footprint with UiEventShield.makeSolid. Separate reusable event
shielding (`blockEvents`, with disposal) from solid hit styling, while preserving every existing makeSolid consumer.
Depth CSS owns only the visible 48px button and horizontal panel; closed content is hidden/inert. Toolbar owns
`game-toolbar__tackle`, stacks depth above net for widths <=820 and uses a row above that width. Startup injects
one tackle mount into composition; GameControls places net there, and composeDepthSelector supplies labels,
preloaded item art, DOM glyph factory and surface. The catalogue composes the same group. Opening measures the
available panel width once; pointerdown caches the physical track rect, and movement uses X without remeasurement.
Canvas captures its pointer for aiming/fighting as well as map navigation; no gameplay calculations change.

Cleanup: remove the obsolete catalog depth placement rule and radial art rotation data/style; remove the global
selector hover-tracking handler. UiEventShield.makeSolid, original depth API and all live checks remain consumed.
No tools, fixtures, vendor files, package scripts or dependencies become obsolete.

## v0.45.6 native central-button morph

Reuse `game-toolbar-button` for the closed square's frame and native rounded hit region. The existing open
modifier transitions border-radius to a true quarter disk and moves the symbol from square centre to the
geometry-owned quarter-disk centroid. Duration/easing match sector reveal; both OS and catalogue reduced-motion
states disable these transitions. Existing controller/capture/readiness and sector hit testing remain unchanged.
Remove the now-unused central SVG construction, permanent clipping property and polygon generation after
consumer search. Sector SVG/polygon logic remains live. No tools, fixtures, scripts or dependencies become obsolete.

## v0.45.9 bottom-right corner and restored size settings

Keep the upper-left 100% radius and apply the shared panel radius only at bottom right; top-right and bottom-left
are zero when open. Restore `size` (initial default 1) and `openSize` (default 3), their independent DEV enums,
labels, validation and import reset paths. Composition injects two scales; their maximum supplies the space cap,
the initial ratio sizes the drawing stage and open/initial supplies its native transform.

The owner permits neighbouring buttons to move. Only the inner stage animates; the root takes its final open
slot immediately and toolbar reserves the retention envelope while open. Controller measures that root once
after expansion and uses it for cached final pointer coordinates and ancestor invalidation. Selection waits for
the shared reveal/scale duration, with instant reduced motion. Tests cover growth, shrink, equal sizes, narrow
surfaces, mouse/touch selection and independent settings persistence/cancellation. The superseded single-scale
setter has no remaining consumer. No tools, fixtures, vendor files, scripts or dependencies become obsolete.

## v0.45.14 responsive ownership and release

CSS owns placement. Keep `root width + margin-left = retentionRadius * openScale * unit` in both expansion states.
Use toolbar reverse flex wrapping and bottom alignment instead of JavaScript reparenting or upward coordinates.
Compact toolbar container queries hide the secondary version badge; the depth panel is an inline sibling of its
button, sized through a toolbar-owned property. Remove checkUpward, depth fitPanel/badge helpers, duplicate
resize/orientation subscriptions and the toolbar-layout-changed event after consumer search. Existing input
capture, readiness and config cancellation remain unchanged. No new visual tests or layout polling loop.

User authorized commit/push/gh-pages for the selector and related fixes only. Keep G-095 changes and unrelated
assets/helpers out of the index; stage shared files with only selector-related records. Publish committed bytes
using release:pages, retaining the previous live release. No tools/fixtures/dependencies become obsolete.

Owner follow-up: extract only the existing bait switcher's frame into `ui-control-pill` in auto-switch.css.
Both the existing switch renderer and expanded depth root mix that shared appearance block. Keep one painted
outer frame and unframed inner button/track; preserve closed button dimensions and input/capture behavior.

## v0.45.15 ordinary frame and smooth expansion

The owner supersedes the pill appearance. Share only the ordinary frame declarations between toolbar buttons
and `game-toolbar-frame` in toolbar.css; use that frame on the persistent depth root and keep the inner button
unframed. Native width transition and matching panel fade/clip use the existing normal duration; no JavaScript
animation state/timer is needed. Before accepting pointerdown, inspect only the root's native width transitions;
wait while running so the unchanged one-read drag geometry stays valid. Reduced motion has no running transition.
Return auto-switch.css/renderer to their original single-consumer frame and remove the obsolete ui-control-pill
class/variables after searching consumers. Existing checks plus one short input regression; no visual snapshots.

## v0.45.16 stationary leftward expansion

GameToolbar adds one dedicated depth mount inside its existing transparent tackle group. This flexible slot shares its unused width with the badge and has a permanent minimum for the float plus a usable slider. The ordinary DepthSelector frame is absolutely right-anchored within it; native width transition affects paint/children only, never the flow footprint. Row-reverse keeps the button fixed on the right. The panel flexes to the slot edge without the old fixed-width cap. Production/DEV composition and catalogue inject that same mount. Slot visibility and badge yielding use CSS state, with no sibling measurement or new runtime work. Existing drag readiness/lifecycle remain unchanged.

Cleanup: removed the superseded depth-panel-width custom property and inline-expansion sizing. No tools, helpers, fixtures, vendor files, package scripts or dependencies became obsolete; existing live checks remain.
