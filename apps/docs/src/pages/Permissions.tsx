import { ShieldCheck } from "lucide-react";
import { Pager } from "../Layout";

const permissions = [
  ["network:fetch", "Active", "Allows HTTP and HTTPS connections. Adds https: and http: to the iframe connect-src CSP. Without this permission, fetch and WebSocket to the network are blocked."],
  ["camera:read", "Active", "Allows navigator.mediaDevices camera access in the package iframe. The operating system may still ask the user to approve camera access for Surreality."],
  ["input:keyboard", "Active", "Forwards sanitized keydown and keyup records to onInput. Does not expose the host DOM event."],
  ["input:pointer", "Active", "Marks the mapping as interactive so Surreality can emit activate when the surface is used."],
  ["events:room", "Active", "Declares that the package participates in semantic room events via emit and onEvent."],
  ["audio:play", "Reserved", "Declared for forward compatibility. Does not grant a host audio bridge; Web Audio inside the iframe still follows normal browser rules for the sandbox."],
  ["microphone:read", "Reserved", "Does not grant getUserMedia or browser microphone access."],
  ["storage:package", "Reserved", "Does not grant host filesystem or durable package storage."],
  ["files:user-selected", "Reserved", "Does not open a host file picker yet."],
  ["device:usb", "Native", "Declares direct USB device access by a privileged plugin."],
  ["device:serial", "Native", "Declares serial-port access by a privileged plugin."],
  ["device:camera", "Native", "Declares camera or depth-sensor access by a privileged plugin."],
  ["device:midi", "Native", "Declares MIDI device access by a privileged plugin."],
  ["network:listen", "Native", "Declares that a plugin may listen on a local network port."],
  ["process:spawn", "Native", "Declares that a plugin may start other executables."],
  ["background:run", "Native", "Declares work that continues while no mapping surface is visible."],
  ["events:publish", "Native", "Declares plugin-to-mapping input publication."],
  ["system:unrestricted", "Native", "Required by version 2 plugin entrypoints. Grants user-level native access; this is not sandboxed."],
];

export function Permissions() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Permissions</h1>
      <p className="lede">
        Requested capabilities are listed in the installation warning. Browser permissions alter a restricted frame.
        Native permissions explain what a trusted plugin intends to do; version 2 does not yet enforce them individually.
      </p>

      <h2>Install warning</h2>
      <p>
        Before a <code>.surreality</code> file is extracted, the user sees the package author (or “its publisher”) and
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
      <p>Version 2 applies this policy to browser frames (network sources appear only with <code>network:fetch</code>):</p>
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
        Browser-only packages can still mislead users or misuse granted network access. Packages with a plugin
        entrypoint are fully trusted native software: process separation protects Surreality from crashes, not the
        user from malicious code. Review the publisher and requested capabilities before installing.
      </p>

      <Pager path="/permissions" />
    </article>
  );
}
