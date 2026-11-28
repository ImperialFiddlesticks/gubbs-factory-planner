/**
 * Small game-like sound effects, synthesised with the Web Audio API (no sound files).
 * Muting is remembered in this browser. All calls are safe to make at any time: without
 * audio support, or before the first user gesture, they simply do nothing.
 */

export type SoundName = 'place' | 'drop' | 'snap' | 'clash' | 'rotate' | 'remove' | 'undo' | 'redo' | 'goal' | 'pick' | 'resolve'

const MUTE_KEY = 'gubbs-sound-muted'
/** The same sound is not replayed within this time, ms (e.g. several pieces snapping at once). */
const REPEAT_GAP_MS = 70
/** Longer gaps for sounds that would nag if repeated, ms (two machines clashing at once buzz once). */
const LONG_GAPS: Partial<Record<SoundName, number>> = { clash: 600, goal: 1500 }
/** Overall volume, 0–1. Kept low: these are cues, not music. */
const MASTER_VOLUME = 0.35

let context: AudioContext | null = null
let master: GainNode | null = null
const lastPlayed = new Map<SoundName, number>()
const listeners = new Set<() => void>()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

let muted = readMuted()

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
  listeners.forEach((l) => l())
}

/** For useSyncExternalStore: re-render when the mute setting changes. */
export function subscribeMuted(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!context) {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = MASTER_VOLUME
    master.connect(context.destination)
  }
  if (context.state === 'suspended') void context.resume()
  return { ctx: context, out: master! }
}

/** One tone with a quick attack and an exponential fade; frequency can glide to `to`. */
function tone(
  { ctx, out }: { ctx: AudioContext; out: GainNode },
  {
    type = 'sine',
    from,
    to = from,
    start = 0,
    duration,
    volume = 0.5,
  }: { type?: OscillatorType; from: number; to?: number; start?: number; duration: number; volume?: number },
) {
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + duration)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** A short burst of filtered noise: the "dust" in a thunk, or a whoosh. */
function noise(
  { ctx, out }: { ctx: AudioContext; out: GainNode },
  { start = 0, duration, volume = 0.3, frequency = 800, q = 0.8 }: { start?: number; duration: number; volume?: number; frequency?: number; q?: number },
) {
  const t = ctx.currentTime + start
  const length = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = volume
  source.connect(filter).connect(gain).connect(out)
  source.start(t)
}

const SOUNDS: Record<SoundName, (a: { ctx: AudioContext; out: GainNode }) => void> = {
  // A soft wooden thunk as something lands on the floor.
  place: (a) => {
    tone(a, { from: 180, to: 70, duration: 0.18, volume: 0.6 })
    noise(a, { duration: 0.08, volume: 0.25, frequency: 500 })
  },
  // A lighter thunk when a dragged item is put down.
  drop: (a) => {
    tone(a, { from: 150, to: 80, duration: 0.12, volume: 0.4 })
    noise(a, { duration: 0.05, volume: 0.15, frequency: 450 })
  },
  // A crisp click as a belt or machine snaps into place.
  snap: (a) => {
    tone(a, { type: 'triangle', from: 1800, to: 1200, duration: 0.05, volume: 0.35 })
    tone(a, { type: 'triangle', from: 2400, duration: 0.04, start: 0.03, volume: 0.2 })
  },
  // A soft "uh-oh" buzz for a clash: two falling notes.
  clash: (a) => {
    tone(a, { type: 'square', from: 330, to: 300, duration: 0.11, volume: 0.12 })
    tone(a, { type: 'square', from: 247, to: 220, duration: 0.16, start: 0.12, volume: 0.12 })
  },
  // A quick swish when turning.
  rotate: (a) => {
    noise(a, { duration: 0.12, volume: 0.2, frequency: 1800, q: 1.5 })
    tone(a, { from: 520, to: 780, duration: 0.08, volume: 0.12 })
  },
  // A falling pop when something is removed.
  remove: (a) => {
    tone(a, { from: 600, to: 150, duration: 0.16, volume: 0.35 })
  },
  // Undo rewinds (falling blip), redo goes forward (rising blip).
  undo: (a) => {
    tone(a, { type: 'triangle', from: 700, to: 420, duration: 0.1, volume: 0.3 })
  },
  redo: (a) => {
    tone(a, { type: 'triangle', from: 420, to: 700, duration: 0.1, volume: 0.3 })
  },
  // A little rising chime for picking an item in the library.
  pick: (a) => {
    tone(a, { from: 880, duration: 0.07, volume: 0.18 })
    tone(a, { from: 1320, duration: 0.09, start: 0.05, volume: 0.15 })
  },
  // A bright two-note "ding" for a resolved comment.
  resolve: (a) => {
    tone(a, { type: 'triangle', from: 784, duration: 0.12, volume: 0.3 })
    tone(a, { type: 'triangle', from: 1175, duration: 0.25, start: 0.08, volume: 0.3 })
  },
  // The goal fanfare: a bright major arpeggio.
  goal: (a) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(a, { type: 'triangle', from: f, duration: 0.35, start: i * 0.09, volume: 0.35 })
    })
    tone(a, { from: 1567.98, duration: 0.6, start: 0.36, volume: 0.2 })
  },
}

export function playSound(name: SoundName) {
  if (muted) return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -Infinity) < (LONG_GAPS[name] ?? REPEAT_GAP_MS)) return
  lastPlayed.set(name, now)
  try {
    const a = audio()
    if (a) SOUNDS[name](a)
  } catch {
    // Audio is a nicety; never let it break the planner.
  }
}
