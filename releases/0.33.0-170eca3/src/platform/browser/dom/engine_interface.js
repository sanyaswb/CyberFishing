export const UI_EXCEPTIONS = {
  tags: ["INPUT", "TEXTAREA", "BUTTON", "SELECT", "A"],
  classes: [],
  ids: [],
};

export function initEngineInterface(documentTarget = document) {
  const onTouchStart = () => {};
  const onContextMenu = (e) => {
    const t = e.target;
    const isException =
      UI_EXCEPTIONS.tags.includes(t.tagName) ||
      UI_EXCEPTIONS.classes.some((c) => t.classList.contains(c)) ||
      UI_EXCEPTIONS.ids.includes(t.id);
    if (!isException) e.preventDefault();
  };
  documentTarget.addEventListener("touchstart", onTouchStart, { passive: true });
  documentTarget.addEventListener("contextmenu", onContextMenu);
  return () => {
    documentTarget.removeEventListener("touchstart", onTouchStart);
    documentTarget.removeEventListener("contextmenu", onContextMenu);
  };
}

