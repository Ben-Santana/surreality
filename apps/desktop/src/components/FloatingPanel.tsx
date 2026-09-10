import { GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { add, dist } from "../geometry";
import { useRoomStore } from "../store";
import {
  PANEL_SIZE,
  type PanelLayout,
  type PanelSkew,
  type Point,
} from "../types";

const DEFAULT_POSITION = { x: 16, y: 56 };
const MIN_EDGE = 32;
const COMPACT_SIZE = { width: 280, height: 56 };

function rectCorners(position: Point, size: { width: number; height: number }): PanelSkew {
  const { x, y } = position;
  const { width, height } = size;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function defaultCorners(): PanelSkew {
  return rectCorners(DEFAULT_POSITION, PANEL_SIZE);
}

function layoutSize(corners: PanelSkew) {
  const [tl, tr, br, bl] = corners;
  return {
    width: Math.max(MIN_EDGE, (dist(tl!, tr!) + dist(bl!, br!)) / 2),
    height: Math.max(MIN_EDGE, (dist(tl!, bl!) + dist(tr!, br!)) / 2),
  };
}

function axisAligned(corners: PanelSkew): PanelSkew {
  const size = layoutSize(corners);
  const x = Math.min(...corners.map((corner) => corner.x));
  const y = Math.min(...corners.map((corner) => corner.y));
  return rectCorners({ x, y }, size);
}

function readCorners(layout: PanelLayout | null): PanelSkew {
  if (layout && "corners" in layout && layout.corners?.length === 4) {
    const corners = axisAligned(layout.corners);
    const size = layoutSize(corners);
    if (size.width < PANEL_SIZE.width) {
      const origin = corners[0] ?? DEFAULT_POSITION;
      return rectCorners(origin, { width: PANEL_SIZE.width, height: size.height });
    }
    return corners;
  }
  const legacy = layout as { position?: Point } | null;
  if (legacy?.position) {
    return rectCorners(legacy.position, PANEL_SIZE);
  }
  return defaultCorners();
}

function translateCorners(corners: PanelSkew, delta: Point): PanelSkew {
  return corners.map((corner) => add(corner, delta)) as PanelSkew;
}

function clampDelta(corners: PanelSkew, delta: Point): Point {
  const xs = corners.map((corner) => corner.x + delta.x);
  const ys = corners.map((corner) => corner.y + delta.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: delta.x + Math.max(48 - maxX, Math.min(0, window.innerWidth - 48 - minX)),
    y: delta.y + Math.max(36 - maxY, Math.min(0, window.innerHeight - 36 - minY)),
  };
}

export default function FloatingPanel({
  title,
  leading,
  accessory,
  className = "",
  children,
  onDetach,
  minimized = false,
  onMinimizedChange,
  compactToolbar,
}: {
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  compactToolbar?: ReactNode;
  title?: ReactNode;
  leading?: ReactNode;
  accessory?: ReactNode;
  className?: string;
  children: ReactNode;
  onDetach?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousMinimized = useRef(minimized);
  useEffect(() => {
    if (previousMinimized.current === minimized) return;
    previousMinimized.current = minimized;
    panelRef.current?.querySelector<HTMLButtonElement>(minimized ? '[aria-label="Expand editor"]' : '[aria-label="Minimize editor"]')?.focus();
  }, [minimized]);
  const dragRef = useRef<{ pointerX: number; pointerY: number; corners: PanelSkew } | null>(null);
  const stored = useRoomStore((state) => state.panelLayout);
  const setPanelLayout = useRoomStore((state) => state.setPanelLayout);
  const corners = readCorners(stored);
  const size = layoutSize(corners);
  const origin = corners[0] ?? DEFAULT_POSITION;

  const visibleCorners = minimized ? rectCorners(origin, COMPACT_SIZE) : corners;

  useEffect(() => {
    const keepOnScreen = () => {
      const next = translateCorners(corners, clampDelta(visibleCorners, { x: 0, y: 0 }));
      if (next.some((corner, index) => corner.x !== corners[index]?.x || corner.y !== corners[index]?.y)) {
        setPanelLayout({ corners: next });
      }
    };
    keepOnScreen();
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, [corners, visibleCorners, setPanelLayout]);

  const beginMove = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      corners,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.pointerX;
    const dy = event.clientY - drag.pointerY;
    setPanelLayout({
      corners: translateCorners(drag.corners, clampDelta(minimized ? rectCorners(drag.corners[0]!, COMPACT_SIZE) : drag.corners, { x: dx, y: dy })),
    });
  };

  const onHandlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const outside =
      event.clientX < 0 ||
      event.clientY < 0 ||
      event.clientX > window.innerWidth ||
      event.clientY > window.innerHeight;
    if (drag && outside && onDetach) {
      const grabX = drag.pointerX - (drag.corners[0]?.x ?? 0);
      const grabY = drag.pointerY - (drag.corners[0]?.y ?? 0);
      onDetach({
        x: Math.round(window.screenX + event.clientX - grabX),
        y: Math.round(window.screenY + event.clientY - grabY),
        width: Math.round(size.width),
        height: Math.round(size.height),
      });
    }
    dragRef.current = null;
  };

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-20">
      <div
        ref={panelRef}
        className={`editor-panel pointer-events-auto flex flex-col overflow-visible border border-white/10 bg-[#111114] text-white shadow-2xl shadow-black/50 ${className} ${minimized ? "is-minimized" : ""}`}
        style={{
          position: "absolute",
          left: origin.x,
          top: origin.y,
          width: minimized ? COMPACT_SIZE.width : size.width,
          height: minimized ? COMPACT_SIZE.height : size.height,
        }}
      >
        <div
          inert={minimized}
          className="panel-titlebar relative flex h-10 shrink-0 cursor-grab touch-none items-center border-b border-white/10 active:cursor-grabbing"
          onPointerDown={beginMove}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="flex h-9 items-center px-2 text-white/40">
            <GripVertical className="size-3.5" />
          </span>
          {leading ? <div>{leading}</div> : null}
          {title ? <div className="absolute left-1/2 w-[42%] -translate-x-1/2 text-center">{title}</div> : null}
          {accessory ? <div className="ml-auto pr-3">{accessory}</div> : null}
          {onMinimizedChange ? <button
            type="button"
            className="panel-minimize no-drag mr-2 flex size-7 shrink-0 items-center justify-center text-white/55 hover:bg-white/10 hover:text-white"
            title="Minimize editor"
            aria-label="Minimize editor"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onMinimizedChange(true)}
          ><Minimize2 className="size-3.5" /></button> : null}
        </div>
        <div inert={minimized} className="panel-expanded-content flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        {minimized ? <div className="panel-compact-bar" role="toolbar" aria-label="Space editing tools">
          <button
            type="button"
            className="compact-grip flex h-9 w-7 shrink-0 touch-none items-center justify-center rounded-full text-white/40 hover:text-white"
            title="Drag toolbar · arrow keys to move"
            aria-label="Move toolbar"
            onPointerDown={beginMove}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={() => { dragRef.current = null; }}
            onKeyDown={(event) => {
              const directions: Record<string, Point> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
              const delta = directions[event.key];
              if (!delta) return;
              event.preventDefault();
              setPanelLayout({ corners: translateCorners(corners, clampDelta(visibleCorners, delta)) });
            }}
          ><GripVertical className="size-4" /></button>
          {compactToolbar}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 hover:text-white"
            title="Expand editor"
            aria-label="Expand editor"
            onClick={() => onMinimizedChange?.(false)}
          ><Maximize2 className="size-4" /></button>
        </div> : null}
      </div>
    </div>
  );
}
