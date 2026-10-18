# CyberFishing changelog

## v0.41.4 - Bait Boat Metres

- The bait boat moves on the location's water metric: speed, acceleration, braking, arrival radii, sensors and current drift are ground metres everywhere, so far away it covers fewer pixels per second and no longer crosses far water up to several times faster than near the shore. Locations without a distance profile are unchanged (G-007, spec 054).

## v0.41.3 - Re-cast Aim

- A long-press re-cast aims exactly like the first cast: only the CAST bar and the aim line show, the rod, line, tackle and fight areas hide until the new cast lands (G-068).

## v0.41.2 - WebGL Scene

- The game world is drawn on a WebGL scene (PixiJS 8) under the 2D canvas: the background and time of day, rippling water that drifts with the location's current, the bait boats and chum zones, the fight areas, the line, the float and the Spine rod (spine-pixi-v8). Without WebGL, or after a lost context, the 2D canvas draws everything; `dev.html?scene=canvas` keeps the old path (specs 103–107).
- The camera opens on its final framing at startup and after a resize or phone turn. Background phases upload under the loading screen.
- DEV: the overlay is 1.5 times smaller and as wide as its content, FPS counts the last second, DevTools "СЦЕНА WebGL" shows the scene and edits the water live.

## v0.41.1 - DEV Fresh Start

- Remove the obsolete float and feeder DEV build templates and their catalog overlay. DEV uses the production item catalog, so a new player starts with loose items and no equipped tackle or builds (G-067).
- Report failed DEV startup in the console with the original error and stack.

## v0.41.0 - Cast Line Speed

- Post-cast lateral rod movement uses configurable speed multipliers: `physics.castRodControl.speedMultipliers.stationaryFloat = 3` while slack remains, and `movingFloat = 1` once the line must draw the tackle. Frames that exhaust slack split their time between those speeds.
- Lateral line straightening starts at the same slack boundary for floats and all other tackle, including water-blocked tackle. Rod motion through slack no longer triggers it. Owner retains visual testing (spec 102).

## v0.40.0 - Rod Side Tension Compensation

- With fight rod alignment disabled, actual rod motion toward the fish's side progressively relieves tension. Higher loads receive faster compensation; stopping, reaching a boundary or moving away immediately clears the relief. Config: `physics.fight.rodControl.tension.towardFishCompensation` (enabled by default).
- Before a bite, lateral rod motion uses the existing line straightening and opposite float tilt response, without adding retrieval. Both effects have independent enabled-by-default settings in `physics.castRodControl` (spec 101).

## v0.39.0 - Cast Rod Lateral Control

- Move a cast rod left/right while waiting or biting, with independent 100% ranges from its initial center to the green-zone edges. Position persists on release; taut line can drag the tackle after slack is used.
- Actual rod motion releases a normal bite or hooks a guaranteed bite. Rod-driven float motion sets eligible non-spinning bite chance to an absolute 0.1% for the next bite tick. All new rules are enabled by default and configurable through `physics.castRodControl` and DEV labels (spec 100).

## v0.38.7 - Editor Choices and Equipment Polish

- Portrait editor cells list compatible inventory items inline (spec 096); landscape and desktop again start a pick that highlights them in the item list. The rod condition meter sits in a stats container under the rod, and the backpack scale uses its SVG icon again.
- Landing-net miniatures and the toolbar net button crop the full artwork to its upper 40%, while the editor preview shows the whole net. The bamboo rod artwork is re-encoded from the new PNG.

## v0.38.6 - Backpack and Landing Net Artwork Fixes

- Restore the missing optimized open-backpack backdrop, removing the browser's broken-image frame. Constrain toolbar grid tracks so artwork stays inside its button.

## v0.38.5 - Float Artwork

- Convert the day-float illustration to WebP with the project utility, organize it under assets/items/floats and use it in inventory cards, equipment, editor tabs and the DEV free shop. Gameplay stats and saves are unchanged.

