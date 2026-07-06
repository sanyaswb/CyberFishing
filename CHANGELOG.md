# CyberFishing changelog

## v0.23.28 - Touch hold threshold preservation

- Preserved `pullHoldMinMs` for touch Rod Hold while keeping simultaneous lateral control support.
- Added `pointerHoldActive` as the explicit InputManager source of truth for touch hold.
- Prevented raw `pointerDown` from being interpreted as Rod Hold by fight input composition.
- Added regression coverage for early touch input before the hold threshold.

## v0.23.27 - Simultaneous touch hold/control and tension build rate

- Fixed touch fight input so lateral control no longer cancels rod hold.
- Allowed touch Rod Hold and Rod Control to be active simultaneously.
- Added explicit TENSION build-rate resolver for hold/control combinations.
- Made hold + control fill the TENSION bar faster without increasing tension caps or final load.
- Added debug and overlay fields for tension build mode, build multiplier, cap blocking and reserve.

## v0.23.26 - Stamina inactivity recovery and legacy cleanup

- Added phase 2 stamina recovery trigger after 5 seconds of raw player input inactivity.
- Kept phase 2 release from starting recovery instantly.
- Added no-input stamina recovery debug and overlay fields.
- Separated raw input inactivity from effective stamina pressure after fatigue.
- Removed legacy stamina drain/regen fallback calculators and script entries.
- Cleaned old slackLineRecovery/noPressureTimeout stamina phase recovery paths from the simplified model.
- Updated metadata and overlay labels for the simplified stamina model.

## v0.23.25 - Simplified stamina model

- Reworked fish stamina into a simplified explicit drain / regen / idle model.
- Removed line slack / line taut dependency from active stamina phase switching.
- Fixed pole rod phase flicker when STAMINA reaches zero.
- Added player-vs-fish advantage based stamina drain scaling.
- Added lateral position based stamina pressure weighting for rod hold, reel hold and control.
- Added control direction factor so lateral control is most effective when pulling fish back to center.
- Split stamina recovery rules before and after EXHAUSTION phase.
- Added debug fields for simplified stamina model, lateral pressure and drain/regen decisions.

## v0.23.24 - Fatigue HUD cleanup

- Renamed stale hold-reel recovery debug source from `rod_hold_y` to `reel_hold_recovery`.
- Implemented `playerPressureFatigue.recovery.holdCompleteVisibleMs` as a short render-only recovered state in the fatigue HUD.
- Cached parsed fatigue HUD colors to avoid creating color objects during each render.

## v0.23.23 - Reel hold fatigue source

- Changed Player Pressure Fatigue source from rod hold pressure to reel hold.
- Added HUD fatigue indicator with grace, fatigue and recovery visual states.
- Added debug overlay timing fields for player fatigue state, source and recovery.
- Added fatigue source resolver to separate input/source detection from fatigue calculation.
- Added metadata for player fatigue visual and timing parameters.

## v0.23.22 - Runtime diagnostics opt-in

- Kept the trimmed utility set focused on `check-js.js`, `game-cycle-check.js`, `dev-server.js` and version-copy support.
- Changed `MemoryLeakWatchdog` startup to opt-in only through `CONFIG.debug.memoryWatchdog.enabled === true`.
- Added explicit default memory watchdog config with bounded sampling settings.
- Updated project version metadata comments after removing the old `set-project-version.js` workflow.

## v0.23.21 - Combined pressure gain

- Added `playerPressureGain` config and resolver for Rod Hold / Rod Control input combos.
- Changed the default player force budget allocation to independent Hold and Control budgets, with legacy split mode kept explicit.
- Applied hold + control combo gain to pressure buildup before Player Pressure Fatigue, without post-multiplying final tension.
- Added Fight Summary input combo debug output and regression coverage for gain modes, thresholds and budget behavior.

## v0.23.20 - Pressure control break

- Added `playerPressureFatigue.controlBreak` for long continuous pressure after fatigue is nearly maxed.
- Split physical pressure from stamina/endurance control pressure: tension can still receive fatigued force while STAMINA regen and phase rollback treat exhausted control as no pressure.
- Added `isControlExhausted` fatigue state/debug fields and Fight Summary control state.
- Extended stamina and fatigue checks for long-hold control break, stamina regen unblocking and phase recovery with physical pressure still present.

