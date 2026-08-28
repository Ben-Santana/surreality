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
  const [path, setPath] = useState<DocPath>(() => pathFromHash());
  useEffect(() => {
    const onHash = () => setPath(pathFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (path === "/" || path === "/quickstart") return;
    window.scrollTo(0, 0);
  }, [path]);

  return <Layout path={path}>{page(path)}</Layout>;
}
