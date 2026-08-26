import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { centroid, isPolygonGeometry } from "../geometry";
import { getSpecial } from "../specials/registry";
import { asConfig } from "../specials/types";
import { useRoomStore } from "../store";
import { displayVertices } from "../wall";
import type { SpecialMapping } from "../types";
import ColorPicker from "./ColorPicker";

export default function Inspector() {
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
          <label className="block space-y-1.5">
            <span className="chrome-label">Text</span>
            <input
              value={selected.text}
              onChange={(event) => updateMapping(selected.id, { text: event.target.value })}
              className="panel-field no-drag h-9 w-full rounded-none px-3 text-[13px] outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="chrome-label">Font size</span>
            <input
              type="number"
              min={12}
              max={160}
              value={selected.fontSize}
              onChange={(event) =>
                updateMapping(selected.id, { fontSize: Number(event.target.value) || 42 })
              }
              className="panel-field no-drag h-9 w-full rounded-none px-3 text-[13px] outline-none"
            />
          </label>
        </div>
      ) : null}

      {selected.type === "special" ? (
        <SpecialInspector mapping={selected} />
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

function SpecialInspector({ mapping }: { mapping: SpecialMapping }) {
  const updateMapping = useRoomStore((state) => state.updateMapping);
  const definition = getSpecial(mapping.kind);
  if (!definition?.Inspector) {
    return (
      <p className="text-[13px] text-white/50">
        {definition?.label ?? mapping.kind} has no extra settings.
      </p>
    );
  }
  const InspectorFields = definition.Inspector;
  return (
    <InspectorFields
      mapping={mapping}
      config={asConfig(mapping, definition.defaultConfig)}
      onChange={(config, extra) =>
        updateMapping(mapping.id, {
          config: config as Record<string, unknown>,
          ...extra,
        })
      }
    />
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
