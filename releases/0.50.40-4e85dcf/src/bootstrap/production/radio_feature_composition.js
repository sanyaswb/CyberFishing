import { SeededRng } from "../../engine/random/seeded_rng.js";
import { RadioReceiverService } from "../../game/application/radio/radio_receiver_service.js";
import { RadioControlsRenderer } from "../../game/presentation/radio/radio_controls_renderer.js";
import { RADIO_LABELS } from "../../game/presentation/radio/radio_labels.js";
import { RadioEffectsChain } from "../../platform/browser/audio/radio_effects_chain.js";
import { RadioNoiseSource } from "../../platform/browser/audio/radio_noise_source.js";
import { RadioStreamPlayer } from "../../platform/browser/audio/radio_stream_player.js";
import { SharedAudioContextProvider } from "../../platform/browser/audio/shared_audio_context_provider.js";
import { BrowserRegionResolver } from "../../platform/browser/radio/browser_region_resolver.js";
import { RadioBrowserStationSource } from "../../platform/browser/radio/radio_browser_station_source.js";
import { BrowserPageHideListener } from "../../platform/browser/runtime/browser_page_hide_listener.js";
import { RadioPreferencesLocalStore } from "../../platform/browser/storage/radio_preferences_local_store.js";
import { MonotonicIntervalTicker } from "../../platform/browser/time/monotonic_interval_ticker.js";
import { RadioHudIndicator } from "../../platform/browser/ui/radio_hud_indicator.js";

// The field radio receiver (spec 142) as a feature loaded after the first frame (spec 157 R12): stations, stream
// player, effects, preferences, region, its HUD indicator under the clock (a tap opens the radio's editor), the page
// visibility policy and the controls the radio's editor shows. The receiver reads the saved preferences when it is
// built, so a radio left on starts playing once this module arrives.
// Returns { radio, createControlsRenderer(domFactory), dispose() }.
export function composeRadioFeature({ windowTarget, documentTarget, config, assets, storageCache, inventory, devicePower,
  weather, mountNode, onActivate, tuning = null }) {
  const disposables = [];
  const own = (value) => { disposables.push(value); return value; };
  let radio = null;
  // The radio's own random numbers (noise, crackle, dropouts, the record's surface); never the gameplay RNG.
  const seed = new Uint32Array(1);
  windowTarget.crypto?.getRandomValues?.(seed);
  const radioRng = new SeededRng(seed[0] || 0x5eed);
  const audioContexts = own(new SharedAudioContextProvider({ windowRef: windowTarget }));
  const player = own(new RadioStreamPlayer({ documentRef: documentTarget, audioContexts, scheduler: windowTarget,
    config, onState: (state, info) => radio?.handlePlayerState(state, info), assets,
    effects: new RadioEffectsChain({ config: () => config().effects || {}, rng: radioRng, assets,
      fetchRef: windowTarget.fetch ? windowTarget.fetch.bind(windowTarget) : null }) }));
  const noise = own(new RadioNoiseSource({ audioContexts, getOutput: () => player.output, getGate: () => player.streamGate, rng: radioRng }));
  radio = own(new RadioReceiverService({
    equipment: inventory,
    power: devicePower,
    stations: new RadioBrowserStationSource({ fetchRef: windowTarget.fetch.bind(windowTarget), config, scheduler: windowTarget }),
    player,
    preferences: new RadioPreferencesLocalStore({ cache: storageCache }),
    region: new BrowserRegionResolver({ navigatorRef: windowTarget.navigator, config,
      timeZone: () => windowTarget.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "" }),
    config,
    secureOnly: windowTarget.location?.protocol === "https:",
    weather,
    noise,
    rng: radioRng,
    scheduler: windowTarget,
  }));
  own(new MonotonicIntervalTicker({ windowRef: windowTarget, intervalMs: config().tickMs,
    now: () => windowTarget.performance.now(), onTick: (seconds) => radio.tick(seconds) }));
  own(new BrowserPageHideListener({ documentRef: documentTarget, windowRef: windowTarget,
    onHide: () => radio.setPageHidden(true), onShow: () => radio.setPageHidden(false) }));
  const removeInventoryListener = inventory.onInventoryChanged(() => radio.update());
  own({ dispose: () => removeInventoryListener?.() });
  radio.update();
  own(new RadioHudIndicator({ documentRef: documentTarget, radio, labels: RADIO_LABELS, mountNode, onActivate }));
  return {
    radio,
    createControlsRenderer: (domFactory) => new RadioControlsRenderer({ domFactory, radio, labels: RADIO_LABELS, tuning }),
    dispose() {
      for (const value of disposables.splice(0).reverse()) value?.dispose?.();
    },
  };
}
