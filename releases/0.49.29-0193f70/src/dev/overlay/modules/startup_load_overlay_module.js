import { OverlayModule } from "../overlay_module.js";
import { STARTUP_RESOURCE_KINDS, StartupLoadReport } from "../../diagnostics/startup_load_report.js";

const MEBIBYTE = 1048576;
const STAGE_LABELS = Object.freeze({
  entry: "модулі завантажено (entry)",
  config: "конфігурація",
  location: "локація",
  inventory: "інвентар",
  scene: "сцена готова",
  composition: "композиція",
  loop: "цикл гри",
  ready: "перший кадр (T-play)",
});
const KIND_LABELS = Object.freeze({
  document: "HTML", modules: "модулі", styles: "стилі", images: "картинки", audio: "аудіо", vendor: "вендор",
  data: "дані", other: "інше",
});
const STATUS_LABELS = Object.freeze({
  copied: () => "Звіт скопійовано в буфер.",
  prompted: () => "Буфер недоступний: звіт у вікні для копіювання.",
  copyFailed: () => "Не вдалося скопіювати звіт.",
  saved: (fileName) => `Звіт збережено у файл ${fileName}.`,
  saveFailed: () => "Не вдалося зберегти файл звіту.",
});
const COPY_PROMPT_TITLE = "Звіт завантаження";
export const STARTUP_REPORT_COPY_CONTROL = "startup-report-copy";
export const STARTUP_REPORT_DOWNLOAD_CONTROL = "startup-report-download";

// DEV overlay "⏱ ЗАВАНТАЖЕННЯ" (spec 157 R9): the startup stages and T-paint/T-play, requests and bytes by kind up to
// T-play (transferred = compressed over the network, then uncompressed), the sequential network steps, the 10 largest
// and 10 longest requests, "Копіювати звіт" and "Завантажити JSON" (the JSON report for the owner's phone, to the
// clipboard or as a file, TK-168). The report is rebuilt only when a timing entry was added. The preloader queue joins it with the preloader facade (spec 157 stage D).
export class StartupLoadOverlayModule extends OverlayModule {
  #reader;
  #copyText;
  #saveFile;
  #now;
  #gameVersion;
  #revision = null;
  #report = null;
  #status = null;
  #savedFileName = "";

  constructor(options = {}) {
    super("startup", options);
    if (!["read", "revision", "environment"].every((method) => typeof options.reader?.[method] === "function")) {
      throw new TypeError("StartupLoadOverlayModule requires reader");
    }
    for (const port of ["copyText", "saveFile", "now"]) {
      if (typeof options[port] !== "function") throw new TypeError(`StartupLoadOverlayModule requires ${port}`);
    }
    this.#reader = options.reader;
    this.#copyText = options.copyText;
    this.#saveFile = options.saveFile;
    this.#now = options.now;
    this.#gameVersion = String(options.gameVersion ?? "");
  }

