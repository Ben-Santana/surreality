import { Check, MonitorUp, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DisplayInfo, Space, StartupPresentationSettings } from "../types";
import { spaceLabel } from "../store";
import { UiButton, UiLabel } from "./ui/Chrome";

const EMPTY: StartupPresentationSettings = { enabled: false, spaceId: null, display: null };

export default function StartupSettings({ spaces }: { spaces: Space[] }) {
  const [settings, setSettings] = useState<StartupPresentationSettings>(EMPTY);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDisplays = useCallback(() => {
    void window.room?.getDisplays().then(setDisplays);
  }, []);

  useEffect(() => {
    refreshDisplays();
    void window.room?.startup.getSettings().then((value) => {
      setSettings(value);
      setLoading(false);
    });
    return window.room?.startup.onDisplaysChanged(refreshDisplays);
  }, [refreshDisplays]);

  const selectedDisplay = useMemo(() => settings.display ? displays.find((display) =>
    display.label === settings.display?.label &&
    display.bounds.width === settings.display.width &&
    display.bounds.height === settings.display.height
  ) ?? null : null, [displays, settings.display]);

  const chooseDisplay = (id: string) => {
    const display = displays.find((item) => String(item.id) === id);
    setSaved(false);
    setSettings((current) => ({
      ...current,
      display: display ? {
        id: display.id,
        label: display.label,
        width: display.bounds.width,
        height: display.bounds.height,
      } : current.display,
    }));
  };

  const save = async () => {
    setError(null);
    if (settings.enabled && !settings.spaceId) {
      setError("Choose a space to present.");
      return;
    }
    if (settings.enabled && !settings.display) {
      setError("Choose a display to wait for.");
      return;
    }
    setSaving(true);
    try {
      const next = await window.room?.startup.setSettings(settings);
      if (next) setSettings(next);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save startup settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-[12px] text-white/35">Loading settings…</div>;

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-8 py-10 md:px-12 md:py-14">
        <div className="flex items-start gap-4 border-b border-white/8 pb-8">
          <div className="flex size-11 shrink-0 items-center justify-center bg-accent/10 text-accent"><MonitorUp className="size-5" /></div>
          <div>
            <h1 className="text-xl font-medium text-white">Startup presentation</h1>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-white/42">Launch Surreality when you log in, load a saved space, and present it fullscreen when the chosen display is connected.</p>
          </div>
        </div>

        <section className="py-8">
          <label className="flex cursor-pointer items-center justify-between gap-6 border border-white/10 bg-white/[0.018] p-5">
            <span><span className="block text-[13px] text-white/80">Launch and present at login</span><span className="mt-1 block text-[10px] leading-relaxed text-white/35">The app stays hidden in the background while the display is unavailable.</span></span>
            <button type="button" role="switch" aria-checked={settings.enabled} onClick={() => { setSaved(false); setSettings((current) => ({ ...current, enabled: !current.enabled })); }} className={`relative h-6 w-11 shrink-0 border transition ${settings.enabled ? "border-accent bg-accent" : "border-white/15 bg-black/40"}`}>
              <span className={`absolute left-0 top-0.5 size-4.5 bg-white transition-transform ${settings.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>

          <div className={`mt-7 space-y-6 transition ${settings.enabled ? "opacity-100" : "pointer-events-none opacity-35"}`}>
            <label className="block">
              <UiLabel>Space</UiLabel>
              <select value={settings.spaceId ?? ""} onChange={(event) => { setSaved(false); setSettings((current) => ({ ...current, spaceId: event.target.value || null })); }} className="panel-field mt-2 h-11 w-full px-3 text-[12px] text-white outline-none">
                <option value="">Choose a saved space</option>
                {[...spaces].sort((a, b) => a.name.localeCompare(b.name)).map((space) => <option key={space.id} value={space.id}>{spaceLabel(space)}</option>)}
              </select>
            </label>

            <label className="block">
              <div className="flex items-center justify-between"><UiLabel>Display</UiLabel><button type="button" onClick={refreshDisplays} className="flex items-center gap-1.5 text-[10px] text-white/35 hover:text-white"><RefreshCw className="size-3" />Refresh</button></div>
              <select value={selectedDisplay ? String(selectedDisplay.id) : settings.display ? "missing" : ""} onChange={(event) => chooseDisplay(event.target.value)} className="panel-field mt-2 h-11 w-full px-3 text-[12px] text-white outline-none">
                <option value="">Choose a connected display</option>
                {settings.display && !selectedDisplay ? <option value="missing">Waiting for {settings.display.label} · {settings.display.width}×{settings.display.height}</option> : null}
                {displays.map((display) => <option key={display.id} value={display.id}>{display.label} · {display.bounds.width}×{display.bounds.height}{display.primary ? " · main" : ""}</option>)}
              </select>
              <p className="mt-2 text-[10px] leading-relaxed text-white/30">If this display is disconnected, Surreality waits in the background. It will not fall back to another screen.</p>
            </label>
          </div>
        </section>

        {error ? <p className="mb-4 border border-danger/30 bg-danger/5 p-3 text-[11px] text-danger">{error}</p> : null}
        <div className="flex items-center justify-end gap-3 border-t border-white/8 pt-6">
          {saved ? <span className="flex items-center gap-1.5 text-[10px] text-white/40"><Check className="size-3 text-accent" />Saved</span> : null}
          <UiButton tone="primary" type="button" disabled={saving} onClick={() => void save()} className="h-9 px-5">{saving ? "Saving…" : "Save settings"}</UiButton>
        </div>
      </div>
    </div>
  );
}
