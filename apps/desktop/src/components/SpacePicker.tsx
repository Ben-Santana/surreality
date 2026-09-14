import {
  Grid2X2,
  Package,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { spaceLabel, useRoomStore } from "../store";
import type { Mapping, Point, Space } from "../types";
import { showAuthDialog, useCloudState } from "../cloud";
import CommunityLibrary, { type LibraryTab } from "./CommunityLibrary";
import { UiButton, UiLabel } from "./ui/Chrome";

function relativeDate(timestamp: number) {
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function rgba(mapping: Mapping, alpha = 1) {
  const { r, g, b, a } = mapping.color;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(a, alpha)})`;
}

function pointsAttribute(points: Point[], project: (point: Point) => Point) {
  return points.map(project).map(({ x, y }) => `${x},${y}`).join(" ");
}

function SpaceThumbnail({ space }: { space: Space }) {
  const preview = useMemo(() => {
    const allPoints = [
      ...space.surfaces.flatMap((surface) => surface.vertices),
      ...space.mappings.flatMap((mapping) => mapping.vertices),
    ];
    if (allPoints.length === 0) return null;
    const xs = allPoints.map((point) => point.x);
    const ys = allPoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min(272 / width, 136 / height);
    const offsetX = 160 - width * scale / 2;
    const offsetY = 84 - height * scale / 2;
    const project = (point: Point) => ({
      x: offsetX + (point.x - minX) * scale,
      y: offsetY + (point.y - minY) * scale,
    });
    return { project };
  }, [space]);

  return (
    <div className="space-thumbnail relative h-full overflow-hidden bg-[#0a0a0c]">
      <div className="absolute inset-0 space-thumbnail-grid opacity-70" />
      {!preview ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative size-16 border border-white/8">
            <span className="absolute left-1/2 top-0 h-full w-px bg-white/6" />
            <span className="absolute left-0 top-1/2 h-px w-full bg-white/6" />
            <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 bg-accent/65" />
          </div>
        </div>
      ) : (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 168" aria-hidden="true">
          {space.surfaces.map((surface) => (
            <polygon key={surface.id} points={pointsAttribute(surface.vertices, preview.project)} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          ))}
          {space.mappings.map((mapping) => {
            if (mapping.type === "circle" && mapping.vertices.length >= 3) {
              const center = preview.project(mapping.vertices[0]!);
              const edge = preview.project(mapping.vertices[1]!);
              return <circle key={mapping.id} cx={center.x} cy={center.y} r={Math.max(2, Math.hypot(edge.x - center.x, edge.y - center.y))} fill={rgba(mapping, 0.86)} />;
            }
            return <polygon key={mapping.id} points={pointsAttribute(mapping.vertices, preview.project)} fill={rgba(mapping, 0.86)} stroke={rgba(mapping)} strokeWidth="0.75" />;
          })}
        </svg>
      )}
    </div>
  );
}

function SpaceCard({ space }: { space: Space }) {
  const loadSpace = useRoomStore((state) => state.loadSpace);
  const deleteSpace = useRoomStore((state) => state.deleteSpace);
  const renameSpace = useRoomStore((state) => state.renameSpace);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(spaceLabel(space));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const finishRename = () => {
    const nextName = name.trim();
    if (nextName) renameSpace(space.id, nextName);
    else setName(spaceLabel(space));
    setEditing(false);
  };

  return (
    <article className="ui-card group min-w-0">
      <div className="ui-card-media relative aspect-[1.9/1] overflow-hidden border border-white/10 bg-[#0c0c0f] transition duration-200">
        <button type="button" className="absolute inset-0 z-10 w-full text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent" aria-label={`Open ${spaceLabel(space)}`} onClick={() => loadSpace(space.id)} />
        <SpaceThumbnail space={space} />
        <div className="absolute right-2 top-2 z-20 flex translate-y-1 gap-1 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <button type="button" title={`Rename ${spaceLabel(space)}`} className="flex size-8 items-center justify-center border border-white/12 bg-black/75 text-white/65 backdrop-blur-md transition hover:border-accent/50 hover:bg-accent hover:text-white" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
          </button>
          <button type="button" title={`Delete ${spaceLabel(space)}`} className="flex size-8 items-center justify-center border border-white/12 bg-black/75 text-white/65 backdrop-blur-md transition hover:border-danger/50 hover:bg-danger hover:text-white" onClick={() => {
            if (window.confirm(`Delete space “${spaceLabel(space)}”?`)) deleteSpace(space.id);
          }}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="ui-card-body flex items-start justify-between gap-3 pt-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input ref={inputRef} value={name} maxLength={80} className="h-7 w-full border-b border-accent bg-transparent text-[14px] font-medium text-white outline-none" onChange={(event) => setName(event.target.value)} onBlur={finishRename} onKeyDown={(event) => {
              if (event.key === "Enter") finishRename();
              if (event.key === "Escape") { setName(spaceLabel(space)); setEditing(false); }
            }} />
          ) : (
            <button type="button" className="block max-w-full truncate text-left text-[14px] font-medium tracking-[0.01em] text-white transition" onClick={() => loadSpace(space.id)}>{spaceLabel(space)}</button>
          )}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30">Edited {relativeDate(space.updatedAt)}</p>
        </div>
      </div>
    </article>
  );
}

export default function SpacePicker() {
  const spaces = useRoomStore((state) => state.spaces);
  const createBlankSpace = useRoomStore((state) => state.createBlankSpace);
  const cloud = useCloudState();
  const [view, setView] = useState<"spaces" | LibraryTab>(() => {
    const requested = window.localStorage.getItem("surreality-library-view");
    if (requested === "downloads") return "installed";
    if (requested === "uploads") return "published";
    return requested === "discover" || requested === "saved" || requested === "installed" || requested === "published" || requested === "moderation" ? requested : "spaces";
  });
  const [hydrated, setHydrated] = useState(() => useRoomStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    return useRoomStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  const sorted = [...spaces].sort((left, right) => right.updatedAt - left.updatedAt);
  const selectCommunityTab = (tab: LibraryTab) => {
    window.localStorage.setItem("surreality-library-view", tab);
    setView(tab);
  };
  const packageView = view !== "spaces";

  return (
    <div className="workspace-shell pointer-events-auto absolute inset-0 z-40 flex overflow-hidden bg-[#08080a] text-white">
      <aside className="workspace-rail relative z-20 flex w-[224px] shrink-0 flex-col border-r border-white/8 bg-[#0c0c0f]">
        <div className="drag-region h-[72px] shrink-0 border-b border-white/8" />
        <nav className="flex-1 px-3 py-3 [&>button]:cursor-pointer" aria-label="Workspace">
          <button type="button" onClick={() => setView("spaces")} className={`workspace-nav-item ${view === "spaces" ? "workspace-nav-item-active" : ""}`}>
            <Grid2X2 className="size-4 shrink-0" />
            <span>My spaces</span>
            <span className="ml-auto font-mono text-[10px] text-white/30">{String(spaces.length).padStart(2, "0")}</span>
          </button>
          <button type="button" onClick={() => selectCommunityTab(packageView ? view : "discover")} className={`workspace-nav-item mt-1 ${packageView ? "workspace-nav-item-active" : ""}`}>
            <Package className="size-4 shrink-0" />
            <span>Packages</span>
          </button>
        </nav>
        <div className="border-t border-white/8 p-3">
          <button type="button" onClick={showAuthDialog} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.045]">
            <div className="flex size-8 shrink-0 items-center justify-center bg-white/[0.045] text-white/55"><UserRound className="size-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-white/72">{cloud.profile?.username ? `@${cloud.profile.username}` : cloud.user?.email ?? "Sign in"}</p><p className="mt-0.5 text-[10px] text-white/32">{cloud.user ? "Community account" : "Publish and keep history"}</p></div>
          </button>
        </div>
      </aside>

      <main className="workspace-main relative min-w-0 flex-1 overflow-hidden">
        <header className="workspace-topbar drag-region relative z-10 flex h-16 items-center justify-between border-b border-white/8 bg-[#08080a]/90 pl-7 pr-3.5 backdrop-blur-xl md:pl-10 md:pr-3.5">
          <UiLabel>{view === "spaces" ? "Your spaces" : "Packages"}</UiLabel>
          {view === "spaces" ? <UiButton tone="primary" type="button" className="no-drag flex h-9 items-center gap-2 px-4" onClick={createBlankSpace}>
            <Plus className="size-4" strokeWidth={2.5} /> Add space
          </UiButton> : null}
        </header>
        {view === "spaces" ? <div className="h-[calc(100vh-72px)] overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-7 pb-16 pt-10 md:px-10 lg:px-14 lg:pt-14">
            {!hydrated ? (
              <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {[0, 1, 2].map((item) => <div key={item} className="ui-card aspect-[1.9/1] animate-pulse" />)}
              </div>
            ) : sorted.length === 0 ? (
              <button type="button" onClick={createBlankSpace} className="ui-card ui-card-empty group flex aspect-[2.6/1] w-full max-w-3xl items-center justify-center transition">
                <div className="text-center"><span className="mx-auto flex size-11 items-center justify-center text-white/55 transition group-hover:text-accent"><Plus className="size-5" /></span><span className="mt-4 block text-[13px] font-medium text-white/70">Create your first space</span><span className="mt-1.5 block text-[11px] text-white/30">Start with a blank projection canvas</span></div>
              </button>
            ) : (
              <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {sorted.map((space) => <SpaceCard key={space.id} space={space} />)}
              </div>
            )}
          </div>
        </div> : <CommunityLibrary tab={view} onTabChange={selectCommunityTab} />}
      </main>
    </div>
  );
}
