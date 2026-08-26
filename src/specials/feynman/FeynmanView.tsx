import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import attentif from "./assets/bloub-hexagone-attentif-rouge-anime.svg?raw";
import confus from "./assets/bloub-hexagone-confus-rouge-anime.svg?raw";
import excite from "./assets/bloub-hexagone-excite-rouge-anime.svg?raw";
import mefiant from "./assets/bloub-hexagone-mefiant-rouge-anime.svg?raw";
import neutre from "./assets/bloub-hexagone-neutre-rouge-anime.svg?raw";
import { rgbaCss } from "../../geometry";
import type { SpecialViewProps } from "../types";
import type { FeynmanConfig, FeynmanShape } from "./config";
import "./feynman.css";

const MORPH_MS = 520

type Matrix = [number, number, number, number, number, number]
type Frame = { t: number; matrix: Matrix }

type Eye = {
  values: number[]
  frames: Frame[]
}

type Emotion = {
  id: EmotionId
  label: string
  eye0: Eye
  eye1: Eye
}

type Pose = {
  eye0: { values: number[]; matrix: Matrix }
  eye1: { values: number[]; matrix: Matrix }
}

const emotionSources = [
  { id: 'neutral', label: 'Neutral', svg: neutre },
  { id: 'attentive', label: 'Attentive', svg: attentif },
  { id: 'confused', label: 'Confused', svg: confus },
  { id: 'wary', label: 'Wary', svg: mefiant },
  { id: 'excited', label: 'Excited', svg: excite },
] as const

type EmotionId = (typeof emotionSources)[number]['id']

function pathNumberRe() {
  return /-?\d*\.?\d+(?:e[-+]?\d+)?/gi
}

function parsePathValues(d: string) {
  return [...d.matchAll(pathNumberRe())].map((match) => Number(match[0]))
}

function parseKeyframes(style: string, name: string): Frame[] {
  const block = style.match(
    new RegExp(
      `@keyframes ${name}\\{((?:[\\d.]+%\\{transform:matrix\\([^)]+\\)\\})+)\\}`,
    ),
  )?.[1]

  if (!block) return []

  return [...block.matchAll(/([\d.]+)%\{transform:matrix\(([^)]+)\)\}/g)].map(
    (match) => ({
      t: Number(match[1]) / 100,
      matrix: (match[2] ?? "1,0,0,1,0,0").split(",").map(Number) as Matrix,
    }),
  )
}

function parseBloubSvg(svg: string) {
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1])
  const style = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
  const duration = Number(style.match(/animation-duration:([\d.]+)s/)?.[1] ?? 2.967)

  return {
    body: paths[0] ?? '',
    durationMs: duration * 1000,
    eye0: { values: parsePathValues(paths[1] ?? ''), frames: parseKeyframes(style, 'oeil0') },
    eye1: { values: parsePathValues(paths[2] ?? ''), frames: parseKeyframes(style, 'oeil1') },
  }
}

const parsedNeutral = parseBloubSvg(neutre)
const bodyPath = parsedNeutral.body
const idleMs = parsedNeutral.durationMs
const pathTemplate = (neutre.match(/<path d="([^"]+)" class="oeil0"/)?.[1] ?? '').split(
  pathNumberRe(),
)
const bodyTemplate = bodyPath.split(pathNumberRe())
const hexagonValues = parsePathValues(bodyPath)
const bodyRadius = averageRadius(hexagonValues)
const ballValues = radialProject(hexagonValues, 20)

const SHAPE_SPEC: Record<Exclude<FeynmanShape, "circle" | "hexagon">, { sides: number; rotation: number }> = {
  triangle: { sides: 3, rotation: -Math.PI / 2 },
  square: { sides: 4, rotation: Math.PI / 4 },
  pentagon: { sides: 5, rotation: -Math.PI / 2 },
  octagon: { sides: 8, rotation: Math.PI / 8 },
}

