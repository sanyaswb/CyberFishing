import { initEngineInterface } from "../dom/engine_interface.js";

export function getBrowserStartupEnvironment() {
  return { windowTarget: window, documentTarget: document };
}

export function publishBrowserStartupConfig(windowTarget, configRuntime, projectVersion) {
  windowTarget.CYBER_FISHING_CONFIG_RUNTIME = configRuntime;
  windowTarget.CYBER_FISHING_PROJECT_VERSION = projectVersion;
}

export function activateBrowserStartupInterface(documentTarget, mountVersionBadge) {
  const disposeInterface = initEngineInterface(documentTarget);
  if (documentTarget.readyState === "loading") {
    documentTarget.addEventListener("DOMContentLoaded", mountVersionBadge, { once: true });
  } else {
    mountVersionBadge();
  }
  return () => {
    documentTarget.removeEventListener("DOMContentLoaded", mountVersionBadge);
    disposeInterface?.();
  };
}