## v0.38.4 - Landing Net Artwork

- Optimize the landing-net artwork to WebP with the project conversion utility and use it in inventory cards, equipment, the DEV free shop and HUD. Require optimized image assets in the development rules. Gameplay stats and saves are unchanged.

## v0.38.3 - Centre the Backpack Backdrop

- Centre the open-backpack background in the landscape item panel, matching portrait placement.

## v0.38.2 - Fish and Inventory Artwork

- Integrate perch WebP artwork and thumbnails; add the backpack item to the DEV free shop and use full-resolution backpack miniatures.
- Show six keepnet artwork stages by occupied capacity, including reserved space. Show the open backpack as a faint background on the right of the landscape item panel. Gameplay formulas and save formats are unchanged.

## v0.38.1 - Editor Tabs Polish

- Phone editor tabs show their artwork centred with a larger inset and without scales (values stay in the parameters); a tap on a tab with an item scrolls the editor down to the tab row. Gameplay formulas and saves are unchanged.

## v0.38.0 - Phone Item Editor

- On portrait phones the item editor shows an actions panel, a preview and one row of tabs (the item, each cell, nested items) joined to the active tab's parameters; swipes on the panel or the preview switch tabs, a tap on a filled cell shows its parameters and a long press removes the item. The section tabs hide while the editor is open and only its buttons leave it. Card artwork is centred with larger equipment squares, equipping flashes twice, the hook has no incomplete marker for missing bait, and the boat scale has no lightning. Gameplay formulas and saves are unchanged.

## v0.37.3 - Editor Under the Tabs and Rod Removal Rule

- In portrait the item editor scrolls under the section tabs (the active tab shows the content through its frame); the keepnet help button is hidden for now. A long press offers to save a rod as a loadout only when every first-level cell is filled; an incomplete rod comes off at once with its components intact.

## v0.37.2 - Keepnet Like the Backpack

- The keepnet section follows the backpack's layout on phones and PC: the backpack's filter rows (fish kinds, species), a capacity scale with the fish icon and the count on the meter, and Fish/Keepnet pages in portrait that swipe as part of the section chain. Gameplay formulas and saves are unchanged.

## v0.37.1 - Portrait Section Swipe

- Portrait inventory swipes walk Equipment, Items, Backpack and Keepnet as one chain (the backpack pages first, then the next section); wide layouts keep tabs only. The items panel under the Items/Backpack tabs continues their frame on the left, right and bottom. Gameplay formulas and saves are unchanged.

## v0.37.0 - Hint Regions, House Screen and Preloader Foundation

- Hints (inventory warning, keepnet help, House notices) share one style with a close button and take an in-flow region at the top of their container; fix the collapsed Equipment/Keepnet sections on phones (G-061). The House clock shows every game minute.
- The House is a screen of the game page (DEV access until the lobby); raster art is WebP with masters outside releases; smart preloader foundation and optional Spine runtime; Pages keeps only the new and the previous release. Gameplay formulas and saves are unchanged.

## v0.36.0 - Inventory Sections, Picks and the First Rod Skin

- Turn the inventory into Equipment/Backpack/Keepnet sections: full-screen portrait container, one sidebar parent on wide screens, two-section header with a 100kg load scale, shared filter/items collections for backpack and keepnet, and a portrait backpack pager with a presentation-only 0/100 capacity scale.
- Pick from an empty cell, craft socket or header circle through the highlighted backpack (no section switch where the list is visible); a waiting bait or chum applies at the first header press; header pills show every hook slot with manual/automatic counts.
- Add the bamboo rod skin (bottom-cropped thumbnail, equipment art with and without line), centre emoji glyphs by their measured ink, pan the map whenever the rod cannot cast, and scroll lists by drag without selecting cards.
- House time-of-day blending, live DevTools/override handoff and House cleanup. Gameplay formulas and save formats are unchanged; Architecture 4/4, Quick 25/25, Full 51/51; owner visual/input acceptance remains.

