import type { SoundConfig, SoundPresetId } from "./config";

type PulseListener = (id: string) => void;

const pulseListeners = new Set<PulseListener>();
const bufferCache = new Map<string, AudioBuffer>();

let audioCtx: AudioContext | null = null;
let pulse = { id: "", sequence: 0 };

function context() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

export function onSoundPulse(listener: PulseListener) {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

export function emitSoundPulse(id: string) {
  pulse = { id, sequence: pulse.sequence + 1 };
  for (const listener of pulseListeners) listener(id);
}

export function soundSnapshot() {
  return pulse;
}

export function applySoundSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return;
  const next = value as Partial<typeof pulse>;
  if (typeof next.id !== "string" || typeof next.sequence !== "number" || next.sequence <= pulse.sequence) return;
  pulse = { id: next.id, sequence: next.sequence };
  const mapping = (window as Window & { __roomMappings?: import("../../types").Mapping[] }).__roomMappings?.find((item) => item.id === next.id);
  if (!mapping || mapping.type !== "special") return;
  const config = mapping.config as unknown as SoundConfig;
  playSound(config);
}

function playSound(config: SoundConfig) {
  const ctx = context();
  const volume = Math.max(0, Math.min(1, config.volume));
  if (config.source === "custom" && config.customAudio) {
    void playCustom(ctx, config.customAudio, volume).catch(() => playPreset(ctx, config.preset, volume));
  } else playPreset(ctx, config.preset, volume);
}

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function connectOut(ctx: AudioContext, node: AudioNode, volume: number, start: number, duration: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  node.connect(gain);
  gain.connect(ctx.destination);
  return gain;
}

function playTone(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    frequency: number;
    endFrequency?: number;
    volume: number;
    start: number;
    duration: number;
  },
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = options.type;
  oscillator.frequency.setValueAtTime(options.frequency, options.start);
  if (options.endFrequency != null) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFrequency),
      options.start + options.duration,
    );
  }
  connectOut(ctx, oscillator, options.volume, options.start, options.duration);
  oscillator.start(options.start);
  oscillator.stop(options.start + options.duration + 0.02);
}

function playNoise(
  ctx: AudioContext,
  options: {
    volume: number;
    start: number;
    duration: number;
    frequency: number;
    q?: number;
    endFrequency?: number;
  },
) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, options.duration + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(options.frequency, options.start);
  filter.Q.value = options.q ?? 1.2;
  if (options.endFrequency != null) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, options.endFrequency),
      options.start + options.duration,
    );
  }
  source.connect(filter);
  connectOut(ctx, filter, options.volume, options.start, options.duration);
  source.start(options.start);
  source.stop(options.start + options.duration + 0.02);
}

function playPreset(ctx: AudioContext, preset: SoundPresetId, volume: number) {
  const start = ctx.currentTime;
  const v = volume;

  switch (preset) {
    case "click":
      playNoise(ctx, { volume: v * 0.7, start, duration: 0.06, frequency: 1800, q: 0.7 });
      playTone(ctx, { type: "sine", frequency: 1400, volume: v * 0.25, start, duration: 0.04 });
      break;
    case "beep":
      playTone(ctx, { type: "sine", frequency: 880, volume: v * 0.55, start, duration: 0.14 });
      break;
    case "bell":
      playTone(ctx, { type: "sine", frequency: 523, volume: v * 0.45, start, duration: 1.1 });
      playTone(ctx, { type: "sine", frequency: 1046, volume: v * 0.28, start, duration: 0.85 });
      playTone(ctx, { type: "sine", frequency: 1568, volume: v * 0.16, start, duration: 0.55 });
      break;
    case "thud":
      playTone(ctx, { type: "sine", frequency: 90, endFrequency: 42, volume: v * 0.8, start, duration: 0.28 });
      playNoise(ctx, { volume: v * 0.35, start, duration: 0.12, frequency: 180, q: 0.8 });
      break;
    case "whoosh":
      playNoise(ctx, {
        volume: v * 0.55,
        start,
        duration: 0.42,
        frequency: 1600,
        endFrequency: 280,
        q: 0.9,
      });
      break;
    case "laser":
      playTone(ctx, {
        type: "sawtooth",
        frequency: 1400,
        endFrequency: 180,
        volume: v * 0.28,
        start,
        duration: 0.32,
      });
      break;
    case "pop":
      playTone(ctx, { type: "sine", frequency: 420, endFrequency: 110, volume: v * 0.7, start, duration: 0.09 });
      break;
    case "chime":
      playTone(ctx, { type: "sine", frequency: 523, volume: v * 0.4, start, duration: 0.55 });
      playTone(ctx, { type: "sine", frequency: 659, volume: v * 0.38, start: start + 0.08, duration: 0.6 });
      break;
    default:
      break;
  }
}

export function playSoundPreset(preset: SoundPresetId, volume = 0.85) {
  playPreset(context(), preset, Math.max(0, Math.min(1, volume)));
}

async function decodeCustom(ctx: AudioContext, dataUrl: string) {
  const cached = bufferCache.get(dataUrl);
  if (cached) return cached;
  const response = await fetch(dataUrl);
  const raw = await response.arrayBuffer();
  const buffer = await ctx.decodeAudioData(raw.slice(0));
  bufferCache.set(dataUrl, buffer);
  return buffer;
}

async function playCustom(ctx: AudioContext, dataUrl: string, volume: number) {
  const buffer = await decodeCustom(ctx, dataUrl);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export function activateSound(mapping: { id: string }, config: SoundConfig) {
  emitSoundPulse(mapping.id);
  playSound(config);
}
