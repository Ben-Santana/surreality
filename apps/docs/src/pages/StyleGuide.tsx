import { Pager } from "../Layout";
import { SurrealityLockup, SurrealityMark } from "../Brand";

const colors = [
  { name: "Paper", value: "#F4F4F4", variable: "var(--bg)" },
  { name: "Surface", value: "#E2E2E2", variable: "var(--panel)" },
  { name: "Ink", value: "#202020", variable: "var(--text)" },
  { name: "Muted", value: "#686868", variable: "var(--muted)" },
  { name: "Signal", value: "#FF6038", variable: "var(--accent)" },
];

export function StyleGuide() {
  return (
    <article className="doc-article style-guide">
      <p className="eyebrow">SYSTEM / 03</p>
      <h1>Style guide</h1>
      <p className="lede">The working visual language of the developer docs: direct reading, precise structure, and one unmistakable signal color.</p>

      <section className="guide-section">
        <header><p className="eyebrow">01 / MARKS</p><p>The symbol is optically larger than the name and vertically centered against its cap height. Keep the proportions and clear space intact.</p></header>
        <div className="mark-specimen">
          <article><span>Primary lockup</span><SurrealityLockup /></article>
          <article><span>Documentation lockup</span><SurrealityLockup context="docs" /></article>
          <article className="mark-specimen-symbol"><span>Symbol</span><SurrealityMark /></article>
        </div>
      </section>

      <section className="guide-section">
        <header><p className="eyebrow">02 / TYPE</p><p>Each face has one job. Keep the hierarchy sharp by resisting substitutions and extra weights.</p></header>
        <div className="type-specimen">
          <div className="type-row type-display"><span>Avenir Next · display</span><p>Build the impossible.</p></div>
          <div className="type-row type-expression"><span>Break a Few · expression</span><p>Break a few</p></div>
          <div className="type-row type-body"><span>Chakra · reading</span><p>Portable mappings combine code, assets, and a manifest into one auditable package.</p></div>
          <div className="type-row type-small"><span>Chakra · interface</span><p>Runtime API · Version 2 · Next</p></div>
          <div className="type-row type-code"><span>Share · code</span><p>surreality.events.on(&quot;frame&quot;, render)</p></div>
        </div>
      </section>

      <section className="guide-section">
        <header><p className="eyebrow">03 / COLOR</p><p>Neutral surfaces do the organizing. Signal orange marks expression, focus, and the moments that deserve attention.</p></header>
        <div className="swatch-grid">
          {colors.map((color) => <div className="swatch" key={color.name} style={{ "--swatch": color.variable } as React.CSSProperties}><i /><div><b>{color.name}</b><span>{color.value}</span></div></div>)}
        </div>
      </section>

      <section className="guide-section">
        <header><p className="eyebrow">04 / PRINCIPLES</p><p>The docs should feel authored but never ornamental. Every expressive move sits on a quiet, repeatable system.</p></header>
        <div className="guide-rules">
          <article className="rule-card"><span>01</span><h3>White + signal</h3><p>Lead with generous neutral space. Use orange once per moment, not everywhere at once.</p></article>
          <article className="rule-card"><span>02</span><h3>Direct + technical</h3><p>Use one clear sans for reading and interface text, supported by rigorous labels, indexes, rules, and code surfaces.</p></article>
          <article className="rule-card"><span>03</span><h3>Flat + direct</h3><p>Prefer borders, spacing, and contrast over shadows, gradients, rounded cards, or decorative chrome.</p></article>
        </div>
      </section>

      <section className="guide-section">
        <header><p className="eyebrow">05 / COMPOSITION</p><p>Use the live docs pattern: small technical context, a decisive heading, expressive interruption, and readable supporting copy.</p></header>
        <div className="guide-sample"><p className="eyebrow">EXTENSION / .SURREALITY</p><h2>Reality has too many rules. <i>Break a few.</i></h2><p>Start with clear information architecture, then add one memorable gesture. Structure carries the page; expression gives it a voice.</p></div>
      </section>

      <Pager path="/style-guide" />
    </article>
  );
}
