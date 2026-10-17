const { readPageCss } = require("./testing/styles/page_stylesheet_reader");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { SourceRuntime } = require("./testing/core/source_runtime");
const {
  BrowserTimeoutScheduler,
} = require("../src/platform/browser/time/browser_timeout_scheduler.js");
const {
  bindConstructorDefaults,
} = require("./testing/runtime/constructor_defaults");

const ROOT = path.resolve(__dirname, "..");
const ITEM_PARAMETER_CONFIG_FILE = path.join(
  ROOT,
  "src/game/presentation/inventory/inventory_item_parameter_config.js",
);
const VIEW_MODEL_FACTORY_FILE = path.join(
  ROOT,
  "src/game/presentation/inventory/inventory_view_model_factory.js",
);
const ITEM_VIEW_FACTORY_FILE = path.join(
  ROOT,
  "src/game/presentation/inventory/inventory_item_tree_view_factory.js",
);
const COMMAND_SERVICE_FILE = path.join(
  ROOT,
  "src/game/application/inventory/inventory_command_service.js",
);
const INVENTORY_COMPOSITION_FILE = path.join(
  ROOT,
  "src/bootstrap/production/inventory_ui_bootstrap.js",
);

const UI_SCRIPT_ORDER = Object.freeze([
  [
    "inventory_action_type.js",
    "src/game/presentation/inventory/inventory_action_type.js",
  ],
  [
    "inventory_facade_contract.js",
    "src/game/presentation/inventory/inventory_facade_contract.js",
  ],
  [
    "inventory_action_contract.js",
    "src/game/presentation/inventory/inventory_action_contract.js",
  ],
  [
    "inventory_view_model_normalizer.js",
    "src/game/presentation/inventory/inventory_view_model_normalizer.js",
  ],
  [
    "inventory_dom_factory.js",
    "src/platform/browser/dom/inventory_dom_factory.js",
  ],
  [
    "ui_close_button_renderer.js",
    "src/game/presentation/ui/ui_close_button_renderer.js",
  ],
  [
    "ui_auto_switch_renderer.js",
    "src/game/presentation/ui/ui_auto_switch_renderer.js",
  ],
  [
    "inventory_long_press_controller.js",
    "src/platform/browser/dom/inventory_long_press_controller.js",
  ],
  [
    "inventory_attachment_badge_renderer.js",
    "src/game/presentation/inventory/inventory_attachment_badge_renderer.js",
  ],
  [
    "inventory_balance_parameter_resolver.js",
    "src/game/presentation/inventory/inventory_balance_parameter_resolver.js",
  ],
  [
    "inventory_tooltip_presenter.js",
    "src/game/presentation/inventory/inventory_tooltip_presenter.js",
  ],
  [
    "inventory_resource_meter_resolver.js",
    "src/game/presentation/inventory/inventory_resource_meter_resolver.js",
  ],
  [
    "inventory_resource_meter_renderer.js",
    "src/game/presentation/inventory/inventory_resource_meter_renderer.js",
  ],
  [
    "inventory_item_parameters_resolver.js",
    "src/game/presentation/inventory/inventory_item_parameters_resolver.js",
  ],
  [
    "inventory_assembly_parameter_section_resolver.js",
    "src/game/presentation/inventory/inventory_assembly_parameter_section_resolver.js",
  ],
  [
    "inventory_item_parameters_renderer.js",
    "src/game/presentation/inventory/inventory_item_parameters_renderer.js",
  ],
  [
    "inventory_item_card_renderer.js",
    "src/game/presentation/inventory/inventory_item_card_renderer.js",
  ],
  [
    "inventory_header_renderer.js",
    "src/game/presentation/inventory/inventory_header_renderer.js",
  ],
  [
    "inventory_scale_renderer.js",
    "src/game/presentation/inventory/inventory_scale_renderer.js",
  ],
  [
    "inventory_load_renderer.js",
    "src/game/presentation/inventory/inventory_load_renderer.js",
  ],
  [
    "inventory_load_meter_config.js",
    "src/game/presentation/inventory/inventory_load_meter_config.js",
  ],
  [
    "inventory_loadout_panel_renderer.js",
    "src/game/presentation/inventory/inventory_loadout_panel_renderer.js",
  ],
  [
    "inventory_editor_tabs_labels.js",
    "src/game/presentation/inventory/inventory_editor_tabs_labels.js",
  ],
  [
    "inventory_editor_config.js",
    "src/game/presentation/inventory/inventory_editor_config.js",
  ],
  [
    "inventory_editor_tabs_resolver.js",
    "src/game/presentation/inventory/inventory_editor_tabs_resolver.js",
  ],
  [
    "inventory_editor_tabs_renderer.js",
    "src/game/presentation/inventory/inventory_editor_tabs_renderer.js",
  ],
  [
    "inventory_assembly_editor_renderer.js",
    "src/game/presentation/inventory/inventory_assembly_editor_renderer.js",
  ],
  [
    "inventory_saved_loadout_preview_renderer.js",
    "src/game/presentation/inventory/inventory_saved_loadout_preview_renderer.js",
  ],
  [
    "inventory_inventory_grid_renderer.js",
    "src/game/presentation/inventory/inventory_grid_renderer.js",
  ],
  ["inventory_ui.js", "src/game/presentation/inventory/inventory_ui.js"],
  [
    "inventory_bootstrap.js",
    "src/bootstrap/production/inventory_ui_bootstrap.js",
  ],
]);

class InventorySourceReader {
  readItemParameterConfig() {
    return new SourceRuntime().readAuthoredSource(
      path.relative(ROOT, ITEM_PARAMETER_CONFIG_FILE).split(path.sep).join("/"),
    );
  }

  readJavaScriptFiles() {
    return UI_SCRIPT_ORDER.map(([name, relativePath]) => {
      return {
        name,
        relativePath,
        source: new SourceRuntime().readAuthoredSource(relativePath),
      };
    });
  }

  readStyle() {
    return readPageCss();
  }

  readConfig() {
    return new SourceRuntime().readAuthoredSource(
      "src/game/config/runtime/game_config.js",
    );
  }

  readApplicationFactory() {
    return new SourceRuntime().readAuthoredSource(
      path.relative(ROOT, VIEW_MODEL_FACTORY_FILE).replaceAll("\\", "/"),
    );
  }

  readItemViewFactory() {
    return new SourceRuntime().readAuthoredSource(
      path.relative(ROOT, ITEM_VIEW_FACTORY_FILE).replaceAll("\\", "/"),
    );
  }

  readCommandService() {
    // The authored source (its ESM target since Stage 4 cluster 024).
    return new SourceRuntime().readAuthoredSource(
      path.relative(ROOT, COMMAND_SERVICE_FILE).replaceAll("\\", "/"),
    );
  }

  readInventoryComposition() {
    return fs.readFileSync(INVENTORY_COMPOSITION_FILE, "utf8");
  }
}

class FakeClassList {
  #values = new Set();

  setFromString(value) {
    this.#values = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  add(...values) {
    values.forEach((value) => this.#values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.#values.delete(value));
  }

  contains(value) {
    return this.#values.has(value);
  }

  toggle(value, force = undefined) {
    const enabled =
      force === undefined ? !this.contains(value) : Boolean(force);
    if (enabled) this.add(value);
    else this.remove(value);
    return enabled;
  }
}

class FakeStyle {
  #properties = new Map();

  getPropertyValue(name) {
    return this.#properties.get(name) || "";
  }

  setProperty(name, value) {
    this.#properties.set(name, String(value));
  }

  removeProperty(name) {
    this.#properties.delete(name);
  }
}

class FakeElement {
  #className = "";
  #listeners = new Map();
  #capturedPointers = new Set();
  #textContent = "";

  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.isConnected = true;
    this.checked = false;
    this.disabled = false;
    this.value = "";
    this.id = "";
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  set className(value) {
    this.#className = String(value);
    this.classList.setFromString(value);
  }

  get className() {
    return this.#className;
  }

  set textContent(value) {
    this.#textContent = String(value ?? "");
    this.children = [];
  }

