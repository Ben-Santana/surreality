import { useSyncExternalStore } from "react";
import { useRoomStore } from "./store";

function subscribe(listener: () => void) {
  const stopHydrating = useRoomStore.persist.onHydrate(listener);
  const stopHydrated = useRoomStore.persist.onFinishHydration(listener);
  return () => {
    stopHydrating();
    stopHydrated();
  };
}

function getSnapshot() {
  return useRoomStore.persist.hasHydrated();
}

export function useRoomStoreHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
