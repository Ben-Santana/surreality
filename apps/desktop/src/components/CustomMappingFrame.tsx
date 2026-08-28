import { useEffect, useMemo, useRef, useState } from "react";
import { emitCustomMappingEvent, onCustomMappingEvent } from "../customMappings/events";
import type { CustomMapping, CustomMappingPackageManifest } from "../types";

type Props = {
  mapping: CustomMapping;
  manifest: CustomMappingPackageManifest;
  mode: "mapping" | "inspector" | "runtime";
  onConfigChange?: (config: Record<string, unknown>) => void;
};

type MappingFrameMessage = {
  source?: string;
  type?: string;
  config?: unknown;
  event?: unknown;
  level?: unknown;
  message?: unknown;
};

function frameUrl(manifest: CustomMappingPackageManifest, mode: Props["mode"]) {
  const id = encodeURIComponent(manifest.id);
  const version = encodeURIComponent(manifest.version);
  return `surreality://package/${id}/${version}/__host__.html?mode=${mode}`;
}

function asConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export default function CustomMappingFrame({ mapping, manifest, mode, onConfigChange }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const src = useMemo(() => frameUrl(manifest, mode), [manifest, mode]);

  const sendInit = () => {
    ref.current?.contentWindow?.postMessage({
      source: "surreality-host",
      type: "initialize",
      mode,
      mapping: {
        id: mapping.id,
        name: mapping.name,
        color: mapping.color,
        config: mapping.config,
        packageId: mapping.packageId,
        packageVersion: mapping.packageVersion,
      },
      manifest,
    }, "*");
  };

  useEffect(() => {
    const onMessage = (browserEvent: MessageEvent<MappingFrameMessage>) => {
      if (browserEvent.source !== ref.current?.contentWindow) return;
      const message = browserEvent.data;
      if (message?.source !== "surreality-mapping") return;
      if (message.type === "ready") {
        setStatus("ready");
        sendInit();
        return;
      }
      if (message.type === "update-config" && mode === "inspector") {
        const config = asConfig(message.config);
        if (config) onConfigChange?.(config);
        return;
      }
      if (message.type === "emit-event") {
        const event = asConfig(message.event);
        if (!event || !["activate", "hit", "signal"].includes(String(event.type))) return;
        emitCustomMappingEvent({ ...event, sourceId: mapping.id } as Parameters<typeof emitCustomMappingEvent>[0]);
        return;
      }
      if (message.type === "log") {
        const level = message.level === "error" ? "error" : message.level === "warn" ? "warn" : "log";
        console[level](`[${manifest.id}]`, String(message.message ?? ""));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [manifest.id, mapping.id, mode, onConfigChange]);

  useEffect(() => {
    if (status === "ready") {
      ref.current?.contentWindow?.postMessage({
        source: "surreality-host",
        type: "update",
        mode,
        mapping: {
          id: mapping.id,
          name: mapping.name,
          color: mapping.color,
          config: mapping.config,
          packageId: mapping.packageId,
          packageVersion: mapping.packageVersion,
        },
        manifest,
      }, "*");
    }
  }, [manifest, mapping, mode, status]);

  useEffect(() => onCustomMappingEvent((event) => {
    if (event.targetId && event.targetId !== mapping.id) return;
    ref.current?.contentWindow?.postMessage({
      source: "surreality-host",
      type: "event",
      event,
    }, "*");
  }), [mapping.id]);

  useEffect(() => window.room?.onPluginData((message) => {
    ref.current?.contentWindow?.postMessage({
      source: "surreality-host",
      type: "plugin-data",
      channel: `${message.packageId}/${message.channel}`,
      data: message.data,
    }, "*");
  }), []);

  useEffect(() => {
    const ownsRuntime = Boolean(manifest.entrypoints.runtime);
    const receivesInput = mode === "runtime" || (mode === "mapping" && !ownsRuntime);
    if (!receivesInput || !manifest.permissions?.includes("input:keyboard")) return;
    const forward = (event: KeyboardEvent) => {
      ref.current?.contentWindow?.postMessage({
        source: "surreality-host",
        type: "input",
        input: {
          type: event.type,
          key: event.key,
          code: event.code,
          repeat: event.repeat,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        },
      }, "*");
    };
    window.addEventListener("keydown", forward);
    window.addEventListener("keyup", forward);
    return () => {
      window.removeEventListener("keydown", forward);
      window.removeEventListener("keyup", forward);
    };
  }, [manifest.entrypoints.runtime, manifest.permissions, mode]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <iframe
        ref={ref}
        src={src}
        sandbox="allow-scripts"
        title={`${manifest.name} ${mode}`}
        className="block h-full w-full border-0 bg-transparent"
        onLoad={sendInit}
        onError={() => setStatus("error")}
      />
      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-3 text-center text-xs text-red-300">
          {manifest.name} failed to load.
        </div>
      ) : null}
    </div>
  );
}
