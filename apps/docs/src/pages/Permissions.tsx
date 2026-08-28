import { ShieldCheck } from "lucide-react";
import { Pager } from "../Layout";

const permissions = [
  ["network:fetch", "Active", "Allows HTTP and HTTPS connections. Adds https: and http: to the iframe connect-src CSP. Without this permission, fetch and WebSocket to the network are blocked."],
  ["input:keyboard", "Active", "Forwards sanitized keydown and keyup records to onInput. Does not expose the host DOM event."],
  ["input:pointer", "Active", "Marks the mapping as interactive so Surreality can emit activate when the surface is used."],
  ["events:room", "Active", "Declares that the package participates in semantic room events via emit and onEvent."],
  ["audio:play", "Reserved", "Declared for forward compatibility. Does not grant a host audio bridge; Web Audio inside the iframe still follows normal browser rules for the sandbox."],
  ["microphone:read", "Reserved", "Does not grant getUserMedia or browser microphone access."],
  ["storage:package", "Reserved", "Does not grant host filesystem or durable package storage."],
  ["files:user-selected", "Reserved", "Does not open a host file picker yet."],
];

export function Permissions() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Permissions</h1>
      <p className="lede">
        Requested capabilities are listed in the installation warning. A declaration communicates intent. It never
        creates Node or Electron access, and reserved names do not silently unlock browser APIs.
      </p>

      <h2>Install warning</h2>
      <p>
        Before a <code>.mapping</code> file is extracted, the user sees the package author (or “its publisher”) and
        every requested capability. Empty <code>permissions</code> is shown as “No optional capabilities.” Treat that
        dialog as part of the product: only ask for what the mapping actually uses.
      </p>

      <h2>Capability list</h2>
      <div className="permission-list">
        {permissions.map(([permission, status, description]) => (
          <article key={permission}>
            <ShieldCheck size={15} />
            <code>{permission}</code>
            <span data-status={status}>{status}</span>
            <p>{description}</p>
          </article>
        ))}
      </div>

      <h2>Content Security Policy</h2>
      <p>Format 01 applies this policy to the mapping frame (network sources appear only with <code>network:fetch</code>):</p>
      <pre className="doc-pre"><code>{`default-src 'none'
script-src surreality: (plus a per-load nonce)
style-src surreality: 'unsafe-inline'
img-src surreality: data: blob:
media-src surreality: data: blob:
font-src surreality: data:
connect-src surreality: [https: http:]`}</code></pre>
      <p>
        Inline styles are allowed so generated UI can set colors from <code>context.color</code>. External scripts
        from the network are not. Unknown permission strings fail manifest validation, so you cannot invent new
        capability names.
      </p>

      <h2>Trust model</h2>
      <p>
        Installed code is still untrusted visual and behavioral content. A familiar file extension is not a reason
        to install a package. Capabilities you grant can be misused inside the sandbox (misleading UI, unexpected
        network calls, noisy events). Install only publishers you trust.
      </p>

      <Pager path="/permissions" />
    </article>
  );
}
