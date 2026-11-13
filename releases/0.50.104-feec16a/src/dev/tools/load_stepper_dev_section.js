// DevTools «⏯ ПОКРОКОВЕ ЗАВАНТАЖЕННЯ» (spec 167, TK-251): the mode switch (from the next start), a restart (reloads the
// page: the only way back), and while the mode is on the plan's steps: the next step, "Далі ▶", "the whole layer",
// "everything", a jump to a layer, and the files of the last loaded and the next step with their state in the image
// store (full / low copy / not loaded). The game draws whatever has loaded, as in normal play. Buttons only (the owner
// steps through on the phone too); the section re-renders on every change of the gate.
const STEP_STATE_LABELS = Object.freeze({ waiting: "чекає", released: "дозволено", loading: "іде", done: "готово" });
const FILE_STATE_LABELS = Object.freeze({ full: "повний", low: "low-копія", none: "не завантажено" });
const OUTSIDE_PLAN = "на вимогу (вікна, статика без Spine), експорт Spine вудки й кораблика, арт селектора й ярликів, "
  + "картинки з HTML/CSS — вантажаться одразу, як у грі";

export class LoadStepperDevSection {
  #ui;
  #settings;
  #getGate;
  #readStatus;
  #restart;
  #createSection;
  #content = null;
  #subscribed = false;

  // settings: DevLoadStepperSettings; getGate(): AssetLoadGate or null (mode off); readStatus(): the composition's
  // getAssetLoadStatus(); restart(): reloads the page; createSection(label, parent, path) comes from DevTools.
  constructor({ settings, getGate, readStatus, restart, createSection }) {
    this.#settings = settings;
    this.#getGate = getGate;
    this.#readStatus = readStatus;
    this.#restart = restart;
    this.#createSection = createSection;
  }

  // ui: DevToolsUI (DevTools creates it after its sections' ports).
  render(parent, ui) {
    this.#ui = ui;
    this.#content = this.#createSection("⏯ ПОКРОКОВЕ ЗАВАНТАЖЕННЯ", parent, ["LOAD_STEPPER"]);
    const gate = this.#getGate();
    if (gate && !this.#subscribed) {
      this.#subscribed = true;
      gate.subscribe(() => { if (this.#content?.isConnected) this.#render(); });
    }
    this.#render();
  }

  #render() {
    const content = this.#content;
    content.replaceChildren();
    const ui = this.#ui;
    ui.createSwitcherRow("Покроковий режим (з наступного старту)", this.#settings.isEnabled(), content,
      (enabled) => this.#settings.setEnabled(enabled), ["LOAD_STEPPER", "enabled"]);
    ui.createButtonRow("↻ Почати спочатку (оновити сторінку)", content, () => this.#restart());
    const gate = this.#getGate();
    if (!gate) {
      ui.createTextRow("стан", this.#settings.isEnabled() ? "увімкнеться після оновлення сторінки" : "вимкнено", content);
      return;
    }
    const { steps, nextIndex, total } = gate.getSnapshot();
    const next = steps[nextIndex] ?? null;
    ui.createTextRow("кроків завантажено", `${nextIndex} / ${total}`, content);
    ui.createTextRow("наступний", next ? next.label : "усе завантажено", content);
    if (next) {
      ui.createButtonRow("Далі ▶", content, () => gate.next());
      ui.createButtonRow(`Завантажити весь шар (${next.layerLabel})`, content, () => gate.releaseLayer());
      ui.createButtonRow("Завантажити все", content, () => gate.releaseAll());
    }
    const layers = this.#createSection("Шари (перейти до початку)", content, ["LOAD_STEPPER", "LAYERS"]);
    for (const layerId of [...new Set(steps.map((step) => step.layerId))]) {
      const layerSteps = steps.filter((step) => step.layerId === layerId);
      const passed = layerSteps.every((step) => step.index < nextIndex);
      ui.createButtonRow(`${passed ? "✓" : "→"} ${layerSteps[0].layerLabel} (${layerSteps.length} кр.)`, layers,
        () => gate.jumpToLayer(layerId));
    }
    const status = this.#readStatus();
    const last = steps[nextIndex - 1] ?? null;
    if (last) this.#renderStep("Останній дозволений крок", last, status, content);
    if (next) this.#renderStep("Наступний крок (ще не вантажиться)", next, status, content);
    ui.createTextRow("поза кроками", OUTSIDE_PLAN, content);
  }

  #renderStep(title, step, status, parent) {
    const section = this.#createSection(title, parent, ["LOAD_STEPPER", title]);
    const ui = this.#ui;
    const time = step.ms !== null ? ` · ${Math.round(step.ms)} мс` : "";
    ui.createTextRow(`${step.index + 1}. ${step.label}`, `${STEP_STATE_LABELS[step.state]}${time}`, section);
    const groups = (status?.layers ?? []).flatMap((layer) => layer.groups).filter((group) => step.groupIds.includes(group.id));
    for (const group of groups) {
      if (group.modules?.length > 0) ui.createTextRow(`  ${group.label}`, `код: ${group.modules.join(", ")}`, section);
      if (group.files.length === 0 && !(group.modules?.length > 0)) ui.createTextRow(`  ${group.label}`, "файлів немає", section);
      for (const file of group.files) {
        const kb = `${Math.round((file.bytes || 0) / 1024)} КБ`;
        const state = file.kind === "image" ? FILE_STATE_LABELS[file.state] ?? file.state : `${file.kind}: через кеш`;
        ui.createTextRow(`  ${String(file.path).split("/").pop()}`, `${state} · ${kb}`, section);
      }
    }
  }
}
