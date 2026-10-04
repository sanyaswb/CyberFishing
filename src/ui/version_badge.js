(function mountGameVersionBadge() {
  if (typeof document === "undefined") return;
  const mount = () => GameVersionBadge.mountById();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
