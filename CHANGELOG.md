# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.51 - 2D reserve without spine-webgl

- Spec 170 (owner): the 2D canvas stays the scene's reserve with nothing extra: the separate spine-webgl path (only reachable in dev.html?scene=canvas) is removed; Spine plays only on the WebGL scene, the reserve shows the rod's and boat's static pictures. Spec 103 closed.

## v0.50.50 - Offline cache

- Spec 171 stage 4 (owner): after the first full load the game starts instantly from its offline cache and plays without the network; a new release takes over on the next launch. Only built releases (Pages, server) register it; dev.html and npm run dev never do.

## v0.50.49 - New startup limits

- Spec 171 Q4 (owner): startup budgets are now cold 1 s on Fast 4G with CPU x4, 2.5 s on 3G, warm 0.3 s, at most 3 network steps; the measurer and the DEV overlay «⏱ ЗАВАНТАЖЕННЯ» judge by them.

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
