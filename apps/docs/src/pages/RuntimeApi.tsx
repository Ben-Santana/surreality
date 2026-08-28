import { TriangleAlert } from "lucide-react";
import { CodeBlock, Pager } from "../Layout";

const contextType = `type MappingContext = {
  root: HTMLElement;
  mode: "mapping" | "inspector" | "runtime";
  mapping: {
    id: string;
    name: string;
    color: { r: number; g: number; b: number; a: number };
    config: Record<string, unknown>;
    packageId: string;
    packageVersion: string;
  };
  manifest: object;
  config: Record<string, unknown>;
  color: { r: number; g: number; b: number; a: number };
  assets: { url(relativePath: string): string };
  updateConfig(config: Record<string, unknown>): void;
  emit(event: MappingEvent): void;
  inputs: {
    subscribe(channel: string, listener: (data: unknown) => void): () => void;
  };
  log(...values: unknown[]): void;
};`;

const members = [
  ["root", "HTMLElement", "Empty mount point owned by this entrypoint. The host clears it before each remount."],
  ["mode", "string", "Which entrypoint is running: mapping, inspector, or runtime."],
  ["mapping", "snapshot", "Instance identity, display name, color, live config, packageId, and packageVersion."],
  ["manifest", "Manifest", "The validated installed package manifest."],
  ["config", "object", "The current package-owned configuration (same object as mapping.config)."],
  ["color", "RGBA", "The mapping color selected in Surreality."],
  ["assets.url(path)", "string", "Resolves a package-relative path against the mapping origin. Use this for images, fonts, and media you packed."],
  ["updateConfig(next)", "void", "Commit a complete configuration object. The editor records undo and fans the new config out to every frame. Inspectors should call this; mapping views should treat config as read-only."],
  ["emit(event)", "void", "Send an activate, hit, or signal record to the Surreality event bus. The host overwrites sourceId with this instance’s ID."],
  ["inputs.subscribe(channel, listener)", "unsubscribe", "Receive data published by a privileged plugin. Channels are namespaced as package-id/channel."],
  ["log(...values)", "void", "Write a package-prefixed message to developer tools."],
];

export function RuntimeApi() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Runtime API</h1>
      <p className="lede">
        There is no imported SDK and no build-time coupling to the editor. Every entrypoint receives the same
        browser-native context object when the host calls your mount function.
      </p>

      <div className="callout doc-callout">
        <TriangleAlert size={16} />
        <p>
          <b>No privileged globals.</b> Node.js, Electron, the editor DOM, and its application store are unavailable.
          Packages talk to Surreality only through this context and the event bus.
        </p>
      </div>

      <h2>Context</h2>
      <CodeBlock title="MappingContext" value={contextType} />
      <div className="field-list doc-fields">
        {members.map(([name, type, description]) => (
          <div className="field-row" key={name}><code>{name}</code><span>{type}</span><p>{description}</p></div>
        ))}
      </div>

      <h2>Configuration</h2>
      <p>
        <code>updateConfig</code> must receive a complete plain object. The host validates that it is an object,
        writes it into undo history, and sends the new snapshot back. Partial patches are not merged for you; spread
        the previous config if you only changed one field:
      </p>
      <CodeBlock title="inspector.js" value={`input.addEventListener("input", () => {
  updateConfig({ ...config, label: input.value });
});`} />

      <h2>Assets</h2>
      <p>
        Packaged files are served from the <code>surreality:</code> protocol. <code>assets.url("logo.png")</code>
        is the supported way to build a URL. Do not hard-code filesystem paths or <code>file:</code> URLs.
      </p>

      <h2>Isolation</h2>
      <p>
        Mapping code runs in an iframe with <code>sandbox=&quot;allow-scripts&quot;</code> and a restrictive Content
        Security Policy. Scripts, styles, images, media, and fonts may load from the package. Network access is
        off unless you declare <code>network:fetch</code>. See <a href="#/permissions">Permissions</a>.
      </p>

      <Pager path="/runtime-api" />
    </article>
  );
}
