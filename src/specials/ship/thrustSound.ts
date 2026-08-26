let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBufferSourceNode | null = null;
let humA: OscillatorNode | null = null;
let humB: OscillatorNode | null = null;
let lfo: OscillatorNode | null = null;
let rumbleOn = false;

const RUMBLE_GAIN = 0.26;

function context() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function brownBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    data[index] = Math.max(-1, Math.min(1, last * 4.5));
  }
  const fade = Math.min(512, Math.floor(length / 8));
  for (let index = 0; index < fade; index += 1) {
    const t = index / fade;
    const end = length - fade + index;
    const startSample = data[index] ?? 0;
    const endSample = data[end] ?? 0;
    data[end] = endSample * (1 - t) + startSample * t;
  }
  return buffer;
}

function ensureGraph() {
  const ctx = context();
  if (master) return ctx;

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 88;
  filter.Q.value = 0.9;
  filter.connect(master);

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.7;
  noiseGain.connect(filter);

  const source = ctx.createBufferSource();
  source.buffer = brownBuffer(ctx, 2.4);
  source.loop = true;
  source.connect(noiseGain);
  source.start();
  noise = source;

  const humGain = ctx.createGain();
  humGain.gain.value = 0.22;
  humGain.connect(master);

  humA = ctx.createOscillator();
  humA.type = "sine";
  humA.frequency.value = 46;
  humA.connect(humGain);
  humA.start();

  humB = ctx.createOscillator();
  humB.type = "sine";
  humB.frequency.value = 54.5;
  humB.connect(humGain);
  humB.start();

  lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 6.5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 22;
  lfo.connect(lfoDepth);
  lfoDepth.connect(filter.frequency);
  lfo.start();

  return ctx;
}

export function resumeThrustAudio() {
  context();
}

export function setThrustRumble(on: boolean) {
  if (on === rumbleOn && master) return;
  rumbleOn = on;
  if (!on && !master) return;
  const ctx = ensureGraph();
  if (!master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(0, master.gain.value), now);
  master.gain.linearRampToValueAtTime(on ? RUMBLE_GAIN : 0, now + (on ? 0.06 : 0.2));
}

export function stopThrustRumble() {
  rumbleOn = false;
  if (noise) {
    try {
      noise.stop();
    } catch {
      /* already stopped */
    }
  }
  if (humA) {
    try {
      humA.stop();
    } catch {
      /* already stopped */
    }
  }
  if (humB) {
    try {
      humB.stop();
    } catch {
      /* already stopped */
    }
  }
  if (lfo) {
    try {
      lfo.stop();
    } catch {
      /* already stopped */
    }
  }
  master?.disconnect();
  master = null;
  noise = null;
  humA = null;
  humB = null;
  lfo = null;
}
