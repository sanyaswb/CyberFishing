import { RadioStationFilter } from "../../domain/radio/radio_station_filter.js";
import { RadioSignalModel } from "../../domain/radio/radio_signal_model.js";

// Spec 142: the one owner of the radio receiver's runtime state. It plays the equipped radio only while it has a
// charged battery (spec 143), loads the stations of the chosen country (first: the browser's region, D1), skips a
// station that does not start, keeps the player's preferences and stops (or keeps playing, playInBackground) while the
// page is hidden. power() must be called from a user gesture: the first call creates the audio context.
// Status: off | loading | playing | no-effect | offline-retrying | no-battery | no-radio | no-stations.
export class RadioReceiverService {
  #equipment;
  #power;
  #stations;
  #player;
  #preferences;
  #region;
  #config;
  #filter;
  #secureOnly;
  #listeners = new Set();
  #prefs;
  #list = [];
  #index = 0;
  #requestSerial = 0;
  #failures = 0;
  #hidden = false;
  #countries = null;
  #weather;
  #noise;
  #rng;
  #scheduler;
  #signalModel;
  #signalScale = 1;
  #biting = false;
  #stationEffects;
  #dropoutTimer = null;
  #intermissionTimer = null;
  #status = {
    status: "off", powered: false, equipped: false, signal: 1, station: null, country: "", stationCount: 0, effects: true,
    volume: 0.6, ducking: true, playInBackground: false, channelMode: "world", trackIndex: 0, trackCount: 0,
    walkieTalkie: true, vinyl: false,
  };

  // equipment: { getEquipped() } (radio, radioBattery); power: DevicePowerService; stations: { listStations(code),
  // listCountries() }; player: RadioStreamPlayer-like { play(url), stop(), setVolume(v) }; preferences: { load(),
  // save(p) }; region: { resolve() }; config: () => CONFIG.radio; secureOnly: the page is https (mixed content);
  // weather: { getSnapshot() } (isRaining, wind.rainMult); noise: RadioNoiseSource-like { update(level, rate, s),
  // burst(s), stop() }; rng: the radio's own { next() }; scheduler: { setTimeout, clearTimeout } (dropouts).
  constructor({ equipment, power, stations, player, preferences, region, config, secureOnly, weather, noise, rng,
    scheduler, filter = new RadioStationFilter(), signalModel = new RadioSignalModel() }) {
    this.#equipment = equipment;
    this.#power = power;
    this.#stations = stations;
    this.#player = player;
    this.#preferences = preferences;
    this.#region = region;
    this.#config = config;
    this.#secureOnly = secureOnly === true;
    this.#filter = filter;
    this.#weather = weather;
    this.#noise = noise;
    this.#rng = rng;
    this.#scheduler = scheduler;
    this.#signalModel = signalModel;
    const cfg = this.#config() || {};
    const defaultChannel = cfg.defaultChannel || "world";
    this.#prefs = {
      volume: Number.isFinite(Number(cfg.defaultVolume)) ? Number(cfg.defaultVolume) : 0.6,
      ducking: cfg.ducking?.enabled !== false,
      playInBackground: cfg.playInBackground === true,
      channelMode: defaultChannel,
      voliaTrackIndex: 0,
      customTrackIndex: 0,
      ...this.#preferences.load(),
    };
    if (this.#prefs.walkieTalkie !== undefined && cfg.effects?.walkieTalkie) {
      cfg.effects.walkieTalkie.enabled = this.#prefs.walkieTalkie;
    }
    if (this.#prefs.vinyl !== undefined && cfg.effects?.vinyl) {
      cfg.effects.vinyl.enabled = this.#prefs.vinyl;
    }
    this.#prefs.country = this.#prefs.country || this.#region.resolve();
    this.#stationEffects = this.#preferences.loadStationEffects();
    this.#player.setVolume(this.#prefs.volume);
    this.#syncPreferences();
    this.#updateCurrentStationPreview();
  }

  // { status, powered, equipped, signal, station, country, stationCount, effects, volume, ducking, playInBackground }; one
  // object, updated in place.
  getStatus() {
    return this.#status;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // The power button (a user gesture).
  togglePower() {
    if (this.#status.powered) this.powerOff();
    else this.powerOn();
  }

  powerOn() {
    if (!this.#equipment.getEquipped()?.radio) return this.#set({ status: "no-radio", powered: false });
    if (!this.#hasCharge()) return this.#set({ status: "no-battery", powered: false });
    this.#set({ powered: true, status: "loading" });
    this.#failures = 0;
    this.#clearIntermission();
    this.#startCurrentChannel();
  }

  powerOff(status = "off") {
    this.#requestSerial += 1;
    this.#clearIntermission();
    this.#player.stop();
    this.#noise.stop();
    this.#endDropout();
    this.#signalScale = 1;
    this.#applyGain();
    this.#set({ powered: false, status, signal: 1 });
  }

  next() {
    this.#step(1);
  }

  previous() {
    this.#step(-1);
  }

  setChannel(mode) {
    if (!["volia", "world"].includes(mode) || mode === this.#prefs.channelMode) return;
    this.#prefs.channelMode = mode;
    this.#save({ channelMode: mode });
    this.#clearIntermission();
    this.#syncPreferences();
    if (this.#status.powered) {
      this.#startCurrentChannel();
    } else {
      this.#updateCurrentStationPreview();
      this.#notify();
    }
  }

  setEffectEnabled(effect, enabled) {
    if (!["walkieTalkie", "vinyl"].includes(effect)) return;
    const value = enabled === true;
    const cfg = this.#config() || {};
    if (cfg.effects?.[effect]) {
      cfg.effects[effect].enabled = value;
      this.#prefs[effect] = value;
      this.#save({ [effect]: value });
      this.#player.refreshEffects();
      this.#syncPreferences();
      this.#notify();
    }
  }

  setCountry(code) {
    const country = String(code || "").toUpperCase();
    if (!/^[A-Z]{2}$/u.test(country) || (country === this.#prefs.country && this.#prefs.channelMode === "world")) return;
    this.#prefs.country = country;
    this.#prefs.channelMode = "world";
    delete this.#prefs.stationId;
    this.#save({ country, channelMode: "world", stationId: null });
    this.#clearIntermission();
    this.#syncPreferences();
    if (this.#status.powered) this.#loadCountry(country, null);
    else this.#notify();
  }

  setVolume(volume) {
    const value = Math.max(0, Math.min(1, Number(volume) || 0));
    if (value === this.#prefs.volume) return;
    this.#prefs.volume = value;
    this.#player.setVolume(value);
    this.#save({ volume: value });
    this.#set({ volume: value });
  }

  setPreference(key, enabled) {
    if (!["ducking", "playInBackground"].includes(key)) return;
    const value = enabled === true;
    if (this.#prefs[key] === value) return;
    this.#prefs[key] = value;
    this.#save({ [key]: value });
    this.#set({ [key]: value });
    if (key === "ducking") this.#applyGain();
    if (key === "playInBackground" && this.#hidden && !value && this.#status.powered) this.#player.stop();
  }

  // Countries for the selector: [{ code, name, stationCount }], loaded once.
  async listCountries() {
    if (!this.#countries) {
      const raw = await this.#stations.listCountries();
      this.#countries = raw
        .map((entry) => ({ code: String(entry?.iso_3166_1 || "").toUpperCase(), name: String(entry?.name || ""),
          stationCount: Math.max(0, Number(entry?.stationcount) || 0) }))
        .filter((entry) => /^[A-Z]{2}$/u.test(entry.code) && entry.stationCount > 0);
    }
    return this.#countries;
  }

  // The fishing state became or stopped being a bite (stage 5).
  setBiting(biting) {
    const value = biting === true;
    if (value === this.#biting) return;
    this.#biting = value;
    this.#applyGain();
  }

  // The page was hidden or shown (BrowserPageHideListener).
  setPageHidden(hidden) {
    this.#hidden = hidden === true;
    if (!this.#status.powered || this.#prefs.playInBackground) return;
    if (this.#hidden) {
      this.#player.stop();
    } else if (this.#status.status === "intermission") {
      // While in intermission, keep waiting for interval timer.
    } else {
      this.#resumeCurrentChannel();
    }
  }

  // The player reported a state for the current station.
  handlePlayerState(state, { effects = true } = {}) {
    if (!this.#status.powered) return;
    const mode = this.#prefs.channelMode || "world";
    if (state === "playing") {
      if (mode === "world") {
        this.#rememberStation(effects);
        // TK-100: with onlyEffectStations a station without CORS is skipped like a silent one.
        if (effects || this.#config()?.onlyEffectStations !== true) {
          this.#failures = 0;
          this.#set({ status: effects ? "playing" : "no-effect", effects });
          return;
        }
      } else {
        this.#failures = 0;
        this.#set({ status: effects ? "playing" : "no-effect", effects });
        return;
      }
    } else if (state === "loading") {
      return;
    } else if (state === "ended") {
      if (mode !== "world") {
        this.#failures = 0;
        this.#handleTrackEnded(mode);
        return;
      }
    }
    // "failed": the next station, until every station of the list failed once.
    if (mode === "world") {
      this.#failures += 1;
      if (this.#failures >= this.#list.length) return this.#set({ status: "no-stations" });
      this.#set({ status: "offline-retrying" });
      this.#index = (this.#index + 1) % this.#list.length;
      this.#playCurrent();
    } else {
      this.#failures += 1;
      const tracks = this.#getChannelConfig(mode)?.tracks || [];
      if (this.#failures >= tracks.length) {
        this.#failures = 0;
        return this.#set({ status: mode === "volia" ? "no-volia-tracks" : "no-tracks" });
      }
      this.#handleTrackEnded(mode);
    }
  }

  // Per frame: tracks whether a radio is worn, and an unequipped radio or an empty battery turns it off (stage 4 adds
  // consumption).
  update() {
    const equipped = Boolean(this.#equipment.getEquipped()?.radio);
    if (equipped !== this.#status.equipped) this.#set({ equipped });
    if (!this.#status.powered) return;
    if (!this.#equipment.getEquipped()?.radio) this.powerOff("no-radio");
    else if (!this.#hasCharge()) this.powerOff("no-battery");
  }

  // Stage 4, about once a second from a monotonic clock: the radio consumes its battery while it sounds (also in a
  // hidden page with playInBackground; nothing while it is stopped there), its reception follows the charge and the
  // rain, and a weak battery brings dropouts. An empty battery turns it off.
  tick(seconds) {
    if (!this.#status.powered) return;
    const equipped = this.#equipment.getEquipped() || {};
    if (!equipped.radio) return this.powerOff("no-radio");
    const batteryId = equipped.radioBattery?.instanceId || null;
    if (!batteryId) return this.powerOff("no-battery");
    if (this.#hidden && !this.#prefs.playInBackground) return;
    const reading = this.#power.consume({
      deviceId: equipped.radio.instanceId,
      batteryInstanceId: batteryId,
      unitsPerSecond: Number(equipped.radio.effectiveStats?.batteryUse?.unitsPerSecond) || 0,
      seconds,
      background: this.#hidden,
    });
    if (reading.empty) return this.powerOff("no-battery");
    // The sound effects follow CONFIG.radio.effects (DevTools); the player does not choose them (TK-097).
    this.#player.refreshEffects();
    const weather = this.#weather.getSnapshot() || {};
    const signal = this.#signalModel.read({ chargePercent: reading.percent, isRaining: weather.isRaining === true,
      rainMult: weather.wind?.rainMult }, this.#config()?.signal || {});
    this.#signalScale = 1 - signal.volumeSag;
    this.#applyGain();
    const step = Math.max(0, Math.min(Number(seconds) || 0, 5));
    this.#noise.update(signal.noiseGain, signal.crackleRate, step || 1);
    const chance = 1 - Math.pow(1 - Math.min(1, signal.dropoutChancePerSecond), step);
    if (this.#dropoutTimer === null && chance > 0 && this.#rng.next() < chance) this.#startDropout();
    const quality = Math.round(signal.quality * 100) / 100;
    if (quality !== this.#status.signal) this.#set({ signal: quality });
  }

  dispose() {
    this.#requestSerial += 1;
    this.#clearIntermission();
    this.#player.stop();
    this.#noise.stop();
    this.#endDropout();
    this.#listeners.clear();
  }

  #startDropout() {
    const [minimum, maximum] = this.#config()?.signal?.dropoutMs || [500, 2500];
    const length = minimum + this.#rng.next() * Math.max(0, maximum - minimum);
    if (typeof this.#player.setStreamInterrupted === "function") {
      this.#player.setStreamInterrupted(true);
    } else {
      this.#player.setStreamMuted(true);
    }
    this.#noise.burst(length / 1000);
    this.#dropoutTimer = this.#scheduler.setTimeout(() => this.#endDropout(length), length);
  }

  #endDropout(interruptedDurationMs = 0) {
    if (this.#dropoutTimer !== null) this.#scheduler.clearTimeout(this.#dropoutTimer);
    this.#dropoutTimer = null;
    const catchUp = this.#rng.next() < 0.55;
    const catchUpRate = 1.35 + this.#rng.next() * 0.15;
    const missedSeconds = Math.max(1, interruptedDurationMs / 1000);
    const catchUpSeconds = Math.min(4, Math.max(1.5, missedSeconds / (catchUpRate - 1)));
    if (typeof this.#player.setStreamInterrupted === "function") {
      this.#player.setStreamInterrupted(false, { catchUp, catchUpRate, catchUpSeconds });
    } else {
      this.#player.setStreamMuted(false);
    }
  }

  // Stage 5: a bite ducks the radio to CONFIG.radio.ducking.duckGain while «Тихіше при кльові» is on.
  #applyGain() {
    const duck = this.#biting && this.#prefs.ducking ? Number(this.#config()?.ducking?.duckGain ?? 0.25) : 1;
    this.#player.setGainScale(this.#signalScale * Math.max(0, Math.min(1, duck)));
  }

  async #loadCountry(country, stationId) {
    const serial = ++this.#requestSerial;
    this.#set({ status: "loading", country, station: null, stationCount: 0 });
    let list = [];
    try {
      const cfg = this.#config() || {};
      list = this.#filter.filter(await this.#stations.listStations(country), {
        codecs: cfg.codecs || [], secureOnly: this.#secureOnly,
      });
    } catch {
      list = [];
    }
    if (serial !== this.#requestSerial || !this.#status.powered) return;
    list = this.#orderByEffects(list);
    this.#list = list;
    this.#failures = 0;
    if (list.length === 0) {
      this.#player.stop();
      return this.#set({ status: "no-stations", stationCount: 0 });
    }
    const remembered = stationId ? list.findIndex((station) => station.id === stationId) : -1;
    this.#index = remembered >= 0 ? remembered : 0;
    this.#set({ stationCount: list.length });
    this.#playCurrent();
  }

  // TK-100: stations known to play with the effects first, untried ones next, native-only ones last (or dropped with
  // onlyEffectStations); the source order holds within each group.
  #orderByEffects(list) {
    const only = this.#config()?.onlyEffectStations === true;
    const rank = (station) => this.#stationEffects[station.id] === true ? 0 : this.#stationEffects[station.id] === false ? 2 : 1;
    return list
      .filter((station) => !only || this.#stationEffects[station.id] !== false)
      .map((station, index) => ({ station, index }))
      .sort((left, right) => rank(left.station) - rank(right.station) || left.index - right.index)
      .map((entry) => entry.station);
  }

  #rememberStation(effects) {
    const station = this.#list[this.#index];
    if (!station || this.#stationEffects[station.id] === effects) return;
    this.#stationEffects[station.id] = effects;
    this.#preferences.saveStationEffect(station.id, effects);
  }

  #step(direction) {
    if (!this.#status.powered) return;
    const mode = this.#prefs.channelMode || "world";
    if (mode === "world") {
      if (this.#list.length === 0) return;
      this.#failures = 0;
      this.#index = (this.#index + direction + this.#list.length) % this.#list.length;
      this.#playCurrent();
    } else {
      this.#clearIntermission();
      const channel = this.#getChannelConfig(mode);
      const tracks = channel?.tracks || [];
      if (tracks.length === 0) return;
      const prefKey = mode === "volia" ? "voliaTrackIndex" : "customTrackIndex";
      const nextIndex = ((this.#prefs[prefKey] ?? 0) + direction + tracks.length) % tracks.length;
      this.#prefs[prefKey] = nextIndex;
      this.#save({ [prefKey]: nextIndex });
      this.#loadPlaylistChannel(mode);
    }
  }

  #getChannelConfig(mode) {
    const cfg = this.#config() || {};
    return cfg.channels?.[mode] || null;
  }

  #startCurrentChannel() {
    const mode = this.#prefs.channelMode || "world";
    if (mode === "world") {
      this.#loadCountry(this.#prefs.country, this.#prefs.stationId);
    } else {
      this.#loadPlaylistChannel(mode);
    }
  }

  #resumeCurrentChannel() {
    const mode = this.#prefs.channelMode || "world";
    if (mode === "world") {
      this.#playCurrent();
    } else {
      this.#loadPlaylistChannel(mode);
    }
  }

  #loadPlaylistChannel(mode) {
    const channel = this.#getChannelConfig(mode);
    const tracks = channel?.tracks || [];
    const count = tracks.length;
    const prefKey = mode === "volia" ? "voliaTrackIndex" : "customTrackIndex";
    let index = Number(this.#prefs[prefKey]) || 0;
    if (index >= count) index = 0;
    this.#prefs[prefKey] = index;

    if (count === 0) {
      this.#player.stop();
      const statusKey = mode === "volia" ? "no-volia-tracks" : "no-tracks";
      return this.#set({
        status: statusKey,
        station: {
          id: channel?.id || mode,
          name: channel?.name || mode,
          frequency: channel?.frequency || "",
          title: "",
          url: "",
        },
        stationCount: 0,
        trackIndex: 0,
        trackCount: 0,
      });
    }

    const track = tracks[index];
    const station = {
      id: track.id || `${mode}-${index}`,
      name: channel.name,
      frequency: channel.frequency || "",
      title: track.title || "",
      url: track.url || "",
    };
    this.#set({
      status: "loading",
      station,
      stationCount: count,
      trackIndex: index,
      trackCount: count,
    });
    if (this.#hidden && !this.#prefs.playInBackground) return;
    this.#player.play(track.url);
  }

  #handleTrackEnded(mode) {
    this.#player.stop();
    const channel = this.#getChannelConfig(mode);
    const tracks = channel?.tracks || [];
    if (tracks.length === 0) {
      const statusKey = mode === "volia" ? "no-volia-tracks" : "no-tracks";
      return this.#set({ status: statusKey });
    }
    const intermissionCfg = channel?.intermission;
    if (intermissionCfg && (Number(intermissionCfg.minSeconds) > 0 || Number(intermissionCfg.maxSeconds) > 0)) {
      const minSec = Number(intermissionCfg.minSeconds) || 15;
      const maxSec = Number(intermissionCfg.maxSeconds) || 45;
      const pauseSeconds = minSec + this.#rng.next() * Math.max(0, maxSec - minSec);
      const pauseMs = pauseSeconds * 1000;

      this.#set({ status: "intermission" });
      this.#intermissionTimer = this.#scheduler.setTimeout(() => {
        this.#intermissionTimer = null;
        if (!this.#status.powered || this.#prefs.channelMode !== mode) return;
        const prefKey = mode === "volia" ? "voliaTrackIndex" : "customTrackIndex";
        const nextIndex = ((this.#prefs[prefKey] ?? 0) + 1) % tracks.length;
        this.#prefs[prefKey] = nextIndex;
        this.#save({ [prefKey]: nextIndex });
        this.#loadPlaylistChannel(mode);
      }, pauseMs);
    } else {
      const prefKey = mode === "volia" ? "voliaTrackIndex" : "customTrackIndex";
      const nextIndex = ((this.#prefs[prefKey] ?? 0) + 1) % tracks.length;
      this.#prefs[prefKey] = nextIndex;
      this.#save({ [prefKey]: nextIndex });
      this.#loadPlaylistChannel(mode);
    }
  }

  #clearIntermission() {
    if (this.#intermissionTimer !== null) {
      this.#scheduler.clearTimeout(this.#intermissionTimer);
      this.#intermissionTimer = null;
    }
  }

  #updateCurrentStationPreview() {
    const mode = this.#prefs.channelMode || "world";
    if (mode === "volia" || mode === "custom") {
      const channel = this.#getChannelConfig(mode);
      const tracks = channel?.tracks || [];
      const prefKey = mode === "volia" ? "voliaTrackIndex" : "customTrackIndex";
      const index = Math.min(Math.max(0, tracks.length - 1), Math.max(0, Number(this.#prefs[prefKey]) || 0));
      const track = tracks[index];
      this.#status.station = {
        id: track?.id || `${mode}-${index}`,
        name: channel?.name || mode,
        frequency: channel?.frequency || "",
        title: track?.title || "",
        url: track?.url || "",
      };
      this.#status.stationCount = tracks.length;
      this.#status.trackIndex = index;
      this.#status.trackCount = tracks.length;
    } else {
      this.#status.station = this.#list[this.#index] || null;
      this.#status.stationCount = this.#list.length;
    }
  }

  #playCurrent() {
    const station = this.#list[this.#index];
    if (!station) return;
    this.#prefs.stationId = station.id;
    this.#save({ stationId: station.id });
    this.#set({ station, status: "loading" });
    if (this.#hidden && !this.#prefs.playInBackground) return;
    this.#player.play(station.url);
  }

  #hasCharge() {
    const batteryId = this.#equipment.getEquipped()?.radioBattery?.instanceId || null;
    return batteryId ? !this.#power.read(batteryId).empty : false;
  }

  #save(values) {
    const clean = {};
    for (const [key, value] of Object.entries(values)) if (value !== undefined) clean[key] = value;
    this.#preferences.save(clean);
  }

  #syncPreferences() {
    const cfg = this.#config() || {};
    Object.assign(this.#status, {
      country: this.#prefs.country,
      volume: this.#prefs.volume,
      ducking: this.#prefs.ducking,
      playInBackground: this.#prefs.playInBackground,
      channelMode: this.#prefs.channelMode || "world",
      walkieTalkie: cfg.effects?.walkieTalkie?.enabled ?? true,
      vinyl: cfg.effects?.vinyl?.enabled ?? false,
    });
  }

  #set(values) {
    Object.assign(this.#status, values);
    this.#notify();
  }

  #notify() {
    for (const listener of [...this.#listeners]) listener(this.#status);
  }
}
