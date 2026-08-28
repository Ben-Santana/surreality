import { TriangleAlert } from "lucide-react";
import { CodeBlock, Pager } from "../Layout";

const pluginExample = `export default async function activate(context) {
  // Native modules and OS APIs are available in this worker.
  const device = await openYourDevice();

  device.on("body", body => {
    context.publish("body-tracking", body);
  });

  context.log("Kinect adapter ready");
  return () => device.close();
}`;

const mappingExample = `export default function mount(context) {
  const unsubscribe = context.inputs.subscribe(
    "com.example.kinect/body-tracking",
    frame => renderBodies(frame)
  );
  return unsubscribe;
}`;

export function Plugins() {
  return (
    <article className="doc-article">
      <p className="eyebrow">PRIVILEGED EXTENSIONS</p>
      <h1>Native plugins</h1>
      <p className="lede">A package may pair safe projected content with a background plugin for USB devices, native SDKs, local servers, processes, files, and other operating-system integrations.</p>

      <div className="callout doc-callout"><TriangleAlert size={16} /><p><b>Native means trusted.</b> Version 2 currently requires <code>system:unrestricted</code> for every plugin entrypoint. The worker is separated from the UI for reliability, but it is not an OS security sandbox. It has the same user-level access as Surreality.</p></div>

      <h2>Architecture</h2>
      <pre className="doc-pre"><code>{`Hardware / native SDK\n        ↓\nplugin worker → context.publish(channel, data)\n        ↓\nsandboxed mapping → context.inputs.subscribe(namespacedChannel)`}</code></pre>
      <p>One plugin worker starts per installed package version. It can serve every mapping instance. Surreality prefixes published channels with the package ID, preventing unrelated packages from accidentally claiming the same name.</p>

      <h2>Plugin entrypoint</h2>
      <CodeBlock title="plugin/index.mjs" value={pluginExample} />
      <p>The default export, or named <code>activate</code> export, receives a frozen context. It may return a cleanup function or an object with <code>deactivate()</code>. Cleanup runs during uninstall or app shutdown; workers that do not stop are terminated after a grace period.</p>

      <h2>Plugin context</h2>
      <div className="field-list doc-fields">
        <div className="field-row"><code>package</code><span>object</span><p>Immutable <code>id</code> and <code>version</code> for the running package.</p></div>
        <div className="field-row"><code>publish(channel, data)</code><span>void</span><p>Sends structured-clone-compatible data to mapping, runtime, and inspector frames.</p></div>
        <div className="field-row"><code>log(...values)</code><span>void</span><p>Writes a package-prefixed message to the Surreality developer console.</p></div>
      </div>

      <h2>Consume plugin data</h2>
      <CodeBlock title="mapping.js" value={mappingExample} />
      <p>Always keep and call the unsubscribe function. Treat device messages as untrusted input: validate shape, clamp coordinates, handle missing people or devices, and avoid doing expensive work for every raw sensor frame.</p>

      <h2>Kinect package pattern</h2>
      <ol>
        <li>Bundle a platform-specific Kinect SDK adapter or a JavaScript wrapper in the package.</li>
        <li>Declare <code>device:usb</code>, <code>background:run</code>, <code>events:publish</code>, and <code>system:unrestricted</code>.</li>
        <li>Open the device once in <code>plugin/index.mjs</code>.</li>
        <li>Normalize SDK-specific frames into a documented package schema.</li>
        <li>Publish a modest frame rate and close the device in cleanup.</li>
      </ol>
      <p>Device drivers, code signing, native library architecture, and OS privacy prompts remain platform responsibilities. A package can bundle libraries, but it cannot bypass administrator approval or install kernel-level drivers silently.</p>

      <h2>Current limitations</h2>
      <ul>
        <li>Permissions describe install-time intent; scoped native enforcement is not implemented yet.</li>
        <li>There is no package signing or publisher verification yet.</li>
        <li>There is no dependency installer. Bundle production dependencies and native binaries.</li>
        <li>Worker data is broadcast to open Surreality windows and then filtered by channel subscribers.</li>
        <li>Plugin configuration and bidirectional mapping-to-plugin requests are not part of Format 02.</li>
      </ul>
      <Pager path="/plugins" />
    </article>
  );
}
