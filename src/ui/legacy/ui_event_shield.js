class UIUtils {
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
      // ВИПРАВЛЕННЯ: Використовуємо capture: false (Bubbling)
      // Це дозволяє дітям (+ / -) та власним обробникам перетягування спрацювати першими.
      element.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
          // Ми видалили stopImmediatePropagation, щоб не блокувати
          // інші скрипти на цьому ж елементі.
        },
        { capture: false },
      );
    });

    element.addEventListener("contextmenu", (e) => e.preventDefault());
    element.style.touchAction = "none";
    element.style.pointerEvents = "all";
  }
}

