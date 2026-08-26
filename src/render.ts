import {
  HANDLE_RADIUS,
  contrastColor,
  isCircleGeometry,
  isValidWarpQuad,
  rgbaCss,
  visibleHandles,
  visibleSurfaceHandles,
} from "./geometry";
import { GRID_STEPS, type Mapping, type Point, type Rgba, type Surface, type TextMapping } from "./types";
import { textFont } from "./textFonts";
import { wallMetric, wallToScreenPoint } from "./wall";
import { getSpecial } from "./specials/registry";
import { specialGeometry } from "./specials/types";

const textCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>();

function fillPolygon(ctx: CanvasRenderingContext2D, vertices: Point[], color: Rgba) {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = vertices[0];
  if (!first) return;
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (vertex) ctx.lineTo(vertex.x, vertex.y);
  }
  ctx.closePath();
  ctx.fillStyle = rgbaCss(color);
  ctx.fill();
}

function drawEllipse(ctx: CanvasRenderingContext2D, mapping: Mapping) {
  const center = mapping.vertices[0];
  const rimU = mapping.vertices[1];
  const rimV = mapping.vertices[2];
  if (!center || !rimU || !rimV) return;
  const axisU = { x: rimU.x - center.x, y: rimU.y - center.y };
  const axisV = { x: rimV.x - center.x, y: rimV.y - center.y };
  ctx.save();
  ctx.transform(axisU.x, axisU.y, axisV.x, axisV.y, center.x, center.y);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = rgbaCss(mapping.color);
  ctx.fill();
  ctx.restore();
}

function quadRasterSize(vertices: Point[], pixelRatio: number) {
  const [tl, tr, br, bl] = vertices;
  if (!tl || !tr || !br || !bl) return { width: 1, height: 1 };
  const width = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
  const height = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));
  const scale = Math.min(pixelRatio, 4096 / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.ceil(width * scale)),
    height: Math.max(1, Math.ceil(height * scale)),
  };
}

function textCacheKey(mapping: TextMapping, width: number, height: number) {
  const { text, fontFamily, color } = mapping;
  return `${text}|${fontFamily ?? "chakra"}|${width}x${height}|${color.r},${color.g},${color.b},${color.a}`;
}

function buildTextContent(mapping: TextMapping, pixelRatio: number): HTMLCanvasElement {
  const { width, height } = quadRasterSize(mapping.vertices, pixelRatio);
  const cached = textCache.get(mapping.id);
  const key = textCacheKey(mapping, width, height);
  if (cached?.key === key) return cached.canvas;

  const textColor = contrastColor(mapping.color);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const font = textFont(mapping.fontFamily);
  const horizontalPadding = width * 0.12;
  const availableWidth = Math.max(1, width - horizontalPadding * 2);
  let fontSize = Math.max(1, height * 0.52);
  ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
  ctx.letterSpacing = `${font.tracking}em`;
  const metrics = ctx.measureText(mapping.text);
  if (metrics.width > availableWidth) fontSize *= availableWidth / metrics.width;
  ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
  ctx.letterSpacing = `${font.tracking}em`;
  ctx.fillStyle = rgbaCss(mapping.color);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = rgbaCss(textColor);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(mapping.text, canvas.width / 2, canvas.height / 2);
  textCache.set(mapping.id, { key, canvas });
  return canvas;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function warpToQuad(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  corners: Point[],
) {
  const [tl, tr, br, bl] = corners;
  if (!tl || !tr || !br || !bl) return;
  const steps = Math.max(
    Math.ceil(Math.hypot(tl.x - bl.x, tl.y - bl.y)),
    Math.ceil(Math.hypot(tr.x - br.x, tr.y - br.y)),
    1,
  );

  for (let step = 0; step < steps; step += 1) {
    const v0 = step / steps;
    const v1 = (step + 1) / steps;
    const srcY = Math.min(source.height - 1, Math.floor(v0 * source.height));
    const srcH = Math.max(
      1,
      Math.min(source.height - srcY, Math.floor(v1 * source.height) - srcY),
    );
    const left = lerp(tl, bl, v0);
    const right = lerp(tr, br, v0);
    const nextLeft = lerp(tl, bl, v1);
    const nextRight = lerp(tr, br, v1);
    const spanX = right.x - left.x;
    const spanY = right.y - left.y;
    const length = Math.max(1, Math.hypot(spanX, spanY));
    const thickness = Math.max(
      1,
      (Math.hypot(nextLeft.x - left.x, nextLeft.y - left.y) +
        Math.hypot(nextRight.x - right.x, nextRight.y - right.y)) /
        2 +
        1,
    );
    ctx.save();
    ctx.translate((left.x + right.x) / 2, (left.y + right.y) / 2);
    ctx.rotate(Math.atan2(spanY, spanX));
    ctx.drawImage(
      source,
      0,
      srcY,
      source.width,
      srcH,
      -length / 2,
      -thickness / 2,
      length,
      thickness,
    );
    ctx.restore();
  }
}

function drawText(ctx: CanvasRenderingContext2D, mapping: TextMapping) {
  const pixelRatio = Math.max(1, ctx.getTransform().a || 1);
  const content = buildTextContent(mapping, pixelRatio);
  warpToQuad(ctx, content, mapping.vertices);
}

function drawHandles(ctx: CanvasRenderingContext2D, mapping: Mapping, selected: boolean) {
  if (isCircleGeometry(mapping)) {
    const center = mapping.vertices[0];
    const rimU = mapping.vertices[1];
    const rimV = mapping.vertices[2];
    if (center && rimU && rimV) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(rimU.x, rimU.y);
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(rimV.x, rimV.y);
      ctx.stroke();
    }
  }

  drawHandleHits(ctx, visibleHandles(mapping), selected);
}

