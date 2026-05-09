/**
 * @typedef {Object} IDevFlagsProvider
 * @property {(flag: string) => boolean} isEnabled
 * @property {() => boolean} isDebugEnabled
 */

/** @implements {IDevFlagsProvider} */
class DevFlagsProvider {
  #config;
  #godModeSource;
  #debugModulesSource;

  constructor({
    config,
    godModeSource = () => (typeof GodMode !== "undefined" ? GodMode : null),
    debugModulesSource = () =>
      typeof window !== "undefined" ? window.DEBUG_MODULES : null,
  } = {}) {
    this.#config = config || {};
    this.#godModeSource = godModeSource;
    this.#debugModulesSource = debugModulesSource;
  }

  isEnabled(flag) {
    const source = this.#godModeSource?.();
    return !!(source && source[flag] === true);
  }

  isDebugEnabled() {
    const debugModules = this.#debugModulesSource?.();
    return !!(
      this.#config.debug?.overlay ||
      this.#config.debug?.events ||
      this.#config.logs?.events ||
      debugModules
    );
  }
}

/**
 * @typedef {Object} IAudioService
 * @property {(src: string) => { src: string, warm: () => Promise<void>, play: (volume?: number) => void, dispose: () => void }} createPlayer
 */
class BrowserAudioAdapter {
  createPlayer(src) {
    return new BrowserBufferedAudioPlayer(src);
  }
}

class BrowserBufferedAudioPlayer {
  #src;
  #context = null;
  #buffer = null;
  #loadPromise = null;
  #fallbackPool = null;
  #fallbackCursor = 0;

  constructor(src, fallbackPoolSize = 4) {
    this.#src = src;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      this.#context = new AudioContextClass();
      this.#loadPromise = this.#load();
    } else {
      this.#fallbackPool = [];
      for (let i = 0; i < fallbackPoolSize; i++) {
        this.#fallbackPool.push(new Audio(src));
      }
    }
  }

  get src() {
    return this.#src;
  }

  async #load() {
    const response = await fetch(this.#src);
    const data = await response.arrayBuffer();
    this.#buffer = await this.#context.decodeAudioData(data);
    return this.#buffer;
  }

  warm() {
    return this.#loadPromise || Promise.resolve();
  }

  play(volume = 1) {
    if (this.#fallbackPool) {
      const sound = this.#fallbackPool[this.#fallbackCursor];
      this.#fallbackCursor =
        (this.#fallbackCursor + 1) % this.#fallbackPool.length;
      sound.pause();
      sound.currentTime = 0;
      sound.volume = volume;
      sound.play().catch(() => {});
      return;
    }

    if (!this.#buffer) {
      this.#loadPromise?.then(() => this.play(volume)).catch(() => {});
      return;
    }

    if (this.#context.state === "suspended") {
      this.#context.resume().catch(() => {});
    }

    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    gain.gain.value = volume;
    source.buffer = this.#buffer;
    source.connect(gain);
    gain.connect(this.#context.destination);
    source.start(0);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  dispose() {
    if (this.#fallbackPool) {
      for (let i = 0; i < this.#fallbackPool.length; i++) {
        const sound = this.#fallbackPool[i];
        sound.pause();
        sound.removeAttribute("src");
        sound.load();
      }
      this.#fallbackPool.length = 0;
    }

    if (this.#context && this.#context.state !== "closed") {
      this.#context.close().catch(() => {});
    }
  }
}

/**
 * @typedef {Object} IDebugEvents
 * @property {(type: string, handler: Function) => Function} on
 * @property {(type: string, payload: object) => void} emit
 * @property {() => void} clear
 */
class BrowserDebugAdapter {
  #bus = new EventBus();
  #target;
  #isEnabled;

  constructor(target, isEnabled) {
    this.#target = target;
    this.#isEnabled = isEnabled;
  }

  on(type, handler) {
    return this.#bus.on(type, handler);
  }

  emit(type, detail) {
    if (!this.#isEnabled()) return;
    this.#bus.emit(type, detail);
    this.#target?.dispatchEvent?.(new CustomEvent(type, { detail }));
  }

  clear() {
    this.#bus.clear();
  }
}

class BrowserEventTargetAdapter {
  constructor(target) {
    this.target = target;
  }

  add(type, handler, options) {
    this.target.addEventListener(type, handler, options);
    return () => this.target.removeEventListener(type, handler, options);
  }

  emit(type, detail) {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

class CanvasMetricsProvider {
  #canvas;
  #viewport;

  constructor(canvas, viewport = null) {
    this.#canvas = canvas;
    this.#viewport =
      viewport ||
      (() => ({ width: window.innerWidth, height: window.innerHeight }));
  }

  get width() {
    return this.#canvas.width;
  }

  get height() {
    return this.#canvas.height;
  }

  resizeToViewport() {
    const viewport = this.#viewport();
    this.#canvas.width = viewport.width;
    this.#canvas.height = viewport.height;
  }
}

class ConfigProvider {
  #config;

  constructor(config) {
    this.#config = config;
  }

  get physics() {
    return this.#config.physics || {};
  }
  get tension() {
    return this.#config.tension || {};
  }
  get stamina() {
    return this.#config.stamina || {};
  }
  get locations() {
    return this.#config.locations || {};
  }
  get ui() {
    return this.#config.ui || {};
  }
  get spawns() {
    return this.#config.spawns || {};
  }
  get debug() {
    return this.#config.debug || {};
  }
  get hookMechanics() {
    return this.#config.hookMechanics || {};
  }
  get feederConfig() {
    return this.#config.feederConfig || {};
  }
  get raw() {
    return this.#config;
  }
}
