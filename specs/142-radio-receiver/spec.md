# Feature Specification: Field radio receiver

**Created**: 2026-10-25
**Status**: Implemented in v0.47.28–v0.48.0 (stages 1–5); owner acceptance pending; thunderstorm later (D14)
**Input**: Owner 2026-10-25: a vintage field radio receiver, an inventory item that plays live internet radio
(Radio Browser) through a "walkie-talkie" sound, with a battery that runs down and degrades the signal, rain noise,
optional ducking on a bite, its own cell in the auxiliary equipment block and an item editor window. The owner's
original terms of reference are kept as [source-tor.md](source-tor.md); this spec replaces its architecture and
corrects its technical points.

## Owner decisions (2026-10-25)

- **D1 Region:** no GeoIP service. The first country comes from the browser (language region, then time zone); the
  player can choose another one, and the choice is remembered.
- **D2 Item:** the radio is an ordinary catalog item in the inventory; ownership is saved with the inventory, there is
  no `hasRadio` flag and no new save root.
- **D3 Battery:** the radio does not wear out, it runs on a battery that discharges. A weak battery degrades the
  signal: more noise, quieter and broken reception, simulated dropouts; an empty battery turns the radio off.
- **D4 Rain:** noise and crackle grow with the rain (the game's weather has rain and its intensity `rainMult`; there is
  no separate thunderstorm state yet, see Q6).
- **D5 Ducking:** the radio gets quieter during a bite. It is a setting that can be turned off, because its comfort is
  not yet known.
- **D6 Placement:** the radio's cell is in the auxiliary block (`inventory-loadout-panel__auxiliary`). When the cells
  do not fit, the block scrolls inside itself: left/right in the row layout, up/down in the column layout, with the
  existing drag-scroll logic.
- **D7 Editor:** a tap on the radio opens its own editor window with the same structure as every item editor: the
  action buttons at the top, the image below them, the parameters below the image, and the radio's controls among
  the parameters.
- **D8 Art:** `radio-receiver.webp` (1811 × 1335, alpha, 284 KB) from the repository root is the master.

Owner answers 2026-10-25:

- **D9 (Q1) Battery:** a separate battery item, available now in the free DEV shop. The radio and the boat share one
  power system with a battery slot ([spec 143](../143-device-power/spec.md)); the charge belongs to the battery.
- **D10 (Q2) Duration:** a full battery played the radio for 3 hours; changed by spec 143 D-P5: **1 hour** per
  ordinary battery to start with. Changing the system time of the laptop or the
  phone must not wind the time forward or back; later the server's time counts (spec 143 "Tamper resistance").
- **D11 (Q3) Hidden tab:** the stream stops while the tab is hidden by default; a setting `playInBackground`
  (off by default) allows background play. Background play still consumes the battery (monotonic clock).
- **D12 (Q4) HUD indicator:** an icon under the clock, waves like an oscilloscope, in a 40 × 40 circle. Every HUD
  indicator icon will be a 40 × 40 circle (a shared component).
- **D13 (Q5) Getting the radio:** only through the DEV item grant.
- **D14 (Q6) Thunderstorm:** a separate thunderstorm weather state with its own crackles is required, as a later
  spec; the radio's noise model takes it as one more weather input.
- **D15 (Q7) Tamper resistance:** done properly, so the player cannot break the discharge (spec 143).

## Corrections to the original terms of reference

