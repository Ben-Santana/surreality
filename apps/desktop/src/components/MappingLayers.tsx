import { useMemo } from "react";
import { useCustomMappings } from "../customMappings/registry";
import type { CustomMapping, Mapping } from "../types";
import { isCustomMapping } from "../types";
import { CustomMappingSurface } from "./CustomMappingOverlays";
import MappingCanvas from "./MappingCanvas";

type MappingBand =
  | { kind: "canvas"; key: string; mappings: Mapping[] }
  | { kind: "custom"; key: string; mapping: CustomMapping };

export function buildMappingBands(mappings: Mapping[]): MappingBand[] {
  const bands: MappingBand[] = [];

  for (const mapping of mappings) {
    if (isCustomMapping(mapping)) {
      bands.push({ kind: "custom", key: `custom:${mapping.id}`, mapping });
      continue;
    }

    const previous = bands.at(-1);
    if (previous?.kind === "canvas") {
      previous.mappings.push(mapping);
      previous.key += `:${mapping.id}`;
    } else {
      bands.push({ kind: "canvas", key: `canvas:${mapping.id}`, mappings: [mapping] });
    }
  }

  return bands;
}

export default function MappingLayers({ mappings, edit = false }: { mappings: Mapping[]; edit?: boolean }) {
  useCustomMappings();
  const bands = useMemo(() => buildMappingBands(mappings), [mappings]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {bands.map((band, index) => (
        <div key={band.key} className="absolute inset-0 overflow-visible" style={{ zIndex: index }}>
          {band.kind === "canvas" ? (
            <MappingCanvas
              mappings={band.mappings}
              edit={edit}
              handles={false}
              transparent
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <>
              <MappingCanvas
                mappings={[band.mapping]}
                edit={edit}
                handles={false}
                transparent
                className="absolute inset-0 h-full w-full"
              />
              <CustomMappingSurface mapping={band.mapping} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
