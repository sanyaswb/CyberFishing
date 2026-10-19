import { InventoryRadialSelectorRenderer } from "../../game/presentation/inventory/inventory_radial_selector_renderer.js";
import { InventoryRadialSelectorController } from "../../platform/browser/dom/inventory_radial_selector_controller.js";
import { KeepnetFillImageResolver } from "../../game/presentation/keepnet/keepnet_fill_image_resolver.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";

/**
 * UI Catalog example for radial inventory selector (TK-008.5).
 */
export class UiCatalogSelectorExample {
  #dom;
  #mount;
  #status;
  #surface;
  #renderer = null;
  #controller = null;
  #classicButtonMount = null;

  constructor({ domFactory, surface, status }) {
    this.#dom = domFactory;
    this.#mount = surface.mountRoot;
    this.#status = status;
    this.#surface = surface;

    const imageResolver = new KeepnetFillImageResolver({ stages: KEEPNET_ART_STAGES });
    this.#renderer = new InventoryRadialSelectorRenderer({
      domFactory: this.#dom,
      imageResolver,
    });
    this.#renderer.element.classList.add("ui-catalog-preview__selector");

    this.#controller = new InventoryRadialSelectorController({
      renderer: this.#renderer,
      uiSurface: this.#surface,
      windowRef: this.#dom.view,
      onSelect: (sectionId) => {
        this.#status.textContent = `Вибрано розділ інвентарю: «${sectionId}». Селектор складено.`;
      },
      onStateChange: ({ isOpen, candidateSectionId }) => {
        if (candidateSectionId) {
          this.#status.textContent = `Кандидат вибору: «${candidateSectionId}»`;
        } else if (isOpen) {
          this.#status.textContent = "Селектор розкрито. Очікування вибору секції.";
        }
      },
    });

    this.#mount.appendChild(this.#renderer.element);
    this.#status.textContent = "Радіальний селектор готовий до взаємодії.";
  }

  setState(state) {
    if (this.#classicButtonMount) {
      this.#classicButtonMount.remove();
      this.#classicButtonMount = null;
    }

    if (state === "normal") {
      this.#renderer.element.hidden = false;
      this.#renderer.setOpen(false, { animated: false });
      this.#status.textContent = "Селектор у звичайному (закритому) стані.";
    } else if (state === "open") {
      this.#renderer.element.hidden = false;
      this.#renderer.setOpen(true, { animated: false });
      this.#renderer.setHighlightedSector(null);
      this.#status.textContent = "Селектор розкрито (три секції: екіпіровка, рюкзак, садок).";
    } else if (state === "equipment" || state === "backpack" || state === "keepnet") {
      this.#renderer.element.hidden = false;
      this.#renderer.setOpen(true, { animated: false });
      this.#renderer.setHighlightedSector(state);
      this.#status.textContent = `Підсвічено секцію «${state}».`;
    } else if (state === "reduced-motion") {
      this.#renderer.element.hidden = false;
      this.#renderer.setOpen(true, { animated: false });
      this.#status.textContent = "Режим reduced-motion: миттєве розкриття без переходів.";
    } else if (state === "classic") {
      this.#renderer.element.hidden = true;
      this.#classicButtonMount = this.#dom.element("div", "ui-catalog-preview__toolbar-row");
      this.#classicButtonMount.style.position = "absolute";
      this.#classicButtonMount.style.right = "var(--ui-edge-right)";
      this.#classicButtonMount.style.bottom = "var(--ui-edge-bottom)";
      this.#classicButtonMount.style.display = "flex";
      this.#classicButtonMount.style.gap = "var(--ui-toolbar-gap)";

      const keepnetBtn = this.#dom.button("game-toolbar-button game-toolbar-button--keepnet", "🧺");
      keepnetBtn.title = "Садок (classic)";
      keepnetBtn.addEventListener("click", () => {
        this.#status.textContent = "Classic: натиснуто кнопку садка.";
      });

      const invBtn = this.#dom.button("game-toolbar-button game-toolbar-button--inventory", "🎒");
      invBtn.title = "Рюкзак (classic)";
      invBtn.addEventListener("click", () => {
        this.#status.textContent = "Classic: натиснуто кнопку рюкзака.";
      });

      this.#classicButtonMount.append(keepnetBtn, invBtn);
      this.#mount.appendChild(this.#classicButtonMount);
      this.#status.textContent = "Режим classic: дві окремі кнопки замість радіального селектора.";
    }
  }

  dispose() {
    if (this.#classicButtonMount) {
      this.#classicButtonMount.remove();
      this.#classicButtonMount = null;
    }
    this.#controller?.dispose();
    this.#controller = null;
    this.#renderer?.dispose();
    this.#renderer = null;
  }
}