  render() {
    const report = this.#currentReport();
    const ms = (value) => value === null ? "—" : `${Math.round(value)} мс`;
    let html = this.formatHeader("⏱ ЗАВАНТАЖЕННЯ", "#7fd1ff");
    html += this.metricRow("T-paint (перша відмальовка)", ms(report.paintMs), { metricKey: "startup.paint",
      color: report.paintMs !== null && report.paintMs <= 1000 ? "#00ff80" : "#ffaa00" });
    html += this.metricRow("T-play (гра готова)", report.playMs === null ? "гра ще не готова" : ms(report.playMs),
      { metricKey: "startup.play", color: report.playMs !== null && report.playMs <= 4000 ? "#00ff80" : "#ff4444" });
    html += this.#caption("Етапи, від початку / крок:");
    for (const stage of report.stages) {
      html += this.metricRow(STAGE_LABELS[stage.stage] ?? stage.stage, `${ms(stage.atMs)} / +${ms(stage.sinceMs)}`,
        { metricKey: `startup.stage.${stage.stage}` });
    }
    const totals = report.beforePlay;
    html += this.#caption(report.playMs === null ? "Запити досі:" : "Запити до T-play:");
    html += this.metricRow("усього", `${totals.count} (з кешу ${totals.cached}) · передано ${this.#mb(totals.transferred)}`
      + ` · без стиснення ${this.#mb(totals.decoded)}`, { metricKey: "startup.requests" });
    for (const kind of ["document", ...STARTUP_RESOURCE_KINDS]) {
      const bucket = totals.byKind[kind];
      if (!bucket || bucket.count === 0) continue;
      html += this.metricRow(`  ${KIND_LABELS[kind]}`, `${bucket.count} · ${this.#mb(bucket.transferred)} / ${
        this.#mb(bucket.decoded)}${bucket.cached ? ` · кеш ${bucket.cached}` : ""}`, { metricKey: `startup.kind.${kind}` });
    }
    // Waves: a request that started only after another one had finished is one step later (time order; browsers do
    // not tell the page which request initiated another, so this is an upper bound of the import depth).
    html += this.metricRow("хвиль запитів (послідовно)", `${report.networkSteps} (з них модулів ${report.moduleSteps})`,
      { metricKey: "startup.steps", color: report.networkSteps <= 3 ? "#00ff80" : "#ffaa00" });
    if (report.all.count > totals.count) {
      html += this.metricRow("після T-play", `${report.all.count - totals.count} запитів · ${
        this.#mb(report.all.transferred - totals.transferred)}`, { metricKey: "startup.after" });
    }
    html += this.#caption("10 найбільших (стиснуто / без стиснення):");
    for (const request of report.largest) {
      html += this.metricRow(this.#shortName(request.url), `${this.#kb(request.encoded)} / ${this.#kb(request.decoded)}`,
        { metricKey: `startup.largest.${request.url}` });
    }
    html += this.#caption("10 найдовших:");
    for (const request of report.longest) {
      html += this.metricRow(this.#shortName(request.url), ms(request.durationMs), { metricKey: `startup.longest.${request.url}` });
    }
    const button = (control, label) => `<button type="button" class="debug-overlay__tab" data-overlay-control="${control}"`
      + ` data-overlay-activate="release">${label}</button>`;
    html += `<div class="debug-overlay__tabs" role="group" aria-label="Звіт завантаження">${
      button(STARTUP_REPORT_COPY_CONTROL, "Копіювати звіт")}${button(STARTUP_REPORT_DOWNLOAD_CONTROL, "Завантажити JSON")}</div>`;
    if (this.#status) {
      html += `<div class="debug-overlay__note debug-overlay__text debug-overlay__text--muted">${
        this.escapeAttr(STATUS_LABELS[this.#status](this.#savedFileName))}</div>`;
    }
    return `${html}<div class="debug-overlay__spacer"></div>`;
  }

  // The full report as JSON, with the device facts, for the owner to send from a phone.
  reportText() {
    const report = this.#currentReport();
    return JSON.stringify({ version: this.#gameVersion, environment: this.#reader.environment(), ...report }, null, 2);
  }

  async copyReport() {
    try {
      this.#status = await this.#copyText(this.reportText(), COPY_PROMPT_TITLE);
    } catch {
      this.#status = "copyFailed";
    }
    return this.#status;
  }

  // Saves the same report as cyber-fishing-startup-<version>-<local date>_<time>.json (TK-168).
  async downloadReport() {
    const fileName = this.reportFileName();
    try {
      await this.#saveFile(this.reportText(), fileName);
      this.#status = "saved";
      this.#savedFileName = fileName;
    } catch {
      this.#status = "saveFailed";
    }
    return this.#status;
  }

  reportFileName() {
    const date = new Date(this.#now());
    const two = (value) => String(value).padStart(2, "0");
    const stamp = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}_${two(date.getHours())}-${
      two(date.getMinutes())}-${two(date.getSeconds())}`;
    return `cyber-fishing-startup-${this.#gameVersion || "dev"}-${stamp}.json`;
  }

  #currentReport() {
    const revision = this.#reader.revision();
    if (this.#report === null || revision !== this.#revision) {
      this.#report = StartupLoadReport.build(this.#reader.read());
      this.#revision = revision;
    }
    return this.#report;
  }

  #caption(text) {
    return `<div class="debug-overlay__caption debug-overlay__text debug-overlay__text--muted">${this.escapeAttr(text)}</div>`;
  }

  #mb(bytes) {
    return `${(bytes / MEBIBYTE).toFixed(2)} МБ`;
  }

  #kb(bytes) {
    return `${Math.round(bytes / 1024)} КБ`;
  }

  // The path inside the release (or the site), without the origin and the release directory.
  #shortName(url) {
    const path = String(url).replace(/^[a-z]+:\/\/[^/]+/iu, "").split(/[?#]/u)[0];
    return path.replace(/^.*\/releases\/[^/]+\//u, "").replace(/^\//u, "");
  }
}
