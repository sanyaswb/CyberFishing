import { DevToolsControlBindingRegistry } from "../services/dev_tools_control_binding_registry.js";
import { DraggableButton } from "../../platform/browser/dom/draggable_button.js";
import { UiEventShield } from "../../platform/browser/dom/ui_event_shield.js";
import { DevToolsEdgeOpener } from "./dev_tools_edge_opener.js";
import { NumberField } from "./controls/number_field.js";
import { SwitchControl } from "./controls/switch_control.js";
import { TextField } from "./controls/text_field.js";
import { RangeField } from "./controls/range_field.js";
import { SegmentedControl } from "./controls/segmented_control.js";
import { ChoiceField } from "./controls/choice_field.js";
import { ExportCommandNotice } from "./controls/export_command_notice.js";
import { createDevIcon } from "./controls/dev_icon.js";
import { TextDialog } from "./controls/text_dialog.js";

// Spec 174 C4 (Q3): sections at this depth and below open inside (drill-in) instead of nesting in place.
const MAX_INLINE_SECTION_DEPTH = 2;
// Spec 174 C5: how long a result line stays at the bottom of the panel.
const TOAST_MS = 4000;

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
  // Spec 174 C4: each section content's depth in its page, and the section shown alone (drill-in).
  #contentDepth = new WeakMap();
  // TK-308: section contents drawn on first need.
  #lazyContents = new Map();
  #drill = null;
  // Spec 174 C5: the open text dialog and the result line.
  #dialog = null;
  #toast = null;
  #toastTimer = null;
  // Spec 174 C3: search text and descriptions of labels, rows for the filter, change marks.
  #searchText = new WeakMap();
  #parameterDescriptions = new WeakMap();
  #parameterRows = new Set();
  #changeMarks = new Map();
  #searchQuery = "";
  #changedOnly = false;
  #openedBySearch = new Set();
  #filterMarks = new Set();
  #searchStatus = null;
  #changedButton = null;
  // Spec 174 C2: the module rail and one page per module; only the active page shows, each keeps its own scroll.
  #rail = null;
  #pages = new Map();
  #railButtons = new Map();
  #activePage = "";
  #pageScroll = new Map();
  #onPageSelect = null;
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
    button.appendChild(createDevIcon(document, "gear", "devtools__toggle-icon"));
    button.setAttribute("aria-label", "Параметри розробника");
    const onClick = () => this.#onToggleCallback?.();
    button.addEventListener("click", onClick);
    mountNode.appendChild(button);
    return () => { button.removeEventListener("click", onClick); button.remove(); };
  }

  dispose() {
    this.#dialog?.close();
    if (this.#toastTimer !== null) clearTimeout(this.#toastTimer);
    this.#toastTimer = null;
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
    this.#lazyContents.clear();
    this.#parameterRows.clear();
    this.#changeMarks.clear();
    this.#openedBySearch.clear();
    this.#filterMarks.clear();
    this.#dependencyFeedback?.clear();
    this.#controlBindings.clear();
    this.#dependentSwitches.clear();
    this.#pathRows.clear();
    this.#pathSections.clear();
  }

  syncValue(path, value) {
    this.#controlBindings.sync(path, value);
    // An import or a reset of everything changes marks of paths that were not synced one by one.
    if (path.length <= 1) for (const refresh of this.#changeMarks.values()) refresh();
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
  // Spec 174 C2: the module rail (one icon button per module) and one page per module in the panel body, replacing what
  // the body held. modules: [{ id, title, icon }]; onSelect(id) is told when the person picks another module (to remember
  // it). Returns Map id -> page element; modules draw into their page.
  createPages(modules, activeId, onSelect) {
    this.#drill = null;
    this.#onPageSelect = onSelect;
    this.#pages.clear();
    this.#railButtons.clear();
    const buttons = [];
    for (const module of modules) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "devtools__rail-button";
      button.setAttribute("aria-label", module.title);
      button.title = module.title;
      button.dataset.devtoolsModule = module.id;
      button.appendChild(createDevIcon(document, module.icon, "devtools__rail-icon"));
      const label = document.createElement("span");
      label.className = "devtools__rail-label";
      label.textContent = module.title;
      button.appendChild(label);
      button.addEventListener("click", () => this.selectPage(module.id, { remember: true }));
      buttons.push(button);
      this.#railButtons.set(module.id, button);
      const page = document.createElement("div");
      page.className = "devtools__page";
      page.dataset.devtoolsPage = module.id;
      page.setAttribute("aria-label", module.title);
      this.#pages.set(module.id, page);
    }
    this.#rail.replaceChildren(...buttons);
    this.#body.replaceChildren(...this.#pages.values());
    this.#activePage = "";
    this.selectPage(this.#pages.has(activeId) ? activeId : modules[0]?.id ?? "");
    return new Map(this.#pages);
  }

  // Shows one module's page; remember: the person chose it (the panel remembers it for the next start).
  selectPage(id, { remember = false } = {}) {
    if (!this.#pages.has(id)) return;
    if (this.#drill && this.#drill.page !== this.#pages.get(id)) this.#leaveDrill();
    if (this.#activePage && this.#activePage !== id) this.#pageScroll.set(this.#activePage, this.#body.scrollTop);
    const changed = this.#activePage !== id;
    this.#activePage = id;
    for (const [pageId, page] of this.#pages) page.hidden = pageId !== id;
    for (const [pageId, button] of this.#railButtons) {
      const active = pageId === id;
      button.classList.toggle("devtools__rail-button--active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (changed) this.#body.scrollTop = this.#pageScroll.get(id) ?? 0;
    if (remember) this.#onPageSelect?.(id);
  }

  // Spec 174 C4: shows one section alone in its page with breadcrumbs back (the module, then every section above it).
  // The section's content is moved into the page's drill area and put back when leaving, so its rows, bindings and
  // states stay the same nodes.
  focusSection(section) {
    this.#leaveDrill();
    const content = section.children[1];
    const page = this.#pageOf(section);
    if (!content || !page) return;
    this.#materialize(content);
    const ancestors = [];
    for (let node = section.parentNode; node && node !== page; node = node.parentNode) {
      if (node.classList?.contains("devtools__section")) ancestors.unshift(node);
    }
    const crumbs = document.createElement("nav");
    crumbs.className = "devtools__crumbs";
    crumbs.setAttribute("aria-label", "Шлях до секції");
    crumbs.appendChild(this.#crumb(page.getAttribute("aria-label") || "", () => this.#leaveDrill()));
    for (const ancestor of ancestors) {
      crumbs.appendChild(this.#crumb(ancestor.children[0].textContent, () => {
        if (ancestor.classList.contains("devtools__section--drill")) {
          this.focusSection(ancestor);
          return;
        }
        this.#leaveDrill();
        if (ancestor.children[1].style.display === "none") ancestor.children[0].click();
        ancestor.scrollIntoView?.({ block: "start" });
      }));
    }
    const current = document.createElement("span");
    current.className = "devtools__crumb devtools__crumb--current";
    current.textContent = section.children[0].textContent;
    current.setAttribute("aria-current", "location");
    crumbs.appendChild(current);
    const host = document.createElement("div");
    host.className = "devtools__drill";
    content.style.display = "block";
    host.appendChild(content);
    page.classList.add("devtools__page--drilled");
    page.append(crumbs, host);
    this.#drill = { section, content, page, crumbs, host };
    this.#body.scrollTop = 0;
  }

  #crumb(text, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "devtools__crumb";
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  #leaveDrill() {
    const drill = this.#drill;
    if (!drill) return;
    this.#drill = null;
    drill.content.style.display = "none";
    drill.section.appendChild(drill.content);
    drill.crumbs.remove();
    drill.host.remove();
    drill.page.classList.remove("devtools__page--drilled");
  }

  #pageOf(element) {
    for (let node = element; node; node = node.parentNode) if (node.dataset?.devtoolsPage) return node;
    return null;
  }

  // Spec 174 C5: the panel's own text dialog over the panel (TextDialog); one at a time. Returns the dialog.
  openTextDialog(options) {
    this.#dialog?.close();
    const dialog = new TextDialog({ ...options, documentRef: document, onClose: () => {
      if (this.#dialog === dialog) this.#dialog = null;
      options.onClose?.();
    } });
    this.#dialog = dialog;
    this.#panel.appendChild(dialog.element);
    dialog.focus();
    return dialog;
  }

  // Spec 174 C5: a short result line at the bottom of the panel (in place of the browser's alert), gone after a moment.
  notify(text, { error = false } = {}) {
    if (!this.#toast) {
      this.#toast = document.createElement("div");
      this.#toast.className = "devtools__toast";
      this.#toast.setAttribute("role", "status");
      this.#panel.appendChild(this.#toast);
    }
    this.#toast.textContent = text;
    this.#toast.hidden = false;
    this.#toast.classList.toggle("devtools__toast--error", error);
    if (this.#toastTimer !== null) clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      this.#toastTimer = null;
      if (this.#toast) this.#toast.hidden = true;
    }, TOAST_MS);
  }

  // Copies text to the clipboard; false when the page has none (http on the local network).
  async copyText(text) {
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) return false;
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // A page without content says so in one line instead of disappearing from the rail.
  createEmptyNote(parentElement, text) {
    const note = document.createElement("div");
    note.className = "devtools__empty";
    note.textContent = text;
    this.#insertTreeNode(parentElement, note, 0);
  }

  // The page holding an element is shown first (a link from the overlay, a blocking switch in another module).
  #revealPageOf(element) {
    for (let node = element; node; node = node.parentNode) {
      const id = node.dataset?.devtoolsPage;
      if (id) {
        this.selectPage(id);
        return;
      }
    }
  }

  #showBlocker(blocker, row) {
    let elements = this.#controlBindings.elements(blocker.path);
    if (!elements.length && this.materializeAll()) elements = this.#controlBindings.elements(blocker.path);
    if (elements[0]) this.#revealPageOf(elements[0]);
    this.#dependencyFeedback?.show(blocker.path, elements, row);
  }

  // Spec 174 B4: a place among a parent's sections (after those made before it) whose sections are redrawn on their
  // own (releaseValueBindings + replaceChildren), without a box of its own and without redrawing the panel.
  createSectionSlot(parentElement) {
    const slot = document.createElement("div");
    slot.className = "devtools__control-group";
    this.#insertTreeNode(parentElement, slot, 1);
    return slot;
  }

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

  // icon: an optional DevTools icon name before the title (spec 174 C1); the chevron is an icon turned by CSS.
  // Spec 174 C4 (Q3): a section below two visible levels opens "inside" (drill-in with breadcrumbs) instead of nesting
  // further to the right; inline: false keeps a section in place at any depth («Опис»).
  // render(content): TK-308 — the content is drawn when the section is first opened (or when search, a reveal or a
  // blocker needs every row: materializeAll), not when the panel opens.
  createSection(labelStr, parentElement, isExpanded, onToggle, path = null,
    { buttonTitle = false, icon = "", inline = false, render = null } = {}) {
    const section = document.createElement("div");
    section.className = "devtools__section";
    this.#assignDevToolsPath(section, path);
    const depth = (this.#contentDepth.get(parentElement) ?? -1) + 1;
    const drill = !inline && !buttonTitle && depth >= MAX_INLINE_SECTION_DEPTH;
    if (drill) {
      section.classList.add("devtools__section--drill");
      isExpanded = false;
    }

    const title = document.createElement("button");
    title.className = buttonTitle ? "devtools__action devtools__action--disclosure" : "devtools__section-title";
    title.type = "button";
    title.setAttribute("aria-expanded", String(isExpanded));
    this.#assignDevToolsPath(title, path);
    const label = document.createElement("span");
    label.className = "devtools__section-label";
    label.textContent = labelStr;
    title.append(createDevIcon(document, "chevron", "devtools__section-chevron"),
      ...(icon ? [createDevIcon(document, icon, "devtools__section-icon")] : []), label);

    const content = document.createElement("div");
    content.className = "devtools__section-content";
    this.#assignDevToolsPath(content, path);
    content.style.display = isExpanded ? "block" : "none";
    this.#contentDepth.set(content, depth);
    if (render) this.#lazyContents.set(content, () => render(content));

    title.addEventListener("click", () => {
      if (drill && this.#drill?.section !== section) {
        this.focusSection(section);
        return;
      }
      if (drill) return;
      const isHidden = content.style.display === "none";
      if (isHidden) this.#materialize(content);
      content.style.display = isHidden ? "block" : "none";
      title.setAttribute("aria-expanded", String(isHidden));
      if (onToggle) onToggle(isHidden);
    });

    section.appendChild(title);
    section.appendChild(content);
    this.#insertTreeNode(parentElement, section, 1);
    if (isExpanded) this.#materialize(content);

    return content;
  }

  // TK-308: draws a lazy section's content once.
  #materialize(content) {
    const render = this.#lazyContents.get(content);
    if (!render) return;
    this.#lazyContents.delete(content);
    render();
  }

  // TK-308: draws every section still waiting in the panel (drawing may add more; they are drawn too). Returns whether
  // anything was drawn.
  materializeAll() {
    let drawn = false;
    while (this.#lazyContents.size > 0) {
      for (const content of [...this.#lazyContents.keys()]) {
        if (this.#body.contains(content)) {
          this.#materialize(content);
          drawn = true;
        } else {
          this.#lazyContents.delete(content);
        }
      }
    }
    return drawn;
  }

  createInfoRow(labelStr, value, parentElement, path = null) {
    const group = this.#controlGroups.get(parentElement);
    if (group) parentElement = group.parent;
    let description = this.#descriptions.get(parentElement);
    if (!description || description.content.parentNode?.parentNode !== parentElement) {
      const record = { expanded: description?.expanded || false, content: null };
      record.content = this.createSection("Опис", parentElement, record.expanded,
        expanded => { record.expanded = expanded; }, null, { inline: true });
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
    const titleText = document.createElement("span");
    titleText.innerText = titleStr;
    title.append(createDevIcon(document, "warning", "devtools__alert-icon"), titleText);
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
    // pages: [label, activate, icon?] (spec 174 C1: an icon instead of an emoji in the label).
    for (const [label, activate, icon = ""] of pages) this.createButtonRow(label, navigation, activate, true, "", null, { icon });
    this.#insertTreeNode(parentElement, navigation, 0);
  }

  // iconUrl: item art before the label (the shop); icon: a DevTools icon name (spec 174 C1).
  createButtonRow(labelStr, parentElement, onClickCallback, navigation = false, iconUrl = "", path = null, { icon = "" } = {}) {
    const row = document.createElement("div");
    row.className = navigation ? "devtools__row devtools__row--navigation" : "devtools__row";
    this.#assignDevToolsPath(row, path);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "devtools__action";
    btn.innerText = labelStr;
    if (icon) {
      const label = document.createElement("span");
      label.className = "devtools__action-label";
      label.innerText = labelStr;
      btn.replaceChildren(createDevIcon(document, icon, "devtools__action-icon"), label);
    }
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
  createSwitcherRow(labelStr, initialValue, parentElement, onChangeCallback, path = null, bindingPath = path,
    { swatch = null, requires = [] } = {}) {
    this.addParameter(parentElement, { control: "switch", label: labelStr, value: initialValue, onCommit: onChangeCallback,
      path, bindingPath, swatch, requires });
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
      this.#showBlocker(blocker, row);
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

  // type: "number" | "array" (numbers in one text field) | anything else (text).
  createInputRow(key, val, parentElement, type, onChangeCallback, path = null, bindingPath = path, { requires = [] } = {}) {
    const control = type === "number" ? "number" : type === "array" ? "numberList" : "text";
    this.addParameter(parentElement, { control, label: key, value: val, onCommit: onChangeCallback, path, bindingPath,
      requires });
  }

  // A 0..100 slider with its value beside it (spec 129 Revision 2: grid and depth opacity); onChangeCallback receives
  // the whole number while dragging.
  createRangeRow(labelStr, value, parentElement, onChangeCallback, path = null) {
    this.addParameter(parentElement, { control: "range", label: labelStr, value, onCommit: onChangeCallback, path });
  }

  // A list of plain values (zone numbers, bones, wind directions); onChangeCallback receives the chosen value.
  // TK-293: the same list picker as every other list (ChoiceField), never the browser's own select.
  // swatches: an optional { value: "#rrggbb" } map; each value's colour shows in the field and in the list.
  createSelectRow(labelStr, optionsArray, currentValue, parentElement, onChangeCallback, path = null,
    { swatches = null } = {}) {
    const options = optionsArray.map((option) => ({ value: option, label: String(option), swatch: swatches?.[option] || "" }));
    this.addParameter(parentElement, { control: "choice", label: labelStr, options, value: currentValue,
      onCommit: onChangeCallback, path, bindingPath: null });
  }

  // TK-283: a short list with every option visible; options: [{ value, label }].
  createSegmentsRow(key, options, currentValue, parentElement, onChangeCallback, path = null, bindingPath = path,
    { requires = [] } = {}) {
    this.addParameter(parentElement, { control: "segments", label: key, options, value: currentValue,
      onCommit: onChangeCallback, path, bindingPath, requires });
  }

  // TK-283: a list picker (name, id, image, search); options: [{ value, label, hint, imageUrl, swatch }].
  createChoiceRow(key, options, currentValue, parentElement, onChangeCallback, path = null, bindingPath = path,
    { requires = [] } = {}) {
    this.addParameter(parentElement, { control: "choice", label: key, options, value: currentValue,
      onCommit: onChangeCallback, path, bindingPath, requires });
  }

  // Spec 174 B1: one parameter row from one description, the way every module adds a parameter.
  //   control: "switch" | "number" | "text" | "numberList" | "range" | "segments" | "choice"
  //   label, value, onCommit(next); path (shown, revealed and highlighted), bindingPath (synced by syncValue; null: none);
  //   requires: [{ path, isEnabled() }] (spec 131, TK-292); options (segments, choice); swatch (a label colour).
  // The label sits beside the control; a list (choice) puts its field under the label (TK-293).
  //   isChanged(): the value differs from the code (a session override) -> a marker and a reset button (onReset()).
  addParameter(parentElement, { control, label, value, onCommit, path = null, bindingPath = path, requires = [],
    options = [], swatch = null, isChanged = null, onReset = null }) {
    const row = document.createElement("div");
    row.className = control === "choice" ? "devtools__row devtools__row--stacked"
      : control === "segments" ? "devtools__row devtools__row--wrap" : "devtools__row";
    this.#assignDevToolsPath(row, path);
    row.appendChild(this.#createLabelElement(label, path, swatch));
    const ariaLabel = String(label);
    let field;
    if (control === "switch") {
      field = this.#createSwitch(row, { value, onCommit, ariaLabel, bindingPath, requires });
    } else if (control === "range") {
      field = new RangeField({ value, onInput: onCommit, ariaLabel, documentRef: document });
    } else {
      const guard = this.#guardDependentRow(row, requires, value, onCommit, (shown) => field.setValue(shown));
      const commit = guard.commit;
      if (control === "number") field = new NumberField({ value, onCommit: commit, ariaLabel, documentRef: document });
      else if (control === "numberList") field = TextField.numberList({ value, onCommit: commit, ariaLabel, documentRef: document });
      else if (control === "segments") field = new SegmentedControl({ options, value, onCommit: commit, ariaLabel, documentRef: document });
      else if (control === "choice") field = new ChoiceField({ options, value, onCommit: commit, ariaLabel, documentRef: document });
      else field = new TextField({ value, onCommit: commit, ariaLabel, documentRef: document });
      if (bindingPath) this.#controlBindings.register(bindingPath, (next) => { guard.remember(next); field.setValue(next); }, row);
    }
    if (control === "range" && bindingPath) this.#controlBindings.register(bindingPath, (next) => field.setValue(next), row);
    if (isChanged && onReset) this.#addResetButton(row, bindingPath, isChanged, onReset);
    this.#addDescription(row);
    row.appendChild(field.element);
    this.#parameterRows.add(row);
    this.#insertTreeNode(parentElement, row, 0);
  }

  // Spec 174 C3: a changed parameter (its value is not the code's) is marked and has a reset beside its control; the
  // mark follows every sync of its path (an edit, an import, a reset).
  #addResetButton(row, bindingPath, isChanged, onReset) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "devtools__reset";
    button.setAttribute("aria-label", "Повернути значення з коду");
    button.title = "Повернути значення з коду";
    button.appendChild(createDevIcon(document, "reset"));
    button.addEventListener("click", () => onReset());
    row.appendChild(button);
    const refresh = () => row.classList.toggle("devtools__row--changed", isChanged() === true);
    this.#changeMarks.set(row, refresh);
    if (bindingPath) this.#controlBindings.register(bindingPath, () => refresh(), row);
    refresh();
  }

  // Spec 174 C3: an "i" button opens the parameter's description under the row (a native title is unreachable by touch).
  #addDescription(row) {
    const label = row.children[0];
    const description = this.#parameterDescriptions.get(label);
    if (!description) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "devtools__info";
    button.setAttribute("aria-label", "Опис параметра");
    button.setAttribute("aria-expanded", "false");
    button.appendChild(createDevIcon(document, "info"));
    const text = document.createElement("div");
    text.className = "devtools__description";
    text.hidden = true;
    text.innerText = description;
    button.addEventListener("click", () => {
      text.hidden = !text.hidden;
      button.setAttribute("aria-expanded", String(!text.hidden));
      row.classList.toggle("devtools__row--described", !text.hidden);
    });
    label.appendChild(button);
    row.appendChild(text);
  }

  // Spec 174 C3: the header's search (key, Ukrainian name or path, every module at once) and the changed-only filter.
  // Matching rows stay where they are and stay editable; their sections open for the time of the search and close again.
  refreshFilter() {
    const query = this.#searchQuery;
    const changedOnly = this.#changedOnly;
    const active = query.length > 0 || changedOnly;
    if (active) {
      this.#leaveDrill();
      this.materializeAll();
    }
    for (const content of this.#openedBySearch) content.style.display = "none";
    this.#openedBySearch.clear();
    for (const element of this.#filterMarks) element.classList.remove("devtools__row--match", "devtools__section--match",
      "devtools__page--match");
    this.#filterMarks.clear();
    this.#body.classList.toggle("devtools__body--filtered", active);
    let found = 0;
    if (active) {
      for (const row of this.#parameterRows) {
        if (!this.#body.contains(row)) {
          this.#parameterRows.delete(row);
          continue;
        }
        const text = this.#searchText.get(row.children[0]) ?? "";
        if (query && !text.includes(query)) continue;
        if (changedOnly && !row.classList.contains("devtools__row--changed")) continue;
        found += 1;
        this.#mark(row, "devtools__row--match");
        for (let node = row.parentNode; node && node !== this.#body; node = node.parentNode) {
          if (node.classList?.contains("devtools__section-content") && node.style.display === "none") {
            node.style.display = "block";
            this.#openedBySearch.add(node);
          }
          if (node.classList?.contains("devtools__section")) this.#mark(node, "devtools__section--match");
          if (node.classList?.contains("devtools__page")) this.#mark(node, "devtools__page--match");
        }
      }
    }
    this.#searchStatus.hidden = !active;
    this.#searchStatus.textContent = found ? `Знайдено: ${found}` : "Нічого не знайдено";
    this.#changedButton.setAttribute("aria-pressed", String(changedOnly));
    this.#changedButton.classList.toggle("devtools__filter--active", changedOnly);
  }

  #mark(element, className) {
    element.classList.add(className);
    this.#filterMarks.add(element);
  }

  // A switch row's behaviour (spec 131): switching on is refused while a prerequisite is off (the blocker is shown);
  // switching off stays possible; its own syncs come through bindingPath.
  #createSwitch(row, { value, onCommit, ariaLabel, bindingPath, requires }) {
    const field = new SwitchControl({ value, ariaLabel, documentRef: document, onCommit: (next) => {
      const blocker = next ? requires.find((requirement) => !requirement.isEnabled()) : null;
      if (blocker) {
        this.#refreshDependencies();
        this.#showBlocker(blocker, row);
        return false;
      }
      onCommit(next);
      if (next) this.#dependencyFeedback?.resolve(bindingPath);
      this.#refreshDependencies();
      return true;
    } });
    this.#controlBindings.register(bindingPath, (next) => field.setValue(next), row);
    if (requires.length) {
      let previousBlocked = null;
      const refresh = () => {
        const blocked = requires.some((requirement) => !requirement.isEnabled());
        if (blocked === previousBlocked) return;
        previousBlocked = blocked;
        row.classList.toggle("devtools__row--dependency-disabled", blocked);
        // Keep explanation clicks and turning an already-on value off available; activation remains guarded.
        field.setBlocked(blocked);
      };
      this.#dependentSwitches.set(row, refresh);
      refresh();
    }
    return field;
  }

  // Keep DOM and keyboard order together: controls, nested sections, then the parent's description.
  #insertTreeNode(parent, node, order) {
    this.#treeOrder.set(node, order);
    const before = Array.from(parent.children).find(child => (this.#treeOrder.get(child) ?? 0) > order);
    parent.insertBefore(node, before ?? null);
  }

  // Spec 174 C3 (Q4): the key as in the code first, the Ukrainian name (src/dev/metadata) under it when there is one.
  #createLabelElement(rawLabel, path = null, swatch = null) {
    const labelText = String(rawLabel);
    const label = document.createElement("div");
    label.className = "devtools__label";
    this.#assignDevToolsPath(label, path);
    label.dataset.devtoolsKey = labelText;
    const key = document.createElement("span");
    key.className = "devtools__label-key";
    key.innerText = labelText;
    label.appendChild(key);
    if (swatch) label.prepend(this.#createSwatch(swatch));
    const pathText = this.#normalizeDevToolsPath(path);
    const described = this.#tooltipProvider?.describe(pathText, labelText) ?? null;
    if (described?.name && described.name !== labelText) {
      const name = document.createElement("span");
      name.className = "devtools__label-name";
      name.innerText = described.name;
      label.appendChild(name);
    }
    if (pathText) label.title = pathText;
    this.#searchText.set(label, [labelText, described?.name, pathText].filter(Boolean).join(" ").toLowerCase());
    if (described?.description) this.#parameterDescriptions.set(label, described.description);
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
    let target = this.#findPathTarget(normalized);
    if (!target && this.materializeAll()) target = this.#findPathTarget(normalized);
    if (!target) return false;
    this.#revealPageOf(target);
    // Spec 174 C4: a target inside a drill-in section is shown inside its innermost one.
    this.#leaveDrill();
    let innermost = null;
    for (let node = target.parentNode; node; node = node.parentNode) {
      if (node.classList?.contains("devtools__section--drill")) {
        innermost = node;
        break;
      }
    }
    if (innermost) this.focusSection(innermost);

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


  #initBtn(config) {
    this.#btn = document.createElement("button");
    this.#btn.appendChild(createDevIcon(document, "gear", "devtools__toggle-icon"));
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

  #initTools() {
    const search = this.#panel.querySelector(".devtools__search");
    const input = this.#panel.querySelector(".devtools__search-input");
    search.insertBefore(createDevIcon(document, "search", "devtools__search-icon"), search.firstElementChild);
    this.#searchStatus = this.#panel.querySelector(".devtools__search-status");
    this.#changedButton = this.#panel.querySelector(".devtools__filter");
    this.#changedButton.insertBefore(createDevIcon(document, "changed", "devtools__filter-icon"), this.#changedButton.firstChild);
    input.addEventListener("input", () => {
      this.#searchQuery = String(input.value || "").trim().toLowerCase();
      this.refreshFilter();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !input.value) return;
      event.stopPropagation();
      input.value = "";
      this.#searchQuery = "";
      this.refreshFilter();
    });
    this.#changedButton.addEventListener("click", () => {
      this.#changedOnly = !this.#changedOnly;
      this.refreshFilter();
    });
  }

  #initPanel() {
    this.#panel = document.createElement("div");
    this.#panel.className = "devtools";

    this.#panel.innerHTML = `
            <div class="devtools__header">
                <h2 class="devtools__title">DevTools</h2>
                <button class="devtools__close ui-modal-close" type="button" aria-label="Закрити інструменти">×</button>
            </div>
            <div class="devtools__tools">
                <label class="devtools__search">
                    <input class="devtools__search-input" type="search" placeholder="Пошук параметра" aria-label="Пошук параметра" autocomplete="off" spellcheck="false" />
                </label>
                <button class="devtools__filter" type="button" aria-pressed="false" title="Лише змінені параметри">Змінені</button>
                <div class="devtools__search-status" aria-live="polite" hidden></div>
            </div>
            <div class="devtools__main">
                <nav class="devtools__rail" aria-label="Модулі розробника"></nav>
                <div class="devtools__body"></div>
            </div>
            <div class="devtools__footer"></div>
        `;

    this.#mountNode.appendChild(this.#panel);
    this.#rail = this.#panel.querySelector(".devtools__rail");
    this.#initTools();
    this.#body = this.#panel.querySelector(".devtools__body");
    this.#footer = this.#panel.querySelector(".devtools__footer");

    UiEventShield.makeSolid(this.#panel);

    this.#panel
      .querySelector(".devtools__close")
      .addEventListener("click", this.#onToggleCallback);
  }
}
