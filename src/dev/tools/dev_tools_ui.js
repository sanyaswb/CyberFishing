import { DevToolsControlBindingRegistry } from "../services/dev_tools_control_binding_registry.js";
import { DraggableButton } from "../../platform/browser/dom/draggable_button.js";
import { UiEventShield } from "../../platform/browser/dom/ui_event_shield.js";
import { DevToolsEdgeOpener } from "./dev_tools_edge_opener.js";

export class DevToolsUI {
  #panel;
  #body;
  #footer;
  #btn;
  #onToggleCallback;
  #tooltipProvider;
  #controlBindings = new DevToolsControlBindingRegistry();
  #dragButton;
  #storageCache;
  #uiSurface;
  #mountNode;
  #toggleMountNode;
  #descriptions = new WeakMap();
  #treeOrder = new WeakMap();
  #controlGroups = new WeakMap();
  #dependencyFeedback;
  #edgeOpener = null;
  #isOpen = false;

  constructor(onToggleCallback, config, tooltipProvider = null, storageCache = null, uiSurface = null,
    mountNode = uiSurface?.mountRoot || document.body, toggleMountNode = mountNode, dependencyFeedback = null) {
    this.#dependencyFeedback = dependencyFeedback;
    this.#storageCache = storageCache;
    this.#uiSurface = uiSurface;
    this.#mountNode = mountNode;
    this.#toggleMountNode = toggleMountNode;
    this.#onToggleCallback = onToggleCallback;
    this.#tooltipProvider = tooltipProvider;
    this.#initBtn(config);
    // Before the panel, so the open panel paints over the strip (TK-053).
    this.#edgeOpener = new DevToolsEdgeOpener({ documentRef: document, mountNode: this.#mountNode,
      open: () => { if (!this.#isOpen) this.#onToggleCallback?.(); } });
    this.#initPanel();
  }

  get body() {
    return this.#body;
  }

  // The panel's last row, below the scrolling sections (the project version on phones, TK-035).
  get footer() {
    return this.#footer;
  }

  togglePanel(isOpen) {
    this.#isOpen = isOpen === true;
    if (isOpen) {
      this.#panel.classList.add("devtools--open");
    } else {
      this.#dependencyFeedback?.clear();
      this.#panel.classList.remove("devtools--open");
    }
  }

  // A second toggle inside another screen's header (the House screen, spec 084); the returned function removes it.
  mountScreenToggle(mountNode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hud-control hud-control--square";
    button.textContent = "⚙️";
    button.setAttribute("aria-label", "Параметри розробника");
    const onClick = () => this.#onToggleCallback?.();
    button.addEventListener("click", onClick);
    mountNode.appendChild(button);
    return () => { button.removeEventListener("click", onClick); button.remove(); };
  }

  dispose() {
    this.#dependencyFeedback?.dispose();
    this.#edgeOpener?.dispose();
    this.#edgeOpener = null;
    this.#dragButton?.dispose();
    this.#dragButton = null;
    this.#tooltipProvider?.dispose();
    this.#controlBindings.clear();
    this.#btn?.removeEventListener("click", this.#onToggleCallback);
    this.#btn?.remove();
    this.#panel?.remove();
    this.#btn = null;
    this.#panel = null;
    this.#body = null;
    this.#footer = null;
    this.#onToggleCallback = null;
  }

  clearValueBindings() {
    this.#dependencyFeedback?.clear();
    this.#controlBindings.clear();
  }

  syncValue(path, value) {
    this.#controlBindings.sync(path, value);
    if (value === true) this.#dependencyFeedback?.resolve(path);
  }

  releaseValueBindings(container) {
    this.#dependencyFeedback?.releaseWithin(container);
    this.#controlBindings.releaseWithin(container);
    const group = this.#controlGroups.get(container);
    if (group) {
      for (const row of group.infoRows) {
        const content = row.parentNode;
        row.remove();
        if (content && content.children.length === 0) content.parentNode?.remove();
      }
      group.infoRows.length = 0;
    }
  }

  // Independently refreshed controls without another disclosure or layout box.
  createControlGroup(parentElement, path = null) {
    const group = document.createElement("div");
    group.className = "devtools__control-group";
    this.#assignDevToolsPath(group, path);
    this.#controlGroups.set(group, { parent: parentElement, infoRows: [] });
    this.#insertTreeNode(parentElement, group, 0);
    return group;
  }

  createSection(labelStr, parentElement, isExpanded, onToggle, path = null, { buttonTitle = false } = {}) {
    const section = document.createElement("div");
    section.className = "devtools__section";
    this.#assignDevToolsPath(section, path);

    const title = document.createElement("button");
    title.className = buttonTitle ? "devtools__action" : "devtools__section-title";
    title.type = "button";
    title.setAttribute("aria-expanded", String(isExpanded));
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
      title.setAttribute("aria-expanded", String(isHidden));
      if (onToggle) onToggle(isHidden);
    });

    section.appendChild(title);
    section.appendChild(content);
    this.#insertTreeNode(parentElement, section, 1);

    return content;
  }

