export function initEngineInterface(documentTarget = document) {
  const onTouchStart = () => {};
  const onContextMenu = e => e.preventDefault();
  documentTarget.addEventListener("touchstart", onTouchStart, { passive: true });
  documentTarget.addEventListener("contextmenu", onContextMenu, true);
  return () => {
    documentTarget.removeEventListener("touchstart", onTouchStart);
    documentTarget.removeEventListener("contextmenu", onContextMenu, true);
  };
}

