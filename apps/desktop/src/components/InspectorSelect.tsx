import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Flyout, { eventInside } from "./Flyout";

export type InspectorSelectOption = { id: string; label: string };

export default function InspectorSelect({ value, options, onChange, ariaLabel }: {
  value: string;
  options: readonly InspectorSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!eventInside(event, anchorRef.current, menuRef.current)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const step = (direction: number) => {
    const current = Math.max(0, options.findIndex((option) => option.id === value));
    const next = options[(current + direction + options.length) % options.length];
    if (next) onChange(next.id);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            step(event.key === "ArrowDown" ? 1 : -1);
            setOpen(true);
          }
        }}
        className="panel-field no-drag flex h-9 w-full items-center justify-between gap-3 px-2 text-left text-[12px] outline-none hover:border-white/25 focus:border-accent"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <Flyout open={open} anchorRef={anchorRef} contentRef={menuRef} matchAnchorWidth offset={2}>
        <div role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto border border-white/15 bg-[#151519] p-1 shadow-2xl shadow-black/70">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onClick={() => { onChange(option.id); setOpen(false); anchorRef.current?.focus(); }}
              className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[12px] hover:bg-white/10 ${option.id === value ? "text-white" : "text-white/60"}`}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">{option.id === value ? <Check className="size-3.5 text-accent" /> : null}</span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      </Flyout>
    </>
  );
}