## v0.35.0 - Shared UI, House Gestures and Aquarium Loading

- Add the isolated production UI catalog, shared controls, logical 320px scaling, bounded resize work and desktop-only hover policy.
- Distinguish map drags from fishing clicks before rod equipment, shield clock inputs, and reuse the HUD in House with wide-screen background coverage.
- Add touch/desktop House menus, smooth bottom-anchored sheets and stable dock hover; use compact icon/count upgrades and content-width buttons outside portrait.
- Select one inventory feed pack, confirm loading separately, unlock at half-time and add new protection to the remainder. Snapshot v5 migrates running timers without replenishing them; inventory stays v4.
- Record completed implementation/release tasks. Architecture 4/4, Quick 25/25, Full 51/51 and console smoke pass; visual/input acceptance remains with the owner.

## v0.34.4 - Inventory Scaling, Keepnet Layout and Design Rules

- Preserve the rod compartment's 9:16 proportions, redraw its vector placeholder without line/hook, fill inventory rows with evenly scaled square cards and geometrically center the shared close icon.
- Add a keepnet vector icon, remove redundant section headings, use cover-cropped fish thumbnails and show occupied/reserved capacity through the shared resource meter with a numeric counter above it.
- Use two mobile keepnet columns and an illustration container that is at least square and grows for portrait artwork. Resource meters reuse the existing injected degradation color scale.
- Add mandatory English design rules for reuse, BEM, tokens, Grid/Flex, the 320px logical baseline and current inventory/keepnet column counts. Prepare spec 057 and its implementation plan for an isolated UI catalog; catalog and below-320px surface scaling remain planned work.
- Preserve gameplay and save formats. Browser and visual acceptance remain with the owner.

## v0.34.3 - Inventory Icons and Automatic Refill Pills

- Replace equipment/socket labels with centered monochrome vector placeholders; actual equipped artwork takes their place. Keep accessible names and contextual hints, including in saved loadout previews.
- Align the dependent equipment slots over the rod compartment's height, with three slots at the top, middle and bottom.
- Combine bait/groundbait imagery and large A switches in two pill containers. Enabled switches show green A illumination and matching inventory reserve counts; disabled switches hide the count.
- Reserve filter scrollbar space and keep mobile controls within the 320px layout. Record the minimal-text design direction in spec 056.
- Counts reuse actual refill eligibility, exclude reserved/equipped/attached items, deduplicate matching choices and preserve the existing refill behavior and save format. Visual acceptance stays with the owner.

## v0.34.2 - HUD and Mobile Dialog Layout

- Fade the fullscreen button after entry, keep its icon unchanged, and restore it on exit. Anchor the clock at the top right and DEV settings at the top left.
- Center the depth float vertically; constrain the expanded track above the bottom toolbar. Show the depth below the collapsed float or to the right of the expanded slider.
- Align chum, landing net, keepnet and inventory in evenly spaced 48px icon-only slots with shared styling; use matching close buttons in both dialogs.
- Move keepnet explanations into a circular help button with a dismissible popover. Give inventory filters breathing room and fit at least four item/catch icons per row at 320px.
- Visual browser acceptance is performed by the owner; code checks cover help dismissal, fullscreen lifecycle and existing gameplay behavior.

## v0.34.1 - Inventory Aquarium Feed and Mobile Controls

- Aquarium feed packs are separate inventory catalog items, available in grouped DEV free-shop sections. Identical packs stack, and Groundbait has a For aquarium checkbox filter.
- Aquarium Feed opens only available inventory packs with image/count/name/[+] rows. Single packs feed immediately; multiple packs use a centered quantity slider, step buttons, confirmation and cancellation. Protection scales with combined pack mass.
- Inventory is the sole stock owner; feature snapshot v4 migrates prior feed stock once and journals inventory consumption with feed activation for recoverable two-key saves.
- Restore native kinetic touch scrolling in inventory categories/subfilters without accidental swipe clicks. Style DEV shop buttons consistently.

