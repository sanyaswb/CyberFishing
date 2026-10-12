export class UiEventShield {
  static makeSolid(element) {
    if (!element) return;

    const eventsToBlock = [
      "pointerdown",
      "pointerup",
      "pointermove",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "touchstart",
      "touchend",
      "touchmove",
      "wheel",
    ];

    eventsToBlock.forEach((evt) => {
      // Bubble so child controls and drag handlers can run first.

      element.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
          // Allow other handlers on this element to run as well.

        },
        { capture: false },
      );
    });

    element.addEventListener("contextmenu", (e) => e.preventDefault());
    element.style.touchAction = "none";
    element.style.pointerEvents = "all";
  }
}

