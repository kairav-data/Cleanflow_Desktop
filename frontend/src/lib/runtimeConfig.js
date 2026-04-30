const desktopRuntime = typeof window !== 'undefined' ? window.cleanflowDesktop : undefined;

export const API_BASE =
  desktopRuntime?.apiBaseUrl ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '';

export const IS_DESKTOP = Boolean(desktopRuntime?.isDesktop);
