// «Сервіс» (spec 174 B3, moved from DevTools): the session's config overrides (count, reset, export, import,
// validation) and the asset load plan's DEV edits (spec 157 D6). Spec 174 C5: texts go through the panel's own text
// dialog (copy, download, open a file) and results through its result line, not the browser's prompt and alert.
export class ServiceModule {
  #configRuntime;
  #configValidation;
  #assetLoadPlanStore;
  #redraw;
  #files;
  #gameVersion;
  #now;
  #logger;

  // redraw(): DevTools draws the panel again (after an import or a reset every value may differ); files: the browser
  // file port ({ download(name, text), pickFile() }) or null.
  constructor({ configRuntime = null, configValidation = null, assetLoadPlanStore = null, redraw, files = null,
    gameVersion = "", now = () => new Date(), logger = console }) {
    this.#configRuntime = configRuntime;
    this.#configValidation = configValidation;
    this.#assetLoadPlanStore = assetLoadPlanStore;
    this.#redraw = redraw;
    this.#files = files;
    this.#gameVersion = gameVersion;
    this.#now = now;
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
      ui.notify("Усі перевизначення скинуто: значення з коду.");
    });
    ui.createButtonRow("Export overrides", content, () => {
      const json = JSON.stringify(this.#configRuntime?.exportOverrides() || {}, null, 2);
      this.#logger.log("[DevTools] Runtime overrides export:", json);
      ui.openTextDialog({ title: "Перевизначення (JSON)", text: json, readOnly: true,
        actions: this.#exportActions(ui, json, `overrides-v${this.#gameVersion}-${this.#stamp()}.json`) });
    }, false, "", null, { icon: "download" });
    ui.createButtonRow("Import overrides", content, () => {
      ui.openTextDialog({ title: "Імпорт перевизначень (JSON)", text: "{}", actions: [
        ...this.#openFileAction(),
        { label: "Застосувати", primary: true, run: (dialog) => {
          let overrides;
          try {
            overrides = JSON.parse(dialog.value);
          } catch (error) {
            dialog.setMessage(`Це не JSON: ${error.message}`, { error: true });
            return;
          }
          try {
            edits.importOverrides(overrides);
          } catch (error) {
            this.#logger.warn("[DevTools] Failed to import runtime overrides", error);
            dialog.setMessage(`Не застосовано: ${error.message}`, { error: true });
            return;
          }
          dialog.close();
          this.#redraw();
          this.#configValidation?.report("import overrides");
          ui.notify("Перевизначення застосовано.");
        } },
      ] });
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
      ui.openTextDialog({ title: "Текст для src/game/config/raw/assets/asset_load_plan.js", text, readOnly: true,
        actions: this.#exportActions(ui, text, "asset_load_plan.js") });
    }, false, "", null, { icon: "download" });
    ui.createButtonRow("Змінити план (з наступного старту)", content, () => {
      ui.openTextDialog({ title: "JSON плану завантаження", text: JSON.stringify(store.plan(), null, 2), actions: [
        ...this.#openFileAction(),
        { label: "Зберегти", primary: true, run: (dialog) => {
          let errors;
          try {
            errors = store.save(JSON.parse(dialog.value));
          } catch (error) {
            errors = [error.message];
          }
          if (errors.length > 0) {
            dialog.setMessage(`План не збережено:\n${errors.join("\n")}`, { error: true });
            return;
          }
          dialog.close();
          this.#redraw();
          ui.notify("План збережено: діє з наступного старту.");
        } },
      ] });
    });
    ui.createButtonRow("Скинути план до конфігу", content, () => {
      store.reset();
      this.#redraw();
      ui.notify("Скинуто: з наступного старту діє план із конфігу.");
    });
  }

  // Copy (with a message when the page has no clipboard) and, with the file port, download as a file.
  #exportActions(ui, text, fileName) {
    const actions = [{ label: "Копіювати", icon: "copy", run: async (dialog) => {
      const copied = await ui.copyText(text);
      dialog.setMessage(copied ? "Скопійовано." : "Буфер обміну недоступний: виділіть текст і скопіюйте вручну.",
        { error: !copied });
      if (!copied) dialog.focus();
    } }];
    if (this.#files) {
      actions.push({ label: "Завантажити файл", icon: "download", primary: true, run: (dialog) => {
        this.#files.download(fileName, text);
        dialog.setMessage(`Файл завантажено: ${fileName}`);
      } });
    }
    return actions;
  }

  #openFileAction() {
    if (!this.#files) return [];
    return [{ label: "Відкрити файл", run: async (dialog) => {
      const text = await this.#files.pickFile();
      if (text !== null) dialog.setValue(text);
    } }];
  }

  // The file name's time in the machine's local time: yyyymmdd-hhmm.
  #stamp() {
    const date = this.#now();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }
}
