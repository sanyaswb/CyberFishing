// Scrolls the nearest vertical scroller so an element's top meets the scroller's top (spec 093). The browser clamps the
// target at the end of the content, so a short page stops at its bottom. Smooth unless the viewer prefers reduced
// motion. It measures only when asked (a tap), never per frame.
export class ScrollContainerAligner {
  #window;

  constructor({ windowRef }) {
    this.#window = windowRef;
  }

  alignToTop(element) {
    const scroller = this.#scrollerOf(element);
    if (!scroller) return;
    const offset = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const reduced = this.#window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: scroller.scrollTop + offset, behavior: reduced ? "auto" : "smooth" });
  }

  #scrollerOf(element) {
    for (let node = element.parentElement; node; node = node.parentElement) {
      const overflow = this.#window.getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
  }
}
