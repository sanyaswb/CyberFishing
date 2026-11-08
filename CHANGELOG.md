# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.48 - Production release without DEV

- Spec 169 (audit TK-255, owner): npm run build:release builds the game server's release with the game only (no dev.html, DEV code, source modules or public source maps; 220 files instead of 1,187); GitHub Pages keeps the full test release with DEV.

## v0.50.47 - All sounds in minimum size

- TK-258 (audit TK-255): every sound is AAC .m4a, mono, 32 kbit/s: 10.95 -> 1.54 MB (vinyl-5 9.2 -> 1.2 MB); MP3 masters in asset-sources/, the release rejects MP3.

## v0.50.46 - Quiet production console in a fight

- TK-257 (G-001, audit TK-255): the production game no longer prints the fish's [DEBUFF] / [MASTERY] diagnostics in a fight; dev.html keeps them in its console.

## v0.50.45 - Scene starts under a strict CSP

- TK-256 (audit TK-255): the WebGL scene starts on a server whose CSP forbids eval: PixiJS's eval-free systems are installed there before the renderer starts; other pages keep Pixi's faster generated code. Server CSP needs no 'unsafe-eval'.

## v0.50.44 - Stamina sliders act in the fight

- TK-254.1 (spec 168): ACTIVE FISH stamina edits now change the fish's stamina and endurance in the fight (the limits were fixed at the hook); the window shows every stamina value the fight reads, live stamina / endurance / phase and the stamina rules of every fight (CONFIG.stamina).

## v0.50.43 - Balance windows ACTIVE FISH and ACTIVE ROD

- TK-254 (spec 168): DEV overlay windows «🐟 ACTIVE FISH» and «🎣 ACTIVE ROD» (switches in DevTools → OVERLAY MODULES → «Вікна балансу»): every fight parameter of the hooked fish (or the Fixed Catch species) and of the equipped rod with the fight's rod rules on sliders, live; «💾 Записати у вид» saves the fish's changes to its species.

## v0.50.42 - Loading overlay shows the current step

- TK-251.2 (spec 167): with step-by-step loading on, the DEV overlay «⏱ ЗАВАНТАЖЕННЯ» shows only the current step: the steps of the last release, the requests started since then (each file with its size) and its plan groups with their files' state.

## v0.50.41 - Wide toolbar beside the selector

- TK-253: on wide (landscape) toolbars the float, chum and net stand right beside the radial selector with no reserve for its fan; while the fan is open they fade out, as on compact toolbars.

## v0.50.40 - ACTIVE FISH without Overlay, guaranteed Fixed Catch anomaly

- TK-252: DevTools show the hooked fish's parameters (ACTIVE FISH) in the fight while the panel is open, Overlay off.
- Fixed Catch hasAnomaly always makes the test fish anomalous; perch_radioactive gets the crucian's anomaly (inside, 1%, test).
- ui-catalog.html removed (owner): no longer released, served or checked.

## v0.50.39 - Step mode holds HUD full files

- TK-251.1 (spec 167): in step-by-step loading a full file asked for by a view (toolbar, HUD, inventory pictures after their low copy) waits for the first step that loads it in full.
