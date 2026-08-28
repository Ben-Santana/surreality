import { getBundledDefinition } from "../customMappings/registry";
import { customMappingConfig } from "../customMappings/config";
import { type SpecialEvent } from "./types";
import { useRoomStore } from "../store";
import { isCustomMapping } from "../types";

type Listener = (event: SpecialEvent) => void;
const listeners = new Set<Listener>();

export function onCustomMappingEvent(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Common interaction boundary: mappings communicate by meaning, never imports. */
export function emitCustomMappingEvent(event: SpecialEvent) {
  for (const listener of listeners) listener(event);
  const mappings = useRoomStore.getState().mappings;
  const targets = event.targetId ? mappings.filter((item) => item.id === event.targetId) : mappings;
  for (const mapping of targets) {
    if (!isCustomMapping(mapping)) continue;
    const definition = getBundledDefinition(mapping.packageId);
    if (!definition?.onEvent) continue;
    definition.onEvent({
      mapping,
      config: customMappingConfig(mapping),
      event,
      emit: emitCustomMappingEvent,
    });
  }
}

/** Compatibility aliases for bundled mappings during the SDK migration. */
export const onSpecialEvent = onCustomMappingEvent;
export const emitSpecialEvent = emitCustomMappingEvent;
