import { BrowserBufferedAudioPlayer } from "./browser_buffered_audio_player.js";

/**
 * @typedef {Object} IAudioService
 * @property {(assetId: string) => { src: string, warm: () => Promise<void>, play: (volume?: number) => void, dispose: () => void }} createPlayer
 */
// A sound by its asset id (spec 157 R16): the registry gives the file where the player loads it.
export class BrowserAudioAdapter {
  #assets;

  constructor({ assets }) {
    if (!assets || typeof assets.pathOf !== "function") throw new TypeError("BrowserAudioAdapter requires assets");
    this.#assets = assets;
  }

  createPlayer(assetId) {
    return new BrowserBufferedAudioPlayer(this.#assets.pathOf(assetId));
  }
}
