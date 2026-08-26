import {
  ChevronDown,
  ChevronRight,
  Circle,
  Frame,
  Pentagon,
  Rocket,
  Sparkles,
  Type,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { rgbaCss } from "../geometry";
import { useRoomStore } from "../store";
import type { Mapping } from "../types";

const MAPPING_MIME = "application/x-room-mapping";

function mappingIcon(mapping: Mapping, selected: boolean) {
  const className = `size-3.5 ${selected ? "text-white/80" : "text-zinc-400"}`;
  if (mapping.type === "circle") return <Circle className={className} />;
  if (mapping.type === "text") return <Type className={className} />;
  if (mapping.type === "special") {
    if (mapping.kind === "sound") return <Volume2 className={className} />;
    if (mapping.kind === "ship") return <Rocket className={className} />;
    return <Sparkles className={className} />;
  }
  return <Pentagon className={className} />;
}

export default function LayerPanel() {
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const selectedId = useRoomStore((state) => state.selectedId);
  const select = useRoomStore((state) => state.select);
  const attachMapping = useRoomStore((state) => state.attachMapping);
  const detachMapping = useRoomStore((state) => state.detachMapping);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);

  const grouped = useMemo(() => {
    const bySurface = new Map<string, Mapping[]>();
    const ungrouped: Mapping[] = [];
    for (const mapping of mappings) {
      if (mapping.surfaceId) {
        const list = bySurface.get(mapping.surfaceId) ?? [];
        list.push(mapping);
        bySurface.set(mapping.surfaceId, list);
      } else {
        ungrouped.push(mapping);
      }
    }
    for (const list of bySurface.values()) list.reverse();
    ungrouped.reverse();
    return { bySurface, ungrouped };
  }, [mappings]);

  useEffect(() => {
    setCollapsed((current) => {
      const next = { ...current };
      for (const surface of surfaces) {
        if (next[surface.id] === undefined) next[surface.id] = false;
      }
      return next;
    });
  }, [surfaces]);

  const readMappingId = (event: DragEvent) =>
    event.dataTransfer.getData(MAPPING_MIME) || event.dataTransfer.getData("text/plain");

  const onMappingDragStart = (event: DragEvent, mapping: Mapping) => {
    event.dataTransfer.setData(MAPPING_MIME, mapping.id);
    event.dataTransfer.setData("text/plain", mapping.id);
    event.dataTransfer.effectAllowed = "move";
    select(mapping.id);
  };

  const allowDrop = (event: DragEvent, target: string | "root") => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (dropTarget !== target) setDropTarget(target);
  };

  const onDropOnSurface = (event: DragEvent, surfaceId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const mappingId = readMappingId(event);
    setDropTarget(null);
    if (!mappingId) return;
    attachMapping(mappingId, surfaceId);
    setCollapsed((current) => ({ ...current, [surfaceId]: false }));
  };

  const onDropOnRoot = (event: DragEvent) => {
    event.preventDefault();
    const mappingId = readMappingId(event);
    setDropTarget(null);
    if (mappingId) detachMapping(mappingId);
  };

  const empty = mappings.length === 0 && surfaces.length === 0;

  return (
    <div
      className={`h-full px-1 py-1 ${dropTarget === "root" ? "bg-white/5" : ""}`}
      onDragOver={(event) => allowDrop(event, "root")}
      onDragLeave={() => setDropTarget((current) => (current === "root" ? null : current))}
      onDrop={onDropOnRoot}
      onDragEnd={() => setDropTarget(null)}
    >
      {empty ? (
        <p className="px-2 text-[13px] leading-relaxed text-white/50">
          Right-click the stage or choose a tool to add a mapping or surface.
        </p>
      ) : (
        <>
          {[...surfaces].reverse().map((surface) => {
            const children = grouped.bySurface.get(surface.id) ?? [];
            const selected = surface.id === selectedId;
            const open = !collapsed[surface.id];
            const dropping = dropTarget === surface.id;
            return (
              <div
                key={surface.id}
                className={`mb-0.5 ${dropping ? "bg-accent/20" : ""}`}
                onDragOver={(event) => allowDrop(event, surface.id)}
                onDragLeave={() =>
                  setDropTarget((current) => (current === surface.id ? null : current))
                }
                onDrop={(event) => onDropOnSurface(event, surface.id)}
              >
                <div
                  className={`flex w-full items-center gap-1 rounded-none px-1 py-1.5 text-left text-[13px] transition ${
                    selected ? "bg-accent text-white" : "text-white hover:bg-white/10"
                  }`}
                >
                  <button
                    type="button"
                    title={open ? "Collapse" : "Expand"}
                    className="flex size-5 shrink-0 items-center justify-center text-current opacity-70 hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      setCollapsed((current) => ({ ...current, [surface.id]: open }));
                    }}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onClick={() => select(surface.id)}
                  >
                    <Frame className={`size-3.5 ${selected ? "text-white/80" : "text-zinc-400"}`} />
                    <span className="min-w-0 flex-1 truncate">{surface.name}</span>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-white/40">
                      {String(children.length).padStart(2, "0")}
                    </span>
                  </button>
                </div>
                {open
                  ? children.map((mapping) => (
                      <MappingRow
                        key={mapping.id}
                        mapping={mapping}
                        selected={mapping.id === selectedId}
                        nested
                        onSelect={() => select(mapping.id)}
                        onDragStart={(event) => onMappingDragStart(event, mapping)}
                        onDragEnd={() => setDropTarget(null)}
                      />
                    ))
                  : null}
                {open && children.length === 0 ? (
                  <p className="px-8 py-1.5 text-[11px] text-white/35">
                    Drag mappings onto the wall
                  </p>
                ) : null}
              </div>
            );
          })}

          {surfaces.length > 0 ? (
            <p className="chrome-label px-2 pb-1 pt-2">Ungrouped</p>
          ) : null}

          {grouped.ungrouped.map((mapping) => (
            <MappingRow
              key={mapping.id}
              mapping={mapping}
              selected={mapping.id === selectedId}
              onSelect={() => select(mapping.id)}
              onDragStart={(event) => onMappingDragStart(event, mapping)}
              onDragEnd={() => setDropTarget(null)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function MappingRow({
  mapping,
  selected,
  nested = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: {
  mapping: Mapping;
  selected: boolean;
  nested?: boolean;
  onSelect: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onClick={onSelect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`mb-0.5 flex w-full cursor-grab items-center gap-2.5 rounded-none py-2 text-left text-[13px] transition active:cursor-grabbing ${
        nested ? "pl-7 pr-2" : "px-2"
      } ${selected ? "bg-accent text-white" : "text-white hover:bg-white/10"}`}
    >
      <span
        className="size-2.5 shrink-0 rounded-none"
        style={{ background: rgbaCss(mapping.color) }}
      />
      {mappingIcon(mapping, selected)}
      <span className="truncate">{mapping.name}</span>
    </button>
  );
}
