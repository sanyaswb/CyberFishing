# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.57 - Empty tackle leaves only on a double click

- TK-263 (G-131): tackle without a fish reeled into the landing zone (or a spinning lure to the shore, also during a bite) stays in the water; only a double click takes it out.

## v0.50.56 - Rod side travel independent of the window

- TK-262 (spec 153): the rod's side movement in a fight is the same at every window size and on every screen: measured in map units, limited only by the water, the camera keeps the rod in view.

## v0.50.55 - Weather with intensity, fades and storms

- Spec 172 stage A (TK-261): weather changes smoothly: clear, rain and storm (only after rain) with an intensity that rises and fades in real seconds (rain 1-10 min), fog in the morning and at night, lightning strikes in a storm; weather has its own random numbers and never changes the fish's. DevTools «🌦 ПОГОДА» forces states and edits the settings. No weather visuals yet.

## v0.50.54 - Camera priority switch

- TK-260: DevTools DEBUG «🎥 Камера тримає рибу» chooses what stays in view when the fish runs far: the rod (default, as before) or the fish; it edits CONFIG.locations.cameraFollowPriority live.

## v0.50.53 - The window is only the camera

- Spec 153 (G-126): narrowing or turning the window no longer moves the float, fish or rod in the world (the bounds are the map's water); the camera follows the float and the fish along the screen edge and keeps the rod in view.

## v0.50.52 - No git add . tools

- TK-259 (owner, audit TK-255): the git:version-copy tool and the git:add script, which staged everything with git add ., are removed; commits stage explicit paths only.

## v0.50.51 - 2D reserve without spine-webgl

- Spec 170 (owner): the 2D canvas stays the scene's reserve with nothing extra: the separate spine-webgl path (only reachable in dev.html?scene=canvas) is removed; Spine plays only on the WebGL scene, the reserve shows the rod's and boat's static pictures. Spec 103 closed.

## v0.50.50 - Offline cache

- Spec 171 stage 4 (owner): after the first full load the game starts instantly from its offline cache and plays without the network; a new release takes over on the next launch. Only built releases (Pages, server) register it; dev.html and npm run dev never do.

## v0.50.49 - New startup limits

- Spec 171 Q4 (owner): startup budgets are now cold 1 s on Fast 4G with CPU x4, 2.5 s on 3G, warm 0.3 s, at most 3 network steps; the measurer and the DEV overlay «⏱ ЗАВАНТАЖЕННЯ» judge by them.

## v0.50.48 - Production release without DEV

- Spec 169 (audit TK-255, owner): npm run build:release builds the game server's release with the game only (no dev.html, DEV code, source modules or public source maps; 220 files instead of 1,187); GitHub Pages keeps the full test release with DEV.
