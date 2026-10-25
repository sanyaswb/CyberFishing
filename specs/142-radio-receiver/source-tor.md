# Technical Specification & Terms of Reference (ToR)
## Feature: "Vintage Field Radio Receiver" Game Mechanic
**Project:** Cyber Fishing  
**Stack:** Vanilla JS (ES6+), PixiJS, Web Audio API, Radio Browser API  
**Target Environments:** GitHub Pages (Production HTTPS), Localhost (Development)  

---

## 1. Overview & Gameplay Mechanics

### 1.1. Context & Purpose
The "Vintage Field Radio Receiver" is an interactive atmospheric and utility inventory item designed to enrich the ambient fishing gameplay loop within the post-apocalyptic cyberpunk setting. It streams live radio broadcasts from around the world using the open-source **Radio Browser API**, dynamically alters the audio stream using custom Digital Signal Processing (DSP) via the browser's native **Web Audio API** to emulate a worn-down walkie-talkie/transistor speaker, and accommodates strict browser security models.

### 1.2. Player Progression & Lifecycle
1. **Acquisition:** The player purchases the Radio from the base merchant using in-game currency.
2. **Persistence:** The purchase sets `hasRadio = true` within the persistent save state (`SaveManager`).
3. **Availability:** Once acquired, the Radio interface becomes accessible during active fishing sessions (either via a dedicated holographic HUD button or an interactive physical item sitting on the boat/crate).
4. **Controls & Interactions:**
   - **Power Toggle:** Turn stream playback On/Off.
   - **Station Navigation:** Step forward/backward through available stations (`Next` / `Prev`).
   - **Region Selector:** Automatically detects user country on first boot; offers a manual country dropdown selector (e.g., UA, US, JP, DE, UK, etc.).
   - **Sound Mode Selector (Bypass vs. Walkie-Talkie):** Toggle between pristine digital stream and stylized retro lo-fi / walkie-talkie audio.
   - **Volume Slider:** Adjust output gain level ($0.0$ to $1.0$).

---

## 2. Network Architecture & Environment Filtering

Browsers enforce strict security policies regarding mixed content and cross-origin media playback. The system must adapt dynamically depending on execution context.

### 2.1. Environment Detection Strategy
```javascript
const isProduction = window.location.protocol === 'https:';
```

### 2.2. Protocol Matrix

| Environment | Protocol Detection | Stream URL Policy | Rationale |
| :--- | :--- | :--- | :--- |
| **GitHub Pages** (Production) | `https:` | **Strict HTTPS only** (`url.startsWith('https://')`) | Prevents browser `Mixed Content` fatal blocking errors. Unsecured HTTP streams are discarded silently before display. |
| **Localhost** (Development) | `http:` / `file:` | **Permissive (HTTP + HTTPS)** | Maximizes the available station catalog for local debugging and broad testing. |

---

## 3. Geolocation & Radio Browser API Integration

### 3.1. API Specification
- **Primary Endpoint:** `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/{countryCode}`
- **Query Parameters:**
  - `limit=40`: Retrieve a manageable batch of stations.
  - `order=votes`: Prioritize popular, reliable streams.
  - `reverse=true`: Descending order.
  - `hidebroken=true`: Filter out non-responsive servers.

### 3.2. Geolocation Sequence
1. Query free GeoIP endpoint (e.g., `https://ipapi.co/json/` or `https://ipwho.is/`) to obtain the player's 2-letter ISO country code (`ISO 3166-1 alpha-2`).
2. **Fallback Mechanism:** If blocked by client AdBlockers or network failure, inspect browser locale:
   ```javascript
   const fallbackCountry = Intl.DateTimeFormat().resolvedOptions().timeZone.includes('Kyiv') ? 'UA' : 'US';
   ```
3. Load the initial station list based on resolved country code.
4. Allow runtime station reloading when the player manually selects a new country in the UI.

---

## 4. Digital Signal Processing (DSP): "Walkie-Talkie" Sound Rack

Audio manipulation uses pure native **Web Audio API** without external audio engine overhead. The chain strips modern high-fidelity dynamics, isolates mid frequencies, and applies soft-clipping saturation to replicate a portable radio receiver.

### 4.1. Audio Node Architecture

