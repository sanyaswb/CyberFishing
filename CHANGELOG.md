# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.37 - Dedicated vinyl SFX overlay section with ready audio recordings

- Radio / Vinyl: added dedicated SFX overlay section in DEV tuning with individual switches and volume sliders for 6 authentic vinyl audio recordings (`vinyl-1.mp3` through `vinyl-6.mp3`) seamlessly looped in Web Audio (TK-132).

## v0.48.36 - Independent blendable vintage character sliders and dynamic crackle density

- Radio / Vinyl: made dry gramophone, worn speaker, and soft vinyl into independent blendable sliders with wider distortion/bandwidth ranges, and tied crackle and pop slider levels dynamically to both amplitude and click density (TK-131).

## v0.48.35 - Independent vinyl crackle / groove noise controls and 3 vintage presets

- Radio / Vinyl: separated needle crackle and continuous groove surface noise into independent controls, and introduced 3 distinct vintage tone presets (0: soft vinyl, 1: dry gramophone with steep bass cut and horn resonance, 2: worn speaker with narrow bandwidth and tube saturation) with intensity/warmth scaling (TK-130).

## v0.48.34 - Simplified vinyl sound effect to 3 core procedural parameters

- Radio / Vinyl: streamlined vinyl tuning down to 3 core intuitive parameters: warmth (vintage boxy filter & saturation), crackle (prominent needle-in-groove crackling and surface bed), and pops (distinct dust impulse clicks) for focused procedural sound testing (TK-129).

## v0.48.33 - Dual vinyl sound engine (sampled authentic recordings vs procedural lo-fi vintage turntable)

- Radio / Vinyl: added dual vinyl engine with live mode selector (0: sampled genuine vinyl crackle and needle drop, 1: dry procedural lo-fi vintage turntable with horn resonance and steep bandwidth cutoff), tonearm needle drop cueing on track switch, and updated DEV radio tuning parameters (Spec 147 / TK-128).

## v0.48.32 - Restored previous vinyl record sound effect and configuration

- Radio: restored previous vinyl record rack DSP, full parameter set, and sound characteristics (reverted TK-126 by owner request, TK-127).

## v0.48.31 - Complete vinyl sound rework, expressive crackle/clicks, unified warmth and tonearm drop cueing

- Radio: streamlined vinyl rack to essential expressive parameters (warmth, crackle level and rate, pop level and rate) with wide, tactile dynamic range from delicate surface noise to loud vinyl crunch (TK-126).
- Radio: added unified warmth slider controlling lowshelf bass boost, analog high-cut, tube saturation and organic turntable pitch flutter in a single intuitive slider (TK-126).
- Radio: implemented procedural tonearm drop cueing sound with landing contact thump, lead-in groove friction squeak, and crackle flurry on track changes and playback start (TK-126).

## v0.48.30 - Calibrated radio dropout noise level and sharp discharge crackle gating

- Radio: calibrated dropout hiss burst and micro-glitch volume to match nominal track loudness, scaling proportionally with volume sag (TK-125).
- Radio: added stream gate node to sharply duck the audio track to zero during discharge crackles without smoothness/easing (TK-125).

## v0.48.29 - Retro sound filter, weather interference subsection, and audio dropouts with catch-up acceleration

- Radio: added dedicated Retro audio effect rack with analog saturation, presence boost, and tube low-end warmth without walkie-talkie clipping or vinyl crackle (TK-124).
- Radio: separated weather interference into its own settings subsection and DevTools/tuning group, isolating rain-induced hiss and crackle from battery discharge (TK-124).
- Radio: implemented stream interruption on signal dropouts with hiss bursts and accelerated playback rate catch-up upon resumption (TK-124).

## v0.48.28 - Visual preview synchronization on tab switch and default VOLIA 77.2 track order

- Inventory / Assembly: visual preview card now synchronizes with the active slot tab on swipe or tap, showing the equipped item card or the compartment icon for empty slots (TK-123).
- Radio: default VOLIA 77.2 playlist begins with "Ефір ВОЛЯ 77.2" followed by "Чому з Купола тікають на Іржавий Шельф" (TK-123).



