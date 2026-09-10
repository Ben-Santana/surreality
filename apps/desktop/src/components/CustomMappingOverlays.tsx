import { isValidWarpQuad } from "../geometry";
import { customMappingConfig, customMappingGeometry } from "../customMappings/config";
import { getCustomMapping, useCustomMappings } from "../customMappings/registry";
import { quadToMatrix3d } from "../quadTransform";
import { PackageX } from "lucide-react";
import type { CSSProperties } from "react";
import type { CustomMapping, Mapping, Point } from "../types";
import { isCustomMapping } from "../types";
import CustomMappingFrame from "./CustomMappingFrame";

function asQuad(vertices: Point[]): [Point, Point, Point, Point] | null {
  const [tl, tr, br, bl] = vertices;
  return tl && tr && br && bl ? [tl, tr, br, bl] : null;
}

function missingMappingBounds(mapping: CustomMapping) {
  const geometry = customMappingGeometry(mapping);
  if (geometry === "circle") {
    const [center, rimU, rimV] = mapping.vertices;
    if (center && rimU && rimV) {
      const ux = rimU.x - center.x;
      const uy = rimU.y - center.y;
      const vx = rimV.x - center.x;
      const vy = rimV.y - center.y;
      const radiusX = Math.sqrt((ux * ux) + (vx * vx));
      const radiusY = Math.sqrt((uy * uy) + (vy * vy));
      return { left: center.x - radiusX, top: center.y - radiusY, width: radiusX * 2, height: radiusY * 2 };
    }
  }
  if (mapping.vertices.length === 0) return { left: 0, top: 0, width: 0, height: 0 };
  const xs = mapping.vertices.map(({ x }) => x);
  const ys = mapping.vertices.map(({ y }) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(1, Math.max(...xs) - left),
    height: Math.max(1, Math.max(...ys) - top),
  };
}

function MissingMappingShape({ mapping }: { mapping: CustomMapping }) {
  const geometry = customMappingGeometry(mapping);
  if (geometry === "circle") {
    const [center, rimU, rimV] = mapping.vertices;
    if (!center || !rimU || !rimV) return null;
    const ux = rimU.x - center.x;
    const uy = rimU.y - center.y;
    const vx = rimV.x - center.x;
    const vy = rimV.y - center.y;
    return (
      <ellipse
        cx="0"
        cy="0"
        rx="1"
        ry="1"
        transform={`matrix(${ux} ${uy} ${vx} ${vy} ${center.x} ${center.y})`}
        className="fill-amber-300/[0.12] stroke-amber-300/90"
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (mapping.vertices.length < 3) return null;
  return (
    <polygon
      points={mapping.vertices.map(({ x, y }) => `${x},${y}`).join(" ")}
      className="fill-amber-300/[0.12] stroke-amber-300/90"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function externalSurfaceStyle(mapping: CustomMapping, width: number, height: number): CSSProperties | null {
  const geometry = customMappingGeometry(mapping);
  if (geometry === "quad") {
    const quad = asQuad(mapping.vertices);
    if (!quad || !isValidWarpQuad(mapping.vertices)) return null;
    return {
      left: 0,
      top: 0,
      width,
      height,
      transformOrigin: "0 0",
      transform: quadToMatrix3d(width, height, quad),
    };
  }
  if (geometry === "circle") {
    const [center, rimU, rimV] = mapping.vertices;
    if (!center || !rimU || !rimV) return null;
    const ux = rimU.x - center.x;
    const uy = rimU.y - center.y;
    const vx = rimV.x - center.x;
    const vy = rimV.y - center.y;
    return {
      left: 0,
      top: 0,
      width,
      height,
      borderRadius: "50%",
      transformOrigin: "0 0",
      transform: `matrix(${(2 * ux) / width}, ${(2 * uy) / width}, ${(2 * vx) / height}, ${(2 * vy) / height}, ${center.x - ux - vx}, ${center.y - uy - vy})`,
    };
  }
  if (mapping.vertices.length < 3) return null;
  const xs = mapping.vertices.map(({ x }) => x);
  const ys = mapping.vertices.map(({ y }) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const boxWidth = Math.max(1, Math.max(...xs) - left);
  const boxHeight = Math.max(1, Math.max(...ys) - top);
  const polygon = mapping.vertices
    .map(({ x, y }) => `${((x - left) / boxWidth) * 100}% ${((y - top) / boxHeight) * 100}%`)
    .join(",");
  return { left, top, width: boxWidth, height: boxHeight, clipPath: `polygon(${polygon})` };
}

export function CustomMappingSurface({ mapping }: { mapping: CustomMapping }) {
  const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
  if (!entry) {
    const bounds = missingMappingBounds(mapping);
    return (
      <>
        <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <MissingMappingShape mapping={mapping} />
        </svg>
        <div
          className="absolute flex items-center justify-center overflow-hidden p-3 text-amber-50"
          style={bounds}
        >
          <span className="flex max-w-full items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border border-amber-300/50 bg-amber-300/15 text-amber-200">
              <PackageX className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                Mapping unavailable
              </span>
              <span className="mt-1 block break-all font-mono text-[10px] leading-4 text-amber-100/65">
                {mapping.packageId}@{mapping.packageVersion}
              </span>
            </span>
          </span>
        </div>
      </>
    );
  }

  if (entry.definition) {
    const View = entry.definition.View;
    const geometry = customMappingGeometry(mapping, entry.definition.geometry ?? "quad");
    if (geometry !== "quad") {
      return <div className="absolute inset-0"><View mapping={mapping} config={customMappingConfig(mapping)} /></div>;
    }
    const quad = asQuad(mapping.vertices);
    if (!quad || !isValidWarpQuad(mapping.vertices)) return null;
    const { width, height } = entry.manifest.contentSize;
    return (
      <div className="absolute left-0 top-0" style={{
        width,
        height,
        transformOrigin: "0 0",
        transform: quadToMatrix3d(width, height, quad),
        overflow: "visible",
        opacity: mapping.color.a / 255,
      }}>
        <View mapping={mapping} config={customMappingConfig(mapping)} />
      </div>
    );
  }

  const { width, height } = entry.manifest.contentSize;
  const style = externalSurfaceStyle(mapping, width, height);
  return (
    <div
      className="absolute overflow-hidden"
      style={style ? { ...style, opacity: mapping.color.a / 255 } : { display: "none" }}
    >
      <CustomMappingFrame mapping={mapping} manifest={entry.manifest} mode="mapping" />
    </div>
  );
}

export function CustomMappingRuntimeFrames({ mappings }: { mappings: Mapping[] }) {
  useCustomMappings();
  const items = mappings.filter(isCustomMapping);
  return <>{items.map((mapping) => {
    const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
    if (!entry || entry.definition || !entry.manifest.entrypoints.runtime) return null;
    return (
      <div key={`runtime:${mapping.id}`} className="absolute h-px w-px overflow-hidden opacity-0">
        <CustomMappingFrame mapping={mapping} manifest={entry.manifest} mode="runtime" />
      </div>
    );
  })}</>;
}

export default function CustomMappingOverlays({ mappings, runRuntime = false }: { mappings: Mapping[]; runRuntime?: boolean }) {
  useCustomMappings();
  const items = mappings.filter(isCustomMapping);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {items.map((mapping) => <CustomMappingSurface key={mapping.id} mapping={mapping} />)}
      {runRuntime ? <CustomMappingRuntimeFrames mappings={items} /> : null}
    </div>
  );
}
