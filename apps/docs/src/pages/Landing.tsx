import { Apple, ArrowUpRight, Download, Monitor } from "lucide-react";
import { useEffect, useRef } from "react";
import { SurrealityLockup } from "../Brand";
import "../landing.css";

const downloads = [
  { name: "macOS", detail: "Apple silicon · .dmg", href: downloadUrl(import.meta.env.VITE_DOWNLOAD_MAC_URL, "Surreality-1.0.0-arm64.dmg"), size: "132 MB", Icon: Apple },
  { name: "Windows", detail: "64-bit · .exe", href: downloadUrl(import.meta.env.VITE_DOWNLOAD_WINDOWS_URL, "Surreality-Setup-1.0.0-x64.exe"), size: "115 MB", Icon: Monitor },
];

function downloadUrl(configured: string | undefined, file: string) {
  if (configured?.trim()) {
    const url = new URL(configured.trim());
    if (url.protocol !== "https:") throw new Error("Installer URLs must use HTTPS");
    return url.href;
  }
  return `https://github.com/Ben-Santana/surreality/releases/download/v1.0.0-preview.1/${file}`;
}

export function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / (hero.offsetHeight * 0.7)));
      hero.style.setProperty("--hero-blur", `${reducedMotion.matches ? 0 : progress * 18}px`);
      hero.style.setProperty("--hero-opacity", `${1 - progress * 0.8}`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    reducedMotion.addEventListener("change", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reducedMotion.removeEventListener("change", onScroll);
    };
  }, []);

  return (
    <div className="landing">
      <a className="skip-link" href="#downloads">Skip to downloads</a>
      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title" ref={heroRef}>
          <div className="hero-atmosphere" aria-hidden="true">
            <img className="prism-art" src="/prism-ember.svg" alt="" fetchPriority="high" />
            <div className="prism-shade" />
          </div>
          <div className="hero-identity">
            <h1 id="landing-title"><SurrealityLockup /></h1>
            <p>Reality has too many rules. Break a few.</p>
          </div>
        </section>

        <section className="download-section" id="downloads" aria-labelledby="download-title">
          <div className="download-intro">
            <p className="landing-eyebrow">01 / GET SURREALITY</p>
            <h2 id="download-title">A new dimension.<br /><i>Same room.</i></h2>
            <p>Start with a projector and a little imagination.<br />Surreality takes it from there.</p>
          </div>
          <div className="download-options">
            {downloads.map(({ name, detail, href, size, Icon }) => (
              <a className="download-card" href={href} aria-disabled={!href || undefined} download={href?.startsWith("/") || undefined} key={name}>
                <div className="download-card-top"><Icon size={30} strokeWidth={1.4} /><span>V 1.0.0</span></div>
                <h3>Download for {name}</h3>
                <p>{detail}</p>
                <div className="download-card-bottom"><span>{href ? size : "Download coming soon"}</span>{href && <Download size={20} />}</div>
              </a>
            ))}
            <p className="download-docs">Want to build your own mappings? <a href="/docs">Explore the docs <ArrowUpRight size={14} /></a></p>
          </div>
        </section>
      </main>
      <footer className="landing-footer"><SurrealityLockup /><span>Reality is only the starting point.</span><a href="https://feralui.dev/gradients">Prism by FeralUI <ArrowUpRight size={12} /></a></footer>
    </div>
  );
}
