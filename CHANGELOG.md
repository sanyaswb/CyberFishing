# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.48 - Bait boat lvl3 inventory and chum controls dynamic artwork variants

- Delivery / Inventory: added dynamic artwork switching for bait boat lvl3 (`boat-lvl--3_bait.webp` when all 3 chum slots are equipped, `boat-lvl--3_no-bait.webp` otherwise) across inventory cards, thumbnails, and delivery slot (Spec 150 / TK-141).
- Fishing / HUD: updated `ChumControls` and `ChumController` to show the corresponding boat image on the toolbar button for boat delivery mode (TK-141).

## v0.48.47 - Sequential switch cue playback with configurable overlap, next_track-vinyl, and 2s track pause

- Radio: converted track and station switch cueing into sequential playback (`next_track-vinyl` or `next_track-radio` plays first, followed by incoming track audio from 0:00:00 without beginning cutoff or ducking), governed by new configurable `cueOverlapSeconds` parameter (TK-140).
- Radio / Vinyl: renamed `assets/audio/radio/vinyl/vinyl-6.mp3` to `assets/audio/radio/next_track-vinyl.mp3` alongside `next_track-radio.mp3` and exposed `cueOverlapSeconds` sliders for both vinyl and radio in DEV tuning (TK-140).
- Radio / VOLIA 77.2: inserted an authentic 2-second broadcast pause (`2000 ms`) between playlist tracks during automatic track progression and manual stepping on the same frequency without triggering station switch sweep cues (TK-140).

## v0.48.46 - Uncolored retro zero-state, station-only switch cues, and unmuted vinyl track start

- Radio / Retro: removed hidden distortion in `RetroRack` by making `drive = 0` yield a strictly linear $f(x) = x$ curve, extending lowpass to 22 kHz and highpass down to 10 Hz, and exposing `presenceQ` slider in DEV tuning for full acoustic transparency when sliders are zeroed (TK-139).
- Radio: separated station/frequency switching cues (`next_track-radio` / `vinyl-6`) from intra-station playlist track advances on the same frequency (VOLIA 77.2), playing switch sweep only when changing stations or waves (TK-139).
- Radio / Vinyl: removed initial 3.0s ducking/silencing on `trackCueGate` during vinyl needle drop cueing, allowing the incoming track to play immediately at normal volume without muffling or fade-in delay (TK-139).

## v0.48.45 - Dedicated physical 3-track transistor radio synthesizer section ("Радіо")

- Radio: created new independent "Радіо" (`RadioRack`) section implementing full 3-track physical transistor radio synthesizer with dual cascaded 24 dB/oct HPF/LPF, chassis resonance, asymmetric clipper, DynamicsCompressor AGC, carrier noise, and heterodyne whistle tuning (Spec 149 / TK-138).
- Radio / Walkie-Talkie: restored "Рація" (`WalkieTalkieRack`) and its configuration bit-for-bit to its previous architecture, keeping both effects fully independent in the chain and DEV tuning (TK-138).

## v0.48.44 - Physical transistor radio DSP synthesizer with AGC compressor and heterodyne tuning

- Radio / Walkie-Talkie: upgraded walkie-talkie stage to a physical 3-track transistor radio synthesizer with dual cascaded 24 dB/oct HPF (450 Hz) and LPF (3800 Hz), chassis resonance peaking (+8 dB @ 2.1 kHz), asymmetric 3rd/5th harmonic hard clipper, and DynamicsCompressor AGC (Spec 149 / TK-138).
- Radio / Walkie-Talkie: added background static noise bed (Track 1) and heterodyne whistle generator (Track 2) dynamically modulated by a new tuning/detune control, with full DEV slider coverage and powered-off state silencing (TK-138).

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