| ToR point | Problem | Here |
| --- | --- | --- |
| 3.2 GeoIP (`ipapi.co`, `ipwho.is`) | Sends the player's IP to third parties; blocked by ad blockers | D1, `BrowserRegionResolver` |
| 3.1 one host `de1.api.radio-browser.info` | Radio Browser is a set of mirrors; any one may be down | Ordered server list in configuration, next server on failure |
| 2 / 6 filter on `url` | `url` is often a `.pls`/`.m3u` playlist, and an `https` `url` may resolve to `http` | Play and filter `url_resolved` only |
| — | HLS (`hls = 1`, `.m3u8`) does not play in `<audio>` on desktop Chrome; rare codecs fail | Keep `hls = 0` and MP3/AAC codecs (`CONFIG.radio.codecs`) |
| 7.3 CORS: "catch the error, reconnect to native output" | `createMediaElementSource` on a cross-origin stream without CORS throws nothing, it outputs silence; an element connected to the graph can never go back to the native output | Play with `crossOrigin = "anonymous"`; if that load fails, a **new** element without `crossOrigin` plays the station without effects (status "без ефекту") |
| 4.2 WaveShaper with k = 18 | Peak output ≈ 0.35 of the input: the effect is three times quieter than bypass | Make-up gain after the shaper, so both modes are equally loud |
| 1.2 / 4.1 Dry/Wet gains 0/1 | An instant switch clicks | Gain ramps (`setTargetAtTime`) |
| 5 `src/game/radio/*` in one folder, `RadioView extends PIXI.Container` | Mixes domain, browser and view; the scene layer is the world only, windows are DOM (spec 103 roles) | Layered modules below; the editor and the controls are DOM |
| 1.2 `SaveManager`, `hasRadio` | Not in the project | D2: item in the inventory |
| 1.2 purchase from a merchant | There is no production shop yet (DEV «ВИДАТИ ПРЕДМЕТ» only) | Q5 |
| — | Station names come from a foreign API | Written with `textContent` only, never markup |
| — | `BrowserBufferedAudioPlayer` creates its own `AudioContext` per sound | One shared context provider for the radio (the bite bell may move to it later) |

## Model

### Item and equipment

- Catalog: a new category entry, e.g. `devices.radio_receiver_basic`, `itemType: "radio"`, `iconUrl`
  `assets/items/radio/radio-receiver.webp`, player text «Польовий радіоприймач», `assemblyProfileId: "radio"` (one
  `battery` slot, spec 143). Authored values in `gameplayStats`: `power.unitsPerSecond` (1, so the 3600-unit ordinary battery
  lasts 1 h, D10/D-P5), low-charge threshold, signal factors (below). Balance values live in configuration, not formulas.
- Equipment: a new auxiliary slot `EquipmentSlotId.RADIO = "radio"` accepting `["radio"]`, `visibility: "always"`.
  An old save has no `radio` key and gets an empty slot; nothing is migrated (verify in the save round-trip check).
- Charge: on the inserted battery, owned by spec 143's `DevicePowerService` (monotonic clock, charge only falls,
  periodic save, no refund on reload or in another tab). The radio's editor shows the battery socket tab and the
  battery's «Заряд» meter.

### Signal (domain, pure)

- Consumption: while powered on (also in the background when `playInBackground` is on, D11) the radio reports its
  seconds to `DevicePowerService`. An empty battery or no battery turns it off and refuses power.
- `RadioSignalModel`: from charge and weather it returns a reused reading `{ quality 0..1, noiseGain, crackleRate,
  dropoutChancePerSecond, volumeSag }`. Above `lowChargePercent` (e.g. 25) the battery does not affect reception;
  below it quality falls with the remaining share. Rain adds noise and crackle: `rainShare × isRaining × rainMult`
  (weather read through the existing environment snapshot, never written). The later thunderstorm state (D14) adds
  its own crackle bursts through the same input.
- Dropouts are short silences of `dropoutMs` [min, max] with a crackle burst, drawn from a **dedicated radio RNG**.
  The gameplay RNG is never touched, so the game-cycle report stays identical.

### Application

