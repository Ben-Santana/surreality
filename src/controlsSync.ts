import { useEffect } from "react";
import { useRoomStore } from "./store";

let applyingRemoteState = false;

function snapshot() {
  return Object.fromEntries(
    Object.entries(useRoomStore.getState()).filter(([, value]) => typeof value !== "function"),
  );
}

export function useControlsSync(role: "editor" | "controls" | null) {
  useEffect(() => {
    if (!role) return;
    const channel = new BroadcastChannel("projection-mapping-room-controls");
    let ready = role === "editor";
    const apply = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      applyingRemoteState = true;
      useRoomStore.setState(payload as Partial<ReturnType<typeof useRoomStore.getState>>);
      applyingRemoteState = false;
      ready = true;
    };
    const publish = () => {
      const state = snapshot();
      channel.postMessage({ type: "state", source: role, state });
      window.room?.syncControls(state);
    };
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as { type?: string; source?: string; state?: unknown } | null;
      if (!message || message.source === role) return;
      if (message.type === "request" && role === "editor") publish();
      if (message.type === "state") apply(message.state);
    };
    const offSync = window.room?.onControlsSync(apply);
    const offStore = useRoomStore.subscribe(() => {
      if (ready && !applyingRemoteState) publish();
    });
    if (role === "editor") publish();
    else {
      channel.postMessage({ type: "request", source: role });
      void window.room?.getControlsState().then(apply);
    }
    return () => {
      channel.close();
      offSync?.();
      offStore();
    };
  }, [role]);
}
