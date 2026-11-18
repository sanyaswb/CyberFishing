# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.24 - A broken tackle says it is broken (TK-370.1)

- A cast with a broken item in the tackle opened the inventory with «Спочатку споряди ліску для закидання». It now shows «Снасть зламана — закинути не можна.».

## v0.52.23 - The house's code in the game's bundle (TK-371.1)

- The production game page loads the house's code with the rest of the game instead of on the first visit.
- The lazy load split the modules the house shares with the game into four more start files: 14 JavaScript files at start, over the limit of 10.
- The start is back to its own files. The house's art still loads only when the house is shown.

## v0.52.22 - The house during an emission; a house button in the game (TK-371)

- The house no longer stops the game. While the player is inside, the location's world goes on: game time, weather, wind, zones and the emission. It steps every 250 ms and nothing of the location is drawn.
- Coming back out, the location continues from its current state: an emission that was running has moved on.
- Inside the house nothing of the location reaches the player: no darkening or blur, no radiation debuff, no dose for the fish in the keepnet and no wear of the items. Whatever had gathered before entering is applied first.
- A house button ⌂ sits in the top-left corner of the game, now also in the production game (index.html).
- The player goes in only with the tackle put away. Otherwise the inventory opens with «Спершу складіть снасті в інвентар». The gas mask, landing net, radio and hand chum may stay.
- dev.html has no DevTools button any more (the house button took its corner). DevTools opens from the screen's left edge: rest the cursor there or swipe right with a finger. DevTools → «Будинок» and ?screen=house still open the house directly.
- The house's styles are now part of the game page's stylesheet, about 4 KB gzip at start. The house's code still loads on the first visit.

## v0.52.21 - Radiation wears the items; a broken item cannot cast (TK-370)

- Items with a condition now wear while the location's radiation is above zero. These are rods, reels, lines, leaders, hooks and the gas mask, in the backpack, in assemblies or equipped.
- One average full emission takes from each item a share of its condition, rolled in the range of its quality: quality 1 loses 80–100 %, quality 10 loses 20–40 %. Each item gets a new roll every emission.
- Rods and reels take half (radiation immunity 0.5).
- The wear is gradual and written to the inventory every 5 seconds.
- The worse an item's condition, the lower the quality it works with. Condition 0 is quality 1.
- A broken item (condition 0) cannot be cast with: «Снасть зламана — закинути не можна.»
- A broken gas mask no longer protects from the emission.
- In the inventory a broken item is grey, art, frame and background alike, under a grey veil.
- Settings in DevTools «Конфіг» → emission.wear: on/off, wear multiplier, ranges by quality, how the condition lowers the quality, how often the wear is written.

## v0.52.20 - Radiation changes the bite and kills fish in the keepnet (TK-369)

- Radiation now changes the bite (spec 179 stage G): at full radiation a crucian or a perch is about five times more likely to be unique, and the catch leans to the heavy end of the species' weight range. Each species has its own multipliers (FISH_DB radiationMultipliers: unique, big, species; species is 0 for now). Without radiation the bite is exactly as before.
- Fish in the keepnet and a live bait on the hook take a radiation dose. A live bait dies in about 3 seconds of full radiation, a 0.3 kg fish in about 46 seconds, a 1 kg fish in 2 minutes. A unique fish never dies, and the aquarium is safe.
- The keepnet has 10 conditional levels, each keeping out its own share of the dose (0 to 90 %). For now the level is set in DevTools (CONFIG.liveBait.keepnet.level).
- A fish killed by radiation leaves the keepnet. With «Мертва зникає з садка» (removeRadiationDead) off it stays, grey and marked «Мертва · радіація», and can only be thrown away.
- Live bait saves move to schema 7; fish saved earlier start with no dose.
- DevTools «РАНДОМАЙЗЕР» has a new test, «Кльов: радіація». It runs the game's own bite rolls for each species at radiation 0, 50 and 100 % and reports the unique share, the mean weight and the levels.

## v0.52.19 - Weather control buttons two to a line (TK-367.1)

- DevTools «ПОГОДА» → «Керування»: the buttons sit two to a line with short labels — «↻ Оновити | ↺ Авто погода» on top; «Викид: пік | Викид: спад», «Порив вітру | Блискавка» and «Болід» at the bottom.

## v0.52.18 - Weather controls: a switch per element, settings under it (TK-367)

- DevTools «ПОГОДА» → «Керування»: «↻ Оновити» on top with «↺ Автоматична погода» under it; every element — rain, storm, fog, emission, starfall, and now the ash, wind, waves and current — has a switch that follows what is happening, and its slider, settings and «↺ авто» show only while it is on. The actions (emission, gust, lightning, bolide) are at the bottom.
- The ash is controlled apart from the emission; the wind's direction is «← вліво | авто | вправо →» buttons; turning the ash, waves or current off holds them at zero, the wind off is calm.
- A slider stands at the element's live value and says «· вручну» while held by hand; «↺ авто» returns that one element to its own course.
- The current's slider now holds the current in the running game instead of changing the location's settings, so it never ends up in a weather export.

## v0.52.17 - Review of the touch cast and the emission blur (TK-368)

- The touch cast settings (input.touchCast) and the touch aim settings (casting.touchAim) are now checked when the game starts: a wrong value (text, a negative number, out of range) is reported instead of passing silently, and the touch cast settings have names and descriptions in DevTools. Nothing changes in play.

## v0.52.16 - The emission blurs only the world by default (TK-324.4)

- The emission's blur now covers only the world by default (emission.screen.includeHud off): it is the cheaper WebGL filter of v0.52.15, and the HUD, buttons and windows stay sharp. Blurring together with the HUD stays available as the «Розмивати разом з HUD» switch.

## v0.52.15 - Emission blur of the world alone through WebGL (TK-324.3)

- With «Розмивати разом з HUD» (emission.screen.includeHud) off, the emission's blur of the world is now drawn by the WebGL scene at half resolution with two passes (emission.screen.blur.scene) instead of the browser's backdrop-filter at the screen's full resolution: the same pulses at a fraction of the cost. The darkening stays as it was. With the HUD blurred too, nothing changes.