- `RadioReceiverService` (one owner of the radio's runtime state): power, next/previous station, country, mode,
  volume, ducking switch; status (`off`, `loading`, `playing`, `no-effect`, `offline-retrying`, `no-battery`,
  `no-stations`). It advances in the existing game update (no extra loop) and reports consumption to
  `DevicePowerService` from the monotonic clock; while the tab is hidden it either stops the stream (default) or keeps
  playing with a low-rate timer for consumption (`playInBackground`, D11). Unequipping the radio or closing the
  session turns it off.
- `RadioDuckingPolicy`: while the fishing state is a bite, the radio's gain goes to `duckGain` with `attackMs`, and back
  with `releaseMs` after the bite ends. On by default (`CONFIG.radio.ducking.enabled`), the player's switch overrides.
- Ports (injected, browser implementations in platform): `RadioStationSource`, `RadioAudioOutput`,
  `RadioPreferencesStore`, `RegionResolver`, `PageVisibility`.

### Platform (browser)

- `src/platform/browser/audio/` (new folder):
  - `SharedAudioContextProvider`: creates one `AudioContext` lazily, only inside a user gesture (the power button),
    resumes after visibility returns.
  - `RadioStreamPlayer`: owns the `<audio>` element; `crossOrigin = "anonymous"`, `error`/`stalled`/5 s start timeout,
    the CORS-less retry on a new element (bypass only), disposal of elements and listeners.
  - `WalkieTalkieRack`: high-pass 500 Hz → low-pass 3000 Hz → peaking 1800 Hz +8 dB Q 2.5 → WaveShaper
    (`(3 + k)·x·20°/(π + k·|x|)`, k = 18, 4× oversampling) → make-up gain; dry/wet with ramps. Values in
    `CONFIG.radio.rack`.
  - `RadioNoiseSource`: a looped noise buffer plus crackle bursts, gain from the signal reading.
- `src/platform/browser/radio/RadioBrowserStationSource`: `fetch` over `CONFIG.radio.apiServers` (ordered; next server
  on failure), `json/stations/search` by country code, `hidebroken`, ordered by votes, limit 60; country list from
  `json/countries` for the selector. Filter: `url_resolved`, `hls = 0`, codec in `CONFIG.radio.codecs`, and on an
  `https:` page only `https://` URLs (on `http://localhost` both). The page protocol is injected, not read globally.
- `BrowserRegionResolver` (D1): the region of `navigator.languages` (`uk-UA` → UA), then a time-zone table
  (`Europe/Kyiv` → UA, ...), then `CONFIG.radio.defaultCountry`.
- `RadioPreferencesLocalStore` over the `LocalStorageCache` instance: country, last station uuid, mode, volume,
  ducking switch, `playInBackground`. These are preferences, not game save (they cannot affect the discharge). Power
  is never restored as "on" after a reload (autoplay).

### Presentation

- Loadout: the radio's cell is one more auxiliary well, rendered by the existing loadout panel renderer.
  `inventory-loadout-panel__auxiliary` becomes a scroll container: in the row layout `inventory-horizontal-scroll`
  (`pan-x pan-y`), in the column layout `inventory-vertical-scroll` (`pan-y`), and `HorizontalScrollController`
  attached with the matching `axis` (the axis follows the layout, read from a component custom property on layout
  change, not from duplicated breakpoints). The wells keep their unit size; the height chain to the scroller keeps
  `min-height: 0` (DESIGN_RULES §7). A drag scrolls and never activates the cell under the pointer.
- Editor: `InventoryAssemblyEditorRenderer` with the radio as its root: actions (Спорядити/Зняти and «Увімкнути»/
  «Вимкнути»), the image (`wholeArt`), then the parameters: the charge meter, the station display (name, country,
  bitrate, status), previous/next, the country selector, the «Рація» mode switch (`auto-switch`), volume, «Тихіше при
  кльові», «Грати у фоні». A new `RadioControlsRenderer` builds these from existing components; status and station
  text update in place (DESIGN_RULES §13), the volume slider writes only on change. Player text in a presentation
  labels catalog. The battery is a socket tab of the editor (spec 143).
- HUD indicator (D12): a DOM `hud-indicator` component, a 40 × 40 circle, the first one in a column under the clock
  (`time-display`), placed by the HUD container, not by the component. The radio's icon is an SVG oscilloscope wave
  in `assets/ui/` (`currentColor`): shown while the radio is equipped; states off (flat line), playing (moving
  wave), weak signal (broken wave), no battery (warning colour). The wave moves through a compositor-only CSS
  animation (transform), paused while off and under reduced motion; no per-frame JS writes. It hides with the rest of
  the UI while aiming (TK-092). Assumed: a tap opens the radio editor (owner to confirm at stage 2).
- No Pixi object and no per-frame canvas drawing. The indicator is a DOM layer over the canvas, so stage 2 includes
  the owner's phone measurement with «ПРОДУКТИВНІСТЬ» (docs/rendering.md rule 12).

### DEV

- DevTools section «РАДІО»: set the charge, force rain noise, force a dropout, show the status/signal reading, server
  and station counts. The item is granted through the existing «ВИДАТИ ПРЕДМЕТ».

### Configuration (`CONFIG.radio`)

`apiServers`, `stationLimit`, `codecs`, `defaultCountry`, `startTimeoutMs` (5000), `rack {...}`,
`noise { baseGain, rainShare, crackleRate }`, `signal { lowChargePercent, dropoutMs }`,
`ducking { enabled, duckGain, attackMs, releaseMs }`, `playInBackground` default; per-item
`gameplayStats.power.unitsPerSecond`. Battery capacity and the power clock are spec 143's (`CONFIG.power`).

## Stages

0. **Spec 143:** battery item, battery slot, one power system for the boat and the radio, tamper resistance.
1. **Item, slot and editor shell** (no sound): catalog entry with the `radio` assembly profile, `RADIO` slot, art
   variant through `utils/convert-images.js --batch` (master to `asset-sources/items/radio/`, runtime sized for the
   editor preview × pixel-ratio cap), auxiliary block scrolling, the editor with image, battery socket and charge.
2. **Playback and HUD:** shared context, station source with mirrors and filters, region and preferences, player with
   retries, controls in the editor, hidden-tab policy, the HUD indicator.
3. **Walkie-talkie sound:** the rack, make-up gain, ramps, the CORS-less fallback.
4. **Signal:** consumption while on, degradation, dropouts, rain noise, empty-battery off.
5. **Ducking and DEV:** ducking with its switch, DevTools «РАДІО», owner acceptance.
Later: the thunderstorm weather state (D14) in its own spec.

Each stage is a patch version, a commit after focused checks and one Full run, and the utils cleanup step.

## Checks (deterministic, no live network)

- New `radio-receiver` check: station filtering (`url_resolved`, https/http by page protocol, HLS, codecs), mirror
  fallback, region table, preferences round trip, power only after a gesture (no context before), status changes,
  5 s timeout → next station, CORS-less retry, disposal of elements/listeners/timers. The fake `<audio>`/Web Audio
  reproduce the browser contract the code depends on (DEVELOPMENT_RULES "Library contracts"): a cross-origin element
  without CORS connected to a `MediaElementAudioSourceNode` is **silent**, and a connected element cannot be
  reconnected to the native output.
- Signal with a fixed monotonic clock and the radio RNG: 1 h of play empties a full battery, low-charge threshold,
  0 % → off, hidden tab stops the stream (default) or keeps consuming with `playInBackground`, rain increases noise,
  the gameplay RNG sequence and the game-cycle report unchanged. Tamper cases are spec 143's `device-power` check.
- Inventory: grant, equip into `radio`, insert a battery, save round trip, old saves load unchanged.
- UI: the auxiliary scroller owns its pan axis in both layouts and its height chain; a drag scrolls without
  activating a cell; a tap opens the radio editor; the HUD indicator follows the radio's status and writes nothing
  while the status is unchanged.

## Owner questions

Q1–Q7 are answered (D9–D15). Spec 143 Q8–Q14 are answered. Open: at stage 2 the indicator's tap action (assumed: opens the radio editor).

## Notes

- Traffic: a 128 kbps stream is about 1 MB per minute; the editor shows the bitrate, and stage 2 may add a one-time
  notice on mobile data (owner wish).
- Privacy: the stream is fetched from the station's own host, which sees the player's IP like any web radio; no other
  third party is contacted. Radio Browser click counting (`json/url/{uuid}`) is not used.
- Appearance, sound and the iOS Safari behaviour of Web Audio with streams are the owner's phone checks.

## Implementation

### Stage 1 (v0.47.28): item, slot, battery, editor, scrolling wells

- Catalog `devices.radio_receiver_basic` «Польовий радіоприймач» (`itemType: "radio"`, art
  `assets/items/radio/radio-receiver.webp`, TK-094), group `device.radio` (no metric), `assemblyProfileId:
  "radio_receiver"` with one `battery` slot, `gameplayStats.batteryUse.unitsPerSecond: 1` (stage 4 consumes it). DEV
  shop section «📻 Пристрої»; the backpack lists radios under "other" with their own subfilter.
- Equipment: auxiliary slot `EquipmentSlotId.RADIO = "radio"` (label «Радіо», placeholder
  `assets/ui/inventory/radio.svg`); `EquipmentState` gives saves without it an empty slot. The equipment read model
  has `radio` and `radioBattery`.
- The charge bar on device thumbnails covers the radio: `setBoatChargeProvider` became `setDeviceChargeProvider`
  (boat, chum delivery, radio); the battery has no cell of its own (TK-095).
- The editor is the ordinary item editor: a tap on the filled radio well opens it with the radio's art and the battery
  socket tab; the battery tab shows «Заряд». Radio controls arrive with stage 2.
- Auxiliary wells: `inventory-loadout-panel__auxiliary` is an auto-sized grid; in the row layout more wells than fit
  scroll left/right (`--inventory-scroll-axis: x`), in the column layout (container aspect >= 1) the column is as tall
  as the primary panel and scrolls up/down (`--inventory-scroll-axis: y`, `touch-action: pan-y`). One
  `HorizontalScrollController` with the new `resolveAxis(element)` option (read per gesture from the custom property)
  gives mouse drag and click suppression on both axes; the section pager ignores gestures inside it.
- Checks: new `radio-receiver` (catalog, slot, the player's path: well -> radio -> editor -> battery -> equip, power
  port, editor art and socket, thumbnail bar without a cell, save and reload, row/column drag axes); equipment slot
  list, progression and placeholder counts updated. Tools replaced or obsolete: none.

### Stage 2 (v0.47.29): stations, playback, controls, HUD indicator

- `CONFIG.radio` (mirrors de1/de2/fi1, 60 stations, MP3/AAC/AAC+, default UA, 8 s request and 5 s start timeouts,
  volume 0.6, `playInBackground` false, ducking on, a time-zone table).
- Domain `RadioStationFilter` (`url_resolved`, https on an https page, no HLS, listed codecs, no duplicates).
- Platform: `RadioBrowserStationSource` (mirrors in order with an aborted request after the timeout;
  `bycountrycodeexact` by votes, `countries`), `BrowserRegionResolver` (language region, time zone, default; no
  GeoIP), `RadioPreferencesLocalStore` (country, station, volume, switches; never the power),
  `SharedAudioContextProvider` (created by the first play, inside the power gesture), `RadioStreamPlayer` (Web Audio
  with crossOrigin "anonymous"; a NEW native element without CORS as the no-effect fallback; 5 s per attempt; volume
  as the output gain or the element's volume; a gain scale for ducking), `RadioHudIndicator` (shared `hud-indicator`
  40 x 40 circle under the clock, `--off/--playing/--weak/--empty`, CSS-only wave, a tap opens the radio's editor
  through `InventoryUI.openSlotEditor("radio")`); `BrowserPageHideListener` gained `onShow`.
- Application `RadioReceiverService`: power only with a worn radio and a charged battery, the country's stations, the
  remembered station, skip on failure until every station failed («Немає станцій…»), next/previous, country, volume,
  switches, hidden page stop/resume (or background play), off when the radio is taken off or the battery is empty
  (checked on every inventory change; stage 4 adds per-frame consumption).
- Presentation: `RADIO_LABELS`, `RadioControlsRenderer` (station, country and bitrate, status, power, previous/next,
  country selector, volume, «Звук рації», «Тихіше при кльові», «Грати у фоні»; text only, in-place updates, one
  subscription) under the preview of the radio's editor (`deviceControlsRenderer` of the editor renderer); styles
  `inventory/radio-controls.css`, `hud/hud-indicator.css`.
- Not yet: the walkie-talkie rack (stage 3; the switch is stored), consumption and the weak signal (stage 4), ducking
  (stage 5; the switch is stored).
- Checks: `radio-receiver` stage 2 (filter, region, mirrors and timeout, preferences, the service, the player over a
  fake Web Audio that keeps the browser contract, controls, indicator). No check composes the whole game: the owner's
  dev.html start is the first look.

### Stage 3 (v0.47.30): the walkie-talkie sound

- `WalkieTalkieRack` (platform/browser/audio) between the player's input and output: high-pass 500 Hz -> low-pass
  3000 Hz -> peaking 1800 Hz +8 dB Q 2.5 -> WaveShaper (44100-point S-curve, k = 18, 4x) -> make-up gain
  1 / f(1) ≈ 2.88 (f(1) ≈ 0.347), in parallel with the dry path; the switch ramps both gains (`setTargetAtTime`,
  30 ms) and never jumps. `CONFIG.radio.rack` holds every value.
- «Звук рації» (`retroMode`, on by default, remembered) switches it; streams on the no-CORS fallback play without it
  («без ефекту»).
- Checks: `radio-receiver` stage 3 (curve shape and peak, node order and settings, make-up gain, ramps, unchanged
  switch, dispose, the preference at start and on change).

### Stage 4 (v0.47.31): consumption, reception, dropouts, rain

- Consumption: `RadioReceiverService.tick(seconds)` from a `MonotonicIntervalTicker` (platform/browser/time; 1 s,
  `performance.now()` gaps, never the wall clock) consumes the radio's `batteryUse` (1 unit/s: an ordinary battery
  plays 1 hour) through `DevicePowerService` while the radio sounds; nothing while it is stopped in a hidden page.
  Background play reports the throttled timer's real gap: `consume({ background: true })` allows up to
  `CONFIG.power.maxBackgroundStepSeconds` (65 s); a visible page keeps the 1 s clamp. An empty battery turns the radio
  off («Немає зарядженої батарейки»).
