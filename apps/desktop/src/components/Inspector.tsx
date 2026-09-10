import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  PackageX,
  Plus,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { centroid, isPolygonGeometry } from "../geometry";
import { getCustomMapping, useCustomMappings } from "../customMappings/registry";
import { customMappingConfig } from "../customMappings/config";
import { useRoomStore } from "../store";
import { DEFAULT_TEXT_FONT, TEXT_FONTS } from "../textFonts";
import { displayVertices } from "../wall";
import type { CustomMapping, TextMapping } from "../types";
import ColorPicker from "./ColorPicker";
import CustomMappingFrame from "./CustomMappingFrame";
import InspectorSelect from "./InspectorSelect";

export default function Inspector() {
  useCustomMappings();
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const selectedId = useRoomStore((state) => state.selectedId);
  const selected = mappings.find((mapping) => mapping.id === selectedId) ?? null;
  const selectedSurface = surfaces.find((surface) => surface.id === selectedId) ?? null;
  const updateMapping = useRoomStore((state) => state.updateMapping);
  const updateSurface = useRoomStore((state) => state.updateSurface);
  const setColor = useRoomStore((state) => state.setColor);
  const addVertexNear = useRoomStore((state) => state.addVertexNear);
  const deleteMapping = useRoomStore((state) => state.deleteMapping);
  const deleteSurface = useRoomStore((state) => state.deleteSurface);
  const duplicateSelected = useRoomStore((state) => state.duplicateSelected);
  const bringForward = useRoomStore((state) => state.bringForward);
  const bringBack = useRoomStore((state) => state.bringBack);
  const sendToFront = useRoomStore((state) => state.sendToFront);
  const sendToBack = useRoomStore((state) => state.sendToBack);
  const hostSurface = selected
    ? surfaces.find((surface) => surface.id === selected.surfaceId) ?? null
    : null;

  if (!selected && selectedSurface) {
    const childCount = mappings.filter((mapping) => mapping.surfaceId === selectedSurface.id).length;
    return (
      <div className="space-y-5 px-4 py-3">
        <label className="block space-y-1.5">
          <span className="chrome-label">Name</span>
          <input
            value={selectedSurface.name}
            onChange={(event) => updateSurface(selectedSurface.id, { name: event.target.value })}
            className="panel-field no-drag h-9 w-full rounded-none px-3 text-[13px] outline-none"
          />
        </label>
        <p className="text-[13px] leading-relaxed text-white/50">
          This is a wall. Drag a mapping onto it on the stage and it takes the wall&apos;s
          perspective where it lands; moving it across the wall reshapes it to keep its
          size on the wall. Drag it back off and it returns to its original shape.
          {childCount > 0
            ? ` ${childCount} mapping${childCount === 1 ? "" : "s"} on this surface.`
            : ""}
        </p>
        <div className="grid grid-cols-2 gap-1.5 pb-1">
          <LayerButton icon={<Copy className="size-3.5" />} onClick={duplicateSelected}>
            Duplicate
          </LayerButton>
          <button
            type="button"
            className="flex h-9 items-center justify-center gap-2 rounded-none border border-danger/30 text-[13px] text-danger hover:bg-danger/10"
            onClick={() => deleteSurface(selectedSurface.id)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="px-4 py-3">
        <p className="text-[13px] leading-relaxed text-white/50">
          Select a mapping or surface to edit it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-3">
      <label className="block space-y-1.5">
        <span className="chrome-label">Name</span>
        <input
          value={selected.name}
          onChange={(event) => updateMapping(selected.id, { name: event.target.value })}
          className="panel-field no-drag h-9 w-full rounded-none px-3 text-[13px] outline-none"
        />
      </label>

      {hostSurface ? (
        <p className="text-[12px] text-white/45">On surface {hostSurface.name}</p>
      ) : null}

      <div>
        <p className="chrome-label mb-2">Color</p>
        <ColorPicker color={selected.color} onChange={(color) => setColor(selected.id, color)} />
      </div>

      {selected.type === "text" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {(["text", "clock"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => updateMapping(selected.id, { contentMode: mode })}
                className={`h-9 border text-[12px] uppercase tracking-wider ${(selected.contentMode ?? "text") === mode ? "border-accent bg-accent/15 text-white" : "border-white/10 text-white/50"}`}>
                {mode}
              </button>
            ))}
          </div>
          {(selected.contentMode ?? "text") === "text" ? <label className="block space-y-1.5">
            <span className="chrome-label">Text</span>
            <input
              value={selected.text}
              onChange={(event) => updateMapping(selected.id, { text: event.target.value })}
              className="panel-field no-drag h-9 w-full rounded-none px-3 text-[13px] outline-none"
            />
          </label> : <ClockControls mapping={selected} />}
          <div className="space-y-1.5">
            <span className="chrome-label">Typeface</span>
            <div className="grid grid-cols-2 gap-1.5">
              {TEXT_FONTS.map((font) => {
                const active = (selected.fontFamily ?? DEFAULT_TEXT_FONT) === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateMapping(selected.id, { fontFamily: font.id })}
                    className={`group flex h-14 flex-col items-start justify-center border px-3 text-left transition ${
                      active
                        ? "border-accent/70 bg-accent/15 text-white"
                        : "border-white/10 bg-white/[0.025] text-white/55 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span
                      className="text-[19px] leading-none"
                      style={{ fontFamily: font.family, fontWeight: font.weight }}
                    >
                      Aa
                    </span>
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] opacity-60">
                      {font.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {selected.type === "custom" ? (
        <CustomMappingInspector mapping={selected} />
      ) : null}

      {isPolygonGeometry(selected) ? (
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center gap-2 rounded-none border border-white/15 text-[13px] text-white hover:bg-white/10"
          onClick={() => addVertexNear(selected.id, centroid(displayVertices(selected, surfaces)))}
        >
          <Plus className="size-4" />
          Add vertex
        </button>
      ) : null}

      <div>
        <p className="chrome-label mb-2">Layer</p>
        <div className="grid grid-cols-2 gap-1.5">
          <LayerButton icon={<ArrowUp className="size-3.5" />} onClick={() => bringForward(selected.id)}>
            Forward
          </LayerButton>
          <LayerButton icon={<ArrowDown className="size-3.5" />} onClick={() => bringBack(selected.id)}>
            Back
          </LayerButton>
          <LayerButton icon={<ChevronsUp className="size-3.5" />} onClick={() => sendToFront(selected.id)}>
            Front
          </LayerButton>
          <LayerButton icon={<ChevronsDown className="size-3.5" />} onClick={() => sendToBack(selected.id)}>
            Bottom
          </LayerButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pb-1">
        <LayerButton icon={<Copy className="size-3.5" />} onClick={duplicateSelected}>
          Duplicate
        </LayerButton>
        <button
          type="button"
          className="flex h-9 items-center justify-center gap-2 rounded-none border border-danger/30 text-[13px] text-danger hover:bg-danger/10"
          onClick={() => deleteMapping(selected.id)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

function CustomMappingInspector({ mapping }: { mapping: CustomMapping }) {
  const updateMapping = useRoomStore((state) => state.updateMapping);
  const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
  if (!entry) {
    return (
      <div className="border border-amber-300/40 bg-amber-300/[0.08] p-3 text-[12px] text-amber-100 shadow-[inset_0_0_24px_rgba(252,211,77,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center border border-amber-300/40 bg-amber-300/10 text-amber-200">
            <PackageX className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-amber-50">Mapping unavailable</p>
            <p className="mt-1 break-all font-mono text-[10px] leading-4 text-amber-100/55">{mapping.packageId}@{mapping.packageVersion}</p>
          </div>
        </div>
        <p className="mt-3 leading-relaxed text-amber-100/65">Install this package to restore its renderer and settings. Its saved configuration has been preserved.</p>
      </div>
    );
  }
  const definition = entry.definition;
  if (!definition) {
    if (!entry.manifest.entrypoints.inspector) {
      return <p className="text-[13px] text-white/50">{entry.manifest.name} has no extra settings.</p>;
    }
    return (
      <div className="h-72 overflow-hidden border border-white/10 bg-black/30">
        <CustomMappingFrame
          mapping={mapping}
          manifest={entry.manifest}
          mode="inspector"
          onConfigChange={(config) => updateMapping(mapping.id, { config })}
        />
      </div>
    );
  }
  if (!definition.Inspector) {
    return <p className="text-[13px] text-white/50">{entry.manifest.name} has no extra settings.</p>;
  }
  const InspectorFields = definition.Inspector;
  return (
    <InspectorFields
      mapping={mapping}
      config={customMappingConfig(mapping)}
      onChange={(config, extra) =>
        updateMapping(mapping.id, {
          config: config as Record<string, unknown>,
          ...extra,
        })
      }
    />
  );
}

function ClockControls({ mapping }: { mapping: TextMapping }) {
  const updateMapping = useRoomStore((state) => state.updateMapping);
  const patch = (value: Partial<TextMapping>) => updateMapping(mapping.id, value);
  const analog = (mapping.clockStyle ?? "digital") === "analog";
  return (
    <div className="space-y-3 border border-white/10 bg-white/[0.025] p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {(["digital", "analog"] as const).map((style) => (
          <button key={style} type="button" onClick={() => patch({ clockStyle: style })}
            className={`h-9 border text-[11px] uppercase tracking-[0.14em] ${(mapping.clockStyle ?? "digital") === style ? "border-accent/70 bg-accent/15 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>
            {style}
          </button>
        ))}
      </div>
      {analog ? (
        <div className="space-y-1.5">
          <span className="chrome-label">Face</span>
          <InspectorSelect
            ariaLabel="Clock face"
            value={mapping.clockFaceStyle ?? "ticks"}
            options={[{ id: "minimal", label: "Minimal" }, { id: "ticks", label: "Precision ticks" }, { id: "numerals", label: "Numerals" }]}
            onChange={(clockFaceStyle) => patch({ clockFaceStyle: clockFaceStyle as TextMapping["clockFaceStyle"] })}
          />
        </div>
      ) : (
        <Toggle label="24-hour time" checked={mapping.clock24Hour ?? false} onChange={(clock24Hour) => patch({ clock24Hour })} />
      )}
      <Toggle label="Show seconds" checked={mapping.clockShowSeconds !== false} onChange={(clockShowSeconds) => patch({ clockShowSeconds })} />
      {!analog ? <Toggle label="Show date" checked={mapping.clockShowDate ?? false} onChange={(clockShowDate) => patch({ clockShowDate })} /> : null}
      <Toggle label="Background" checked={mapping.clockShowBackground !== false} onChange={(clockShowBackground) => patch({ clockShowBackground })} />
      <Toggle label="Soft glow" checked={mapping.clockGlow ?? false} onChange={(clockGlow) => patch({ clockGlow })} />
      <p className="text-[10px] leading-relaxed text-white/35">Uses this computer&apos;s local time. Color becomes the face color when the background is off.</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-0.5 text-[12px] text-white/65">
      <span>{label}</span>
      <input className="accent-[var(--color-accent)]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function LayerButton({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center justify-center gap-1.5 rounded-none border border-white/15 text-[12px] text-white hover:bg-white/10"
    >
      {icon}
      {children}
    </button>
  );
}