## v0.34.0 - Shared Aquarium Feed

- All species up to 100 g share one live-bait identity. Aquarium feeding uses eleven packs across Simple/Good/Premium, a shared bar above the tank, and population-adjusted protection.
- Feed depletion starts independent saved starvation deadlines within 1/3/6 hours; refeeding rescues survivors. Automatic feeding consumes the selected pack from finite stock. Snapshot v3 migrates prior feature saves without changing inventory v4.
- Animate reduced fish thumbnails inside a configurable aquarium zone; DEV controls size, variation, speed, direction intervals and a green grid. Originals remain intact.
- Keepnet stacks show the rarest/heaviest representative; anomalous, unique and unknown-status legacy catches stay separate.

## v0.33.1 - Keepnet Species Cards

- Keepnet groups fish by species with thumbnails and quantity badges. Open a species in the same dialog to inspect each fish's image, weight, saved rarity, level and survival timer; convert, select, transfer or confirm release by individual ID.
- Preserve caught rarity and live-bait artwork in snapshot v2, with validated v1 migration and explicit unknown historical ratings. Countdown updates retain focus, images and scrolling.
- Fix expired bait between care ticks, incorrect feed protection outside the aquarium, configured automatic feeder thresholds, hook return capacity and interrupted casts after reload. Full aquarium/keepnet outcomes now explain where the catch went or why it could not be kept.
- Add deterministic DOM interaction coverage, 100 outcome/cast cycles and 24-hour offline/reload acceptance. Visual browser acceptance remains with the owner.

## v0.33.0 - Live Bait and Fisherman's House

- GitHub Pages now publishes the DEV build at `/dev.html` alongside the immutable game release for remote testing.
- Crucian up to 100 g can become an individual live bait on the victory screen. Its real-time lifetime, one-hook cast, predator attraction and swim-only movement at configurable 50% source speed are persisted separately from inventory.
- Added a separate Keepnet dialog beside Inventory, plus a Fisherman's House page with horizontally navigable rooms and a layered aquarium on the table.
- Aquarium care uses species feed bars, count-based decay, real-time starvation, finite feed stock and an optional automatic feeder. Acquisition and one-level-at-a-time upgrades show “Безкоштовно” until currency is implemented.
- Added focused live-bait, architecture and packaged-page checks; existing inventory save schema remains unchanged.
- The house now uses full-screen day/evening/night art for five room levels, a shared persistent game clock, bottom menus, and timed room renovations that can be completed for free.
- Its sliding header now reuses the location clock, and the aquarium stays aligned to the table at different viewport sizes. Room and aquarium upgrades show the next level's bonus with segmented progress bars.

## v0.32.1 - Inventory and Equipment UX

- Inventory cards use thin rarity borders, evenly spaced square equipment compartments and resource meters below the contents; line capacity appears on spools and reels containing line, with reel fill relative to its capacity. Filters have symmetric spacing and item previews select the compatible category.
- Clicking another rod opens its parameters and equipment preview before replacement. Removing an unsaved rod with components offers saving with an optional name or disassembling; the permanent save form is removed.
- Saved loadouts use the rod visual and first-level equipment, open on the left while preserving the inventory list, and mark their members with a shared color. Unequipping returns a saved kit intact without a dialog; only a long press disassembles it into individual items, including nested contents.
- Long-press feedback starts after an activation delay; compatible items highlight their background, hover parameters appear only when they are not already visible, and undefined baseline values are hidden. Boat controls follow equipped delivery equipment; obsolete reeling diagnostics are removed from DevTools.

## v0.32.0 - Isolated DEV, Fight Stages

