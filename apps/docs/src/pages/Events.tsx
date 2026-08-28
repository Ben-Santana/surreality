import { ArrowRight, Box, Keyboard, MessageSquare, Radio } from "lucide-react";
import { CodeBlock, Pager } from "../Layout";

const emitExample = `context.emit({
  type: "signal",
  targetId: "optional-instance-id",
  channel: "beat",
  value: 1
});`;

export function Events() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Events and input</h1>
      <p className="lede">
        Mappings coordinate through semantic records. They never receive a reference to another package or to the
        host application. Declare <code>events:room</code> if you emit or rely on room events, and
        <code>input:keyboard</code> if you need keys.
      </p>

      <h2>Room bus</h2>
      <div className="event-flow">
        <div><Radio /><b>Mapping A</b><code>emit()</code></div>
        <ArrowRight />
        <div><MessageSquare /><b>Room bus</b><code>sourceId stamped</code></div>
        <ArrowRight />
        <div><Box /><b>Mapping B</b><code>onEvent()</code></div>
      </div>
      <p>
        The host always replaces <code>sourceId</code> with the sending mapping instance ID. You cannot impersonate
        another surface. Optional <code>targetId</code> addresses a specific instance; omit it for a broadcast-style
        signal that listeners can filter themselves.
      </p>

      <h2>Event types</h2>
      <div className="event-types">
        <article>
          <b>activate</b>
          <p>The user activates an interactive mapping (for example a click on a surface that declared input:pointer). The host typically sets targetId to that instance.</p>
        </article>
        <article>
          <b>hit</b>
          <p>One mapping reports a semantic collision or contact with another, including an optional point. Used by playable surfaces.</p>
        </article>
        <article>
          <b>signal</b>
          <p>A freeform channel and value. Use this for clocks, cues, scores, or any package-defined protocol.</p>
        </article>
      </div>
      <CodeBlock title="emit" value={emitExample} />

      <h2>Handling events</h2>
      <p>
        Implement <code>onEvent</code> on the object returned from mount, or export it from the module. The handler
        may be async. Unknown event shapes should be ignored; only depend on <code>type</code> and the fields you
        publish for your own protocol.
      </p>

      <h2>Keyboard input</h2>
      <div className="keyboard-note">
        <Keyboard size={18} />
        <div>
          <b>Keyboard input is sanitized</b>
          <p>
            Packages that declare <code>input:keyboard</code> receive <code>keydown</code> and <code>keyup</code>
            records with type, key, code, repeat, and modifier booleans. You never receive the original DOM event,
            so you cannot inspect the host page or call <code>preventDefault</code> on editor shortcuts.
          </p>
        </div>
      </div>
      <p>
        Pointer activation is separate: declare <code>input:pointer</code> so the room treats the surface as
        clickable and can emit <code>activate</code>. That does not grant access to raw pointer events on the editor
        chrome.
      </p>

      <Pager path="/events" />
    </article>
  );
}
