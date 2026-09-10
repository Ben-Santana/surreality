import { useEffect, useMemo, useRef, useState } from "react";
import {
  add,
  containsMapping,
  containsSurface,
  hitTestHandle,
  hitTestSurfaceHandle,
  mappingAnchor,
  snapPoint,
  sub,
} from "../geometry";
import { activateMapping, interactiveCustomMappingAt } from "../interact";
import { useRoomStore } from "../store";
import { displayMappings, screenToWallPoint, topSurfaceAt, wallToScreenPoint } from "../wall";
import { GRID_STEPS, type Point } from "../types";
import MappingCanvas, { canvasPoint } from "./MappingCanvas";
import MappingLayers from "./MappingLayers";
import { CustomMappingRuntimeFrames } from "./CustomMappingOverlays";
import { CustomMappingRuntimeOverlays } from "../customMappings/runtime";

type Drag =
  | { type: "mapping"; id: string; kind: "vertex"; index: number }
  | { type: "mapping"; id: string; kind: "anchor"; offset: Point }
  | { type: "surface"; id: string; kind: "vertex"; index: number }
  | { type: "surface"; id: string; kind: "anchor" };

export default function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const selectedId = useRoomStore((state) => state.selectedId);
  const editMode = useRoomStore((state) => state.editMode);
  const showGrid = useRoomStore((state) => state.showGrid);
  const snapToGrid = useRoomStore((state) => state.snapToGrid);
  const gridSize = useRoomStore((state) => state.gridSize);
  const tool = useRoomStore((state) => state.tool);
  const setEditMode = useRoomStore((state) => state.setEditMode);
  const select = useRoomStore((state) => state.select);
  const addAt = useRoomStore((state) => state.addAt);
  const addPolygonVertices = useRoomStore((state) => state.addPolygonVertices);
  const moveVertex = useRoomStore((state) => state.moveVertex);
  const moveAnchor = useRoomStore((state) => state.moveAnchor);
  const moveSurfaceVertex = useRoomStore((state) => state.moveSurfaceVertex);
  const moveSurfaceAnchor = useRoomStore((state) => state.moveSurfaceAnchor);
  const endHistoryGesture = useRoomStore((state) => state.endHistoryGesture);
  const openMenu = useRoomStore((state) => state.openMenu);
  const closeMenu = useRoomStore((state) => state.closeMenu);
  const spaceEntered = useRoomStore((state) => state.spaceEntered);
  const [dropSurfaceId, setDropSurfaceId] = useState<string | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  const [polygonPointer, setPolygonPointer] = useState<Point | null>(null);

  useEffect(() => {
    if (tool !== "polygon" || !editMode) {
      setPolygonDraft([]);
      setPolygonPointer(null);
    }
  }, [editMode, tool]);

  // Mappings store unskewed geometry; the stage always works with how they
  // currently appear through their surface.
  const shown = useMemo(() => displayMappings(mappings, surfaces), [mappings, surfaces]);

  const pointFromEvent = (event: { clientX: number; clientY: number }): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvasPoint(event, canvas);
  };

  const snappedPoint = (point: Point): Point => {
    if (!showGrid || !snapToGrid) return point;
    const step = GRID_STEPS[gridSize];
    const surface = topSurfaceAt(surfaces, point);
    if (!surface) return snapPoint(point, step);
    const local = screenToWallPoint(surface, point);
    return wallToScreenPoint(surface, snapPoint(local, step));
  };

  return (
    <div className={`editor-stage absolute inset-0 bg-black ${editMode ? "" : "presentation-cursor"}`}>
      <MappingCanvas
        canvasRef={canvasRef}
        mappings={[]}
        surfaces={surfaces}
        edit={editMode}
        selectedId={selectedId}
        dropTargetId={dropSurfaceId}
        grid={Boolean(editMode && (showGrid || !spaceEntered))}
        gridStep={GRID_STEPS[gridSize]}
        handles={false}
        className={`block h-full w-full touch-none ${editMode ? "cursor-crosshair" : "cursor-none"}`}
        onPointerDown={(event) => {
          if (!spaceEntered) return;
          if (event.button === 2) return;
          const point = pointFromEvent(event);
          if (!point) return;
          closeMenu();

          if (!editMode) {
            const pad = interactiveCustomMappingAt(shown, point);
            if (pad) activateMapping(pad);
            return;
          }

          if (tool !== "select") {
            if (tool === "polygon") {
              const vertex = snappedPoint(point);
              const origin = polygonDraft[0];
              if (origin && polygonDraft.length >= 3 && Math.hypot(vertex.x - origin.x, vertex.y - origin.y) <= 14) {
                addPolygonVertices(polygonDraft);
                setPolygonDraft([]);
                setPolygonPointer(null);
              } else {
                setPolygonDraft((vertices) => [...vertices, vertex]);
                setPolygonPointer(vertex);
              }
              return;
            }
            addAt(tool, snappedPoint(point));
            return;
          }

          const selectedMapping = shown.find((mapping) => mapping.id === selectedId);
          if (selectedMapping) {
            const handle = hitTestHandle(selectedMapping, point);
            if (handle?.kind === "vertex") {
              dragRef.current = {
                type: "mapping",
                id: selectedMapping.id,
                kind: "vertex",
                index: handle.index ?? 0,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
          }

          const selectedSurface = surfaces.find((surface) => surface.id === selectedId);
          if (selectedSurface) {
            const handle = hitTestSurfaceHandle(selectedSurface, point);
            if (handle) {
              dragRef.current =
                handle.kind === "anchor"
                  ? { type: "surface", id: selectedSurface.id, kind: "anchor" }
                  : { type: "surface", id: selectedSurface.id, kind: "vertex", index: handle.index ?? 0 };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
          }

          for (let index = shown.length - 1; index >= 0; index -= 1) {
            const mapping = shown[index];
            if (!mapping) continue;
            const handle = hitTestHandle(mapping, point);
            if (handle?.kind === "vertex") {
              select(mapping.id);
              dragRef.current = {
                type: "mapping",
                id: mapping.id,
                kind: "vertex",
                index: handle.index ?? 0,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
            if (containsMapping(mapping, point)) {
              select(mapping.id);
              dragRef.current = {
                type: "mapping",
                id: mapping.id,
                kind: "anchor",
                offset: sub(mappingAnchor(mapping), point),
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
          }

          for (let index = surfaces.length - 1; index >= 0; index -= 1) {
            const surface = surfaces[index];
            if (!surface) continue;
            const handle = hitTestSurfaceHandle(surface, point);
            if (handle) {
              select(surface.id);
              dragRef.current =
                handle.kind === "anchor"
                  ? { type: "surface", id: surface.id, kind: "anchor" }
                  : { type: "surface", id: surface.id, kind: "vertex", index: handle.index ?? 0 };
              event.currentTarget.setPointerCapture(event.pointerId);
              return;
            }
            if (containsSurface(surface, point)) {
              select(surface.id);
              return;
            }
          }

          select(null);
          setEditMode(false);
        }}
        onPointerMove={(event) => {
          const raw = pointFromEvent(event);
          if (editMode && tool === "polygon" && raw) {
            setPolygonPointer(snappedPoint(raw));
          }
          const drag = dragRef.current;
          if (!drag || !raw) return;
          if (drag.type === "mapping") {
            if (drag.kind === "anchor") {
              const anchor = snappedPoint(add(raw, drag.offset));
              moveAnchor(drag.id, anchor);
              setDropSurfaceId(topSurfaceAt(surfaces, anchor)?.id ?? null);
            } else {
              moveVertex(drag.id, drag.index, snappedPoint(raw));
            }
            return;
          }
          const point = snappedPoint(raw);
          if (drag.kind === "anchor") moveSurfaceAnchor(drag.id, point);
          else moveSurfaceVertex(drag.id, drag.index, point);
        }}
        onPointerUp={() => {
          dragRef.current = null;
          setDropSurfaceId(null);
          endHistoryGesture();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          if (!spaceEntered) return;
          const point = pointFromEvent(event);
          if (!point) return;
          setEditMode(true);
          let mappingId: string | null = null;
          let surfaceId: string | null = null;
          for (let index = shown.length - 1; index >= 0; index -= 1) {
            const mapping = shown[index];
            if (mapping && containsMapping(mapping, point)) {
              mappingId = mapping.id;
              select(mapping.id);
              break;
            }
          }
          if (!mappingId) {
            for (let index = surfaces.length - 1; index >= 0; index -= 1) {
              const surface = surfaces[index];
              if (surface && containsSurface(surface, point)) {
                surfaceId = surface.id;
                select(surface.id);
                break;
              }
            }
          }
          openMenu({
            x: event.clientX,
            y: event.clientY,
            canvasX: point.x,
            canvasY: point.y,
            mappingId,
            surfaceId,
          });
        }}
      />
      <MappingLayers mappings={shown} edit={editMode} />
      <CustomMappingRuntimeFrames mappings={shown} />
      {editMode && tool === "polygon" && polygonDraft.length > 0 ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <polyline
            points={[...polygonDraft, ...(polygonPointer ? [polygonPointer] : [])]
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
          {polygonDraft.map((vertex, index) => (
            <circle
              key={`${vertex.x}-${vertex.y}-${index}`}
              cx={vertex.x}
              cy={vertex.y}
              r={index === 0 ? 7 : 4}
              fill={index === 0 ? "#ff5314" : "white"}
              stroke="black"
              strokeWidth="2"
            />
          ))}
        </svg>
      ) : null}
      <CustomMappingRuntimeOverlays />
      {editMode ? (
        <MappingCanvas
          mappings={shown}
          surfaces={surfaces}
          edit
          selectedId={selectedId}
          dropTargetId={dropSurfaceId}
          layer="handles"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      ) : null}

      {spaceEntered && editMode && mappings.length === 0 && surfaces.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="analog-frame max-w-sm rounded-none border border-white/10 bg-black/70 px-6 py-5 text-center backdrop-blur">
            <p className="font-medium uppercase tracking-[0.18em] text-zinc-100">Add a mapping</p>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
              Right-click the stage or pick a tool to add a mapping. Surfaces are rectangle
              walls you can drop mappings onto.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