```
                    ┌─────────────────────────┐
                    │  HTMLAudioElement (Src) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ MediaElementAudioSource │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Master Input Node    │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┴────────────────────────┐
        │                                                 │
        ▼ [Dry Path (Bypass)]                             ▼ [Wet Path (Walkie-Talkie)]
┌──────────────┐                                ┌───────────────────┐
│ DryGain Node │                                │ Highpass Filter   │
│ (Gain: 0 / 1)│                                │ Frequency: 500 Hz │
└───────┬──────┘                                └─────────┬─────────┘
        │                                                 │
        │                                                 ▼
        │                                       ┌───────────────────┐
        │                                       │ Lowpass Filter    │
        │                                       │ Frequency: 3000 Hz│
        │                                       └─────────┬─────────┘
        │                                                 │
        │                                                 ▼
        │                                       ┌───────────────────┐
        │                                       │ Peaking Filter    │
        │                                       │ Frequency: 1800 Hz│
        │                                       │ Gain: +8 dB, Q:2.5│
        │                                       └─────────┬─────────┘
        │                                                 │
        │                                                 ▼
        │                                       ┌───────────────────┐
        │                                       │ WaveShaper Node   │
        │                                       │ (Distortion Curve)│
        │                                       │ (Oversample: 4x)  │
        │                                       └─────────┬─────────┘
        │                                                 │
        │                                                 ▼
        │                                       ┌───────────────────┐
        │                                       │ WetGain Node      │
        │                                       │ (Gain: 1 / 0)     │
        │                                       └─────────┬─────────┘
        │                                                 │
        └────────────────────────┬────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Master Output Node    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ AudioContext.destination│
                    └─────────────────────────┘
```

### 4.2. Mathematical Model for Distortion (`WaveShaperNode`)
To simulate analog diode/transistor clipping, generate an $S$-shaped transfer function curve of length $N = 44100$:

$$f(x) = \frac{(3 + k) \cdot x \cdot 20^\circ}{\pi + k \cdot |x|}$$

Where:
- $x \in [-1, 1]$ represents the normalized input audio sample.
- $k$ represents the distortion drive parameter ($k \approx 18$ for classic lo-fi crunch).
- $20^\circ = 20 \times \frac{\pi}{180}$ radians.
- `oversample = '4x'` eliminates high-frequency aliasing artifacts during non-linear clipping.

---

## 5. Software Architecture & Class Diagram (SOLID & OOP)

The system adheres to Single Responsibility, Open/Closed, and Dependency Inversion principles.

```
src/game/radio/
├── RadioService.js         // Data Access Layer: API queries, geo-lookup, filtering
├── WalkieTalkieRack.js     // DSP Layer: Web Audio graph configuration & distortion math
├── RadioAudioEngine.js     // Audio Controller: Media lifecycle, playback state, volume
├── RadioModel.js           // State Layer: Inventory item data, current station, settings
└── RadioView.js            // Presentation Layer: PixiJS Container rendering & inputs
```

### 5.1. Module Specifications

#### `RadioService`
- **Responsibilities:** Communicating with remote endpoints, handling protocol security sanitization.
- **Methods:**
  - `detectCountry(): Promise<string>`
  - `fetchStations(countryCode: string): Promise<Array<StationDTO>>`
  - `filterStations(stations: Array<StationDTO>): Array<StationDTO>`

#### `WalkieTalkieRack`
- **Responsibilities:** Managing audio filter nodes, calculating distortion curves, switching Dry/Wet signals without clicks or pops.
- **Methods:**
  - `constructor(audioContext: AudioContext)`
  - `createDistortionCurve(amount: number): Float32Array`
  - `setEffectEnabled(enabled: boolean): void`
  - `setDistortionGain(amount: number): void`

#### `RadioAudioEngine`
- **Responsibilities:** Wrapping standard `HTMLAudioElement`, lazily activating `AudioContext` on user interaction (Autoplay Policy compliance), routing into `WalkieTalkieRack`.
- **Methods:**
  - `init(): void` (Triggered on first user click)
  - `play(streamUrl: string): Promise<void>`
  - `pause(): void`
  - `resume(): void`
  - `setVolume(value: number): void`
  - `setRetroMode(enabled: boolean): void`

