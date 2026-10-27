# Feature Specification: Custom radio channel (MP3) and VOLIA 77.2

**Created**: 2026-10-27  
**Status**: Accepted by Owner 2026-10-27; in implementation  
**Input**: Owner 2026-10-27: "створити свій радіо канал який так само можна налаштовувати різні ефекти і так далі, я туди буду завантажувати mp3 файли і вони час від часу будуть програватися, а також повинен бути окремий кнал VOLIA 77.2"

## Owner Decisions (2026-10-27)

- **D1 VOLIA 77.2 Source:** Purely local atmospheric / station audio files bundled in the game under `assets/audio/radio/volia/`. Specifically, `RADIO_VOLIA.mp3` provided by the owner in the repo root is placed into `assets/audio/radio/volia/RADIO_VOLIA.mp3`.
- **D2 Custom Channel Source:** Direct placement of MP3 files into the repository folder `assets/audio/radio/custom/`. No browser upload UI needed; tracks are discovered via manifest / playlist registry.
- **D3 Periodic Playback Mode ("час від часу"):** Playlist with intermission pauses. After a track finishes, the radio plays atmospheric radio static / receiver noise (`RadioNoiseSource`) during an intermission pause (default: 15–45 seconds, configurable in UI/settings), then the next track starts.
- **D4 Channel Navigation & Switching:** Dedicated source/channel switcher in the radio controls window (`RadioControlsRenderer`):
  1. **«VOLIA 77.2»** (fixed channel at 77.2 FM playing `assets/audio/radio/volia/`)
  2. **«Свій канал»** (MP3 playlist from `assets/audio/radio/custom/`)
  3. **«Світове радіо»** (Radio Browser internet live streams by country)
- **D5 Audio Effects:** The custom channel and VOLIA 77.2 route through the exact same Web Audio pipeline as live streams (`RadioEffectsChain`), with configurable effects:
  - Walkie-talkie rack (`WalkieTalkieRack`)
  - Vinyl rack (`VinylRack`)
  - Signal degradation / battery sag / rain interference / dropouts (`RadioSignalModel` + `RadioNoiseSource`)
  - Volume ducking during bite (`RadioDuckingPolicy`)
  - Player switches for effects (e.g. «Ефект рації», «Ефект вінілу») and DEV tuning sliders.

---

## Technical Model & Architecture

### 1. File Structure & Assets
- `assets/audio/radio/volia/RADIO_VOLIA.mp3`: master broadcast file for VOLIA 77.2.
- `assets/audio/radio/custom/`: directory for player's custom MP3 tracks.
- `src/game/config/raw/radio/radio_channels.js`: configuration containing:
  - Channel definitions (`volia`, `custom`, `world`).
  - Track manifests for `volia` and `custom`.
  - Default intermission settings (min/max pause seconds).
- `utils/scan-radio-tracks.js`: lightweight utility / hook to auto-update track manifests from disk.

### 2. Audio Pipeline Integration
- `RadioStreamPlayer`:
  - When playing local audio files (e.g. `assets/audio/radio/...`), creates standard `<audio>` element with `crossOrigin = "anonymous"`.
  - Same-origin assets succeed in `createMediaElementSource(audioElement)` with 100% reliability (effects always enabled).
  - Listens to `ended` event on the audio element:
    - In live stream mode: not applicable (infinite stream).
    - In local playlist mode (`volia` / `custom`): notifies service of track completion.
- `RadioReceiverService`:
  - Manages active channel mode (`mode: "volia" | "custom" | "world"`), saved in preferences.
  - When `mode === "volia"`:
    - Lists tracks from VOLIA playlist.
    - Station name: "VOLIA 77.2", meta: "77.2 FM · Воля", status shows current track title / "В ефірі".
  - When `mode === "custom"`:
    - Lists tracks from Custom playlist.
    - If no tracks: status "Немає треків у assets/audio/radio/custom/".
    - When tracks present: plays current track, transitions to intermission on completion.
  - Intermission scheduler:
    - After track ends, status becomes "Ефірний шум (пауза)" / "В ефірі".
    - `audioElement` is paused/stopped.
    - `RadioNoiseSource` continues playing atmospheric hiss/crackle.
    - After timer (e.g. 20s), advances to next track and starts playback.
  - Controls: `previous()` and `next()` advance to previous/next track in playlist (or next/prev station in world mode).

### 3. Presentation (`RadioControlsRenderer` & `radio-controls.css`)
- Mode selector / channel tabs or pills:
  - `[ VOLIA 77.2 ] [ Свій канал ] [ Світове радіо ]`
- Dynamic controls per mode:
  - In `world` mode: country dropdown and internet stations.
  - In `volia` mode: track title, track index (e.g. "Трек 1 з 1"), frequency badge "77.2 FM".
  - In `custom` mode: track title, track count, intermission pause info/slider.
- Effect switches:
  - Walkie-talkie toggle («Рація»)
  - Vinyl toggle («Вініл»)
  - Ducking toggle («Тихіше при кльові»)
  - Background play toggle («Грати у фоні»)

---

## Verification & Checks
1. Move `RADIO_VOLIA.mp3` to `assets/audio/radio/volia/RADIO_VOLIA.mp3` and track it.
2. Unit / functional tests in `tests/radio/` or `utils/checks/`:
   - Channel switching between `volia`, `custom`, and `world`.
   - Playlist progression and intermission transition on `ended` event.
   - Effect toggles update `RadioEffectsChain`.
   - Deterministic checks per `utils/UTILS_RULES.md` (no pixel tests).
3. Version bump and changelog update per `AGENTS.md`.
