import Konva from 'konva'
import { playSound } from '@/lib/sound'

/** Shrink-and-fade a machine or utility on the canvas, then call `done` (e.g. remove it from the store). */
export function animateNodeOut(id: string, done: () => void) {
  playSound('remove')
  const node = Konva.stages.map((s) => s.findOne(`#${id}`)).find(Boolean)
  if (!node) return done()
  node.listening(false)
  node.to({
    scaleX: 0.3,
    scaleY: 0.3,
    opacity: 0,
    duration: 0.18,
    easing: Konva.Easings.EaseIn,
    onFinish: done,
  })
}

/**
 * Set when the user places something, so the new node knows it was just placed (and gets its
 * landing effects) rather than loaded with the project.
 */
let placedAt = -Infinity
/** How long after a placement click a newly mounted node counts as just placed, ms. */
const FRESH_MS = 400

export function markPlaced() {
  placedAt = performance.now()
}

export function wasJustPlaced() {
  return performance.now() - placedAt < FRESH_MS
}

/** Dust colour: the warm grey of the floor outline, so the puff reads as floor dust. */
const DUST = '#a39b8e'
const PARTICLES = 12

/**
 * A little dust puff around a footprint that has just landed: specks fly out from its edges and
 * fade. `x`/`y` are the centre in the node's parent coordinates; `w`/`h` the footprint and
 * `fit` the zoom, so specks keep the same on-screen size.
 */
export function dustPuff(parent: Konva.Container, x: number, y: number, w: number, h: number, fit: number) {
  if (prefersReducedMotion()) return
  for (let i = 0; i < PARTICLES; i++) {
    const angle = (i / PARTICLES) * Math.PI * 2 + Math.random() * 0.4
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    // Start on the footprint's edge in that direction.
    const edge = Math.min(Math.abs(w / 2 / (dx || 1e-6)), Math.abs(h / 2 / (dy || 1e-6)))
    const speck = new Konva.Circle({
      x: x + dx * edge,
      y: y + dy * edge,
      radius: (2 + Math.random() * 2.5) / fit,
      fill: DUST,
      opacity: 0.55,
      listening: false,
    })
    parent.add(speck)
    const travel = (10 + Math.random() * 10) / fit
    speck.to({
      x: speck.x() + dx * travel,
      y: speck.y() + dy * travel,
      radius: 0.5 / fit,
      opacity: 0,
      duration: 0.4 + Math.random() * 0.2,
      easing: Konva.Easings.EaseOut,
      onFinish: () => speck.destroy(),
    })
  }
}

/** A quick side-to-side shake, for a clash. */
export function wobble(node: Konva.Node) {
  if (prefersReducedMotion()) return
  const base = node.rotation()
  const steps = [6, -5, 4, -2, 0]
  let i = 0
  const next = () => {
    if (i >= steps.length) return
    node.to({ rotation: base + steps[i++], duration: 0.05, easing: Konva.Easings.EaseInOut, onFinish: next })
  }
  next()
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