function drawHandleHits(
  ctx: CanvasRenderingContext2D,
  handles: ReturnType<typeof visibleHandles>,
  selected: boolean,
) {
  for (const handle of handles) {
    if (handle.kind === "anchor") {
      const size = HANDLE_RADIUS * 2;
      ctx.save();
      ctx.translate(handle.point.x, handle.point.y);
      ctx.fillStyle = selected ? "rgba(255,255,255,0.16)" : "transparent";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-HANDLE_RADIUS, -HANDLE_RADIUS, size, size);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.beginPath();
    ctx.rect(handle.point.x - HANDLE_RADIUS, handle.point.y - HANDLE_RADIUS, HANDLE_RADIUS * 2, HANDLE_RADIUS * 2);
    ctx.strokeStyle = selected ? "#ff5314" : "white";
    ctx.lineWidth = 2;
    ctx.fillStyle = selected ? "rgba(255,83,20,0.18)" : "transparent";
    ctx.fill();
    ctx.stroke();
  }
}

function drawQuadOutline(ctx: CanvasRenderingContext2D, vertices: Point[]) {
  if (vertices.length < 2) return;
  const first = vertices[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (vertex) ctx.lineTo(vertex.x, vertex.y);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawInvalidQuad(ctx: CanvasRenderingContext2D, vertices: Point[]) {
  ctx.beginPath();
  if (!pathPolygon(ctx, vertices)) return;
  ctx.fillStyle = "rgba(244, 132, 140, 0.18)";
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(244, 176, 180, 0.95)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

function pathPolygon(ctx: CanvasRenderingContext2D, vertices: Point[]) {
  const first = vertices[0];
  if (!first || vertices.length < 3) return false;
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index += 1) {
    const vertex = vertices[index];
    if (vertex) ctx.lineTo(vertex.x, vertex.y);
  }
  ctx.closePath();
  return true;
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, step: number) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSurfaceGrid(ctx: CanvasRenderingContext2D, surface: Surface, step: number) {
  if (step <= 0 || !isValidWarpQuad(surface.vertices)) return;
  const { width, height } = wallMetric(surface);
  if (width < 1 || height < 1) return;

  ctx.save();
  ctx.beginPath();
  if (!pathPolygon(ctx, surface.vertices)) {
    ctx.restore();
    return;
  }
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  for (let x = step; x < width - 0.5; x += step) {
    const top = wallToScreenPoint(surface, { x, y: 0 });
    const bottom = wallToScreenPoint(surface, { x, y: height });
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
  }
  for (let y = step; y < height - 0.5; y += step) {
    const left = wallToScreenPoint(surface, { x: 0, y });
    const right = wallToScreenPoint(surface, { x: width, y });
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSurface(
  ctx: CanvasRenderingContext2D,
  surface: Surface,
  selected: boolean,
  dropTarget: boolean,
  gridStep?: number,
) {
  const vertices = surface.vertices;
  if (vertices.length < 3) return;
  const invalid = !isValidWarpQuad(vertices);
  if (invalid) {
    drawInvalidQuad(ctx, vertices);
  } else {
    ctx.beginPath();
    if (!pathPolygon(ctx, vertices)) return;
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.fillStyle = dropTarget
      ? "rgba(255, 83, 20, 0.16)"
      : selected
        ? "rgba(255, 83, 20, 0.10)"
        : "rgba(255, 255, 255, 0.05)";
    ctx.fill();
    if (gridStep) drawSurfaceGrid(ctx, surface, gridStep);
    ctx.beginPath();
    pathPolygon(ctx, vertices);
    ctx.strokeStyle =
      dropTarget || selected ? "rgba(255, 83, 20, 0.95)" : "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = dropTarget ? 2 : selected ? 1.75 : 1.25;
    if (!dropTarget) ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const labelAt = vertices[0];
  if (labelAt) {
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = invalid
      ? "rgba(244, 176, 180, 0.95)"
      : dropTarget || selected
        ? "rgba(255, 180, 150, 0.95)"
        : "rgba(255,255,255,0.55)";
    ctx.fillText(surface.name, labelAt.x + 10, labelAt.y + 18);
  }
}

function drawEditHandles(
  ctx: CanvasRenderingContext2D,
  mappings: Mapping[],
  surfaces: Surface[],
  selectedId: string | null,
) {
  for (const mapping of mappings) {
    const selected = mapping.id === selectedId;
    if (selected) {
      ctx.save();
      ctx.shadowColor = "rgba(110, 231, 255, 0.35)";
      ctx.shadowBlur = 18;
    }
    drawHandles(ctx, mapping, selected);
    if (selected) ctx.restore();
  }

  for (const surface of surfaces) {
    const selected = surface.id === selectedId;
    if (selected) {
      ctx.save();
      ctx.shadowColor = "rgba(255, 83, 20, 0.35)";
      ctx.shadowBlur = 16;
    }
    drawHandleHits(ctx, visibleSurfaceHandles(surface), selected);
    if (selected) ctx.restore();
  }
}

export function renderHandles(
  ctx: CanvasRenderingContext2D,
  mappings: Mapping[],
  options: {
    width: number;
    height: number;
    selectedId: string | null;
    surfaces?: Surface[];
  },
) {
  ctx.clearRect(0, 0, options.width, options.height);
  drawEditHandles(ctx, mappings, options.surfaces ?? [], options.selectedId);
}

export function renderStage(
  ctx: CanvasRenderingContext2D,
  mappings: Mapping[],
  options: {
    width: number;
    height: number;
    edit: boolean;
    selectedId: string | null;
    dropTargetId?: string | null;
    grid: boolean;
    gridStep?: number;
    surfaces?: Surface[];
    handles?: boolean;
  },
) {
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, options.width, options.height);

  const surfaces = options.surfaces ?? [];
  const gridStep = options.gridStep ?? GRID_STEPS.medium;
  if (options.grid) drawGrid(ctx, options.width, options.height, gridStep);

  if (options.edit) {
    for (const surface of surfaces) {
      drawSurface(
        ctx,
        surface,
        surface.id === options.selectedId,
        surface.id === options.dropTargetId,
        options.grid ? gridStep : undefined,
      );
    }
  }

  for (const mapping of mappings) {
    if (isCircleGeometry(mapping)) drawEllipse(ctx, mapping);
    else if (mapping.type === "text") drawText(ctx, mapping);
    else if (mapping.type === "special" && specialGeometry(mapping, getSpecial(mapping.kind)?.geometry) !== "polygon") {
      if (options.edit) {
        if (!isValidWarpQuad(mapping.vertices)) drawInvalidQuad(ctx, mapping.vertices);
        else drawQuadOutline(ctx, mapping.vertices);
      }
    } else fillPolygon(ctx, mapping.vertices, mapping.color);
  }

  if (!options.edit || options.handles === false) return;
  drawEditHandles(ctx, mappings, surfaces, options.selectedId);
}
