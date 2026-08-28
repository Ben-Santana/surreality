import { isValidWarpQuad } from "../geometry";
import { customMappingConfig, customMappingGeometry } from "../customMappings/config";
import { getCustomMapping, useCustomMappings } from "../customMappings/registry";
import { quadToMatrix3d } from "../quadTransform";
import type { CSSProperties } from "react";
import type { CustomMapping, Mapping, Point } from "../types";
import { isCustomMapping } from "../types";
import CustomMappingFrame from "./CustomMappingFrame";

function asQuad(vertices: Point[]): [Point, Point, Point, Point] | null {
  const [tl, tr, br, bl] = vertices;
  return tl && tr && br && bl ? [tl, tr, br, bl] : null;
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

function CustomMappingSurface({ mapping }: { mapping: CustomMapping }) {
  const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
  if (!entry) {
    const [first] = mapping.vertices;
    return (
      <div
        className="absolute flex min-h-24 min-w-48 items-center justify-center border border-dashed border-amber-400/70 bg-black/85 p-3 text-center text-xs text-amber-200"
        style={{ left: first?.x ?? 0, top: first?.y ?? 0 }}
      >
        Missing custom mapping<br />{mapping.packageId}@{mapping.packageVersion}
      </div>
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
  if (!style) return null;
  return (
    <div className="absolute overflow-hidden" style={{ ...style, opacity: mapping.color.a / 255 }}>
      <CustomMappingFrame mapping={mapping} manifest={entry.manifest} mode="mapping" />
    </div>
  );
}

export default function CustomMappingOverlays({ mappings, runRuntime = false }: { mappings: Mapping[]; runRuntime?: boolean }) {
  useCustomMappings();
  const items = mappings.filter(isCustomMapping);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {items.map((mapping) => <CustomMappingSurface key={mapping.id} mapping={mapping} />)}
      {runRuntime ? items.map((mapping) => {
        const entry = getCustomMapping(mapping.packageId, mapping.packageVersion);
        if (!entry || entry.definition || !entry.manifest.entrypoints.runtime) return null;
        return (
          <div key={`runtime:${mapping.id}`} className="absolute h-px w-px overflow-hidden opacity-0">
            <CustomMappingFrame mapping={mapping} manifest={entry.manifest} mode="runtime" />
          </div>
        );
      }) : null}
    </div>
  );
}
