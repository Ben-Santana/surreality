import { ArrowLeft, Box, PackagePlus, Shapes, Store, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CORE_MEDIA_PACKAGE_ID,
  importCustomMappingPackage,
  uninstallCustomMappingPackage,
  useCustomMappings,
} from "../customMappings/registry";
import { useRoomStore } from "../store";

export default function CustomMappingBrowser({ onBack }: { onBack: () => void }) {
  const packages = useCustomMappings().filter(({ manifest }) => manifest.id !== CORE_MEDIA_PACKAGE_ID);
  const selectedPackageId = useRoomStore((state) => state.customMappingPackageId);
  const setCustomMappingPackage = useRoomStore((state) => state.setCustomMappingPackage);
  const setTool = useRoomStore((state) => state.setTool);
  const [importing, setImporting] = useState(false);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onBack();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onBack]);

  const showNotice = (tone: "success" | "error", message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const importPackage = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importCustomMappingPackage();
      if (result && !result.canceled) {
        showNotice("success", `${result.installed.manifest.name} ${result.installed.manifest.version} installed.`);
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "The custom mapping could not be installed.");
    } finally {
      setImporting(false);
    }
  };

  const uninstallPackage = async (packageId: string, packageVersion: string, name: string) => {
    const key = `${packageId}@${packageVersion}`;
    if (uninstalling) return;
    setUninstalling(key);
    try {
      const result = await uninstallCustomMappingPackage(packageId, packageVersion);
      if (result.removed) {
        if (selectedPackageId === packageId) setTool("select");
        showNotice("success", `${name} ${packageVersion} uninstalled.`);
      }
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "The custom mapping could not be uninstalled.");
    } finally {
      setUninstalling(null);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-transparent">
      {notice ? (
        <div role="status" className={`absolute right-4 top-4 z-10 px-3 py-2 text-[11px] ${notice.tone === "success" ? "bg-emerald-950/90 text-emerald-100" : "bg-red-950/90 text-red-100"}`}>
          {notice.message}
        </div>
      ) : null}

      <header className="flex shrink-0 items-center px-5 pb-2 pt-5">
        <button type="button" onClick={onBack} className="flex h-7 items-center gap-1.5 text-[10px] text-white/45 transition hover:text-white" aria-label="Back to editor">
          <ArrowLeft className="size-3.5" />
          Back
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" disabled={importing} onClick={() => void importPackage()} className="flex h-7 items-center gap-1.5 px-2 text-[9px] text-white/50 transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50">
            <PackagePlus className="size-3" />
            {importing ? "Opening…" : "Import"}
          </button>
          <button type="button" onClick={() => window.room?.community.open()} className="flex h-7 items-center gap-1.5 px-2 text-[9px] text-white/50 transition hover:bg-white/5 hover:text-white">
            <Store className="size-3" />
            Browse
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
        {packages.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-3">
            {packages.map((item) => {
              const key = `${item.manifest.id}@${item.manifest.version}`;
              const Icon = item.definition?.icon ?? Box;
              const active = selectedPackageId === item.manifest.id;
              return (
                <article key={key} className={`group relative flex min-h-36 flex-col transition ${active ? "bg-accent/[0.07]" : "hover:bg-white/[0.035]"}`}>
                  <button type="button" className="flex min-h-0 flex-1 flex-col p-4 text-left" onClick={() => { setCustomMappingPackage(item.manifest.id); onBack(); }}>
                    <span className={`flex size-9 items-center justify-center ${active ? "text-accent" : "text-white/50"}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-4 flex w-full items-baseline justify-between gap-3">
                      <strong className="truncate text-[13px] font-medium text-white">{item.manifest.name}</strong>
                      <span className="shrink-0 font-mono text-[8px] text-white/25">v{item.manifest.version}</span>
                    </span>
                    <span className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-white/40">{item.manifest.description || "No description provided."}</span>
                    <span className="mt-auto pt-3 font-mono text-[8px] uppercase tracking-[0.13em] text-white/25">{item.manifest.geometry}</span>
                  </button>
                  <button type="button" title={`Uninstall ${item.manifest.name}`} aria-label={`Uninstall ${item.manifest.name}`} disabled={uninstalling === key} onClick={() => void uninstallPackage(item.manifest.id, item.manifest.version, item.manifest.name)} className="absolute right-2 top-2 flex size-8 items-center justify-center text-white/25 opacity-0 transition hover:bg-red-500/15 hover:text-red-300 focus:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-40">
                    <Trash2 className="size-3.5" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Shapes className="size-6 text-white/25" />
            <p className="mt-3 text-[12px] text-white/65">No custom mappings installed</p>
            <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-white/30">Import a local package or browse mappings made by the community.</p>
          </div>
        )}
      </div>

    </section>
  );
}
