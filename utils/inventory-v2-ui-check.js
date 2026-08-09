const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const UI_DIRECTORY = path.join(ROOT, "src", "ui", "inventory");
const STYLE_FILE = path.join(ROOT, "src", "ui", "styles", "inventory_v2.css");
const VIEW_MODEL_FACTORY_FILE = path.join(
  ROOT,
  "src",
  "application",
  "inventory",
  "inventory_v2_view_model_factory.js",
);
const ITEM_VIEW_FACTORY_FILE = path.join(
  ROOT,
  "src",
  "application",
  "inventory",
  "inventory_v2_item_view_factory.js",
);
const COMMAND_SERVICE_FILE = path.join(
  ROOT,
  "src",
  "application",
  "inventory",
  "inventory_v2_command_service.js",
);

const UI_SCRIPT_ORDER = Object.freeze([
  "inventory_v2_view_model.js",
  "inventory_v2_dom_factory.js",
  "inventory_v2_long_press_controller.js",
  "inventory_v2_attachment_badge_renderer.js",
  "inventory_v2_tooltip_presenter.js",
  "inventory_v2_resource_meter_resolver.js",
  "inventory_v2_resource_meter_renderer.js",
  "inventory_v2_item_parameters_resolver.js",
  "inventory_v2_item_parameters_renderer.js",
  "inventory_v2_item_card_renderer.js",
  "inventory_v2_header_renderer.js",
  "inventory_v2_loadout_panel_renderer.js",
  "inventory_v2_assembly_editor_renderer.js",
  "inventory_v2_saved_loadout_preview_renderer.js",
  "inventory_v2_inventory_grid_renderer.js",
  "inventory_v2_ui.js",
  "inventory_v2_bootstrap.js",
]);

class InventoryV2SourceReader {
  readJavaScriptFiles() {
    return UI_SCRIPT_ORDER.map((name) => ({
      name,
      source: fs.readFileSync(path.join(UI_DIRECTORY, name), "utf8"),
    }));
  }

  readStyle() {
    return fs.readFileSync(STYLE_FILE, "utf8");
  }

  readApplicationFactory() {
    return fs.readFileSync(VIEW_MODEL_FACTORY_FILE, "utf8");
  }

  readItemViewFactory() {
    return fs.readFileSync(ITEM_VIEW_FACTORY_FILE, "utf8");
  }

  readCommandService() {
    return fs.readFileSync(COMMAND_SERVICE_FILE, "utf8");
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
    const enabled = force === undefined ? !this.contains(value) : Boolean(force);
    if (enabled) this.add(value);
    else this.remove(value);
    return enabled;
  }
}

class FakeStyle {
  #properties = new Map();

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
    return this.#textContent + this.children.map((child) => child.textContent).join("");
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

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
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
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
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

class InventoryV2StaticContractCheck {
  #reader;

  constructor(reader = new InventoryV2SourceReader()) {
    this.#reader = reader;
  }

  run() {
    const files = this.#reader.readJavaScriptFiles();
    const combined = files.map((file) => file.source).join("\n");
    const style = this.#reader.readStyle();

    this.#assertSafeTextRendering(combined);
    this.#assertGlobalClasses(combined);
    this.#assertLongPressContract(combined, style);
    this.#assertVisualContract(style);
    this.#assertApplicationFactoryContract(combined);
    this.#assertViewModelContract(files[0].source);
    this.#assertAllInteractions(files);
    console.log("Inventory V2 UI contract and interaction checks passed.");
  }

  #assertSafeTextRendering(source) {
    assert.ok(!source.includes(".innerHTML"), "UI must not assign innerHTML");
    assert.ok(!source.includes(".outerHTML"), "UI must not assign outerHTML");
  }

