import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { mappingAnchor } from "../geometry";
import type { Mapping, Point } from "../types";

const SURFACE_TRANSITION_MS = 140;

type Transition = {
  fromOffsets: Point[];
  startedAt: number;
};

type Snapshot = {
  surfaceId: string | null;
  mapping: Mapping;
};

function surfaceIdOf(mapping: Mapping) {
  return mapping.surfaceId ?? null;
}

function transitionProgress(transition: Transition, now: number) {
  const linear = Math.min(1, Math.max(0, (now - transition.startedAt) / SURFACE_TRANSITION_MS));
  return 1 - ((1 - linear) ** 3);
}

function interpolateMapping(mapping: Mapping, transition: Transition, now: number): Mapping {
  if (transition.fromOffsets.length !== mapping.vertices.length) return mapping;
  const anchor = mappingAnchor(mapping);
  const progress = transitionProgress(transition, now);
  const vertices = mapping.vertices.map((vertex, index) => {
    const from = transition.fromOffsets[index];
    if (!from) return vertex;
    const target = { x: vertex.x - anchor.x, y: vertex.y - anchor.y };
    return {
      x: anchor.x + from.x + ((target.x - from.x) * progress),
      y: anchor.y + from.y + ((target.y - from.y) * progress),
    };
  });
  return { ...mapping, vertices } as Mapping;
}

/**
 * Briefly morph a mapping between its loose and projected shapes when its
 * surface assignment changes. Offsets are animated around the live anchor so
 * pointer movement remains immediate while the shape settles into place.
 */
export function useSurfaceTransitions(source: Mapping[], displayed: Mapping[]): Mapping[] {
  const snapshotsRef = useRef(new Map<string, Snapshot>());
  const transitionsRef = useRef(new Map<string, Transition>());
  const [frame, setFrame] = useState(0);

  useLayoutEffect(() => {
    const now = performance.now();
    const previous = snapshotsRef.current;
    const next = new Map<string, Snapshot>();
    let started = false;

    for (let index = 0; index < displayed.length; index += 1) {
      const mapping = displayed[index];
      const stored = source[index];
      if (!mapping || !stored) continue;

      const prior = previous.get(mapping.id);
      const nextSurfaceId = surfaceIdOf(stored);
      if (
        prior
        && prior.surfaceId !== nextSurfaceId
        && prior.mapping.vertices.length === mapping.vertices.length
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const active = transitionsRef.current.get(mapping.id);
        const visibleBeforeChange = active
          ? interpolateMapping(prior.mapping, active, now)
          : prior.mapping;
        const anchor = mappingAnchor(visibleBeforeChange);
        transitionsRef.current.set(mapping.id, {
          fromOffsets: visibleBeforeChange.vertices.map((vertex) => ({
            x: vertex.x - anchor.x,
            y: vertex.y - anchor.y,
          })),
          startedAt: now,
        });
        started = true;
      }

      next.set(mapping.id, { surfaceId: nextSurfaceId, mapping });
    }

    for (const id of transitionsRef.current.keys()) {
      if (!next.has(id)) transitionsRef.current.delete(id);
    }
    snapshotsRef.current = next;
    if (started) setFrame((value) => value + 1);
  }, [displayed, source]);

  useEffect(() => {
    if (transitionsRef.current.size === 0) return;
    const request = requestAnimationFrame((now) => {
      for (const [id, transition] of transitionsRef.current) {
        if (now - transition.startedAt >= SURFACE_TRANSITION_MS) {
          transitionsRef.current.delete(id);
        }
      }
      setFrame((value) => value + 1);
    });
    return () => cancelAnimationFrame(request);
  }, [frame]);

  return useMemo(() => {
    const now = performance.now();
    return displayed.map((mapping) => {
      const transition = transitionsRef.current.get(mapping.id);
      return transition ? interpolateMapping(mapping, transition, now) : mapping;
    });
  }, [displayed, frame]);
}
