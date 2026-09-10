export const pages = [
  { path: "/", label: "Overview" },
  { path: "/quickstart", label: "Quickstart" },
  { path: "/manifest", label: "Manifest" },
  { path: "/runtime-api", label: "Runtime API" },
  { path: "/entrypoints", label: "Entrypoints" },
  { path: "/events", label: "Events" },
  { path: "/permissions", label: "Permissions" },
  { path: "/plugins", label: "Native plugins" },
  { path: "/style-guide", label: "Style guide" },
  { path: "/packaging", label: "Packaging" },
] as const;

export type DocPath = (typeof pages)[number]["path"];

export const sections = [
  { label: "Start", pages: pages.slice(0, 2) },
  { label: "Build", pages: pages.slice(2, 7) },
  { label: "Advanced", pages: pages.slice(7, 9) },
  { label: "Ship", pages: pages.slice(9) },
] as const;

export function pathFromHash(hash = window.location.hash): DocPath {
  const trimmed = hash.replace(/^#/, "").replace(/^\/+/, "").split(/[?#]/)[0] ?? "";
  if (!trimmed || trimmed === "overview") return "/";
  const match = pages.find((page) => page.path === `/${trimmed}`);
  return match?.path ?? "/";
}

export function isCurrent(path: DocPath, current: DocPath) {
  return path === current;
}