- Reception: domain `RadioSignalModel` (`CONFIG.radio.signal`): above 25 % no effect; below, w = 1 - charge / 25 raises
  hiss (up to 0.3), crackle (up to 6/s) and volume sag (up to 35 %), dropouts with chance w² × 0.5 per second; rain adds
  hiss 0.12 and crackle 2/s at full intensity (rainMult 1..2.5).
- Sound: `RadioNoiseSource` (looped white noise -> hiss and crackle gains -> the player's output, crackles as
  AudioParam events for the next second); the player's graph is input -> rack -> stream (dropout mute) -> output
  (volume x sag); a dropout mutes the station for 150-900 ms with a crackle burst. The radio's own `SeededRng` (seeded
  from `crypto.getRandomValues`) draws noise, crackle and dropouts; the gameplay RNG is untouched.
- Status `signal` (0..1): the HUD indicator shows `--weak` (dashed wave) and the editor says «· слабкий сигнал».
- The thunderstorm (D14) will be one more weather input of `RadioSignalModel`.
- Checks: `radio-receiver` stage 4 (model numbers, 1 hour per battery with the source realm's Date.now blocked, clamped
  visible steps, hidden stop, 65 s background steps, off at empty, sag, noise, rain, dropout and its end, ticker).

### Stage 5 (v0.48.0): ducking and DevTools — the radio is complete