## v0.23.19 - Stamina frame only

- Removed legacy `StaminaController` fallback paths for tension/angle-based stamina and duration-based exhaustion.
- Made stamina/endurance state updates depend only on `StaminaBalanceFrame`.
- Removed legacy recovery punishment and duration-based power debuff fallback from `StaminaController`.
- Removed stale legacy stamina/exhaustion config and debug rows.
- Added regression checks that block reintroducing the old fallback identifiers.

## v0.23.18 - Phase recovery

- Added EXHAUSTION to STAMINA rollback when the line is slack or effective post-fatigue player pressure stays below threshold.
- Preserved current ENDURANCE on rollback so phase 2 resumes from the existing exhaustion state after stamina is broken again.
- Added smooth ENDURANCE recovery in STAMINA phase after full stamina recovery, capped at 80%.
- Added `stamina.mechanics.phaseRecovery` config, validation and metadata.
- Extended stamina balance regression coverage for slack rollback, no-pressure timeout, pressure threshold ratio and recovery cap.

## v0.23.17 - Player pressure fatigue

- Added a separate Player Pressure Fatigue model for continuous Rod Hold / Rod Control pressure.
- Applied fatigue to transmitted player force before tension, stamina and endurance consumers read it.
- Kept fish stamina regen based on effective post-fatigue pressure through the existing stamina balance frame.
- Added raw/effective pressure fatigue debug fields and compact Fight Summary overlay rows.
- Added regression coverage for pressure grace, fatigue, recovery and force-channel multiplication.

## v0.23.16 - Fish power debuff correction

- Fixed frame-based fish power debuff scaling so minimum power is reached only when ENDURANCE reaches zero.
- Added `stamina.mechanics.powerDebuff` with `enabled`, `minBasePowerRatio` and `curvePower` settings.
- Kept `basePowerDropPerSec` as legacy fallback and removed it from the new frame-based power sync path.
- Separated runtime fish force multiplier from current state target force multiplier in debug data.
- Added current state max force debug fields for Fish Balance overlay.
- Updated `ПОТОЧНА СИЛА` to show inline loss next to `База` and `З множниками` instead of a separate exhaustion row.
- Added regression coverage for endurance-ratio power debuff scaling and current state max force overlay data.

## v0.23.15 - Overlay lifecycle stability

- Fixed the debug overlay visibility lifecycle so `debug-live-update` no longer shows an empty overlay window before any module renders content.
- Made `OverlayController.update()` the single source of truth for overlay show/hide decisions based on rendered HTML output.
- Prevented overlay viewport clamping while the overlay window is actively dragged, avoiding flicker and bottom-right jump artifacts.
- Stopped update ticks from reapplying overlay scale every refresh; scale is now applied only through the scale control path.
- Added a self-guard to `EchoModule.render()` and removed the pre-cast placeholder output.
- Added regression coverage for overlay visibility, drag-clamp ownership and echo pre-cast behavior.

## v0.23.14 - Overlay balance cleanup

- Simplified `Fish Balance` so the default module shows only `State Force Preview`.
- Moved `Fish Summary`, `Current Fish Force` and `Fish Debuffs` into optional overlay modules.
- Added `Active / Force / Speed / Weight` toggles to the state force preview so extra state details can be enabled only when needed.
- Removed duplicate `State Force Preview` heading output and replaced `Actual/Forced` wording with a cleaner direction label.
- Removed legacy Y/simple speed fallbacks from main overlay-oriented sections and marked remaining legacy stroke rows as deprecated in Advanced.

## v0.23.13 - Balance overlay refactor

- Added `Fish Balance` overlay module combining fish base force, state force preview and live debuffs.
- Added compact `Fight Summary`, `Line & Drag Summary`, `Rod Control Summary` and `Fish Movement Summary` overlay modules.
- Updated overlay defaults to prioritize balance-focused modules while keeping detailed fish/fight modules available as Advanced sections.
- Reused the existing Actual/Away/Side/Toward fish-state force preview without changing gameplay physics.
- Added overlay module grouping in DevTools and regression coverage for the new summary overlay layout.
