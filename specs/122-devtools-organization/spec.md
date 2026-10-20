# TK-013 — DevTools organization

Owner authorization: 2026-10-21. Implementation: v0.45.33. Visual acceptance pending.

## Requirements and delivered behavior

- TK-013: DEBUG contains one Inventory section: inventory diagnostics and nested Split controls.
- TK-013-1: Runtime overrides and Item progression belong to the final root group `Сервіс`.
- TK-013-2: the root Overlay owns module groups and debug overlay enable/update interval settings.
  Relocate controls without changing CONFIG.debug / OVERLAY_MODULES paths or their authoritative stores.
- TK-013-3: Overlay, CONFIG and DEBUG are adjacent, in that order.
- TK-013-4: every read-only info row, including WebGL scene/router/water status, belongs to a collapsed
  `Опис` under its own parent. It can be opened independently; editable fields/actions remain outside it.
- TK-013-5: the Database root contains Locations, Fish and Items, retaining their existing editable paths.
- TK-013-6: a Spine root contains the rod editor labeled by its skeleton file name (default `rod` before load).
- TK-013-7: the free shop is a top button that expands the existing item list and retains grant confirmation.
- TK-013-8: top action hover/press changes background like ordinary sections; outlines remain for keyboard focus.

## Ownership and compatibility

DevTools composes existing sections and retains original config/runtime/catalog callbacks, binding paths,
save keys and section expansion cache. Its new helpers separate rendering the Overlay, Database and Config
groups. No domain/gameplay formulas, persistence formats, production dependencies or globals change.
The shared DevToolsUI owns description grouping through a WeakMap: one disclosure per parent, local
expansion state, and attachment validation after a parent's refresh. It returns the same mutable status
value node to existing editors. Semantic section buttons expose aria-expanded and native keyboard activation.
SpineRodDevSection still uses the existing controller export/commands; no new transport or gameplay API.

## Verification

Extended existing config-runtime checks first failed at the missing Overlay root, then passed hierarchy,
canonical settings/module actions, absence of duplicate controls, shop grants and skeleton naming.
Existing zone-editor checks cover collapsed/expanded descriptions, live status values, editing outside
descriptions and stale-node rejection on refresh. Appearance is the owner's check in dev.html at narrow/wide
portrait/landscape widths, including the hover/focus difference, section scrolling and reduced motion.
Full: 64/65 pass, including Quick and Architecture. The sole failure is the existing Pages working-graph
check: inventory_pick_cancel_controller.js from the prior pair is not in its HEAD-based file list.
No agent browser visual inspection. No tool, helper, fixture or
dependency was replaced, so none was removed. Unrelated workspace changes remain intact.