- Ducking: the state machine's change hook tells `RadioReceiverService.setBiting(name === "biting")`; while
  «Тихіше при кльові» is on, the gain scale is `sag x CONFIG.radio.ducking.duckGain` (0.25) and returns after the
  bite; `RadioStreamPlayer.setGainScale` eases the output gain (`setTargetAtTime`, `ducking.rampSeconds` 0.15 s), so a
  duck never clicks; unchanged values write nothing.
- DevTools «📻 РАДІО» (`src/dev/tools/radio_dev_section.js`): status, station, country and station count, signal,
  battery charge, «Розрядити до 20 / 5 / 0 %» through `DevicePowerService.consume` (DEV never raises a charge), and the
  live `CONFIG.radio` tree. The radio item comes from «📻 Пристрої», batteries from «🔋 Живлення».
- Version: owner 2026-10-25, "after the radio, add a minor": 0.48.0.
- Checks: `radio-receiver` stage 5 (duck, switch off/on during a bite, recovery, unchanged state, eased gain, the
  DevTools section). Full 71/71; game-cycle report unchanged across all stages.
- Later (own spec): the thunderstorm weather state with its own crackles (D14).

### TK-097 (v0.48.2): the vinyl record effect, tuning in DevTools, no player sound control

- Owner 2026-10-25: a "music from an old record" effect; extra parameters to tune every effect; each can be switched off
  in DevTools (`enabled`; a disabled effect's parameters disappear); the player must not control the sound quality in
  production.
- `RadioEffectsChain` (platform/browser/audio): input -> `VinylRack` -> `WalkieTalkieRack` -> output; both, one or none
  can be on (a record heard over a walkie-talkie). `CONFIG.radio.effects { rampSeconds, walkieTalkie { enabled: true,
  mix, highpassHz, lowpassHz, peakHz, peakGainDb, peakQ, drive, oversample, outputGain }, vinyl { enabled: false, mix,
  highpassHz, warmthHz, warmthGainDb, lowpassHz, drive, outputGain, baseDelayMs, wowHz, wowDepthMs, flutterHz,
  flutterDepthMs, crackleRate, crackleLevel, crackleToneHz, popRate, popLevel, hissLevel, rumbleHz, rumbleLevel } }`
  (replaces `rack`). The radio's tick calls `player.refreshEffects()`, so DevTools edits apply within a second; only
  changed values are written, enabling and mix ramp.
- Vinyl: a 6 ms delay swayed by two sine oscillators (wow 0.55 Hz x 1.2 ms, flutter 6.5 Hz x 0.15 ms: wavering pitch),
  high-pass 35 Hz, warm low shelf 150 Hz +2.5 dB, low-pass 9 kHz, soft saturation (drive 3, make-up gain), and looped
  4 s surface buffers from the radio's RNG: crackle (6 clicks/s, band-passed at 2.5 kHz), pops (0.25/s), hiss and a
  30 Hz rumble; a changed click density rebuilds only its buffer.
- The player's «Звук рації» switch and the `retroMode` preference are removed: the configuration alone decides the
  sound. DevTools «📻 РАДІО» → «Звукові ефекти»: «Платівка» and «Рація», each with «увімкнено»; parameters only while on.
- Checks: `radio-receiver` (both stages over a fake Web Audio, live edits, density rebuild, disabling, the chain from the
  live config, two player switches only, the DevTools effects with hidden parameters and the live write).

### TK-098 (v0.48.3): DEV sliders for the enabled effects

- `RadioEffectTuning` (src/dev/radio): the main parameters of the enabled effects only (vinyl: crackle, pops, hiss, wow
  depth, warmth, mix; walkie-talkie: drive, top, low cut, mix) with their ranges; writes go through the DEV config
  runtime (`CONFIG.radio.effects.<effect>.<key>`, the same store as DevTools), unknown keys are ignored.
- `RadioControlsRenderer` takes an optional `tuning` port and shows «DEV · ефекти звуку» sliders under the volume
  (value at the end of each row); the group is rebuilt only when the set of enabled effects changes and hides when none
  is on. Only the DEV page composes the port (`GameCompositionRoot` option `createRadioEffectTuning`, given by
  `development_game_startup`); production has no sliders.
- Checks: `radio-receiver` (enabled effects only, live writes of known keys, sliders, rebuild on DevTools changes,
  none in production).

### TK-099 (v0.48.4): interference switch, DEV switches in the radio's window, export and apply

- The periodic noise left with both effects off was the signal's interference (stage 4: the constant hiss
  `baseNoise`, rain crackle, and below 25 % charge crackle, dropouts and sag). `signal.enabled` (on by default) now
  switches it; `RadioSignalModel` returns a clean reading when it is off.
