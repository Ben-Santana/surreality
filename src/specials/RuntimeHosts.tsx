import { useEffect, useState } from "react";
import { listSpecials } from "./registry";

export function SpecialRuntimeHosts() {
  return <>{listSpecials().map(({ kind, runtime }) => runtime?.Host ? <runtime.Host key={kind} /> : null)}</>;
}

export function SpecialRuntimeOverlays() {
  return <>{listSpecials().map(({ kind, runtime }) => runtime?.Overlay ? <runtime.Overlay key={kind} /> : null)}</>;
}

function readSnapshots() {
  return Object.fromEntries(listSpecials().filter((item) => item.runtime?.getSnapshot).map((item) => [item.kind, item.runtime?.getSnapshot?.()]));
}

export function useRuntimeSnapshots() {
  const [snapshots, setSnapshots] = useState<Record<string, unknown>>(readSnapshots);
  useEffect(() => {
    const refresh = () => setSnapshots(readSnapshots());
    const offs = listSpecials().map((item) => item.runtime?.subscribe?.(refresh)).filter((off): off is () => void => Boolean(off));
    refresh();
    return () => { for (const off of offs) off(); };
  }, []);
  return snapshots;
}

export function applyRuntimeSnapshots(snapshots: Record<string, unknown> | undefined) {
  if (!snapshots) return;
  for (const definition of listSpecials()) {
    if (definition.kind in snapshots) definition.runtime?.applySnapshot?.(snapshots[definition.kind]);
  }
}
