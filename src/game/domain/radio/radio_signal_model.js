// Spec 142 stage 4: the radio's reception from the battery's charge and the weather. Above lowChargePercent the battery
// does not affect it; below, the weak share w = 1 - charge / lowChargePercent raises the noise, the crackle and the
// volume sag, and the chance of a dropout grows with w². Rain adds noise and crackle by its intensity (rainMult over
// [1, rainMultMax]). Pure; read() fills one reused reading. Settings: CONFIG.radio.signal.
export class RadioSignalModel {
  #reading = { quality: 1, noiseGain: 0, crackleRate: 0, dropoutChancePerSecond: 0, volumeSag: 0, rain: 0 };

  read({ chargePercent = 100, isRaining = false, rainMult = 1 } = {}, settings = {}) {
    const low = Math.max(1, Number(settings.lowChargePercent) || 25);
    const charge = Math.max(0, Math.min(100, Number(chargePercent) || 0));
    const quality = charge >= low ? 1 : charge / low;
    const weak = 1 - quality;
    const span = Math.max(1e-6, (Number(settings.rainMultMax) || 2.5) - 1);
    const rain = isRaining ? Math.max(0, Math.min(1, ((Number(rainMult) || 1) - 1) / span)) : 0;
    const reading = this.#reading;
    reading.quality = quality;
    reading.rain = rain;
    reading.noiseGain = (Number(settings.baseNoise) || 0) + weak * (Number(settings.maxNoise) || 0)
      + rain * (Number(settings.rainNoise) || 0);
    reading.crackleRate = weak * (Number(settings.maxCrackle) || 0) + rain * (Number(settings.rainCrackle) || 0);
    reading.dropoutChancePerSecond = weak * weak * (Number(settings.dropoutMax) || 0);
    reading.volumeSag = weak * (Number(settings.maxVolumeSag) || 0);
    return reading;
  }
}
