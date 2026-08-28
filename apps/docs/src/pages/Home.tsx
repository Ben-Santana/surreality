import { ArrowRight, Box, Code2, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import type { DocPath } from "../nav";

export function Home({ path }: { path: DocPath }) {
  useEffect(() => {
    if (path === "/quickstart") {
      document.getElementById("quickstart")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <>
      <section className="hero" id="overview">
        <div className="hero-copy">
          <p className="kicker"><span>EXTENSION</span> .mapping</p>
          <h1>Reality has too many rules<br /><i>Break a few</i></h1>
          <p className="lede">A complete field guide to building portable, code-powered mappings for Projection Mapping Room.</p>
          <div className="hero-actions">
            <a className="primary" href="#/quickstart">Build your first mapping <ArrowRight size={16} /></a>
            <a className="secondary" href="#/runtime-api">Explore the API</a>
          </div>
        </div>
        <div className="hero-object" aria-hidden="true"><div className="plane p1" /><div className="plane p2" /><div className="plane p3" /><span>480 × 270</span></div>
      </section>

      <section className="principles" aria-label="Package principles">
        <article><Code2 /><span>01</span><h3>Browser native</h3><p>Write standard ES modules with DOM, CSS, Canvas, WebGL, and browser media APIs.</p></article>
        <article><Box /><span>02</span><h3>Geometry aware</h3><p>Choose a quad, polygon, or circle surface; the room handles projection and warping.</p></article>
        <article><ShieldCheck /><span>03</span><h3>Explicitly sandboxed</h3><p>No Node, Electron, or editor internals. Capabilities are declared and reviewed at install.</p></article>
      </section>

      <section className="doc-section quickstart" id="quickstart">
        <div className="section-index">01 / START</div>
        <div className="section-intro"><p className="eyebrow">QUICKSTART</p><h2>From zero to<br />a portable surface.</h2><p>The project includes a generator and packer. Start with the generated renderer and inspector, then ship one auditable file.</p></div>
        <div className="steps">
          <div className="terminal"><div className="terminal-head"><span /><span /><span /><b>TERMINAL</b></div><pre><code><i>$</i> npm run create:mapping -- neon-clock{"\n"}<i>$</i> npm run pack:mapping -- ./custom-mappings/neon-clock{"\n\n"}<span>✓</span> com.example.neon-clock-1.0.0.mapping</code></pre></div>
          <ol>
            <li><b>Scaffold</b><p>Generate a manifest, mapping entrypoint, and inspector.</p></li>
            <li><b>Build</b><p>Use browser APIs. Keep package paths relative and dependencies bundled.</p></li>
            <li><b>Pack</b><p>Create a single <code>.mapping</code> archive for installation.</p></li>
          </ol>
          <p className="continue"><a href="#/manifest">Continue with the manifest reference <ArrowRight size={14} /></a></p>
        </div>
      </section>
    </>
  );
}