  createInfoRow(labelStr, value, parentElement, path = null) {
    const group = this.#controlGroups.get(parentElement);
    if (group) parentElement = group.parent;
    let description = this.#descriptions.get(parentElement);
    if (!description || description.content.parentNode?.parentNode !== parentElement) {
      const record = { expanded: description?.expanded || false, content: null };
      record.content = this.createSection("Опис", parentElement, record.expanded,
        expanded => { record.expanded = expanded; });
      this.#treeOrder.set(record.content.parentNode, 2);
      parentElement.appendChild(record.content.parentNode);
      this.#descriptions.set(parentElement, record);
      description = record;
    }
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(labelStr, path));
    const valueEl = document.createElement("div");
    valueEl.className = "devtools__value";
    valueEl.innerText = value;
    row.appendChild(valueEl);
    description.content.appendChild(row);
    group?.infoRows.push(row);
    return valueEl;
  }

  createNavigation(pages, parentElement) {
    const navigation = document.createElement("nav");
    navigation.className = "devtools__pages";
    navigation.setAttribute("aria-label", "Сторінки розробника");
    for (const [label, activate] of pages) this.createButtonRow(label, navigation, activate, true);
    this.#insertTreeNode(parentElement, navigation, 0);
  }

  createButtonRow(labelStr, parentElement, onClickCallback, navigation = false, iconUrl = "") {
    const row = document.createElement("div");
    row.className = navigation ? "devtools__row devtools__row--navigation" : "devtools__row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "devtools__action";
    btn.innerText = labelStr;
    if (iconUrl) {
      const image = document.createElement("img");
      image.className = "devtools__action-image";
      image.src = iconUrl;
      image.alt = "";
      image.draggable = false;
      const label = document.createElement("span");
      label.className = "devtools__action-label";
      label.innerText = labelStr;
      btn.replaceChildren(image, label);
    }
    btn.addEventListener("click", onClickCallback);
    row.appendChild(btn);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // swatch: an optional "#rrggbb" colour square before the label (spec 129: zone category colours).
  createSwitcherRow(
    labelStr,
    initialValue,
    parentElement,
    onChangeCallback,
    path = null,
    bindingPath = path,
    { swatch = null, requires = [] } = {},
  ) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(labelStr, path, swatch);
    row.appendChild(label);

    const inputElement = document.createElement("label");
    inputElement.className = "devtools__switch";

    const cb = document.createElement("input");
    cb.className = "devtools__switch-input";
    cb.type = "checkbox";
    cb.setAttribute("aria-label", labelStr);
    cb.checked = initialValue;

    const slider = document.createElement("span");
    slider.className = "devtools__slider";

    inputElement.appendChild(cb);
    inputElement.appendChild(slider);
    row.appendChild(inputElement);

    let currentValue = initialValue === true;
    cb.addEventListener("change", (e) => {
      const next = e.target.checked;
      const blocker = next ? requires.find(requirement => !requirement.isEnabled()) : null;
      if (blocker) {
        cb.checked = currentValue;
        this.#dependencyFeedback?.show(blocker.path, this.#controlBindings.elements(blocker.path), row);
        return;
      }
      onChangeCallback(next);
      currentValue = next;
      if (next) this.#dependencyFeedback?.resolve(bindingPath);
    });
    this.#controlBindings.register(bindingPath, (value) => {
      currentValue = value === true;
      cb.checked = currentValue;
    }, row);
    this.#insertTreeNode(parentElement, row, 0);
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
    }, row);
    row.appendChild(inputElement);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // A 0..100 slider with its value beside it (spec 129 Revision 2: grid and depth opacity); onChangeCallback receives
  // the whole number while dragging.
  createRangeRow(labelStr, value, parentElement, onChangeCallback, path = null) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(labelStr, path));
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "1";
    range.className = "devtools__range";
    range.setAttribute("aria-label", labelStr);
    range.value = String(Math.round(value));
    const output = document.createElement("span");
    output.className = "devtools__range-value";
    output.textContent = String(Math.round(value));
    range.addEventListener("input", (event) => {
      const next = Number(event.target.value);
      output.textContent = String(next);
      onChangeCallback(next);
    });
    this.#controlBindings.register(path, (next) => {
      range.value = String(Math.round(next));
      output.textContent = String(Math.round(next));
    }, row);
    row.append(range, output);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // A drop-down for long option lists (the Spine bone picker); onChangeCallback receives the chosen value.
  // swatches: an optional { value: "#rrggbb" } map; the colour of the chosen value shows beside the drop-down.
  createSelectRow(labelStr, optionsArray, currentValue, parentElement, onChangeCallback, path = null,
    { swatches = null } = {}) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(labelStr, path));
    const swatch = swatches ? this.#createSwatch(swatches[currentValue]) : null;
    if (swatch) row.appendChild(swatch);
    const select = document.createElement("select");
    select.className = "devtools__input devtools__input--text";
    select.setAttribute("aria-label", labelStr);
    for (const option of optionsArray) {
      const element = document.createElement("option");
      element.value = option;
      element.textContent = option;
      select.appendChild(element);
    }
    select.value = currentValue;
    select.addEventListener("change", (event) => {
      if (swatch) swatch.style.setProperty("--devtools-swatch", swatches[event.target.value] || "transparent");
      onChangeCallback(event.target.value);
    });
    row.appendChild(select);
    this.#insertTreeNode(parentElement, row, 0);
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
    }, row);

    row.appendChild(btn);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // Keep DOM and keyboard order together: controls, nested sections, then the parent's description.
  #insertTreeNode(parent, node, order) {
    this.#treeOrder.set(node, order);
    const before = Array.from(parent.children).find(child => (this.#treeOrder.get(child) ?? 0) > order);
    parent.insertBefore(node, before ?? null);
  }

  #createLabelElement(rawLabel, path = null, swatch = null) {
    const labelText = String(rawLabel);
    const cleanLabelText = labelText.replace(/\s+\*$/u, "");
    const label = document.createElement("div");
    label.className = "devtools__label";
    this.#assignDevToolsPath(label, path);
    label.dataset.devtoolsKey = cleanLabelText;
    label.innerText = labelText;
    if (swatch) label.prepend(this.#createSwatch(swatch));
    const tooltip = this.#getParameterTooltip(cleanLabelText);
    const pathText = this.#normalizeDevToolsPath(path);
    if (tooltip || pathText || labelText.length > 15) {
      label.title = [pathText, tooltip || labelText].filter(Boolean).join("\n");
    }
    return label;
  }

  #createSwatch(color) {
    const swatch = document.createElement("span");
    swatch.className = "devtools__swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatch.style.setProperty("--devtools-swatch", color || "transparent");
    return swatch;
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

  #getParameterTooltip(labelText) {
    return this.#tooltipProvider?.getTooltip(labelText) || "";
  }

  #initBtn(config) {
    this.#btn = document.createElement("button");
    this.#btn.innerHTML = "⚙️";
    this.#btn.className = "hud-control hud-control--square devtools__toggle";
    this.#btn.type = "button";
    this.#btn.setAttribute("aria-label", "Параметри розробника");

    UiEventShield.makeSolid(this.#btn);

    if (this.#toggleMountNode !== this.#mountNode) {
      this.#btn.addEventListener("click", this.#onToggleCallback);
    } else this.#dragButton = new DraggableButton(this.#btn, this.#onToggleCallback, config, {
      // Old saved coordinates were next to the clock; start the new corner layout at its CSS anchor.
      id: "devtools_btn_corner",
      cache: this.#storageCache,
      noTransform: true,
      uiSurface: this.#uiSurface,
    });

    this.#toggleMountNode.appendChild(this.#btn);
  }

  #initPanel() {
    this.#panel = document.createElement("div");
    this.#panel.className = "devtools";

    this.#panel.innerHTML = `
            <div class="devtools__header">
                <h2 class="devtools__title">⚙️ DEV TOOLS</h2>
                <button class="devtools__close ui-modal-close" type="button" aria-label="Закрити інструменти">×</button>
            </div>
            <div class="devtools__body"></div>
            <div class="devtools__footer"></div>
        `;

    this.#mountNode.appendChild(this.#panel);
    this.#body = this.#panel.querySelector(".devtools__body");
    this.#footer = this.#panel.querySelector(".devtools__footer");

    UiEventShield.makeSolid(this.#panel);

    this.#panel
      .querySelector(".devtools__close")
      .addEventListener("click", this.#onToggleCallback);
  }
}