- Production composes inactive DEV ports, so GodMode, debug events, session diagnostics and listener counting stay off whatever the configuration or overrides say; a new player's inventory starts directly in the current save format (same bytes, legacy conversion only for classic saves).
- Fight physics runs as nine per-session pipeline stages (orchestrator 4,740 → 762 lines) and the DEV fight snapshot builder lives in DEV; shared clamps and direct contracts replace private copies and optional calls; identical gameplay and timing.
- GitHub Pages releases are immutable `releases/<version>-<commit>/` directories built by `npm run release:pages`; the version-copy folder comes from `CYBER_FISHING_VERSIONS_DIR`.

## v0.31.0 - Lean Fight Frame

- Production fights write one reused fight frame (no DEV diagnostics snapshot or per-frame copies) and reuse normalized physics settings until the runtime config changes; about 40% less fight update time in a seeded benchmark (228 → 135 ms), identical gameplay.
- Shared numeric normalization and reused helpers replace 81 private copies and duplicated blocks; DEV composes production classes instead of copies.
- Fixed Catch and the fight diagnostics snapshot exist only in DEV; the game session and its facades moved from bootstrap into the application and presentation layers.

## v0.30.1 - Cleanup Complete

- Remove unused progression UI/styles and readiness APIs; optional rating-tier badges respect metadata visibility.
- Separate world perspective from camera state with verified frame parity; isolate test doubles and standardize diagnostics names/comments.
- Generate project structure from Git-tracked files and retire the unused structure CLI dependency; gameplay and saves preserved.

## v0.30.0 - Clear Responsibilities

### Fixed

- Line capacity shown in item views follows the currently equipped reel and line.

### Changed

- One exported class per module, named after its responsibility (no Manager/Utils/Helper names); classic inventory styles removed; DEV owns fight and bite diagnostic labels.
- Player-facing texts live in injected presentation catalogs; the architecture guard rejects them in engine, domain, application, platform and bootstrap.

## v0.29.0 - Stage 7 Closed

### Changed

- Inventory split into single-purpose modules: PlayerInventory (composed in bootstrap), legacy save source, UI state, player commands, gameplay commands and item removal; byte-identical behavior proven by differential runs. The V2 marker is gone from names; the save key is unchanged.
- Removed the unwired EventLogger/backend, BuffManager and ExactItemSignaturePolicy; ConfigSchemaValidator now runs as a check and on DEV config edits, and the reel probe became the DEV reel retrieve diagnostic.

## v0.28.0 - Lean Repository

### Changed

- Archive all migration records, evidence and tooling at tag migration-final-archive; develop keeps the game, DEV tools, 33 behavior checks and one architecture guard (layers, cycles, globals, page entries).
- Retire compatibility APIs (debuff name getters, LocationMap.getDebugRevision, getDebugData, repository id fallback), split the classic inventory file into one module per class and remove unreferenced production code.
- Store text files with LF; the syntax check now detects invalid ES modules.

## v0.27.2 - Gameplay and Lifecycle Fixes

### Changed

- Compare seven LocationMap flags without a per-frame string allocation; recalculation and revision traces remain identical.
- Preserve natural lure catches when Fixed Catch has no compatible bite sequence. GodMode and Fixed Catch default to off in production; Development Bootstrap explicitly enables its balance defaults.
- Cancel pending depth-selector animation frames on disposal and ignore late callbacks and events.

## v0.27.1 - Stage 6 Post-Closure Cleanup

### Changed

- Remove 73 dead typeof guards on ESM imports, two unreachable DEV modules and the inert build/closure package scripts.
- Exact raw recovery at stage6-dead-code-archive; gameplay, saves and timing unchanged.

## v0.27.0 - Stage 6 Native Development

### Changed

- Run DEV from one native module entry with explicit development composition, authoritative base+override config and isolated DEV data.
- Retire 444 classic sources and wrappers, all bridges, activations, debts and providers with exact raw recovery; preserve gameplay and saves.

## v0.26.1 - Verified Unused Code Cleanup