function averageRadius(values: number[]) {
  let sum = 0
  let count = 0
  for (let i = 0; i + 1 < values.length; i += 2) {
    sum += Math.hypot(values[i] ?? 0, values[i + 1] ?? 0)
    count += 1
  }
  return count === 0 ? 94 : sum / count
}

function polygonRadiusAt(sides: number, angle: number, radius: number, rotation: number) {
  const sector = (Math.PI * 2) / sides
  const theta = angle - rotation
  const local = theta - sector * Math.round(theta / sector)
  return (radius * Math.cos(Math.PI / sides)) / Math.cos(local)
}

function remapToPolygon(values: number[], sides: number, radius: number, rotation: number, sharpness = 0.9) {
  const projected = values.slice()
  for (let i = 0; i + 1 < projected.length; i += 2) {
    const x = projected[i] ?? 0
    const y = projected[i + 1] ?? 0
    const angle = Math.atan2(y, x)
    const polyR = polygonRadiusAt(sides, angle, radius, rotation)
    const r = lerp(radius, polyR, sharpness)
    projected[i] = Math.cos(angle) * r
    projected[i + 1] = Math.sin(angle) * r
  }
  return projected
}

const bodyByShape: Record<FeynmanShape, number[]> = {
  circle: radialProject(hexagonValues, bodyRadius),
  triangle: remapToPolygon(hexagonValues, SHAPE_SPEC.triangle.sides, bodyRadius, SHAPE_SPEC.triangle.rotation),
  square: remapToPolygon(hexagonValues, SHAPE_SPEC.square.sides, bodyRadius, SHAPE_SPEC.square.rotation),
  pentagon: remapToPolygon(hexagonValues, SHAPE_SPEC.pentagon.sides, bodyRadius, SHAPE_SPEC.pentagon.rotation),
  hexagon: hexagonValues,
  octagon: remapToPolygon(hexagonValues, SHAPE_SPEC.octagon.sides, bodyRadius, SHAPE_SPEC.octagon.rotation),
}

function bodyForShape(shape: FeynmanShape) {
  return bodyByShape[shape] ?? hexagonValues
}

const BURST_POP_MS = 280
const BURST_EXPAND_START = 1080
const BURST_EXPAND_END = 1880
const BURST_EYES_START = 1280
const BURST_DONE_MS = 2000
const HIDDEN_EYE: Matrix = [0.001, 0, 0, 0.001, 0, 0]

const BURST_PARTICLES = [
  { delay: 240, duration: 640, angle: -0.38, dist: 88, radius: 10 },
  { delay: 340, duration: 600, angle: 0.72, dist: 76, radius: 8 },
  { delay: 420, duration: 680, angle: 2.05, dist: 98, radius: 7 },
  { delay: 520, duration: 560, angle: 3.42, dist: 82, radius: 9 },
  { delay: 600, duration: 620, angle: 4.55, dist: 70, radius: 6 },
  { delay: 700, duration: 540, angle: 5.55, dist: 92, radius: 8 },
] as const

const emotions: Emotion[] = emotionSources.map(({ id, label, svg }) => {
  const parsed = parseBloubSvg(svg)
  return { id, label, eye0: parsed.eye0, eye1: parsed.eye1 }
})

const emotionsById = Object.fromEntries(emotions.map((emotion) => [emotion.id, emotion])) as Record<
  EmotionId,
  Emotion
>

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpValues(from: number[], to: number[], t: number) {
  const count = Math.min(from.length, to.length)
  const values = new Array<number>(count)
  for (let i = 0; i < count; i += 1) values[i] = lerp(from[i] ?? 0, to[i] ?? 0, t)
  return values
}

