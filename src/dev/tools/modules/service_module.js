// «Сервіс» (spec 174 B3, moved from DevTools): the session's config overrides (count, reset, export, import,
// validation) and the asset load plan's DEV edits (spec 157 D6).
// The browser's prompt/alert dialogs stay until stage C5 replaces them with the panel's own text dialog.
export class ServiceModule {
  #configRuntime;
  #configValidation;
  #assetLoadPlanStore;
  #redraw;
  #windowRef;
  #logger;

  // redraw(): DevTools draws the panel again (after an import or a reset every value may differ).
  constructor({ configRuntime = null, configValidation = null, assetLoadPlanStore = null,
    redraw, windowRef, logger = console }) {
    this.#configRuntime = configRuntime;
    this.#configValidation = configValidation;
    this.#assetLoadPlanStore = assetLoadPlanStore;
    this.#redraw = redraw;
    this.#windowRef = windowRef;
    this.#logger = logger;
  }

  mount(host, context) {
    const service = context.createSection("Сервіс", host, ["DEV_SERVICE"], { icon: "wrench" });
    this.#renderOverrides(service, context);
    this.#renderAssetLoadPlan(service, context);
  }

  #renderOverrides(parent, { ui, createSection, edits }) {
    const content = createSection("RUNTIME OVERRIDES", parent, ["CONFIG_OVERRIDES"], { icon: "stack" });
    const count = this.#configRuntime?.overrideStore?.entries().length || 0;
    ui.createInfoRow("active overrides", String(count), content);
    ui.createButtonRow("Reset all overrides", content, () => {
      edits.resetAll();
      this.#redraw();
      this.#configValidation?.report("reset all overrides");
    });
    ui.createButtonRow("Export overrides", content, () => {
      const json = JSON.stringify(this.#configRuntime?.exportOverrides() || {}, null, 2);
      this.#logger.log("[DevTools] Runtime overrides export:", json);
      this.#copy(json);
      this.#windowRef.prompt?.("Copy runtime overrides JSON", json);
    });
    ui.createButtonRow("Import overrides", content, () => {
      const json = this.#windowRef.prompt?.("Paste runtime overrides JSON", "{}");
      if (!json) return;
      try {
        edits.importOverrides(JSON.parse(json));
        this.#redraw();
        this.#configValidation?.report("import overrides");
      } catch (error) {
        this.#logger.warn("[DevTools] Failed to import runtime overrides", error);
      }
    });
    if (this.#configValidation) {
      ui.createButtonRow("Validate config", content, () => this.#configValidation.report("manual check"));
    }
  }

  // Spec 157 D6 (TK-177 item 8): the plan exported as its module text, an edited plan (JSON) validated and kept for the
  // next start, and a reset to the configured plan.
  #renderAssetLoadPlan(parent, { ui, createSection }) {
    const store = this.#assetLoadPlanStore;
    if (!store) return;
    const content = createSection(store.isEdited() ? "ПЛАН ЗАВАНТАЖЕННЯ (змінено)" : "ПЛАН ЗАВАНТАЖЕННЯ", parent,
      ["DEV_SERVICE", "ASSET_LOAD_PLAN"]);
    ui.createButtonRow("Експорт плану", content, () => {
      const text = store.exportText();
      this.#copy(text);
      this.#windowRef.prompt?.("Текст для src/game/config/raw/assets/asset_load_plan.js", text);
    });
    ui.createButtonRow("Змінити план (з наступного старту)", content, () => {
      const json = this.#windowRef.prompt?.("JSON плану завантаження", JSON.stringify(store.plan()));
      if (!json) return;
      let errors;
      try {
        errors = store.save(JSON.parse(json));
      } catch (error) {
        errors = [error.message];
      }
      if (errors.length > 0) this.#windowRef.alert?.(`План не збережено:\n${errors.join("\n")}`);
      else this.#windowRef.alert?.("План збережено: діє з наступного старту.");
    });
    ui.createButtonRow("Скинути план до конфігу", content, () => {
      store.reset();
      this.#windowRef.alert?.("Скинуто: з наступного старту діє план із конфігу.");
    });
  }

  #copy(text) {
    this.#windowRef.navigator?.clipboard?.writeText?.(text).catch(() => {});
  }

}
