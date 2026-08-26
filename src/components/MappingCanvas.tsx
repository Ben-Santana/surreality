import { useEffect, useRef, type MouseEventHandler, type PointerEventHandler, type RefObject } from "react";
import { renderHandles, renderStage } from "../render";
import { GRID_STEPS, type Mapping, type Surface } from "../types";

type Props = {
  mappings: Mapping[];
  surfaces?: Surface[];
  edit?: boolean;
  selectedId?: string | null;
  dropTargetId?: string | null;
  grid?: boolean;
  gridStep?: number;
  handles?: boolean;
  layer?: "stage" | "handles";
  className?: string;
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  onPointerDown?: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove?: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp?: PointerEventHandler<HTMLCanvasElement>;
  onContextMenu?: MouseEventHandler<HTMLCanvasElement>;
};

export function canvasPoint(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function paint(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mappings: Mapping[],
  surfaces: Surface[],
  options: {
    edit: boolean;
    selectedId: string | null;
    dropTargetId: string | null;
    grid: boolean;
    gridStep: number;
    handles: boolean;
    layer: "stage" | "handles";
  },
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (options.layer === "handles") {
    renderHandles(ctx, mappings, {
      width: rect.width,
      height: rect.height,
      selectedId: options.selectedId,
      surfaces,
    });
    return;
  }
  renderStage(ctx, mappings, {
    width: rect.width,
    height: rect.height,
    surfaces,
    edit: options.edit,
    selectedId: options.selectedId,
    dropTargetId: options.dropTargetId,
    grid: options.grid,
    gridStep: options.gridStep,
    handles: options.handles,
  });
}

export default function MappingCanvas({
  mappings,
  surfaces = [],
  edit = false,
  selectedId = null,
  dropTargetId = null,
  grid = false,
  gridStep = GRID_STEPS.medium,
  handles = true,
  layer = "stage",
  className,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: Props) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const ref = canvasRef ?? internalRef;
  const mappingsRef = useRef(mappings);
  const surfacesRef = useRef(surfaces);
  const optionsRef = useRef({ edit, selectedId, dropTargetId, grid, gridStep, handles, layer });
  mappingsRef.current = mappings;
  surfacesRef.current = surfaces;
  optionsRef.current = { edit, selectedId, dropTargetId, grid, gridStep, handles, layer };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      paint(ctx, canvas, mappingsRef.current, surfacesRef.current, optionsRef.current);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paint(ctx, canvas, mappings, surfaces, { edit, selectedId, dropTargetId, grid, gridStep, handles, layer });
  }, [dropTargetId, edit, grid, gridStep, handles, layer, mappings, ref, selectedId, surfaces]);

  return (
    <canvas
      ref={ref}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
    />
  );
}
