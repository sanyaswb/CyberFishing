# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.43 - Radio frequency tuning cue (next_track-radio) on station switches when vinyl is disabled

- Radio: added authentic radio frequency search / tuning sweep audio cue (`next_track-radio.mp3`) with 2.8s stream ducking and smooth crossfade for station and track switches when vinyl effect is disabled (TK-137).
- Radio: unified track switch dispatching in effects chain, seamlessly selecting vinyl tonearm landing (`vinyl-6.mp3`) when vinyl is active or electronic radio tuning when vinyl is disabled (TK-137).

## v0.48.42 - Restored vinyl-6 cue on track switches and added power on/off tonearm needle effects

- Radio / Vinyl: restored `vinyl-6.mp3` tonearm drop & lead-in cueing with 3.0s ducking on track and station switches, ensuring active effects graph and open gate prior to cue trigger (TK-136).
- Radio / Vinyl: added authentic vinyl tonearm sound on radio power-on (needle contact and groove spin before music fades in) and radio power-off (instant music and noise mute with ~1.8s tonearm lift fade-out into silence) (TK-136).

## v0.48.41 - Silenced effects when radio is off and calibrated Track 3 parameter ranges

- Radio / Vinyl: silenced all vinyl synthesizers, SFX loops, and needle cues when the radio is powered off or paused via dedicated effects gate and active state suppression (TK-135).
- Radio / Vinyl: recalibrated Track 3 parameter ranges for unmistakable acoustic impact on mobile transducers: wow expanded to 16ms depth (~90 cents pitch sway), tonal warmth down to 4.2 kHz cutoff with +8 dB warmth, and asymmetric saturation boosted with pre-gain (TK-135).

## v0.48.40 - Physical acoustic vinyl synthesizer with 3-track DSP architecture

- Radio / Vinyl: upgraded procedural vinyl synthesizer to a physical 3-track DSP architecture with independent controls for Track 1 (mechanical rumble 10-60 Hz and filtered surface noise 300-8k Hz), Track 2 (scratch pops with 16 kHz cantilever ringing and micro-crackle), and Track 3 (program material with sub-bass cut, MM cartridge peak, 2nd-harmonic asymmetric saturation, inner groove distortion, and 33⅓ rpm wow & flutter) (Spec 148 / TK-134).

## v0.48.39 - Vinyl-6 needle cueing with 3s ducking on track switch and removed oldSpeaker slider

- Radio / Vinyl: replaced synthetic chirp cue with single-shot `vinyl-6.mp3` tonearm drop & groove lead-in, ducking switched track audio for 3.0s with smooth fade-in (3.0s..3.4s) while `vinyl-6` sharply fades out (3.0s..3.25s) (TK-133).
- Radio / Vinyl: removed obsolete `oldSpeaker` DSP processing, configuration, and DEV slider; decoupled from legacy sample files (`vinyl_needle_drop.mp3`, `vinyl_surface.mp3`) (TK-133).

## v0.48.38 - Browser fetch binding, AudioContext gesture resume, and live tuning refresh

- Radio / Vinyl: resolved browser `fetch` binding (`Illegal invocation`), ensured `AudioContext` resumes on gesture and graph initializes on effect refresh, and wired immediate live effect updates from DEV radio tuning controls (TK-132).

## v0.48.37 - Dedicated vinyl SFX overlay section with ready audio recordings

- Radio / Vinyl: added dedicated SFX overlay section in DEV tuning with individual switches and volume sliders for 6 authentic vinyl audio recordings (`vinyl-1.mp3` through `vinyl-6.mp3`) seamlessly looped in Web Audio (TK-132).

## v0.48.36 - Independent blendable vintage character sliders and dynamic crackle density

- Radio / Vinyl: made dry gramophone, worn speaker, and soft vinyl into independent blendable sliders with wider distortion/bandwidth ranges, and tied crackle and pop slider levels dynamically to both amplitude and click density (TK-131).

## v0.48.35 - Independent vinyl crackle / groove noise controls and 3 vintage presets

- Radio / Vinyl: separated needle crackle and continuous groove surface noise into independent controls, and introduced 3 distinct vintage tone presets (0: soft vinyl, 1: dry gramophone with steep bass cut and horn resonance, 2: worn speaker with narrow bandwidth and tube saturation) with intensity/warmth scaling (TK-130).

## v0.48.34 - Simplified vinyl sound effect to 3 core procedural parameters

- Radio / Vinyl: streamlined vinyl tuning down to 3 core intuitive parameters: warmth (vintage boxy filter & saturation), crackle (prominent needle-in-groove crackling and surface bed), and pops (distinct dust impulse clicks) for focused procedural sound testing (TK-129).



