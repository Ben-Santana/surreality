import { getSpecial } from "./registry";
import { definitionConfig, type SpecialEvent } from "./types";
import { useRoomStore } from "../store";
import { isSpecialMapping } from "../types";

type Listener = (event: SpecialEvent) => void;
const listeners = new Set<Listener>();

export function onSpecialEvent(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Common interaction boundary: mappings communicate by meaning, never imports. */
export function emitSpecialEvent(event: SpecialEvent) {
  for (const listener of listeners) listener(event);
  const mappings = useRoomStore.getState().mappings;
  const targets = event.targetId ? mappings.filter((item) => item.id === event.targetId) : mappings;
  for (const mapping of targets) {
    if (!isSpecialMapping(mapping)) continue;
    const definition = getSpecial(mapping.kind);
    if (!definition?.onEvent) continue;
    definition.onEvent({
      mapping,
      config: definitionConfig(definition, mapping),
      event,
      emit: emitSpecialEvent,
    });
  }
}
