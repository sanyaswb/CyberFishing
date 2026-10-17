// Scrolls the nearest vertical scroller so an element's top meets the scroller's top (spec 093), or the bottom of a
// sticky header there (the item editor's actions bar) plus the scroller's row gap. The browser clamps the target at the
// end of the content, so a short page stops at its bottom. Smooth unless the viewer prefers reduced motion. It measures
// only when asked (a tap), never per frame.
export class ScrollContainerAligner {
  #window;

  constructor({ windowRef }) {
    this.#window = windowRef;
  }

  alignToTop(element) {
    const scroller = this.#scrollerOf(element);
    if (!scroller) return;
    const offset = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top -
      this.#stickyInset(scroller, element);
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

  // The space a stuck sticky child of the scroller covers below the scroller's top border edge: the border, the padding
  // and the sticky offset (negative to stick over the padding), its height and the row gap below it.
  #stickyInset(scroller, element) {
    let inset = 0;
    for (const child of scroller.children || []) {
      if (child === element || child.contains?.(element)) continue;
      const style = this.#window.getComputedStyle(child);
      if (style.position !== "sticky") continue;
      const box = this.#window.getComputedStyle(scroller);
      const px = (value) => Number.parseFloat(value) || 0;
      inset = Math.max(inset, px(box.borderTopWidth) + px(box.paddingTop) + px(style.top) +
        child.getBoundingClientRect().height + px(box.rowGap));
    }
    return inset;
  }
}
