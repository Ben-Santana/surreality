import { Menu, Moon, Sun, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { pages, sections, type DocPath, isCurrent } from "./nav";

export function Layout({ path, children }: { path: DocPath; children: ReactNode }) {
  const [light, setLight] = useState(() => localStorage.getItem("mapping-docs-theme") === "light");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    localStorage.setItem("mapping-docs-theme", light ? "light" : "dark");
  }, [light]);
  useEffect(() => setMenuOpen(false), [path]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.classList.add("menu-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="#/" aria-label="Surreality documentation home">
          <span className="mark"><i /><i /><i /></span>
          <span>SURREALITY</span><b>/</b><em>DEVELOPER</em>
        </a>
        <div className="top-actions">
          <span className="version">FORMAT 02</span>
          <button className="theme-toggle" onClick={() => setLight((value) => !value)} aria-label={`Use ${light ? "dark" : "light"} mode`}>
            {light ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button className="menu-toggle" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={`${menuOpen ? "Close" : "Open"} navigation`}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <aside className={`rail${menuOpen ? " is-open" : ""}`} id="site-navigation" aria-label="Documentation navigation">
        <p className="eyebrow">CONTENTS</p>
        <nav>
          {sections.map((section) => (
            <section className="nav-section" key={section.label}>
              <h2>{section.label}</h2>
              {section.pages.map((item) => {
                const index = pages.findIndex((page) => page.path === item.path);
                return (
                  <a key={item.path} href={`#${item.path}`} aria-current={isCurrent(item.path, path) ? "page" : undefined}>
                    <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
                  </a>
                );
              })}
            </section>
          ))}
        </nav>
      </aside>
      {menuOpen && <button className="menu-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

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
