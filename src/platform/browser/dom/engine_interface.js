export const UI_EXCEPTIONS = {
  tags: ["INPUT", "TEXTAREA", "BUTTON", "SELECT", "A"],
  classes: [],
  ids: [],
};

export function initEngineInterface(documentTarget = document) {
  const style = documentTarget.createElement("style");
  style.innerHTML = `
        * {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none !important;
        }
        body {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            touch-action: none;
            overflow: hidden;
        }
        *:focus {
            outline: none !important;
        }
        button, a {
            transition: transform 0.12s ease-out;
            -webkit-user-select: none;
            user-select: none;
        }
        button:active, a:active {
            transform: scale(0.96);
        }
    `;
  documentTarget.head.appendChild(style);

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
    style.remove();
  };
}