### Changed

- Remove unused InventoryUI, its sole saveBuild caller path and unread fish profile/equip-target helpers.
- Retire three bridges, two activations and five browser debts with exact recovery; preserve native/DEV behavior.

## v0.26.0 - Stage 5 Native Production

### Changed

- Native production uses one canonical ESM graph with injected config, Fixed Catch and optional diagnostics.
- Classic DEV compatibility remains explicitly due in Stage 6; historical tooling is archived with exact byte recovery.

## v0.25.2 - Stage 4 Closure

### Changed

- Stage 4 closed: all 95 original scope modules accounted for, 36 clusters applied; remaining Bootstrap and version catalog work explicitly assigned to Stage 5, and compatibility retirement paths audited.

## v0.25.1 - Stage 4 M2 Application Modules

### Changed

- Stage 4 M2: completed application state, fishing and inventory ESM migration with injected platform capabilities, identical hot-loop evidence and unchanged saves; removed unused historical check reconstruction.

## v0.25.0 - Stage 4 M1 Config And Platform Modules

### Changed

- Stage 4 M1: migrated the configuration (data, derived config, runtime config port, validators) and the browser platform layer (canvas, DOM, input, storage, game loop, audio adapters) to layered ESM modules; gameplay, timing and saves are unchanged.

## v0.24.89 - Fish Force System Domain

### Changed

- Migrated FishForceSystem to the fishing Domain (per-frame, representation-only, game-cycle output unchanged); all 139 Domain modules are migrated.

## v0.24.88 - Fish Tackle Inventory Repository And World Domain

### Changed

- Migrated the fish and tackle entities, the flat inventory repository, buff manager, rod pull system and location world to the Domain (hot-loop evidence re-verified live; game-cycle output unchanged).

## v0.24.87 - Equipment Loadout Repository Domain

### Changed

- Migrated EquipmentLoadoutRepository to the loadouts Domain (Stage 3.50.0 repeated review adopted); saved loadouts are unchanged.

## v0.24.86 - Equipment Compatibility Policy Domain

### Changed

- Migrated EquipmentCompatibilityPolicy to the equipment Domain; its global exposure moved to the activation shim.

## v0.24.85 - Equipment Rules Loadout Planner And Line System Domain

### Changed

- Migrated the equipment slot, readiness and transition rules, the loadout transition planner and the per-frame LineSystem to the Domain (representation-only, game-cycle output unchanged).
- Changelog trimmed to v0.24.70 and newer; older entries live in git history and the stage3-evidence-archive tag.

## v0.24.84 - Idle Retrieve Policy Domain

### Changed

- Migrated RetrievePolicy, PassiveLureRetrievePolicy, PoleIdleRetrievePolicy and IdleRetrievePolicyResolver as named ESM exports; the per-frame retrieve parameters are unchanged.
- Retired the resolveFightPhysicsConfig activation as a shared-source line removal: the landing policy shim keeps LandingPolicyResolver.
- Extended the cumulative runtime from 134 to 135 project modules; 126 active activations and 201 exact bridge relationships.
- The next task is batch 047 preflight.

## v0.24.83 - Equipment State And Loadout Domain

### Changed

- Migrated EquipmentState and EquipmentLoadout with LOADOUT_DISPLAY_NAME as named ESM exports; persisted snapshots are unchanged.
- Retired the EQUIPMENT_AUXILIARY_SLOT_IDS activation as a shared-source line removal (new in the shared tooling): the catalog shim keeps its other four activations.
- Extended the cumulative runtime from 132 to 134 project modules; 126 active activations and 201 exact bridge relationships.
- The next task is batch 046 preflight.

## v0.24.82 - Item Catalog Baseline Registry Domain

### Changed

- Migrated the item catalog baseline registry with one named ESM export; its baseline cache keeps the reviewed get, set and clear identity.
- Extended the cumulative runtime from 131 to 132 project modules and the active activation set from 124 to 125 contracts, with 198 exact bridge relationships.
- The next task is batch 045 preflight.

