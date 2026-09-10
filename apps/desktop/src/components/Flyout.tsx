import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export type FlyoutPlacement = "bottom-start" | "bottom-end" | "right-start" | "left-start";

export function eventInside(event: Event, ...nodes: Array<Node | null | undefined>) {
  const target = event.target;
  if (!(target instanceof Node)) return false;
  return nodes.some((node) => node?.contains(target));
}

export default function Flyout({
  open,
  anchorRef,
  contentRef,
  placement = "bottom-start",
  offset = 4,
  matchAnchorWidth = false,
  children,
  className = "",
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  contentRef?: RefObject<HTMLDivElement | null>;
  placement?: FlyoutPlacement;
  offset?: number;
  matchAnchorWidth?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const update = () => {
      const box = anchorRef.current?.getBoundingClientRect();
      if (!box) return;
      const next: CSSProperties = { position: "fixed", zIndex: 80 };
      if (matchAnchorWidth) next.width = box.width;
      if (placement === "bottom-end") {
        next.top = box.bottom + offset;
        next.right = window.innerWidth - box.right;
      } else if (placement === "right-start") {
        next.top = box.top;
        next.left = box.right + offset;
      } else if (placement === "left-start") {
        next.top = box.top;
        next.right = window.innerWidth - box.left + offset;
      } else {
        next.top = box.bottom + offset;
        next.left = box.left;
      }
      setStyle((current) => current && current.top === next.top && current.left === next.left && current.right === next.right && current.width === next.width ? current : next);
    };

    update();
    let frame = window.requestAnimationFrame(function followAnchor() {
      update();
      frame = window.requestAnimationFrame(followAnchor);
    });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.cancelAnimationFrame(frame);
    };
  }, [anchorRef, matchAnchorWidth, offset, open, placement]);

  if (!open || !style) return null;

  return createPortal(
    <div ref={contentRef} className={className} style={style}>
      {children}
    </div>,
    document.body,
  );
}
