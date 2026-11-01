export class UiEventShield {
  static makeSolid(element) {
    if (!element) return;
    UiEventShield.blockEvents(element);
    element.style.touchAction = "auto";
    element.style.pointerEvents = "all";
  }

  // Event bubbling and hit-region ownership are separate: transparent layouts
  // shield their actual child controls without becoming a solid rectangle.
  static blockEvents(element) {
    if (!element) return () => {};
    const bindings = [];

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

      const listener = e => e.stopPropagation();
      element.addEventListener(evt, listener, { capture: false });
      bindings.push([evt, listener]);
    });

    const onContext = e => e.preventDefault();
    element.addEventListener("contextmenu", onContext);
    return () => {
      for (const [type, listener] of bindings) element.removeEventListener(type, listener, { capture: false });
      element.removeEventListener("contextmenu", onContext);
    };
  }
}