## v0.24.81 - Casting Fishing And Inventory Domain

### Changed

- Migrated six casting, fishing and inventory sources with six named ESM exports and eight completed-prefix imports.
- Retired the FloatTackleLineBudgetPolicy, RodStrokeCapacityResolver, TackleFailureSelector, TackleStressAccumulator and WeakestTackleLimitResolver activations; their readers now import them.
- Extended the cumulative runtime from 125 to 131 project modules; 124 active activations and 197 exact bridge relationships.
- The next task is batch 044 preflight.

## v0.24.80 - Equipment Slot Catalog Domain

### Changed

- Migrated the equipment slot catalog source with five named ESM exports; the persisted slot ids and frozen tables are unchanged.
- Added the reviewed frozenDataConstants shape to the shared Stage 3 batch tooling for data sources made only of deeply frozen tables.
- Added fifteen exact classic consumer bridges and five activations at legacy slot 30.
- Extended the cumulative runtime from 124 to 125 project modules and the active activation set from 118 to 123 contracts, with 196 exact bridge relationships.
- Correction: batch 039 browser acceptance was the automated substitute, not the owner; the browser-acceptance step now requires an explicit --performed-by basis.
- The next task is batch 043 preflight.

## v0.24.79 - Landing Policy Domain

### Changed

- Adopted the Stage 3.42.0 replacement suffix after the duplicate-helper removal and migrated the landing policy source with five named ESM exports.
- Added five exact classic consumer bridges for LandingPolicyResolver and the resolveFightPhysicsConfig helper.
- Extended the cumulative runtime from 123 to 124 project modules and the active activation set from 116 to 118 contracts, with 181 exact bridge relationships.
- The next task is batch 042 preflight.

## v0.24.78 - Casting Items Line And Rules Domain

### Changed

- Adopted the Stage 3.41.0 replacement suffix after the normalizeDistance Engine prerequisite and migrated six Domain sources with twelve named ESM exports.
- Replaced three legacy dependency bridges with reviewed ESM imports while preserving ten exact classic consumer bridges.
- Extended the cumulative runtime from 117 to 123 project modules and the active activation set from 106 to 116 contracts, with 176 exact bridge relationships (10 added, 3 retired); the review ledger contains 139 activations including retired history.
- The next task is batch 041 preflight.

## v0.24.77 - Inventory Capacity And Stamina Domain

### Changed

- Opened the Stage 3.40.0 approved prefix (grouped batches after the six decompositions and Vector2 Engine ownership) with batch 039: InventoryCapacityPolicy, UnlimitedInventoryCapacityPolicy, DelegatingInventoryCapacityPolicy and StaminaController as named ESM exports.
- Extended the cumulative graph from 114 to 116 project modules and from 103 to 105 activation contracts, with 168 exact bridge relationships (5 added).
- The next batch is 040 of the Stage 3.40.0 approved prefix.

## v0.24.76 - Assemblies Profile Registry Domain

### Changed

- Completed batch 038, the last batch of the Stage 3.36.0 approved prefix: AssemblyProfileRegistry as a named ESM export; its profile table stays injected by the composition roots.
- Extended the cumulative graph from 112 to 113 project modules and from 101 to 102 activation contracts, with 143 exact bridge relationships (2 added).
- The next task is the Vector2 extraction and the responsibility decompositions, followed by another repeated graph review.

## v0.24.75 - Items Bait, Freshness and Progression Resolvers Domain

### Changed

- Completed batch 037: BaitEffectivenessResolver, ItemFreshnessResolver and ItemProgressionResolver as named ESM exports with seven reviewed completed-prefix imports; descriptor factories stay injected; the progression memo cache keeps one owner.
- Retired the BaitEffectivenessMatch, ItemBoundedMetricResolver and ItemProgressionDescriptor activations as inert classic placeholders.
- Extended the cumulative graph from 109 to 112 project modules (101 activation contracts), with 141 exact bridge relationships (3 added, 7 retired).
- The next task is batch 038 preflight.