  get textContent() {
    return (
      this.#textContent +
      this.children.map((child) => child.textContent).join("")
    );
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    const activeElement = this.ownerDocument?.activeElement;
    if (
      activeElement &&
      this.children.some((child) => child.contains?.(activeElement))
    ) {
      this.ownerDocument.activeElement = null;
    }
    this.children.forEach((child) => {
      child.parentNode = null;
    });
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, []);
    this.#listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.#listeners.get(type) || [];
    this.#listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  emit(type, properties = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      button: 0,
      isPrimary: true,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      key: "",
      defaultPrevented: false,
      propagationStopped: false,
      immediatePropagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      stopImmediatePropagation() {
        this.immediatePropagationStopped = true;
      },
      ...properties,
    };
    for (const listener of [...(this.#listeners.get(type) || [])]) {
      listener(event);
      if (event.immediatePropagationStopped) break;
    }
    return event;
  }

  click() {
    return this.emit("click");
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  blur() {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  // Layout boxes: checks set layoutVisible to model a rendered (landscape) item list (spec 074).
  getClientRects() {
    return this.layoutVisible === true ? [{}] : [];
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  // Layout width for swipe checks (spec 075).
  getBoundingClientRect() {
    return { width: this.layoutWidth || 0, height: 0, left: 0, top: 0 };
  }

  setPointerCapture(pointerId) {
    this.#capturedPointers.add(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.#capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.#capturedPointers.delete(pointerId);
  }

  // The phone editor brings its active tab into view (spec 091); the fake records the request.
  scrollIntoView(options) {
    this.scrolledIntoView = options;
  }

  // Class selectors only (".a, .b"), enough for the swipe controller's ignore list (spec 087).
  closest(selector) {
    const classNames = selector
      .split(",")
      .map((part) => part.trim().replace(/^\./, ""));
    for (let node = this; node; node = node.parentNode) {
      if (classNames.some((className) => node.classList?.contains(className)))
        return node;
    }
    return null;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains?.(candidate));
  }

  remove() {
    if (this.contains(this.ownerDocument?.activeElement)) {
      this.ownerDocument.activeElement = null;
    }
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(
        (child) => child !== this,
      );
    }
    this.parentNode = null;
    this.isConnected = false;
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.body = new FakeElement("body", this);
    // Computed custom properties shared by every element; portrait turns the inventory swipes on (spec 087).
    this.cssProperties = {
      "--inventory-swipe": "on",
      "--inventory-editor-swipe": "on",
    };
    this.defaultView = {
      getComputedStyle: () => ({
        getPropertyValue: (name) => this.cssProperties[name] ?? "",
      }),
    };
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(namespace, tagName) {
    const element = new FakeElement(tagName, this);
    element.namespaceURI = namespace;
    return element;
  }
}

class FakeTimers {
  #now = 0;
  #nextId = 1;
  #timers = new Map();

  setTimeout(callback, delay = 0) {
    const id = this.#nextId++;
    this.#timers.set(id, {
      callback,
      dueAt: this.#now + Math.max(0, Number(delay) || 0),
    });
    return id;
  }

  clearTimeout(id) {
    this.#timers.delete(id);
  }

  advance(milliseconds) {
    const target = this.#now + milliseconds;
    while (true) {
      const next = [...this.#timers.entries()]
        .filter(([, timer]) => timer.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [id, timer] = next;
      this.#timers.delete(id);
      this.#now = timer.dueAt;
      timer.callback();
    }
    this.#now = target;
  }
}

class InventoryStaticContractCheck {
  #reader;

  constructor(reader = new InventorySourceReader()) {
    this.#reader = reader;
  }

  run() {
    const files = this.#reader.readJavaScriptFiles();
    const parameterConfig = this.#reader.readItemParameterConfig();
    const scroll = fs.readFileSync(
      path.join(
        ROOT,
        "src/platform/browser/dom/horizontal_scroll_controller.js",
      ),
      "utf8",
    );
    const combined = [
      scroll,
      parameterConfig,
      ...files.map((file) => file.source),
    ].join("\n");
    const style = this.#reader.readStyle();
    const config = this.#reader.readConfig();
    const composition = this.#reader.readInventoryComposition();

    this.#assertSafeTextRendering(combined);
    this.#assertClassExports(combined);
    this.#assertLongPressContract(combined, style);
    this.#assertHorizontalScrollContract(combined, composition, style);
    this.#assertVisualContract(style);
    assert.match(
      config,
      /inventory:\s*\{\s*showEffectiveStats:\s*false/s,
      "Inventory EffectiveItemStats debug output must be disabled by default",
    );
    this.#assertApplicationFactoryContract(combined);
    this.#assertViewModelContract();
    this.#assertAllInteractions(files);
    console.log("Inventory UI contract and interaction checks passed.");
  }

  #assertSafeTextRendering(source) {
    assert.ok(!source.includes(".innerHTML"), "UI must not assign innerHTML");
    assert.ok(!source.includes(".outerHTML"), "UI must not assign outerHTML");
  }

  #assertClassExports(source) {
    const expected = [
      "InventoryActionContract",
      "InventoryUI",
      "InventoryUiBootstrap",
      "InventoryLongPressController",
      "InventoryLoadoutPanelRenderer",
      "InventoryAssemblyEditorRenderer",
      "InventoryGridRenderer",
      "InventoryAttachmentBadgeRenderer",
      "InventoryTooltipPresenter",
      "InventorySavedLoadoutPreviewRenderer",
      "InventoryResourceMeterResolver",
      "InventoryResourceMeterRenderer",
      "InventoryItemParametersResolver",
      "InventoryItemParametersRenderer",
      "InventoryBalanceParameterResolver",
      "InventoryAssemblyParameterSectionResolver",
    ];
    for (const className of expected) {
      assert.ok(
        source.includes(`export class ${className} `),
        `${className} must have its named ESM export`,
      );
    }
  }

  #assertLongPressContract(source, style) {
    assert.match(source, /DURATION_MS\s*=\s*1500/);
    assert.match(source, /EQUIPPED_DURATION_MS\s*=\s*800/);
    assert.match(source, /ACTIVATION_DELAY_MS\s*=\s*300/);
    assert.match(source, /MOVEMENT_TOLERANCE_PX\s*=\s*8/);
    assert.match(source, /get hasActivePress\(\)/);
    assert.match(source, /longPressController\.hasActivePress/);
    assert.match(source, /if \(!this\.#isOpen\) this\.open\(\)/);
    assert.match(source, /updateDynamicVisuals\(card, item = null\)/);
    assert.match(source, /this\.#updateDynamicVisuals\(viewModel\)/);
    const dynamicUpdate = source.match(
      /updateDynamicProgression\(dt = 0\) \{[\s\S]*?\n  \}/,
    )?.[0];
    assert.ok(dynamicUpdate, "Missing dynamic progression updater");
    assert.ok(
      !dynamicUpdate.includes("this.refresh()"),
      "Dynamic progression updates must not replace the inventory DOM",
    );
    assert.match(source, /pointermove/);
    assert.match(source, /pointercancel/);
    assert.match(source, /lostpointercapture/);
    assert.match(style, /conic-gradient\(/);
    assert.match(style, /inventory-long-press-angle/);
    assert.match(style, /z-index:\s*30/);
  }

  #assertHorizontalScrollContract(source, composition, style) {
    assert.ok(
      source.includes("class HorizontalScrollController") &&
        source.includes('addEventListener("wheel"') &&
        source.includes('addEventListener("pointerdown"') &&
        source.includes('addEventListener("pointermove"') &&
        source.includes("element.scrollLeft = next"),
      "Inventory must use one wheel and pointer horizontal-scroll controller",
    );
    assert.ok(
      composition.includes(
        "createHorizontalScrollController: () => new HorizontalScrollController({ uiSurface })",
      ) && !composition.includes('element.addEventListener("mousedown"'),
      "Canonical inventory composition must inject the shared horizontal-scroll controller",
    );
    assert.ok(
      style.includes(".inventory-loadout-panel,") &&
        style.includes(".inventory-assembly-editor,") &&
        style.includes(".inventory-saved-loadout-preview,") &&
        style.includes(".inventory-horizontal-scroll") &&
        style.includes("touch-action: pan-x pan-y") &&
        style.includes("-webkit-overflow-scrolling: touch"),
      "Every left panel and horizontal filter must share scrollbar and swipe styles",
    );
  }

  #assertVisualContract(style) {
    const mobileModal = fs
      .readFileSync(
        path.join(ROOT, "src/game/presentation/styles/inventory/modal.css"),
        "utf8",
      )
      .split("@container ui-surface (max-width: 820px)")[1];
    const mobileLoadout = fs
      .readFileSync(
        path.join(ROOT, "src/game/presentation/styles/inventory/loadout.css"),
        "utf8",
      )
      .split("@container ui-surface (max-width: 820px)")[1];
    const mobileList = fs
      .readFileSync(
        path.join(
          ROOT,
          "src/game/presentation/styles/inventory/list-and-filters.css",
        ),
        "utf8",
      )
      .split("@container ui-surface (max-width: 820px)")[1];
    // Spec 068: portrait fills the screen — summary, the scrolling content row, tabs always at the bottom.
    const portraitModal = mobileModal.split(
      "@container ui-surface (orientation: portrait)",
    )[1];
    const portraitLoadout = mobileLoadout.split(
      "@container ui-surface (orientation: portrait)",
    )[1];
    const portraitList = mobileList.split(
      "@container ui-surface (orientation: portrait)",
    )[1];
    assert.ok(
      portraitModal && portraitLoadout && portraitList,
      "the stacked layout applies only in portrait",
    );
    assert.match(
      portraitModal,
      /\.inventory-modal\s*\{[^}]*overflow:\s*hidden;/,
      "the portrait inventory never scrolls as a page",
    );
    assert.match(
      portraitModal,
      /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto;/,
      "portrait summary, content and tabs reserve their own rows",
    );
    assert.match(
      portraitModal,
      /grid-template-areas:\s*"left"\s+"right"\s+"tabs";/,
      "the portrait tab bar is the last row",
    );
    assert.match(
      portraitModal,
      /\.inventory-modal--section-backpack \.inventory-main__left,\s*\.inventory-modal--section-keepnet \.inventory-main__left\s*\{\s*display:\s*none;/,
      "portrait shows the backpack and keepnet views inside their items panels, not as a summary column (spec 088)",
    );
    assert.match(
      portraitLoadout,
      /\.inventory-loadout-shell\s*\{[^}]*height:\s*auto;/,
      "portrait equipment must not inherit a percentage height from the desktop grid",
    );
    assert.match(
      portraitLoadout,
      /\.inventory-loadout-panel\s*\{[^}]*flex:\s*none;/,
      "portrait equipment must not shrink its auxiliary row into the item container",
    );
    // Spec 078: the unit comes from the real equipment row (a size container), never from a viewport estimate.
    assert.match(
      portraitModal,
      /\.inventory-modal--section-equipment \.inventory-main__left\s*\{[^}]*container-type:\s*size;/,
      "portrait equipment fits between the header and the bottom tabs through its real size",
    );
    assert.doesNotMatch(
      portraitLoadout,
      /--inventory-equipment-unit:/,
      "portrait keeps the container-relative base unit",
    );
    assert.doesNotMatch(
      style,
      /var\(--ui-logical-height[^)]*\)\s*-\s*var\(--ui-logical-width[^)]*\)\s*\*/,
      "no equipment size estimates the header from the viewport",
    );
    // Spec 074: backpack and keepnet share the collection block — filters panel, gap, scrolling items panel.
    const sharedControls = fs.readFileSync(
      path.join(
        ROOT,
        "src/game/presentation/styles/inventory/shared-controls.css",
      ),
      "utf8",
    );
    assert.match(
      sharedControls,
      /\.inventory-collection\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*gap:\s*var\(--inventory-container-gap, 10px\);[^}]*height:\s*100%;/,
      "a collection is a filters row, a gap and the items row filling the section",
    );
    const portraitCollection = sharedControls.split(
      "@container ui-surface (orientation: portrait)",
    )[1];
    assert.match(
      portraitCollection,
      /\.inventory-collection__list\s*\{\s*scrollbar-width:\s*none;/,
      "the portrait item list scrolls without a visible scrollbar",
    );
    assert.match(
      sharedControls,
      /\.inventory-collection__backdrop\s*\{[^}]*position:\s*absolute;[^}]*opacity:\s*0\.12;[^}]*pointer-events:\s*none;/,
      "collection artwork is a faint non-interactive background",
    );
    assert.match(
      portraitCollection,
      /\.inventory-collection__backdrop\s*\{[^}]*display:\s*block;/,
      "portrait shows the faded backdrop inside the items panel",
    );
    assert.match(
      sharedControls,
      /\.inventory-collection__backdrop\s*\{[^}]*top:\s*15%;[^}]*left:\s*15%;[^}]*width:\s*70%;[^}]*height:\s*70%;[^}]*object-position:\s*center;/,
      "the backdrop is centred within the items panel in both orientations",
    );
    assert.match(
      sharedControls,
      /@container ui-surface \(orientation: landscape\)\s*\{\s*\.inventory-list-panel \.inventory-collection__backdrop\s*\{\s*display:\s*block;\s*\}/,
      "landscape enables the backpack backdrop without overriding its centred placement",
    );
    assert.ok(
      portraitList.includes(".inventory-list-grid"),
      "the portrait list keeps its gutter rule",
    );
    // Spec 069: one full-screen dark container; equipment owns the content row; the header is a rounded mini panel.
    assert.match(
      portraitModal,
      /\.inventory-modal\s*\{[^}]*padding:\s*env\(safe-area-inset-top, 0px\) 0 env\(safe-area-inset-bottom, 0px\);[^}]*background:\s*var\(--inventory-equipment-surface\);/,
      "the portrait inventory is one dark container without outer padding",
    );
    assert.match(
      portraitModal,
      /\.inventory-modal--section-equipment \.inventory-main__right\s*\{\s*display:\s*none;/,
      "portrait equipment shows no item list: the backpack section owns it",
    );
    assert.match(
      portraitModal,
      /\.inventory-modal--section-equipment \.inventory-main__left\s*\{\s*grid-area:\s*right;/,
      "portrait equipment fills the content row",
    );
    const mobileHeader = fs
      .readFileSync(
        path.join(ROOT, "src/game/presentation/styles/inventory/header.css"),
        "utf8",
      )
      .split("@container ui-surface (orientation: portrait)")[1];
    assert.match(
      mobileHeader,
      /\.inventory-header\s*\{[^}]*border-radius:\s*var\(--inventory-header-radius\);[^}]*background:\s*var\(--inventory-equipment-panel\);/,
      "the portrait header is a rounded mini panel",
    );
    // Spec 075: only visible filter rows take space; one container gap token; the portrait pager slides its track.
    // Spec 088: the backpack and keepnet controls panels share the rule.
    assert.match(
      style,
      /\.inventory-collection__controls\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;/,
      "closed filter rows reserve no space and opening them pushes the items panel down",
    );
    assert.doesNotMatch(
      style,
      /\.inventory-(?:list-panel|collection)__controls\s*\{[^}]*grid-template-rows/,
      "no empty reserved filter rows",
    );
    assert.doesNotMatch(
      style,
      /\.keepnet-section__controls\s*\{/,
      "the keepnet controls panel has no layout of its own",
    );
    assert.match(
      style,
      /--inventory-container-gap:\s*var\(--inventory-content-gap\);/,
      "wide layouts space containers by the column gap",
    );
    assert.match(
      mobileModal,
      /--inventory-container-gap:\s*var\(--inventory-mobile-inset\);/,
      "phones space containers by the mobile inset",
    );
    const portraitPager = mobileList.split(
      "@container ui-surface (orientation: portrait)",
    )[1];
    assert.match(
      portraitPager,
      /\.inventory-pager__track\s*\{\s*transform:\s*translateX\(calc\(var\(--inventory-pager-position, var\(--inventory-pager-index, 0\)\)/,
      "portrait pages follow the drag position and settle on the page index",
    );
    assert.match(
      portraitPager,
      /\.inventory-pager__viewport\s*\{[^}]*touch-action:\s*pan-y;/,
      "vertical list scrolling stays native",
    );
    assert.match(
      style,
      /\.inventory-pager__tabs,\s*\.inventory-pager__page:not\(:first-child\)\s*\{\s*display:\s*none;/,
      "wide layouts show neither pager tabs nor a pager's second page (backpack, keepnet)",
    );
    // Spec 077: one parent paints the left column; the tab bar and the sections paint no outer background.
    assert.match(
      style,
      /\.inventory-main__sidebar\s*\{[^}]*grid-area:\s*left;[^}]*display:\s*flex;[^}]*border-radius:\s*var\(--inventory-panel-radius\);[^}]*background:\s*var\(--inventory-equipment-surface\);/,
      "the sidebar owns the column's background and frame",
    );
    assert.match(
      style,
      /\.inventory-section-tabs\s*\{[^}]*background:\s*transparent;/,
      "the tab bar paints no background",
    );
    // Spec 090: card artwork centred on the whole card under its squares and meter; squares 1.5x; two equip flashes;
    // one row of editor actions on phones.
    assert.match(
      style,
      /\.inventory-item-card__visual\s*\{\s*position:\s*absolute;\s*z-index:\s*0;\s*inset:\s*var\(--inventory-card-gap\);/,
      "the artwork is centred on the whole card",
    );
    assert.match(
      style,
      /--inventory-attachment-size:\s*min\(\s*calc\(var\(--inventory-slot-size\) \* 0\.33\),/,
      "equipment squares are 1.5x",
    );
    assert.match(
      style,
      /\.inventory-attachments\s*\{\s*position:\s*relative;\s*z-index:\s*1;/,
      "squares lie above the artwork",
    );
    assert.match(
      style,
      /@keyframes inventory-equipped-flash\s*\{[^@]*13% \{ opacity: 0\.4; \}[^@]*60\.4% \{ opacity: 0\.4; \}/,
      "equipping flashes twice, the second time slower",
    );
    assert.match(
      style,
      /\.inventory-assembly-editor__actions\s*\{\s*display:\s*flex;\s*gap:\s*8px;/,
      "editor actions share one row in every layout (spec 094)",
    );
    // A visible editor hides section navigation in every layout, with its own parameter swipe flag.
    const visibleEditor =
      ".inventory-modal--section-equipment:has(.inventory-assembly-editor)";
    for (const [selector, rule] of [
      [" .inventory-main__tabs", /^\s*display:\s*none;\s*$/],
      [" .inventory-main", /^\s*--inventory-swipe:\s*off;\s*$/],
    ]) {
      // Formatters may wrap a long selector: compare with collapsed whitespace.
      const block =
        style
          .replace(/\s+/g, " ")
          .split(visibleEditor + selector + " {")[1]
          ?.split("}")[0] || "";
      assert.match(
        block,
        rule,
        "item editor rule in every layout " + selector.trim(),
      );
      assert.ok(
        !mobileModal.includes(visibleEditor + selector + " {"),
        "editor navigation is not portrait-only",
      );
    }
    assert.doesNotMatch(
      portraitModal,
      /grid-row:\s*2 \/ 4;/,
      "the editor no longer scrolls under the section tabs",
    );
    assert.doesNotMatch(
      style,
      /padding-bottom:\s*calc\(var\(--inventory-container-gap\) \+ 100cqi \* 0\.15\);/,
      "the editor reserves no space for the hidden section tabs",
    );
    assert.match(
      style,
      /\.inventory-assembly-editor\s*\{[^}]*touch-action:\s*pan-y;/,
      "the editor scroller leaves horizontal gestures to its pager in landscape too",
    );
    assert.match(
      style,
      /\.inventory-assembly-editor\.inventory-assembly-editor--scrollbar-hidden\s*\{\s*scrollbar-width:\s*none;/,
    );
    assert.match(
      style,
      /\.inventory-assembly-editor\.inventory-assembly-editor--scrollbar-hidden::-webkit-scrollbar\s*\{\s*display:\s*none;/,
    );
    assert.doesNotMatch(
      style,
      /cursor:\s*help;/,
      "inventory uses no question-mark cursor",
    );
    // Spec 094: the editor uses its tabs in every layout; wide layouts no longer hide them or keep a cell grid.
    assert.match(
      style,
      /\/\* --inventory-editor-swipe[^*]*\*\/\s*\.inventory-modal\s*\{[^}]*--inventory-editor-swipe:\s*on;/,
      "the editor swipe is on in every layout",
    );
    assert.doesNotMatch(
      style,
      /\.inventory-editor-tabs\s*\{\s*display:\s*none;/,
      "no layout hides the editor tabs",
    );
    assert.doesNotMatch(
      style,
      /inventory-assembly-editor__sockets|inventory-assembly-workspace/,
      "the cell grid and its stack are gone",
    );
    assert.match(
      style,
      /\.inventory-main__sidebar \.inventory-loadout-panel,\s*\.inventory-main__sidebar \.inventory-assembly-editor,\s*\.inventory-main__sidebar \.inventory-saved-loadout-preview\s*\{\s*--inventory-panel:\s*transparent;\s*--inventory-panel-border:\s*transparent;/,
      "equipment-section panels paint no outer frame inside the sidebar",
    );
    assert.doesNotMatch(
      style,
      /\.keepnet-section__summary\s*\{[^}]*background:/,
      "the keepnet summary paints no outer frame",
    );
    assert.match(
      portraitModal,
      /\.inventory-main__sidebar\s*\{\s*display:\s*contents;/,
      "portrait keeps its grid areas through the sidebar",
    );
    // Spec 074: wide layouts place the header's two sections over the content columns in one row.
    assert.match(
      style,
      /\.inventory-header__controls\s*\{\s*grid-column:\s*2;\s*grid-row:\s*1;/,
      "the switches and close share the right section's row",
    );
    assert.match(
      style,
      /\.inventory-header__load\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1;/,
      "the load meter is the left section of the same row",
    );
    assert.match(
      style,
      /\.inventory-toggle__item--highlighted \.inventory-toggle__artwork::after\s*\{[^}]*animation:\s*inventory-compatible-slot-pulse/,
      "the selected header circle pulses green inside like a highlighted cell",
    );
    for (const selector of [
      ".inventory-modal",
      ".game-toolbar-button",
      ".game-toolbar-button--inventory",
      ".ui-modal-close",
      ".inventory-loadout-shell",
      ".inventory-loadout-panel__primary",
      ".inventory-loadout-panel__auxiliary",
      ".inventory-assembly-editor__workspace",
      ".inventory-saved-loadout-preview__slots",
      ".inventory-list-grid",
      ".inventory-attachments--reel-line",
      ".inventory-attachments--hook",
      ".inventory-attachments--boat-cargo",
      ".inventory-resource-meter",
      ".inventory-resource-meter--thumbnail",
      ".inventory-resource-meter--parameter",
      ".inventory-resource-meter__icon",
      ".inventory-resource-meter__track",
      ".inventory-resource-meter__fill",
      ".inventory-assembly-editor__visual",
      ".inventory-item-parameters",
      ".inventory-item-parameter-section",
      ".inventory-item-parameters--single .inventory-item-parameter-section",
      ".inventory-item-parameter-section--centered",
      ".inventory-item-parameter-section__header",
      ".inventory-parameters-list",
      ".inventory-parameter",
      ".inventory-parameter__bar-track",
      ".inventory-parameter__segments",
      ".inventory-item-card__incomplete-dot",
      ".inventory-categories__toggle",
      ".inventory-categories__sort-toggle::before",
      ".inventory-subfilters",
      ".inventory-subfilters__checkbox",
      ".inventory-sort-options",
      ".inventory-sort-options__button",
      ".inventory-sort-options__criterion.inventory-sort-options__button--active::before",
      ".inventory-sort-options__rarity",
      ".inventory-list-item.inventory-list-item--compatible:not(.inventory-list-item--selected)",
      ".inventory-tooltip",
      ".inventory-balance-tooltip__row",
      ".inventory-balance-tooltip__identity",
      ".inventory-balance-tooltip__delta",
      ".inventory-tooltip::-webkit-scrollbar-thumb",
    ]) {
      assert.ok(style.includes(selector), `Missing selector: ${selector}`);
    }
    const hintRegionRule = style.match(
      /^\.inventory-modal__hints\s*\{[\s\S]*?\n\}/m,
    )?.[0];
    const openModalRule = style.match(
      /^\.inventory-modal\.inventory-modal--open\s*\{[\s\S]*?\n\}/m,
    )?.[0];
    const resourceThumbnailRule = style.match(
      /\.inventory-resource-meter--thumbnail\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const resourceIconRule = style.match(
      /\.inventory-resource-meter--thumbnail\s+\.inventory-resource-meter__icon\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const resourceTrackRule = style.match(
      /^\.inventory-resource-meter__track\s*\{[\s\S]*?\n\}/m,
    )?.[0];
    const parameterBarRule = style.match(
      /\.inventory-parameter__bar-track\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const parameterSegmentsRule = style.match(
      /\.inventory-parameter__segments\s*\{[\s\S]*?\n\}/,
    )?.[0];
    // Spec 086: hints have an in-flow region at the top of the inventory; nothing overlays the sections.
    assert.ok(
      hintRegionRule && !/position:\s*(absolute|fixed)/.test(hintRegionRule),
      "The hint region stays in the flow",
    );
    assert.ok(
      !/\.inventory-warning\b/.test(style) &&
        !/\.keepnet-section__help-text\s*\{/.test(style),
      "Hints are not positioned over the inventory",
    );
    assert.ok(
      !style.includes("inventory-warning--visible"),
      "Warning visibility belongs to the ui-hint hidden state",
    );
    // G-061: a row template without its child left the main area in a content-sized row (equipment 0 px tall).
    const rowTracks = (template) =>
      template
        .replace(/\([^)]*\)/g, "()")
        .trim()
        .split(/\s+/);
    this.modalRowTracks = rowTracks(
      openModalRule?.match(/grid-template-rows:\s*([^;]+);/)?.[1] || "",
    );
    assert.deepStrictEqual(
      this.modalRowTracks,
      ["auto", "auto", "minmax()"],
      "The open modal has one content row per hint region and header, and the stretching main row last",
    );
    assert.ok(
      !style.includes(".inventory-charge") &&
        style.includes(
          "background: var(--inventory-resource-color, var(--ui-border))",
        ) &&
        !style.includes("--inventory-resource-fill-start") &&
        !style.includes("--inventory-resource-fill-end"),
      "All thumbnail resources must share one reusable meter and color source",
    );
    assert.ok(
      resourceThumbnailRule?.includes("position: relative") &&
        resourceThumbnailRule.includes("flex: none") &&
        resourceThumbnailRule.includes("width: 100%") &&
        resourceThumbnailRule.includes(
          "height: var(--inventory-parameter-meter-height)",
        ) &&
        resourceTrackRule?.includes("width: 100%"),
      "The resource scale must reserve its own row below the content at full width",
    );
    assert.ok(
      resourceIconRule?.includes("flex: none") &&
        !resourceIconRule.includes("position: absolute"),
      "The optional resource icon must occupy space beside the scale",
    );
    const compartmentRule = style.match(
      /\.inventory-attachment-badge\s*\{([^}]+)\}/,
    )?.[1];
    const incompleteRule = style.match(
      /\.inventory-item-card__incomplete-dot\s*\{([^}]+)\}/,
    )?.[1];
    assert.ok(
      compartmentRule?.includes("aspect-ratio: 1") &&
        compartmentRule.includes("border: 1px solid var(--rarity-color)") &&
        !compartmentRule.includes("position: absolute") &&
        !compartmentRule.includes("border-radius: 50%"),
      "Equipment must occupy square compartments with thin rarity borders inside the content grid",
    );
    assert.ok(
      incompleteRule?.includes("top: 2px") &&
        incompleteRule.includes("left: 2px"),
      "The incomplete indicator must remain inside the card with a two-pixel inset",
    );
    assert.ok(
      parameterBarRule?.includes(
        "height: var(--inventory-parameter-meter-height)",
      ) &&
        parameterSegmentsRule?.includes(
          "height: var(--inventory-parameter-meter-height)",
        ),
      "All production parameter scales must share one configured height",
    );
    // Spec 067: one container-relative unit sizes the equipment reference; separate columns also bound it by height.
    // Formatters may wrap long selectors and calc(): these loadout rules are compared with collapsed whitespace.
    const flatCss = (css) =>
      css.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")");
    const flatStyle = flatCss(style);
    assert.ok(
      flatStyle.includes(
        "--inventory-equipment-unit: min(calc(100cqi / 3.66), calc(100cqb / 4.88));",
      ) &&
        /\.inventory-loadout-panel\s*\{[^}]*align-content:\s*start;/.test(
          flatStyle,
        ) &&
        flatStyle.includes("container: inventory-equipment / size;"),
      "The equipment composition must scale from its container's width, and height in the two-column layout",
    );
    assert.match(
      flatStyle,
      /\.inventory-loadout-panel__primary\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--inventory-equipment-unit\);[\s\S]*?height:\s*calc\(\s*var\(--inventory-equipment-unit\) \* 3 \+/,
      "The rod cell fills the width beside one dependent column three units tall",
    );
    assert.match(
      flatStyle,
      /\.inventory-loadout-panel__primary--single\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
      "Without dependent slots the rod cell spans the primary panel",
    );
    assert.match(
      flatStyle,
      /\.inventory-main__section--equipment \.inventory-loadout-panel:has\(> \.inventory-loadout-panel__primary--single\)\s*\{\s*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+max-content;/,
      "Without a rod the rod cell grows into the free height of the equipment section",
    );
    assert.match(
      flatCss(mobileLoadout).split(
        "@container ui-surface (orientation: portrait)",
      )[1],
      /\.inventory-main__section--equipment:has\(\.inventory-loadout-panel__primary--single\) \.inventory-loadout-shell\s*\{\s*height:\s*100%;/,
      "A rodless portrait equipment section fills the content row",
    );
    assert.ok(
      !/aspect-ratio:\s*9\s*\/\s*16/.test(flatStyle),
      "The rod cell no longer keeps a fixed 9:16 proportion",
    );
    // A container at least as wide as tall puts the auxiliary wells in a column left of the primary panel.
    const wideLoadout =
      flatStyle.split(
        "@container inventory-equipment (min-aspect-ratio: 1 / 1) {",
      )[1] || "";
    assert.match(
      wideLoadout,
      /\.inventory-loadout-panel\s*\{[^}]*--inventory-equipment-unit:\s*min\(calc\(100cqi \/ 4\.83\),\s*calc\(100cqb \/ 3\.81\)\);[^}]*grid-template-areas:\s*"auxiliary primary";[^}]*column-gap:\s*var\(--inventory-equipment-inset\);/,
      "a wide equipment container rescales the unit for the side column",
    );
    assert.match(
      wideLoadout,
      /\.inventory-loadout-panel__auxiliary\s*\{[^}]*grid-template-rows:\s*repeat\(4, var\(--inventory-equipment-well-size\)\);/,
      "the four wells stand in one column",
    );
    assert.match(
      wideLoadout,
      /\.inventory-loadout-panel__auxiliary\s*\{[^}]*justify-self:\s*stretch;[^}]*padding:\s*var\(--inventory-equipment-inset\);/,
      "the wells column fills the free width with the primary panel's inset as padding",
    );
    assert.match(
      flatStyle,
      /--inventory-content-columns:\s*minmax\(min\(430px, calc\(\(100% - var\(--inventory-content-gap\)\) \/ 2\)\), 0\.92fr\)/,
      "both content columns shrink together once they are equal",
    );
    // Spec 094: the editor's cells are its tabs, sized by the shared socket size.
    assert.ok(
      /\.inventory-editor-tabs__tab\s*\{[^}]*flex:\s*0 0 var\(--inventory-socket-size\);/.test(
        style,
      ),
      "Assembly socket size must remain centralized",
    );
    assert.ok(
      style.includes("--inventory-assembly-card-width") &&
        style.includes("--inventory-assembly-content-width") &&
        style.includes(".inventory-assembly-editor__visual") &&
        style.includes(".inventory-parameters-list") &&
        style.includes(".inventory-parameter__bar-track") &&
        style.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"),
      "The assembly editor must stack visual, sockets and production parameters in one card",
    );
    assert.match(
      style,
      /\.inventory-item-parameters\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
      "Multiple parameter sections must use a balanced two-column tile grid",
    );
    assert.match(
      style,
      /\.inventory-item-parameter-section--centered\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?justify-self:\s*center;/,
      "The final odd parameter tile must occupy a centered row",
    );
    // Spec 094: the editor shows one item's parameters per tab page on the panel's surface; no tile grid to collapse.
    assert.match(
      style,
      /\.inventory-editor-tabs__page \.inventory-item-parameter-section\s*\{\s*padding:\s*0;\s*border:\s*0;/,
      "a tab page's parameters stand on the editor panel",
    );
    assert.ok(
      style.includes("--inventory-scrollbar-size") &&
        style.includes("--inventory-scrollbar-thumb") &&
        style.includes(".inventory-categories,") &&
        style.includes(".inventory-subfilters,") &&
        style.includes(".inventory-sort-options,") &&
        style.includes(".inventory-tooltip"),
      "Inventory filters and tooltip must share one scrollbar style source",
    );
    assert.match(
      style,
      /\.inventory-loadout-panel__auxiliary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*var\(--inventory-equipment-well-size\)\);\s*justify-content:\s*space-between;/,
      "Auxiliary equipment must render as four equal wells spread across the primary content width",
    );
    assert.match(
      style,
      /\.inventory-loadout-panel__auxiliary\s*\{[\s\S]*?padding:\s*calc\(\s*var\(--inventory-equipment-unit\) \* 0\.15\s*\)\s+var\(--inventory-equipment-inset\);/,
      "Auxiliary row must share the primary panel's inset so its outer wells align with the rod and column edges",
    );
    assert.ok(
      !style.includes("repeat(3, minmax(76px, 1fr))"),
      "Auxiliary wells must not stretch across the entire row",
    );
    assert.match(
      style,
      /\.inventory-slot:not\(\.inventory-slot--filled\)\s*\{[\s\S]*?border:\s*2px solid var\(--inventory-slot-border, #252e31\);[\s\S]*?background:\s*var\(--inventory-slot-background, #181e20\);/,
      "Open empty slots must keep the standard empty-slot visual",
    );
    assert.match(
      style,
      /\.inventory-slot--locked:not\(\.inventory-slot--filled\),\s*\.inventory-slot--unavailable:not\(\.inventory-slot--filled\)\s*\{[\s\S]*?border-color:\s*var\(--inventory-slot-blocked-border, #080a0b\);[\s\S]*?background:\s*var\(--inventory-slot-blocked-background, #101415\);/,
      "Locked and missing-item slots must share the same dark well visual",
    );
    assert.ok(
      !style.includes(
        ".inventory-slot--unavailable .inventory-slot__empty-button::before",
      ) &&
        !style.includes(
          ".inventory-slot--unavailable .inventory-slot__empty-button::after",
        ),
      "Missing-item slots must use the dark visual without the locked cross",
    );
    assert.ok(
      style.includes(".inventory-slot.inventory-slot--highlighted {"),
      "Compatible filled and empty sockets must share the highlight state",
    );
    const highlightedSlotRule = style.match(
      /\.inventory-slot\.inventory-slot--highlighted\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const highlightedSlotOverlayRule = style.match(
      /\.inventory-slot\.inventory-slot--highlighted::after\s*\{[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(
      highlightedSlotRule &&
        !highlightedSlotRule.includes("outline") &&
        !highlightedSlotRule.includes("box-shadow") &&
        highlightedSlotOverlayRule?.includes(
          "background: var(--inventory-success)",
        ),
      "Compatible sockets must use a green background overlay without an outline",
    );
    assert.ok(
      highlightedSlotOverlayRule?.includes("opacity: 0.2") &&
        highlightedSlotOverlayRule.includes(
          "animation: inventory-compatible-slot-pulse 2400ms ease-in-out infinite",
        ) &&
        /@keyframes inventory-compatible-slot-pulse\s*\{[\s\S]*?opacity:\s*0\.5;/.test(
          style,
        ),
      "Compatible socket backgrounds must pulse slowly between 20% and 50% opacity",
    );
    const highlightedItemRule = style.match(
      /\.inventory-list-item\.inventory-list-item--compatible:not\(\.inventory-list-item--selected\)::after\s*\{[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(
      highlightedItemRule?.includes("background: var(--inventory-success)") &&
        highlightedItemRule.includes("inset: 0") &&
        highlightedItemRule.includes("opacity: 0.2") &&
        highlightedItemRule.includes(
          "animation: inventory-compatible-slot-pulse 2400ms ease-in-out infinite",
        ) &&
        !highlightedItemRule.includes("border:") &&
        !highlightedItemRule.includes("box-shadow:"),
      "Compatible inventory cards must use the same green background pulse as sockets without a selection frame",
    );
    assert.ok(
      style.includes("--inventory-slot-size: var(--inventory-card-size)"),
      "Legacy progression bars must inherit the Inventory card size",
    );
    const ratingBadgeRule = style.match(
      /\.inventory-item-card__rating-badge\s*\{([^}]+)\}/,
    )?.[1];
    assert.ok(
      style.includes("object-position: center center") &&
        ratingBadgeRule?.includes("display: flex") &&
        ratingBadgeRule.includes("align-items: center") &&
        ratingBadgeRule.includes("justify-content: center"),
      "Item artwork and optional rating-tier numbers must remain centered",
    );
    assert.doesNotMatch(
      style,
      /\.inventory-auto-settings\s*\{[^}]*display\s*:\s*none/s,
      "Auto refill settings must remain accessible on narrow layouts",
    );
  }

  #assertApplicationFactoryContract(uiSource) {
    const factory = this.#reader.readApplicationFactory();
    const itemFactory = this.#reader.readItemViewFactory();
    const commandService = this.#reader.readCommandService();
    for (const token of [
      "activeTackle",
      "mainSlots",
      "auxiliarySlots",
      "rootInstanceId",
      "socketId",
      "slotIndex",
      "parentInstanceId",
      "selectedInstanceId",
      "highlightedEquipmentSlotId",
      "compatibleWithHighlightedSlot",
      "tooltipContext",
      "activeCategoryId",
      "activeSubfilterIds",
      "subfilters",
      "this.#contextItemFilter.filter",
      "contextFiltered",
      "#createProjectedItemView",
      "this.#itemViews.create(instanceId)",
      "fishing_bait",
      "groundbait",
      'id: "nets"',
      'label: "Підсаки"',
      "— гачок",
    ]) {
      assert.ok(
        factory.includes(token),
        `View-model factory must emit ${token}`,
      );
    }
    assert.ok(
      factory.includes(
        "highlighted: highlightedSocketIds.has(target.socketId)",
      ) && factory.includes("findPlacementTargets"),
      "Socket highlighting must use the shared empty-first placement targets",
    );
    assert.ok(
      commandService.includes(
        "this.#attachmentTargetResolver.findPlacementTargets",
      ),
      "Assembly actions and socket highlighting must share placement resolution",
    );
    assert.ok(
      !factory.includes("highlighted: !child"),
      "Highlight state must not be limited to empty sockets",
    );
    assert.ok(
      itemFactory.includes('["boat", "chum_delivery"]'),
      "Boat charge must support both delivery item types",
    );
    assert.ok(
      !uiSource.includes("item.level") &&
        uiSource.includes("this.#progressionDomAdapter.apply("),
      "Item renderer must delegate the optional rating-tier badge to its adapter",
    );
    assert.ok(
      uiSource.includes("InventoryTooltipPresenter") &&
        uiSource.includes("InventoryBalanceParameterResolver") &&
        uiSource.includes("technicalPath") &&
        uiSource.includes("baseline") &&
        uiSource.includes("delta") &&
        uiSource.includes("#scrollTooltipFirst") &&
        !uiSource.includes("appendTooltip"),
      "Inventory cards must use the dedicated balance-only tooltip",
    );
    assert.ok(
      !uiSource.includes('"inventory-item-card__name"'),
      "Item miniatures must not render text labels",
    );
    assert.ok(
      !uiSource.includes('"inventory-item-card__status"') &&
        !uiSource.includes('"Чернетка"'),
      "Draft miniatures must use a dot without a text strip",
    );
    assert.ok(
      !uiSource.includes('isBlocked ? "×" : "+"'),
      "Empty sockets must not render plus or cross glyphs",
    );
    assert.match(itemFactory, /status:\s*state\?\.isDraft\s*\?\s*"draft"/);
    assert.match(itemFactory, /state\?\.isPrepared\s*\?\s*"prepared"/);
    assert.ok(
      uiSource.includes('item.status === "draft"') &&
        uiSource.includes('item.status === "prepared"'),
      "UI long press must recognize factory assembly status",
    );
    const actionNames = [
      "OPEN",
      "CLOSE",
      "CATEGORY_SELECT",
      "SUBFILTER_TOGGLE",
      "SORT_CRITERION_SELECT",
      "SORT_DIRECTION_SELECT",
      "RARITY_FILTER_TOGGLE",
      "INVENTORY_ITEM_ACTIVATE",
      "INVENTORY_ITEM_LONG_PRESS",
      "EQUIPMENT_SLOT_ACTIVATE",
      "EQUIPMENT_SLOT_LONG_PRESS",
      "ASSEMBLY_SOCKET_ACTIVATE",
      "ASSEMBLY_EQUIP",
      "ASSEMBLY_UNEQUIP",
      "ASSEMBLY_DISASSEMBLE",
      "ASSEMBLY_BACK",
      "LOADOUT_SAVE",
      "LOADOUT_PREVIEW_SLOT_EQUIP",
      "LOADOUT_EQUIP_ALL",
      "LOADOUT_PREVIEW_BACK",
      "AUTO_BAIT_CHANGE",
      "AUTO_CHUM_CHANGE",
    ];
    actionNames.forEach((actionName) => {
      assert.ok(
        commandService.includes(`case InventoryActionType.${actionName}:`),
        `Command service must handle ${actionName}`,
      );
    });
    for (const payloadField of [
      "action.categoryId",
      "action.instanceId",
      "action.slotId",
      "action.rootInstanceId",
      "action.parentInstanceId",
      "action.slotIndex",
      "action.name",
      "action.loadoutId",
      "action.enabled",
    ]) {
      assert.ok(
        commandService.includes(payloadField),
        `Command service must consume ${payloadField}`,
      );
    }
  }

  #assertViewModelContract() {
    const sandbox = { console };
    sandbox.globalThis = sandbox;
    new SourceRuntime({ globals: sandbox })
      .load("src/game/presentation/inventory/inventory_action_type.js")
      .load("src/game/presentation/inventory/inventory_facade_contract.js")
      .load("src/game/presentation/inventory/inventory_action_contract.js")
      .load(
        "src/game/presentation/inventory/inventory_view_model_normalizer.js",
      );
    const Normalizer = sandbox.InventoryViewModelNormalizer;
    const actions = sandbox.InventoryActionType;
    const ActionContract = sandbox.InventoryActionContract;
    const normalized = new Normalizer().normalize({
      header: {
        activeTackle: {
          baits: [{ id: "bait" }],
          chums: [{ id: "tackle-chum" }],
        },
        handChum: [{ id: "must-not-leak" }],
        boatChums: [{ id: "must-not-leak" }],
      },
      tooltipContext: {
        equipment: {
          rod: { instanceId: "active-rod", itemType: "rod", variant: "pole" },
        },
      },
      panel: {
        loadout: {
          mainSlots: [
            { slotId: "float", label: "Float" },
            { slotId: "rod", label: "Rod" },
            { slotId: "reel", label: "Reel", visible: false },
          ],
          auxiliarySlots: [
            { slotId: "gasMask", label: "Gas mask", state: "locked" },
            { slotId: "handChum", label: "Hand chum" },
            { slotId: "delivery", label: "Boat" },
            { slotId: "net", label: "Net" },
          ],
        },
      },
      inventory: {
        mode: "saved-loadout",
        savedLoadout: {
          loadoutId: "saved-kit",
          name: "Saved kit",
          slots: [
            {
              slotId: "rod",
              label: "Rod",
              item: { instanceId: "saved-rod", name: "Saved rod" },
            },
          ],
        },
      },
    });

    assert.deepStrictEqual(
      Array.from(normalized.panel.loadout.mainSlots, (slot) => slot.slotId),
      ["rod", "float"],
    );
    assert.deepStrictEqual(
      Array.from(
        normalized.panel.loadout.auxiliarySlots,
        (slot) => slot.slotId,
      ),
      ["net", "handChum", "delivery", "gasMask"],
    );
    assert.strictEqual(normalized.header.activeBaits.length, 1);
    assert.strictEqual(normalized.header.activeChums.length, 1);
    assert.strictEqual(
      normalized.tooltipContext.equipment.rod.instanceId,
      "active-rod",
    );
    assert.strictEqual(normalized.inventory.mode, "saved-loadout");
    assert.strictEqual(
      normalized.inventory.savedLoadout.loadoutId,
      "saved-kit",
    );
    assert.strictEqual(actions.OPEN, "inventory/open");
    this.#validActionSamples(actions).forEach((action) => {
      assert.strictEqual(ActionContract.assert(action), action);
    });
    assert.throws(
      () =>
        ActionContract.assert({
          type: actions.ASSEMBLY_SOCKET_ACTIVATE,
          rootInstanceId: "root",
          socketId: "hook[0]",
          slotId: "hook",
          slotIndex: -1,
          parentInstanceId: "root",
        }),
      /slotIndex/,
    );
  }

  #assertAllInteractions(files) {
    const timers = new FakeTimers();
    const document = new FakeDocument();
    let sandbox = {
      console,
      document,
      setTimeout: (callback, delay) => timers.setTimeout(callback, delay),
      clearTimeout: (id) => timers.clearTimeout(id),
    };
    const runtime = new SourceRuntime({ globals: sandbox });
    const context = runtime.context;
    sandbox = context;
    runtime.load(
      "src/game/presentation/inventory/inventory_item_parameter_config.js",
      {
        expose: [
          "INVENTORY_ITEM_PARAMETER_CONFIG",
          "INVENTORY_ITEM_PARAMETER_ALIASES",
          "INVENTORY_BALANCE_TOOLTIP_CONFIG",
          "INVENTORY_RARITY_NAMES",
        ],
      },
    );
    files.forEach((file) => {
      runtime.load(file.relativePath);
    });
    runtime.load("src/platform/browser/dom/horizontal_scroll_controller.js");
    runtime.load("src/platform/browser/dom/scroll_container_aligner.js");
    // Spec 093: a tab tap brings the tab row to the top of the nearest vertical scroller (smooth unless reduced motion);
    // the browser clamps the target at the end of the content.
    for (const reduced of [false, true]) {
      const calls = [];
      const scroller = {
        parentElement: null,
        scrollHeight: 900,
        clientHeight: 600,
        scrollTop: 100,
        getBoundingClientRect: () => ({ top: 106 }),
        scrollTo: (options) => calls.push(options),
      };
      const plain = { parentElement: scroller };
      const row = {
        parentElement: plain,
        getBoundingClientRect: () => ({ top: 506 }),
      };
      const styles = new Map([
        [scroller, "auto"],
        [plain, "visible"],
      ]);
      new sandbox.ScrollContainerAligner({
        windowRef: {
          getComputedStyle: (node) => ({ overflowY: styles.get(node) }),
          matchMedia: () => ({ matches: reduced }),
        },
      }).alignToTop(row);
      assert.strictEqual(
        JSON.stringify(calls),
        JSON.stringify([{ top: 500, behavior: reduced ? "auto" : "smooth" }]),
        "the tab row meets the scroller's top",
      );
    }
    {
      // The editor's sticky actions bar keeps the scroller's top covered: the tab row stops below it and its gap.
      const calls = [];
      const bar = {
        getBoundingClientRect: () => ({ height: 60 }),
        contains: () => false,
      };
      const scroller = {
        parentElement: null,
        scrollHeight: 900,
        clientHeight: 600,
        scrollTop: 100,
        children: [bar],
        getBoundingClientRect: () => ({ top: 106 }),
        scrollTo: (options) => calls.push(options),
      };
      const row = {
        parentElement: scroller,
        getBoundingClientRect: () => ({ top: 506 }),
      };
      bar.parentElement = scroller;
      const styles = new Map([
        [scroller, { overflowY: "auto", rowGap: "10px" }],
        [bar, { position: "sticky", top: "0px" }],
      ]);
      new sandbox.ScrollContainerAligner({
        windowRef: {
          getComputedStyle: (node) => styles.get(node) || {},
          matchMedia: () => ({ matches: true }),
        },
      }).alignToTop(row);
      assert.strictEqual(
        JSON.stringify(calls),
        JSON.stringify([{ top: 430, behavior: "auto" }]),
        "the tab row stops below the sticky actions bar and the editor gap",
      );
    }
    let identities = 0;
    for (const exports of runtime.moduleNamespaces)
      for (const [name, value] of Object.entries(exports))
        if (Object.hasOwn(runtime.context, name)) {
          if (runtime.context[name] !== value)
            throw new Error("UI export identity changed: " + name);
          identities++;
        }
    assert.ok(
      identities > 0,
      "UI scenario must verify published ESM identities",
    );
    sandbox.InventoryItemParametersResolver = bindConstructorDefaults(
      sandbox.InventoryItemParametersResolver,
      () => ({
        resourceMeterResolver: new sandbox.InventoryResourceMeterResolver(),
      }),
    );

    const dispatched = [];
    const observed = [];
    let subscriber = null;
    let currentView = this.#loadoutViewModel();
    const facade = {
      getViewModel: () => currentView,
      subscribe: (listener) => {
        subscriber = listener;
        return () => {
          subscriber = null;
        };
      },
      dispatch: (action) => {
        dispatched.push(action);
        observed.push(action);
        return { refresh: false };
      },
    };
    const ui = sandbox.InventoryUiBootstrap.create({
      facade,
      uiSurface: {
        getMetrics: () => ({
          valid: true,
          hoverEnabled: true,
          logicalWidth: 1280,
          logicalHeight: 720,
          safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
        subscribe: () => () => {},
        portalRoot: document.body,
        physicalToLogicalDelta: (value) => value,
        physicalToLogicalRect: (value) => value,
      },
      documentRef: document,
      mountNode: document.body,
      warningTimers: new BrowserTimeoutScheduler(sandbox),
    });
    ui.open();
    const headerPills = this.#findAllByClass(ui.rootNode, "inventory-toggle");
    assert.strictEqual(
      headerPills.length,
      2,
      "bait and groundbait each have one combined control",
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-toggle__thumb").length,
      2,
    );
    assert(
      headerPills.every(
        (pill) =>
          this.#findByClass(pill, "inventory-toggle__thumb").textContent ===
          "A",
      ),
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-toggle__placeholder").length,
      2,
      "unset consumables use vector placeholders",
    );
    const headerDom = new sandbox.InventoryDomFactory(document);
    const loadRenderer = new sandbox.InventoryLoadRenderer({
      config: sandbox.INVENTORY_LOAD_METER_CONFIG,
      scaleRenderer: new sandbox.InventoryScaleRenderer({
        domFactory: headerDom,
        resourceMeterRenderer: new sandbox.InventoryResourceMeterRenderer({
          domFactory: headerDom,
        }),
      }),
    });
    const headerRenderer = new sandbox.InventoryHeaderRenderer({
      domFactory: headerDom,
      closeButtonRenderer: new sandbox.UiCloseButtonRenderer({
        domFactory: headerDom,
      }),
      autoSwitchRenderer: new sandbox.UiAutoSwitchRenderer({
        domFactory: headerDom,
      }),
      loadRenderer,
    });
    let toggled = null;
    const selectedHeader = headerRenderer.render(
      {
        loadLabel: "Load",
        loadValue: 1,
        loadUnit: "kg",
        activeBaits: [{ name: "Worm", imageUrl: "assets/worm.svg" }],
        activeChums: [{ name: "Mix", imageUrl: "assets/mix.svg" }],
        baitStock: 17,
        chumStock: 8,
      },
      { autoBait: true, autoChum: false },
      {
        onAutoBaitChange: (value) => {
          toggled = value;
        },
      },
    );
    assert.strictEqual(
      this.#findAllByClass(selectedHeader, "inventory-toggle__placeholder")
        .length,
      0,
      "selected item artwork replaces both category illustrations",
    );
    assert.strictEqual(
      this.#findByClass(selectedHeader, "inventory-header__load"),
      selectedHeader.children[1],
      "the load scale belongs to the header's separate lower row",
    );
    assert.strictEqual(
      this.#findAllByClass(selectedHeader.children[0], "inventory-load").length,
      0,
      "the upper row remains available for consumables and close",
    );
    const loadScale = loadRenderer.create();
    loadRenderer.update(loadScale, {
      loadLabel: "Load",
      loadValue: 1,
      loadUnit: "kg",
    });
    const loadMeter = this.#findByClass(loadScale, "inventory-resource-meter");
    assert.strictEqual(
      loadMeter.style.getPropertyValue("--inventory-resource-percent"),
      "1%",
      "one kilogram fills one percent of the owner's fixed 100kg scale",
    );
    assert.ok(
      loadScale.classList.contains("inventory-scale") &&
        loadScale.classList.contains("inventory-load"),
    );
    assert.strictEqual(
      this.#findByClass(loadScale, "inventory-scale__value").textContent,
      "1 kg",
    );
    loadRenderer.update(loadScale, {
      loadLabel: "Load",
      loadValue: 120,
      loadUnit: "kg",
    });
    assert.strictEqual(
      loadMeter.style.getPropertyValue("--inventory-resource-percent"),
      "100%",
    );
    assert.strictEqual(
      this.#findByClass(loadScale, "inventory-resource-meter"),
      loadMeter,
      "load changes retain the shared meter node",
    );
    assert.deepStrictEqual(
      this.#findAllByClass(selectedHeader, "inventory-toggle__count").map(
        (node) => node.textContent,
      ),
      ["17", "1"],
      "automatic mode shows reserve; manual mode shows the equipped portion",
    );
    const selectedSwitch = this.#findById(
      selectedHeader,
      "inventory-auto-bait",
    );
    assert(
      selectedSwitch.checked &&
        selectedSwitch.getAttribute("aria-label").includes("17"),
    );
    selectedSwitch.checked = false;
    selectedSwitch.emit("change");
    assert.strictEqual(
      toggled,
      false,
      "the combined pill keeps the authoritative settings callback",
    );
    const baitPickView = this.#loadoutViewModel();
    baitPickView.header.baitSlots = [
      { available: true, item: null },
      { available: true, item: null },
    ];
    ui.render(baitPickView);
    const baitButtons = this.#findAllByClass(
      this.#findByClass(ui.rootNode, "inventory-auto-settings"),
      "inventory-toggle__item",
    );
    baitButtons[1].click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.CONSUMABLE_SLOT_ACTIVATE,
      kind: "bait",
      slotIndex: 1,
      listVisible: false,
    });
    // Spec 074: a rendered item host (landscape) reports the visible list, so the pick keeps the section.
    const listHost = this.#findByClass(
      ui.rootNode,
      "inventory-main__section--items",
    );
    listHost.layoutVisible = true;
    baitButtons[1].click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.CONSUMABLE_SLOT_ACTIVATE,
      kind: "bait",
      slotIndex: 1,
      listVisible: true,
    });
    listHost.layoutVisible = false;
    assert.strictEqual(
      this.#findById(ui.rootNode, "inventory-auto-bait").checked,
      false,
      "selecting bait does not toggle automatic mode",
    );
    assert.ok(
      baitButtons[0].classList.contains("inventory-toggle__item--available"),
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-toggle--multiple").length,
      1,
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-toggle__placeholder").length,
      3,
    );
    ui.render(currentView);
    assert.strictEqual(dispatched[0].type, sandbox.InventoryActionType.OPEN);
    dispatched.length = 0;

    assert.strictEqual(typeof subscriber, "function");
    subscriber({ viewModel: currentView, warning: "Partial refill" });
    const warningHint = this.#findByClass(ui.rootNode, "inventory-warning");
    const warningNode = this.#findByClass(warningHint, "ui-hint__text");
    assert.strictEqual(warningNode.textContent, "Partial refill");
    assert.ok(
      !warningHint.hidden &&
        warningHint.classList.contains("ui-hint") &&
        warningHint.classList.contains("ui-hint--warning"),
    );
    const mainNode = this.#findByClass(ui.rootNode, "inventory-main");
    const headerHost = this.#findByClass(
      ui.rootNode,
      "inventory-modal__header-host",
    );
    const hintRegion = this.#findByClass(ui.rootNode, "inventory-modal__hints");
    assert.deepStrictEqual(
      Array.from(ui.rootNode.children),
      [hintRegion, headerHost, mainNode],
      "The modal holds the hint region, the header and the main area (spec 086)",
    );
    assert.strictEqual(
      ui.rootNode.children.length,
      this.modalRowTracks?.length ?? 3,
      "Every modal grid row has its child; the main area is the last, stretching row (G-061)",
    );
    assert.strictEqual(
      warningHint.parentNode,
      hintRegion,
      "The warning lies in the hint region above the header (spec 086)",
    );
    this.#findByClass(warningHint, "ui-hint__close").click();
    assert.ok(warningHint.hidden, "The close button dismisses the warning");
    subscriber({ viewModel: currentView, warning: "Partial refill" });
    assert.ok(!warningHint.hidden, "A new warning reopens the closed hint");
    subscriber(currentView);

    const bottomAuxiliary = this.#findByClass(
      ui.rootNode,
      "inventory-loadout-panel__auxiliary",
    );
    const equipmentHost = this.#findByClass(mainNode, "inventory-main__left");
    const itemsHost = this.#findByClass(mainNode, "inventory-main__right");
    // Spec 077: the section content and the tab bar share one parent, the sidebar; the item host stays beside it.
    const sidebar = this.#findByClass(mainNode, "inventory-main__sidebar");
    assert.ok(
      sidebar.parentNode === mainNode &&
        equipmentHost.parentNode === sidebar &&
        itemsHost.parentNode === mainNode,
      "the sidebar holds the section content beside the item host",
    );
    assert(
      equipmentHost.contains(bottomAuxiliary) &&
        !itemsHost.contains(bottomAuxiliary),
      "auxiliary equipment belongs exclusively to the equipment container",
    );
    assert(
      itemsHost.contains(this.#findByClass(ui.rootNode, "inventory-list-grid")),
      "inventory items occupy the separate sibling container",
    );
    ["net", "handChum", "delivery", "gasMask"].forEach((slotId) => {
      assert.ok(bottomAuxiliary.contains(this.#field(ui.rootNode, slotId)));
    });
    assert.deepStrictEqual(
      Array.from(bottomAuxiliary.children, (field) => field.dataset.slotId),
      ["net", "handChum", "delivery", "gasMask"],
      "Bottom equipment row must render net, hand chum, boat and gas mask in order",
    );
    // Spec 067: the section tab bar sits in its own grid area below the equipment container.
    const sectionTabs = this.#findByClass(mainNode, "inventory-section-tabs");
    assert.ok(
      sectionTabs.parentNode === sidebar && sidebar.children[1] === sectionTabs,
      "the tab bar is the sidebar's bottom child",
    );
    assert.ok(sectionTabs.classList.contains("inventory-main__tabs"));
    const tabList = this.#findByClass(
      sectionTabs,
      "inventory-section-tabs__list",
    );
    const tabs = this.#findAllByClass(
      sectionTabs,
      "inventory-section-tabs__tab",
    );
    assert.strictEqual(tabList.getAttribute("role"), "tablist");
    assert.deepStrictEqual(
      tabs.map((tab) => tab.dataset.sectionId),
      ["equipment", "backpack", "keepnet"],
    );
    assert.deepStrictEqual(
      tabs.map((tab) => tab.getAttribute("aria-label")),
      ["Екіпіровка", "Рюкзак", "Садок"],
    );
    tabs.forEach((tab) => {
      const icon = tab.children[0];
      assert.strictEqual(tab.getAttribute("role"), "tab");
      assert.strictEqual(
        icon.namespaceURI,
        "http://www.w3.org/2000/svg",
        "tab labels are SVG icons",
      );
      assert.strictEqual(
        icon.children[0].getAttribute("href"),
        "assets/ui/inventory-sections.svg#" + tab.dataset.sectionId,
      );
      assert.strictEqual(tab.textContent, "", "tabs carry no visible text");
    });
    const activeTabs = () =>
      tabs
        .filter((tab) =>
          tab.classList.contains("inventory-section-tabs__tab--active"),
        )
        .map((tab) => tab.dataset.sectionId);
    assert.deepStrictEqual(activeTabs(), ["equipment"]);
    assert.deepStrictEqual(
      tabs.map((tab) => [tab.getAttribute("aria-selected"), tab.tabIndex]),
      [
        ["true", 0],
        ["false", -1],
        ["false", -1],
      ],
    );
    // Step 2: a tab dispatches SECTION_SELECT; the rendered view model decides the visible section hosts.
    dispatched.length = 0;
    tabs[1].click();
    assert.deepStrictEqual(
      dispatched.map((action) => [action.type, action.sectionId]),
      [[sandbox.InventoryActionType.SECTION_SELECT, "backpack"]],
    );
    assert.deepStrictEqual(
      activeTabs(),
      ["equipment"],
      "the tab follows the authoritative state, not the click",
    );
    tabList.emit("keydown", { key: "ArrowLeft", target: tabs[0] });
    tabList.emit("keydown", { key: "Home", target: tabs[2] });
    tabList.emit("keydown", { key: "End", target: tabs[0] });
    assert.deepStrictEqual(
      dispatched.slice(1).map((action) => action.sectionId),
      ["keepnet", "equipment", "keepnet"],
      "arrow keys wrap and Home/End select the first and last sections",
    );
    assert.strictEqual(
      document.activeElement,
      tabs[2],
      "keyboard selection moves focus",
    );
    assert.throws(
      () =>
        sandbox.InventoryActionContract.assert({
          type: sandbox.InventoryActionType.SECTION_SELECT,
          sectionId: "shop",
        }),
      /Unknown inventory section/,
    );
    const host = (sectionId) =>
      this.#findByClass(ui.rootNode, "inventory-main__section--" + sectionId);
    const leftHosts = ["equipment", "backpack"].map(host);
    const [equipmentSection, backpackSection] = leftHosts;
    const itemsSection = host("items");
    const keepnetSections = this.#findAllByClass(
      ui.rootNode,
      "inventory-main__section--keepnet",
    );
    assert.strictEqual(
      keepnetSections.length,
      2,
      "the keepnet section has a summary host and a content host",
    );
    assert.ok(
      equipmentHost.contains(equipmentSection) &&
        equipmentHost.contains(backpackSection) &&
        equipmentHost.contains(keepnetSections[0]),
    );
    assert.ok(
      itemsHost.contains(itemsSection) &&
        itemsHost.contains(keepnetSections[1]),
    );
    const visibleSections = () =>
      [
        equipmentSection,
        backpackSection,
        keepnetSections[0],
        itemsSection,
        keepnetSections[1],
      ].map((node) => !node.hidden);
    assert.deepStrictEqual(visibleSections(), [
      true,
      false,
      false,
      true,
      false,
    ]);
    const keepnetVisibility = [];
    const keepnetSummary = document.createElement("section"),
      keepnetContent = document.createElement("section");
    ui.attachKeepnetSection({
      summaryNode: keepnetSummary,
      contentNode: keepnetContent,
      setVisible: (visible) => keepnetVisibility.push(visible),
    });
    assert.ok(
      keepnetSections[0].contains(keepnetSummary) &&
        keepnetSections[1].contains(keepnetContent),
    );
    const gridBeforeSections = this.#findByClass(
      itemsHost,
      "inventory-list-panel",
    );
    // Spec 074/075: the filters panel, then the pager — tabs above the items panel whose pages are the list over the
    // faded backpack and the backpack view.
    const [listControls, listPager] = gridBeforeSections.children;
    const [pagerTabs, pagerViewport] = listPager.children;
    const [itemsPage, backpackPage] = pagerViewport.children[0].children;
    assert.ok(
      gridBeforeSections.classList.contains("inventory-collection") &&
        listControls.classList.contains("inventory-collection__controls") &&
        listControls.contains(
          this.#findByClass(gridBeforeSections, "inventory-categories"),
        ) &&
        listPager.classList.contains("inventory-pager") &&
        pagerTabs.classList.contains("inventory-pager__tabs") &&
        pagerViewport.classList.contains("inventory-collection__items") &&
        itemsPage.contains(
          this.#findByClass(gridBeforeSections, "inventory-list-grid"),
        ) &&
        itemsPage.contains(
          this.#findByClass(
            gridBeforeSections,
            "inventory-collection__backdrop",
          ),
        ) &&
        backpackPage.contains(
          this.#findByClass(backpackPage, "inventory-backpack__capacity"),
        ),
      "the backpack list is a filters panel and a two-page items pager",
    );
    assert.strictEqual(
      this.#findByClass(itemsPage, "inventory-collection__backdrop").src,
      "assets/items/briefcases/briefcase--1--open.webp",
    );
    assert.ok(
      fs.existsSync(
        path.join(
          ROOT,
          this.#findByClass(itemsPage, "inventory-collection__backdrop").src,
        ),
      ),
      "the configured backpack backdrop must exist after source-master cleanup",
    );
    // Spec 076 follow-up: the scrolling list must keep a bounded height. Every node from the panel to the grid is a
    // height-passing flex/grid box (min-height: 0); an unstyled wrapper let the grid grow with its cards and stopped all
    // vertical scrolling.
    const listGridNode = this.#findByClass(
      gridBeforeSections,
      "inventory-list-grid",
    );
    const heightChain = [];
    for (
      let node = listGridNode;
      node && node !== gridBeforeSections;
      node = node.parentNode
    )
      heightChain.unshift(node);
    assert.deepStrictEqual(
      heightChain.map((node) => node.className.split(" ")[0]),
      [
        "inventory-pager",
        "inventory-pager__viewport",
        "inventory-pager__track",
        "inventory-pager__page",
        "inventory-list-grid",
      ],
      "no wrapper sits between the pager page and the scrolling grid",
    );
    const listCss = fs.readFileSync(
      path.join(
        ROOT,
        "src/game/presentation/styles/inventory/list-and-filters.css",
      ),
      "utf8",
    );
    const sharedCss = fs.readFileSync(
      path.join(
        ROOT,
        "src/game/presentation/styles/inventory/shared-controls.css",
      ),
      "utf8",
    );
    for (const [css, rule] of [
      [
        listCss,
        /\.inventory-pager\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;/,
      ],
      [listCss, /\.inventory-pager__viewport\s*\{\s*flex:\s*1;/],
      [
        sharedCss,
        /\.inventory-collection__items\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/,
      ],
      [
        listCss,
        /\.inventory-pager__track\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*min-height:\s*0;/,
      ],
      [
        listCss,
        /\.inventory-pager__page\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*0;/,
      ],
      [
        sharedCss,
        /\.inventory-collection__list\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/,
      ],
    ]) {
      assert.match(
        css,
        rule,
        "each box of the list's height chain passes a bounded height down",
      );
    }
    assert.strictEqual(
      listGridNode.classList.contains("inventory-collection__list"),
      true,
    );
    const pagerTabButtons = this.#findAllByClass(
      pagerTabs,
      "inventory-section-tabs__tab",
    );
    const pagerIndex = () =>
      pagerViewport.style.getPropertyValue("--inventory-pager-index");
    assert.deepStrictEqual(
      pagerTabButtons.map((tab) => tab.getAttribute("aria-label")),
      ["Предмети", "Рюкзак"],
    );
    assert.strictEqual(pagerIndex(), "0");
    pagerTabButtons[1].click();
    assert.strictEqual(
      pagerIndex(),
      "1",
      "the Backpack tab shows the backpack page",
    );
    assert.strictEqual(
      pagerTabButtons[1].getAttribute("aria-selected"),
      "true",
    );
    pagerTabButtons[0].click();
    pagerViewport.layoutWidth = 300;
    const swipe = (fromX, toX, end = "pointerup") => {
      pagerViewport.emit("pointerdown", {
        pointerType: "touch",
        clientX: fromX,
        clientY: 100,
      });
      pagerViewport.emit("pointermove", {
        pointerType: "touch",
        clientX: (fromX + toX) / 2,
        clientY: 101,
      });
      pagerViewport.emit("pointermove", {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
      });
      return pagerViewport.emit(end, {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
      });
    };
    pagerViewport.emit("pointerdown", {
      pointerType: "touch",
      clientX: 250,
      clientY: 100,
    });
    pagerViewport.emit("pointermove", {
      pointerType: "touch",
      clientX: 100,
      clientY: 101,
    });
    assert.strictEqual(
      pagerViewport.style.getPropertyValue("--inventory-pager-position"),
      "0.5",
      "both pages follow the finger",
    );
    pagerViewport.emit("pointerup", {
      pointerType: "touch",
      clientX: 100,
      clientY: 101,
    });
    assert.strictEqual(
      pagerIndex(),
      "1",
      "a left swipe beyond the threshold settles on the backpack page",
    );
    assert.strictEqual(
      pagerViewport.style.getPropertyValue("--inventory-pager-position"),
      "",
      "the transient drag position is removed on release",
    );
    assert.ok(
      pagerViewport.emit("click").defaultPrevented,
      "the click that ends a swipe is suppressed",
    );
    swipe(100, 130);
    assert.strictEqual(pagerIndex(), "1", "a short swipe springs back");
    swipe(50, 250, "pointercancel");
    assert.strictEqual(
      pagerIndex(),
      "1",
      "a cancelled swipe never changes the page",
    );
    swipe(50, 250);
    assert.strictEqual(
      pagerIndex(),
      "0",
      "a right swipe returns to the item list",
    );
    swipe(100, 100);
    pagerViewport.emit("pointerdown", {
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    pagerViewport.emit("pointermove", {
      pointerType: "touch",
      clientX: 104,
      clientY: 160,
    });
    pagerViewport.emit("pointermove", {
      pointerType: "touch",
      clientX: 10,
      clientY: 160,
    });
    pagerViewport.emit("pointerup", {
      pointerType: "touch",
      clientX: 10,
      clientY: 160,
    });
    assert.strictEqual(
      pagerIndex(),
      "0",
      "a vertical gesture stays with list scrolling",
    );
    pagerTabButtons[1].click();
    const sectionView = (activeId) => ({
      ...currentView,
      sections: { activeId, backpackItemCount: 7 },
    });
    ui.render(sectionView("backpack"));
    assert.deepStrictEqual(
      visibleSections(),
      [false, true, false, true, false],
      "backpack: summary left, the item list right",
    );
    assert.deepStrictEqual(
      ["equipment", "backpack", "keepnet"].map((id) =>
        ui.rootNode.classList.contains("inventory-modal--section-" + id),
      ),
      [false, true, false],
      "one root modifier names the visible section",
    );
    assert.deepStrictEqual(activeTabs(), ["backpack"]);
    assert.strictEqual(
      pagerIndex(),
      "0",
      "entering the backpack section starts on the item list",
    );
    // Spec 087: the pager hands swipes past its edges to the sections, the main area swipes the sections in tab
    // order, and a swipe back from the keepnet enters the backpack on its backpack page.
    const sectionSelects = () =>
      dispatched
        .filter(
          (action) =>
            action.type === sandbox.InventoryActionType.SECTION_SELECT,
        )
        .map((action) => action.sectionId);
    const selectsDuring = (gesture) => {
      const before = sectionSelects().length;
      gesture();
      return sectionSelects().slice(before);
    };
    assert.deepStrictEqual(
      selectsDuring(() => swipe(50, 250)),
      ["equipment"],
      "a right swipe on the item list opens equipment",
    );
    assert.strictEqual(pagerIndex(), "0");
    assert.deepStrictEqual(
      selectsDuring(() => swipe(250, 50)),
      [],
      "a left swipe on the item list first shows the backpack page",
    );
    assert.strictEqual(pagerIndex(), "1");
    assert.deepStrictEqual(
      selectsDuring(() => swipe(250, 50)),
      ["keepnet"],
      "the next left swipe opens the keepnet",
    );
    ui.render(sectionView("keepnet"));
    const mainArea = this.#findByClass(ui.rootNode, "inventory-main");
    mainArea.layoutWidth = 300;
    const swipeMain = (fromX, toX, target = mainArea) => {
      mainArea.emit("pointerdown", {
        pointerType: "touch",
        clientX: fromX,
        clientY: 100,
        target,
      });
      mainArea.emit("pointermove", {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
        target,
      });
      return mainArea.emit("pointerup", {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
        target,
      });
    };
    assert.deepStrictEqual(
      selectsDuring(() => swipeMain(250, 50)),
      [],
      "the keepnet is the last section",
    );
    assert.deepStrictEqual(
      selectsDuring(() => swipeMain(50, 250, pagerViewport)),
      [],
      "a gesture that starts in the pager belongs to the pager",
    );
    assert.deepStrictEqual(
      selectsDuring(() => swipeMain(50, 250)),
      ["backpack"],
      "a right swipe on the keepnet opens the backpack",
    );
    assert.ok(
      mainArea.emit("click").defaultPrevented,
      "the click that ends a section swipe is suppressed",
    );
    ui.render(sectionView("backpack"));
    assert.strictEqual(
      pagerIndex(),
      "1",
      "returning from the keepnet enters on the backpack page",
    );
    swipe(50, 250);
    assert.strictEqual(pagerIndex(), "0");
    document.cssProperties["--inventory-swipe"] = "";
    assert.deepStrictEqual(
      selectsDuring(() => {
        swipe(50, 250);
        swipe(250, 50);
        swipeMain(50, 250);
      }),
      [],
      "wide layouts keep neither page nor section swipes",
    );
    assert.strictEqual(pagerIndex(), "0");
    document.cssProperties["--inventory-swipe"] = "on";
    const modalCss = fs.readFileSync(
      path.join(ROOT, "src/game/presentation/styles/inventory/modal.css"),
      "utf8",
    );
    assert.match(
      modalCss,
      /orientation: portrait\)[\s\S]*\.inventory-modal\s*\{[^}]*--inventory-swipe:\s*on;/,
      "only portrait turns the swipes on",
    );
    // Spec 098: a container is no containing block for fixed boxes, and the split modifiers must win over the inset.
    assert.match(
      modalCss,
      /\.inventory-surface > \.inventory-modal\s*\{[^}]*position:\s*absolute;/,
      "the modal fills its inventory surface, not the window",
    );
    assert.match(
      modalCss,
      /\.ui-surface__content > \.inventory-surface\s*\{\s*pointer-events:\s*none;\s*\}/,
      "the surface's content rule sets no inset that would override the split side",
    );
    assert.match(
      modalCss.split("@container ui-surface (orientation: portrait)")[1] || "",
      /\.inventory-main__section--equipment:has\(> \.inventory-assembly-editor\)\s*\{\s*height:\s*100%;/,
      "in portrait the editor scrolls itself, so its sticky actions bar has a scroller to stick in",
    );
    assert.match(
      modalCss,
      /\.inventory-main,\s*\.inventory-main__left,[^{]*\{\s*touch-action:\s*pan-y;/,
      "horizontal touch swipes reach the section swipe",
    );
    assert.match(
      listCss,
      /\.inventory-pager__viewport\s*\{\s*border-color:\s*var\(--inventory-equipment-tab-border\);\s*border-top-width:\s*0;/,
      "the items panel continues the tabs' frame without a top edge",
    );
    // Spec 075: one image container, then a separate stats container with the 0..100 capacity scale.
    const backpackView = this.#findByClass(
      backpackSection,
      "inventory-backpack",
    );
    const [backpackVisual, backpackStats] = backpackView.children;
    assert.ok(
      backpackVisual.classList.contains("inventory-backpack__visual") &&
        backpackStats.classList.contains("inventory-backpack__stats") &&
        this.#findAllByClass(backpackView, "inventory-loadout-panel").length ===
          0,
      "the backpack view has no nested panels",
    );
    assert.strictEqual(
      this.#findByClass(backpackVisual, "inventory-backpack__image").src,
      "assets/items/briefcases/briefcase--1--close.webp",
    );
    for (const view of [
      backpackView,
      this.#findByClass(backpackPage, "inventory-backpack"),
    ]) {
      const capacity = this.#findByClass(view, "inventory-backpack__capacity");
      assert.strictEqual(
        this.#findByClass(capacity, "inventory-scale__value").textContent,
        "7 / 100",
      );
      assert.strictEqual(
        this.#findByClass(
          capacity,
          "inventory-resource-meter",
        ).style.getPropertyValue("--inventory-resource-percent"),
        "7%",
      );
      assert.strictEqual(
        this.#findByClass(capacity, "inventory-scale__icon").src,
        "assets/ui/inventory/backpack.svg",
        "a scale icon is the SVG interface icon, not item artwork",
      );
    }
    ui.render(sectionView("keepnet"));
    assert.deepStrictEqual(
      visibleSections(),
      [false, false, true, false, true],
      "keepnet: parameters left, fish right",
    );
    assert.strictEqual(
      keepnetVisibility.at(-1),
      ui.isOpen,
      "the keepnet refreshes only while its section is visible",
    );
    ui.render(sectionView("equipment"));
    assert.deepStrictEqual(visibleSections(), [
      true,
      false,
      false,
      true,
      false,
    ]);
    assert.strictEqual(keepnetVisibility.at(-1), false);
    assert.strictEqual(
      this.#findByClass(itemsHost, "inventory-list-panel"),
      gridBeforeSections,
      "switching sections keeps the item list DOM",
    );
    ui.render(currentView);
    assert.strictEqual(
      this.#findByClass(mainNode, "inventory-section-tabs"),
      sectionTabs,
      "re-rendering the inventory keeps the tab bar identity",
    );
    ui.render(sectionView("keepnet"));
    ui.close();
    this.#findByClass(document.body, "inventory-backpack-button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.SECTION_SELECT,
      sectionId: "backpack",
    });
    ui.render(sectionView("keepnet"));
    this.#findByClass(document.body, "inventory-backpack-button").click();
    assert.ok(
      ui.isOpen,
      "the backpack shortcut switches away from an open keepnet",
    );
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.SECTION_SELECT,
      sectionId: "backpack",
    });
    ui.render(currentView);

    // The rod condition meter appears only on an equipped rod with an available condition.
    const stableHeader = this.#findByClass(ui.rootNode, "inventory-header");
    const stableSwitch = this.#findById(ui.rootNode, "inventory-auto-bait");
    const switchedView = {
      ...currentView,
      settings: { autoBait: true, autoChum: false },
    };
    ui.render(switchedView);
    assert.strictEqual(
      this.#findByClass(ui.rootNode, "inventory-header"),
      stableHeader,
      "automatic-mode changes retain the header so CSS transitions can run",
    );
    assert.strictEqual(
      this.#findById(ui.rootNode, "inventory-auto-bait"),
      stableSwitch,
      "automatic-mode changes retain the focused checkbox and its bindings",
    );
    const feedbackView = {
      ...currentView,
      equipmentFeedback: {
        revision: 1,
        slotId: "rod",
        instanceId: "rod-active",
      },
    };
    ui.render(feedbackView);
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-slot--equipped-flash")
        .length,
      1,
    );
    ui.render(feedbackView);
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-slot--equipped-flash")
        .length,
      0,
      "an unchanged equipment event never replays its one-time green feedback",
    );
    ui.render(currentView);
    const primaryOf = () =>
      this.#findByClass(ui.rootNode, "inventory-loadout-panel__primary");
    assert.strictEqual(
      this.#findAllByClass(
        ui.rootNode,
        "inventory-loadout-panel__rod-condition",
      ).length,
      0,
    );
    assert.ok(
      !primaryOf().classList.contains(
        "inventory-loadout-panel__primary--single",
      ),
    );
    assert.strictEqual(
      this.#findByClass(primaryOf(), "inventory-loadout-panel__cascade")
        .children.length,
      4,
    );
    const conditionView = this.#loadoutViewModel();
    conditionView.panel.loadout.mainSlots[0].item.condition = {
      available: true,
      percent: 64,
      metricLabel: "Стан",
    };
    ui.render(conditionView);
    const rodCondition = this.#findAllByClass(
      ui.rootNode,
      "inventory-loadout-panel__rod-condition",
    );
    assert.strictEqual(rodCondition.length, 1);
    const rodStats = this.#findByClass(
      ui.rootNode,
      "inventory-loadout-panel__rod-stats",
    );
    assert.ok(
      rodStats.classList.contains("inventory-panel") &&
        rodStats.contains(rodCondition[0]) &&
        !this.#field(ui.rootNode, "rod").contains(rodCondition[0]) &&
        this.#findByClass(ui.rootNode, "inventory-loadout-panel__rod").contains(
          this.#field(ui.rootNode, "rod"),
        ),
      "the meter sits in a stats container under the rod cell",
    );
    assert.ok(
      rodCondition[0].classList.contains("inventory-resource-meter"),
      "the shared resource meter renders the condition",
    );
    assert.strictEqual(rodCondition[0].getAttribute("aria-valuenow"), "64");
    const noRodView = this.#loadoutViewModel();
    noRodView.panel.loadout.mainSlots = [
      { slotId: "rod", label: "Rod", state: "available" },
    ];
    ui.render(noRodView);
    assert.ok(
      primaryOf().classList.contains(
        "inventory-loadout-panel__primary--single",
      ),
      "without a rod the rod cell spans the primary panel",
    );
    assert.strictEqual(
      this.#findAllByClass(primaryOf(), "inventory-loadout-panel__cascade")
        .length,
      0,
    );
    assert.strictEqual(
      this.#findAllByClass(
        ui.rootNode,
        "inventory-loadout-panel__rod-condition",
      ).length,
      0,
      "an empty rod cell shows no condition",
    );
    ui.render(currentView);

    const loadoutShell = this.#findByClass(
      ui.rootNode,
      "inventory-loadout-shell",
    );
    const loadoutPanel = this.#findByClass(
      loadoutShell,
      "inventory-loadout-panel",
    );
    assert.strictEqual(loadoutPanel.parentNode, loadoutShell);
    assert.strictEqual(
      this.#findAllByClass(loadoutShell, "inventory-loadout-save").length,
      0,
      "The normal equipment panel must not contain a permanent save form",
    );

    const reelEmptyButton = this.#findByClass(
      this.#field(ui.rootNode, "reel"),
      "inventory-slot__empty-button",
    );
    assert.strictEqual(reelEmptyButton.textContent, "");
    assert.strictEqual(reelEmptyButton.title, "Reel");

    const gasMaskButton = this.#findByClass(
      this.#field(ui.rootNode, "gasMask"),
      "inventory-slot__empty-button",
    );
    assert.strictEqual(gasMaskButton.textContent, "");
    assert.strictEqual(gasMaskButton.title || "", "");
    gasMaskButton.click();
    assert.strictEqual(
      warningNode.textContent,
      "Gas mask is not unlocked",
      "A blocked slot must explain itself only after activation",
    );

    const equippedBoatMeter = this.#findByClass(
      this.#field(ui.rootNode, "delivery"),
      "inventory-resource-meter",
    );
    // Spec 090: the boat's energy scale has no lightning icon.
    assert.strictEqual(
      this.#findAllByClass(equippedBoatMeter, "inventory-resource-meter__icon")
        .length,
      0,
      "Boat energy meter shows the scale without an icon",
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-item-card__name").length,
      0,
      "Miniatures must not show item names",
    );

    // Spec 076: the item list scrolls by a mouse drag over a card, and neither a drag nor a touch swipe selects it.
    const listGrid = this.#findByClass(ui.rootNode, "inventory-list-grid");
    assert.ok(
      listGrid.classList.contains("inventory-vertical-scroll"),
      "the item list owns vertical drag scrolling",
    );
    // Spec 079: touch-action resolves only up to the nearest scroller, so the list itself declares its native pan axis
    // and leaves horizontal swipes to the pager, as the horizontal filter rows do for theirs.
    const scrollCss = this.#reader.readStyle();
    assert.match(
      scrollCss,
      /\.inventory-vertical-scroll\s*\{[^}]*touch-action:\s*pan-y;/,
      "vertical lists keep only native vertical panning",
    );
    assert.match(
      scrollCss,
      /\.inventory-horizontal-scroll\s*\{[^}]*touch-action:\s*pan-x pan-y;/,
      "horizontal rows declare their native pan axes the same way",
    );
    listGrid.scrollHeight = 900;
    listGrid.clientHeight = 300;
    listGrid.scrollTop = 100;
    const listPointer = (type, pointerType, pointerId, clientY) =>
      listGrid.emit(type, {
        pointerType,
        pointerId,
        clientX: 50,
        clientY,
        detail: 1,
      });
    listPointer("pointerdown", "mouse", 41, 200);
    listPointer("pointermove", "mouse", 41, 140);
    assert.strictEqual(
      listGrid.scrollTop,
      160,
      "dragging up over a card scrolls the list down",
    );
    listPointer("pointerup", "mouse", 41, 140);
    assert.ok(
      listGrid.emit("click", { detail: 1 }).defaultPrevented,
      "the drag's click never selects the card",
    );
    listPointer("pointerdown", "touch", 42, 200);
    listPointer("pointermove", "touch", 42, 150);
    assert.strictEqual(
      listGrid.scrollTop,
      160,
      "touch keeps the browser's native scrolling",
    );
    listPointer("pointercancel", "touch", 42, 150);
    assert.ok(
      listGrid.emit("click", { detail: 1 }).defaultPrevented,
      "a touch swipe never selects the card",
    );
    listPointer("pointerdown", "mouse", 43, 200);
    listPointer("pointerup", "mouse", 43, 201);
    assert.strictEqual(
      listGrid.emit("click", { detail: 1 }).defaultPrevented,
      false,
      "a press without a drag still selects",
    );

    const categoryToggle = this.#findByClass(
      ui.rootNode,
      "inventory-categories__toggle",
    );
    const categoryNavigation = this.#findByClass(
      ui.rootNode,
      "inventory-categories",
    );
    const subfilterPanel = this.#findByClass(
      ui.rootNode,
      "inventory-subfilters",
    );
    categoryNavigation.scrollWidth = 600;
    categoryNavigation.clientWidth = 200;
    categoryNavigation.scrollLeft = 50;
    categoryNavigation.emit("pointerdown", {
      pointerType: "mouse",
      pointerId: 29,
      clientX: 100,
    });
    assert.strictEqual(
      categoryNavigation.classList.contains(
        "inventory-horizontal-scroll--dragging",
      ),
      false,
    );
    assert.strictEqual(categoryNavigation.hasPointerCapture(29), false);
    categoryNavigation.emit("pointermove", {
      pointerType: "mouse",
      pointerId: 29,
      clientX: 96,
    });
    assert.strictEqual(categoryNavigation.scrollLeft, 50);
    categoryNavigation.emit("pointerup", {
      pointerType: "mouse",
      pointerId: 29,
      clientX: 96,
    });
    const shortFilterClick = categoryNavigation.emit("click");
    assert.strictEqual(shortFilterClick.defaultPrevented, false);

    categoryNavigation.scrollLeft = 0;
    const wheelRight = categoryNavigation.emit("wheel", { deltaY: 80 });
    assert.strictEqual(categoryNavigation.scrollLeft, 80);
    assert.strictEqual(wheelRight.defaultPrevented, true);
    categoryNavigation.emit("wheel", { deltaY: -30 });
    assert.strictEqual(
      categoryNavigation.scrollLeft,
      50,
      "Wheel toward the user must scroll right and away must scroll left",
    );
    categoryNavigation.emit("pointerdown", {
      pointerId: 30,
      pointerType: "touch",
      clientX: 120,
    });
    const touchSwipe = categoryNavigation.emit("pointermove", {
      pointerId: 30,
      pointerType: "touch",
      clientX: 70,
    });
    categoryNavigation.emit("pointerup", {
      pointerId: 30,
      pointerType: "touch",
      clientX: 70,
    });
    assert.strictEqual(
      categoryNavigation.scrollLeft,
      50,
      "touch position is owned by native scrolling",
    );
    assert.strictEqual(
      touchSwipe.defaultPrevented,
      false,
      "the browser must retain kinetic touch scrolling",
    );
    assert.strictEqual(categoryNavigation.hasPointerCapture(30), false);
    // The fake DOM has no native gesture engine; emulate the browser's resulting scroll position.
    categoryNavigation.scrollLeft = 100;
    assert.ok(
      !categoryNavigation.classList.contains(
        "inventory-horizontal-scroll--dragging",
      ),
      "Touch swipe must release the horizontal drag state",
    );
    const suppressedSwipeClick = categoryNavigation.emit("click");
    assert.strictEqual(
      suppressedSwipeClick.defaultPrevented,
      true,
      "A completed swipe must not activate a filter button accidentally",
    );
    categoryNavigation.emit("pointerdown", {
      pointerId: 31,
      pointerType: "mouse",
      clientX: 70,
    });
    categoryNavigation.emit("pointermove", {
      pointerId: 31,
      pointerType: "mouse",
      clientX: 110,
    });
    categoryNavigation.emit("pointerup", {
      pointerId: 31,
      pointerType: "mouse",
      clientX: 110,
    });
    assert.strictEqual(
      categoryNavigation.scrollLeft,
      60,
      "Mouse drag must use the same horizontal swipe controller",
    );
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "false");
    categoryToggle.click();
    assert.ok(subfilterPanel.classList.contains("inventory-subfilters--open"));
    assert.ok(
      categoryToggle.classList.contains("inventory-categories__toggle--active"),
    );
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "true");
    const subtypeCheckbox = this.#findByClass(
      subfilterPanel,
      "inventory-subfilters__checkbox",
    );
    subtypeCheckbox.checked = true;
    subtypeCheckbox.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.SUBFILTER_TOGGLE,
      filterId: "hooks",
      enabled: true,
    });
    categoryToggle.click();
    assert.ok(!subfilterPanel.classList.contains("inventory-subfilters--open"));
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "false");
    assert.ok(
      this.#walk(categoryNavigation).some((node) =>
        node.textContent.includes("Підсаки"),
      ),
      "Separate nets category must be rendered",
    );

    const sortToggle = this.#findByClass(
      ui.rootNode,
      "inventory-categories__sort-toggle",
    );
    const sortPanel = this.#findByClass(ui.rootNode, "inventory-sort-options");
    assert.strictEqual(sortToggle.getAttribute("aria-expanded"), "false");
    sortToggle.click();
    assert.ok(sortPanel.classList.contains("inventory-sort-options--open"));
    assert.strictEqual(sortToggle.getAttribute("aria-expanded"), "true");
    const activeSortCriteria = this.#findAllByClass(
      sortPanel,
      "inventory-sort-options__criterion",
    ).filter((button) =>
      button.classList.contains("inventory-sort-options__button--active"),
    );
    assert.strictEqual(activeSortCriteria.length, 2);
    assert.strictEqual(activeSortCriteria[0].dataset.sortPriority, "1");
    assert.strictEqual(activeSortCriteria[1].dataset.sortPriority, "2");
    const sortDirections = this.#findAllByClass(
      sortPanel,
      "inventory-sort-options__direction",
    );
    sortDirections[1].click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.SORT_DIRECTION_SELECT,
      directionId: "descending",
    });
    this.#findByText(sortPanel, "За рідкістю").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.SORT_CRITERION_SELECT,
      criterionId: "rarity",
    });
    const rarityButtons = this.#findAllByClass(
      sortPanel,
      "inventory-sort-options__rarity",
    );
    rarityButtons[1].click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.RARITY_FILTER_TOGGLE,
      rarityId: "rare",
      enabled: true,
    });

    this.#findByClass(ui.rootNode, "inventory-categories__button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.CATEGORY_SELECT,
      categoryId: "all",
    });

    const inventoryCard = this.#inventoryCard(ui.rootNode, "assembly-bag");
    assert.strictEqual(inventoryCard.dataset.longPressDuration, "1500");
    assert.strictEqual(
      this.#findAllByClass(inventoryCard, "inventory-item-card__press-progress")
        .length,
      1,
      "Long press must render one centered circular progress overlay",
    );
    const tooltip = this.#findByClass(document.body, "inventory-tooltip");
    inventoryCard.emit("mouseenter");
    assert.strictEqual(
      this.#findAllByClass(tooltip, "inventory-balance-tooltip__baseline")
        .length,
      0,
    );
    assert.ok(
      !tooltip.textContent.includes("базове значення"),
      "Baseline values must stay out of the parameter display",
    );
    assert.ok(
      tooltip.textContent.includes("Потужність") &&
        !tooltip.textContent.includes("engineStats.maxLoadKg") &&
        tooltip.textContent.includes("1.2 кг") &&
        tooltip.textContent.includes("+0.7 кг") &&
        !tooltip.textContent.includes("Сумісність"),
      "Hover must show balance names, EffectiveItemStats paths, actual values and baseline deltas",
    );
    tooltip.clientHeight = 100;
    tooltip.scrollHeight = 300;
    const tooltipWheel = inventoryCard.emit("wheel", { deltaY: 60 });
    assert.strictEqual(tooltip.scrollTop, 60);
    assert.strictEqual(tooltipWheel.defaultPrevented, true);
    assert.strictEqual(tooltipWheel.propagationStopped, true);
    inventoryCard.emit("wheel", { deltaY: 1000 });
    const inventoryWheelAtTooltipEnd = inventoryCard.emit("wheel", {
      deltaY: 30,
    });
    assert.strictEqual(tooltip.scrollTop, 200);
    assert.strictEqual(
      inventoryWheelAtTooltipEnd.defaultPrevented,
      false,
      "Wheel input must return to the inventory after tooltip reaches its edge",
    );
    inventoryCard.emit("mouseleave");
    assert.strictEqual(tooltip.style.display, "none");
    const compatibleWrapper = inventoryCard.parentNode;
    assert.ok(
      compatibleWrapper.classList.contains("inventory-list-item--compatible"),
      "A card compatible with the selected equipment slot must be green-highlighted",
    );
    const highlightedReelWell = this.#findByClass(
      this.#field(ui.rootNode, "reel"),
      "inventory-slot",
    );
    assert.ok(
      highlightedReelWell.classList.contains("inventory-slot--highlighted"),
      "The selected empty equipment slot must be green-highlighted",
    );
    inventoryCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_ACTIVATE,
      instanceId: "assembly-bag",
    });

    dispatched.length = 0;
    inventoryCard.emit("pointerdown", { pointerId: 7 });
    assert.strictEqual(
      inventoryCard.classList.contains("inventory-item-card--pressing"),
      false,
    );
    timers.advance(299);
    assert.strictEqual(
      inventoryCard.classList.contains("inventory-item-card--pressing"),
      false,
    );
    assert.strictEqual(dispatched.length, 0);
    timers.advance(1);
    assert.strictEqual(
      inventoryCard.classList.contains("inventory-item-card--pressing"),
      true,
    );
    timers.advance(1499);
    assert.strictEqual(dispatched.length, 0, "Long press fired too early");
    timers.advance(1);
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_LONG_PRESS,
      instanceId: "assembly-bag",
    });
    inventoryCard.emit("pointerup", { pointerId: 7 });
    inventoryCard.click();
    assert.strictEqual(dispatched.length, 1, "Long press must suppress click");

    dispatched.length = 0;
    inventoryCard.emit("pointerdown", { pointerId: 8 });
    inventoryCard.emit("pointermove", {
      pointerId: 8,
      clientX: 8,
      clientY: 0,
    });
    timers.advance(300);
    for (let elapsed = 0; elapsed < 1500; elapsed += 250) {
      timers.advance(250);
      ui.updateDynamicProgression(250);
    }
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_LONG_PRESS,
      instanceId: "assembly-bag",
    });
    inventoryCard.emit("pointerup", { pointerId: 8 });
    inventoryCard.click();
    assert.strictEqual(
      dispatched.length,
      1,
      "Movement up to 8px must preserve the long press",
    );

    dispatched.length = 0;
    const refreshedInventoryCard = this.#inventoryCard(
      ui.rootNode,
      "assembly-bag",
    );
    refreshedInventoryCard.emit("pointerdown", { pointerId: 10 });
    refreshedInventoryCard.emit("pointermove", {
      pointerId: 10,
      clientX: 9,
      clientY: 0,
    });
    timers.advance(2300);
    assert.strictEqual(
      dispatched.length,
      0,
      "Movement above 8px must cancel the long press",
    );
    refreshedInventoryCard.emit("pointerup", { pointerId: 10 });

    dispatched.length = 0;
    const savedLoadoutCard = this.#inventoryCard(ui.rootNode, "saved-kit");
    savedLoadoutCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_ACTIVATE,
      instanceId: "saved-kit",
    });
    dispatched.length = 0;
    savedLoadoutCard.emit("pointerdown", { pointerId: 11 });
    timers.advance(1799);
    assert.strictEqual(
      dispatched.length,
      0,
      "Saved loadout disassembly fired before the activation delay and 1500ms countdown",
    );
    timers.advance(1);
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_LONG_PRESS,
      instanceId: "saved-kit",
    });
    savedLoadoutCard.emit("pointerup", { pointerId: 11 });
    savedLoadoutCard.click();
    assert.strictEqual(
      dispatched.length,
      1,
      "Saved loadout long press must suppress its preview click",
    );

    const reelField = this.#field(ui.rootNode, "reel");
    this.#findByClass(reelField, "inventory-slot__empty-button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.EQUIPMENT_SLOT_ACTIVATE,
      slotId: "reel",
      instanceId: null,
      listVisible: false,
    });

    dispatched.length = 0;
    const rodCard = this.#findByClass(
      this.#field(ui.rootNode, "rod"),
      "inventory-item-card",
    );
    assert.strictEqual(rodCard.dataset.longPressDuration, "800");
    rodCard.emit("pointerdown", { pointerId: 12 });
    timers.advance(1099);
    assert.strictEqual(dispatched.length, 0);
    timers.advance(1);
    rodCard.emit("pointerup", { pointerId: 12 });
    rodCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS,
      slotId: "rod",
      instanceId: "rod",
    });
    assert.strictEqual(dispatched.length, 1);

    dispatched.length = 0;
    const tackleCard = this.#findByClass(
      this.#field(ui.rootNode, "tackle"),
      "inventory-item-card",
    );
    assert.strictEqual(tackleCard.dataset.longPressDuration, "800");
    tackleCard.emit("pointerdown", { pointerId: 9 });
    timers.advance(1099);
    assert.strictEqual(dispatched.length, 0);
    timers.advance(1);
    tackleCard.emit("pointerup", { pointerId: 9 });
    tackleCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS,
      slotId: "tackle",
      instanceId: "assembly-active",
    });
    assert.strictEqual(dispatched.length, 1);

    const autoBait = this.#findById(ui.rootNode, "inventory-auto-bait");
    assert.strictEqual(autoBait.getAttribute("role"), "switch");
    autoBait.checked = true;
    autoBait.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.AUTO_BAIT_CHANGE,
      enabled: true,
    });
    const autoChum = this.#findById(ui.rootNode, "inventory-auto-chum");
    autoChum.checked = true;
    autoChum.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.AUTO_CHUM_CHANGE,
      enabled: true,
    });

    const scrollableLoadout = this.#findByClass(
      ui.rootNode,
      "inventory-loadout-panel",
    );
    const scrollableInventory = this.#findByClass(
      ui.rootNode,
      "inventory-list-grid",
    );
    scrollableLoadout.scrollTop = 37;
    scrollableInventory.scrollTop = 91;
    const deliveryItem = currentView.panel.loadout.auxiliarySlots.find(
      (slot) => slot.slotId === "delivery",
    ).item;
    deliveryItem.charge.percent = 62;
    for (let update = 0; update < 4; update += 1) {
      ui.updateDynamicProgression(250);
    }
    assert.strictEqual(scrollableLoadout.scrollTop, 37);
    assert.strictEqual(scrollableInventory.scrollTop, 91);
    assert.strictEqual(equippedBoatMeter.getAttribute("aria-valuenow"), "62");

    const { ItemProgressionDomAdapter } = new SourceRuntime().importModule(
      "src/platform/browser/dom/item_progression_dom_adapter.js",
    );
    const progressionDomAdapter = new ItemProgressionDomAdapter({
      visualResolver: { resolve: () => ({ available: true }) },
      labels: {
        ratingTierOf: (current, maximum) => `Tier ${current} of ${maximum}`,
      },
    });
    const isolatedDom = new sandbox.InventoryDomFactory(document);
    const isolatedItemRenderer = new sandbox.InventoryItemCardRenderer({
      domFactory: isolatedDom,
      attachmentRenderer: new sandbox.InventoryAttachmentBadgeRenderer({
        domFactory: isolatedDom,
      }),
      resourceMeterResolver: new sandbox.InventoryResourceMeterResolver(),
      resourceMeterRenderer: new sandbox.InventoryResourceMeterRenderer({
        domFactory: isolatedDom,
      }),
      progressionDomAdapter,
    });
    const extensibleMeterResolver = new sandbox.InventoryResourceMeterResolver({
      definitions: [
        {
          id: "durability",
          icon: "",
          read: (item) => item?.durability || null,
          fallbackLabel: "Durability",
        },
      ],
    });
    assert.deepStrictEqual(
      JSON.parse(
        JSON.stringify(
          extensibleMeterResolver.resolve({ durability: { percent: 43 } }),
        ),
      ),
      {
        id: "durability",
        percent: 43,
        icon: "",
        title: "Durability",
        value: "43%",
        label: "Durability 43%",
      },
      "New finite resources must be addable through resolver definitions",
    );
    const productionParameters =
      new sandbox.InventoryItemParametersResolver().resolve({
        instanceId: "internal-instance",
        itemType: "system-only-type",
        progression: {
          ratingTier: { available: true, current: 3, maximum: 6 },
          rating: {
            available: true,
            percent: 80,
            metricLabel: "Rating",
          },
        },
        charge: { percent: 72, label: "Charge 72%" },
        condition: { available: true, percent: 80 },
        freshness: { available: true, percent: 82 },
        displayStats: { Power: "12 kg", Range: "45 m", Стан: "80%" },
        displayStatsSchema: {
          rangeMeters: { label: "Range" },
          durability: "Стан: %",
        },
        effectiveStats: { internalRuntimeValue: 999 },
      });
    assert.ok(
      productionParameters.some(
        (parameter) =>
          parameter.id === "ratingTier" && parameter.value === "3 / 6",
      ) &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "resource:energy" &&
            parameter.kind === "resource" &&
            parameter.resource?.percent === 72,
        ) &&
        productionParameters.some(
          (parameter) => parameter.id === "rating" && parameter.value === "80%",
        ) &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "stat:rangeMeters" && parameter.value === "45 m",
        ) &&
        productionParameters.filter((parameter) => parameter.id === "condition")
          .length === 1 &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "freshness" && parameter.value === "82%",
        ) &&
        !productionParameters.some(
          (parameter) =>
            parameter.label === "instanceId" ||
            parameter.label === "internalRuntimeValue",
        ),
      "Large assembly cards must expose only authored gameplay parameters",
    );
    const contextualItem = {
      instanceId: "contextual-bait",
      itemId: "oil_worm",
      itemType: "bait",
      name: "Масляний черв'як",
      progression: {},
      effectiveStats: {},
      baitEffectiveness: {
        available: true,
        baitId: "oil_worm",
        entries: [
          {
            fishId: "perch",
            fishName: "Окунь",
            discovered: true,
            compatible: true,
            multiplier: 2,
            relativeEffectiveness: 1,
            stars: 5,
            maximumStars: 5,
          },
          {
            fishId: "carp",
            fishName: "Короп",
            discovered: true,
            compatible: false,
            multiplier: 0,
            relativeEffectiveness: 0,
            stars: 0,
            maximumStars: 5,
          },
        ],
      },
    };
    const contextualParameters =
      new sandbox.InventoryItemParametersResolver().resolve(contextualItem);
    assert.equal(
      contextualParameters.find(
        (parameter) => parameter.id === "baitEffectiveness",
      )?.kind,
      "effectiveness",
      "Contextual bait effectiveness must be an opt-in UI descriptor",
    );
    const contextualDom = new sandbox.InventoryDomFactory(document);
    const contextualRenderer = new sandbox.InventoryItemParametersRenderer({
      domFactory: contextualDom,
      resolver: new sandbox.InventoryItemParametersResolver(),
      resourceMeterRenderer: new sandbox.InventoryResourceMeterRenderer({
        domFactory: contextualDom,
      }),
    });
    const contextualPanel = contextualRenderer.render(contextualItem);
    const contextualValues = this.#findAllByClass(
      contextualPanel,
      "inventory-bait-effectiveness__value",
    );
    assert.deepEqual(
      contextualValues.map((node) => node.textContent),
      ["★★★★★", "Не підходить"],
      "Contextual UI must distinguish effective and incompatible fish matches",
    );
    // The 250 ms refresh keeps the rows (rebuilding them flashed the list and dropped hover, tooltips and selection).
    const rowsBefore = this.#findAllByClass(contextualPanel, "inventory-parameter");
    const valuesBefore = this.#findAllByClass(contextualPanel, "inventory-bait-effectiveness__value");
    contextualRenderer.update(contextualPanel, contextualItem);
    contextualRenderer.update(contextualPanel, contextualItem);
    const rowsAfter = this.#findAllByClass(contextualPanel, "inventory-parameter");
    assert.ok(rowsBefore.length > 0 && rowsAfter.length === rowsBefore.length &&
      rowsAfter.every((row, index) => row === rowsBefore[index]) &&
      this.#findAllByClass(contextualPanel, "inventory-bait-effectiveness__value")
        .every((node, index) => node === valuesBefore[index] && node.textContent === valuesBefore[index].textContent),
      "an unchanged refresh keeps every parameter row node");
    const balanceResolver = new sandbox.InventoryBalanceParameterResolver({
      debugConfig: { showEffectiveStats: false },
      retrieveSpeedCalculator: {
        calculate: ({
          baseSpeedMetersPerSec,
          bearingCount,
          bearingBonusMetersPerSec,
        }) =>
          Number(baseSpeedMetersPerSec) +
          Number(bearingCount) * Number(bearingBonusMetersPerSec),
      },
      reelConfig: { bearingRetrieveSpeedBonusMetersPerSec: 0.2 },
      castDistanceCalculator: {
        getBuildCastPowerCoefficient: (equipment) =>
          Number(equipment.rod?.effectiveStats?.castPowerCoefficient) || 1,
        describe: (equipment, coefficient = null) => {
          const power =
            coefficient === null
              ? Number(equipment.rod?.effectiveStats?.castPowerCoefficient) || 1
              : Number(coefficient);
          return {
            castPowerCoefficient: power,
            effectiveDistanceMeters: 12 * power,
            effectiveDistancePx: 600 * power,
          };
        },
      },
    });
    const contextualSection = balanceResolver
      .resolve(contextualItem)
      .find((section) => section.id === "bait-effectiveness");
    assert.equal(
      contextualSection?.rows?.[0]?.baseline,
      "×2",
      "Balance tooltip must expose the BiteSystem multiplier",
    );
    const reelBalanceSections = balanceResolver.resolve({
      instanceId: "balance-reel",
      itemType: "reel",
      variant: "spinning_reel",
      effectiveStats: {
        retrieveSpeedMetersPerSec: 0.8,
        bearingCount: 3,
        lineCapacityMeters: 20,
      },
      displayStatsSchema: {
        retrieveSpeedMetersPerSec: { label: "Підмотка", suffix: "м/с" },
      },
      progression: {
        rating: {
          breakdown: [
            {
              id: "retrieveSpeedMetersPerSec",
              minimum: 0.4,
            },
            { id: "bearingCount", minimum: 0 },
          ],
        },
      },
    });
    const reelBalanceRows = reelBalanceSections.flatMap(
      (section) => section.rows,
    );
    const engineRetrieveSpeed = reelBalanceRows.find(
      (row) => row.id === "stat:retrieveSpeedMetersPerSec",
    );
    const effectiveRetrieveSpeed = reelBalanceRows.find(
      (row) => row.id === "effective-retrieve-speed",
    );
    const retrieveDuration = reelBalanceRows.find(
      (row) => row.id === "retrieve-duration",
    );
    assert.strictEqual(
      engineRetrieveSpeed.technicalPath,
      "effectiveStats.retrieveSpeedMetersPerSec",
    );
    assert.strictEqual(engineRetrieveSpeed.actual, "0.8 м/с");
    assert.strictEqual(engineRetrieveSpeed.delta, "+0.4 м/с");
    assert.strictEqual(effectiveRetrieveSpeed.actual, "1.4 м/с");
    assert.strictEqual(retrieveDuration.tone, "positive");
    assert.ok(
      retrieveDuration.delta.startsWith("-") &&
        retrieveDuration.impacts[0].value.startsWith("-"),
      "Reduced retrieve duration from bearings must be a green negative-time bonus",
    );
    assert.strictEqual(reelBalanceSections[0].id, "retrieve");
    assert.ok(
      !reelBalanceSections.some((section) => section.id === "engine"),
      "EffectiveItemStats must be hidden by default",
    );
    const debugBalanceResolver = new sandbox.InventoryBalanceParameterResolver({
      debugConfig: { showEffectiveStats: true },
    });
    const debugSections = debugBalanceResolver.resolve({
      itemType: "hook",
      effectiveStats: { maxLoadKg: 2 },
    });
    assert.strictEqual(debugSections.at(-1).id, "effective-stats");
    assert.strictEqual(debugSections.at(-1).showTechnicalPaths, true);
    const missingBaseline = debugSections
      .flatMap((section) => section.rows)
      .find((row) => row.id === "stat:maxLoadKg");
    assert.strictEqual(Object.hasOwn(missingBaseline, "baseline"), false);
    assert.strictEqual(Object.hasOwn(missingBaseline, "baselineLabel"), false);
    assert.strictEqual(missingBaseline.delta, "");
    const optionalBaselineConfig = {
      stats: {
        maxLoadKg: { label: "Load", baseline: null },
        bearingCount: { label: "Bearings", baseline: 0 },
      },
    };
    const optionalBaselineRows = new sandbox.InventoryBalanceParameterResolver({
      config: optionalBaselineConfig,
    })
      .resolve({
        itemType: "hook",
        effectiveStats: { maxLoadKg: 2, bearingCount: 3 },
      })
      .flatMap((section) => section.rows);
    assert.strictEqual(
      Object.hasOwn(
        optionalBaselineRows.find((row) => row.id === "stat:maxLoadKg"),
        "baseline",
      ),
      false,
      "A missing baseline must not become an implicit zero",
    );
    assert.strictEqual(
      optionalBaselineRows.find((row) => row.id === "stat:bearingCount")
        .baseline,
      "0",
      "An explicitly configured zero baseline remains available in the read model",
    );

    const upgradedStatRows = balanceResolver
      .resolve({
        instanceId: "quality-nine-hook",
        itemType: "hook",
        quality: 9,
        effectiveStats: { maxLoadKg: 7.12, quality: 9 },
        progression: {
          quality: { value: 9, minimum: 1, maximum: 10 },
          rating: {
            available: true,
            rawValue: 7.12,
            minimum: 5,
            maximum: 8,
            metricId: "maxLoadKg",
            breakdown: [],
          },
        },
      })
      .flatMap((section) => section.rows);
    const upgradedLoad = upgradedStatRows.find(
      (row) => row.id === "stat:maxLoadKg",
    );
    assert.strictEqual(upgradedLoad.actual, "7.12 кг");
    assert.strictEqual(upgradedLoad.delta, "+2.12 кг");
    assert.strictEqual(upgradedLoad.baseline, "5 кг");

    const rodBalanceRows = balanceResolver
      .resolve({
        instanceId: "balance-rod",
        itemType: "rod",
        variant: "spinning",
        effectiveStats: {
          castPowerCoefficient: 0.5,
        },
      })
      .flatMap((section) => section.rows);
    const castDistance = rodBalanceRows.find(
      (row) => row.id === "cast-distance",
    );
    assert.strictEqual(castDistance.actual, "6 м (300 px)");
    assert.strictEqual(castDistance.delta, "-6 м (-300 px)");
    assert.strictEqual(
      castDistance.tone,
      "negative",
      "Reduced cast distance must be marked as harmful",
    );
    const inventoryBoat = isolatedItemRenderer.renderInventoryItem({
      instanceId: "boat-inventory",
      name: "Boat",
      icon: "B",
      charge: { percent: 74, label: "Boat charge 74%" },
    });
    assert.ok(
      !inventoryBoat.classList.contains("item-rarity"),
      "An item without a rarity descriptor must not receive a rarity frame state",
    );
    const inventoryBoatMeter = this.#findByClass(
      inventoryBoat,
      "inventory-resource-meter",
    );
    assert.strictEqual(
      inventoryBoatMeter.className,
      equippedBoatMeter.className,
      "Equipped and inventory boats must use the exact same energy meter",
    );
    assert.strictEqual(
      this.#findAllByClass(inventoryBoatMeter, "inventory-resource-meter__icon")
        .length,
      0,
    );
    // Spec 071: a skin thumbnail is bottom-cropped; an equipment cell's artwork shows whole.
    const backpackArt = "assets/items/briefcases/briefcase--1--close.webp";
    const backpackCard = isolatedItemRenderer.renderInventoryItem({
      instanceId: "backpack",
      name: "Backpack",
      itemType: "backpack",
      iconUrl: backpackArt,
    });
    assert.strictEqual(
      this.#findByClass(backpackCard, "inventory-item-card__image").src,
      backpackArt,
    );
    assert.strictEqual(
      this.#findAllByClass(backpackCard, "inventory-item-card__icon").length,
      0,
      "the backpack uses its full-resolution art instead of an emoji thumbnail",
    );
    const skin = {
      thumbnail: { src: "rod-thumb.png", visibleHeight: 0.5, focusX: 0.31 },
      equipment: { withLine: "rod-line.png", withoutLine: "rod-bare.png" },
    };
    const skinnedCard = isolatedItemRenderer.renderInventoryItem({
      instanceId: "skin-rod",
      name: "Rod",
      icon: "R",
      skin,
    });
    const skinnedVisual = this.#findByClass(
      skinnedCard,
      "inventory-item-card__visual",
    );
    assert.ok(
      skinnedVisual.classList.contains(
        "inventory-item-card__visual--cropped",
      ) &&
        skinnedVisual.style.getPropertyValue(
          "--inventory-item-art-visible-height",
        ) === "0.5" &&
        skinnedVisual.style.getPropertyValue("--inventory-item-art-focus-x") ===
          "0.31" &&
        this.#findByClass(skinnedCard, "inventory-item-card__image").src ===
          "rod-thumb.png",
      "A skin thumbnail shows the lower half of its artwork",
    );
    const skinnedCell = isolatedItemRenderer.renderItem(
      {
        instanceId: "skin-rod",
        name: "Rod",
        icon: "R",
        skin,
        equipmentArtUrl: "rod-line.png",
      },
      { variant: "rod" },
    );
    assert.ok(
      !this.#findByClass(
        skinnedCell,
        "inventory-item-card__visual",
      ).classList.contains("inventory-item-card__visual--cropped") &&
        this.#findByClass(skinnedCell, "inventory-item-card__image").src ===
          "rod-line.png",
      "The equipment cell shows the whole artwork",
    );
    // The landing net: miniatures show the upper 40% top-aligned; the editor preview shows the whole artwork.
    const netSkin = {
      thumbnail: {
        src: "net.webp",
        visibleHeight: 0.4,
        focusX: 0.5,
        anchor: "top",
      },
    };
    const netVisual = this.#findByClass(
      isolatedItemRenderer.renderInventoryItem({
        instanceId: "net",
        name: "Net",
        icon: "N",
        skin: netSkin,
      }),
      "inventory-item-card__visual",
    );
    assert.ok(
      netVisual.classList.contains(
        "inventory-item-card__visual--cropped-top",
      ) &&
        netVisual.style.getPropertyValue(
          "--inventory-item-art-visible-height",
        ) === "0.4",
      "a top-anchored thumbnail shows the upper share of its artwork",
    );
    const netPreview = isolatedItemRenderer.renderItem(
      { instanceId: "net", name: "Net", icon: "N", skin: netSkin },
      { variant: "assembly-root", wholeArt: true },
    );
    assert.ok(
      !this.#findByClass(
        netPreview,
        "inventory-item-card__visual",
      ).classList.contains("inventory-item-card__visual--cropped") &&
        this.#findByClass(netPreview, "inventory-item-card__image").src ===
          "net.webp",
      "the editor preview shows the whole net",
    );
    const rodPreview = isolatedItemRenderer.renderItem(
      { instanceId: "skin-rod", name: "Rod", icon: "R", skin },
      { variant: "assembly-root", wholeArt: true },
    );
    assert.ok(
      !this.#findByClass(
        rodPreview,
        "inventory-item-card__visual",
      ).classList.contains("inventory-item-card__visual--cropped") &&
        this.#findByClass(rodPreview, "inventory-item-card__image").src ===
          "rod-thumb.png",
      "the editor preview shows the whole rod too",
    );
    assert.match(
      this.#reader.readStyle(),
      /\.inventory-item-card__visual--cropped \.inventory-item-card__image\s*\{[^}]*height:\s*calc\(100cqh \/ var\(--inventory-item-art-visible-height, 1\)\);/,
      "The cropped thumbnail scales its artwork by the visible height share",
    );
    const attachedInventoryItem = isolatedItemRenderer.renderItem({
      instanceId: "attached-inventory-item",
      name: "Attached inventory item",
      icon: "H",
      attachments: [{ instanceId: "attached-bait", name: "Bait", icon: "B" }],
    });
    assert.strictEqual(
      this.#findAllByClass(attachedInventoryItem, "inventory-attachment-badge")
        .length,
      1,
      "Inventory thumbnails must keep their equipped item compartments",
    );
    const compartmentContent = this.#findByClass(
      attachedInventoryItem,
      "inventory-item-card__content",
    );
    assert.ok(
      compartmentContent.classList.contains(
        "inventory-item-card__content--bottom-slots",
      ),
    );
    const emptyCompartmentCard = isolatedItemRenderer.renderItem({
      instanceId: "empty-compartments",
      icon: "B",
      attachments: [
        { kind: "cargo", empty: true },
        { kind: "cargo", empty: true },
      ],
      charge: { percent: 50 },
    });
    assert.strictEqual(
      this.#findAllByClass(
        emptyCompartmentCard,
        "inventory-attachment-badge--empty",
      ).length,
      2,
    );
    assert.strictEqual(
      this.#findAllByClass(
        emptyCompartmentCard,
        "inventory-attachment-badge__icon",
      ).length,
      0,
      "Empty equipment compartments must stay empty rather than display an emoji",
    );
    const contentIndex = emptyCompartmentCard.children.indexOf(
      this.#findByClass(emptyCompartmentCard, "inventory-item-card__content"),
    );
    const meterIndex = emptyCompartmentCard.children.indexOf(
      this.#findByClass(emptyCompartmentCard, "inventory-resource-meter"),
    );
    assert.ok(
      contentIndex < meterIndex,
      "The resource meter follows all image and equipment compartments",
    );
    const bareItemCard = isolatedItemRenderer.renderItem({
      instanceId: "bare-item",
      icon: "X",
    });
    assert.strictEqual(
      this.#findAllByClass(bareItemCard, "inventory-attachments").length,
      0,
      "Items without equipment must not display compartments",
    );
    const rarityHost = isolatedDom.element("span");
    const slotRarity = { id: "rare" };
    let appliedSlotRarity = null;
    const coloredCompartments = new sandbox.InventoryAttachmentBadgeRenderer({
      domFactory: isolatedDom,
      rarityDomAdapter: {
        apply(element, rarity) {
          appliedSlotRarity = rarity;
          element.style.setProperty("--rarity-color", "#aabbcc");
        },
      },
    });
    coloredCompartments.render(rarityHost, [
      { icon: "H", rarity: slotRarity },
      { empty: true },
    ]);
    assert.strictEqual(
      appliedSlotRarity,
      slotRarity,
      "Equipped compartment borders must use the attached item's rarity",
    );
    const rarityBadges = this.#findAllByClass(
      rarityHost,
      "inventory-attachment-badge",
    );
    assert.strictEqual(
      rarityBadges[0].style.getPropertyValue("--rarity-color"),
      "#aabbcc",
    );
    assert.strictEqual(
      rarityBadges[1].style.getPropertyValue("--rarity-color"),
      "",
      "Empty compartments must keep their translucent grey appearance",
    );
    const capacityResolver = new sandbox.InventoryResourceMeterResolver();
    const spool = {
      itemType: "fishing_line",
      location: { kind: "INVENTORY" },
      progression: { capacity: { available: true, percent: 62 } },
    };
    assert.strictEqual(capacityResolver.resolve(spool).percent, 62);
    for (const kind of ["LOADOUT", "ATTACHED"]) {
      assert.strictEqual(
        capacityResolver.resolve({ ...spool, location: { kind } }),
        null,
        "Equipped and attached line must not have a separate capacity scale",
      );
    }
    assert.strictEqual(
      capacityResolver.resolve({ ...spool, equipped: true }),
      null,
    );
    assert.strictEqual(
      capacityResolver.resolve({
        itemType: "reel",
        equipped: true,
        reelLineCapacity: { percent: 25, label: "Заповнення котушки" },
      }).percent,
      25,
      "The equipped reel must display its own projected fill ratio",
    );
    // Spec 094: a card rendered without its scale (editor tabs) keeps it off on timer updates.
    const chargedBoat = {
      instanceId: "tab-boat",
      name: "Boat",
      icon: "B",
      charge: { percent: 40, label: "Заряд" },
    };
    const meterlessCard = isolatedItemRenderer.renderItem(chargedBoat, {
      showResourceMeter: false,
    });
    isolatedItemRenderer.updateDynamicVisuals(meterlessCard, chargedBoat);
    assert.strictEqual(
      this.#findAllByClass(meterlessCard, "inventory-resource-meter").length,
      0,
      "a tab card shows no condition or line scale, even after a timer update",
    );
    const meteredCard = isolatedItemRenderer.renderItem(chargedBoat);
    isolatedItemRenderer.updateDynamicVisuals(meteredCard, chargedBoat);
    assert.strictEqual(
      this.#findAllByClass(meteredCard, "inventory-resource-meter").length,
      1,
      "other cards keep their scale",
    );
    const emptyDraftCard = isolatedItemRenderer.renderItem({
      instanceId: "empty-draft-stack",
      name: "Empty draft stack",
      icon: "D",
      status: "draft",
      equipped: false,
      equipmentCompletion: {
        isComplete: false,
        hasAnyComponent: false,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        emptyDraftCard,
        "inventory-item-card__incomplete-dot",
      ).length,
      0,
      "A completely empty inventory assembly is the default state and needs no dot",
    );
    const partialDraftCard = isolatedItemRenderer.renderItem({
      instanceId: "partial-draft-stack",
      name: "Partial draft stack",
      icon: "P",
      status: "draft",
      equipped: false,
      equipmentCompletion: {
        isComplete: false,
        hasAnyComponent: true,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        partialDraftCard,
        "inventory-item-card__incomplete-dot",
      ).length,
      1,
      "A partially filled inventory assembly must show the red dot",
    );
    const equippedEmptyCard = isolatedItemRenderer.renderItem({
      instanceId: "equipped-empty-stack",
      name: "Equipped empty stack",
      icon: "E",
      equipped: true,
      equipmentCompletion: {
        isComplete: false,
        hasAnyComponent: false,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        equippedEmptyCard,
        "inventory-item-card__incomplete-dot",
      ).length,
      1,
      "An equipped incomplete assembly needs the red dot even when empty",
    );
    const completeCard = isolatedItemRenderer.renderItem({
      instanceId: "complete-stack",
      name: "Complete stack",
      icon: "C",
      equipped: true,
      equipmentCompletion: {
        isComplete: true,
        hasAnyComponent: true,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(completeCard, "inventory-item-card__incomplete-dot")
        .length,
      0,
      "A fully completed assembly must not show the red dot",
    );
    const leveledCard = isolatedItemRenderer.renderItem({
      instanceId: "leveled-item",
      name: "Leveled item",
      icon: "L",
      progression: {
        available: true,
        ratingTier: { available: true, current: 4, maximum: 6 },
        capacity: { available: true, percent: 75 },
      },
    });
    assert.strictEqual(
      this.#findAllByClass(leveledCard, "inventory-item-card__rating-badge")
        .length,
      1,
    );
    const lineResourceMeter = this.#findByClass(
      leveledCard,
      "inventory-resource-meter",
    );
    const metadataFreeCard = isolatedItemRenderer.renderItem(
      {
        instanceId: "metadata-free-tier",
        name: "Metadata-free tier",
        icon: "L",
        progression: {
          available: true,
          ratingTier: { available: true, current: 4, maximum: 6 },
        },
      },
      { showMetadata: false },
    );
    assert.strictEqual(
      this.#findAllByClass(
        metadataFreeCard,
        "inventory-item-card__rating-badge",
      ).length,
      0,
      "Enabled rating tiers respect metadata visibility",
    );
    assert.strictEqual(
      this.#findAllByClass(leveledCard, "inv-slot__capacity-bar").length,
      0,
      "Inventory must not duplicate the legacy line-capacity bar",
    );
    assert.strictEqual(lineResourceMeter.dataset.resourceId, "capacity");
    assert.strictEqual(
      this.#findAllByClass(lineResourceMeter, "inventory-resource-meter__icon")
        .length,
      0,
      "Line capacity reuses the resource meter without an emoji",
    );
    assert.strictEqual(
      this.#findAllByClass(leveledCard, "inventory-item-card__level").length,
      0,
      "Progression adapter and item renderer must not duplicate the rating-tier badge",
    );

    currentView = this.#loadoutViewModel();
    ui.render(currentView);
    const inventoryBeforePreview = this.#findByClass(
      ui.rootNode,
      "inventory-list-panel",
    );
    currentView = this.#savedLoadoutViewModel();
    ui.render(currentView);
    const savedPreview = this.#findByClass(
      ui.rootNode,
      "inventory-saved-loadout-preview",
    );
    assert.ok(
      this.#findByClass(ui.rootNode, "inventory-main__left").contains(
        savedPreview,
      ),
      "Saved loadout contents must appear on the left",
    );
    assert.ok(
      this.#findByClass(ui.rootNode, "inventory-main__right").contains(
        inventoryBeforePreview,
      ),
      "Opening a saved loadout must preserve the inventory DOM on the right",
    );
    assert.strictEqual(
      this.#findAllByClass(
        savedPreview,
        "inventory-saved-loadout-preview__field",
      ).length,
      2,
      "Saved loadout preview must show only its contained roots",
    );
    assert.strictEqual(
      this.#findAllByClass(savedPreview, "inventory-item-card__membership-dot")
        .length,
      2,
      "Every saved root must show its loadout-membership dot",
    );
    const savedRodCard = this.#walk(savedPreview).find(
      (node) =>
        node.classList.contains("inventory-item-card") &&
        node.dataset.instanceId === "saved-rod",
    );
    assert.ok(savedRodCard, "Saved rod card must be rendered");
    savedRodCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.LOADOUT_PREVIEW_SLOT_EQUIP,
      loadoutId: "saved-kit",
      slotId: "rod",
    });
    const previewButtons = this.#findAllByClass(
      savedPreview,
      "inventory-saved-loadout-preview__button",
    );
    const previewButtonActions = [
      sandbox.InventoryActionType.LOADOUT_EQUIP_ALL,
      sandbox.InventoryActionType.LOADOUT_PREVIEW_BACK,
    ];
    previewButtons.forEach((button, index) => {
      button.click();
      this.#assertLast(dispatched, {
        type: previewButtonActions[index],
        loadoutId: "saved-kit",
      });
    });

    currentView = this.#editorViewModel();
    ui.render(currentView);
    this.#inventoryCard(ui.rootNode, "assembly-bag").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.INVENTORY_ITEM_ACTIVATE,
      instanceId: "assembly-bag",
    });
    const editor = this.#findByClass(ui.rootNode, "inventory-assembly-editor");
    assert.ok(
      editor.classList.contains("inventory-assembly-editor--scrollbar-hidden"),
      "the editor scrollbar defaults to disabled",
    );
    const visibleScrollbarEditor = new sandbox.InventoryAssemblyEditorRenderer({
      domFactory: new sandbox.InventoryDomFactory(document),
      scrollbarEnabled: true,
      rodRemovalRenderer: { render: () => document.createElement("div") },
    }).render({ rodRemovalStep: "choice" });
    assert.ok(
      !visibleScrollbarEditor.classList.contains(
        "inventory-assembly-editor--scrollbar-hidden",
      ),
      "enabling the presentation setting restores the shared native scrollbar",
    );
    const editorActions = this.#findByClass(
      editor,
      "inventory-assembly-editor__actions",
    );
    const editorWorkspace = this.#findByClass(
      editor,
      "inventory-assembly-editor__workspace",
    );
    assert.ok(
      editor.children.indexOf(editorActions) <
        editor.children.indexOf(editorWorkspace),
      "Card actions must render above the item image and parameter workspace",
    );
    const assemblyVisual = this.#findByClass(
      ui.rootNode,
      "inventory-assembly-editor__visual",
    );
    assert.strictEqual(
      this.#findAllByClass(assemblyVisual, "inventory-attachment-badge").length,
      0,
      "The large assembly root must not duplicate socket contents as circles",
    );
    // Spec 094: parameters live on the tab pages of one panel; item names are the tabs' accessible names.
    const assemblyParameters = this.#findByClass(
      ui.rootNode,
      "inventory-editor-tabs__panel",
    );
    const tabNames = this.#findAllByClass(
      this.#findByClass(ui.rootNode, "inventory-editor-tabs__row"),
      "inventory-item-card",
    )
      .map((card) => card.getAttribute("aria-label"))
      .join(" | ");
    assert.ok(
      assemblyParameters.textContent.includes("Клас рейтингу") &&
        assemblyParameters.textContent.includes("Power") &&
        assemblyParameters.textContent.includes("55%") &&
        tabNames.includes("Spring") &&
        tabNames.includes("Worm") &&
        assemblyParameters.textContent.includes("Freshness"),
      "The assembly editor must show production parameters for its root and attached components",
    );
    for (const card of this.#findAllByClass(editor, "inventory-item-card")) {
      card.emit("mouseenter");
      assert.strictEqual(
        tooltip.style.display,
        "none",
        "Items with visible editor parameters must not duplicate them on hover",
      );
    }
    const editorInventoryCard = this.#inventoryCard(
      ui.rootNode,
      "assembly-bag",
    );
    editorInventoryCard.emit("mouseenter");
    assert.strictEqual(
      tooltip.style.display,
      "block",
      "Other inventory items retain hover parameters while the editor is open",
    );
    editorInventoryCard.emit("mouseleave");
    assert.strictEqual(
      this.#findAllByClass(
        assemblyParameters,
        "inventory-item-parameter-section",
      ).length,
      2,
      "Root and attached bait must render as separate parameter pages",
    );
    assert.ok(
      this.#findAllByClass(assemblyParameters, "inventory-parameter").length >=
        3 &&
        this.#findAllByClass(
          assemblyParameters,
          "inventory-resource-meter--parameter",
        ).length === 1,
      "The large card must reuse the shared resource meter renderer",
    );
    const groupedHookSections =
      new sandbox.InventoryAssemblyParameterSectionResolver().resolve({
        root: { instanceId: "rig", itemId: "rig", name: "Rig" },
        sockets: [0, 1, 2].map((index) => ({
          slotId: "hook",
          label: `Hook ${index + 1}`,
          item: {
            instanceId: `hook-${index}`,
            itemId: "hook-basic",
            name: "Hook",
            itemType: "hook",
            quality: 6,
            effectiveStats: { maxLoadKg: 1.5 },
            displayStats: { Power: "1.5 kg" },
          },
        })),
      });
    assert.strictEqual(groupedHookSections.length, 2);
    assert.strictEqual(groupedHookSections[1].count, 3);
    assert.strictEqual(groupedHookSections[1].slotLabel, "");
    assert.strictEqual(
      groupedHookSections[1].item.instanceId,
      "hook-0",
      "Three statistically identical hooks must share one component section",
    );
    const groupedDom = new sandbox.InventoryDomFactory(document);
    const groupedHookPanel = new sandbox.InventoryItemParametersRenderer({
      domFactory: groupedDom,
      resolver: new sandbox.InventoryItemParametersResolver(),
      resourceMeterRenderer: new sandbox.InventoryResourceMeterRenderer({
        domFactory: groupedDom,
      }),
    }).renderSections(groupedHookSections);
    assert.strictEqual(
      this.#findByClass(
        groupedHookPanel,
        "inventory-item-parameter-section__title",
      ).textContent,
      "Hook ×3",
      "A grouped component header must contain only its item name and count",
    );
    const assemblyWorkspace = this.#findByClass(
      ui.rootNode,
      "inventory-assembly-editor__workspace",
    );
    // Spec 094: actions, the preview, then the tabs block; no separate cell grid or parameter stack.
    assert.deepStrictEqual(
      assemblyWorkspace.parentNode.children.map(
        (node) => node.className.split(" ")[0],
      ),
      [
        "inventory-assembly-editor__actions",
        "inventory-assembly-editor__workspace",
        "inventory-editor-tabs",
      ],
    );
    assert.deepStrictEqual(
      assemblyWorkspace.children.map((node) => node.className),
      ["inventory-assembly-editor__visual"],
    );
    // The shared editor tabs open every cell in place; only choosing an item or removing one dispatches a command.
    const editorTabs = this.#findByClass(ui.rootNode, "inventory-editor-tabs");
    const [tabRow, tabPanel] = editorTabs.children;
    const tabNodes = tabRow.children;
    const activeTab = () =>
      tabNodes.findIndex((node) =>
        node.classList.contains("inventory-editor-tabs__tab--active"),
      );
    const visiblePages = () =>
      tabPanel.children
        .map((page, index) => (page.hidden ? -1 : index))
        .filter((index) => index >= 0);
    const socketTabs = tabNodes.filter((node) =>
      node.classList.contains("inventory-editor-tabs__tab--socket"),
    );
    assert.strictEqual(tabNodes[0].dataset.tabKey, "root:assembly-active");
    assert.ok(
      tabNodes[0].classList.contains("inventory-editor-tabs__tab--root"),
    );
    assert.strictEqual(
      socketTabs.length,
      currentView.panel.assembly.sockets.length,
      "every cell of the editor has its own tab",
    );
    assert.strictEqual(tabPanel.children.length, tabNodes.length);
    assert.deepStrictEqual(
      [activeTab(), ...visiblePages()],
      [0, 0],
      "the editor opens on its root item's page only",
    );
    assert.strictEqual(tabNodes[0].getAttribute("aria-current"), "true");
    const hookTab = socketTabs.find((node) =>
      node.dataset.tabKey.includes(":hook[0]:"),
    );
    const dispatchedBeforeViewing = dispatched.length;
    this.#findByClass(hookTab, "inventory-slot__empty-button").click();
    assert.deepStrictEqual(
      [activeTab(), ...visiblePages()],
      [1, 1],
      "a tap opens the empty cell's parameter page",
    );
    const emptyPage = tabPanel.children[1];
    assert.ok(
      !this.#findAllByClass(emptyPage, "inventory-editor-tabs__empty").some(
        (node) => String(node.textContent).includes("комірка порожня"),
      ) &&
        String(emptyPage.getAttribute("aria-label")).includes(
          "комірка порожня",
        ),
      "an empty cell's page shows no empty-cell line but keeps it as its accessible name",
    );
    assert.strictEqual(
      dispatched.length,
      dispatchedBeforeViewing,
      "viewing an empty cell never starts a backpack pick",
    );
    tabRow.emit("keydown", { key: "Home" });
    tabRow.emit("keydown", { key: "ArrowRight" });
    assert.deepStrictEqual(
      [activeTab(), ...visiblePages()],
      [1, 1],
      "Right shows the next tab's page",
    );
    assert.strictEqual(
      JSON.stringify(tabNodes[1].scrolledIntoView),
      JSON.stringify({ block: "nearest", inline: "nearest" }),
    );
    tabRow.emit("keydown", { key: "Home" });
    assert.strictEqual(activeTab(), 0);
    tabPanel.layoutWidth = 300;
    const swipePanel = (fromX, toX) => {
      tabPanel.emit("pointerdown", {
        pointerType: "touch",
        clientX: fromX,
        clientY: 100,
      });
      tabPanel.emit("pointermove", {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
      });
      tabPanel.emit("pointerup", {
        pointerType: "touch",
        clientX: toX,
        clientY: 101,
      });
    };
    swipePanel(250, 50);
    assert.strictEqual(
      activeTab(),
      1,
      "a left swipe on the panel shows the next tab",
    );
    assert.ok(
      tabPanel.emit("click").defaultPrevented,
      "the click that ends a swipe is suppressed",
    );
    swipePanel(50, 250);
    swipePanel(50, 250);
    assert.strictEqual(activeTab(), 0, "swipes stop at the first tab");
    tabRow.emit("keydown", { key: "End" });
    assert.strictEqual(activeTab(), tabNodes.length - 1);
    this.#findByClass(tabNodes[0], "inventory-item-card").click();
    assert.strictEqual(
      activeTab(),
      0,
      "a tap on the root tab shows its parameters",
    );
    assert.strictEqual(
      dispatched.length,
      dispatchedBeforeViewing,
      "viewing parameters dispatches nothing",
    );
    // Spec 092: a tap on a filled cell shows its parameters, a long press removes its item; the preview swipes too.
    const filledTabIndex = tabNodes.findIndex(
      (node) =>
        node.classList.contains("inventory-editor-tabs__tab--socket") &&
        this.#findAllByClass(node, "inventory-item-card").length > 0,
    );
    assert.ok(filledTabIndex > 0, "the editor scenario has a filled cell tab");
    const filledCard = this.#findByClass(
      tabNodes[filledTabIndex],
      "inventory-item-card",
    );
    filledCard.click();
    assert.strictEqual(
      activeTab(),
      filledTabIndex,
      "a tap on a filled cell shows its parameters",
    );
    assert.strictEqual(
      dispatched.length,
      dispatchedBeforeViewing,
      "and dispatches nothing",
    );
    const filledSocketKey = tabNodes[filledTabIndex].dataset.tabKey.split(":");
    filledCard.emit("pointerdown", {
      pointerType: "touch",
      pointerId: 7,
      clientX: 10,
      clientY: 10,
      button: 0,
    });
    timers.advance(1200);
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE,
      rootInstanceId: "assembly-active",
      socketId: filledSocketKey[2],
      slotId: filledSocketKey[3],
      slotIndex: Number(filledSocketKey[4]),
      parentInstanceId: filledSocketKey[1],
      listVisible: false,
    });
    filledCard.emit("pointerup", {
      pointerType: "touch",
      pointerId: 7,
      clientX: 10,
      clientY: 10,
    });
    filledCard.click();
    const preview = this.#findByClass(
      assemblyWorkspace,
      "inventory-assembly-editor__visual",
    );
    preview.layoutWidth = 300;
    tabRow.emit("keydown", { key: "Home" });
    preview.emit("pointerdown", {
      pointerType: "touch",
      clientX: 250,
      clientY: 100,
    });
    preview.emit("pointermove", {
      pointerType: "touch",
      clientX: 50,
      clientY: 101,
    });
    preview.emit("pointerup", {
      pointerType: "touch",
      clientX: 50,
      clientY: 101,
    });
    assert.strictEqual(
      activeTab(),
      1,
      "a swipe on the preview switches the tab",
    );
    // Equal items in different cells keep separate tabs; nested parameter items already in a cell are not repeated.
    const tabResolver = new sandbox.InventoryEditorTabsResolver();
    const hookA = { instanceId: "hook-a", name: "Hook" };
    const hookB = { instanceId: "hook-b", name: "Hook" };
    const resolvedTabs = tabResolver.resolve({
      root: { instanceId: "rig", name: "Rig" },
      rootInstanceId: "rig",
      sockets: [
        {
          socketId: "hook[0]",
          slotId: "hook",
          slotIndex: 0,
          parentInstanceId: "rig",
          item: hookA,
          label: "Гачок 1",
        },
        {
          socketId: "hook[1]",
          slotId: "hook",
          slotIndex: 1,
          parentInstanceId: "rig",
          item: hookB,
          label: "Гачок 2",
        },
        {
          socketId: "chum[0]",
          slotId: "chum",
          slotIndex: 0,
          parentInstanceId: "rig",
          item: null,
          label: "Прикормка",
        },
      ],
      parameterItems: [
        hookA,
        { instanceId: "bait-1", name: "Worm" },
        { instanceId: "bait-1", name: "Worm" },
      ],
    });
    assert.strictEqual(
      JSON.stringify(resolvedTabs.map((tab) => [tab.kind, tab.key])),
      JSON.stringify([
        ["root", "root:rig"],
        ["socket", "socket:rig:hook[0]:hook:0"],
        ["socket", "socket:rig:hook[1]:hook:1"],
        ["socket", "socket:rig:chum[0]:chum:0"],
        ["view", "item:bait-1"],
      ]),
      "one tab per address, no merged equal items",
    );
    assert.strictEqual(
      tabResolver.resolve({ root: { instanceId: "rod", name: "Rod" } }).length,
      1,
      "a root without cells has one tab",
    );

    const baitSocket = this.#field(ui.rootNode, "bait");
    assert.strictEqual(
      baitSocket.getAttribute("aria-label"),
      "Наживка — гачок 1",
    );
    const baitWell = this.#findByClass(baitSocket, "inventory-slot");
    assert.ok(baitWell.classList.contains("inventory-slot--filled"));
    assert.ok(
      baitWell.classList.contains("inventory-slot--highlighted"),
      "A filled compatible socket must be highlighted for replacement",
    );

    assert.strictEqual(
      this.#walk(ui.rootNode).filter(
        (node) => node.tagName === "BUTTON" && node.textContent === "Спорядити",
      ).length,
      0,
      "An equipped assembly must hide Equip",
    );
    const buttonActions = [
      ["Зняти", sandbox.InventoryActionType.ASSEMBLY_UNEQUIP],
      ["Назад", sandbox.InventoryActionType.ASSEMBLY_BACK],
    ];
    buttonActions.forEach(([label, type]) => {
      this.#findByText(ui.rootNode, label).click();
      this.#assertLast(dispatched, {
        type,
        rootInstanceId: "assembly-active",
      });
    });

    currentView = this.#editorViewModel();
    currentView.panel.assembly.equipped = false;
    currentView.panel.assembly.canUnequip = false;
    currentView.panel.assembly.showUnequip = false;
    currentView.panel.assembly.canDisassemble = true;
    currentView.panel.assembly.showDisassemble = true;
    ui.render(currentView);
    this.#findByText(ui.rootNode, "Розібрати").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ASSEMBLY_DISASSEMBLE,
      rootInstanceId: "assembly-active",
    });

    currentView = this.#editorViewModel();
    currentView.panel.assembly.equipped = false;
    currentView.panel.assembly.canUnequip = false;
    currentView.panel.assembly.showUnequip = false;
    currentView.panel.assembly.canDisassemble = false;
    currentView.panel.assembly.showDisassemble = false;
    currentView.panel.assembly.sockets = currentView.panel.assembly.sockets.map(
      (editorSocket) => ({ ...editorSocket, item: null, state: "available" }),
    );
    ui.render(currentView);
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-assembly-editor__button")
        .length,
      2,
      "An unequipped root with empty sockets must omit Unequip and Disassemble",
    );
    this.#findByText(ui.rootNode, "Спорядити").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ASSEMBLY_EQUIP,
      rootInstanceId: "assembly-active",
    });
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-action--danger").length,
      0,
      "The hidden Disassemble action must not leave a danger button",
    );
    currentView.panel.assembly.canEquip = false;
    currentView.panel.assembly.equipWarning =
      "Цей слот не підтримується обраним вудилищем.";
    ui.render(currentView);
    const blockedEquipButton = this.#findByText(ui.rootNode, "Спорядити");
    assert.ok(
      blockedEquipButton.classList.contains("inventory-action--disabled") &&
        blockedEquipButton.getAttribute("aria-disabled") === "true",
      "An incompatible assembly must render Equip as inactive",
    );
    blockedEquipButton.click();
    assert.strictEqual(
      this.#findByClass(
        this.#findByClass(ui.rootNode, "inventory-warning"),
        "ui-hint__text",
      ).textContent,
      "Цей слот не підтримується обраним вудилищем.",
      "The inactive Equip action must explain the rod incompatibility",
    );

    const emptyParameterView = this.#editorViewModel();
    emptyParameterView.panel.assembly.root = {
      instanceId: "assembly-active",
      name: "No panel parameters",
      itemType: "hook",
      effectiveStats: { maxLoadKg: 2 },
    };
    emptyParameterView.panel.assembly.sockets = [];
    emptyParameterView.panel.assembly.parameterItems = [];
    ui.render(emptyParameterView);
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-item-parameters").length,
      0,
    );
    const emptyParameterCard = this.#findByClass(
      this.#findByClass(ui.rootNode, "inventory-assembly-editor__visual"),
      "inventory-item-card",
    );
    emptyParameterCard.emit("mouseenter");
    assert.strictEqual(
      tooltip.style.display,
      "block",
      "Hover stays available when the editor has no visible parameters for the item",
    );
    emptyParameterCard.emit("mouseleave");
    ui.render(currentView);
    ui.close();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.CLOSE,
    });
    dispatched.length = 0;
    subscriber({ warning: "Not enough bait for every hook" });
    assert.strictEqual(ui.isOpen, true);
    assert.ok(ui.rootNode.classList.contains("inventory-modal--open"));
    assert.strictEqual(
      this.#findByClass(
        this.#findByClass(ui.rootNode, "inventory-warning"),
        "ui-hint__text",
      ).textContent,
      "Not enough bait for every hook",
    );
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.OPEN,
    });
    ui.close();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.CLOSE,
    });
    currentView = this.#editorViewModel();
    currentView.panel.assembly.rodRemovalStep = "choice";
    ui.render(currentView);
    const removal = this.#findByClass(ui.rootNode, "inventory-rod-removal");
    this.#findByClass(removal, "inventory-action--primary").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ROD_REMOVAL_CHOICE,
      choice: "save",
    });
    this.#findByClass(removal, "inventory-action--danger").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ROD_REMOVAL_CHOICE,
      choice: "disassemble",
    });
    this.#findByClass(removal, "inventory-action--muted").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ROD_REMOVAL_CHOICE,
      choice: "cancel",
    });
    currentView.panel.assembly.rodRemovalStep = "save";
    ui.render(currentView);
    const removalForm = this.#findByClass(
      ui.rootNode,
      "inventory-loadout-save",
    );
    this.#findByClass(removalForm, "inventory-loadout-save__input").value = "";
    removalForm.emit("submit");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.LOADOUT_SAVE,
      name: "",
    });
    // Inline choices belong to the viewed empty socket, use inventory cards, and dispatch one addressed action.
    currentView = this.#editorViewModel();
    const inlineSocket = currentView.panel.assembly.sockets.find(
      (slot) => !slot.item,
    );
    inlineSocket.canSelectCompatibleItem = true;
    inlineSocket.compatibleItems = [
      {
        instanceId: "inline-hook",
        name: "Inline hook",
        itemType: "hook",
        icon: "H",
        quantity: 3,
      },
    ];
    ui.render(currentView);
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-editor-tabs__candidates")
        .length,
      0,
      "the root page does not build hidden grids for empty sockets",
    );
    const inlineTabs = this.#findByClass(ui.rootNode, "inventory-editor-tabs");
    const beforeInlineView = dispatched.length;
    this.#findByClass(
      inlineTabs.children[0].children[1],
      "inventory-slot__empty-button",
    ).click();
    assert.strictEqual(
      dispatched.length,
      beforeInlineView,
      "opening choices neither filters the backpack nor selects equipment",
    );
    const inlineGrid = this.#findByClass(
      ui.rootNode,
      "inventory-editor-tabs__candidate-grid",
    );
    assert.strictEqual(
      this.#findByClass(inlineGrid, "inventory-item-card__quantity")
        .textContent,
      "3",
      "inline choices retain inventory quantities",
    );
    this.#findByClass(inlineGrid, "inventory-item-card").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ASSEMBLY_SOCKET_ITEM_ACTIVATE,
      rootInstanceId: "assembly-active",
      instanceId: "inline-hook",
      socketId: inlineSocket.socketId,
      slotId: inlineSocket.slotId,
      slotIndex: inlineSocket.slotIndex,
      parentInstanceId: inlineSocket.parentInstanceId,
    });
    inlineTabs.children[0].emit("keydown", { key: "Home" });
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-editor-tabs__candidates")
        .length,
      0,
      "leaving an empty cell releases its candidate cards",
    );
    // Landscape/desktop: beside a visible item list the empty cell starts the pick that highlights compatible items.
    const inlineListHost = this.#findByClass(
      ui.rootNode,
      "inventory-main__section--items",
    );
    inlineListHost.layoutVisible = true;
    this.#findByClass(
      inlineTabs.children[0].children[1],
      "inventory-slot__empty-button",
    ).click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE,
      rootInstanceId: "assembly-active",
      socketId: inlineSocket.socketId,
      slotId: inlineSocket.slotId,
      slotIndex: inlineSocket.slotIndex,
      parentInstanceId: inlineSocket.parentInstanceId,
      listVisible: true,
    });
    assert.strictEqual(
      dispatched.length,
      beforeInlineView + 2,
      "one pick beside the visible list",
    );
    inlineListHost.layoutVisible = false;
    inlineTabs.children[0].emit("keydown", { key: "Home" });
    inlineSocket.compatibleItems = [];
    inlineSocket.state = "unavailable";
    inlineSocket.warning =
      "В інвентарі немає відповідного доступного предмета.";
    ui.render(currentView);
    this.#findByClass(ui.rootNode, "inventory-slot__empty-button").click();
    assert.strictEqual(
      dispatched.length,
      beforeInlineView + 2,
      "an empty unavailable cell still opens its shop page without a command",
    );
    const beforeShop = dispatched.length;
    this.#findByText(
      this.#findByClass(ui.rootNode, "inventory-editor-tabs__candidates"),
      "В магазин",
    ).click();
    assert.strictEqual(
      dispatched.length,
      beforeShop,
      "the shop stub never performs an inventory command",
    );
    assert.strictEqual(
      this.#findByClass(
        this.#findByClass(ui.rootNode, "inventory-warning"),
        "ui-hint__text",
      ).textContent,
      "Магазин у розробці.",
      "the shop stub uses the existing top hint region",
    );
    const scrolledEditor = this.#findByClass(
      ui.rootNode,
      "inventory-assembly-editor",
    );
    scrolledEditor.scrollTop = 240;
    this.#findByClass(ui.rootNode, "inventory-slot__empty-button").click();
    ui.render(currentView);
    const refreshedEditor = this.#findByClass(
      ui.rootNode,
      "inventory-assembly-editor",
    );
    assert.notStrictEqual(
      refreshedEditor,
      scrolledEditor,
      "an explicit refresh can rebuild its editor",
    );
    assert.strictEqual(
      refreshedEditor.scrollTop,
      240,
      "refreshing the same editor retains the user's scroll position",
    );
    assert.strictEqual(
      this.#findByClass(
        ui.rootNode,
        "inventory-editor-tabs__row",
      ).children[1].getAttribute("aria-current"),
      "true",
      "refreshing the editor also retains the selected parameter page",
    );
    inlineSocket.canSelectCompatibleItem = false;
    inlineSocket.state = "locked";
    inlineSocket.warning = "Спочатку спорядіть це вудилище.";
    ui.render(currentView);
    this.#findByClass(ui.rootNode, "inventory-editor-tabs__row").emit(
      "keydown",
      { key: "Home" },
    );
    this.#findByClass(ui.rootNode, "inventory-slot__empty-button").click();
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "inventory-editor-tabs__candidates")
        .length,
      0,
      "locked prerequisites cannot offer inline equipment choices",
    );
    assert.strictEqual(
      this.#findByClass(
        this.#findByClass(ui.rootNode, "inventory-warning"),
        "ui-hint__text",
      ).textContent,
      inlineSocket.warning,
      "locked cells retain their existing warning",
    );
    currentView.panel.assembly.rootInstanceId = "another-root";
    ui.render(currentView);
    assert.strictEqual(
      this.#findByClass(ui.rootNode, "inventory-assembly-editor").scrollTop,
      0,
      "another root item starts at the top of its editor",
    );
    ui.render(this.#loadoutViewModel());
    ui.render(currentView);
    assert.strictEqual(
      this.#findByClass(ui.rootNode, "inventory-assembly-editor").scrollTop,
      0,
      "reopening an editor starts at the top",
    );
    const observedTypes = new Set(observed.map((action) => action.type));
    Object.values(sandbox.InventoryActionType).forEach((type) => {
      assert.ok(observedTypes.has(type), `Missing interaction action: ${type}`);
    });
    ui.dispose();
  }

  #validActionSamples(actions) {
    return [
      { type: actions.OPEN },
      { type: actions.CLOSE },
      { type: actions.CONSUMABLE_SLOT_ACTIVATE, kind: "bait", slotIndex: 0 },
      { type: actions.CATEGORY_SELECT, categoryId: "all" },
      { type: actions.SUBFILTER_TOGGLE, filterId: "hooks", enabled: true },
      { type: actions.SORT_CRITERION_SELECT, criterionId: "rarity" },
      { type: actions.SORT_DIRECTION_SELECT, directionId: "descending" },
      {
        type: actions.RARITY_FILTER_TOGGLE,
        rarityId: "rare",
        enabled: true,
      },
      { type: actions.INVENTORY_ITEM_ACTIVATE, instanceId: "item" },
      { type: actions.INVENTORY_ITEM_LONG_PRESS, instanceId: "item" },
      {
        type: actions.EQUIPMENT_SLOT_ACTIVATE,
        slotId: "reel",
        instanceId: null,
      },
      {
        type: actions.EQUIPMENT_SLOT_LONG_PRESS,
        slotId: "tackle",
        instanceId: "rig",
      },
      {
        type: actions.ASSEMBLY_SOCKET_ACTIVATE,
        rootInstanceId: "rig",
        socketId: "hook[0]",
        slotId: "hook",
        slotIndex: 0,
        parentInstanceId: "rig",
      },
      {
        type: actions.ASSEMBLY_SOCKET_ITEM_ACTIVATE,
        rootInstanceId: "rig",
        socketId: "hook[1]",
        slotId: "hook",
        slotIndex: 1,
        parentInstanceId: "rig",
        instanceId: "source-hook",
      },
      ...[
        actions.ASSEMBLY_EQUIP,
        actions.ASSEMBLY_UNEQUIP,
        actions.ASSEMBLY_DISASSEMBLE,
        actions.ASSEMBLY_BACK,
      ].map((type) => ({ type, rootInstanceId: "rig" })),
      { type: actions.LOADOUT_SAVE, name: "Match" },
      { type: actions.ROD_REMOVAL_CHOICE, choice: "save" },
      {
        type: actions.LOADOUT_PREVIEW_SLOT_EQUIP,
        loadoutId: "saved-kit",
        slotId: "rod",
      },
      { type: actions.LOADOUT_EQUIP_ALL, loadoutId: "saved-kit" },
      { type: actions.LOADOUT_PREVIEW_BACK, loadoutId: "saved-kit" },
      { type: actions.AUTO_BAIT_CHANGE, enabled: true },
      { type: actions.AUTO_CHUM_CHANGE, enabled: false },
    ];
  }

  #loadoutViewModel() {
    const item = (instanceId, extra = {}) => ({
      instanceId,
      itemId: instanceId,
      itemType: "hook",
      name: instanceId,
      icon: "•",
      quantity: 1,
      ...extra,
    });
    return {
      isOpen: true,
      header: { activeTackle: { baits: [], chums: [] } },
      settings: { autoBait: false, autoChum: false },
      tooltipContext: {
        rodType: "pole",
        rodHasReel: false,
        availableCapabilities: ["hook", "float"],
      },
      panel: {
        mode: "loadout",
        loadout: {
          mainSlots: [
            { slotId: "rod", label: "Rod", item: item("rod") },
            {
              slotId: "reel",
              label: "Reel",
              state: "available",
              highlighted: true,
            },
            { slotId: "terminalLine", label: "Leader", state: "available" },
            {
              slotId: "tackle",
              label: "Rig",
              item: item("assembly-active", { status: "prepared" }),
            },
            { slotId: "float", label: "Float", state: "available" },
          ],
          auxiliarySlots: [
            { slotId: "handChum", label: "Hand chum", state: "available" },
            { slotId: "net", label: "Net", state: "available" },
            {
              slotId: "delivery",
              label: "Boat",
              item: item("boat-active", {
                itemType: "boat",
                charge: { percent: 55, label: "Boat charge 55%" },
              }),
            },
            {
              slotId: "gasMask",
              label: "Gas mask",
              state: "locked",
              warning: "Gas mask is not unlocked",
            },
          ],
          save: { visible: true, enabled: true },
        },
      },
      inventory: {
        categories: [
          { id: "all", label: "All", selected: true },
          { id: "nets", label: "Підсаки", icon: "🕸️", selected: false },
        ],
        activeCategoryId: "all",
        activeSubfilterIds: [],
        subfilters: [
          { id: "hooks", label: "Гачки", count: 1, selected: false },
        ],
        sort: {
          criterionIds: ["type", "rarity"],
          directionId: "ascending",
          activeRarityIds: [],
          criteria: [
            { id: "type", label: "За типом", selected: true },
            { id: "rarity", label: "За рідкістю", selected: false },
          ],
          directions: [
            {
              id: "ascending",
              icon: "↑",
              label: "Від меншого до більшого",
              selected: true,
            },
            {
              id: "descending",
              icon: "↓",
              label: "Від більшого до меншого",
              selected: false,
            },
          ],
          rarities: [
            {
              id: "common",
              label: "Звичайні",
              color: "rgb(145, 150, 160)",
              count: 1,
              selected: false,
            },
            {
              id: "rare",
              label: "Рідкі",
              color: "rgb(0, 160, 255)",
              count: 1,
              selected: false,
            },
          ],
        },
        items: [
          item("assembly-bag", {
            status: "prepared",
            compatibleWithHighlightedSlot: true,
            requiresTag: "hook",
            displayStats: { Потужність: "1.2 кг" },
            displayStatsSchema: {
              maxLoadKg: { label: "Потужність", suffix: "кг" },
            },
            effectiveStats: { maxLoadKg: 1.2 },
            progression: {
              rating: {
                available: true,
                rawValue: 1.2,
                minimum: 0.5,
                maximum: 3,
                metricId: "maxLoadKg",
                metricLabel: "Потужність",
                metricSuffix: "кг",
                percent: 28,
                breakdown: [],
              },
            },
          }),
          item("saved-kit", {
            itemType: "equipment_loadout",
            name: "Saved kit",
          }),
        ],
      },
    };
  }

  #editorViewModel() {
    const base = this.#loadoutViewModel();
    return {
      ...base,
      panel: {
        ...base.panel,
        mode: "assembly",
        assembly: {
          root: {
            instanceId: "assembly-active",
            name: "Spring",
            icon: "S",
            progression: {
              available: true,
              ratingTier: {
                available: true,
                current: 2,
                maximum: 6,
              },
            },
            charge: { percent: 55, label: "Charge 55%" },
            displayStats: { Power: "12 kg", Hooks: "3" },
            status: "prepared",
            attachments: [
              {
                instanceId: "bait-active",
                name: "Worm",
                icon: "W",
                kind: "bait",
                placement: "bottom",
              },
            ],
          },
          rootLabel: "Spring",
          rootInstanceId: "assembly-active",
          equipped: true,
          canEquip: true,
          canUnequip: true,
          canDisassemble: false,
          showDisassemble: false,
          sockets: [
            {
              socketId: "hook[0]",
              slotId: "hook",
              slotIndex: 0,
              parentInstanceId: "assembly-active",
              label: "Hook 1",
              state: "available",
            },
            {
              socketId: "hook[0].bait[0]",
              slotId: "bait",
              slotIndex: 0,
              parentInstanceId: "hook-active",
              label: "Наживка — гачок 1",
              state: "filled",
              highlighted: true,
              item: {
                instanceId: "bait-active",
                itemId: "bait-worm",
                itemType: "bait",
                name: "Worm",
                icon: "W",
                quantity: 1,
                displayStats: { Freshness: "100%" },
              },
            },
          ],
        },
      },
    };
  }

  #savedLoadoutViewModel() {
    const base = this.#loadoutViewModel();
    return {
      ...base,
      panel: { ...base.panel, mode: "saved-loadout" },
      inventory: {
        ...base.inventory,
        mode: "inventory",
        savedLoadout: {
          loadoutId: "saved-kit",
          name: "Saved kit",
          canEquipAll: true,
          canDisassemble: true,
          slots: [
            {
              slotId: "rod",
              label: "Rod",
              active: false,
              item: {
                instanceId: "saved-rod",
                itemId: "saved-rod",
                itemType: "rod",
                variant: "feeder",
                name: "Saved rod",
                loadoutMembership: {
                  id: "saved-kit",
                  color: "hsl(120 70% 60%)",
                },
                icon: "R",
                quantity: 1,
              },
            },
            {
              slotId: "tackle",
              label: "Spring",
              active: true,
              item: {
                instanceId: "saved-rig",
                itemId: "saved-rig",
                itemType: "feeder_rig",
                variant: "spring",
                name: "Saved spring",
                loadoutMembership: {
                  id: "saved-kit",
                  color: "hsl(120 70% 60%)",
                },
                icon: "S",
                quantity: 1,
              },
            },
          ],
        },
      },
    };
  }

  #assertLast(actions, expected) {
    const actual = actions.at(-1);
    assert.ok(actual, `Expected action ${expected.type}`);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(actual)),
      JSON.parse(JSON.stringify(expected)),
    );
  }

  #walk(root) {
    return [root, ...root.children.flatMap((child) => this.#walk(child))];
  }

  #findByClass(root, className) {
    const found = this.#walk(root).find((node) =>
      node.classList.contains(className),
    );
    assert.ok(found, `Missing element .${className}`);
    return found;
  }

  #findAllByClass(root, className) {
    return this.#walk(root).filter((node) =>
      node.classList.contains(className),
    );
  }

  #findById(root, id) {
    const found = this.#walk(root).find((node) => node.id === id);
    assert.ok(found, `Missing element #${id}`);
    return found;
  }

  #findByText(root, text) {
    const found = this.#walk(root).find(
      (node) => node.tagName === "BUTTON" && node.textContent === text,
    );
    assert.ok(found, `Missing button: ${text}`);
    return found;
  }

  #field(root, slotId) {
    const found = this.#walk(root).find(
      (node) =>
        node.classList.contains("inventory-field") &&
        node.dataset.slotId === slotId,
    );
    assert.ok(found, `Missing field ${slotId}`);
    return found;
  }

  #inventoryCard(root, instanceId) {
    const wrapper = this.#walk(root).find(
      (node) =>
        node.classList.contains("inventory-list-item") &&
        node.dataset.instanceId === instanceId,
    );
    assert.ok(wrapper, `Missing inventory item ${instanceId}`);
    return this.#findByClass(wrapper, "inventory-item-card");
  }
}

new InventoryStaticContractCheck().run();