- The sound settings moved into the data module `src/game/config/raw/radio/radio_sound_settings.js`
  (`RADIO_SOUND_SETTINGS { effects, signal }`, canonical form of `src/dev/radio/radio_sound_settings_format.js`);
  `CONFIG.radio.effects/signal` read it.
- DevTools «📻 РАДІО» → «Звук: ефекти й перешкоди»: Платівка, Рація, Перешкоди сигналу, each with «увімкнено» and its
  parameters only while on; «⬇ Експорт налаштувань звуку» downloads `radio-sound-v<version>-<yyyymmdd-hhmm>.json`
  (live values, the code's SHA-256 for the conflict check).
- `npm run apply:radio -- <file> [--yes] [--force]` (`utils/apply-radio-sound.js`): validates the file against the
  code's settings (same keys and types), refuses a dirty module, stops on a conflict unless --force, shows the changes,
  asks, backs up under `.git/cyber-fishing-backups/radio`, writes the module and runs config-schema and radio-receiver.
  The shared steps of apply:zones and apply:radio are in `utils/apply-module-helpers.js`.
- DEV radio window: the «DEV · ефекти звуку» group has a switch per part (the three above) and the sliders of the parts
  that are on (interference: hiss, rain, weak battery, dropouts, charge threshold). Production has none of it.
- Checks: `radio-receiver` (clean signal, part switches and sliders, the DevTools part and the export file), new
  `apply-radio-sound` (canonical module, CONFIG wiring, apply / unchanged / cancelled / invalid / dirty / conflict /
  --force / --yes); `apply-zones` unchanged after the helper extraction.

### TK-100 (v0.48.5): stations remembered by whether they play with the effects

- «В ефірі без ефекту» means the station's server sends no CORS: the browser lets the page play it but not process it,
  so it plays on the native fallback without the effects (generated surface sounds still mix in).
- `RadioPreferencesLocalStore` keeps `radio_station_effects` (station id -> played with effects, at most 500, newest
  last); `RadioReceiverService` remembers every station's outcome and orders a country's list: known with effects
  first, untried next, native-only last (source order within each group).
- `CONFIG.radio.onlyEffectStations` (off; DEV switch «Лише станції з ефектом» in the radio window, also in DevTools)
  drops known native-only stations and skips an untried one at once when it falls back.
- Checks: `radio-receiver` (memory of both outcomes, order after a reload, the flag's drop and skip, the 500 limit, the
  DEV switch).