function lerpMatrix(from: Matrix, to: Matrix, t: number): Matrix {
  return [
    lerp(from[0], to[0], t),
    lerp(from[1], to[1], t),
    lerp(from[2], to[2], t),
    lerp(from[3], to[3], t),
    lerp(from[4], to[4], t),
    lerp(from[5], to[5], t),
  ]
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function easeInCubic(t: number) {
  return t * t * t
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}

function formatPathNumber(n: number) {
  const rounded = Math.round(n * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function valuesToPath(values: number[], template: string[] = pathTemplate) {
  let path = template[0] ?? ''
  for (let i = 0; i < values.length; i += 1) {
    path += formatPathNumber(values[i] ?? 0) + (template[i + 1] ?? '')
  }
  return path
}

function radialProject(values: number[], radius: number) {
  const projected = values.slice()
  for (let i = 0; i + 1 < projected.length; i += 2) {
    const x = projected[i] ?? 0
    const y = projected[i + 1] ?? 0
    const length = Math.hypot(x, y)
    if (length < 1e-6) continue
    const scale = radius / length
    projected[i] = x * scale
    projected[i + 1] = y * scale
  }
  return projected
}

function matrixCss(matrix: Matrix) {
  return `matrix(${matrix.join(', ')})`
}

function sampleMatrix(frames: Frame[], t: number): Matrix {
  if (frames.length === 0) return [1, 0, 0, 1, 0, 0]
  if (t <= (frames[0]?.t ?? 0)) return frames[0]?.matrix ?? [1, 0, 0, 1, 0, 0]
  const last = frames[frames.length - 1]
  if (!last || t >= last.t) return last?.matrix ?? [1, 0, 0, 1, 0, 0]

  let index = 1
  while (index < frames.length && (frames[index]?.t ?? 1) < t) index += 1
  const previous = frames[index - 1]
  const next = frames[index]
  if (!previous || !next) return last.matrix
  const span = next.t - previous.t
  const local = span === 0 ? 1 : (t - previous.t) / span
  return lerpMatrix(previous.matrix, next.matrix, local)
}

function idleProgress(now: number, startedAt: number) {
  const elapsed = (now - startedAt) % (idleMs * 2)
  const forward = elapsed / idleMs
  return forward <= 1 ? forward : 2 - forward
}

function sampleEmotion(emotion: Emotion, t: number): Pose {
  return {
    eye0: { values: emotion.eye0.values, matrix: sampleMatrix(emotion.eye0.frames, t) },
    eye1: { values: emotion.eye1.values, matrix: sampleMatrix(emotion.eye1.frames, t) },
  }
}

function lerpPose(from: Pose, to: Pose, t: number): Pose {
  return {
    eye0: {
      values: lerpValues(from.eye0.values, to.eye0.values, t),
      matrix: lerpMatrix(from.eye0.matrix, to.eye0.matrix, t),
    },
    eye1: {
      values: lerpValues(from.eye1.values, to.eye1.values, t),
      matrix: lerpMatrix(from.eye1.matrix, to.eye1.matrix, t),
    },
  }
}

function applyEye(el: SVGPathElement | null, values: number[], matrix: Matrix) {
  if (!el) return
  el.setAttribute('d', valuesToPath(values))
  el.style.transform = matrixCss(matrix)
}

function applyBody(el: SVGPathElement | null, values: number[]) {
  if (!el) return
  el.setAttribute('d', valuesToPath(values, bodyTemplate))
}

function addLook(matrix: Matrix, x: number, y: number): Matrix {
  const dist = Math.hypot(x, y)
  const tilt = dist === 0 ? 0 : Math.atan2(y, x) * 0.16 * Math.min(1, dist / 20)
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const [a, b, c, d, e, f] = matrix

  return [
    cos * a - sin * b,
    sin * a + cos * b,
    cos * c - sin * d,
    sin * c + cos * d,
    e + x,
    f + y,
  ]
}

function pointerToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const inv = ctm.inverse()
  return {
    x: inv.a * clientX + inv.c * clientY + inv.e,
    y: inv.b * clientX + inv.d * clientY + inv.f,
  }
}

function lookOffset(
  pointer: { x: number; y: number },
  matrix: Matrix,
  max: number,
) {
  const dx = pointer.x - matrix[4]
  const dy = pointer.y - matrix[5]
  const dist = Math.hypot(dx, dy) || 1
  const amount = max * (1 - Math.exp(-dist / 70))
  return { x: (dx / dist) * amount, y: (dy / dist) * amount }
}

function burstParticlePose(particle: (typeof BURST_PARTICLES)[number], elapsed: number) {
  const local = elapsed - particle.delay
  if (local < 0 || local > particle.duration) {
    return { x: 0, y: 0, r: 0, opacity: 0 }
  }

  const u = local / particle.duration
  const appear = easeOutCubic(clamp01(u / 0.18))
  const travel = easeInCubic(u)
  const dist = particle.dist * (1 - travel)
  const angle = particle.angle + (1 - travel) * 0.45
  const fadeOut = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1

  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    r: particle.radius * (0.3 + 0.7 * (1 - travel)) * appear,
    opacity: appear * fadeOut,
  }
}

function sampleBurst(elapsed: number, restEyes: Pose, targetBody: number[]) {
  const pop = easeOutBack(clamp01(elapsed / BURST_POP_MS))
  const expand = easeOutCubic(
    clamp01((elapsed - BURST_EXPAND_START) / (BURST_EXPAND_END - BURST_EXPAND_START)),
  )
  const eyes = easeOutCubic(
    clamp01((elapsed - BURST_EYES_START) / (BURST_EXPAND_END - BURST_EYES_START)),
  )
  const bloom = Math.sin(expand * Math.PI) * 0.06

  return {
    body: lerpValues(ballValues, targetBody, expand),
    scale: Math.max(0, pop + bloom),
    eye0: {
      values: restEyes.eye0.values,
      matrix: lerpMatrix(HIDDEN_EYE, restEyes.eye0.matrix, eyes),
    },
    eye1: {
      values: restEyes.eye1.values,
      matrix: lerpMatrix(HIDDEN_EYE, restEyes.eye1.matrix, eyes),
    },
    particles: BURST_PARTICLES.map((particle) => burstParticlePose(particle, elapsed)),
    done: elapsed >= BURST_DONE_MS,
  }
}

const initialPose = sampleEmotion(emotionsById.neutral, 0)

export function FeynmanView({ mapping, config }: SpecialViewProps<FeynmanConfig>) {
  const emotion = config.emotion
  const look = config.look
  const shape = config.shape ?? "hexagon"
  const eyes = config.eyeColor ?? { r: 249, g: 249, b: 249, a: 255 }
  const [bursting, setBursting] = useState(false)
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const maskId = `feynman-mask-${reactId}`
  const svgRef = useRef<SVGSVGElement>(null)
  const bodyGroupRef = useRef<SVGGElement>(null)
  const bodyMaskRef = useRef<SVGPathElement>(null)
  const bodyFillRef = useRef<SVGPathElement>(null)
  const eye0Ref = useRef<SVGPathElement>(null)
  const eye1Ref = useRef<SVGPathElement>(null)
  const particlesRef = useRef<(SVGCircleElement | null)[]>([])
  const targetRef = useRef<EmotionId>(emotion)
  const fromPoseRef = useRef<Pose | null>(null)
  const morphStartedAtRef = useRef<number | null>(null)
  const lastPoseRef = useRef<Pose>(sampleEmotion(emotionsById[emotion] ?? emotionsById.neutral, 0))
  const lookEnabledRef = useRef(look)
  const emotionRef = useRef(emotion)
  const shapeRef = useRef(shape)
  const fromBodyRef = useRef<number[] | null>(null)
  const bodyMorphAtRef = useRef<number | null>(null)
  const lastBodyRef = useRef(bodyForShape(shape))
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const lookRef = useRef({ x0: 0, y0: 0, x1: 0, y1: 0 })
  const burstStateRef = useRef<"idle" | "playing">("idle")
  const burstStartedAtRef = useRef(0)
  const idleStartedAtRef = useRef(performance.now())
  const burstingRef = useRef(false)

  useEffect(() => {
    lookEnabledRef.current = look
  }, [look])

  useEffect(() => {
    emotionRef.current = emotion
    if (targetRef.current === emotion) return
    fromPoseRef.current = lastPoseRef.current
    morphStartedAtRef.current = performance.now()
    targetRef.current = emotion
  }, [emotion])

  useEffect(() => {
    if (shapeRef.current === shape) return
    if (!burstingRef.current) {
      fromBodyRef.current = lastBodyRef.current
      bodyMorphAtRef.current = performance.now()
    }
    shapeRef.current = shape
  }, [shape])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    return () => window.removeEventListener("pointermove", onPointerMove)
  }, [])

  const startBurst = () => {
    fromPoseRef.current = null
    morphStartedAtRef.current = null
    targetRef.current = "neutral"
    burstStateRef.current = "playing"
    burstStartedAtRef.current = performance.now()
    burstingRef.current = true
    setBursting(true)
  }

  useEffect(() => {
    if (config.burstKey <= 0) return
    startBurst()
  }, [config.burstKey])

  useEffect(() => {
    let frame = 0

    const tick = (now: number) => {
      const burstState = burstStateRef.current
      const burstingNow = burstState === "playing"
      const elapsed = burstingNow ? now - burstStartedAtRef.current : 0

      if (burstingNow) {
        const targetBody = bodyForShape(shapeRef.current)
        const burst = sampleBurst(elapsed, initialPose, targetBody)
        applyBody(bodyMaskRef.current, burst.body)
        applyBody(bodyFillRef.current, burst.body)
        bodyGroupRef.current?.setAttribute("transform", `scale(${burst.scale})`)
        applyEye(eye0Ref.current, burst.eye0.values, burst.eye0.matrix)
        applyEye(eye1Ref.current, burst.eye1.values, burst.eye1.matrix)
        burst.particles.forEach((particle, index) => {
          const el = particlesRef.current[index]
          if (!el) return
          el.setAttribute("cx", String(particle.x))
          el.setAttribute("cy", String(particle.y))
          el.setAttribute("r", String(particle.r))
          el.setAttribute("opacity", String(particle.opacity))
        })

        lastPoseRef.current = { eye0: burst.eye0, eye1: burst.eye1 }
        lastBodyRef.current = burst.body

        if (burst.done) {
          burstStateRef.current = "idle"
          idleStartedAtRef.current = now
          bodyGroupRef.current?.setAttribute("transform", "scale(1)")
          applyBody(bodyMaskRef.current, targetBody)
          applyBody(bodyFillRef.current, targetBody)
          lastBodyRef.current = targetBody
          fromBodyRef.current = null
          bodyMorphAtRef.current = null
          particlesRef.current.forEach((el) => {
            el?.setAttribute("r", "0")
            el?.setAttribute("opacity", "0")
          })
          if (burstingRef.current) {
            burstingRef.current = false
            setBursting(false)
          }
          fromPoseRef.current = lastPoseRef.current
          morphStartedAtRef.current = now
          targetRef.current = emotionRef.current
        }

        frame = requestAnimationFrame(tick)
        return
      }

      const target = emotionsById[targetRef.current] ?? emotionsById.neutral
      const toPose = sampleEmotion(target, idleProgress(now, idleStartedAtRef.current))
      const fromPose = fromPoseRef.current
      const morphStartedAt = morphStartedAtRef.current
      let pose = toPose

      if (fromPose && morphStartedAt != null) {
        const mix = Math.min(1, (now - morphStartedAt) / MORPH_MS)
        pose = lerpPose(fromPose, toPose, easeInOutCubic(mix))
        if (mix >= 1) {
          fromPoseRef.current = null
          morphStartedAtRef.current = null
        }
      }

      lastPoseRef.current = pose

      const targetBody = bodyForShape(shapeRef.current)
      let body = targetBody
      const fromBody = fromBodyRef.current
      const bodyMorphAt = bodyMorphAtRef.current
      if (fromBody && bodyMorphAt != null) {
        const mix = Math.min(1, (now - bodyMorphAt) / MORPH_MS)
        body = lerpValues(fromBody, targetBody, easeInOutCubic(mix))
        if (mix >= 1) {
          fromBodyRef.current = null
          bodyMorphAtRef.current = null
        }
      }
      lastBodyRef.current = body
      applyBody(bodyMaskRef.current, body)
      applyBody(bodyFillRef.current, body)

      let eye0Matrix = pose.eye0.matrix
      let eye1Matrix = pose.eye1.matrix

      if (lookEnabledRef.current) {
        const svg = svgRef.current
        const pointer = pointerRef.current
        const lookAt =
          svg && pointer ? pointerToSvg(svg, pointer.x, pointer.y) : { x: 72, y: 4 }
        const target0 = lookAt ? lookOffset(lookAt, pose.eye0.matrix, 24) : { x: 0, y: 0 }
        const target1 = lookAt ? lookOffset(lookAt, pose.eye1.matrix, 22) : { x: 0, y: 0 }
        const lookState = lookRef.current
        lookState.x0 = lerp(lookState.x0, target0.x, 0.18)
        lookState.y0 = lerp(lookState.y0, target0.y, 0.18)
        lookState.x1 = lerp(lookState.x1, target1.x, 0.14)
        lookState.y1 = lerp(lookState.y1, target1.y, 0.14)
        eye0Matrix = addLook(eye0Matrix, lookState.x0, lookState.y0)
        eye1Matrix = addLook(eye1Matrix, lookState.x1, lookState.y1)
      }

      applyEye(eye0Ref.current, pose.eye0.values, eye0Matrix)
      applyEye(eye1Ref.current, pose.eye1.values, eye1Matrix)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const active = emotionsById[emotion]
  const restPose = bursting
    ? {
        eye0: { values: initialPose.eye0.values, matrix: HIDDEN_EYE },
        eye1: { values: initialPose.eye1.values, matrix: HIDDEN_EYE },
      }
    : sampleEmotion(emotionsById[emotion] ?? emotionsById.neutral, 0)
  const restBody = bursting
    ? valuesToPath(ballValues, bodyTemplate)
    : valuesToPath(bodyForShape(shape), bodyTemplate)
  const bodyColor = rgbaCss(mapping.color)
  const eyeColor = rgbaCss(eyes)
  const emotionLabel = active?.label ?? "curious"

  return (
    <div
      className="h-full w-full"
      style={
        {
          "--character": bodyColor,
          "--character-eye": eyeColor,
        } as CSSProperties
      }
    >
      <div className={`relative h-full w-full ${bursting ? "" : "feynman-float"}`}>
        <div className="feynman-svg absolute inset-0">
          <svg
            ref={svgRef}
            viewBox="-125 -125 250 250"
            role="img"
            aria-label={bursting ? "Feynman appearing" : `Feynman looking ${emotionLabel.toLowerCase()}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x="-158" y="-158" width="316" height="316">
                <path ref={bodyMaskRef} d={restBody} fill="#fff" />
                <path
                  ref={eye0Ref}
                  className="feynman-eye"
                  d={valuesToPath(restPose.eye0.values)}
                  fill="#000"
                  style={{ transform: matrixCss(restPose.eye0.matrix) }}
                />
                <path
                  ref={eye1Ref}
                  className="feynman-eye"
                  d={valuesToPath(restPose.eye1.values)}
                  fill="#000"
                  style={{ transform: matrixCss(restPose.eye1.matrix) }}
                />
              </mask>
            </defs>
            <g ref={bodyGroupRef} transform={bursting ? "scale(0)" : undefined}>
              <path ref={bodyFillRef} d={restBody} fill="var(--character-eye)" />
              <g mask={`url(#${maskId})`}>
                <rect x="-158" y="-158" width="316" height="316" fill="var(--character)" />
              </g>
            </g>
            {BURST_PARTICLES.map((_, index) => (
              <circle
                key={index}
                ref={(el) => {
                  particlesRef.current[index] = el
                }}
                cx="0"
                cy="0"
                r="0"
                fill="var(--character)"
                opacity="0"
              />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}
