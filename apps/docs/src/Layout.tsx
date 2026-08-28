import { Moon, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { pages, type DocPath, isCurrent } from "./nav";

export function Layout({ path, children }: { path: DocPath; children: ReactNode }) {
  const [light, setLight] = useState(() => localStorage.getItem("mapping-docs-theme") === "light");
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("mapping-docs-theme", light ? "light" : "dark");
  }, [light]);

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="#/" aria-label="Projection Mapping Room documentation home">
          <span className="mark"><i /><i /><i /></span>
          <span>ROOM</span><b>/</b><em>DEVELOPER</em>
        </a>
        <div className="top-actions">
          <span className="version">FORMAT 01</span>
          <button className="theme-toggle" onClick={() => setLight((value) => !value)} aria-label={`Use ${light ? "dark" : "light"} mode`}>
            {light ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      <aside className="rail" aria-label="Documentation navigation">
        <p className="eyebrow">CONTENTS</p>
        <nav>
          {pages.map((item, index) => (
            <a key={item.path} href={`#${item.path}`} aria-current={isCurrent(item.path, path) ? "page" : undefined}>
              <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
            </a>
          ))}
        </nav>
        <div className="rail-note"><span>RISK MODEL</span><p>Mapping packages contain executable browser code. Install only what you trust.</p></div>
      </aside>

      <main>{children}</main>
    </div>
  );
}

export function Pager({ path }: { path: DocPath }) {
  const index = pages.findIndex((page) => page.path === path);
  const previous = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;
  if (!previous && !next) return null;
  return (
    <nav className="pager" aria-label="Page">
      {previous ? <a href={`#${previous.path}`}><small>Previous</small>{previous.label}</a> : <span />}
      {next ? <a href={`#${next.path}`} className="pager-next"><small>Next</small>{next.label}</a> : <span />}
    </nav>
  );
}

export function CodeBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="code-card doc-code">
      <div className="code-title">
        {title}
        <button type="button" onClick={() => void navigator.clipboard.writeText(value)}>COPY</button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}
