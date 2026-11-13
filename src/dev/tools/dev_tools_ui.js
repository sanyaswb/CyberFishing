import { DevToolsControlBindingRegistry } from "../services/dev_tools_control_binding_registry.js";
import { DraggableButton } from "../../platform/browser/dom/draggable_button.js";
import { UiEventShield } from "../../platform/browser/dom/ui_event_shield.js";
import { DevToolsEdgeOpener } from "./dev_tools_edge_opener.js";
import { NumberField } from "./controls/number_field.js";
import { SegmentedControl } from "./controls/segmented_control.js";
import { ChoiceField } from "./controls/choice_field.js";
import { ExportCommandNotice } from "./controls/export_command_notice.js";

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
  #dependentSwitches = new Map();
  #exportNotices = new WeakMap();
  #edgeOpener = null;
  #isOpen = false;
  #pathRows = new Map();
  #pathSections = new Map();

  constructor(onToggleCallback, config, tooltipProvider = null, storageCache = null, uiSurface = null,
    mountNode = uiSurface?.mountRoot || document.body, toggleMountNode = mountNode, dependencyFeedback = null,
    isEdgeBlocked = () => false) {
    this.#dependencyFeedback = dependencyFeedback;
    this.#storageCache = storageCache;
    this.#uiSurface = uiSurface;
    this.#mountNode = mountNode;
    this.#toggleMountNode = toggleMountNode;
    this.#onToggleCallback = onToggleCallback;
    this.#tooltipProvider = tooltipProvider;
    this.#initBtn(config);
    // Before the panel, so the open panel paints over the strip (TK-053).
    // TK-274.1: isEdgeBlocked() — a zone editor gesture is going on.
    this.#edgeOpener = new DevToolsEdgeOpener({ documentRef: document, mountNode: this.#mountNode,
      open: () => { if (!this.#isOpen) this.#onToggleCallback?.(); }, isBlocked: isEdgeBlocked });
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
      this.#refreshDependencies();
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
    this.#dependentSwitches.clear();
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
    this.#dependentSwitches.clear();
    this.#pathRows.clear();
    this.#pathSections.clear();
  }

  syncValue(path, value) {
    this.#controlBindings.sync(path, value);
    if (value === true) this.#dependencyFeedback?.resolve(path);
    this.#refreshDependencies();
  }

  releaseValueBindings(container) {
    this.#dependencyFeedback?.releaseWithin(container);
    this.#controlBindings.releaseWithin(container);
    this.#prunePathMap(this.#pathRows, container);
    this.#prunePathMap(this.#pathSections, container);
    for (const row of this.#dependentSwitches.keys()) if (container.contains(row)) this.#dependentSwitches.delete(row);
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
  createControlGroup(parentElement, path = null, { disabled = false } = {}) {
    // A disabled fieldset blocks native mouse/keyboard editing of all descendants, including nested trees.
    const group = document.createElement(disabled ? "fieldset" : "div");
    group.className = "devtools__control-group";
    if (disabled) {
      group.disabled = true;
      group.setAttribute("aria-disabled", "true");
      group.classList.add("devtools__control-group--disabled");
    }
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

  // Spec 173 TK-280: a red notice with rounded corners among its parent's controls (never inside the collapsed «Опис»):
  // a title and one line per problem; action rows go into the returned element through createButtonRow.
  createAlert(titleStr, lines, parentElement, path = null) {
    const alert = document.createElement("div");
    alert.className = "devtools__alert";
    alert.setAttribute("role", "alert");
    this.#assignDevToolsPath(alert, path);
    const title = document.createElement("div");
    title.className = "devtools__alert-title";
    title.innerText = titleStr;
    alert.appendChild(title);
    for (const line of lines) {
      const item = document.createElement("div");
      item.className = "devtools__alert-line";
      item.innerText = line;
      alert.appendChild(item);
    }
    this.#insertTreeNode(parentElement, alert, 0);
    return alert;
  }

  // TK-285: after a file export, the command that applies the file, at the top of the section it was exported from;
  // a new export in the same place replaces the notice. onClose() tells the section the notice was closed.
  showExportCommand(parentElement, { fileName, command, onClose = null }) {
    this.#exportNotices.get(parentElement)?.dispose();
    const notice = new ExportCommandNotice({ fileName, command, documentRef: document,
      copyText: (text) => {
        const clipboard = globalThis.navigator?.clipboard;
        if (!clipboard?.writeText) throw new Error("clipboard unavailable");
        return clipboard.writeText(text);
      },
      onClose: () => { this.#exportNotices.delete(parentElement); onClose?.(); } });
    this.#exportNotices.set(parentElement, notice);
    parentElement.insertBefore(notice.element, parentElement.children[0] ?? null);
  }

  // A visible label/value row (createInfoRow puts its rows into the collapsed "Опис"); returns the value element.
  createTextRow(labelStr, value, parentElement) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    row.appendChild(this.#createLabelElement(labelStr));
    const valueEl = document.createElement("div");
    valueEl.className = "devtools__value";
    valueEl.innerText = value;
    row.appendChild(valueEl);
    this.#insertTreeNode(parentElement, row, 0);
    return valueEl;
  }

  createNavigation(pages, parentElement) {
    const navigation = document.createElement("nav");
    navigation.className = "devtools__pages";
    navigation.setAttribute("aria-label", "Сторінки розробника");
    for (const [label, activate] of pages) this.createButtonRow(label, navigation, activate, true);
    this.#insertTreeNode(parentElement, navigation, 0);
  }

  createButtonRow(labelStr, parentElement, onClickCallback, navigation = false, iconUrl = "", path = null) {
    const row = document.createElement("div");
    row.className = navigation ? "devtools__row devtools__row--navigation" : "devtools__row";
    this.#assignDevToolsPath(row, path);
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
        this.#refreshDependencies();
        this.#dependencyFeedback?.show(blocker.path, this.#controlBindings.elements(blocker.path), row);
        return;
      }
      onChangeCallback(next);
      currentValue = next;
      if (next) this.#dependencyFeedback?.resolve(bindingPath);
      this.#refreshDependencies();
    });
    this.#controlBindings.register(bindingPath, (value) => {
      currentValue = value === true;
      cb.checked = currentValue;
    }, row);
    this.#insertTreeNode(parentElement, row, 0);
    if (requires.length) {
      let previousBlocked = null;
      const refresh = () => {
        const blocked = requires.some(requirement => !requirement.isEnabled());
        if (blocked === previousBlocked) return;
        previousBlocked = blocked;
        row.classList.toggle("devtools__row--dependency-disabled", blocked);
        // Keep explanation clicks and turning an already-on value off available; activation remains guarded.
        cb.setAttribute("aria-disabled", String(blocked));
      };
      this.#dependentSwitches.set(row, refresh);
      refresh();
    }
  }

  #refreshDependencies() {
    for (const [row, refresh] of this.#dependentSwitches) {
      if (!row.parentNode) this.#dependentSwitches.delete(row);
      else refresh();
    }
  }

  // TK-292 (spec 174 A6): a row of any control whose prerequisites (requires: [{ path, isEnabled() }], spec 131) are
  // unmet is inactive. Nothing in it reacts to the pointer, the keyboard or a paste, and such an attempt shows the
  // switch that blocks it; the row becomes active again as soon as that switch is on. A value the control still tries
  // to write is refused and the shown value restored (restore(value)), so the config is never written through an
  // inactive row. Returns { commit(next), remember(value) } for the row's control.
  #guardDependentRow(row, requires, initialValue, onChange, restore) {
    let current = initialValue;
    if (!requires.length) return { commit: onChange, remember() {} };
    const unmet = () => requires.find(requirement => !requirement.isEnabled()) ?? null;
    const showBlocker = (blocker) =>
      this.#dependencyFeedback?.show(blocker.path, this.#controlBindings.elements(blocker.path), row);
    const intercept = (event) => {
      // Tab still leaves the row.
      if (event.key === "Tab") return;
      const blocker = unmet();
      if (!blocker) return;
      event.preventDefault();
      event.stopPropagation();
      showBlocker(blocker);
    };
    // Capture: the row answers before its control does.
    for (const type of ["pointerdown", "mousedown", "click", "keydown", "beforeinput"]) row.addEventListener(type, intercept, true);
    let previousBlocked = null;
    const refresh = () => {
      const blocked = unmet() !== null;
      if (blocked === previousBlocked) return;
      previousBlocked = blocked;
      row.classList.toggle("devtools__row--dependency-disabled", blocked);
      row.setAttribute("aria-disabled", String(blocked));
    };
    this.#dependentSwitches.set(row, refresh);
    refresh();
    return {
      commit: (next) => {
        const blocker = unmet();
        if (blocker) {
          restore(current);
          showBlocker(blocker);
          return;
        }
        current = next;
        onChange(next);
      },
      remember: (value) => { current = value; },
    };
  }

  createInputRow(
    key,
    val,
    parentElement,
    type,
    onChangeCallback,
    path = null,
    bindingPath = path,
    { requires = [] } = {},
  ) {
    const row = document.createElement("div");
    row.className = "devtools__row";
    this.#assignDevToolsPath(row, path);

    const label = this.#createLabelElement(key, path);
    row.appendChild(label);

    if (type === "number") {
      // TK-282: the DEV number field (step from the value's precision, an invalid entry is never written).
      const guard = this.#guardDependentRow(row, requires, val, onChangeCallback, (value) => field.setValue(value));
      const field = new NumberField({ value: val, onCommit: guard.commit, ariaLabel: String(key), documentRef: document });
      this.#controlBindings.register(bindingPath, (value) => { guard.remember(value); field.setValue(value); }, row);
      row.appendChild(field.element);
      this.#insertTreeNode(parentElement, row, 0);
      return;
    }

    const inputElement = document.createElement("input");
    const show = (value) => { inputElement.value = Array.isArray(value) ? value.join(", ") : value; };
    const guard = this.#guardDependentRow(row, requires, val, onChangeCallback, show);
    inputElement.type = "text";
    inputElement.className = "devtools__input devtools__input--text";
    inputElement.value = val;
    inputElement.addEventListener("change", (e) => {
      let newVal = e.target.value;
      if (type === "array") {
        newVal = newVal
          .trim()
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((n) => parseFloat(n) || 0);
      }
      guard.commit(newVal);
    });

    this.#controlBindings.register(bindingPath, (value) => { guard.remember(value); show(value); }, row);
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

  // A list of plain values (zone numbers, bones, wind directions); onChangeCallback receives the chosen value.
  // TK-293: the same list picker as every other list (ChoiceField), never the browser's own select.
  // swatches: an optional { value: "#rrggbb" } map; each value's colour shows in the field and in the list.
  createSelectRow(labelStr, optionsArray, currentValue, parentElement, onChangeCallback, path = null,
    { swatches = null } = {}) {
    const options = optionsArray.map((option) => ({ value: option, label: String(option), swatch: swatches?.[option] || "" }));
    this.createChoiceRow(labelStr, options, currentValue, parentElement, onChangeCallback, path, null);
  }

  // TK-283: a short list with every option visible; options: [{ value, label }].
  createSegmentsRow(key, options, currentValue, parentElement, onChangeCallback, path = null, bindingPath = path,
    { requires = [] } = {}) {
    const row = document.createElement("div");
    row.className = "devtools__row devtools__row--wrap";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(key, path));
    const guard = this.#guardDependentRow(row, requires, currentValue, onChangeCallback, (value) => control.setValue(value));
    const control = new SegmentedControl({ options, value: currentValue, onCommit: guard.commit,
      ariaLabel: String(key), documentRef: document });
    this.#controlBindings.register(bindingPath, (value) => { guard.remember(value); control.setValue(value); }, row);
    row.appendChild(control.element);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // TK-283: a list picker (name, id, image, search); options: [{ value, label, hint, imageUrl, swatch }].
  // TK-293: the label is above, the field and its list take the row's width under it.
  createChoiceRow(key, options, currentValue, parentElement, onChangeCallback, path = null, bindingPath = path,
    { requires = [] } = {}) {
    const row = document.createElement("div");
    row.className = "devtools__row devtools__row--stacked";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(key, path));
    const guard = this.#guardDependentRow(row, requires, currentValue, onChangeCallback, (value) => field.setValue(value));
    const field = new ChoiceField({ options, value: currentValue, onCommit: guard.commit,
      ariaLabel: String(key), documentRef: document });
    if (bindingPath) this.#controlBindings.register(bindingPath, (value) => { guard.remember(value); field.setValue(value); }, row);
    row.appendChild(field.element);
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

  // Spec 177 (TK-296): expand collapsed ancestors, scroll to the matching parameter row/section and highlight it green.
  revealPath(path) {
    const normalized = this.#normalizeDevToolsPath(path);
    if (!normalized) return false;
    const target = this.#findPathTarget(normalized);
    if (!target) return false;

    if (typeof this.#dependencyFeedback?.showRevealed === "function") {
      this.#dependencyFeedback.showRevealed([target]);
      return true;
    }

    if (target.classList?.contains("devtools__section")) {
      const content = target.children?.[1];
      if (content?.classList?.contains("devtools__section-content") && content.style.display === "none") {
        target.children?.[0]?.click?.();
      }
    }
    for (let parent = target.parentNode; parent; parent = parent.parentNode) {
      if (parent.classList?.contains("devtools__section-content") && parent.style.display === "none") {
        parent.parentNode?.children?.[0]?.click?.();
      }
    }
    const highlightTarget = target.classList?.contains("devtools__section")
      ? target.children?.[0] || target
      : target;
    highlightTarget.classList?.add("devtools__row--revealed");
    target.scrollIntoView?.({ block: "center" });
    return true;
  }

  #assignDevToolsPath(element, path) {
    const normalized = this.#normalizeDevToolsPath(path);
    if (!normalized) return;
    element.dataset.devtoolsPath = normalized;
    if (element.classList?.contains("devtools__row") || element.classList?.contains("devtools__alert")) {
      this.#pushPathElement(this.#pathRows, normalized, element);
    } else if (element.classList?.contains("devtools__section")) {
      this.#pushPathElement(this.#pathSections, normalized, element);
    }
  }

  #pushPathElement(map, key, element) {
    const list = map.get(key) || [];
    list.push(element);
    map.set(key, list);
  }

  #prunePathMap(map, container) {
    for (const [key, list] of map) {
      const retained = list.filter((el) => !container.contains(el));
      if (retained.length) map.set(key, retained);
      else map.delete(key);
    }
  }

  #findPathTarget(normalizedPath) {
    const segments = normalizedPath.split(".");
    for (let len = segments.length; len >= 1; len--) {
      const candidate = segments.slice(0, len).join(".");
      const connectedRows = this.#connectedElements(this.#pathRows.get(candidate));
      if (connectedRows.length) return this.#pickPreferredTarget(connectedRows);
      const connectedSections = this.#connectedElements(this.#pathSections.get(candidate));
      if (connectedSections.length) return this.#pickPreferredTarget(connectedSections);
    }
    return null;
  }

  #connectedElements(list) {
    if (!list?.length) return [];
    return list.filter((el) => el?.parentNode && el.isConnected !== false);
  }

  #pickPreferredTarget(elements) {
    if (elements.length <= 1) return elements[0] || null;
    const specialized = elements.find((el) => !this.#isInsideGenericConfig(el));
    return specialized || elements[0];
  }

  #isInsideGenericConfig(element) {
    let topSection = null;
    for (let node = element; node && node !== this.#body; node = node.parentNode) {
      if (node.classList?.contains("devtools__section")) topSection = node;
    }
    return topSection?.dataset?.devtoolsPath === "CONFIG";
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