## v0.24.74 - Items Effective Stats Domain

### Changed

- Completed batch 036: ItemStatOverridePolicy and EffectiveItemStatsResolver as named ESM exports, composed by GameCompositionRoot from the injected override table; their reviewed globalThis exposures moved to the activation shims.
- Extended the cumulative graph from 107 to 109 project modules and from 99 to 101 activation contracts, with 145 exact bridge relationships (2 added).
- The next task is batch 037 preflight.

## v0.24.73 - Items Condition Resolver Domain

### Changed

- Prerequisite transitions 001-005 (config injection of AssemblyProfileRegistry and ItemStatOverridePolicy, descriptor boundaries of the condition, freshness and bait-effectiveness resolvers) and the Stage 3.36.0 repeated graph review froze batches 035-038.
- Completed batch 035: ItemConditionResolver as a named ESM export extending the imported ItemBoundedMetricResolver; its descriptor factory stays injected by GameCompositionRoot.
- Extended the cumulative graph from 106 to 107 project modules and from 98 to 99 activation contracts, with 143 exact bridge relationships (1 added, 1 retired).
- The next task is batch 036 preflight.

## v0.24.72 - Fishing Hot-Loop Cluster Domain

### Changed

- Completed batch 034, the last batch of the Stage 3.34.0 freeze extension: PlayerReelFatigueSession, ReelHoldRecoverySystem, ReelRecoveryFishSlowdownPolicy, TackleStressAccumulator, PlayerPullMotionSmoother and RodLateralControlSystem as named ESM exports.
- Hot-loop gates: the preflight resolves the recorded review-queue evidence of the unchanged sources, and the live validation reproduces every class member fingerprint, allocation site and game-cycle trace (call counts, deltaTime ranges, ordered arguments and results).
- Retired the ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver activations as inert classic placeholders.
- Extended the cumulative graph from 100 to 106 project modules and from 95 to 98 activation contracts, with 143 exact bridge relationships (6 added, 3 retired).
- The next task is the prerequisite backlog (Vector2 extraction, descriptor boundaries, config injections, decompositions) and a new graph review.

## v0.24.71 - Assemblies Assembly State Repository Domain

### Changed

- Stage 3.34.0 review-queue freeze: collection-identity evidence (AssemblyStateRepository#states, atomic local replacement and a persistence round trip) and hot-loop evidence (six fishing modules: static member review and traced game-cycle fight scenarios) froze batches 033 and 034 as an extension of the Stage 3.22 approved prefix.
- Completed batch 033: AssemblyStateRepository as a named ESM export with two reviewed completed-prefix imports (AssemblyState, AssemblyPreparationStatus) and four owner-created composition identities.
- Retired the AssemblyState and AssemblyPreparationStatus activations as inert classic placeholders (no classic reader remains).
- Extended the cumulative graph from 99 to 100 project modules and from 96 to 95 activation contracts, with 140 exact bridge relationships (2 added, 1 retired).
- The next task is batch 034 preflight (hot-loop fishing modules against the recorded game-cycle traces).

## v0.24.70 - Items Effective Rarity Resolver Domain

### Changed

- Completed batch 032, the last batch of the Stage 3.22 approved prefix: EffectiveItemRarityResolver as a named ESM export.
- Its owner-created ItemRarityResolver (batch 030) is a reviewed import proven by composition identity, and the reviewed global exposure moved to the activation shim.
- Extended the cumulative graph from 98 to 99 project modules and from 95 to 96 activation contracts, with 139 exact bridge relationships (2 added, 1 retired).
- The next task is the post-prefix review: the review queue (033, 034) evidence prerequisites and the prerequisite backlog.
