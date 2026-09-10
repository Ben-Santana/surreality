import { ArrowUpRight, Box, Code2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DocPath } from "../nav";

type HeroPoint = readonly [number, number];

const initialHeroSurface: HeroPoint[] = [[148, 292], [390, 270], [450, 488], [188, 516]];

function interpolate(a: HeroPoint, b: HeroPoint, amount: number): HeroPoint {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function surfaceGrid(points: HeroPoint[]) {
  const [topLeft, topRight, bottomRight, bottomLeft] = points;
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return "";
  const lines: string[] = [];
  for (let index = 1; index < 4; index += 1) {
    const amount = index / 4;
    const verticalStart = interpolate(topLeft, topRight, amount);
    const verticalEnd = interpolate(bottomLeft, bottomRight, amount);
    const horizontalStart = interpolate(topLeft, bottomLeft, amount);
    const horizontalEnd = interpolate(topRight, bottomRight, amount);
    lines.push(`M${verticalStart.join(" ")}L${verticalEnd.join(" ")}`);
    lines.push(`M${horizontalStart.join(" ")}L${horizontalEnd.join(" ")}`);
  }
  return lines.join(" ");
}

export function Home({ path }: { path: DocPath }) {
  const [heroSurface, setHeroSurface] = useState<HeroPoint[]>(initialHeroSurface);
  const [draggedHandle, setDraggedHandle] = useState<number | null>(null);
  const dragState = useRef<{ index: number; offset: HeroPoint } | null>(null);

  const dragHandle = (event: ReactPointerEvent<SVGGElement>, index: number) => {
    const activeDrag = dragState.current;
    if (!activeDrag || activeDrag.index !== index) return;
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    setHeroSurface((current) => current.map((value, pointIndex) => (
      pointIndex === index
        ? [
            Math.max(8, Math.min(592, point.x - activeDrag.offset[0])),
            Math.max(8, Math.min(592, point.y - activeDrag.offset[1])),
          ] as const
        : value
    )));
  };

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
          <h1><span className="hero-rule-line">Reality has too many rules</span><i>break a few</i></h1>
          <div className="hero-actions">
            <a className="inline-action" href="#/quickstart">Build your first mapping <ArrowUpRight size={16} /></a>
          </div>
        </div>
        <svg className="hero-shapes" viewBox="0 0 600 600" fill="none" aria-hidden="true">
          <g className="hero-surface hero-surface-back">
            <polygon points="62,150 258,112 268,318 78,346" />
            <path d="M127 137L142 336M193 124L205 327M68 216L261 181M73 282L265 250" />
          </g>
          <g className="hero-surface hero-surface-mid">
            <polygon points="318,92 538,142 518,358 300,312" />
            <path d="M391 109L373 327M465 126L446 342M312 165L532 214M306 238L525 286" />
          </g>
          <g className="hero-surface hero-surface-selected">
            <polygon points={heroSurface.map((point) => point.join(",")).join(" ")} />
            <path d={surfaceGrid(heroSurface)} />
            {heroSurface.map(([x, y], index) => (
              <g
                className="hero-surface-handle"
                data-dragging={draggedHandle === index || undefined}
                key={index}
                role="button"
                aria-label={`Drag surface corner ${index + 1}`}
                tabIndex={0}
                transform={`translate(${x} ${y})`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  const svg = event.currentTarget.ownerSVGElement;
                  const matrix = svg?.getScreenCTM();
                  if (!matrix) return;
                  const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
                  dragState.current = { index, offset: [pointer.x - x, pointer.y - y] };
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggedHandle(index);
                }}
                onPointerMove={(event) => dragHandle(event, index)}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  dragState.current = null;
                  setDraggedHandle(null);
                }}
                onPointerCancel={() => {
                  dragState.current = null;
                  setDraggedHandle(null);
                }}
                onKeyDown={(event) => {
                  const movement: Record<string, HeroPoint> = {
                    ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8],
                  };
                  const delta = movement[event.key];
                  if (!delta) return;
                  event.preventDefault();
                  setHeroSurface((current) => current.map((value, pointIndex) => (
                    pointIndex === index
                      ? [Math.max(8, Math.min(592, value[0] + delta[0])), Math.max(8, Math.min(592, value[1] + delta[1]))] as const
                      : value
                  )));
                }}
              >
                <rect className="hero-surface-hit" x="-18" y="-18" width="36" height="36" />
                <rect x="-7" y="-7" width="14" height="14" />
                <circle r="2" />
              </g>
            ))}
          </g>
        </svg>
      </section>

      <section className="principles" aria-label="Package principles">
        <article><Code2 /><span>01</span><h3>Browser native</h3><p>Write standard ES modules with DOM, CSS, Canvas, WebGL, and browser media APIs.</p></article>
        <article><Box /><span>02</span><h3>Geometry aware</h3><p>Choose a quad, polygon, or circle surface; Surreality handles projection and warping.</p></article>
        <article><ShieldCheck /><span>03</span><h3>Two trust levels</h3><p>Visual entrypoints stay sandboxed. Optional native plugin workers require an explicit high-risk permission.</p></article>
      </section>

      <section className="doc-section quickstart" id="quickstart">
        <div className="section-index">01 / START</div>
        <div className="section-intro"><p className="eyebrow">QUICKSTART</p><h2>From zero to<br />a portable surface.</h2><p>The project includes a generator and packer. Start with the generated renderer and inspector, then ship one auditable file.</p></div>
        <div className="steps">
          <div className="terminal"><div className="terminal-head"><span /><span /><span /><b>TERMINAL</b></div><pre><code><i>$</i> npm run create:mapping -- neon-clock{"\n"}<i>$</i> npm run pack:mapping -- ./custom-mappings/neon-clock{"\n\n"}<span>✓</span> com.example.neon-clock-1.0.0.surreality</code></pre></div>
          <ol>
            <li><b>Scaffold</b><p>Generate a manifest, mapping entrypoint, and inspector.</p></li>
            <li><b>Build</b><p>Use browser APIs. Keep package paths relative and dependencies bundled.</p></li>
            <li><b>Pack</b><p>Create one <code>.surreality</code> package containing code, assets, and optional native integrations.</p></li>
          </ol>
          <p className="continue"><a href="#/manifest">Continue with the manifest reference <ArrowUpRight size={14} /></a></p>
        </div>
      </section>
    </>
  );
}
