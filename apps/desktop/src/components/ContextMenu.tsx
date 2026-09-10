import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Frame,
  Film,
  Palette,
  Pentagon,
  Plus,
  Shapes,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CORE_MEDIA_PACKAGE_ID } from "../customMappings/registry";
import { useRoomStore } from "../store";
import ColorPicker from "./ColorPicker";
import { isPolygonGeometry } from "../geometry";

const ITEM = 32;
const PAD = 4;
const MENU_WIDTH = 232;
const MENU_PANEL =
  "editor-panel pointer-events-auto absolute overflow-hidden rounded-none border border-white/10 bg-[#111114] p-1 text-white shadow-2xl";

type Item = {
  label: string;
  icon: ReactNode;
  action?: () => void;
  children?: Item[];
  danger?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function ContextMenu() {
  const menu = useRoomStore((state) => state.contextMenu);
  const mappings = useRoomStore((state) => state.mappings);
  const surfaces = useRoomStore((state) => state.surfaces);
  const closeMenu = useRoomStore((state) => state.closeMenu);
  const setColorMode = useRoomStore((state) => state.setColorMode);
  const setTool = useRoomStore((state) => state.setTool);
  const addCircle = useRoomStore((state) => state.addCircle);
  const addText = useRoomStore((state) => state.addText);
  const addSurface = useRoomStore((state) => state.addSurface);
  const addCustomMapping = useRoomStore((state) => state.addCustomMapping);
  const deleteMapping = useRoomStore((state) => state.deleteMapping);
  const deleteSurface = useRoomStore((state) => state.deleteSurface);
  const addVertexNear = useRoomStore((state) => state.addVertexNear);
  const bringForward = useRoomStore((state) => state.bringForward);
  const bringBack = useRoomStore((state) => state.bringBack);
  const sendToFront = useRoomStore((state) => state.sendToFront);
  const sendToBack = useRoomStore((state) => state.sendToBack);
  const setColor = useRoomStore((state) => state.setColor);
  const [submenu, setSubmenu] = useState<number | null>(null);

  const mapping = mappings.find((item) => item.id === menu?.mappingId) ?? null;
  const surface = surfaces.find((item) => item.id === menu?.surfaceId) ?? null;

  const items = useMemo<Item[]>(() => {
    if (!menu) return [];
    if (!mapping && surface) {
      return [
        {
          label: "Delete surface",
          icon: <Trash2 className="size-4" />,
          danger: true,
          action: () => deleteSurface(surface.id),
        },
      ];
    }
    if (!mapping) {
      const at = { x: menu.canvasX, y: menu.canvasY };
      return [
        {
          label: "Add surface",
          icon: <Frame className="size-4" />,
          action: () => addSurface(at),
        },
        {
          label: "Add polygon",
          icon: <Pentagon className="size-4" />,
          action: () => setTool("polygon"),
        },
        {
          label: "Add circle",
          icon: <Circle className="size-4" />,
          action: () => addCircle(at),
        },
        {
          label: "Add text",
          icon: <Type className="size-4" />,
          action: () => addText(at),
        },
        {
          label: "Add media",
          icon: <Film className="size-4" />,
          action: () => addCustomMapping(CORE_MEDIA_PACKAGE_ID, at),
        },
        {
          label: "Browse custom mappings",
          icon: <Shapes className="size-4" />,
          action: () => window.dispatchEvent(new Event("surreality-open-custom-mappings")),
        },
      ];
    }

    const list: Item[] = [];
    list.push({
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      danger: true,
      action: () => deleteMapping(mapping.id),
    });
    if (isPolygonGeometry(mapping)) {
      list.push({
        label: "Add vertex",
        icon: <Plus className="size-4" />,
        action: () => addVertexNear(mapping.id, { x: menu.canvasX, y: menu.canvasY }),
      });
    }
    list.push({
      label: "Change color",
      icon: <Palette className="size-4" />,
      action: () => setColorMode(true),
    });
    list.push({
      label: "Positioning",
      icon: <ChevronsUp className="size-4" />,
      children: [
        {
          label: "Bring forward",
          icon: <ArrowUp className="size-4" />,
          action: () => bringForward(mapping.id),
        },
        {
          label: "Bring back",
          icon: <ArrowDown className="size-4" />,
          action: () => bringBack(mapping.id),
        },
        {
          label: "Send to front",
          icon: <ChevronsUp className="size-4" />,
          action: () => sendToFront(mapping.id),
        },
        {
          label: "Send to back",
          icon: <ChevronsDown className="size-4" />,
          action: () => sendToBack(mapping.id),
        },
      ],
    });
    return list;
  }, [
    addCircle,
    addCustomMapping,
    addSurface,
    addText,
    addVertexNear,
    bringBack,
    bringForward,
    deleteMapping,
    deleteSurface,
    mapping,
    menu,
    sendToBack,
    sendToFront,
    setTool,
    setColorMode,
    surface,
  ]);

  useEffect(() => {
    setSubmenu(null);
  }, [menu?.x, menu?.y, menu?.mappingId, menu?.surfaceId, menu?.colorMode]);

  if (!menu) return null;

  const height = menu.colorMode ? 360 : items.length * ITEM + PAD * 2;
  const left = clamp(menu.x, 8, window.innerWidth - MENU_WIDTH - 8);
  const top = clamp(menu.y, 8, window.innerHeight - height - 8);
  const subLeft =
    left + MENU_WIDTH + 6 + MENU_WIDTH < window.innerWidth
      ? left + MENU_WIDTH - 4
      : left - MENU_WIDTH + 4;

  return (
    <div className="fixed inset-0 z-50" onPointerDown={closeMenu}>
      <div
        className={MENU_PANEL}
        style={{ left, top, width: MENU_WIDTH }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {menu.colorMode && mapping ? (
          <div className="p-3">
            <p className="chrome-label mb-2">Color</p>
            <ColorPicker
              compact
              color={mapping.color}
              onChange={(color) => setColor(mapping.id, color)}
            />
          </div>
        ) : (
          items.map((item, index) => (
            <MenuRow
              key={item.label}
              item={item}
              hovered={submenu === index}
              onHover={() => setSubmenu(item.children ? index : null)}
              onClick={() => {
                item.action?.();
                if (!item.children && item.label !== "Change color") closeMenu();
              }}
            />
          ))
        )}
      </div>

      {submenu != null && items[submenu]?.children && !menu.colorMode ? (
        <div
          className={MENU_PANEL}
          style={{
            left: subLeft,
            top: top + PAD + submenu * ITEM,
            width: MENU_WIDTH,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {items[submenu]?.children?.map((child) => (
            <MenuRow
              key={child.label}
              item={child}
              onClick={() => {
                child.action?.();
                closeMenu();
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({
  item,
  hovered,
  onHover,
  onClick,
}: {
  item: Item;
  hovered?: boolean;
  onHover?: () => void;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[13px] transition ${
        item.danger
          ? hovered
            ? "bg-danger/15 text-danger"
            : "text-danger hover:bg-danger/15"
          : hovered
            ? "bg-accent/15 text-accent"
            : "text-white hover:bg-white/10"
      }`}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <span className="text-current opacity-80">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.children ? <span className="text-white/35">›</span> : null}
    </button>
  );
}
