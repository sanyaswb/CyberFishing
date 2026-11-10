import { OverlayModule } from "../overlay_module.js";
import { STARTUP_BUDGET, STARTUP_RESOURCE_KINDS, StartupLoadReport } from "../../diagnostics/startup_load_report.js";

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
  "full-load": "повне завантаження (T-full)",
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
const GROUP_STATUS_LABELS = Object.freeze({
  waiting: "чекає", loading: "іде", ready: "готово", failed: "помилка", locked: "закрите", "on-demand": "на вимогу",
});
// A group's files are listed one per row up to this many; larger groups show their count only.
const LISTED_FILES = 16;
// TK-251.2: a step's requests listed one per row up to this many, then their count.
const LISTED_STEP_REQUESTS = 40;
const STEP_STATE_LABELS = Object.freeze({ waiting: "чекає", released: "дозволено", loading: "іде", done: "готово" });
const FILE_STATE_LABELS = Object.freeze({ full: "повний", low: "low-копія", none: "не завантажено" });
export const STARTUP_REPORT_COPY_CONTROL = "startup-report-copy";
export const STARTUP_REPORT_DOWNLOAD_CONTROL = "startup-report-download";

// DEV overlay "⏱ ЗАВАНТАЖЕННЯ" (spec 157 R9): the startup stages and T-paint/T-play, requests and bytes by kind up to
// T-play (transferred = compressed over the network, then uncompressed), the sequential network steps, the 10 largest
// and 10 longest requests, "Копіювати звіт" and "Завантажити JSON" (the JSON report for the owner's phone, to the
// clipboard or as a file, TK-168). The report is rebuilt only when a timing entry was added. Spec 157 D6: the asset
// load plan's layers -> groups -> files (state, time, compressed size) and the registry's duplicate contents, read
// through readAssetLoadStatus() (the composition's getAssetLoadStatus; null before the game is composed).
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
  #readAssetLoadStatus;
  #stepWindow = null;

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
    this.#readAssetLoadStatus = typeof options.readAssetLoadStatus === "function" ? options.readAssetLoadStatus : () => null;
  }

  render() {
    const report = this.#currentReport();
    const ms = (value) => value === null ? "—" : `${Math.round(value)} мс`;
    let html = this.formatHeader("⏱ ЗАВАНТАЖЕННЯ", "#7fd1ff");
    // TK-251.2: with step-by-step loading on, only what the current step loaded.
    const stepStatus = this.#readAssetLoadStatus();
    if (stepStatus?.stepper) return `${html}${this.#currentStepRows(stepStatus)}${this.#reportControls()}`
      + "<div class=\"debug-overlay__spacer\"></div>";
    html += this.plainRow("T-paint (перша відмальовка)", ms(report.paintMs), { metricKey: "startup.paint",
      color: report.paintMs !== null && report.paintMs <= STARTUP_BUDGET.paintMs ? "#00ff80" : "#ffaa00" });
    html += this.plainRow("T-play (гра готова)", report.playMs === null ? "гра ще не готова" : ms(report.playMs),
      { metricKey: "startup.play", color: report.playMs !== null && report.playMs <= STARTUP_BUDGET.coldPlayMs ? "#00ff80" : "#ff4444" });
    html += this.#fullLoadRow(report.fullMs, ms);
    html += this.#caption("Етапи, від початку / крок:");
    for (const stage of report.stages) {
      html += this.plainRow(STAGE_LABELS[stage.stage] ?? stage.stage, `${ms(stage.atMs)} / +${ms(stage.sinceMs)}`,
        { metricKey: `startup.stage.${stage.stage}` });
    }
    const totals = report.beforePlay;
    html += this.#caption(report.playMs === null ? "Запити досі:" : "Запити до T-play:");
    html += this.plainRow("усього", `${totals.count} (з кешу ${totals.cached}) · передано ${this.#mb(totals.transferred)}`
      + ` · без стиснення ${this.#mb(totals.decoded)}`, { metricKey: "startup.requests" });
    for (const kind of ["document", ...STARTUP_RESOURCE_KINDS]) {
      const bucket = totals.byKind[kind];
      if (!bucket || bucket.count === 0) continue;
      html += this.plainRow(`  ${KIND_LABELS[kind]}`, `${bucket.count} · ${this.#mb(bucket.transferred)} / ${
        this.#mb(bucket.decoded)}${bucket.cached ? ` · кеш ${bucket.cached}` : ""}`, { metricKey: `startup.kind.${kind}` });
    }
    // Waves: a request that started only after another one had finished is one step later (time order; browsers do
    // not tell the page which request initiated another, so this is an upper bound of the import depth).
    html += this.plainRow("хвиль запитів (послідовно)", `${report.networkSteps} (з них модулів ${report.moduleSteps})`,
      { metricKey: "startup.steps", color: report.networkSteps <= STARTUP_BUDGET.networkSteps ? "#00ff80" : "#ffaa00" });
    if (report.all.count > totals.count) {
      html += this.plainRow("після T-play", `${report.all.count - totals.count} запитів · ${
        this.#mb(report.all.transferred - totals.transferred)}`, { metricKey: "startup.after" });
    }
    html += this.#planRows();
    let largestRows = "";
    for (const request of report.largest) {
      largestRows += this.plainRow(this.#shortName(request.url), `${this.#kb(request.encoded)} / ${this.#kb(request.decoded)}`,
        { metricKey: `startup.largest.${request.url}` });
    }
    if (report.largest.length > 0) {
      html += `<details class="debug-overlay__details" id="dev-load-largest"><summary class="debug-overlay__summary">${
        this.#caption("10 найбільших (стиснуто / без стиснення):")}</summary><div class="debug-overlay__details-body">${
        largestRows}</div></details>`;
    }
    let longestRows = "";
    for (const request of report.longest) {
      longestRows += this.plainRow(this.#shortName(request.url), ms(request.durationMs), { metricKey: `startup.longest.${request.url}` });
    }
    if (report.longest.length > 0) {
      html += `<details class="debug-overlay__details" id="dev-load-longest"><summary class="debug-overlay__summary">${
        this.#caption("10 найдовших:")}</summary><div class="debug-overlay__details-body">${
        longestRows}</div></details>`;
    }
    return `${html}${this.#reportControls()}<div class="debug-overlay__spacer"></div>`;
  }

  #reportControls() {
    const button = (control, label) => `<button type="button" class="debug-overlay__tab" data-overlay-control="${control}"`
      + ` data-overlay-activate="release">${label}</button>`;
    let html = `<div class="debug-overlay__tabs" role="group" aria-label="Звіт завантаження">${
      button(STARTUP_REPORT_COPY_CONTROL, "Копіювати звіт")}${button(STARTUP_REPORT_DOWNLOAD_CONTROL, "Завантажити JSON")}</div>`;
    if (this.#status) {
      html += `<div class="debug-overlay__note debug-overlay__text debug-overlay__text--muted">${
        this.escapeAttr(STATUS_LABELS[this.#status](this.#savedFileName))}</div>`;
    }
    return html;
  }

  // TK-251.2: the current step of the step-by-step loading — the steps of the last release, the requests that started
  // since then (each file with its size) and the plan groups of those steps with their files' state.
  #currentStepRows(status) {
    const { steps, nextIndex, total, current } = status.stepper;
    const stepsNow = steps.slice(current.fromIndex, current.toIndex);
    let html = this.plainRow("покрокове завантаження", `${nextIndex} / ${total} · далі: ${steps[nextIndex]?.label ?? "усе"}`,
      { metricKey: "startup.plan.stepper", color: nextIndex < total ? "#ffaa00" : "#00ff80" });
    html += this.#caption(stepsNow.length === 0 ? "Поточний крок: ще нічого не дозволено." : "Поточний крок:");
    for (const step of stepsNow) {
      const time = step.ms !== null ? ` · ${Math.round(step.ms)} мс` : "";
      html += this.plainRow(`  ${step.index + 1}. ${step.label}`, `${STEP_STATE_LABELS[step.state] ?? step.state}${time}`,
        { metricKey: `startup.step.${step.id}` });
    }
    const { requests, totals } = this.#stepRequests(current.sinceMs);
    html += this.#caption("Запити цього кроку:");
    html += this.plainRow("усього", `${totals.count} (з кешу ${totals.cached}) · передано ${this.#mb(totals.transferred)}`
      + ` · без стиснення ${this.#mb(totals.decoded)}`, { metricKey: "startup.step.requests" });
    for (const kind of ["document", ...STARTUP_RESOURCE_KINDS]) {
      const bucket = totals.byKind[kind];
      if (!bucket || bucket.count === 0) continue;
      html += this.plainRow(`  ${KIND_LABELS[kind]}`, `${bucket.count} · ${this.#mb(bucket.transferred)} / ${
        this.#mb(bucket.decoded)}${bucket.cached ? ` · кеш ${bucket.cached}` : ""}`, { metricKey: `startup.step.kind.${kind}` });
    }
    for (const request of requests.slice(0, LISTED_STEP_REQUESTS)) {
      html += this.plainRow(`    ${this.#shortName(request.url)}`, `${this.#kb(request.encoded)} / ${this.#kb(request.decoded)}${
        request.cached ? " · кеш" : ""}`, { metricKey: `startup.step.request.${request.url}` });
    }
    if (requests.length > LISTED_STEP_REQUESTS) {
      html += this.plainRow("    …", `ще ${requests.length - LISTED_STEP_REQUESTS}`, { metricKey: "startup.step.more" });
    }
    const groupIds = new Set(stepsNow.flatMap((step) => step.groupIds));
    const groups = status.layers.flatMap((layer) => layer.groups).filter((group) => groupIds.has(group.id));
    if (groups.length > 0) html += this.#caption("Групи плану цього кроку:");
    for (const group of groups) {
      const content = group.modules?.length > 0 ? `код: ${group.modules.join(", ")}` : `${group.files.length} файлів`;
      html += this.plainRow(`  ${group.label} (пріоритет ${group.priority})`,
        `${GROUP_STATUS_LABELS[group.status] ?? group.status} · ${content}`,
        { metricKey: `startup.step.group.${group.id}`, color: group.status === "failed" ? "#ff4444" : undefined });
      for (const file of group.files) {
        const state = file.kind === "image" ? FILE_STATE_LABELS[file.state] ?? file.state : file.kind;
        html += this.plainRow(`    ${this.#shortName(file.path)}`, `${state} · ${this.#kb(file.bytes || 0)}`,
          { metricKey: `startup.step.file.${group.id}.${file.id}` });
      }
    }
    return html;
  }

  // Rebuilt only when a timing entry was added or the step changed.
  #stepRequests(sinceMs) {
    const revision = this.#reader.revision();
    if (this.#stepWindow === null || this.#stepWindow.revision !== revision || this.#stepWindow.sinceMs !== sinceMs) {
      this.#stepWindow = { revision, sinceMs, ...StartupLoadReport.requestsSince(this.#reader.read(), sinceMs) };
    }
    return this.#stepWindow;
  }

  // The full report as JSON, with the device facts, for the owner to send from a phone.
  reportText() {
    const report = this.#currentReport();
    return JSON.stringify({ version: this.#gameVersion, environment: this.#reader.environment(), ...report,
      assetLoadPlan: this.#readAssetLoadStatus() }, null, 2);
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

  // T-full (TK-214): the time once reached, until then how many of the plan's loading groups have settled. Closed and
  // on-demand groups do not count; a failed group settles, so the row names it.
  #fullLoadRow(fullMs, ms) {
    const groups = (this.#readAssetLoadStatus()?.layers ?? []).flatMap((layer) => layer.groups)
      .filter((group) => group.load !== false && !group.locked);
    const failed = groups.filter((group) => group.status === "failed").length;
    const settled = groups.filter((group) => group.status === "ready").length + failed;
    const value = fullMs !== null ? ms(fullMs) : groups.length > 0 ? `вантажиться: ${settled} / ${groups.length} груп` : "—";
    return this.plainRow("T-full (усе, крім закритого й на вимогу)", failed > 0 ? `${value} · з помилкою: ${failed}` : value,
      { metricKey: "startup.full", color: failed > 0 ? "#ff4444" : undefined });
  }

  // The asset load plan, layer by layer: each group's state, priority, time and size, its files (small groups), then
  // the registry's duplicates (one file's content under two ids).
  #planRows() {
    const status = this.#readAssetLoadStatus();
    if (!status) return "";
    let html = this.#caption("План завантаження (шари → групи → файли):");
    for (const layer of status.layers) {
      let layerBody = "";
      for (const group of layer.groups) {
        const bytes = group.files.reduce((sum, file) => sum + (file.bytes || 0), 0);
        const time = group.settledMs !== null && group.settledMs !== undefined && group.startedMs !== null
          ? ` · ${Math.round(group.settledMs - group.startedMs)} мс` : "";
        const low = group.readyOn === "low" ? ", спершу копії" : "";
        // A feature group (spec 157 R12) loads code modules, named instead of files.
        const content = group.modules?.length > 0 ? `код: ${group.modules.join(", ")}`
          : `${group.files.length} файлів · ${this.#kb(bytes)}`;
        const groupRow = this.plainRow(`  ${group.label} (пріоритет ${group.priority}${low})`,
          `${GROUP_STATUS_LABELS[group.status] ?? group.status} · ${content}${time}`,
          { metricKey: `startup.plan.${layer.id}.${group.id}`, color: group.status === "failed" ? "#ff4444" : undefined });
        if (group.files.length > 0 && group.files.length <= LISTED_FILES) {
          let fileRows = "";
          for (const file of group.files) {
            fileRows += this.plainRow(`    ${this.#shortName(file.path)}`, this.#kb(file.bytes || 0),
              { metricKey: `startup.plan.file.${group.id}.${file.id}` });
          }
          layerBody += `<details class="debug-overlay__details debug-overlay__details--sub" id="dev-load-group-${layer.id}-${group.id}">`
            + `<summary class="debug-overlay__summary">${groupRow}</summary>`
            + `<div class="debug-overlay__details-body">${fileRows}</div></details>`;
        } else {
          layerBody += groupRow;
        }
      }
      const layerRow = this.plainRow(layer.label, layer.started ? "стартував" : "чекає", {
        metricKey: `startup.plan.${layer.id}`,
        color: layer.started ? "#00ff80" : "#ffaa00",
      });
      html += `<details class="debug-overlay__details" id="dev-load-layer-${layer.id}">`
        + `<summary class="debug-overlay__summary">${layerRow}</summary>`
        + `<div class="debug-overlay__details-body">${layerBody}</div></details>`;
    }
    html += this.plainRow("дублікати (однаковий вміст)", status.duplicates.length === 0 ? "немає"
      : status.duplicates.map((ids) => ids.join(" = ")).join("; "), { metricKey: "startup.plan.duplicates",
      color: status.duplicates.length === 0 ? "#00ff80" : "#ffaa00" });
    return html;
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
