// Spec 172 D2 (TK-270): what the water's glints show this frame, written into GameRenderFrame world.glints.
// The modes follow the same blend as the time-of-day backgrounds (backgroundTimeBlend: the evening picture covers both
// sunrise, 5–9 h, and sunset, 17–21 h; the night picture the moon's hours):
// - day sparkles over all the water: 1 − evening;
// - the sun's path: evening × (1 − night), from the sunrise point before noon and the sunset point after it (owner, Q5);
// - the moon's path: night.
// The sun's and moon's x are shares of the location's background width (MAP_DB.<id>.sky; spec 172 Q3: until the Spine
// sky provides its points), turned into screen x with the background's position and width. The weather's cloud and fog
// come from the weather model; the scene's renderer dims the glints with them.
const DEFAULT_SKY = Object.freeze({ sunriseX: 0.3, sunsetX: 0.7, moonX: 0.5 });

const share = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};

export class WaterGlintModelBuilder {
  #getSky;
  #getTimeOfDay;
  #getWeather;

  // getSky: () => MAP_DB.<id>.sky or null; getTimeOfDay: () => hours 0…24; getWeather: () => the weather snapshot
  // ({ cloud, fog }) or null.
  constructor({ getSky, getTimeOfDay, getWeather }) {
    if (typeof getSky !== "function" || typeof getTimeOfDay !== "function" || typeof getWeather !== "function") {
      throw new TypeError("WaterGlintModelBuilder requires getSky, getTimeOfDay and getWeather");
    }
    this.#getSky = getSky;
    this.#getTimeOfDay = getTimeOfDay;
    this.#getWeather = getWeather;
  }

  // target: world.glints; eveningOpacity / nightOpacity: the background's blend; backgroundX / backgroundWidth: the
  // background's screen left edge and width.
  buildInto(target, eveningOpacity, nightOpacity, backgroundX, backgroundWidth) {
    const evening = share(eveningOpacity, 0);
    const night = share(nightOpacity, 0);
    target.day = 1 - evening;
    target.sunPath = evening * (1 - night);
    target.moonPath = night;
    const sky = this.#getSky() || DEFAULT_SKY;
    const hours = Number(this.#getTimeOfDay());
    const sunShare = Number.isFinite(hours) && hours < 12
      ? share(sky.sunriseX, DEFAULT_SKY.sunriseX) : share(sky.sunsetX, DEFAULT_SKY.sunsetX);
    target.sunX = backgroundX + sunShare * backgroundWidth;
    target.moonX = backgroundX + share(sky.moonX, DEFAULT_SKY.moonX) * backgroundWidth;
    const weather = this.#getWeather();
    target.cloud = share(weather?.cloud, 0);
    target.fog = share(weather?.fog, 0);
  }
}
