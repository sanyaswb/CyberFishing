import { OverlayModule } from "../overlay_module.js";

const BUDGET_MS = 1000 / 60;
const BAR_HEIGHT = 36;
const BAR_SCALE_MS = 66;
const SECTION_LABELS = Object.freeze({
  update: "update (логіка)",
  draw: "draw (рендер усього)",
  scene: "  сцена WebGL (Pixi)",
  world: "  фон і світ",
  casting: "  закид",
  fishing: "  риболовля",
  hud: "  HUD",
  outcome: "  результат",
  overlay: "overlay (DEV, поза кадром)",
});

// DEV overlay "⚡ ПРОДУКТИВНІСТЬ" (spec 101): FPS over the last second, and over the profiler's 240 frames the frame
// interval and game-loop CPU work per frame against the
// 16.7 ms budget, the time per section, the freeze bar (one bar per frame: green within budget, orange jank,
// red freeze), long tasks and memory, and the pixel load (canvas backing store, WebGL scene and Spine GL surface).
export class PerformanceOverlayModule extends OverlayModule {
  #profiler;
  #readRenderInfo;

  constructor(options = {}) {
    super("performance", options);
    if (typeof options.profiler?.getSnapshot !== "function") {
      throw new TypeError("PerformanceOverlayModule requires profiler");
    }
    this.#profiler = options.profiler;
    this.#readRenderInfo = options.readRenderInfo ?? (() => null);
  }

  render() {
    const snapshot = this.#profiler.getSnapshot();
    let html = this.formatHeader("⚡ ПРОДУКТИВНІСТЬ", "#ffcc00");
    if (snapshot.frames === 0) return `${html}<div class="debug-overlay__line">Немає кадрів гри.</div>`;
    const ms = (value) => `${value.toFixed(1)} мс`;
    const fpsColor = snapshot.fps >= 55 ? "#00ff80" : snapshot.fps >= 40 ? "#ffaa00" : "#ff4444";
    html += this.metricRow("FPS (1 с)", snapshot.fps.toFixed(0), { color: fpsColor, metricKey: "perf.fps" });
    html += this.metricRow("кадр сер / p95 / макс",
      `${ms(snapshot.interval.mean)} / ${ms(snapshot.interval.p95)} / ${ms(snapshot.interval.max)}`,
      { metricKey: "perf.interval" });
    const share = snapshot.work.mean / BUDGET_MS;
    html += this.metricRow("CPU гри за кадр", `${ms(snapshot.work.mean)} (p95 ${ms(snapshot.work.p95)}) = ${(share * 100).toFixed(0)}% бюджету`,
      { color: share < 0.5 ? "#00ff80" : share < 0.85 ? "#ffaa00" : "#ff4444", metricKey: "perf.cpu" });
    html += this.metricRow("поза CPU гри", `${ms(snapshot.unexplainedMs)} (GPU, компоновка, DOM, інше)`,
      { metricKey: "perf.gap" });
    html += this.metricRow("ривки / фрізи", `${snapshot.janks} / ${snapshot.freezes} за ${snapshot.frames} кадрів`,
      { color: snapshot.freezes > 0 ? "#ff4444" : snapshot.janks > 0 ? "#ffaa00" : "#00ff80", metricKey: "perf.freezes" });
    html += this.#freezeBar(snapshot);
    html += `<div class="debug-overlay__caption debug-overlay__text debug-overlay__text--muted">Час секцій, сер / макс:</div>`;
    for (const [id, label] of Object.entries(SECTION_LABELS)) {
      const stats = snapshot.sections[id];
      if (!stats || stats.max === 0) continue;
      html += this.metricRow(label, `${ms(stats.mean)} / ${ms(stats.max)}`, { metricKey: `perf.section.${id}` });
    }
    const tasks = snapshot.longTasks;
    html += this.metricRow("long tasks (>50 мс)", tasks.observed
      ? `${tasks.count}, макс ${ms(tasks.maxMs)}` : "браузер не повідомляє", { metricKey: "perf.longTasks" });
    const info = this.#readRenderInfo();
    if (info) {
      html += this.metricRow("канвас (backing)", `${info.backingWidth}×${info.backingHeight} @ ${info.pixelRatio}× = ${
        (info.backingWidth * info.backingHeight / 1e6).toFixed(2)} Мпікс`, { metricKey: "perf.canvas" });
      if (info.memoryMb !== null) html += this.metricRow("JS heap", `${info.memoryMb.toFixed(0)} МБ`, { metricKey: "perf.heap" });
    }
    const scenePixels = snapshot.gauges["scene-pixels"];
    if (scenePixels) html += this.metricRow("сцена WebGL (backing)", `${(scenePixels / 1e6).toFixed(2)} Мпікс`, { metricKey: "perf.scene" });
    html += `<div class="debug-overlay__note debug-overlay__text debug-overlay__text--muted">GPU напряму не вимірюється сторінкою: великий «поза CPU гри» при малому CPU вказує на GPU/компоновку.</div>`;
    return `${html}<div class="debug-overlay__spacer"></div>`;
  }

  // One bar per frame interval, scaled to 66 ms; lines at 16.7 ms (60 FPS) and 33.3 ms (30 FPS).
  // TK-393 (spec 186 D3): the bars of one colour are one <path> (a rectangle per bar in its d), so the window holds three
  // elements whatever the number of frames — not 240 <rect> parsed and patched ~7 times a second on the phone this
  // module measures.
  #freezeBar(snapshot) {
    const recent = snapshot.recent;
    const width = Math.max(1, recent.length);
    const y = (valueMs) => BAR_HEIGHT - Math.min(BAR_HEIGHT, (valueMs / BAR_SCALE_MS) * BAR_HEIGHT);
    let calm = "";
    let jank = "";
    let freeze = "";
    for (let index = 0; index < recent.length; index += 1) {
      const value = recent[index];
      const bar = `M${index} ${y(value).toFixed(2)}h0.8V${BAR_HEIGHT}h-0.8Z`;
      if (value > snapshot.thresholds.freezeMs) freeze += bar;
      else if (value > snapshot.thresholds.jankMs) jank += bar;
      else calm += bar;
    }
    const bars = [[calm, "#00cc66"], [jank, "#ffaa00"], [freeze, "#ff4444"]]
      .map(([d, color]) => `<path d="${d}" fill="${color}"/>`).join("");
    const line = (valueMs, color) =>
      `<line x1="0" x2="${width}" y1="${y(valueMs).toFixed(2)}" y2="${y(valueMs).toFixed(2)}" stroke="${color}" stroke-width="0.4"/>`;
    return `<svg viewBox="0 0 ${width} ${BAR_HEIGHT}" width="100%" height="${BAR_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="Інтервали кадрів">${
      bars}${line(BUDGET_MS, "#7fd1ff")}${line(BUDGET_MS * 2, "#ffaa00")}</svg>`;
  }
}
