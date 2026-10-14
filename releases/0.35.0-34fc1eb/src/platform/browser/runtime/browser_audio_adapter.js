import { BrowserBufferedAudioPlayer } from "./browser_buffered_audio_player.js";

/**
 * @typedef {Object} IAudioService
 * @property {(src: string) => { src: string, warm: () => Promise<void>, play: (volume?: number) => void, dispose: () => void }} createPlayer
 */
export class BrowserAudioAdapter {
  createPlayer(src) {
    return new BrowserBufferedAudioPlayer(src);
  }
}
