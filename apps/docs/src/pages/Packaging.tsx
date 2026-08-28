import { Check, FileArchive } from "lucide-react";
import { Pager } from "../Layout";

const archive = `{
  "manifest": { /* validated manifest */ },
  "files": {
    "mapping.js": {
      "encoding": "base64",
      "content": "…"
    },
    "inspector.js": {
      "encoding": "base64",
      "content": "…"
    }
  }
}`;

const checklist = [
  "Use a stable reverse-domain package ID",
  "Increment the semantic version for every release",
  "Increment configVersion when the config shape changes",
  "Bundle dependencies into browser-ready ES modules",
  "Keep every asset path relative and package-local",
  "Test uninstall → reinstall with an existing room",
  "Install only the final packed artifact before sharing",
];

export function Packaging() {
  return (
    <article className="doc-article">
      <p className="eyebrow">REFERENCE</p>
      <h1>Packaging</h1>
      <p className="lede">
        A <code>.surreality</code> file is a readable JSON archive: one manifest plus browser code, assets, and optional native plugin files. The installer
        validates paths, entrypoints, identity, sizes, colors, permissions, and expanded content before extraction.
      </p>

      <h2>Create and pack</h2>
      <p>From the desktop app directory:</p>
      <div className="terminal">
        <div className="terminal-head"><span /><span /><span /><b>TERMINAL</b></div>
        <pre><code><i>$</i> npm run create:mapping -- neon-clock{"\n"}<i>$</i> npm run pack:mapping -- ./custom-mappings/neon-clock</code></pre>
      </div>
      <p>
        The generator writes a folder with <code>manifest.json</code>, <code>mapping.js</code>, and
        <code>inspector.js</code>. The packer walks that folder, skips <code>manifest.json</code>,
        <code>node_modules</code>, dotfiles, and nested package archives, and encodes the rest as Base64.
        Output defaults to <code>id-version.surreality</code> in the same folder.
      </p>
      <p>
        Install from <b>Add → Custom Mappings → Import package…</b>. Legacy <code>.mapping</code> archives remain importable. Remove an installed package with the trash
        control beside its name. Uninstall does not delete mapping objects from saved rooms.
      </p>

      <h2>Archive layout</h2>
      <div className="archive-tree">
        <FileArchive />
        <b>com.example.neon-clock-1.0.0.surreality</b>
        <pre>{archive}</pre>
      </div>
      <p>
        File records may be a UTF-8 string or an object with <code>encoding</code> of <code>utf8</code> or <code>base64</code> and a <code>content</code> string.
        The host writes a canonical <code>manifest.json</code> into the installed directory; you do not need to pack
        one inside <code>files</code>.
      </p>
      <h2>Suggested source layout</h2>
      <pre className="doc-pre"><code>{`manifest.json\nmapping.js              # required sandboxed visual\ninspector.js            # optional editor UI\nruntime.js              # optional per-instance behavior\nassets/                  # images, fonts, media\nplugin/index.mjs         # optional privileged worker\nplugin/native/<platform> # optional SDK libraries/binaries`}</code></pre>
      <p>The 50 MB limit applies to native dependencies too. Bundle only production files. The packer does not compile source, install dependencies, sign binaries, or choose platform builds for you.</p>
      <h2>Limits</h2>
      <div className="limits doc-limits">
        <div><p className="eyebrow">ARCHIVE + EXPANDED</p><strong>50 MB</strong><span>Both the file on disk and the decoded payload</span></div>
        <div><p className="eyebrow">FILE COUNT</p><strong>512</strong><span>Maximum files in the archive</span></div>
        <div><p className="eyebrow">CONTENT SIZE</p><strong>8192²</strong><span>Maximum declared width or height</span></div>
      </div>

      <h2>Immutability</h2>
      <p>
        Published versions are immutable. Re-importing the same ID and version leaves the installed copy in place.
        Ship a new semver when the code or assets change. Bump <code>configVersion</code> when you change the
        meaning of keys in <code>defaultConfig</code> so rooms can tell that stored config may be stale.
      </p>

      <h2>Release checklist</h2>
      <div className="checklist">
        {checklist.map((item) => <p key={item}><Check size={14} />{item}</p>)}
      </div>

      <Pager path="/packaging" />
    </article>
  );
}
