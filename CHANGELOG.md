# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.21 - Immediate Weather DevTools redraw inside drill-in sections (TK-330)

- Weather DevTools: clicking «Викид: пік зараз», toggles, or action buttons inside drilled-in «Стан і керування» (or any drilled weather subsection) now refreshes the visible drill-in immediately via `DevToolsUI.preserveDrill`; `EmissionModel.force` also clears manual intensity hold when entering an active phase.

## v0.51.20 - Pink pulse on active DevTools «Змінені» button (TK-329)

- DevTools: while the «Змінені» filter is active, its button background pulses smoothly in pink so developers and testers immediately see why untouched parameters are hidden.

## v0.51.19 - Include cross-section changes inside DevTools «Конфіг» flat filter (TK-328.1)

- DevTools «Змінені» inside «Конфіг»: includes changed parameters owned by other sections (location weather under `CONFIG.locations.map.*`, `CONFIG.debug.*`, database catalogs) alongside `ConfigModule`, deduplicated into one continuous flat list without section or page headers.

## v0.51.18 - DevTools «Змінені» filter by owning module and flat «Конфіг» (TK-328)

- DevTools «Змінені»: outside «Конфіг», edited parameters show under the specialized module where they were changed (e.g., «Сцена» instead of surfacing the duplicate «Конфіг» tree above it); inside «Конфіг», «Змінені» shows only «Конфіг» changes as a flat list without sections; numeric lists (`numberList`) and custom weather/debug config rows now track changed state and resets.

## v0.51.17 - Weather DevTools: in-place groups, event switches (TK-327.1)

- DevTools «ПОГОДА»: inside a section every group opens in place (only a section opens inside); the location selector is buttons; rain, storm, fog and emission have switches (on starts a random event, off ends it) and the generated course shows on top; ВІТЕР lists what rain and storm do to the wind.

## v0.51.16 - Weather DevTools rebuilt (spec 180 stage C, TK-327)

- DevTools «ПОГОДА»: «Загальні» or a location on top with «Параметри локації»; «Стан і керування» with a slider for rain, storm, fog, emission, ash, wind, waves and current (moving a slider holds it), the rain's and ash's look at strength 100 under their sliders, action buttons at the bottom; sections ДОЩ, ШТОРМ, ВІТЕР, ТУМАН, ВИКИД, ПОПІЛ, ВОДА, ПОЧАТОК І ПОРОГИ with a «змінено» mark and a reset; the emission blur has five simple knobs; WebGL buttons at the very bottom.

## v0.51.15 - Weather settings structure (spec 180 stage B, TK-326)

- Weather settings: what the storm and the wind do is now the same for every location (rain chance and strength, drop slant and how smoothly it follows the wind, gust shape); rain and ash looks change with their strength between values at 0 and 100, with per-drop length and slant spread; the waves narrow across the screen only with their own perspective switch, and the current no longer moves them; DEV striped background for checking the waves.

## v0.51.14 - Independent weather events with timelines (spec 180 stage A, TK-325)

- Weather: rain, storm and fog are separate events — each starts by a chance checked every minute and rolls its whole course at the start (length, when its peak comes, how long and how strong); a storm raises the chance and strength of rain but may pass without it, and has its own lightning. DevTools: switching the storm off no longer leaves the rain on.

## v0.51.13 - Vignette and blur switch separately (TK-324.2)

- Emission screen: the darkening (emission.screen.vignette.enabled) and the blur (emission.screen.blur.enabled) switch on and off on their own in DevTools «Конфіг», so each can be measured; without darkening the veil paints no gradient.

## v0.51.12 - Irregular blur pulses and a swaying vignette (TK-324.1)

- Emission screen: the blur comes in sharp, glitch-like pulses of random strength and an ever-changing rhythm that quickens toward the peak; the darkening has smoother edges and sways like a swell, closing in deeper than it opens out.
