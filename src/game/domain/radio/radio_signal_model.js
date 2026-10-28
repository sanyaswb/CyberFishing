// Spec 142 stage 4: the radio's reception from the battery's charge and the weather. Above lowChargePercent the battery
// does not affect it; below, the weak share w = 1 - charge / lowChargePercent raises the noise, the crackle and the
// volume sag, and the chance of a dropout grows with w². Rain adds noise and crackle by its intensity (rainMult over
// [1, rainMultMax]). settings.enabled false gives a clean signal. Pure; read() fills one reused reading. Settings:
// CONFIG.radio.signal.
export class RadioSignalModel {
  #reading = { quality: 1, noiseGain: 0, crackleRate: 0, dropoutChancePerSecond: 0, volumeSag: 0, rain: 0 };

  read({ chargePercent = 100, isRaining = false, rainMult = 1 } = {}, settings = {}) {
    // TK-099: interference switched off (DevTools) — a clean signal: no hiss, crackle, dropouts or sag.
    if (settings.enabled === false) {
      Object.assign(this.#reading, { quality: 1, noiseGain: 0, crackleRate: 0, dropoutChancePerSecond: 0, volumeSag: 0, rain: 0 });
      return this.#reading;
    }
    const low = Math.max(1, Number(settings.lowChargePercent) || 25);
    const charge = Math.max(0, Math.min(100, Number(chargePercent) || 0));
    const quality = charge >= low ? 1 : charge / low;
    const weak = 1 - quality;

    const weatherSettings = settings.weather || settings;
    const weatherEnabled = settings.weather ? settings.weather.enabled !== false : true;
    const rainMultMax = Number(weatherSettings.rainMultMax ?? settings.rainMultMax) || 2.5;
    const span = Math.max(1e-6, rainMultMax - 1);
    const rain = (isRaining && weatherEnabled) ? Math.max(0, Math.min(1, ((Number(rainMult) || 1) - 1) / span)) : 0;
    const rainNoise = Number(weatherSettings.rainNoise ?? settings.rainNoise) || 0;
    const rainCrackle = Number(weatherSettings.rainCrackle ?? settings.rainCrackle) || 0;

    const reading = this.#reading;
    reading.quality = quality;
    reading.rain = rain;
    reading.noiseGain = (Number(settings.baseNoise) || 0) + weak * (Number(settings.maxNoise) || 0)
      + rain * rainNoise;
    reading.crackleRate = weak * (Number(settings.maxCrackle) || 0) + rain * rainCrackle;
    reading.dropoutChancePerSecond = weak * weak * (Number(settings.dropoutMax) || 0);
    reading.volumeSag = weak * (Number(settings.maxVolumeSag) || 0);
    return reading;
  }
}
