import { LocalStorageCache } from "../../platform/browser/storage/local_storage_cache.js";
import { DevToolsControlBindingRegistry } from "../services/dev_tools_control_binding_registry.js";
import { DraggableButton } from "../../platform/browser/dom/draggable_button.js";
import { UiEventShield } from "../../platform/browser/dom/ui_event_shield.js";

export class DevToolsUI {
  #panel;
  #body;
  #btn;
  #onToggleCallback;
  #tooltipProvider;
  #controlBindings = new DevToolsControlBindingRegistry();
  #dragButton;

  constructor(onToggleCallback, config, tooltipProvider = null) {
    this.#onToggleCallback = onToggleCallback;
    this.#tooltipProvider = tooltipProvider;
    this.#initBtn(config);
    this.#initPanel();
  }

  get body() {
    return this.#body;
  }

  togglePanel(isOpen) {
    if (isOpen) {
      this.#panel.classList.add("devtools--open");
    } else {
      this.#panel.classList.remove("devtools--open");
    }
  }

  dispose() {
    this.#dragButton?.dispose();
    this.#dragButton = null;
    this.#tooltipProvider?.dispose();
    this.#controlBindings.clear();
    this.#btn?.remove();
    this.#panel?.remove();
    this.#btn = null;
    this.#panel = null;
    this.#body = null;
    this.#onToggleCallback = null;
  }

  clearValueBindings() {
    this.#controlBindings.clear();
  }

  syncValue(path, value) {
    this.#controlBindings.sync(path, value);
  }

  createSection(labelStr, parentElement, isExpanded, onToggle, path = null) {
    const section = document.createElement("div");
    section.className = "devtools__section";
    this.#assignDevToolsPath(section, path);

    const title = document.createElement("div");
    title.className = "devtools__section-title";
    this.#assignDevToolsPath(title, path);
    title.innerHTML = `<span>${isExpanded ? "▼" : "▶"}</span> ${labelStr}`;

    const content = document.createElement("div");
    content.className = "devtools__section-content";
    this.#assignDevToolsPath(content, path);
    content.style.display = isExpanded ? "block" : "none";

    title.addEventListener("click", () => {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      title.innerHTML = `<span>${isHidden ? "▼" : "▶"}</span> ${labelStr}`;
      if (onToggle) onToggle(isHidden);
    });

    section.appendChild(title);
    section.appendChild(content);
    parentElement.appendChild(section);

    return content;
  }

  createInfoRow(labelStr, value, parentElement, path = null) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(labelStr, path));
    const valueEl = document.createElement("div");
    valueEl.className = "devtools__value";
    valueEl.innerText = value;
    row.appendChild(valueEl);
    parentElement.appendChild(row);
  }

  createButtonRow(labelStr, parentElement, onClickCallback) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    const btn = document.createElement("button");
    btn.className = "devtools__action";
    btn.innerText = labelStr;
    btn.addEventListener("click", onClickCallback);
    row.appendChild(btn);
    parentElement.appendChild(row);
  }

  createSwitcherRow(
    labelStr,
    initialValue,
    parentElement,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(labelStr, path);
    row.appendChild(label);

    const inputElement = document.createElement("label");
    inputElement.className = "devtools__switch";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = initialValue;

    const slider = document.createElement("span");
    slider.className = "devtools__slider";

    inputElement.appendChild(cb);
    inputElement.appendChild(slider);
    row.appendChild(inputElement);

    cb.addEventListener("change", (e) => onChangeCallback(e.target.checked));
    this.#controlBindings.register(bindingPath, (value) => {
      cb.checked = value === true;
    });
    parentElement.appendChild(row);
  }

  createInputRow(
    key,
    val,
    parentElement,
    type,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(key, path);
    row.appendChild(label);

    let inputElement;

    if (type === "number") {
      inputElement = document.createElement("input");
      inputElement.type = "number";
      inputElement.step = "any";
      inputElement.className = "devtools__input devtools__input--number";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) =>
        onChangeCallback(parseFloat(e.target.value) || 0),
      );
    } else {
      inputElement = document.createElement("input");
      inputElement.type = "text";
      inputElement.className = "devtools__input devtools__input--text";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) => {
        let newVal = e.target.value;
        if (type === "array") {
          newVal = newVal.split(",").map((n) => parseFloat(n.trim()) || 0);
        }
        onChangeCallback(newVal);
      });
    }

    this.#controlBindings.register(bindingPath, (value) => {
      inputElement.value = Array.isArray(value) ? value.join(", ") : value;
    });
    row.appendChild(inputElement);
    parentElement.appendChild(row);
  }

  createEnumToggleRow(
    key,
    optionsArray,
    currentValue,
    parentElement,
    onChangeCallback,
    path = null,
    bindingPath = path,
  ) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(key, path);
    row.appendChild(label);

    const btn = document.createElement("button");
    btn.className = "devtools__enum";
    btn.innerText = currentValue;

    btn.addEventListener("click", () => {
      let currentIndex = optionsArray.indexOf(btn.innerText);
      let nextIndex = (currentIndex + 1) % optionsArray.length;
      let newVal = optionsArray[nextIndex];
      btn.innerText = newVal;
      onChangeCallback(newVal);
    });
    this.#controlBindings.register(bindingPath, (value) => {
      btn.innerText = String(value);
    });

    row.appendChild(btn);
    parentElement.appendChild(row);
  }

  #createLabelElement(rawLabel, path = null) {
    const labelText = String(rawLabel);
    const cleanLabelText = labelText.replace(/\s+\*$/u, "");
    const label = document.createElement("div");
    label.className = "devtools__label";
    this.#assignDevToolsPath(label, path);
    label.dataset.devtoolsKey = cleanLabelText;
    label.innerText = this.#formatLabelText(labelText);
    const tooltip = this.#getParameterTooltip(cleanLabelText);
    const pathText = this.#normalizeDevToolsPath(path);
    if (tooltip || pathText || labelText.length > 15) {
      label.title = [pathText, tooltip || labelText].filter(Boolean).join("\n");
    }
    return label;
  }

  #assignDevToolsPath(element, path) {
    const normalized = this.#normalizeDevToolsPath(path);
    if (normalized) element.dataset.devtoolsPath = normalized;
  }

  #normalizeDevToolsPath(path) {
    if (!path) return "";
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path);
  }

  #formatLabelText(labelText) {
    return labelText.length > 15 ? `${labelText.slice(0, 15)}...` : labelText;
  }

  #getParameterTooltip(labelText) {
    return this.#tooltipProvider?.getTooltip(labelText) || "";
  }

  #initBtn(config) {
    this.#btn = document.createElement("button");
    this.#btn.innerHTML = "⚙️";
    this.#btn.className = "devtools__toggle";

    UiEventShield.makeSolid(this.#btn);

    this.#dragButton = new DraggableButton(this.#btn, this.#onToggleCallback, config, {
      id: "devtools_btn",
      cache: LocalStorageCache,
      noTransform: true,
    });

    document.body.appendChild(this.#btn);
  }

  #initPanel() {
    this.#panel = document.createElement("div");
    this.#panel.className = "devtools";

    this.#panel.innerHTML = `
            <div class="devtools__header">
                <h2>⚙️ DEV TOOLS</h2>
                <button class="devtools__close">×</button>
            </div>
            <div class="devtools__body"></div>
        `;

    document.body.appendChild(this.#panel);
    this.#body = this.#panel.querySelector(".devtools__body");

    UiEventShield.makeSolid(this.#panel);

    this.#panel
      .querySelector(".devtools__close")
      .addEventListener("click", this.#onToggleCallback);
  }
}
