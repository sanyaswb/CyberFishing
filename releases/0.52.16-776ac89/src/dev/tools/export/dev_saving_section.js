// Shared DevTools «Збереження» controller (spec 176): live status vs code, JSON export + apply command notice,
// validated import into session, reset to code and explanatory note.
export class DevSavingSection {
  #ui;
  #files;
  #labels;
  #commandPrefix;
  #useTextStatus;
  #readStatus;
  #buildExport;
  #onImport;
  #onReset;
  #hasReset;
  #host = null;
  #statusEl = null;
  #exportedFile = null;

  constructor({
    ui,
    files = null,
    labels,
    commandPrefix,
    useTextStatus = false,
    readStatus,
    buildExport,
    onImport = null,
    onReset = null,
    hasReset = false,
  }) {
    this.#ui = ui;
    this.#files = files;
    this.#labels = labels;
    this.#commandPrefix = commandPrefix;
    this.#useTextStatus = useTextStatus;
    this.#readStatus = readStatus;
    this.#buildExport = buildExport;
    this.#onImport = onImport;
    this.#onReset = onReset;
    this.#hasReset = hasReset;
  }

  get hasStatusElement() {
    return this.#statusEl !== null;
  }

  render(host) {
    if (!host) return;
    this.#host = host;
    const ui = this.#ui;
    ui.releaseValueBindings?.(host);
    host.replaceChildren();
    const createStatusRow = this.#useTextStatus && ui.createTextRow
      ? ui.createTextRow.bind(ui)
      : ui.createInfoRow.bind(ui);
    this.#statusEl = createStatusRow(this.#labels.statusLabel, "", host);
    this.refreshStatus();
    if (this.#files) {
      ui.createButtonRow(this.#labels.exportLabel, host, () => { void this.exportFile(); });
      if (this.#onImport) {
        ui.createButtonRow(this.#labels.importLabel, host, () => { void this.importFile(); });
      }
    }
    if (this.#hasReset && this.#onReset) {
      ui.createButtonRow(this.#labels.resetLabel, host, () => {
        this.#onReset();
      });
    }
    if (this.#labels.description) {
      ui.createInfoRow(this.#labels.descriptionLabel ?? "Збереження", this.#labels.description, host);
    }
    if (this.#exportedFile) this.#showCommand(host, this.#exportedFile);
  }

  clear() {
    this.#host = null;
    this.#statusEl = null;
  }

  refreshStatus(message = null) {
    if (!this.#statusEl) return;
    this.#statusEl.innerText = message ?? this.#readStatus();
  }

  async exportFile() {
    if (!this.#files) return null;
    try {
      const result = await this.#buildExport((text) => this.#files.hashText(text));
      if (!result) return null;
      const { fileName, data, error } = result;
      if (error) {
        this.refreshStatus(error);
        return null;
      }
      this.#files.download(fileName, `${JSON.stringify(data, null, 2)}\n`);
      this.refreshStatus(`Збережено файл ${fileName}.`);
      if (this.#host) this.#showCommand(this.#host, fileName);
      return fileName;
    } catch (error) {
      this.refreshStatus(`Експорт не вдався: ${error?.message || error}`);
      return null;
    }
  }

  async importFile() {
    if (!this.#files || !this.#onImport) return;
    const text = await this.#files.pickFile();
    if (text === null) return;
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      this.refreshStatus("Файл не є JSON.");
      return;
    }
    this.#onImport(file, (message) => this.refreshStatus(message));
  }

  #showCommand(host, fileName) {
    this.#exportedFile = fileName;
    this.#ui.showExportCommand?.(host, {
      fileName,
      command: `${this.#commandPrefix} -- ${fileName}`,
      onClose: () => { this.#exportedFile = null; },
    });
  }
}
