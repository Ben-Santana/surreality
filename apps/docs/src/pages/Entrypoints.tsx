import { Braces, Code2, Cpu, Plug } from "lucide-react";
import { CodeBlock, Pager } from "../Layout";

const mountExample = `export default function mount(context) {
  const node = document.createElement("div");
  node.textContent = context.config.label;
  context.root.append(node);

  return {
    onEvent(event) { /* semantic room event */ },
    onInput(input) { /* sanitized keyboard input */ },
    destroy() { /* listeners, timers, WebGL */ }
  };
}`;

export function Entrypoints() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Entrypoints</h1>
      <p className="lede">
        One package can contain three browser entrypoints and an optional native plugin. Browser modules export a
        mount function; the plugin exports an activation function and runs under a different trust model.
      </p>

      <h2>The three modules</h2>
      <div className="entry-grid doc-entry-grid">
        <article><b>01</b><Code2 /><h3>mapping.js</h3><p>Required. Renders one instance inside its projected geometry. Draw with DOM, Canvas, WebGL, SVG, or CSS.</p><small>Visual surface</small></article>
        <article><b>02</b><Braces /><h3>inspector.js</h3><p>Optional. Builds controls in the editor and commits complete configuration objects with updateConfig.</p><small>Editor panel</small></article>
        <article><b>03</b><Cpu /><h3>runtime.js</h3><p>Optional. Runs once per instance without drawing on the mapping surface. Use it for simulation, audio, or coordination.</p><small>Behavior host</small></article>
        <article><b>04</b><Plug /><h3>plugin/index.mjs</h3><p>Optional. Runs once per installed package in a separate native worker. Use it for devices and OS integrations.</p><small>Privileged worker</small></article>
      </div>

      <h2>Mount function</h2>
      <p>
        The default export must be a function. Named alternatives <code>mount</code>, <code>mountMapping</code>, and
        <code>mountInspector</code> are also accepted. The function may be async. It receives the
        <a href="#/runtime-api">mapping context</a> and may return:
      </p>
      <ul>
        <li>nothing</li>
        <li>a cleanup function, called before the next remount</li>
        <li>an object with optional <code>destroy()</code>, <code>onEvent(event)</code>, and <code>onInput(input)</code></li>
      </ul>
      <p>
        You may also export top-level <code>onEvent</code> and <code>onInput</code> functions on the module. Instance
        handlers on the returned object take precedence.
      </p>
      <CodeBlock title="mapping.js" value={mountExample} />

      <h2>Lifecycle</h2>
      <p>
        On <code>initialize</code> or <code>update</code>, the host destroys the previous mount, clears
        <code>root</code>, and calls mount again with a fresh context. Inspector frames ignore <code>update</code>
        remounts so form focus is not stolen; they still receive the latest config through the next initialize if
        the host reloads the frame.
      </p>
      <p>
        Always tear down listeners, <code>requestAnimationFrame</code> loops, WebGL contexts, and media elements in
        <code>destroy</code> or the cleanup function. Leaking them across remounts will stack work in one instance.
      </p>

      <h2>What you can use</h2>
      <p>
        DOM, CSS, Canvas, WebGL, and in-package media are all valid. Bundle dependencies into ES modules; there is
        no Node resolver at runtime. Keep every import and asset path relative to the package.
      </p>
      <p>Browser entrypoints cannot import Node modules, open USB devices, or inspect the editor. Put native work in a <a href="#/plugins">plugin entrypoint</a> and send only the data your visuals need through named input channels.</p>

      <Pager path="/entrypoints" />
    </article>
  );
}
