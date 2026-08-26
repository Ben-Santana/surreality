import { GripVertical } from "lucide-react";
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
    return axisAligned(layout.corners);
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
  accessory,
  className = "",
  children,
}: {
  title?: string;
  accessory?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const dragRef = useRef<{ pointerX: number; pointerY: number; corners: PanelSkew } | null>(null);
  const stored = useRoomStore((state) => state.panelLayout);
  const setPanelLayout = useRoomStore((state) => state.setPanelLayout);
  const corners = readCorners(stored);
  const size = layoutSize(corners);
  const origin = corners[0] ?? DEFAULT_POSITION;

  useEffect(() => {
    const keepOnScreen = () => {
      const next = translateCorners(corners, clampDelta(corners, { x: 0, y: 0 }));
      if (next.some((corner, index) => corner.x !== corners[index]?.x || corner.y !== corners[index]?.y)) {
        setPanelLayout({ corners: next });
      }
    };
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, [corners, setPanelLayout]);

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
      corners: translateCorners(drag.corners, clampDelta(drag.corners, { x: dx, y: dy })),
    });
  };

  const onHandlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-20">
      <div
        className={`editor-panel pointer-events-auto flex flex-col overflow-visible rounded-none border border-white/10 bg-[#111114] text-white shadow-2xl shadow-black/50 ${className}`}
        style={{
          position: "absolute",
          left: origin.x,
          top: origin.y,
          width: size.width,
          height: size.height,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center border-b border-white/10 active:cursor-grabbing"
          onPointerDown={beginMove}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="flex h-9 items-center px-2 text-white/40">
            <GripVertical className="size-3.5" />
          </span>
          {title ? <p className="chrome-label pr-3">{title}</p> : null}
          {accessory ? <div className="ml-auto pr-3">{accessory}</div> : null}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