  #assertGlobalClasses(source) {
    const expected = [
      "InventoryV2ActionContract",
      "InventoryV2UI",
      "InventoryV2Bootstrap",
      "InventoryV2LongPressController",
      "InventoryV2LoadoutPanelRenderer",
      "InventoryV2AssemblyEditorRenderer",
      "InventoryV2InventoryGridRenderer",
      "InventoryV2AttachmentBadgeRenderer",
      "InventoryV2TooltipPresenter",
      "InventoryV2SavedLoadoutPreviewRenderer",
      "InventoryV2ResourceMeterResolver",
      "InventoryV2ResourceMeterRenderer",
      "InventoryV2ItemParametersResolver",
      "InventoryV2ItemParametersRenderer",
    ];
    for (const className of expected) {
      assert.ok(
        source.includes(`globalThis.${className} =`),
        `${className} must be registered globally`,
      );
    }
  }

  #assertLongPressContract(source, style) {
    assert.match(source, /DURATION_MS\s*=\s*1500/);
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
    assert.match(style, /inventory-v2-long-press-duration,\s*1500ms/);
  }

  #assertVisualContract(style) {
    for (const selector of [
      ".inventory-v2-modal",
      ".inventory-v2-backpack-button",
      ".inventory-v2-loadout-shell",
      ".inventory-v2-loadout-panel__primary",
      ".inventory-v2-loadout-panel__auxiliary",
      ".inventory-v2-assembly-editor__workspace",
      ".inventory-v2-saved-loadout-preview__slots",
      ".inventory-v2-inventory-grid",
      ".inventory-v2-attachments--reel-line",
      ".inventory-v2-attachments--hook",
      ".inventory-v2-attachments--boat-cargo",
      ".inventory-v2-resource-meter",
      ".inventory-v2-resource-meter--thumbnail",
      ".inventory-v2-resource-meter__icon",
      ".inventory-v2-resource-meter__track",
      ".inventory-v2-resource-meter__fill",
      ".inventory-v2-assembly-editor__visual",
      ".inventory-v2-item-parameters",
      ".inventory-v2-parameters-list",
      ".inventory-v2-parameter-row",
      ".inventory-v2-parameter-bar-track",
      ".inventory-v2-parameter-segments",
      ".inventory-v2-item-card__incomplete-dot",
      ".inventory-v2-categories__toggle",
      ".inventory-v2-subfilters",
      ".inventory-v2-subfilters__checkbox",
      ".inventory-v2-inventory-item.is-compatible:not(.is-selected)",
      ".inventory-v2-tooltip",
    ]) {
      assert.ok(style.includes(selector), `Missing selector: ${selector}`);
    }
    const warningRule = style.match(
      /\.inventory-v2-warning\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const visibleWarningRule = style.match(
      /\.inventory-v2-warning\.is-visible\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const resourceThumbnailRule = style.match(
      /\.inventory-v2-resource-meter--thumbnail\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const resourceIconRule = style.match(
      /\.inventory-v2-resource-meter--thumbnail\s+\.inventory-v2-resource-meter__icon\s*\{[\s\S]*?\n\}/,
    )?.[0];
    const resourceTrackRule = style.match(
      /\.inventory-v2-resource-meter__track\s*\{[\s\S]*?\n\}/,
    )?.[0];
    assert.ok(warningRule, "Missing inventory warning rule");
    assert.ok(
      !warningRule.includes("position: absolute") &&
        warningRule.includes("max-height: 0") &&
        warningRule.includes("align-self: center"),
      "Warnings must stay collapsed in normal document flow instead of overlaying content",
    );
    assert.ok(
      visibleWarningRule?.includes("max-height: 120px") &&
        visibleWarningRule.includes("margin-top: 10px"),
      "Visible warnings must reserve space below the header",
    );
    assert.ok(
      !style.includes(".inventory-v2-charge") &&
        style.includes("--inventory-v2-resource-fill-start: #48cf15") &&
        style.includes("--inventory-v2-resource-fill-end: #c4ff1d"),
      "All thumbnail resources must share one reusable meter and color source",
    );
    assert.ok(
      resourceThumbnailRule?.includes("right: 4px") &&
        resourceThumbnailRule.includes("left: 4px") &&
        resourceThumbnailRule.includes("height: var(--inventory-v2-parameter-meter-height)") &&
        resourceTrackRule?.includes("width: 100%"),
      "The resource scale must span the thumbnail width with small equal insets",
    );
    assert.ok(
      resourceIconRule?.includes("position: absolute") &&
        resourceIconRule.includes("bottom: calc(100% + 2px)") &&
        resourceIconRule.includes("left: 0"),
      "The optional resource icon must sit above the scale on its left edge",
    );
    assert.ok(
      style.includes("clamp(170px, 10.1vw, 194px)"),
      "Rod column must stay close to the 194px reference width",
    );
    assert.ok(
      style.includes(
        "minmax(var(--inventory-v2-socket-size), var(--inventory-v2-socket-size))",
      ),
      "Assembly socket size must remain centralized",
    );
    assert.ok(
      style.includes("--inventory-v2-assembly-card-width") &&
        style.includes(".inventory-v2-assembly-editor__visual") &&
        style.includes(".inventory-v2-parameters-list") &&
        style.includes(".inventory-v2-parameter-bar-track") &&
        style.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"),
      "The assembly editor must stack visual, sockets and production parameters in one card",
    );
    assert.match(
      style,
      /\.inventory-v2-loadout-panel__auxiliary\s*\{[\s\S]*?grid-template-columns:\s*repeat\(\s*4,\s*var\(--inventory-v2-auxiliary-card-size\)/,
      "Auxiliary equipment must render as one compact four-slot row",
    );
    assert.match(
      style,
      /\.inventory-v2-loadout-panel__auxiliary\s*\{[\s\S]*?padding-left:\s*clamp\(14px,\s*1\.8vw,\s*34px\)/,
      "Auxiliary row must share the rod column's left inset",
    );
    assert.ok(
      !style.includes("repeat(3, minmax(76px, 1fr))"),
      "Auxiliary wells must not stretch across the entire row",
    );
    assert.match(
      style,
      /\.inventory-v2-slot:not\(\.is-filled\)\s*\{[\s\S]*?border:\s*2px solid #252e31;[\s\S]*?background:\s*#181e20;/,
      "Open empty slots must use the lighter gas-mask visual without a cross",
    );
    assert.ok(
      style.includes(".inventory-v2-slot.is-highlighted {"),
      "Compatible filled and empty sockets must share the highlight state",
    );
    assert.ok(
      style.includes("--inventory-slot-size: var(--inventory-v2-card-size)"),
      "Legacy progression bars must inherit the Inventory V2 card size",
    );
    assert.ok(
      style.includes("object-position: center center") &&
        style.includes(".inventory-v2-item-card .inv-slot__level-badge") &&
        style.includes("justify-content: center"),
      "Item artwork and level numbers must remain centered",
    );
    assert.doesNotMatch(
      style,
      /\.inventory-v2-auto-settings\s*\{[^}]*display\s*:\s*none/s,
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
      assert.ok(factory.includes(token), `View-model factory must emit ${token}`);
    }
    assert.ok(
      factory.includes("highlighted: selectedCompatible"),
      "Compatible replacement must highlight occupied sockets too",
    );
    assert.ok(
      commandService.includes(
        "this.#attachmentTargetResolver.findCompatibleTargets",
      ),
      "Assembly actions and contextual inventory must share target resolution",
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
      uiSource.includes("progressionRendersLevel"),
      "Item renderer must avoid duplicate level badges",
    );
    assert.ok(
      uiSource.includes("InventoryV2TooltipPresenter") &&
        uiSource.includes("displayStats") &&
        uiSource.includes("appendTooltip"),
      "V2 cards must restore the legacy parameter tooltip",
    );
    assert.ok(
      !uiSource.includes('"inventory-v2-item-card__name"'),
      "Item miniatures must not render text labels",
    );
    assert.ok(
      !uiSource.includes('"inventory-v2-item-card__status"') &&
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
      "LOADOUT_DISASSEMBLE",
      "LOADOUT_PREVIEW_BACK",
      "AUTO_BAIT_CHANGE",
      "AUTO_CHUM_CHANGE",
    ];
    actionNames.forEach((actionName) => {
      assert.ok(
        commandService.includes(`case InventoryV2ActionType.${actionName}:`),
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

  #assertViewModelContract(source) {
    const sandbox = { console };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(source, sandbox, {
      filename: "inventory_v2_view_model.js",
    });
    const Normalizer = sandbox.InventoryV2ViewModelNormalizer;
    const actions = sandbox.InventoryV2ActionType;
    const ActionContract = sandbox.InventoryV2ActionContract;
    const normalized = new Normalizer().normalize({
      header: {
        activeTackle: {
          baits: [{ id: "bait" }],
          chums: [{ id: "tackle-chum" }],
        },
        handChum: [{ id: "must-not-leak" }],
        boatChums: [{ id: "must-not-leak" }],
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
    assert.strictEqual(normalized.inventory.mode, "saved-loadout");
    assert.strictEqual(normalized.inventory.savedLoadout.loadoutId, "saved-kit");
    assert.strictEqual(actions.OPEN, "inventory-v2/open");
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
    const sandbox = {
      console,
      document,
      setTimeout: (callback, delay) => timers.setTimeout(callback, delay),
      clearTimeout: (id) => timers.clearTimeout(id),
    };
    sandbox.globalThis = sandbox;
    const context = vm.createContext(sandbox);
    files.forEach((file) => {
      vm.runInContext(file.source, context, { filename: file.name });
    });

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
    const ui = sandbox.InventoryV2Bootstrap.create({
      facade,
      documentRef: document,
      mountNode: document.body,
    });
    ui.open();
    assert.strictEqual(dispatched[0].type, sandbox.InventoryV2ActionType.OPEN);
    dispatched.length = 0;

    assert.strictEqual(typeof subscriber, "function");
    subscriber({ viewModel: currentView, warning: "Partial refill" });
    const warningNode = this.#findByClass(ui.rootNode, "inventory-v2-warning");
    assert.strictEqual(warningNode.textContent, "Partial refill");
    assert.ok(warningNode.classList.contains("is-visible"));
    const mainNode = this.#findByClass(ui.rootNode, "inventory-v2-main");
    const headerHost = this.#findByClass(
      ui.rootNode,
      "inventory-v2-modal__header-host",
    );
    assert.deepStrictEqual(
      Array.from(ui.rootNode.children),
      [headerHost, warningNode, mainNode],
      "Warning must sit between the header parameters and both inventory panels",
    );
    subscriber(currentView);

    const bottomAuxiliary = this.#findByClass(
      ui.rootNode,
      "inventory-v2-loadout-panel__auxiliary",
    );
    ["net", "handChum", "delivery", "gasMask"].forEach((slotId) => {
      assert.ok(bottomAuxiliary.contains(this.#field(ui.rootNode, slotId)));
    });
    assert.deepStrictEqual(
      Array.from(bottomAuxiliary.children, (field) => field.dataset.slotId),
      ["net", "handChum", "delivery", "gasMask"],
      "Bottom equipment row must render net, hand chum, boat and gas mask in order",
    );

    const loadoutShell = this.#findByClass(
      ui.rootNode,
      "inventory-v2-loadout-shell",
    );
    const loadoutPanel = this.#findByClass(
      loadoutShell,
      "inventory-v2-loadout-panel",
    );
    const saveBar = this.#findByClass(
      loadoutShell,
      "inventory-v2-loadout-save",
    );
    assert.strictEqual(saveBar.parentNode, loadoutShell);
    assert.ok(
      !loadoutPanel.contains(saveBar),
      "Save bar must stay above the bordered loadout panel",
    );

    const reelEmptyButton = this.#findByClass(
      this.#field(ui.rootNode, "reel"),
      "inventory-v2-slot__empty-button",
    );
    assert.strictEqual(reelEmptyButton.textContent, "");
    assert.strictEqual(reelEmptyButton.title, "Reel");

    const gasMaskButton = this.#findByClass(
      this.#field(ui.rootNode, "gasMask"),
      "inventory-v2-slot__empty-button",
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
      "inventory-v2-resource-meter",
    );
    assert.strictEqual(
      this.#findByClass(
        equippedBoatMeter,
        "inventory-v2-resource-meter__icon",
      ).textContent,
      "⚡",
      "Boat energy meter must place the lightning left of the scale",
    );
    assert.strictEqual(
      this.#findAllByClass(
        ui.rootNode,
        "inventory-v2-item-card__name",
      ).length,
      0,
      "Miniatures must not show item names",
    );

    const categoryToggle = this.#findByClass(
      ui.rootNode,
      "inventory-v2-categories__toggle",
    );
    const categoryNavigation = this.#findByClass(
      ui.rootNode,
      "inventory-v2-categories",
    );
    const subfilterPanel = this.#findByClass(
      ui.rootNode,
      "inventory-v2-subfilters",
    );
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "false");
    categoryToggle.click();
    assert.ok(subfilterPanel.classList.contains("is-open"));
    assert.ok(categoryToggle.classList.contains("is-active"));
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "true");
    const subtypeCheckbox = this.#findByClass(
      subfilterPanel,
      "inventory-v2-subfilters__checkbox",
    );
    subtypeCheckbox.checked = true;
    subtypeCheckbox.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.SUBFILTER_TOGGLE,
      filterId: "hooks",
      enabled: true,
    });
    categoryToggle.click();
    assert.ok(!subfilterPanel.classList.contains("is-open"));
    assert.strictEqual(categoryToggle.getAttribute("aria-expanded"), "false");
    assert.ok(
      this.#walk(categoryNavigation).some((node) =>
        node.textContent.includes("Підсаки"),
      ),
      "Separate nets category must be rendered",
    );

    this.#findByClass(ui.rootNode, "inventory-v2-categories__button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.CATEGORY_SELECT,
      categoryId: "all",
    });

    const inventoryCard = this.#inventoryCard(ui.rootNode, "assembly-bag");
    const tooltip = this.#findByClass(document.body, "inventory-v2-tooltip");
    inventoryCard.emit("mouseenter");
    assert.ok(
      tooltip.textContent.includes("Потужність") &&
        tooltip.textContent.includes("12 кг") &&
        tooltip.textContent.includes("Сумісність"),
      "Hover must show authored display parameters and compatibility",
    );
    inventoryCard.emit("mouseleave");
    assert.strictEqual(tooltip.style.display, "none");
    const compatibleWrapper = inventoryCard.parentNode;
    assert.ok(
      compatibleWrapper.classList.contains("is-compatible"),
      "A card compatible with the selected equipment slot must be green-highlighted",
    );
    const highlightedReelWell = this.#findByClass(
      this.#field(ui.rootNode, "reel"),
      "inventory-v2-slot",
    );
    assert.ok(
      highlightedReelWell.classList.contains("is-highlighted"),
      "The selected empty equipment slot must be green-highlighted",
    );
    inventoryCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
      instanceId: "assembly-bag",
    });

    dispatched.length = 0;
    inventoryCard.emit("pointerdown", { pointerId: 7 });
    timers.advance(1499);
    assert.strictEqual(dispatched.length, 0, "Long press fired too early");
    timers.advance(1);
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS,
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
    for (let elapsed = 0; elapsed < 1500; elapsed += 250) {
      timers.advance(250);
      ui.updateDynamicProgression(250);
    }
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS,
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
    timers.advance(1500);
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
      type: sandbox.InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE,
      instanceId: "saved-kit",
    });
    dispatched.length = 0;
    savedLoadoutCard.emit("pointerdown", { pointerId: 11 });
    timers.advance(1499);
    assert.strictEqual(
      dispatched.length,
      0,
      "Saved loadout disassembly fired before 1500ms",
    );
    timers.advance(1);
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS,
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
    this.#findByClass(reelField, "inventory-v2-slot__empty-button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE,
      slotId: "reel",
      instanceId: null,
    });

    dispatched.length = 0;
    const tackleCard = this.#findByClass(
      this.#field(ui.rootNode, "tackle"),
      "inventory-v2-item-card",
    );
    tackleCard.emit("pointerdown", { pointerId: 9 });
    timers.advance(1500);
    tackleCard.emit("pointerup", { pointerId: 9 });
    tackleCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS,
      slotId: "tackle",
      instanceId: "assembly-active",
    });
    assert.strictEqual(dispatched.length, 1);

    const autoBait = this.#findById(ui.rootNode, "inventory-v2-auto-bait");
    autoBait.checked = true;
    autoBait.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.AUTO_BAIT_CHANGE,
      enabled: true,
    });
    const autoChum = this.#findById(ui.rootNode, "inventory-v2-auto-chum");
    autoChum.checked = true;
    autoChum.emit("change");
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.AUTO_CHUM_CHANGE,
      enabled: true,
    });

    const saveInput = this.#findByClass(
      ui.rootNode,
      "inventory-v2-loadout-save__input",
    );
    saveInput.value = "Match";
    saveInput.focus();
    const scrollableLoadout = this.#findByClass(
      ui.rootNode,
      "inventory-v2-loadout-panel",
    );
    const scrollableInventory = this.#findByClass(
      ui.rootNode,
      "inventory-v2-inventory-grid",
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
    assert.strictEqual(
      this.#findByClass(
        ui.rootNode,
        "inventory-v2-loadout-save__input",
      ),
      saveInput,
      "Dynamic updates must preserve the active input node",
    );
    assert.strictEqual(saveInput.value, "Match");
    assert.strictEqual(document.activeElement, saveInput);
    assert.strictEqual(scrollableLoadout.scrollTop, 37);
    assert.strictEqual(scrollableInventory.scrollTop, 91);
    assert.strictEqual(equippedBoatMeter.getAttribute("aria-valuenow"), "62");
    this.#findByClass(
      ui.rootNode,
      "inventory-v2-loadout-save__button",
    ).click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.LOADOUT_SAVE,
      name: "Match",
    });

    const progressionDomAdapter = {
      apply: (card, _progression, _visual, options = {}) => {
        const badge = document.createElement("span");
        badge.className = "inv-slot__level-badge";
        badge.textContent = "4";
        card.appendChild(badge);
        if (options.renderCapacityBar !== false) {
          const capacity = document.createElement("span");
          capacity.className = "inv-slot__capacity-bar";
          card.appendChild(capacity);
        }
      },
    };
    const isolatedItemRenderer = new sandbox.InventoryV2ItemCardRenderer({
      domFactory: new sandbox.InventoryV2DomFactory(document),
      progressionDomAdapter,
    });
    const extensibleMeterResolver = new sandbox.InventoryV2ResourceMeterResolver({
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
      JSON.parse(JSON.stringify(
        extensibleMeterResolver.resolve({ durability: { percent: 43 } }),
      )),
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
      new sandbox.InventoryV2ItemParametersResolver().resolve({
        instanceId: "internal-instance",
        type: "system-only-type",
        level: 3,
        charge: { percent: 72, label: "Charge 72%" },
        displayStats: { Power: "12 kg", Range: "45 m" },
        engineStats: { internalRuntimeValue: 999 },
      });
    assert.ok(
      productionParameters.some(
        (parameter) => parameter.id === "level" && parameter.value === "3",
      ) &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "resource:energy" &&
            parameter.kind === "bar" &&
            parameter.percent === 72,
        ) &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "stat:power" && parameter.value === "12 kg",
        ) &&
        productionParameters.some(
          (parameter) =>
            parameter.id === "stat:range" && parameter.value === "45 m",
        ) &&
        !productionParameters.some(
          (parameter) =>
            parameter.label === "instanceId" || parameter.label === "internalRuntimeValue",
        ),
      "Large assembly cards must expose only authored gameplay parameters",
    );
    const inventoryBoat = isolatedItemRenderer.renderInventoryItem({
      instanceId: "boat-inventory",
      name: "Boat",
      icon: "B",
      charge: { percent: 74, label: "Boat charge 74%" },
    });
    const inventoryBoatMeter = this.#findByClass(
      inventoryBoat,
      "inventory-v2-resource-meter",
    );
    assert.strictEqual(
      inventoryBoatMeter.className,
      equippedBoatMeter.className,
      "Equipped and inventory boats must use the exact same energy meter",
    );
    assert.strictEqual(
      this.#findByClass(
        inventoryBoatMeter,
        "inventory-v2-resource-meter__icon",
      ).textContent,
      "⚡",
    );
    const attachedInventoryItem = isolatedItemRenderer.renderItem({
      instanceId: "attached-inventory-item",
      name: "Attached inventory item",
      icon: "H",
      attachments: [
        { instanceId: "attached-bait", name: "Bait", icon: "B" },
      ],
    });
    assert.strictEqual(
      this.#findAllByClass(
        attachedInventoryItem,
        "inventory-v2-attachment-badge",
      ).length,
      1,
      "Inventory thumbnails must keep their attachment circles",
    );
    const emptyDraftCard = isolatedItemRenderer.renderItem({
      instanceId: "empty-draft-stack",
      name: "Empty draft stack",
      icon: "D",
      status: "draft",
      equipped: false,
      assemblyCompletion: {
        isComplete: false,
        hasAnyComponent: false,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        emptyDraftCard,
        "inventory-v2-item-card__incomplete-dot",
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
      assemblyCompletion: {
        isComplete: false,
        hasAnyComponent: true,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        partialDraftCard,
        "inventory-v2-item-card__incomplete-dot",
      ).length,
      1,
      "A partially filled inventory assembly must show the red dot",
    );
    const equippedEmptyCard = isolatedItemRenderer.renderItem({
      instanceId: "equipped-empty-stack",
      name: "Equipped empty stack",
      icon: "E",
      equipped: true,
      assemblyCompletion: {
        isComplete: false,
        hasAnyComponent: false,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        equippedEmptyCard,
        "inventory-v2-item-card__incomplete-dot",
      ).length,
      1,
      "An equipped incomplete assembly needs the red dot even when empty",
    );
    const completeCard = isolatedItemRenderer.renderItem({
      instanceId: "complete-stack",
      name: "Complete stack",
      icon: "C",
      equipped: true,
      assemblyCompletion: {
        isComplete: true,
        hasAnyComponent: true,
      },
    });
    assert.strictEqual(
      this.#findAllByClass(
        completeCard,
        "inventory-v2-item-card__incomplete-dot",
      ).length,
      0,
      "A fully completed assembly must not show the red dot",
    );
    const leveledCard = isolatedItemRenderer.renderItem({
      instanceId: "leveled-item",
      name: "Leveled item",
      icon: "L",
      level: 4,
      progression: {
        available: true,
        level: { available: true, value: 4 },
        capacity: { available: true, percent: 75 },
      },
    });
    assert.strictEqual(
      this.#findAllByClass(leveledCard, "inv-slot__level-badge").length,
      1,
    );
    const lineResourceMeter = this.#findByClass(
      leveledCard,
      "inventory-v2-resource-meter",
    );
    assert.strictEqual(
      this.#findAllByClass(leveledCard, "inv-slot__capacity-bar").length,
      0,
      "Inventory V2 must not duplicate the legacy line-capacity bar",
    );
    assert.strictEqual(
      lineResourceMeter.dataset.resourceId,
      "capacity",
    );
    assert.strictEqual(
      this.#findAllByClass(
        lineResourceMeter,
        "inventory-v2-resource-meter__icon",
      ).length,
      0,
      "Line capacity reuses the resource meter without an emoji",
    );
    assert.strictEqual(
      this.#findAllByClass(
        leveledCard,
        "inventory-v2-item-card__level",
      ).length,
      0,
      "Progression adapter and item renderer must not duplicate the level badge",
    );

    currentView = this.#savedLoadoutViewModel();
    ui.render(currentView);
    const savedPreview = this.#findByClass(
      ui.rootNode,
      "inventory-v2-saved-loadout-preview",
    );
    assert.ok(
      this.#findByClass(ui.rootNode, "inventory-v2-main__left").contains(
        this.#findByClass(ui.rootNode, "inventory-v2-loadout-panel"),
      ),
      "Saved loadout preview must leave the equipment panel on the left",
    );
    assert.ok(
      this.#findByClass(ui.rootNode, "inventory-v2-main__right").contains(
        savedPreview,
      ),
      "Saved loadout contents must replace the right inventory panel",
    );
    assert.strictEqual(
      this.#findAllByClass(
        savedPreview,
        "inventory-v2-saved-loadout-preview__field",
      ).length,
      2,
      "Saved loadout preview must show only its contained roots",
    );
    assert.strictEqual(
      this.#findAllByClass(
        savedPreview,
        "inventory-v2-saved-loadout-preview__membership-dot",
      ).length,
      2,
      "Every saved root must keep the green loadout-membership dot",
    );
    const savedRodCard = this.#walk(savedPreview).find(
      (node) =>
        node.classList.contains("inventory-v2-item-card") &&
        node.dataset.instanceId === "saved-rod",
    );
    assert.ok(savedRodCard, "Saved rod card must be rendered");
    savedRodCard.click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.LOADOUT_PREVIEW_SLOT_EQUIP,
      loadoutId: "saved-kit",
      slotId: "rod",
    });
    const previewButtons = this.#findAllByClass(
      savedPreview,
      "inventory-v2-saved-loadout-preview__button",
    );
    const previewButtonActions = [
      sandbox.InventoryV2ActionType.LOADOUT_EQUIP_ALL,
      sandbox.InventoryV2ActionType.LOADOUT_PREVIEW_BACK,
      sandbox.InventoryV2ActionType.LOADOUT_DISASSEMBLE,
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
    const assemblyVisual = this.#findByClass(
      ui.rootNode,
      "inventory-v2-assembly-editor__visual",
    );
    assert.strictEqual(
      this.#findAllByClass(
        assemblyVisual,
        "inventory-v2-attachment-badge",
      ).length,
      0,
      "The large assembly root must not duplicate socket contents as circles",
    );
    const assemblyParameters = this.#findByClass(
      ui.rootNode,
      "inventory-v2-item-parameters",
    );
    assert.ok(
      assemblyParameters.textContent.includes("Рівень") &&
        assemblyParameters.textContent.includes("Power") &&
        assemblyParameters.textContent.includes("55%"),
      "The assembly root must show only its production parameters below sockets",
    );
    assert.ok(
      this.#findAllByClass(assemblyParameters, "inventory-v2-parameter-row")
        .length >= 3 &&
        this.#findAllByClass(
          assemblyParameters,
          "inventory-v2-parameter-bar-track",
        ).length === 1,
      "The large card must render its resource as a production parameter bar",
    );
    const assemblyWorkspace = this.#findByClass(
      ui.rootNode,
      "inventory-v2-assembly-editor__workspace",
    );
    assert.deepStrictEqual(
      assemblyWorkspace.children.slice(0, 3).map((node) => node.className),
      [
        "inventory-v2-assembly-editor__visual",
        "inventory-v2-assembly-editor__sockets",
        "inventory-v2-item-parameters",
      ],
      "The assembly card must order visual, sockets and parameters vertically",
    );
    const socket = this.#field(ui.rootNode, "hook");
    this.#findByClass(socket, "inventory-v2-slot__empty-button").click();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.ASSEMBLY_SOCKET_ACTIVATE,
      rootInstanceId: "assembly-active",
      socketId: "hook[0]",
      slotId: "hook",
      slotIndex: 0,
      parentInstanceId: "assembly-active",
    });

    const baitSocket = this.#field(ui.rootNode, "bait");
    assert.strictEqual(
      this.#findByClass(baitSocket, "inventory-v2-field__label").textContent,
      "Наживка — гачок 1",
    );
    const baitWell = this.#findByClass(baitSocket, "inventory-v2-slot");
    assert.ok(baitWell.classList.contains("is-filled"));
    assert.ok(
      baitWell.classList.contains("is-highlighted"),
      "A filled compatible socket must be highlighted for replacement",
    );

    const buttonActions = [
      ["Спорядити", sandbox.InventoryV2ActionType.ASSEMBLY_EQUIP],
      ["Зняти", sandbox.InventoryV2ActionType.ASSEMBLY_UNEQUIP],
      ["Розібрати", sandbox.InventoryV2ActionType.ASSEMBLY_DISASSEMBLE],
      ["Назад", sandbox.InventoryV2ActionType.ASSEMBLY_BACK],
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
    currentView.panel.assembly.canDisassemble = false;
    currentView.panel.assembly.showDisassemble = false;
    currentView.panel.assembly.sockets = currentView.panel.assembly.sockets.map(
      (editorSocket) => ({ ...editorSocket, item: null, state: "available" }),
    );
    ui.render(currentView);
    assert.strictEqual(
      this.#findAllByClass(
        ui.rootNode,
        "inventory-v2-assembly-editor__button",
      ).length,
      2,
      "An unequipped root with empty sockets must omit Unequip and Disassemble",
    );
    assert.strictEqual(
      this.#findAllByClass(ui.rootNode, "is-danger").length,
      0,
      "The hidden Disassemble action must not leave a danger button",
    );

    ui.close();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.CLOSE,
    });
    dispatched.length = 0;
    subscriber({ warning: "Not enough bait for every hook" });
    assert.strictEqual(ui.isOpen, true);
    assert.ok(ui.rootNode.classList.contains("is-open"));
    assert.strictEqual(
      this.#findByClass(ui.rootNode, "inventory-v2-warning").textContent,
      "Not enough bait for every hook",
    );
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.OPEN,
    });
    ui.close();
    this.#assertLast(dispatched, {
      type: sandbox.InventoryV2ActionType.CLOSE,
    });
    const observedTypes = new Set(observed.map((action) => action.type));
    Object.values(sandbox.InventoryV2ActionType).forEach((type) => {
      assert.ok(observedTypes.has(type), `Missing interaction action: ${type}`);
    });
    ui.dispose();
  }

  #validActionSamples(actions) {
    return [
      { type: actions.OPEN },
      { type: actions.CLOSE },
      { type: actions.CATEGORY_SELECT, categoryId: "all" },
      { type: actions.SUBFILTER_TOGGLE, filterId: "hooks", enabled: true },
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
      ...[
        actions.ASSEMBLY_EQUIP,
        actions.ASSEMBLY_UNEQUIP,
        actions.ASSEMBLY_DISASSEMBLE,
        actions.ASSEMBLY_BACK,
      ].map((type) => ({ type, rootInstanceId: "rig" })),
      { type: actions.LOADOUT_SAVE, name: "Match" },
      {
        type: actions.LOADOUT_PREVIEW_SLOT_EQUIP,
        loadoutId: "saved-kit",
        slotId: "rod",
      },
      { type: actions.LOADOUT_EQUIP_ALL, loadoutId: "saved-kit" },
      { type: actions.LOADOUT_DISASSEMBLE, loadoutId: "saved-kit" },
      { type: actions.LOADOUT_PREVIEW_BACK, loadoutId: "saved-kit" },
      { type: actions.AUTO_BAIT_CHANGE, enabled: true },
      { type: actions.AUTO_CHUM_CHANGE, enabled: false },
    ];
  }

  #loadoutViewModel() {
    const item = (instanceId, extra = {}) => ({
      instanceId,
      itemId: instanceId,
      type: "hook",
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
                type: "boat",
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
        items: [
          item("assembly-bag", {
            status: "prepared",
            compatibleWithHighlightedSlot: true,
            requiresTag: "hook",
            displayStats: { "Потужність": "12 кг" },
          }),
          item("saved-kit", {
            type: "equipment_loadout",
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
            level: 2,
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
          canDisassemble: true,
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
                type: "bait",
                name: "Worm",
                icon: "W",
                quantity: 1,
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
      inventory: {
        ...base.inventory,
        mode: "saved-loadout",
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
                type: "feeder",
                name: "Saved rod",
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
                type: "spring",
                name: "Saved spring",
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
    const found = this.#walk(root).find((node) => node.classList.contains(className));
    assert.ok(found, `Missing element .${className}`);
    return found;
  }

  #findAllByClass(root, className) {
    return this.#walk(root).filter((node) => node.classList.contains(className));
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
        node.classList.contains("inventory-v2-field") &&
        node.dataset.slotId === slotId,
    );
    assert.ok(found, `Missing field ${slotId}`);
    return found;
  }

  #inventoryCard(root, instanceId) {
    const wrapper = this.#walk(root).find(
      (node) =>
        node.classList.contains("inventory-v2-inventory-item") &&
        node.dataset.instanceId === instanceId,
    );
    assert.ok(wrapper, `Missing inventory item ${instanceId}`);
    return this.#findByClass(wrapper, "inventory-v2-item-card");
  }
}

new InventoryV2StaticContractCheck().run();
