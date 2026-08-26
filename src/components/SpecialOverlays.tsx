import { isValidWarpQuad } from "../geometry";
import { quadToMatrix3d } from "../quadTransform";
import { asConfig, specialGeometry } from "../specials/types";
import { getSpecial } from "../specials/registry";
import type { Mapping, Point, SpecialMapping } from "../types";
import { isSpecialMapping } from "../types";

function asQuad(vertices: Point[]): [Point, Point, Point, Point] | null {
  const [tl, tr, br, bl] = vertices;
  if (!tl || !tr || !br || !bl) return null;
  return [tl, tr, br, bl];
}

function SpecialSurface({ mapping }: { mapping: SpecialMapping }) {
  const definition = getSpecial(mapping.kind);
  if (!definition) return null;
  const View = definition.View;
  const config = asConfig(mapping, definition.defaultConfig);
  const geometry = specialGeometry(mapping, definition.geometry ?? "quad");

  if (geometry !== "quad") {
    return (
      <div className="absolute inset-0">
        <View mapping={mapping} config={config} />
      </div>
    );
  }

  const quad = asQuad(mapping.vertices);
  if (!quad || !isValidWarpQuad(mapping.vertices)) return null;

  const { width, height } = definition.contentSize;

  return (
    <div
      className="absolute left-0 top-0"
      style={{
        width,
        height,
        transformOrigin: "0 0",
        transform: quadToMatrix3d(width, height, quad),
        overflow: "visible",
        opacity: mapping.color.a / 255,
      }}
    >
      <View mapping={mapping} config={config} />
    </div>
  );
}

export default function SpecialOverlays({ mappings }: { mappings: Mapping[] }) {
  const items = mappings.filter(isSpecialMapping);
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {items.map((mapping) => (
        <SpecialSurface key={mapping.id} mapping={mapping} />
      ))}
    </div>
  );
}