#### `RadioModel`
- **Responsibilities:** Maintaining current state, synchronizing with game `SaveManager`.
- **Properties:**
  - `isUnlocked: boolean`
  - `currentCountry: string`
  - `stationList: Array<StationDTO>`
  - `currentIndex: number`
  - `isRetroMode: boolean`
  - `volume: number`

#### `RadioView` (extends `PIXI.Container`)
- **Responsibilities:** Visual representation in PixiJS scene graph.
- **Components:**
  - Background housing sprite (retro-futuristic metal/acrylic chassis).
  - Frequency & station title display (using `PIXI.BitmapText` or `PIXI.Text`).
  - Interactive buttons (`PIXI.Sprite` with pointer listeners): Power, Prev, Next, Retro Toggle.
  - Optional visualizer bar tied to an `AnalyserNode`.

---

## 6. Logic Flowchart

```
[Game Engine Loop]
       │
       ▼
[SaveManager]: Check `hasRadio`
       │
       ├─► [false] ──► Hide Radio UI on Fishing Scene / Item available in Shop
       │
       └─► [true]
             │
             ▼
[Init PixiJS RadioView Container] (Status: Powered Off)
             │
             ▼
[Player Input: "Turn On" Click] ──(Fulfills Browser Autoplay Policy)
             │
             ▼
[RadioAudioEngine.init()] ──► Instantiates AudioContext & WalkieTalkieRack
             │
             ▼
[RadioService.detectCountry()] ──► Resolves Country Code (e.g., 'UA')
             │
             ▼
[RadioService.fetchStations()] ──► Fetch stations from Radio-Browser API
             │
             ▼
[Protocol Filter]:
             ├─► (location.protocol === 'https:') ──► Discard all 'http://' streams
             └─► (location.protocol === 'http:')  ──► Keep all streams
             │
             ▼
[RadioAudioEngine.play(firstStation.url)]
             │
             ├─► [Success] ──► Update Station Name on PixiJS Display
             │
             └─► [Stream Error] ──► Auto-increment to Next Available Station
```

---

## 7. Edge Cases & Fault Tolerance

1. **Browser Autoplay Restrictions:**
   - Under no circumstances should `AudioContext.resume()` or `audio.play()` be executed during initial game boot. Initialization MUST be deferred to a discrete user gesture (e.g., clicking the "Power" button).

2. **Dead / Unreachable Streams:**
   - External radio stations frequently go offline. Listen to `HTMLAudioElement` error events (`error`, `stalled`, `abort`).
   - If a stream fails to load within 5 seconds, display an "OFFLINE - RETRYING..." indicator on the PixiJS display, advance to `currentIndex + 1`, and attempt playback of the next station.

3. **CORS Violations on Web Audio Nodes:**
   - Streams missing the `Access-Control-Allow-Origin: *` header will fail when piped through `createMediaElementSource()`.
   - **Graceful Fallback:** Catch CORS security errors. If detected, disconnect the node from the `AudioContext` and pipe playback straight to the native browser `<audio>` output without DSP effects, keeping audio audible for the player.

4. **Tab Switching & Visibility Change:**
   - Listen to `document.addEventListener('visibilitychange', ...)` to preserve context stability or reduce audio processing load when the player minimizes or switches tabs.

---

## 8. Acceptance Criteria

- [ ] **GH Pages Compliance:** On a live HTTPS deployment, the console exhibits zero `Mixed Content` warnings/errors.
- [ ] **Localhost Flexibility:** On a local dev server, all streams (both HTTP and HTTPS) populate in the playlist.
- [ ] **Geo-Location:** Upon first activation, the playlist defaults to stations corresponding to the player's country code.
- [ ] **Manual Region Switch:** Changing the country in the UI unloads the current playlist, fetches new regional stations, and begins playback of the top-ranked station without reloading the page.
- [ ] **Acoustic Profiling:** Toggling the "Retro/Walkie-Talkie" switch audibly modifies the spectrum: high and low frequencies roll off sharply, and mid-range saturation increases without causing digital clipping distortion.
- [ ] **State Persistence:** Buying the radio marks it permanently unlocked across game reloads via the local save data.