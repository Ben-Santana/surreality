import { useEffect, useState } from "react";
import { Layout } from "./Layout";
import { type DocPath, pathFromHash } from "./nav";
import { Entrypoints } from "./pages/Entrypoints";
import { Events } from "./pages/Events";
import { Home } from "./pages/Home";
import { Manifest } from "./pages/Manifest";
import { Packaging } from "./pages/Packaging";
import { Permissions } from "./pages/Permissions";
import { RuntimeApi } from "./pages/RuntimeApi";
import { Plugins } from "./pages/Plugins";
import { Landing } from "./pages/Landing";

// Preserve existing shared documentation URLs after moving the guide.
function redirectLegacyDocs() {
  if (window.location.pathname === "/" && window.location.hash.startsWith("#/")) {
    window.location.replace(`/docs${window.location.hash}`);
  }
}
redirectLegacyDocs();

function page(path: DocPath) {
  if (path === "/" || path === "/quickstart") return <Home path={path} />;
  if (path === "/manifest") return <Manifest />;
  if (path === "/runtime-api") return <RuntimeApi />;
  if (path === "/entrypoints") return <Entrypoints />;
  if (path === "/plugins") return <Plugins />;
  if (path === "/events") return <Events />;
  if (path === "/permissions") return <Permissions />;
  return <Packaging />;
}

export default function App() {
  const isDocs = /^\/docs\/?$/.test(window.location.pathname);
  const [path, setPath] = useState<DocPath>(() => pathFromHash());
  useEffect(() => {
    const onHash = () => {
      redirectLegacyDocs();
      setPath(pathFromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (path === "/" || path === "/quickstart") return;
    window.scrollTo(0, 0);
  }, [path]);

  useEffect(() => {
    document.title = isDocs ? "Surreality developer guide" : "Surreality";
  }, [isDocs]);

  return isDocs ? <Layout path={path}>{page(path)}</Layout> : <Landing />;
}
